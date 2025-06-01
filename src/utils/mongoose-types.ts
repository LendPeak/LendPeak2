import { SchemaType } from 'mongoose';
import Big from 'big.js';

/**
 * Custom Mongoose type for Big.js decimal numbers
 * Stores as string in MongoDB to maintain precision
 */
export const bigDecimalType = {
  type: String,
  get: (value: string | null | undefined): Big | undefined => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    try {
      return new Big(value);
    } catch (error) {
      console.error(`Invalid Big decimal value: ${value}`);
      return undefined;
    }
  },
  set: (value: Big | string | number | null | undefined): string | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (value instanceof Big) {
      return value.toString();
    }
    try {
      // Convert to Big first to validate, then to string
      return new Big(value).toString();
    } catch (error) {
      console.error(`Invalid value for Big decimal: ${value}`);
      return undefined;
    }
  },
};

/**
 * Validator for positive Big decimal values
 */
export const positiveBigDecimal = {
  validator: (value: string): boolean => {
    try {
      const bigValue = new Big(value);
      return bigValue.gt(0);
    } catch {
      return false;
    }
  },
  message: 'Value must be a positive number',
};

/**
 * Validator for non-negative Big decimal values
 */
export const nonNegativeBigDecimal = {
  validator: (value: string): boolean => {
    try {
      const bigValue = new Big(value);
      return bigValue.gte(0);
    } catch {
      return false;
    }
  },
  message: 'Value must be non-negative',
};

/**
 * Validator for percentage values (0-1)
 */
export const percentageBigDecimal = {
  validator: (value: string): boolean => {
    try {
      const bigValue = new Big(value);
      return bigValue.gte(0) && bigValue.lte(1);
    } catch {
      return false;
    }
  },
  message: 'Value must be between 0 and 1',
};

/**
 * Validator for APR values (0-99.999%)
 */
export const aprBigDecimal = {
  validator: (value: string): boolean => {
    try {
      const bigValue = new Big(value);
      return bigValue.gte(0) && bigValue.lt(1); // 0% to 99.999%
    } catch {
      return false;
    }
  },
  message: 'APR must be between 0 and 0.99999 (0% to 99.999%)',
};

/**
 * Create a Big decimal type with default value
 */
export const bigDecimalWithDefault = (defaultValue = '0') => ({
  type: String,
  default: defaultValue,
  get: bigDecimalType.get,
  set: bigDecimalType.set,
});