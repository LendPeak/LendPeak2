import Big from 'big.js';
import { CalendarType, PaymentFrequency } from './payment-types';
import { RoundingConfig } from './common';
import { LoanBalloonConfig } from './balloon-payment-types';

/**
 * Core loan terms
 */
export interface LoanTerms {
  principal: Big;
  annualRate: Big;
  termMonths: number;
  startDate: Date;
  firstPaymentDate: Date;
  maturityDate: Date;
  paymentFrequency: PaymentFrequency;
  calendarType: CalendarType;
  roundingConfig?: RoundingConfig;
  balloonConfig?: LoanBalloonConfig;
}

/**
 * Loan modification record
 */
export interface LoanModification {
  id: string;
  type: string;
  effectiveDate: Date;
  changes: Record<string, any>;
  reason: string;
  performedBy: string;
  performedAt: Date;
  audit: {
    previousState: any;
    newState: any;
    approvalRequired: boolean;
    approvedBy?: string;
    approvedAt?: Date;
  };
}