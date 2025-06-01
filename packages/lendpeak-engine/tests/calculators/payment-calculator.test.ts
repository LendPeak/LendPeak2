import {
  calculateAmortizingPayment,
  calculateInterestOnlyPayment,
  calculatePaymentWithBalloon,
  getPaymentPeriodsPerYear,
} from '../../src/calculators/payment-calculator';
import { toBig } from '../../src/utils/decimal-utils';
import Big from 'big.js';

describe('Payment Calculator', () => {
  describe('getPaymentPeriodsPerYear', () => {
    it('should return correct periods for each frequency', () => {
      expect(getPaymentPeriodsPerYear('monthly')).toBe(12);
      expect(getPaymentPeriodsPerYear('semi-monthly')).toBe(24);
      expect(getPaymentPeriodsPerYear('bi-weekly')).toBe(26);
      expect(getPaymentPeriodsPerYear('weekly')).toBe(52);
      expect(getPaymentPeriodsPerYear('quarterly')).toBe(4);
      expect(getPaymentPeriodsPerYear('semi-annually')).toBe(2);
      expect(getPaymentPeriodsPerYear('annually')).toBe(1);
    });
  });

  describe('calculateAmortizingPayment', () => {
    it('should calculate correct monthly payment', () => {
      const payment = calculateAmortizingPayment(
        toBig(100000),
        toBig(5),
        360,
        'monthly'
      );
      
      // Expected payment for $100k at 5% for 30 years
      expect(payment.toFixed(2)).toBe('536.82');
    });

    it('should handle zero interest rate', () => {
      const payment = calculateAmortizingPayment(
        toBig(12000),
        toBig(0),
        12,
        'monthly'
      );
      
      expect(payment.toFixed(2)).toBe('1000.00');
    });

    it('should calculate bi-weekly payment', () => {
      const payment = calculateAmortizingPayment(
        toBig(50000),
        toBig(6),
        130, // 5 years of bi-weekly payments
        'bi-weekly'
      );
      
      expect(payment.toNumber()).toBeGreaterThan(400);
      expect(payment.toNumber()).toBeLessThan(450);
    });
  });

  describe('calculateInterestOnlyPayment', () => {
    it('should calculate interest-only payment', () => {
      const payment = calculateInterestOnlyPayment(
        toBig(100000),
        toBig(6),
        'monthly'
      );
      
      // 6% annual on $100k = $6000/year = $500/month
      expect(payment.toFixed(2)).toBe('500.00');
    });

    it('should handle different payment frequencies', () => {
      const principal = toBig(100000);
      const rate = toBig(6);
      
      const monthly = calculateInterestOnlyPayment(principal, rate, 'monthly');
      const biweekly = calculateInterestOnlyPayment(principal, rate, 'bi-weekly');
      const weekly = calculateInterestOnlyPayment(principal, rate, 'weekly');
      
      expect(monthly.toFixed(2)).toBe('500.00');
      expect(biweekly.toFixed(2)).toBe('230.77');
      expect(weekly.toFixed(2)).toBe('115.38');
    });
  });

  describe('calculatePaymentWithBalloon', () => {
    it('should reduce regular payments with balloon', () => {
      const principal = toBig(200000);
      const rate = toBig(5);
      const periods = 60;
      const balloon = toBig(150000);
      
      const withBalloon = calculatePaymentWithBalloon(
        principal,
        rate,
        periods,
        balloon,
        'monthly'
      );
      
      const withoutBalloon = calculateAmortizingPayment(
        principal,
        rate,
        periods,
        'monthly'
      );
      
      // Payment with balloon should be significantly less
      expect(withBalloon.toNumber()).toBeLessThan(withoutBalloon.toNumber() * 0.5);
    });

    it('should handle zero interest with balloon', () => {
      const payment = calculatePaymentWithBalloon(
        toBig(100000),
        toBig(0),
        10,
        toBig(50000),
        'monthly'
      );
      
      // Should amortize $50k over 10 months
      expect(payment.toFixed(2)).toBe('5000.00');
    });

    it('should handle balloon equal to principal', () => {
      const payment = calculatePaymentWithBalloon(
        toBig(100000),
        toBig(5),
        60,
        toBig(100000),
        'monthly'
      );
      
      // When balloon equals principal, the regular payment should be interest-only
      const interestOnly = calculateInterestOnlyPayment(
        toBig(100000),
        toBig(5),
        'monthly'
      );
      
      // Payment should be equal to interest-only payment
      expect(payment.toFixed(2)).toBe(interestOnly.toFixed(2));
    });
  });
});