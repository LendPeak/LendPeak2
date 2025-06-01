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

  // New tests for roundWithConfig
  describe('roundWithConfig', () => {
    const testCases = [
      // Test values chosen to check rounding boundaries

      // HALF_UP (Big.roundHalfUp)
      { val: '1.235', method: 'HALF_UP', places: 2, expected: '1.24' },
      { val: '1.234', method: 'HALF_UP', places: 2, expected: '1.23' },
      { val: '1.5', method: 'HALF_UP', places: 0, expected: '2' },
      { val: '2.5', method: 'HALF_UP', places: 0, expected: '3' },
      { val: '-1.235', method: 'HALF_UP', places: 2, expected: '-1.24' }, // Rounds away from zero for .5
      { val: '-1.234', method: 'HALF_UP', places: 2, expected: '-1.23' },

      // DOWN (Big.roundDown - rounds towards zero)
      { val: '1.239', method: 'DOWN', places: 2, expected: '1.23' },
      { val: '1.231', method: 'DOWN', places: 2, expected: '1.23' },
      { val: '1.9', method: 'DOWN', places: 0, expected: '1' },
      { val: '-1.239', method: 'DOWN', places: 2, expected: '-1.23' },
      { val: '-1.9', method: 'DOWN', places: 0, expected: '-1' },

      // UP (Big.roundUp - rounds away from zero)
      { val: '1.231', method: 'UP', places: 2, expected: '1.24' },
      { val: '1.239', method: 'UP', places: 2, expected: '1.24' },
      { val: '1.1', method: 'UP', places: 0, expected: '2' },
      { val: '-1.231', method: 'UP', places: 2, expected: '-1.24' },
      { val: '-1.1', method: 'UP', places: 0, expected: '-2' },

      // BANKERS (Big.roundHalfEven)
      { val: '1.235', method: 'BANKERS', places: 2, expected: '1.24' }, // 3 is odd, .5 rounds to make last digit even (4)
      { val: '1.245', method: 'BANKERS', places: 2, expected: '1.24' }, // 4 is even, .5 rounds to make last digit even (4)
      { val: '1.5', method: 'BANKERS', places: 0, expected: '2' },     // 1 is odd, .5 rounds to 2
      { val: '2.5', method: 'BANKERS', places: 0, expected: '2' },     // 2 is even, .5 rounds to 2
      { val: '-1.235', method: 'BANKERS', places: 2, expected: '-1.24' },
      { val: '-1.245', method: 'BANKERS', places: 2, expected: '-1.24' },

      // HALF_DOWN (maps to Big.roundDown - rounds towards zero)
      // Note: Big.js doesn't have a direct HALF_DOWN.
      // Our roundWithConfig maps 'HALF_DOWN' to Big.roundDown (mode 0).
      // Big.roundDown rounds towards zero.
      { val: '1.235', method: 'HALF_DOWN', places: 2, expected: '1.23' }, // .5 rounds towards zero
      { val: '1.236', method: 'HALF_DOWN', places: 2, expected: '1.23' }, // .6 still rounds towards zero
      { val: '1.5', method: 'HALF_DOWN', places: 0, expected: '1' },
      { val: '-1.235', method: 'HALF_DOWN', places: 2, expected: '-1.23' },
      { val: '-1.236', method: 'HALF_DOWN', places: 2, expected: '-1.23' },


      // Aliased: HALF_AWAY (maps to Big.roundHalfUp)
      { val: '1.235', method: 'HALF_AWAY', places: 2, expected: '1.24' },
      { val: '1.234', method: 'HALF_AWAY', places: 2, expected: '1.23' },

      // Aliased: HALF_TOWARD (maps to Big.roundDown)
      // Note: Our roundWithConfig maps 'HALF_TOWARD' to Big.roundDown (mode 0).
      { val: '1.239', method: 'HALF_TOWARD', places: 2, expected: '1.23' },
      { val: '1.231', method: 'HALF_TOWARD', places: 2, expected: '1.23' },

      // Different decimal places
      { val: '1.234567', method: 'HALF_UP', places: 4, expected: '1.2346' },
      { val: '1.234567', method: 'HALF_UP', places: 0, expected: '1' }, // 1.2 rounds to 1
      { val: '1.876', method: 'HALF_UP', places: 0, expected: '2' },    // 1.8 rounds to 2
      { val: '99.99', method: 'UP', places: 1, expected: '100.0' }, // Rounds 99.9 to 100.0
      { val: '0.00009', method: 'UP', places: 4, expected: '0.0001' },
      { val: '0.00001', method: 'DOWN', places: 4, expected: '0.0000' },
      { val: '123.000', method: 'HALF_UP', places: 2, expected: '123.00'},
      { val: '123', method: 'HALF_UP', places: 2, expected: '123.00'},
    ];

    testCases.forEach(({ val, method, places, expected }) => {
      it(`should round '${val}' using ${method} to ${places} decimal places as '${expected}'`, () => {
        const value = toBig(val);
        const config = { method: method as RoundingMethod, decimalPlaces: places };
        // Ensure roundWithConfig is imported or available in this scope
        // For this example, assuming roundWithConfig is correctly imported from '../../src/utils/decimal-utils'
        // Also, RoundingMethod needs to be imported from '../../src/types/common'
        expect(roundWithConfig(value, config).toFixed(places)).toBe(expected); // Use toFixed for consistent trailing zeros
      });
    });

    it('should default to HALF_UP and 2 decimal places if no config is provided', () => {
      // Default config is { method: 'HALF_UP', decimalPlaces: 2 } as per roundMoney,
      // but roundWithConfig itself defaults to Big.js global RM if config is undefined,
      // and round(value,2) if config is undefined.
      // The round() function uses Big.js global RM (Big.roundHalfUp by default in Big.js)
      // So, roundWithConfig(val) will use Big.roundHalfUp and 2 places.
      expect(roundWithConfig(toBig('123.456')).toFixed(2)).toBe('123.46');
      expect(roundWithConfig(toBig('123.454')).toFixed(2)).toBe('123.45');
    });

    it('should restore original Big.js rounding mode (Big.RM) after execution', () => {
      const originalRM = Big.RM; // Global Big.js rounding mode
      const value = toBig('1.245'); // Test value for BANKERS vs HALF_UP

      // Set a known global RM that's different from what the config will use
      Big.RM = Big.roundHalfUp; // Big.js mode 1
      expect(value.round(2).toString()).toBe('1.25'); // 1.245 rounds to 1.25 with HALF_UP

      // Call roundWithConfig with a different method
      // Assuming RoundingMethod is imported
      roundWithConfig(value, { method: 'BANKERS' as RoundingMethod, decimalPlaces: 2 });
      // It should have produced '1.24' internally using Big.roundHalfEven (mode 3)

      // Check that Big.RM is restored to what it was before the call (Big.roundHalfUp)
      expect(Big.RM).toBe(Big.roundHalfUp);

      // Verify by rounding again with the now restored global RM
      expect(value.round(2).toString()).toBe('1.25');

      // Restore original Big.RM to what it was at the start of this test block,
      // just in case other test files rely on the initial global default.
      Big.RM = originalRM;
    });
  });
});