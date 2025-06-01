import dayjs from 'dayjs';
import {
  validateLoanTerms,
  validatePrepayment,
  isValidLoanTerms,
  formatValidationErrors,
} from '../../src/validators/loan-validator';
import { LoanTerms } from '../../src/types';
import { toBig } from '../../src/utils/decimal-utils';

describe('Loan Validator', () => {
  const validLoan: LoanTerms = {
    principal: toBig(100000),
    annualInterestRate: toBig(5),
    termMonths: 360,
    startDate: dayjs('2024-01-01'),
    paymentFrequency: 'monthly',
    interestType: 'amortized',
    dayCountConvention: '30/360',
  };

  describe('validateLoanTerms', () => {
    it('should validate valid loan terms', () => {
      const errors = validateLoanTerms(validLoan);
      expect(errors).toHaveLength(0);
    });

    it('should validate principal', () => {
      const negativePrincipal = { ...validLoan, principal: toBig(-1000) };
      const errors1 = validateLoanTerms(negativePrincipal);
      expect(errors1).toContainEqual(expect.objectContaining({
        field: 'principal',
        code: 'INVALID_VALUE',
      }));

      const zeroPrincipal = { ...validLoan, principal: toBig(0) };
      const errors2 = validateLoanTerms(zeroPrincipal);
      expect(errors2).toContainEqual(expect.objectContaining({
        field: 'principal',
        code: 'INVALID_VALUE',
      }));

      const hugePrincipal = { ...validLoan, principal: toBig('100000001') };
      const errors3 = validateLoanTerms(hugePrincipal);
      expect(errors3).toContainEqual(expect.objectContaining({
        field: 'principal',
        code: 'MAX_VALUE_EXCEEDED',
      }));
    });

    it('should validate interest rate', () => {
      const negativeRate = { ...validLoan, annualInterestRate: toBig(-1) };
      const errors1 = validateLoanTerms(negativeRate);
      expect(errors1).toContainEqual(expect.objectContaining({
        field: 'annualInterestRate',
        code: 'INVALID_VALUE',
      }));

      const tooHighRate = { ...validLoan, annualInterestRate: toBig(101) };
      const errors2 = validateLoanTerms(tooHighRate);
      expect(errors2).toContainEqual(expect.objectContaining({
        field: 'annualInterestRate',
        code: 'MAX_VALUE_EXCEEDED',
      }));
    });

    it('should validate term', () => {
      const zeroTerm = { ...validLoan, termMonths: 0 };
      const errors1 = validateLoanTerms(zeroTerm);
      expect(errors1).toContainEqual(expect.objectContaining({
        field: 'termMonths',
        code: 'INVALID_VALUE',
      }));

      const tooLongTerm = { ...validLoan, termMonths: 601 };
      const errors2 = validateLoanTerms(tooLongTerm);
      expect(errors2).toContainEqual(expect.objectContaining({
        field: 'termMonths',
        code: 'MAX_VALUE_EXCEEDED',
      }));
    });

    it('should validate dates', () => {
      const invalidStart = { 
        ...validLoan, 
        startDate: dayjs('invalid-date'),
      };
      const errors1 = validateLoanTerms(invalidStart);
      expect(errors1).toContainEqual(expect.objectContaining({
        field: 'startDate',
        code: 'INVALID_DATE',
      }));

      const firstBeforeStart = {
        ...validLoan,
        firstPaymentDate: dayjs('2023-12-01'),
      };
      const errors2 = validateLoanTerms(firstBeforeStart);
      expect(errors2).toContainEqual(expect.objectContaining({
        field: 'firstPaymentDate',
        code: 'INVALID_DATE_RANGE',
      }));

      const firstTooLate = {
        ...validLoan,
        firstPaymentDate: dayjs('2024-05-01'),
      };
      const errors3 = validateLoanTerms(firstTooLate);
      expect(errors3).toContainEqual(expect.objectContaining({
        field: 'firstPaymentDate',
        code: 'INVALID_DATE_RANGE',
      }));
    });

    it('should validate balloon payment', () => {
      const negativeBalloon = {
        ...validLoan,
        balloonPayment: toBig(-1000),
      };
      const errors1 = validateLoanTerms(negativeBalloon);
      expect(errors1).toContainEqual(expect.objectContaining({
        field: 'balloonPayment',
        code: 'INVALID_VALUE',
      }));

      const tooLargeBalloon = {
        ...validLoan,
        balloonPayment: toBig(100001),
      };
      const errors2 = validateLoanTerms(tooLargeBalloon);
      expect(errors2).toContainEqual(expect.objectContaining({
        field: 'balloonPayment',
        code: 'INVALID_VALUE',
      }));
    });

    it('should validate payment frequency', () => {
      const invalidFrequency = {
        ...validLoan,
        paymentFrequency: 'daily' as any,
      };
      const errors = validateLoanTerms(invalidFrequency);
      expect(errors).toContainEqual(expect.objectContaining({
        field: 'paymentFrequency',
        code: 'INVALID_VALUE',
      }));
    });

    it('should validate interest type', () => {
      const invalidType = {
        ...validLoan,
        interestType: 'complex' as any,
      };
      const errors = validateLoanTerms(invalidType);
      expect(errors).toContainEqual(expect.objectContaining({
        field: 'interestType',
        code: 'INVALID_VALUE',
      }));
    });

    it('should validate day count convention', () => {
      const invalidConvention = {
        ...validLoan,
        dayCountConvention: '365/365' as any,
      };
      const errors = validateLoanTerms(invalidConvention);
      expect(errors).toContainEqual(expect.objectContaining({
        field: 'dayCountConvention',
        code: 'INVALID_VALUE',
      }));
    });
  });

  describe('validatePrepayment', () => {
    const loanStartDate = dayjs('2024-01-01');
    const currentBalance = toBig(50000);

    it('should validate valid prepayment', () => {
      const errors = validatePrepayment(
        toBig(10000),
        dayjs('2024-06-01'),
        currentBalance,
        loanStartDate
      );
      expect(errors).toHaveLength(0);
    });

    it('should validate prepayment amount', () => {
      const errors1 = validatePrepayment(
        toBig(-100),
        dayjs('2024-06-01'),
        currentBalance,
        loanStartDate
      );
      expect(errors1).toContainEqual(expect.objectContaining({
        field: 'amount',
        code: 'INVALID_VALUE',
      }));

      const errors2 = validatePrepayment(
        toBig(60000),
        dayjs('2024-06-01'),
        currentBalance,
        loanStartDate
      );
      expect(errors2).toContainEqual(expect.objectContaining({
        field: 'amount',
        code: 'MAX_VALUE_EXCEEDED',
      }));
    });

    it('should validate prepayment date', () => {
      const errors = validatePrepayment(
        toBig(10000),
        dayjs('2023-12-01'),
        currentBalance,
        loanStartDate
      );
      expect(errors).toContainEqual(expect.objectContaining({
        field: 'date',
        code: 'INVALID_DATE_RANGE',
      }));
    });
  });

  describe('isValidLoanTerms', () => {
    it('should return true for valid loan', () => {
      expect(isValidLoanTerms(validLoan)).toBe(true);
    });

    it('should return false for invalid loan', () => {
      const invalidLoan = { ...validLoan, principal: toBig(-1000) };
      expect(isValidLoanTerms(invalidLoan)).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format errors correctly', () => {
      const errors = [
        { field: 'principal', message: 'Principal is required', code: 'REQUIRED' },
        { field: 'rate', message: 'Rate is too high', code: 'MAX_VALUE' },
      ];
      
      const formatted = formatValidationErrors(errors);
      expect(formatted).toBe('principal: Principal is required\nrate: Rate is too high');
    });

    it('should return empty string for no errors', () => {
      expect(formatValidationErrors([])).toBe('');
    });
  });
});