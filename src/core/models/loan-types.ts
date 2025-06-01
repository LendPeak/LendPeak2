import Big from 'big.js';

/**
 * Represents an entry in an amortization schedule
 */
export interface AmortizationScheduleEntry {
  paymentNumber: number;
  paymentDate: Date;
  scheduledPayment: Big;
  principalPayment: Big;
  interestPayment: Big;
  totalPayment: Big;
  remainingBalance: Big;
  cumulativeInterest: Big;
  cumulativePrincipal: Big;
  balloonPayment?: Big;
}

/**
 * Complete payment schedule for a loan
 */
export interface PaymentSchedule {
  entries: AmortizationScheduleEntry[];
  totalPayments: Big;
  totalInterest: Big;
  totalPrincipal: Big;
  monthlyPayment: Big;
  firstPaymentDate: Date;
  lastPaymentDate: Date;
  termMonths: number;
}

/**
 * Parameters for calculating monthly payment
 */
export interface MonthlyPaymentParams {
  principal: Big;
  annualRate: Big;
  termMonths: number;
}

/**
 * Parameters for generating amortization schedule
 */
export interface AmortizationScheduleParams {
  principal: Big;
  annualRate: Big;
  termMonths: number;
  startDate: Date;
  firstPaymentDate: Date;
  balloonPayment?: {
    amount: Big;
    paymentNumber: number;
  };
}

/**
 * Payment allocation details
 */
export interface PaymentAllocation {
  payment: Big;
  remainingBalance: Big;
  interestDue: Big;
  principalDue: Big;
}

/**
 * Result of payment allocation
 */
export interface PaymentAllocationResult {
  interestPaid: Big;
  principalPaid: Big;
  remainingPayment: Big;
  unpaidInterest: Big;
  newBalance: Big;
}

/**
 * Loan status at a point in time
 */
export interface LoanStatus {
  currentBalance: Big;
  nextPaymentDate: Date;
  nextPaymentAmount: Big;
  paymentsMade: number;
  totalInterestPaid: Big;
  totalPrincipalPaid: Big;
  isDelinquent: boolean;
  daysPastDue: number;
}

/**
 * Loan configuration
 */
export interface LoanConfig {
  loanId: string;
  principal: Big;
  annualRate: Big;
  termMonths: number;
  originationDate: Date;
  firstPaymentDate: Date;
  paymentFrequency: 'monthly' | 'biweekly' | 'weekly';
  loanType: 'amortized' | 'simple_interest' | 'blended';
}

/**
 * Prepayment options
 */
export interface PrepaymentOption {
  type: 'reduce_term' | 'reduce_payment' | 'curtailment';
  amount: Big;
  effectiveDate: Date;
}