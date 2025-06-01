/**
 * Common types used throughout the loan engine
 */

export type InterestType = 'FIXED' | 'VARIABLE' | 'COMPOUND' | 'SIMPLE';
export type PaymentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY';
export type LoanStatus = 'PENDING' | 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED' | 'REFINANCED';
export type CalendarType = '30/360' | 'ACTUAL/365' | 'ACTUAL/360';
export type AccrualTiming = 'DAY_0' | 'DAY_1';
export type PerDiemMethod = 'STABLE' | 'VARIABLE';

// Rounding methods for financial calculations
export type RoundingMethod = 
  | 'BANKERS'      // Round half to even (default)
  | 'HALF_UP'      // Traditional rounding (0.5 rounds up)
  | 'HALF_DOWN'    // 0.5 rounds down
  | 'UP'           // Always round up (ceiling)
  | 'DOWN'         // Always round down (floor)
  | 'HALF_AWAY'    // Round half away from zero
  | 'HALF_TOWARD'; // Round half toward zero

export interface RoundingConfig {
  method: RoundingMethod;
  decimalPlaces: number; // Number of decimal places to preserve (default 2)
}

// Payment categories for waterfall allocation
export type PaymentCategory = 
  | 'FEES'
  | 'PENALTIES' 
  | 'INTEREST'
  | 'PRINCIPAL'
  | 'ESCROW';

// Result type for functional error handling
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Date range for calculations
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Money type wrapper for type safety
export interface Money {
  amount: string; // String representation for Big.js
  currency?: string; // Default USD
}