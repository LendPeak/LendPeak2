import Big from 'big.js';
import { RoundingConfig, RoundingMethod } from '../types/common';

// Configure Big.js for financial calculations
// Set decimal places to 10 for internal calculations
Big.DP = 10;
// Use ROUND_HALF_UP (banker's rounding) as default
Big.RM = Big.roundHalfUp;

/**
 * Create a Big number from various input types
 */
export function toBig(value: string | number | Big): Big {
  if (value instanceof Big) {
    return value;
  }
  return new Big(value);
}

/**
 * Get Big.js rounding mode from RoundingMethod
 */
function getRoundingMode(method: RoundingMethod): number {
  switch (method) {
    case 'BANKERS':
      return Big.roundHalfEven;
    case 'HALF_UP':
      return Big.roundHalfUp;
    case 'HALF_DOWN':
      return Big.roundDown;
    case 'UP':
      return Big.roundUp;
    case 'DOWN':
      return Big.roundDown;
    case 'HALF_AWAY':
      return Big.roundHalfUp; // Big.js doesn't have HALF_AWAY, use HALF_UP
    case 'HALF_TOWARD':
      return Big.roundDown; // Big.js doesn't have HALF_TOWARD, use DOWN
    default:
      return Big.roundHalfUp;
  }
}

/**
 * Round a Big number to specified decimal places
 */
export function round(value: Big, decimalPlaces: number = 2): Big {
  return value.round(decimalPlaces);
}

/**
 * Round a Big number using RoundingConfig
 */
export function roundWithConfig(value: Big, config?: RoundingConfig): Big {
  if (!config) {
    return round(value, 2);
  }
  
  const originalRM = Big.RM;
  try {
    Big.RM = getRoundingMode(config.method);
    return value.round(config.decimalPlaces);
  } finally {
    Big.RM = originalRM;
  }
}

/**
 * Round monetary value immediately after calculation
 * This is the primary function to use for all monetary calculations
 */
export function roundMoney(value: Big, config?: RoundingConfig): Big {
  const defaultConfig: RoundingConfig = {
    method: 'HALF_UP',
    decimalPlaces: 2
  };
  return roundWithConfig(value, config || defaultConfig);
}

/**
 * Round up to specified decimal places
 */
export function roundUp(value: Big, decimalPlaces: number = 2): Big {
  const factor = new Big(10).pow(decimalPlaces);
  return value.times(factor).round(0, Big.roundUp).div(factor);
}

/**
 * Round down to specified decimal places
 */
export function roundDown(value: Big, decimalPlaces: number = 2): Big {
  const factor = new Big(10).pow(decimalPlaces);
  return value.times(factor).round(0, Big.roundDown).div(factor);
}

/**
 * Calculate percentage of a value with immediate rounding
 */
export function percentage(value: Big, percent: Big, roundingConfig?: RoundingConfig): Big {
  const result = value.times(percent).div(100);
  return roundingConfig ? roundMoney(result, roundingConfig) : result;
}

/**
 * Calculate percentage and round immediately for monetary values
 * This ensures no penny discrepancies in calculations
 */
export function percentageMoney(value: Big, percent: Big, config?: RoundingConfig): Big {
  const result = value.times(percent).div(100);
  return roundMoney(result, config);
}

/**
 * Convert annual rate to period rate
 */
export function annualRateToPeriodRate(
  annualRate: Big,
  periodsPerYear: number
): Big {
  return annualRate.div(periodsPerYear);
}

/**
 * Convert period rate to annual rate
 */
export function periodRateToAnnualRate(
  periodRate: Big,
  periodsPerYear: number
): Big {
  return periodRate.times(periodsPerYear);
}

/**
 * Calculate compound interest factor
 */
export function compoundInterestFactor(
  rate: Big,
  periods: number
): Big {
  return new Big(1).plus(rate).pow(periods);
}

/**
 * Format a Big number as currency
 */
export function formatCurrency(
  value: Big,
  currencySymbol: string = '$',
  decimalPlaces: number = 2
): string {
  const rounded = round(value, decimalPlaces);
  const formatted = rounded.toFixed(decimalPlaces);
  const parts = formatted.split('.');
  const integerPart = parts[0]?.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
  
  if (decimalPlaces === 0) {
    return `${currencySymbol}${integerPart}`;
  }
  
  const decimalPart = parts[1] || '0'.repeat(decimalPlaces);
  return `${currencySymbol}${integerPart}.${decimalPart}`;
}

/**
 * Format a Big number as percentage
 */
export function formatPercentage(
  value: Big,
  decimalPlaces: number = 2
): string {
  const rounded = round(value, decimalPlaces);
  return `${rounded.toFixed(decimalPlaces)}%`;
}

/**
 * Safe division with zero check
 */
export function safeDivide(
  numerator: Big,
  denominator: Big,
  defaultValue: Big = new Big(0)
): Big {
  if (denominator.eq(0)) {
    return defaultValue;
  }
  return numerator.div(denominator);
}

/**
 * Calculate the minimum of Big numbers
 */
export function min(...values: Big[]): Big {
  if (values.length === 0) {
    throw new Error('At least one value is required');
  }
  
  return values.reduce((minVal, current) => 
    current.lt(minVal) ? current : minVal
  );
}

/**
 * Calculate the maximum of Big numbers
 */
export function max(...values: Big[]): Big {
  if (values.length === 0) {
    throw new Error('At least one value is required');
  }
  
  return values.reduce((maxVal, current) => 
    current.gt(maxVal) ? current : maxVal
  );
}

/**
 * Check if a value is zero (within a small epsilon for floating point comparison)
 */
export function isZero(value: Big, epsilon: Big = new Big('0.000001')): boolean {
  return value.abs().lt(epsilon);
}

/**
 * Check if a value is negative
 */
export function isNegative(value: Big): boolean {
  return value.lt(0);
}

/**
 * Check if a value is positive
 */
export function isPositive(value: Big): boolean {
  return value.gt(0);
}