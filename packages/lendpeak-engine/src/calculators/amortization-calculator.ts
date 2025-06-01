import Big from 'big.js';
import { Dayjs } from 'dayjs';
import {
  LoanTerms,
  Payment,
  AmortizationSchedule,
  PaymentFrequency,
} from '../types';
import {
  toBig,
  safeDivide,
  min,
  round,
  isZero,
  roundMoney,
  percentageMoney,
} from '../utils/decimal-utils';
import {
  getNextPaymentDate,
  calculateNumberOfPayments,
} from '../utils/date-utils';
import {
  calculateAmortizingPayment,
  calculateInterestOnlyPayment,
  calculatePaymentWithBalloon,
  getPaymentPeriodsPerYear,
} from './payment-calculator';
import { calculateIrregularPeriodInterest } from './interest-calculator';

/**
 * Generate a complete amortization schedule for a loan
 */
export function generateAmortizationSchedule(
  terms: LoanTerms
): AmortizationSchedule {
  const payments: Payment[] = [];
  let remainingBalance = terms.principal;
  let cumulativeInterest = toBig(0);
  let cumulativePrincipal = toBig(0);
  
  // Calculate regular payment amount
  const numberOfPayments = calculateNumberOfPayments(
    terms.termMonths,
    terms.paymentFrequency
  );
  
  let regularPayment: Big;
  if (terms.balloonPayment && terms.balloonPayment.gt(0)) {
    regularPayment = calculatePaymentWithBalloon(
      terms.principal,
      terms.annualInterestRate,
      numberOfPayments,
      terms.balloonPayment,
      terms.paymentFrequency
    );
  } else if (terms.interestType === 'simple') {
    regularPayment = calculateInterestOnlyPayment(
      terms.principal,
      terms.annualInterestRate,
      terms.paymentFrequency
    );
  } else {
    regularPayment = calculateAmortizingPayment(
      terms.principal,
      terms.annualInterestRate,
      numberOfPayments,
      terms.paymentFrequency
    );
  }
  
  // Generate payment schedule
  let currentDate = terms.firstPaymentDate || getNextPaymentDate(
    terms.startDate,
    terms.paymentFrequency
  );
  let previousDate = terms.startDate;
  
  for (let i = 1; i <= numberOfPayments; i++) {
    // Calculate interest for this period
    let interestPayment: Big;
    
    if (i === 1 && !terms.firstPaymentDate?.isSame(
      getNextPaymentDate(terms.startDate, terms.paymentFrequency)
    )) {
      // First payment with irregular period
      interestPayment = calculateIrregularPeriodInterest(
        remainingBalance,
        terms.annualInterestRate,
        previousDate,
        currentDate,
        terms.dayCountConvention,
        terms.roundingConfig
      );
    } else {
      // Regular period interest
      const periodsPerYear = getPaymentPeriodsPerYear(terms.paymentFrequency);
      const periodRate = safeDivide(
        terms.annualInterestRate,
        toBig(periodsPerYear * 100)
      );
      // Apply immediate rounding after percentage calculation
      interestPayment = roundMoney(
        remainingBalance.times(periodRate),
        terms.roundingConfig
      );
    }
    
    // Calculate principal payment
    let principalPayment: Big;
    let totalPayment: Big;
    
    if (terms.interestType === 'simple') {
      // Interest-only loan
      principalPayment = toBig(0);
      totalPayment = interestPayment;
      
      // Last payment includes principal
      if (i === numberOfPayments) {
        principalPayment = remainingBalance;
        totalPayment = totalPayment.plus(principalPayment);
      }
    } else {
      // Amortizing loan
      totalPayment = regularPayment;
      principalPayment = totalPayment.minus(interestPayment);
      
      // Handle balloon payment on last payment
      if (i === numberOfPayments && terms.balloonPayment && terms.balloonPayment.gt(0)) {
        // For balloon loans, the last regular payment pays down to the balloon amount
        const targetBalance = terms.balloonPayment;
        principalPayment = remainingBalance.minus(targetBalance);
        
        // Ensure principal payment is not negative
        if (principalPayment.lt(0)) {
          principalPayment = toBig(0);
        }
        
        totalPayment = principalPayment.plus(interestPayment);
      } else if (i === numberOfPayments) {
        // Last payment - pay off remaining balance
        principalPayment = remainingBalance;
        totalPayment = principalPayment.plus(interestPayment);
      }
    }
    
    // Ensure principal doesn't exceed remaining balance
    principalPayment = min(principalPayment, remainingBalance);
    
    // Round principal payment
    principalPayment = roundMoney(principalPayment, terms.roundingConfig);
    
    // Recalculate total payment after rounding to ensure consistency
    totalPayment = interestPayment.plus(principalPayment);
    
    // Update balances
    remainingBalance = remainingBalance.minus(principalPayment);
    remainingBalance = roundMoney(remainingBalance, terms.roundingConfig);
    
    cumulativeInterest = cumulativeInterest.plus(interestPayment);
    cumulativePrincipal = cumulativePrincipal.plus(principalPayment);
    
    // Create payment record - values already rounded
    const currentBeginningBalance = remainingBalance.plus(principalPayment); // Balance before this payment's principal was deducted

    payments.push({
      paymentNumber: i,
      dueDate: currentDate,
      principal: principalPayment,
      interest: interestPayment,
      totalPayment: totalPayment,
      beginningBalance: currentBeginningBalance, // Added
      endingBalance: remainingBalance, // Added (this is remainingBalance after principal deduction)
      remainingBalance: remainingBalance, // This is effectively the same as endingBalance
      cumulativeInterest: cumulativeInterest,
      cumulativePrincipal: cumulativePrincipal,
    });
    
    // Move to next payment date
    previousDate = currentDate;
    currentDate = getNextPaymentDate(currentDate, terms.paymentFrequency);
  }
  
  // Add balloon payment as a separate entry if needed
  if (terms.balloonPayment && terms.balloonPayment.gt(0) && remainingBalance.gt(0)) {
    const balloonDate = terms.balloonPaymentDate || currentDate;
    const balloonPrincipal = roundMoney(remainingBalance, terms.roundingConfig);
    const finalBeginningBalance = remainingBalance.plus(balloonPrincipal); // Balance before this final balloon payment

    payments.push({
      paymentNumber: payments.length + 1,
      dueDate: balloonDate,
      principal: balloonPrincipal,
      interest: toBig(0),
      totalPayment: balloonPrincipal,
      beginningBalance: finalBeginningBalance, // Added
      endingBalance: toBig(0), // Added (loan ends)
      remainingBalance: toBig(0),
      cumulativeInterest: cumulativeInterest,
      cumulativePrincipal: cumulativePrincipal.plus(balloonPrincipal),
    });
  }
  
  // Calculate totals
  const totalPrincipal = terms.principal;
  const totalInterest = payments.reduce(
    (sum, payment) => sum.plus(payment.interest),
    toBig(0)
  );
  const totalPayments = totalPrincipal.plus(totalInterest);
  
  // Calculate effective interest rate
  const effectiveInterestRate = calculateEffectiveAPR(
    terms.principal,
    payments,
    terms.paymentFrequency
  );
  
  return {
    payments,
    totalInterest,
    totalPrincipal,
    totalPayments,
    effectiveInterestRate,
    lastPaymentDate: payments[payments.length - 1]?.dueDate || currentDate,
    loanTerms: terms, // Add this line
  };
}

