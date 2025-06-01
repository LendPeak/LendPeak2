import { describe, it, expect, beforeEach } from 'vitest';
import { demoLoanStorage } from '../services/demoLoanStorage';
import { LoanEngine, Big } from '@lendpeak/engine';

describe('Demo Loan Rounding', () => {
  beforeEach(() => {
    // Clear existing data before each test
    localStorage.clear();
  });

  it('should create loan with proper rounding configuration', () => {
    const loanData = {
      borrowerId: 'test-borrower',
      loanType: 'MORTGAGE',
      loanPurpose: 'PURCHASE',
      originalPrincipal: 150000,
      interestRate: 5.75,
      termMonths: 360,
      originationDate: new Date('2024-01-01'),
      firstPaymentDate: new Date('2024-02-01'),
      paymentFrequency: 'monthly',
      paymentDueDay: 1,
      loanCalendar: 'THIRTY_360',
      accrualStartTiming: 'SAME_DAY',
      roundingMethod: 'ROUND_HALF_UP',
    };

    const loan = demoLoanStorage.createLoan(loanData);

    // Verify loan was created
    expect(loan).toBeDefined();
    expect(loan.id).toBeTruthy();
    
    // Verify engine terms include rounding config
    expect(loan.engineTerms).toBeDefined();
    expect(loan.engineTerms.roundingConfig).toEqual({
      method: 'HALF_UP',
      decimalPlaces: 2
    });
  });

  it('should map rounding methods correctly', () => {
    const testCases = [
      { input: 'ROUND_HALF_UP', expected: 'HALF_UP' },
      { input: 'ROUND_HALF_DOWN', expected: 'HALF_DOWN' },
      { input: 'ROUND_UP', expected: 'UP' },
      { input: 'ROUND_DOWN', expected: 'DOWN' },
      { input: 'ROUND_HALF_EVEN', expected: 'BANKERS' },
    ];

    testCases.forEach(({ input, expected }) => {
      const loan = demoLoanStorage.createLoan({
        borrowerId: 'test',
        originalPrincipal: 100000,
        interestRate: 5.0,
        termMonths: 360,
        roundingMethod: input,
      });

      expect(loan.engineTerms.roundingConfig.method).toBe(expected);
    });
  });

  it('should generate amortization schedule with proper rounding', () => {
    const loan = demoLoanStorage.createLoan({
      borrowerId: 'test-borrower',
      originalPrincipal: 75000,
      interestRate: 6.125, // Rate that produces fractional cents
      termMonths: 180,
      originationDate: new Date('2024-01-01'),
      firstPaymentDate: new Date('2024-02-01'),
      roundingMethod: 'ROUND_HALF_UP',
    });

    // Create loan terms with proper date handling
    const loanTerms = LoanEngine.createLoan(
      loan.engineTerms.principal,
      loan.engineTerms.annualInterestRate,
      loan.engineTerms.termMonths,
      new Date(loan.engineTerms.startDate),
      {
        paymentFrequency: loan.engineTerms.paymentFrequency,
        interestType: loan.engineTerms.interestType,
        dayCountConvention: loan.engineTerms.dayCountConvention,
        firstPaymentDate: loan.engineTerms.firstPaymentDate ? new Date(loan.engineTerms.firstPaymentDate) : undefined,
        roundingConfig: loan.engineTerms.roundingConfig,
      }
    );
    
    // Generate schedule
    const schedule = LoanEngine.generateSchedule(loanTerms);

    // Verify all payments have properly rounded values
    schedule.payments.forEach((payment, index) => {
      // Check that all monetary values are numbers with max 2 decimal places
      const principalDecimals = payment.principal.toFixed(10).split('.')[1]?.replace(/0+$/, '') || '';
      const interestDecimals = payment.interest.toFixed(10).split('.')[1]?.replace(/0+$/, '') || '';
      const totalDecimals = payment.totalPayment.toFixed(10).split('.')[1]?.replace(/0+$/, '') || '';
      const balanceDecimals = payment.remainingBalance.toFixed(10).split('.')[1]?.replace(/0+$/, '') || '';

      expect(principalDecimals.length).toBeLessThanOrEqual(2);
      expect(interestDecimals.length).toBeLessThanOrEqual(2);
      expect(totalDecimals.length).toBeLessThanOrEqual(2);
      expect(balanceDecimals.length).toBeLessThanOrEqual(2);

      // Verify principal + interest = total payment
      const calculatedTotal = payment.principal.plus(payment.interest);
      expect(calculatedTotal.toNumber()).toBeCloseTo(payment.totalPayment.toNumber(), 2);
    });

    // Verify total principal paid equals original principal (within rounding tolerance)
    const totalPrincipal = schedule.payments.reduce(
      (sum, payment) => sum.plus(payment.principal),
      new Big(0)
    );
    expect(Math.abs(totalPrincipal.toNumber() - loan.engineTerms.principal)).toBeLessThanOrEqual(0.01);
  });
});