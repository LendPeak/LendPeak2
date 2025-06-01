/**
 * Payment-related types
 */

export interface PaymentWaterfall {
  categories: PaymentCategory[];
  allowPartialPayments: boolean;
  escrowFirst?: boolean;
}

export type PaymentCategory = 
  | 'FEES'
  | 'PENALTIES' 
  | 'INTEREST'
  | 'PRINCIPAL'
  | 'ESCROW';

export interface PaymentAllocation {
  category: PaymentCategory;
  amount: number;
  description?: string;
}

export interface PaymentResult {
  allocations: PaymentAllocation[];
  totalAllocated: number;
  remainingPayment: number;
  fullyApplied: boolean;
}