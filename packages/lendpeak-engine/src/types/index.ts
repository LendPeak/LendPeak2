// Re-export all types from separate modules
export * from './common';
export * from './loan';
export * from './balloon-payment-types';

// Additional exports that don't fit in the modular structure
import Big from 'big.js';
import { Dayjs } from 'dayjs';
import { RoundingConfig } from './common';

export type PaymentFrequency = 
  | 'monthly'
  | 'semi-monthly'
  | 'bi-weekly'
  | 'weekly'
  | 'quarterly'
  | 'semi-annually'
  | 'annually';

export type InterestType = 
  | 'simple'
  | 'compound'
  | 'amortized';

export type LoanStatus = 
  | 'active'
  | 'paid-off'
  | 'defaulted'
  | 'restructured';

export type DayCountConvention = 
  | '30/360'
  | 'actual/360'
  | 'actual/365'
  | 'actual/actual';

export interface LoanTerms {
  principal: Big;
  annualInterestRate: Big;
  termMonths: number;
  paymentFrequency: PaymentFrequency;
  startDate: Dayjs;
  firstPaymentDate?: Dayjs;
  interestType: InterestType;
  dayCountConvention: DayCountConvention;
  balloonPayment?: Big;
  balloonPaymentDate?: Dayjs;
  roundingConfig?: RoundingConfig;
}

export interface Payment {
  paymentNumber: number;
  dueDate: Dayjs;
  principal: Big;
  interest: Big;
  totalPayment: Big;
  remainingBalance: Big;
  cumulativeInterest: Big;
  cumulativePrincipal: Big;
  // Added to align with ScheduledPayment from payment-types.ts
  beginningBalance: Big;
  endingBalance: Big;
  fees?: Big;
  escrow?: Big;
}

export interface AmortizationSchedule {
  payments: Payment[];
  totalInterest: Big;
  totalPrincipal: Big;
  totalPayments: Big;
  effectiveInterestRate: Big;
  lastPaymentDate: Dayjs;
}

export interface PaymentCalculationResult {
  monthlyPayment: Big;
  totalInterest: Big;
  totalPayments: Big;
  effectiveInterestRate: Big;
}

export interface InterestCalculationParams {
  principal: Big;
  annualRate: Big;
  startDate: Dayjs;
  endDate: Dayjs;
  dayCountConvention: DayCountConvention;
  roundingConfig?: RoundingConfig;
}

export interface InterestCalculationResult {
  interestAmount: Big;
  dayCount: number;
  dailyRate: Big;
}

export interface PrepaymentParams {
  amount: Big;
  date: Dayjs;
  applyToPrincipal: boolean;
}

export interface LoanModification {
  effectiveDate: Dayjs;
  newRate?: Big;
  newTermMonths?: number;
  principalAdjustment?: Big;
  paymentAdjustment?: Big;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface CalculationOptions {
  roundingMode?: Big.RoundingMode;
  decimalPlaces?: number;
  includeLastDayInInterest?: boolean;
}