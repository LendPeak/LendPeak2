import {
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
} from '../../src/utils/decimal-utils';
import Big from 'big.js';

describe('Decimal Utils', () => {
  describe('toBig', () => {
    it('should convert various types to Big', () => {
      expect(toBig('123.45').toString()).toBe('123.45');
      expect(toBig(123.45).toString()).toBe('123.45');
      expect(toBig(new Big('123.45')).toString()).toBe('123.45');
    });

    it('should handle very large numbers', () => {
      const large = '999999999999999999999999999.99';
      // Big.js converts very large numbers to exponential notation
      expect(toBig(large).toFixed()).toBe(large);
    });

    it('should handle very small numbers', () => {
      const small = '0.00000000000000000001';
      expect(toBig(small).toString()).toBe('1e-20');
    });
  });

  describe('rounding functions', () => {
    it('should round to specified decimal places', () => {
      const value = toBig('123.456789');
      
      expect(round(value, 2).toString()).toBe('123.46');
      expect(round(value, 4).toString()).toBe('123.4568');
      expect(round(value, 0).toString()).toBe('123');
    });

    it('should round up correctly', () => {
      const value = toBig('123.451');
      
      expect(roundUp(value, 2).toString()).toBe('123.46');
      expect(roundUp(value, 1).toString()).toBe('123.5');
      expect(roundUp(value, 0).toString()).toBe('124');
    });

    it('should round down correctly', () => {
      const value = toBig('123.459');
      
      expect(roundDown(value, 2).toString()).toBe('123.45');
      expect(roundDown(value, 1).toString()).toBe('123.4');
      expect(roundDown(value, 0).toString()).toBe('123');
    });
  });

  describe('percentage', () => {
    it('should calculate percentage correctly', () => {
      expect(percentage(toBig(100), toBig(10)).toString()).toBe('10');
      expect(percentage(toBig(250), toBig(20)).toString()).toBe('50');
      expect(percentage(toBig(75), toBig(33.33)).toString()).toBe('24.9975');
    });
  });

  describe('formatCurrency', () => {
    it('should format positive amounts', () => {
      expect(formatCurrency(toBig('1234.56'))).toBe('$1,234.56');
      expect(formatCurrency(toBig('1234567.89'))).toBe('$1,234,567.89');
      expect(formatCurrency(toBig('0.50'))).toBe('$0.50');
      expect(formatCurrency(toBig('1000000'))).toBe('$1,000,000.00');
    });

    it('should handle different currency symbols', () => {
      expect(formatCurrency(toBig('1234.56'), '€')).toBe('€1,234.56');
      expect(formatCurrency(toBig('1234.56'), '£')).toBe('£1,234.56');
      expect(formatCurrency(toBig('1234.56'), '¥')).toBe('¥1,234.56');
    });

    it('should handle different decimal places', () => {
      expect(formatCurrency(toBig('1234.567'), '$', 3)).toBe('$1,234.567');
      expect(formatCurrency(toBig('1234.5'), '$', 0)).toBe('$1,235');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(toBig('-1234.56'))).toBe('$-1,234.56');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(toBig('5.5'))).toBe('5.50%');
      expect(formatPercentage(toBig('0.125'), 3)).toBe('0.125%');
      expect(formatPercentage(toBig('100'))).toBe('100.00%');
      expect(formatPercentage(toBig('0.1'), 1)).toBe('0.1%');
    });
  });

  describe('safeDivide', () => {
    it('should divide normally when denominator is not zero', () => {
      expect(safeDivide(toBig(10), toBig(2)).toString()).toBe('5');
      expect(safeDivide(toBig(100), toBig(3)).toFixed(2)).toBe('33.33');
    });

    it('should return default value when dividing by zero', () => {
      expect(safeDivide(toBig(10), toBig(0)).toString()).toBe('0');
      expect(safeDivide(toBig(10), toBig(0), toBig(99)).toString()).toBe('99');
    });
  });

  describe('min and max', () => {
    it('should find minimum value', () => {
      expect(min(toBig(5), toBig(3), toBig(8)).toString()).toBe('3');
      expect(min(toBig(-5), toBig(0), toBig(5)).toString()).toBe('-5');
      expect(min(toBig(1.1), toBig(1.01), toBig(1.001)).toString()).toBe('1.001');
    });

    it('should find maximum value', () => {
      expect(max(toBig(5), toBig(3), toBig(8)).toString()).toBe('8');
      expect(max(toBig(-5), toBig(0), toBig(5)).toString()).toBe('5');
      expect(max(toBig(1.1), toBig(1.01), toBig(1.001)).toString()).toBe('1.1');
    });

    it('should throw error for empty arrays', () => {
      expect(() => min()).toThrow('At least one value is required');
      expect(() => max()).toThrow('At least one value is required');
    });
  });

  describe('value checks', () => {
    it('should check if zero', () => {
      expect(isZero(toBig(0))).toBe(true);
      expect(isZero(toBig('0.0000001'))).toBe(true); // Within epsilon
      expect(isZero(toBig('0.000001'))).toBe(false);
      expect(isZero(toBig(1))).toBe(false);
      expect(isZero(toBig(-1))).toBe(false);
    });

    it('should check if negative', () => {
      expect(isNegative(toBig(-1))).toBe(true);
      expect(isNegative(toBig(-0.001))).toBe(true);
      expect(isNegative(toBig(0))).toBe(false);
      expect(isNegative(toBig(1))).toBe(false);
    });

    it('should check if positive', () => {
      expect(isPositive(toBig(1))).toBe(true);
      expect(isPositive(toBig(0.001))).toBe(true);
      expect(isPositive(toBig(0))).toBe(false);
      expect(isPositive(toBig(-1))).toBe(false);
    });
  });
});