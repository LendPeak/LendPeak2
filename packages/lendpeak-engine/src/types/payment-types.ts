import { Big } from 'big.js';
import { Dayjs } from 'dayjs';

/**
 * Payment frequency types
 */
export type PaymentFrequency = 
  | 'monthly'
  | 'semi-monthly'
  | 'bi-weekly'
  | 'weekly'
  | 'quarterly'
  | 'semi-annually'
  | 'annually';

/**
 * Calendar types for day count calculations
 */
export type CalendarType = 
  | '30/360'
  | 'ACTUAL/360'
  | 'ACTUAL/365'
  | 'ACTUAL/ACTUAL';

/**
 * Represents a scheduled payment in an amortization schedule
 */
export interface ScheduledPayment {
  paymentNumber: number;
  dueDate: Dayjs; // Changed from Date
  principal: Big;
  interest: Big;
  beginningBalance: Big;
  endingBalance: Big;
  fees?: Big;
  escrow?: Big;
}

/**
 * Complete amortization schedule
 */
export interface AmortizationSchedule {
  payments: ScheduledPayment[];
  totalPayments: Big; // Changed from number to Big
  totalInterest: Big;
  totalPrincipal: Big;
  totalFees?: Big;
  effectiveRate?: Big;
}

/**
 * Result of a payment calculation
 */
export interface PaymentCalculationResult {
  monthlyPayment: Big;
  totalInterest: Big;
  totalPayment: Big;
  schedule?: AmortizationSchedule;
}

/**
 * Payment modification types
 */
export type PaymentModificationType = 
  | 'DEFERRAL'
  | 'FORBEARANCE'
  | 'INTEREST_ONLY'
  | 'PAYMENT_REDUCTION'
  | 'TERM_EXTENSION'
  | 'BALLOON_RESTRUCTURE';

/**
 * Payment modification details
 */
export interface PaymentModification {
  type: PaymentModificationType;
  effectiveDate: Dayjs; // Changed from Date
  endDate?: Dayjs; // Changed from Date
  modifiedPaymentAmount?: Big;
  deferredAmount?: Big;
  description: string;
}