import Big from 'big.js';

/**
 * Categories for payment allocation in waterfall
 */
export type PaymentCategory = 'fees' | 'penalties' | 'interest' | 'principal' | 'escrow';

/**
 * Outstanding amounts for each payment category
 */
export interface OutstandingAmounts {
  fees: Big;
  penalties: Big;
  interest: Big;
  principal: Big;
  escrow: Big;
}

/**
 * Payment allocation parameters
 */
export interface PaymentAllocation {
  payment: Big;
  outstandingAmounts: OutstandingAmounts;
  waterfallConfig: string | WaterfallStep[];
  isPrepayment?: boolean;
  isCurtailment?: boolean;
}

/**
 * Waterfall step configuration
 */
export interface WaterfallStep {
  category: PaymentCategory;
  percentage: number; // 0-100, percentage of payment to allocate
}

/**
 * Result of waterfall payment application
 */
export interface WaterfallResult {
  feesAndPenaltiesPaid: Big;
  interestPaid: Big;
  principalPaid: Big;
  escrowPaid: Big;
  remainingPayment: Big;
  unpaidAmounts: OutstandingAmounts;
  isPrepayment?: boolean;
  isCurtailment?: boolean;
  reducesTermNotPayment?: boolean;
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  transactionId: string;
  loanId: string;
  paymentDate: Date;
  effectiveDate: Date;
  amount: Big;
  allocation: WaterfallResult;
  source: 'manual' | 'autopay' | 'ach' | 'card' | 'wire';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  reversalReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payment method configuration
 */
export interface PaymentMethod {
  methodId: string;
  type: 'bank_account' | 'card' | 'digital_wallet';
  isDefault: boolean;
  isAutoPayEnabled: boolean;
  lastFourDigits: string;
  bankName?: string;
  cardBrand?: string;
  expirationDate?: Date;
}

/**
 * AutoPay configuration
 */
export interface AutoPayConfig {
  enabled: boolean;
  paymentMethodId: string;
  amount: 'minimum' | 'full' | 'fixed';
  fixedAmount?: Big;
  dayOfMonth: number;
  retryAttempts: number;
  notifyBeforeCharge: boolean;
  notifyDaysBefore: number;
}

/**
 * NSF (Non-Sufficient Funds) handling
 */
export interface NSFEvent {
  eventId: string;
  loanId: string;
  paymentDate: Date;
  amount: Big;
  nsfFee: Big;
  retryScheduled: boolean;
  retryDate?: Date;
  retryAttempt: number;
  maxRetries: number;
}