import Big from 'big.js';
import { 
  detectBalloonPayments, 
  validateBalloonCompliance 
} from '../src/calculators/balloon-detector';
import { 
  applySplitPaymentStrategy,
  applyExtendContractStrategy,
  applyHybridStrategy
} from '../src/calculators/balloon-strategies';
import { 
  BalloonDetectionConfig,
  LoanBalloonConfig 
} from '../src/types/balloon-payment-types';
import { AmortizationSchedule } from '../src/types/payment-types';
import { LoanTerms } from '../src/types/loan-types';

/**
 * Example: Detecting and handling balloon payments in a loan
 */

// Example amortization schedule with a balloon payment
const createExampleSchedule = (): AmortizationSchedule => {
  const payments = [
    { amount: 1200, principal: 800, interest: 400 },
    { amount: 1200, principal: 810, interest: 390 },
    { amount: 1200, principal: 820, interest: 380 },
    { amount: 1200, principal: 830, interest: 370 },
    { amount: 1200, principal: 840, interest: 360 },
    { amount: 1200, principal: 850, interest: 350 },
    { amount: 1200, principal: 860, interest: 340 },
    { amount: 1200, principal: 870, interest: 330 },
    { amount: 1200, principal: 880, interest: 320 },
    { amount: 1200, principal: 890, interest: 310 },
    { amount: 1200, principal: 900, interest: 300 },
    { amount: 25000, principal: 24700, interest: 300 } // Balloon payment
  ];
  
  let balance = new Big(100000);
  
  return {
    payments: payments.map((p, index) => {
      const beginningBalance = balance;
      balance = balance.minus(p.principal);
      
      return {
        paymentNumber: index + 1,
        dueDate: new Date(2024, index, 1),
        principal: new Big(p.principal),
        interest: new Big(p.interest),
        beginningBalance,
        endingBalance: balance
      };
    }),
    totalPayments: 12,
    totalInterest: new Big(4200),
    totalPrincipal: new Big(100000)
  };
};

// Configure balloon detection
const balloonConfig: BalloonDetectionConfig = {
  enabled: true,
  percentageThreshold: 50, // 50% above regular payment
  absoluteThreshold: new Big(500), // $500 above regular payment
  thresholdLogic: 'OR'
};

// Example loan terms
const loanTerms: LoanTerms = {
  principal: new Big(100000),
  annualRate: new Big(5),
  termMonths: 12,
  startDate: new Date('2024-01-01'),
  firstPaymentDate: new Date('2024-02-01'),
  maturityDate: new Date('2024-12-01'),
  paymentFrequency: 'monthly',
  calendarType: '30/360',
  roundingConfig: {
    method: 'HALF_UP',
    decimalPlaces: 2
  }
};

// Example 1: Detect balloon payments
console.log('=== Balloon Payment Detection ===');
const schedule = createExampleSchedule();
const balloons = detectBalloonPayments(schedule, balloonConfig);

balloons.forEach(balloon => {
  console.log(`\nBalloon payment detected:`);
  console.log(`- Payment #${balloon.payment?.paymentNumber}`);
  console.log(`- Amount: $${balloon.payment?.amount.toFixed(2)}`);
  console.log(`- Regular payment: $${balloon.payment?.regularPaymentAmount.toFixed(2)}`);
  console.log(`- Exceeds by: ${balloon.exceedsRegularBy?.percentage.toFixed(1)}% ($${balloon.exceedsRegularBy?.absolute.toFixed(2)})`);
});

// Example 2: Validate compliance
console.log('\n=== Compliance Validation ===');
const largestBalloon = balloons[0];
const complianceResult = validateBalloonCompliance(
  largestBalloon,
  'CA', // California
  'CONVENTIONAL'
);

console.log(`Compliant: ${complianceResult.compliant}`);
if (!complianceResult.compliant) {
  console.log('Violations:');
  complianceResult.violations.forEach(v => console.log(`- ${v}`));
}

// Example 3: Apply split payment strategy
console.log('\n=== Split Payment Strategy ===');
const splitResult = applySplitPaymentStrategy(
  schedule,
  largestBalloon,
  {
    numberOfPayments: 4, // Split across last 4 payments
    distributionMethod: 'EQUAL',
    maxPaymentIncrease: 2.0 // Allow up to 200% increase
  },
  loanTerms
);

if (splitResult.success) {
  console.log(splitResult.message);
  
  // Show modified payments
  const modifiedSchedule = splitResult.modifiedSchedule!;
  console.log('\nModified last 4 payments:');
  for (let i = 8; i < 12; i++) {
    const payment = modifiedSchedule.payments[i];
    const total = payment.principal.plus(payment.interest);
    console.log(`Payment #${payment.paymentNumber}: $${total.toFixed(2)}`);
  }
}

// Example 4: Apply extension strategy
console.log('\n=== Contract Extension Strategy ===');
const extensionResult = applyExtendContractStrategy(
  schedule,
  largestBalloon,
  {
    maxExtensionMonths: 24,
    targetPaymentIncrease: 0.1, // 10% increase
    requiresApproval: true
  },
  loanTerms
);

if (extensionResult.success) {
  console.log(extensionResult.message);
  if (extensionResult.newTerms) {
    console.log(`New term: ${extensionResult.newTerms.termMonths} months`);
    console.log(`New maturity date: ${extensionResult.newTerms.maturityDate.toLocaleDateString()}`);
  }
  if (extensionResult.warnings) {
    console.log('Warnings:', extensionResult.warnings);
  }
}

// Example 5: Full loan configuration with balloon handling
console.log('\n=== Complete Loan Configuration ===');
const loanWithBalloonConfig: LoanBalloonConfig = {
  detection: {
    enabled: true,
    percentageThreshold: 50,
    absoluteThreshold: new Big(500),
    thresholdLogic: 'OR'
  },
  handling: {
    strategy: 'HYBRID',
    config: {
      smallBalloonThreshold: new Big(5000),
      largeBalloonThreshold: new Big(20000)
    }
  },
  notificationDays: [180, 90, 60, 30, 15],
  audit: {
    requiresApproval: true,
    approvalLevel: 'SUPERVISOR',
    documentationRequired: ['Balloon Payment Disclosure', 'Borrower Acknowledgment']
  }
};

console.log('Loan configured with balloon payment handling:');
console.log(`- Detection threshold: ${loanWithBalloonConfig.detection.percentageThreshold}% or $${loanWithBalloonConfig.detection.absoluteThreshold}`);
console.log(`- Strategy: ${loanWithBalloonConfig.handling.strategy}`);
console.log(`- Notifications: ${loanWithBalloonConfig.notificationDays.join(', ')} days before`);
console.log(`- Approval required: ${loanWithBalloonConfig.audit.requiresApproval}`);