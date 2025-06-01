/**
 * Loan-specific types and interfaces
 */

import { 
  InterestType, 
  PaymentFrequency, 
  CalendarType, 
  AccrualTiming, 
  PerDiemMethod,
  RoundingConfig
} from './common';
import { PaymentWaterfall } from './payment';
import { LoanBalloonConfig } from './balloon-payment-types';

export interface LoanParameters {
  principal: number;
  interestRate: number; // Annual percentage rate
  termMonths: number;
  interestType: InterestType;
  paymentFrequency: PaymentFrequency;
  startDate: Date;
  firstPaymentDate?: Date;
  maturityDate?: Date;
  
  // Optional parameters
  compoundingFrequency?: PaymentFrequency;
  calendarType?: CalendarType;
  accrualTiming?: AccrualTiming;
  perDiemMethod?: PerDiemMethod;
  paymentWaterfall?: PaymentWaterfall;
  roundingConfig?: RoundingConfig;
  
  // Fees
  fees?: LoanFees;
  
  // Balloon payment
  balloonPayment?: number;
  balloonPaymentDate?: Date;
  
  // Balloon payment configuration
  balloonConfig?: LoanBalloonConfig;
}

export interface LoanFees {
  originationFee?: number; // Percentage of principal
  processingFee?: number; // Fixed amount
  lateFee?: number; // Fixed amount or percentage
  prepaymentPenalty?: number; // Percentage
  nsffee?: number; // NSF fee amount
}

export interface LoanCalculationResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  effectiveInterestRate: number;
  apr: number;
  paymentSchedule: PaymentScheduleItem[];
  fees: CalculatedFees;
  balloonPayment?: BalloonPaymentInfo;
}

export interface PaymentScheduleItem {
  paymentNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  fees: number;
  escrow: number;
  totalPayment: number;
  remainingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
  
  // Additional details
  daysInPeriod?: number;
  dailyInterestRate?: number;
  perDiemAmount?: number;
}

export interface CalculatedFees {
  origination: number;
  processing: number;
  total: number;
}

export interface BalloonPaymentInfo {
  amount: number;
  dueDate: Date;
  includesInterest: boolean;
  finalPaymentAmount: number;
}

// Parameters for different calculation methods
export interface AmortizationParams {
  principal: number;
  rate: number;
  termMonths: number;
  startDate: Date;
  roundingConfig?: RoundingConfig;
}

export interface SimpleInterestParams {
  principal: number;
  rate: number;
  termMonths: number;
  startDate: Date;
  calendarType: CalendarType;
  perDiemMethod: PerDiemMethod;
  roundingConfig?: RoundingConfig;
}

export interface CompoundInterestParams {
  principal: number;
  rate: number;
  termMonths: number;
  compoundingFrequency: PaymentFrequency;
  startDate: Date;
  roundingConfig?: RoundingConfig;
}

// APR calculation parameters
export interface APRParams {
  principal: number;
  monthlyPayment: number;
  termMonths: number;
  totalFees: number;
  tolerance?: number; // Default 0.00125 (0.125%)
  maxIterations?: number; // Default 100
}