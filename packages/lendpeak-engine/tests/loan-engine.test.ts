import { LoanEngine } from '../src';
import Big from 'big.js';
import dayjs from 'dayjs';

describe('LoanEngine', () => {
  describe('createLoan', () => {
    it('should create a loan with default values', () => {
      const loan = LoanEngine.createLoan(
        100000,
        5.5,
        360,
        '2024-01-01'
      );
      
      expect(loan.principal.toString()).toBe('100000');
      expect(loan.annualInterestRate.toString()).toBe('5.5');
      expect(loan.termMonths).toBe(360);
      expect(loan.paymentFrequency).toBe('monthly');
      expect(loan.interestType).toBe('amortized');
      expect(loan.dayCountConvention).toBe('30/360');
    });
    
    it('should accept Big.js values', () => {
      const loan = LoanEngine.createLoan(
        new Big('250000.50'),
        new Big('4.25'),
        180,
        dayjs('2024-03-15')
      );
      
      expect(loan.principal.toString()).toBe('250000.5');
      expect(loan.annualInterestRate.toString()).toBe('4.25');
    });
    
    it('should accept custom options', () => {
      const loan = LoanEngine.createLoan(
        150000,
        6.0,
        240,
        '2024-01-01',
        {
          paymentFrequency: 'bi-weekly',
          interestType: 'simple',
          dayCountConvention: 'actual/365',
          balloonPayment: new Big(50000),
        }
      );
      
      expect(loan.paymentFrequency).toBe('bi-weekly');
      expect(loan.interestType).toBe('simple');
      expect(loan.dayCountConvention).toBe('actual/365');
      expect(loan.balloonPayment?.toString()).toBe('50000');
    });
  });
  
  describe('calculatePayment', () => {
    it('should calculate monthly payment for standard loan', () => {
      const loan = LoanEngine.createLoan(200000, 4.5, 360, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      // Expected monthly payment: ~$1,013.37
      expect(result.monthlyPayment.toFixed(2)).toBe('1013.37');
      expect(result.totalInterest.toFixed(2)).toBe('164813.42');
      expect(result.totalPayments.toFixed(2)).toBe('364813.42');
    });
    
    it('should calculate payment for zero interest loan', () => {
      const loan = LoanEngine.createLoan(12000, 0, 12, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      expect(result.monthlyPayment.toFixed(2)).toBe('1000.00');
      expect(result.totalInterest.toFixed(2)).toBe('0.00');
      expect(result.totalPayments.toFixed(2)).toBe('12000.00');
    });
    
    it('should calculate payment with balloon', () => {
      const loan = LoanEngine.createLoan(
        200000,
        5.0,
        60,
        '2024-01-01',
        { balloonPayment: new Big(150000) }
      );
      const result = LoanEngine.calculatePayment(loan);
      
      // With a $150k balloon on a $200k loan, only $50k is amortized
      // The payment should be less than a fully amortizing loan
      const fullyAmortizingLoan = LoanEngine.createLoan(200000, 5.0, 60, '2024-01-01');
      const fullyAmortizingResult = LoanEngine.calculatePayment(fullyAmortizingLoan);
      
      expect(result.monthlyPayment.toNumber()).toBeLessThan(fullyAmortizingResult.monthlyPayment.toNumber());
      expect(result.totalPayments.minus(result.totalInterest).toFixed(2)).toBe('200000.00');
    });
  });
  
  describe('generateSchedule', () => {
    it('should generate complete amortization schedule', () => {
      const loan = LoanEngine.createLoan(10000, 6.0, 12, '2024-01-01');
      const schedule = LoanEngine.generateSchedule(loan);
      
      expect(schedule.payments).toHaveLength(12);
      expect(schedule.payments[0]?.paymentNumber).toBe(1);
      expect(schedule.payments[11]?.paymentNumber).toBe(12);
      expect(schedule.payments[11]?.remainingBalance.toFixed(2)).toBe('0.00');
      
      // Verify totals - there might be small rounding differences
      const totalPrincipal = schedule.payments.reduce(
        (sum, p) => sum.plus(p.principal),
        new Big(0)
      );
      // Allow for small rounding difference (less than 10 cents)
      expect(Math.abs(totalPrincipal.toNumber() - 10000)).toBeLessThan(0.10);
    });
    
    it('should handle irregular first payment period', () => {
      const loan = LoanEngine.createLoan(
        100000,
        5.0,
        360,
        '2024-01-15',
        { firstPaymentDate: dayjs('2024-03-01') }
      );
      const schedule = LoanEngine.generateSchedule(loan);
      
      // First payment should have more interest due to longer period
      expect(schedule.payments[0]?.interest.toNumber()).toBeGreaterThan(
        schedule.payments[1]?.interest.toNumber() || 0
      );
    });
    
    it('should generate schedule for interest-only loan', () => {
      const loan = LoanEngine.createLoan(
        50000,
        4.0,
        60,
        '2024-01-01',
        { interestType: 'simple' }
      );
      const schedule = LoanEngine.generateSchedule(loan);
      
      // All payments except last should be interest only
      for (let i = 0; i < schedule.payments.length - 1; i++) {
        expect(schedule.payments[i]?.principal.toFixed(2)).toBe('0.00');
      }
      
      // Last payment includes principal
      const lastPayment = schedule.payments[schedule.payments.length - 1];
      expect(lastPayment?.principal.toFixed(2)).toBe('50000.00');
    });
  });
  
  describe('calculateInterest', () => {
    it('should calculate simple interest correctly', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(5),
        startDate: dayjs('2024-01-01'),
        endDate: dayjs('2024-01-31'),
        dayCountConvention: '30/360',
      });
      
      // 30 days of interest at 5% annual on $10,000
      // Daily rate = 5% / 360 = 0.0138889%
      // Interest = 10000 * 0.05 * 30 / 360 = 41.67
      expect(result.interestAmount.toFixed(2)).toBe('41.67');
      expect(result.dayCount).toBe(30);
    });
    
    it('should handle actual/365 convention', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(5),
        startDate: dayjs('2024-01-01'),
        endDate: dayjs('2024-01-31'),
        dayCountConvention: 'actual/365',
      });
      
      // 30 actual days at 5% annual on $10,000
      // Interest = 10000 * 0.05 * 30 / 365 = 41.10
      expect(result.interestAmount.toFixed(2)).toBe('41.10');
      expect(result.dayCount).toBe(30);
    });
  });
  
  describe('calculateAPR', () => {
    it('should calculate APR including fees', () => {
      // First calculate the payment for a 5% loan
      const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
      const payment = LoanEngine.calculatePayment(loan);
      
      const apr = LoanEngine.calculateAPR(
        100000,  // Principal
        payment.monthlyPayment,  // Monthly payment
        360,     // Term months
        2000     // Upfront fees
      );
      
      // APR should be higher than the note rate due to fees
      expect(apr.toNumber()).toBeGreaterThan(5.0);
      expect(apr.toNumber()).toBeLessThan(6.0);
    });
    
    it('should calculate APR with no fees', () => {
      // Calculate payment for a 5% loan
      const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
      const payment = LoanEngine.calculatePayment(loan);
      
      const apr = LoanEngine.calculateAPR(
        100000, 
        payment.monthlyPayment, 
        360, 
        0
      );
      
      // With no fees, APR should be close to the interest rate
      expect(Math.abs(apr.toNumber() - 5.0)).toBeLessThan(0.1);
    });
  });
  
  describe('applyPrepayment', () => {
    it('should reduce principal and recalculate schedule', () => {
      const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
      const originalSchedule = LoanEngine.generateSchedule(loan);
      
      const modifiedSchedule = LoanEngine.applyPrepayment(
        originalSchedule,
        {
          amount: new Big(10000),
          date: dayjs('2024-06-01'),
          applyToPrincipal: true,
        }
      );
      
      // Total interest should be less after prepayment
      expect(modifiedSchedule.totalInterest.toNumber()).toBeLessThan(
        originalSchedule.totalInterest.toNumber()
      );
      
      // Number of payments should be less
      expect(modifiedSchedule.payments.length).toBeLessThan(
        originalSchedule.payments.length
      );
    });
  });
  
  describe('validation', () => {
    it('should validate loan terms', () => {
      const invalidLoan = LoanEngine.createLoan(-100000, 5.0, 360, '2024-01-01');
      const errors = LoanEngine.validate(invalidLoan);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('principal');
      expect(errors[0]?.code).toBe('INVALID_VALUE');
    });
    
    it('should validate interest rate limits', () => {
      const invalidLoan = LoanEngine.createLoan(100000, 150, 360, '2024-01-01');
      const errors = LoanEngine.validate(invalidLoan);
      
      expect(errors.some(e => e.field === 'annualInterestRate')).toBe(true);
    });
    
    it('should validate date ranges', () => {
      const loan = LoanEngine.createLoan(
        100000,
        5.0,
        360,
        '2024-01-01',
        { firstPaymentDate: dayjs('2023-12-01') }
      );
      const errors = LoanEngine.validate(loan);
      
      expect(errors.some(e => e.field === 'firstPaymentDate')).toBe(true);
    });
  });
  
  describe('formatting', () => {
    it('should format currency correctly', () => {
      expect(LoanEngine.formatCurrency(1234.56)).toBe('$1,234.56');
      expect(LoanEngine.formatCurrency(1234567.89)).toBe('$1,234,567.89');
      expect(LoanEngine.formatCurrency(0.50)).toBe('$0.50');
      expect(LoanEngine.formatCurrency(1000, '€')).toBe('€1,000.00');
    });
    
    it('should format percentages correctly', () => {
      expect(LoanEngine.formatPercentage(5.5)).toBe('5.50%');
      expect(LoanEngine.formatPercentage(0.125, 3)).toBe('0.125%');
      expect(LoanEngine.formatPercentage(100)).toBe('100.00%');
    });
    
    it('should format dates correctly', () => {
      const date = dayjs('2024-01-15');
      expect(LoanEngine.formatDate(date)).toBe('2024-01-15');
      expect(LoanEngine.formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2024');
      expect(LoanEngine.formatDate(date, 'MMM D, YYYY')).toBe('Jan 15, 2024');
    });
  });
  
  describe('edge cases', () => {
    it('should handle very small interest rates', () => {
      const loan = LoanEngine.createLoan(100000, 0.01, 360, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      expect(result.monthlyPayment.toNumber()).toBeGreaterThan(277); // Principal / months
      expect(result.totalInterest.toNumber()).toBeGreaterThan(0);
    });
    
    it('should handle very large principal amounts', () => {
      const loan = LoanEngine.createLoan('10000000', 5.0, 360, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      expect(result.monthlyPayment.toString()).not.toContain('e'); // No scientific notation
      expect(result.totalPayments.minus(loan.principal).toFixed(2)).toBe(
        result.totalInterest.toFixed(2)
      );
    });
    
    it('should handle single payment loans', () => {
      const loan = LoanEngine.createLoan(1000, 12.0, 1, '2024-01-01');
      const schedule = LoanEngine.generateSchedule(loan);
      
      expect(schedule.payments).toHaveLength(1);
      expect(schedule.payments[0]?.principal.toFixed(2)).toBe('1000.00');
    });
  });
});