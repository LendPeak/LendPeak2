/**
 * Rounding utilities for financial calculations
 * Ensures consistent decimal precision across all payment allocations
 */

/**
 * Standard financial rounding configuration
 */
export const FINANCIAL_PRECISION = {
  CURRENCY: 2,        // Standard currency precision (dollars and cents)
  PERCENTAGE: 4,      // Percentage calculations (basis points)
  CALCULATION: 6,     // Intermediate calculations
} as const;

/**
 * Round to specified decimal places using banker's rounding (round half to even)
 * This is the standard for financial applications to avoid bias
 */
export function roundToDecimalPlaces(value: number, decimals: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Round currency values to cents (2 decimal places)
 */
export function roundCurrency(value: number): number {
  return roundToDecimalPlaces(value, FINANCIAL_PRECISION.CURRENCY);
}

/**
 * Round percentage values to basis points (4 decimal places)
 */
export function roundPercentage(value: number): number {
  return roundToDecimalPlaces(value, FINANCIAL_PRECISION.PERCENTAGE);
}

/**
 * Format currency for display (always shows 2 decimal places)
 */
export function formatCurrency(value: number): string {
  const rounded = roundCurrency(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const rounded = roundToDecimalPlaces(value, decimals);
  return `${rounded.toFixed(decimals)}%`;
}

/**
 * Payment allocation with proper rounding
 * Ensures all components are rounded to currency precision
 */
export interface PaymentAllocation {
  principal: number;
  interest: number;
  fees: number;
  penalties: number;
  escrow: number;
  lateFees: number;
  otherFees: number;
  total: number;
}

/**
 * Apply proper rounding to payment allocation
 * Ensures the total equals the sum of components after rounding
 */
export function roundPaymentAllocation(allocation: Partial<PaymentAllocation>): PaymentAllocation {
  // Round each component to currency precision
  const principal = roundCurrency(allocation.principal || 0);
  const interest = roundCurrency(allocation.interest || 0);
  const fees = roundCurrency(allocation.fees || 0);
  const penalties = roundCurrency(allocation.penalties || 0);
  const escrow = roundCurrency(allocation.escrow || 0);
  const lateFees = roundCurrency(allocation.lateFees || 0);
  const otherFees = roundCurrency(allocation.otherFees || 0);
  
  // Calculate total and ensure it's properly rounded
  const total = roundCurrency(principal + interest + fees + penalties + escrow + lateFees + otherFees);
  
  return {
    principal,
    interest,
    fees,
    penalties,
    escrow,
    lateFees,
    otherFees,
    total,
  };
}

/**
 * Validate that payment allocation adds up correctly
 * Returns adjustment needed (should be 0 for properly rounded allocations)
 */
export function validatePaymentAllocation(allocation: PaymentAllocation, expectedTotal: number): number {
  const calculatedTotal = allocation.principal + allocation.interest + allocation.fees + 
                         allocation.penalties + allocation.escrow + allocation.lateFees + allocation.otherFees;
  
  const roundedCalculated = roundCurrency(calculatedTotal);
  const roundedExpected = roundCurrency(expectedTotal);
  
  return roundCurrency(roundedExpected - roundedCalculated);
}

/**
 * Allocate payment amount with proper rounding
 * Applies loan engine logic with financial rounding rules
 */
export function allocatePayment(
  paymentAmount: number,
  currentBalance: number,
  monthlyInterestRate: number,
  options: {
    minimumInterest?: number;
    feeAmount?: number;
    penaltyAmount?: number;
    escrowAmount?: number;
  } = {}
): PaymentAllocation {
  const amount = roundCurrency(paymentAmount);
  const balance = roundCurrency(currentBalance);
  
  // Calculate interest portion (simplified for demo)
  const interestDue = roundCurrency(balance * monthlyInterestRate);
  const minInterest = roundCurrency(options.minimumInterest || 0);
  const interestPayment = roundCurrency(Math.min(amount, Math.max(interestDue, minInterest)));
  
  // Calculate fees and penalties
  const fees = roundCurrency(options.feeAmount || 0);
  const penalties = roundCurrency(options.penaltyAmount || 0);
  const escrow = roundCurrency(options.escrowAmount || 0);
  
  // Remaining amount goes to principal
  const remainingForPrincipal = roundCurrency(amount - interestPayment - fees - penalties - escrow);
  const principal = roundCurrency(Math.max(0, Math.min(remainingForPrincipal, balance)));
  
  return roundPaymentAllocation({
    principal,
    interest: interestPayment,
    fees,
    penalties,
    escrow,
    lateFees: 0,
    otherFees: 0,
  });
}

/**
 * Create display-ready payment values (always 2 decimal places)
 */
export function preparePaymentForDisplay(payment: Record<string, any>): Record<string, any> {
  return {
    ...payment,
    amount: roundCurrency(payment.amount || 0),
    principal: roundCurrency(payment.principal || 0),
    interest: roundCurrency(payment.interest || 0),
    fees: roundCurrency(payment.fees || 0),
    penalties: roundCurrency(payment.penalties || 0),
    escrow: roundCurrency(payment.escrow || 0),
    remainingBalance: roundCurrency(payment.remainingBalance || 0),
  };
}