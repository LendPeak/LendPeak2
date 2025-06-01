import { LoanEngine } from '../src';

// Example 1: Simple Mortgage Calculation
console.log('=== Simple Mortgage Example ===');
const mortgage = LoanEngine.createLoan(
  300000,    // $300,000 principal
  4.5,       // 4.5% annual interest rate
  360,       // 30-year term (360 months)
  '2024-01-01'
);

const mortgagePayment = LoanEngine.calculatePayment(mortgage);
console.log(`Monthly Payment: ${LoanEngine.formatCurrency(mortgagePayment.monthlyPayment)}`);
console.log(`Total Interest: ${LoanEngine.formatCurrency(mortgagePayment.totalInterest)}`);
console.log(`Total Payments: ${LoanEngine.formatCurrency(mortgagePayment.totalPayments)}`);

// Example 2: Auto Loan with Bi-weekly Payments
console.log('\n=== Auto Loan Example ===');
const autoLoan = LoanEngine.createLoan(
  35000,     // $35,000 principal
  6.5,       // 6.5% annual interest rate
  60,        // 5-year term
  '2024-01-01',
  {
    paymentFrequency: 'bi-weekly',
    firstPaymentDate: LoanEngine.parseDate('2024-01-15')
  }
);

const autoSchedule = LoanEngine.generateSchedule(autoLoan);
console.log(`Bi-weekly Payment: ${LoanEngine.formatCurrency(autoSchedule.payments[0]?.totalPayment || 0)}`);
console.log(`Number of Payments: ${autoSchedule.payments.length}`);
console.log(`Total Interest: ${LoanEngine.formatCurrency(autoSchedule.totalInterest)}`);

// Example 3: Interest-Only Construction Loan
console.log('\n=== Interest-Only Construction Loan ===');
const constructionLoan = LoanEngine.createLoan(
  500000,    // $500,000 principal
  7.0,       // 7.0% annual interest rate
  12,        // 1-year term
  '2024-01-01',
  {
    interestType: 'simple',  // Interest-only
    paymentFrequency: 'monthly'
  }
);

const constructionPayment = LoanEngine.calculatePayment(constructionLoan);
console.log(`Monthly Interest Payment: ${LoanEngine.formatCurrency(constructionPayment.monthlyPayment)}`);

// Example 4: Balloon Payment Loan
console.log('\n=== Balloon Payment Loan ===');
const balloonLoan = LoanEngine.createLoan(
  200000,    // $200,000 principal
  5.0,       // 5.0% annual interest rate
  84,        // 7-year term
  '2024-01-01',
  {
    balloonPayment: LoanEngine.toBig(150000),  // $150,000 balloon payment
    balloonPaymentDate: LoanEngine.parseDate('2031-01-01')
  }
);

const balloonSchedule = LoanEngine.generateSchedule(balloonLoan);
console.log(`Regular Payment: ${LoanEngine.formatCurrency(balloonSchedule.payments[0]?.totalPayment || 0)}`);
console.log(`Number of Regular Payments: ${balloonSchedule.payments.length - 1}`);
console.log(`Balloon Payment: ${LoanEngine.formatCurrency(150000)}`);

// Example 5: APR Calculation with Fees
console.log('\n=== APR Calculation ===');
const loanWithFees = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
const paymentResult = LoanEngine.calculatePayment(loanWithFees);

// Calculate APR with $2,000 in origination fees
const apr = LoanEngine.calculateAPR(
  100000,
  paymentResult.monthlyPayment,
  360,
  2000  // Origination fees
);

console.log(`Note Rate: ${LoanEngine.formatPercentage(5.0)}`);
console.log(`APR (with fees): ${LoanEngine.formatPercentage(apr)}`);

// Example 6: Prepayment Scenario
console.log('\n=== Prepayment Scenario ===');
const originalLoan = LoanEngine.createLoan(200000, 5.5, 360, '2024-01-01');
const originalSchedule = LoanEngine.generateSchedule(originalLoan);

// Apply $20,000 prepayment after 2 years
const prepaymentSchedule = LoanEngine.applyPrepayment(
  originalSchedule,
  {
    amount: LoanEngine.toBig(20000),
    date: LoanEngine.parseDate('2026-01-01'),
    applyToPrincipal: true
  }
);

console.log(`Original Total Interest: ${LoanEngine.formatCurrency(originalSchedule.totalInterest)}`);
console.log(`After Prepayment Interest: ${LoanEngine.formatCurrency(prepaymentSchedule.totalInterest)}`);
console.log(`Interest Saved: ${LoanEngine.formatCurrency(
  originalSchedule.totalInterest.minus(prepaymentSchedule.totalInterest)
)}`);
console.log(`Months Saved: ${originalSchedule.payments.length - prepaymentSchedule.payments.length}`);

// Example 7: Daily Interest Accrual
console.log('\n=== Daily Interest Accrual ===');
const dailyInterest = LoanEngine.calculateDailyInterest(
  100000,    // $100,000 balance
  5.0,       // 5% annual rate
  'actual/365',
  '2024-03-01'
);

console.log(`Daily Interest Accrual: ${LoanEngine.formatCurrency(dailyInterest)}`);
console.log(`Monthly Interest (30 days): ${LoanEngine.formatCurrency(dailyInterest.times(30))}`);

// Example 8: Payoff Amount Calculation
console.log('\n=== Payoff Amount ===');
const payoffDate = '2025-06-15';
const payoffAmount = LoanEngine.getPayoffAmount(
  originalSchedule,
  payoffDate,
  true  // Include accrued interest
);

console.log(`Payoff Amount on ${payoffDate}: ${LoanEngine.formatCurrency(payoffAmount)}`);