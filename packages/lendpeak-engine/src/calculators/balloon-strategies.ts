import Big from 'big.js';
import { 
  BalloonDetectionResult,
  SplitPaymentConfig,
  ExtendContractConfig,
  HybridStrategyConfig,
  BalloonStrategy
} from '../types/balloon-payment-types';
import { 
  AmortizationSchedule, 
  ScheduledPayment, 
  PaymentCalculationResult 
} from '../types/payment-types';
import { LoanTerms } from '../types'; // Corrected import
import { roundMoney } from '../utils/decimal-utils';
import { generateAmortizationSchedule } from './amortization-calculator';
import { addMonths } from '../utils/date-utils';

/**
 * Result of applying a balloon payment strategy
 */
export interface BalloonStrategyResult {
  strategy: BalloonStrategy;
  success: boolean;
  modifiedSchedule?: AmortizationSchedule;
  newTerms?: Partial<LoanTerms>;
  message: string;
  warnings?: string[];
}

/**
 * Applies the split payment strategy to distribute balloon amount
 */
export function applySplitPaymentStrategy(
  schedule: AmortizationSchedule,
  balloon: BalloonDetectionResult,
  config: SplitPaymentConfig,
  terms: LoanTerms
): BalloonStrategyResult {
  if (!balloon.detected || !balloon.payment) {
    return {
      strategy: 'SPLIT_PAYMENTS',
      success: false,
      message: 'No balloon payment detected'
    };
  }
  
  const balloonPaymentIndex = schedule.payments.findIndex(
    p => p.paymentNumber === balloon.payment!.paymentNumber
  );
  
  if (balloonPaymentIndex === -1) {
    return {
      strategy: 'SPLIT_PAYMENTS',
      success: false,
      message: 'Balloon payment not found in schedule'
    };
  }
  
  // Calculate how much extra needs to be distributed
  const excessAmount = balloon.exceedsRegularBy?.absolute || new Big(0);
  
  // Determine which payments to modify
  const paymentsToModify = Math.min(
    config.numberOfPayments,
    balloonPaymentIndex + 1 // Can't modify more payments than exist
  );
  
  if (paymentsToModify < 2) {
    return {
      strategy: 'SPLIT_PAYMENTS',
      success: false,
      message: 'Not enough payments available to split balloon amount'
    };
  }
  
  // Calculate distribution amounts
  // We distribute across N-1 payments (excluding the balloon itself)
  const distributionAmounts = calculateDistribution(
    excessAmount,
    paymentsToModify - 1, // Exclude the balloon payment from distribution
    config.distributionMethod,
    schedule.payments.slice(
      balloonPaymentIndex - paymentsToModify + 1,
      balloonPaymentIndex // Don't include the balloon payment
    ).map(p => p.principal.plus(p.interest)),
    config.maxPaymentIncrease
  );
  
  if (!distributionAmounts) {
    return {
      strategy: 'SPLIT_PAYMENTS',
      success: false,
      message: 'Cannot distribute balloon amount within payment increase limits'
    };
  }
  
  // Create modified schedule with deep copy of payments
  const modifiedPayments = schedule.payments.map(p => ({
    ...p,
    principal: p.principal,
    interest: p.interest,
    beginningBalance: p.beginningBalance,
    endingBalance: p.endingBalance
  }));
  const warnings: string[] = [];
  
  // Apply distribution to the last N payments
  for (let i = 0; i < paymentsToModify; i++) {
    const paymentIndex = balloonPaymentIndex - paymentsToModify + 1 + i;
    const payment = modifiedPayments[paymentIndex];
    
    // For the balloon payment itself, reduce by the total distributed to others
    if (paymentIndex === balloonPaymentIndex) {
      const totalDistributed = distributionAmounts
        .reduce((sum, amt) => sum.plus(amt), new Big(0));
      
      payment.principal = roundMoney(
        payment.principal.minus(totalDistributed),
        terms.roundingConfig
      );
    } else {
      // For other payments, add the distributed amount to principal
      const distributionIndex = i; // Since balloon is last, this maps correctly
      const additionalAmount = distributionAmounts[distributionIndex];
      
      payment.principal = roundMoney(
        payment.principal.plus(additionalAmount),
        terms.roundingConfig
      );
    }
    
    // Recalculate total payment
    const newTotal = payment.principal.plus(payment.interest);
    const originalTotal = schedule.payments[paymentIndex].principal
      .plus(schedule.payments[paymentIndex].interest);
    
    const increase = newTotal.minus(originalTotal).div(originalTotal).times(100);
    if (increase.gt(config.maxPaymentIncrease * 100)) {
      warnings.push(
        `Payment ${payment.paymentNumber} increase of ${increase.toFixed(1)}% exceeds limit`
      );
    }
    
    // Update running balance
    if (paymentIndex > 0) {
      payment.beginningBalance = modifiedPayments[paymentIndex - 1].endingBalance;
    }
    payment.endingBalance = payment.beginningBalance.minus(payment.principal);
  }
  
  return {
    strategy: 'SPLIT_PAYMENTS',
    success: true,
    modifiedSchedule: {
      ...schedule,
      payments: modifiedPayments
    },
    message: `Balloon payment of $${excessAmount.toFixed(2)} distributed across ${paymentsToModify} payments`,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Applies the contract extension strategy to eliminate balloon
 */
export function applyExtendContractStrategy(
  schedule: AmortizationSchedule,
  balloon: BalloonDetectionResult,
  config: ExtendContractConfig,
  terms: LoanTerms
): BalloonStrategyResult {
  if (!balloon.detected || !balloon.payment) {
    return {
      strategy: 'EXTEND_CONTRACT',
      success: false,
      message: 'No balloon payment detected'
    };
  }
  
  // Find the balloon payment
  const balloonPaymentIndex = schedule.payments.findIndex(
    p => p.paymentNumber === balloon.payment!.paymentNumber
  );
  
  if (balloonPaymentIndex === -1) {
    return {
      strategy: 'EXTEND_CONTRACT',
      success: false,
      message: 'Balloon payment not found in schedule'
    };
  }
  
  // Calculate remaining balance at balloon payment
  const remainingBalance = balloon.payment.amount;
  const regularPayment = balloon.payment.regularPaymentAmount;
  
  // Calculate how many additional months are needed
  let extensionMonths = 0;
  let testBalance = remainingBalance;
  const targetPayment = regularPayment.times(1 + config.targetPaymentIncrease);
  
  // Simple calculation: how many months at target payment to pay off balance
  const monthlyRate = terms.annualInterestRate.div(12).div(100); // Changed annualRate to annualInterestRate
  
  while (testBalance.gt(0) && extensionMonths < config.maxExtensionMonths) {
    extensionMonths++;
    const interestPayment = testBalance.times(monthlyRate);
    const principalPayment = targetPayment.minus(interestPayment);
    
    if (principalPayment.lte(0)) {
      // Payment doesn't cover interest - need higher payment
      return {
        strategy: 'EXTEND_CONTRACT',
        success: false,
        message: 'Target payment too low to cover interest on remaining balance'
      };
    }
    
    testBalance = testBalance.minus(principalPayment);
  }
  
  if (testBalance.gt(0)) {
    return {
      strategy: 'EXTEND_CONTRACT',
      success: false,
      message: `Cannot pay off balance within maximum extension of ${config.maxExtensionMonths} months`
    };
  }
  
  // Create new terms with extended loan period
  const newOverallTermMonths = terms.termMonths + extensionMonths;

  // Define new loan terms for a full recalculation
  const newTermsForRecalc: LoanTerms = {
    ...terms, // Spread original terms to retain all other settings
    termMonths: newOverallTermMonths,
    balloonPayment: undefined, // Balloon is being amortized out
    balloonPaymentDate: undefined,
    // firstPaymentDate should be the original one, or adjusted if necessary
    // For simplicity, we assume generateAmortizationSchedule handles it based on startDate and term.
  };
  
  // Recalculate the entire schedule with the new extended term
  const modifiedSchedule = generateAmortizationSchedule(newTermsForRecalc);

  return {
    strategy: 'EXTEND_CONTRACT',
    success: true,
    newTerms: { // Summary of changes
      termMonths: newOverallTermMonths,
      maturityDate: modifiedSchedule.lastPaymentDate
    },
    modifiedSchedule: modifiedSchedule, // The newly generated schedule
    message: `Loan term extended by ${extensionMonths} months to eliminate balloon payment. Full new schedule generated.`,
    warnings: config.requiresApproval 
      ? ['This extension requires underwriting approval'] 
      : undefined
  };
}

/**
 * Applies the hybrid strategy based on balloon amount
 */
export function applyHybridStrategy(
  schedule: AmortizationSchedule,
  balloon: BalloonDetectionResult,
  config: HybridStrategyConfig,
  terms: LoanTerms
): BalloonStrategyResult {
  if (!balloon.detected || !balloon.payment) {
    return {
      strategy: 'HYBRID',
      success: false,
      message: 'No balloon payment detected'
    };
  }
  
  const balloonAmount = balloon.exceedsRegularBy?.absolute || new Big(0);
  
  // Determine which strategy to use based on amount
  if (balloonAmount.lte(config.smallBalloonThreshold)) {
    // Small balloon - use split payments
    return applySplitPaymentStrategy(
      schedule,
      balloon,
      {
        numberOfPayments: 3,
        distributionMethod: 'EQUAL',
        maxPaymentIncrease: 0.25 // 25% max increase
      },
      terms
    );
  } else if (balloonAmount.gte(config.largeBalloonThreshold)) {
    // Large balloon - use extension
    return applyExtendContractStrategy(
      schedule,
      balloon,
      {
        maxExtensionMonths: 12,
        targetPaymentIncrease: 0.1, // 10% increase
        requiresApproval: true
      },
      terms
    );
  } else {
    // Medium balloon - offer choice (for now, default to split)
    return {
      strategy: 'HYBRID',
      success: true,
      message: `Balloon amount of $${balloonAmount.toFixed(2)} requires borrower choice between payment split or term extension`,
      warnings: ['Borrower must select preferred restructuring option']
    };
  }
}

/**
 * Calculates how to distribute an amount across payments
 */
function calculateDistribution(
  amount: Big,
  numberOfPayments: number,
  method: 'EQUAL' | 'GRADUATED',
  currentPayments: Big[],
  maxIncreaseRate: number
): Big[] | null {
  const distributions: Big[] = [];
  
  if (method === 'EQUAL') {
    // Equal distribution
    const perPayment = amount.div(numberOfPayments);
    
    // Check if any payment would exceed max increase
    for (let i = 0; i < numberOfPayments; i++) {
      const currentPayment = currentPayments[i];
      const newPayment = currentPayment.plus(perPayment);
      const increaseRate = newPayment.minus(currentPayment).div(currentPayment);
      
      if (increaseRate.gt(maxIncreaseRate)) {
        return null; // Cannot distribute within limits
      }
      
      distributions.push(perPayment);
    }
  } else {
    // Graduated distribution - smaller amounts first, larger at the end
    const baseAmount = amount.div(numberOfPayments * 1.5); // Average will be correct
    
    for (let i = 0; i < numberOfPayments; i++) {
      // Graduate from 50% of base to 150% of base
      const factor = 0.5 + (i / (numberOfPayments - 1));
      const thisAmount = baseAmount.times(factor);
      
      const currentPayment = currentPayments[i];
      const newPayment = currentPayment.plus(thisAmount);
      const increaseRate = newPayment.minus(currentPayment).div(currentPayment);
      
      if (increaseRate.gt(maxIncreaseRate)) {
        return null; // Cannot distribute within limits
      }
      
      distributions.push(thisAmount);
    }
  }
  
  // Ensure total equals amount (adjust for rounding)
  const total = distributions.reduce((sum, d) => sum.plus(d), new Big(0));
  const difference = amount.minus(total);
  if (difference.abs().gt(0.01)) {
    distributions[distributions.length - 1] = distributions[distributions.length - 1].plus(difference);
  }
  
  return distributions.map(d => roundMoney(d));
}