import { Document, Types } from 'mongoose';
import Big from 'big.js';
// Calendar types from @lendpeak/engine
export const LoanCalendar = {
  ACTUAL_365: 'ACTUAL/365',
  ACTUAL_360: 'ACTUAL/360',
  THIRTY_360: '30/360',
} as const;

export enum LoanStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DELINQUENT = 'DELINQUENT',
  DEFAULT = 'DEFAULT',
  FORBEARANCE = 'FORBEARANCE',
  CLOSED = 'CLOSED',
  CHARGED_OFF = 'CHARGED_OFF',
}

export enum LoanType {
  AMORTIZED = 'AMORTIZED',
  SIMPLE_INTEREST = 'SIMPLE_INTEREST',
  BLENDED = 'BLENDED',
}

export interface IStatusHistory {
  status: LoanStatus;
  changedAt: Date;
  reason?: string;
  changedBy?: string;
}

export interface IModification {
  id: string;
  type: string;
  previousRate?: Big;
  newRate?: Big;
  previousTerm?: number;
  newTerm?: number;
  previousPayment?: Big;
  newPayment?: Big;
  effectiveDate: Date;
  reason: string;
  approvedBy?: string;
  createdAt: Date;
}

export interface IPaymentHistory {
  paymentDate: Date;
  scheduledAmount: Big;
  actualAmount: Big;
  principalPaid: Big;
  interestPaid: Big;
  feesPaid: Big;
  escrowPaid: Big;
  remainingBalance: Big;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  transactionId?: string;
}

export interface ILoan extends Document {
  // Identification
  loanNumber: string;
  borrowerId: string;
  coborrowerIds?: string[];
  
  // Loan terms
  principal: Big;
  currentBalance: Big;
  interestRate: Big;
  termMonths: number;
  remainingTermMonths: number;
  
  // Dates
  originationDate: Date;
  firstPaymentDate: Date;
  maturityDate: Date;
  lastPaymentDate?: Date;
  nextPaymentDate: Date;
  
  // Payment information
  monthlyPayment: Big;
  lastPaymentAmount?: Big;
  totalInterestPaid: Big;
  totalPrincipalPaid: Big;
  totalFeesPaid: Big;
  
  // Configuration
  loanType: LoanType;
  calendar: keyof typeof LoanCalendar;
  paymentDay: number; // Day of month for payments
  gracePeriodDays: number;
  lateFeAmount?: Big;
  
  // Status
  status: LoanStatus;
  statusHistory: IStatusHistory[];
  isDelinquent: boolean;
  daysPastDue: number;
  delinquentAmount?: Big;
  
  // Modifications
  modifications: IModification[];
  hasModifications: boolean;
  
  // Payment history
  paymentHistory: IPaymentHistory[];
  missedPayments: number;
  
  // Escrow
  hasEscrow: boolean;
  escrowBalance?: Big;
  escrowPayment?: Big;
  propertyTaxAmount?: Big;
  insuranceAmount?: Big;
  
  // Metadata
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

export interface ILoanAudit extends Document {
  loanId: Types.ObjectId;
  action: string;
  changes: Record<string, any>;
  performedBy: string;
  performedAt: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface IPaymentUpdateInfo {
  paymentAmount: Big;
  principalPaid: Big;
  interestPaid: Big;
  feesPaid?: Big;
  escrowPaid?: Big;
  paymentDate: Date;
  transactionId?: string;
}

export interface ILoanSearchCriteria {
  borrowerId?: string;
  status?: LoanStatus | LoanStatus[];
  loanType?: LoanType;
  minBalance?: Big;
  maxBalance?: Big;
  isDelinquent?: boolean;
  minDaysPastDue?: number;
  originatedAfter?: Date;
  originatedBefore?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
  asOfDate?: Date;
}

export interface ILoanStatistics {
  totalLoans: number;
  activeLoans: number;
  delinquentLoans: number;
  totalOutstandingBalance: Big;
  totalOriginalPrincipal: Big;
  averageInterestRate: Big;
  averageLoanAmount: Big;
  delinquencyRate: number;
  defaultRate: number;
}