/**
 * Calculate the effective APR based on actual payments
 */
function calculateEffectiveAPR(
  principal: Big,
  payments: Payment[],
  paymentFrequency: PaymentFrequency
): Big {
  // If no interest paid, APR is 0
  const totalInterest = payments.reduce(
    (sum, payment) => sum.plus(payment.interest),
    toBig(0)
  );
  
  if (isZero(totalInterest)) {
    return toBig(0);
  }
  
  // Simple approximation: (Total Interest / Principal) * (12 / Term in Months) * 100
  const termMonths = payments.length / (getPaymentPeriodsPerYear(paymentFrequency) / 12);
  const apr = safeDivide(totalInterest, principal)
    .times(12)
    .div(termMonths)
    .times(100);
  
  return round(apr, 3);
}

/**
 * Generate partial amortization schedule from a specific payment number
 */
export function generatePartialAmortizationSchedule(
  terms: LoanTerms,
  startingBalance: Big,
  startingPaymentNumber: number,
  numberOfPaymentsToGenerate: number
): Payment[] {
  // Create modified terms with the new starting balance
  const modifiedTerms: LoanTerms = {
    ...terms,
    principal: startingBalance,
    termMonths: Math.ceil(
      numberOfPaymentsToGenerate * 12 / getPaymentPeriodsPerYear(terms.paymentFrequency)
    ),
  };
  
  // Generate full schedule and extract requested payments
  const fullSchedule = generateAmortizationSchedule(modifiedTerms);
  
  // Adjust payment numbers
  return fullSchedule.payments.slice(0, numberOfPaymentsToGenerate).map(payment => ({
    ...payment,
    paymentNumber: payment.paymentNumber + startingPaymentNumber - 1,
  }));
}

