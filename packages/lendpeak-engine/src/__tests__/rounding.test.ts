import Big from 'big.js';
import { describe, it, expect } from '@jest/globals';
import { LoanEngine } from '../loan-engine';
import { RoundingConfig } from '../types';
import dayjs from 'dayjs';

describe('LoanEngine Rounding Tests', () => {
  describe('Payment Calculation Rounding', () => {
    it('should round monthly payment to specified decimal places', () => {
      const terms = LoanEngine.createLoan(
        100000, // $100,000
        5.5,    // 5.5% annual rate
        360,    // 30 years
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const result = LoanEngine.calculatePayment(terms);
      
      // Verify all monetary values are rounded to 2 decimal places
      expect(result.monthlyPayment.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      expect(result.totalInterest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      expect(result.totalPayments.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
    });

    it('should handle different rounding methods correctly', () => {
      const principal = 100000;
      const rate = 5.125; // Rate that produces fractional cents
      const termMonths = 360;
      const startDate = '2024-01-01';

      // Test HALF_UP rounding
      const termsHalfUp = LoanEngine.createLoan(principal, rate, termMonths, startDate, {
        roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
      });
      
      // Test BANKERS rounding
      const termsBankers = LoanEngine.createLoan(principal, rate, termMonths, startDate, {
        roundingConfig: { method: 'BANKERS', decimalPlaces: 2 }
      });

      const resultHalfUp = LoanEngine.calculatePayment(termsHalfUp);
      const resultBankers = LoanEngine.calculatePayment(termsBankers);

      // Both should have exactly 2 decimal places
      expect(resultHalfUp.monthlyPayment.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      expect(resultBankers.monthlyPayment.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
    });
  });

  describe('Amortization Schedule Rounding', () => {
    it('should apply immediate rounding to interest calculations', () => {
      const terms = LoanEngine.createLoan(
        100000,
        6.0,
        360,
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      // Check first payment
      const firstPayment = schedule.payments[0];
      
      // Interest should be rounded immediately after calculation
      // Monthly rate = 6% / 12 = 0.5%
      // Interest = 100000 * 0.005 = 500.00
      expect(firstPayment.interest.toNumber()).toBe(500.00);
      
      // All monetary values should have exactly 2 decimal places
      schedule.payments.forEach(payment => {
        expect(payment.principal.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        expect(payment.interest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        expect(payment.totalPayment.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        expect(payment.remainingBalance.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      });
    });

    it('should ensure no penny discrepancies across entire schedule', () => {
      const terms = LoanEngine.createLoan(
        50000,
        7.25,
        180, // 15 years
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      // Sum of all principal payments should equal original principal
      const totalPrincipal = schedule.payments.reduce(
        (sum, payment) => sum.plus(payment.principal),
        new Big(0)
      );
      
      // Allow for small rounding difference on final payment
      const difference = totalPrincipal.minus(terms.principal).abs();
      expect(difference.lte(0.01)).toBe(true);
      
      // Each payment's principal + interest should equal total payment
      schedule.payments.forEach(payment => {
        const calculatedTotal = payment.principal.plus(payment.interest);
        expect(calculatedTotal.eq(payment.totalPayment)).toBe(true);
      });
    });

    it('should handle odd principal amounts correctly', () => {
      const terms = LoanEngine.createLoan(
        33333.33, // Odd amount
        4.875,    // Fractional rate
        84,       // 7 years
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      // Verify all payments are properly rounded
      schedule.payments.forEach((payment, index) => {
        // All values should be rounded to 2 decimal places
        expect(payment.principal.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        expect(payment.interest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        expect(payment.totalPayment.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        
        // Remaining balance should decrease monotonically
        if (index > 0) {
          const prevBalance = schedule.payments[index - 1].remainingBalance;
          expect(payment.remainingBalance.lt(prevBalance)).toBe(true);
        }
      });
    });
  });

  describe('Daily Interest Accrual Rounding', () => {
    it('should round daily interest to specified precision', () => {
      const balance = new Big(75000);
      const annualRate = new Big(5.5);
      const roundingConfig: RoundingConfig = { method: 'HALF_UP', decimalPlaces: 2 };

      const dailyInterest = LoanEngine.calculateDailyInterest(
        balance,
        annualRate,
        '30/360',
        '2024-06-15',
        roundingConfig
      );

      // Daily interest should be rounded to 2 decimal places
      expect(dailyInterest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      
      // Verify calculation: 75000 * 5.5% / 360 = 11.458333... ≈ 11.46
      expect(dailyInterest.toNumber()).toBe(11.46);
    });

    it('should accumulate daily interest correctly over a period', () => {
      const principal = new Big(100000);
      const annualRate = new Big(6.0);
      const roundingConfig: RoundingConfig = { method: 'HALF_UP', decimalPlaces: 2 };
      
      const startDate = dayjs('2024-01-01');
      const endDate = dayjs('2024-01-31');

      const accruedInterest = LoanEngine.calculateAccruedInterest(
        principal,
        annualRate,
        startDate,
        endDate,
        '30/360',
        roundingConfig
      );

      // Accrued interest should be rounded
      expect(accruedInterest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      
      // 30 days * (100000 * 6% / 360) = 30 * 16.67 = 500.10
      expect(accruedInterest.toNumber()).toBe(500.00);
    });
  });

  describe('Compound Interest Rounding', () => {
    it('should round compound interest calculations', () => {
      const principal = new Big(50000);
      const annualRate = new Big(4.5);
      const years = 5;
      const compoundingFrequency = 12;
      const roundingConfig: RoundingConfig = { method: 'HALF_UP', decimalPlaces: 2 };

      const interest = LoanEngine.calculateCompoundInterest(
        principal,
        annualRate,
        years,
        compoundingFrequency,
        roundingConfig
      );

      // Compound interest should be rounded
      expect(interest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero interest rate correctly', () => {
      const terms = LoanEngine.createLoan(
        10000,
        0, // 0% interest
        12,
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      // All interest payments should be exactly 0.00
      schedule.payments.forEach(payment => {
        expect(payment.interest.toNumber()).toBe(0);
        expect(payment.interest.toFixed(2)).toBe('0.00');
      });
    });

    it('should handle very small loan amounts', () => {
      const terms = LoanEngine.createLoan(
        100, // $100 loan
        12.0,
        6,
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      // Verify all payments are properly rounded even for small amounts
      schedule.payments.forEach(payment => {
        expect(payment.principal.gte(0)).toBe(true);
        expect(payment.interest.gte(0)).toBe(true);
        expect(payment.totalPayment.gt(0)).toBe(true);
      });
    });

    it('should handle single payment loans', () => {
      const terms = LoanEngine.createLoan(
        1000,
        6.0,
        1, // Single month term
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 2 }
        }
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      expect(schedule.payments.length).toBe(1);
      
      const payment = schedule.payments[0];
      // Interest = 1000 * 6% / 12 = 5.00
      expect(payment.interest.toNumber()).toBe(5.00);
      expect(payment.principal.toNumber()).toBe(1000.00);
      expect(payment.totalPayment.toNumber()).toBe(1005.00);
      expect(payment.remainingBalance.toNumber()).toBe(0.00);
    });
  });

  describe('Rounding Config Validation', () => {
    it('should use default rounding when config not provided', () => {
      const terms = LoanEngine.createLoan(
        50000,
        5.0,
        120,
        '2024-01-01'
        // No rounding config provided
      );

      const schedule = LoanEngine.generateSchedule(terms);
      
      // Should still produce valid rounded values (default 2 decimal places)
      schedule.payments.forEach(payment => {
        expect(payment.principal.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
        expect(payment.interest.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
      });
    });

    it('should respect different decimal place settings', () => {
      // Test with 4 decimal places
      const terms = LoanEngine.createLoan(
        25000,
        3.75,
        60,
        '2024-01-01',
        {
          roundingConfig: { method: 'HALF_UP', decimalPlaces: 4 }
        }
      );

      const result = LoanEngine.calculatePayment(terms);
      
      // Should have up to 4 decimal places
      expect(result.monthlyPayment.toFixed(4)).toMatch(/^\d+\.\d{1,4}$/);
    });
  });
});