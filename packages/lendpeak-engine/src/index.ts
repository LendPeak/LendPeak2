/**
 * @lendpeak/engine - Stateless loan calculation engine
 * 
 * A comprehensive financial calculation library for loan management systems.
 * Provides precise decimal calculations using Big.js and robust date handling with dayjs.
 * 
 * Features:
 * - Payment calculations (monthly, bi-weekly, etc.)
 * - Amortization schedule generation
 * - Interest calculations (simple, compound, amortized)
 * - Prepayment and modification scenarios
 * - APR/APY calculations
 * - Multi-currency support
 * - Day count conventions (30/360, actual/360, actual/365, actual/actual)
 * - Balloon payment detection and handling strategies
 * - Compliance validation for state-specific balloon payment rules
 * 
 * @packageDocumentation
 */

// Main engine export
export { LoanEngine } from './loan-engine';

// Type exports
export type {
  // Core types
  LoanTerms,
  Payment,
  AmortizationSchedule,
  PaymentCalculationResult,
  InterestCalculationParams,
  InterestCalculationResult,
  PrepaymentParams,
  LoanModification,
  ValidationError,
  CalculationOptions,
  
  // Enums
  PaymentFrequency,
  InterestType,
  LoanStatus,
  DayCountConvention,
} from './types';

// Calculator exports for advanced usage
export {
  // Payment calculations
  calculateAmortizingPayment,
  calculateInterestOnlyPayment,
  calculatePaymentWithBalloon,
  calculateLoanPayment,
  getPaymentPeriodsPerYear,
} from './calculators/payment-calculator';

export {
  // Interest calculations
  calculateSimpleInterest,
  calculateCompoundInterest,
  calculateDailyInterestAccrual,
  calculateAccruedInterest,
  calculateEffectiveInterestRate,
  calculateNominalInterestRate,
} from './calculators/interest-calculator';

export {
  // Amortization calculations
  generateAmortizationSchedule,
  generatePartialAmortizationSchedule,
  recalculateWithPrepayment,
} from './calculators/amortization-calculator';

// Validator exports
export {
  validateLoanTerms,
  validatePrepayment,
  isValidLoanTerms,
  formatValidationErrors,
} from './validators/loan-validator';

// Utility exports
export {
  // Decimal utilities
  toBig,
  round,
  roundUp,
  roundDown,
  percentage,
  formatCurrency,
  formatPercentage,
  safeDivide,
  min,
  max,
  isZero,
  isNegative,
  isPositive,
} from './utils/decimal-utils';

export {
  // Date utilities
  calculateDayCount,
  getDayCountDenominator,
  isLeapYear,
  addMonthsWithEndOfMonth,
  getNextPaymentDate,
  calculateNumberOfPayments,
  parseDate,
  formatDate,
} from './utils/date-utils';

// Balloon payment detection and handling
export {
  detectBalloonPayments,
  isPaymentBalloon,
  findLargestBalloonPayment,
  validateBalloonCompliance,
  calculateBalloonNotificationSchedule,
  DEFAULT_BALLOON_CONFIG
} from './calculators/balloon-detector';

export {
  applySplitPaymentStrategy,
  applyExtendContractStrategy,
  applyHybridStrategy,
  type BalloonStrategyResult
} from './calculators/balloon-strategies';

// Balloon payment types
export type {
  BalloonDetectionConfig,
  BalloonStrategy,
  SplitPaymentConfig,
  ExtendContractConfig,
  HybridStrategyConfig,
  BalloonStrategyConfig,
  LoanBalloonConfig,
  BalloonDetectionResult,
  BalloonNotification,
  SystemBalloonDefaults
} from './types/balloon-payment-types';

// Re-export external types and values for convenience
export { default as Big } from 'big.js';
export type { Big as BigType } from 'big.js';
export type { Dayjs } from 'dayjs';