/**
 * Recalculate amortization schedule with prepayment
 */
export function recalculateWithPrepayment(
  originalSchedule: AmortizationSchedule,
  prepaymentAmount: Big,
  prepaymentDate: Dayjs,
  applyToPrincipal: boolean
): AmortizationSchedule {
  // Find the payment where prepayment occurs
  const prepaymentIndex = originalSchedule.payments.findIndex(
    payment => payment.dueDate.isAfter(prepaymentDate)
  );
  
  if (prepaymentIndex === -1) {
    // Prepayment is after all payments
    return originalSchedule;
  }
  
  // Copy payments up to prepayment
  const newPayments = originalSchedule.payments.slice(0, prepaymentIndex);
  
  // Get balance at prepayment point
  let remainingBalance = prepaymentIndex > 0
    ? originalSchedule.payments[prepaymentIndex - 1]!.remainingBalance
    : originalSchedule.payments[0]!.remainingBalance.plus(
        originalSchedule.payments[0]!.principal
      );
  
  if (applyToPrincipal) {
    // Apply prepayment to principal
    remainingBalance = remainingBalance.minus(prepaymentAmount);
    
    // If fully paid off, no more payments needed
    if (remainingBalance.lte(0)) {
      return {
        ...originalSchedule,
        payments: newPayments,
        totalInterest: newPayments.reduce(
          (sum, payment) => sum.plus(payment.interest),
          toBig(0)
        ),
        totalPrincipal: originalSchedule.totalPrincipal,
        totalPayments: newPayments.reduce(
          (sum, payment) => sum.plus(payment.totalPayment),
          toBig(0)
        ).plus(prepaymentAmount),
        lastPaymentDate: prepaymentDate,
      };
    }
    
    // Recalculate remaining payments with new balance
    // This is a simplified approach - in practice, you might want to
    // maintain the same payment amount and reduce the term, or
    // maintain the same term and reduce the payment amount
    const remainingPayments = originalSchedule.payments.length - prepaymentIndex;
    
    // Continue with same payment amount but adjust last payment
    for (let i = prepaymentIndex; i < originalSchedule.payments.length; i++) {
      const originalPayment = originalSchedule.payments[i]!;
      const interestPayment = remainingBalance.times(
        safeDivide(originalPayment.interest, originalPayment.remainingBalance.plus(originalPayment.principal))
      );
      
      const principalPayment = min(
        originalPayment.totalPayment.minus(interestPayment),
        remainingBalance
      );
      
      remainingBalance = remainingBalance.minus(principalPayment);
      
      newPayments.push({
        ...originalPayment,
        principal: principalPayment,
        interest: interestPayment,
        remainingBalance,
        cumulativeInterest: newPayments[newPayments.length - 1]!.cumulativeInterest.plus(interestPayment),
        cumulativePrincipal: newPayments[newPayments.length - 1]!.cumulativePrincipal.plus(principalPayment),
      });
      
      if (remainingBalance.lte(0)) {
        break;
      }
    }
  }
  
  // Recalculate totals
  const totalInterest = newPayments.reduce(
    (sum, payment) => sum.plus(payment.interest),
    toBig(0)
  );
  const totalPayments = originalSchedule.totalPrincipal.plus(totalInterest);
  
  return {
    payments: newPayments,
    totalInterest,
    totalPrincipal: originalSchedule.totalPrincipal,
    totalPayments,
    effectiveInterestRate: originalSchedule.effectiveInterestRate, // TODO: This might need recalculation
    lastPaymentDate: newPayments[newPayments.length - 1]?.dueDate || originalSchedule.lastPaymentDate,
    loanTerms: originalSchedule.loanTerms, // Add this line
  };
}