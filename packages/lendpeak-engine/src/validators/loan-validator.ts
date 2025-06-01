import Big from 'big.js';
import { Dayjs } from 'dayjs';
import { LoanTerms, ValidationError } from '../types';
import { toBig, isNegative, isZero } from '../utils/decimal-utils';

/**
 * Validate loan terms
 */
export function validateLoanTerms(terms: LoanTerms): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Validate principal
  if (!terms.principal) {
    errors.push({
      field: 'principal',
      message: 'Principal amount is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (isNegative(terms.principal) || isZero(terms.principal)) {
    errors.push({
      field: 'principal',
      message: 'Principal amount must be greater than zero',
      code: 'INVALID_VALUE',
    });
  } else if (terms.principal.gt(toBig('100000000'))) {
    errors.push({
      field: 'principal',
      message: 'Principal amount exceeds maximum allowed value',
      code: 'MAX_VALUE_EXCEEDED',
    });
  }
  
  // Validate interest rate
  if (!terms.annualInterestRate) {
    errors.push({
      field: 'annualInterestRate',
      message: 'Annual interest rate is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (isNegative(terms.annualInterestRate)) {
    errors.push({
      field: 'annualInterestRate',
      message: 'Annual interest rate cannot be negative',
      code: 'INVALID_VALUE',
    });
  } else if (terms.annualInterestRate.gt(toBig('100'))) {
    errors.push({
      field: 'annualInterestRate',
      message: 'Annual interest rate cannot exceed 100%',
      code: 'MAX_VALUE_EXCEEDED',
    });
  }
  
  // Validate term
  if (!terms.termMonths || terms.termMonths <= 0) {
    errors.push({
      field: 'termMonths',
      message: 'Term must be greater than zero months',
      code: 'INVALID_VALUE',
    });
  } else if (terms.termMonths > 600) {
    errors.push({
      field: 'termMonths',
      message: 'Term cannot exceed 600 months (50 years)',
      code: 'MAX_VALUE_EXCEEDED',
    });
  }
  
  // Validate dates
  if (!terms.startDate) {
    errors.push({
      field: 'startDate',
      message: 'Start date is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (!terms.startDate.isValid()) {
    errors.push({
      field: 'startDate',
      message: 'Start date is invalid',
      code: 'INVALID_DATE',
    });
  }
  
  if (terms.firstPaymentDate) {
    if (!terms.firstPaymentDate.isValid()) {
      errors.push({
        field: 'firstPaymentDate',
        message: 'First payment date is invalid',
        code: 'INVALID_DATE',
      });
    } else if (terms.startDate && terms.firstPaymentDate.isBefore(terms.startDate)) {
      errors.push({
        field: 'firstPaymentDate',
        message: 'First payment date cannot be before start date',
        code: 'INVALID_DATE_RANGE',
      });
    } else if (terms.startDate && terms.firstPaymentDate.isAfter(terms.startDate.add(3, 'months'))) {
      errors.push({
        field: 'firstPaymentDate',
        message: 'First payment date cannot be more than 3 months after start date',
        code: 'INVALID_DATE_RANGE',
      });
    }
  }
  
  // Validate balloon payment
  if (terms.balloonPayment) {
    if (isNegative(terms.balloonPayment)) {
      errors.push({
        field: 'balloonPayment',
        message: 'Balloon payment cannot be negative',
        code: 'INVALID_VALUE',
      });
    } else if (terms.principal && terms.balloonPayment.gte(terms.principal)) {
      errors.push({
        field: 'balloonPayment',
        message: 'Balloon payment must be less than principal',
        code: 'INVALID_VALUE',
      });
    }
    
    if (terms.balloonPaymentDate) {
      if (!terms.balloonPaymentDate.isValid()) {
        errors.push({
          field: 'balloonPaymentDate',
          message: 'Balloon payment date is invalid',
          code: 'INVALID_DATE',
        });
      } else if (terms.startDate && terms.balloonPaymentDate.isBefore(terms.startDate)) {
        errors.push({
          field: 'balloonPaymentDate',
          message: 'Balloon payment date cannot be before start date',
          code: 'INVALID_DATE_RANGE',
        });
      }
    }
  }
  
  // Validate payment frequency
  const validFrequencies = [
    'monthly',
    'semi-monthly',
    'bi-weekly',
    'weekly',
    'quarterly',
    'semi-annually',
    'annually',
  ];
  
  if (!terms.paymentFrequency) {
    errors.push({
      field: 'paymentFrequency',
      message: 'Payment frequency is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (!validFrequencies.includes(terms.paymentFrequency)) {
    errors.push({
      field: 'paymentFrequency',
      message: `Payment frequency must be one of: ${validFrequencies.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }
  
  // Validate interest type
  const validInterestTypes = ['simple', 'compound', 'amortized'];
  
  if (!terms.interestType) {
    errors.push({
      field: 'interestType',
      message: 'Interest type is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (!validInterestTypes.includes(terms.interestType)) {
    errors.push({
      field: 'interestType',
      message: `Interest type must be one of: ${validInterestTypes.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }
  
  // Validate day count convention
  const validConventions = ['30/360', 'actual/360', 'actual/365', 'actual/actual'];
  
  if (!terms.dayCountConvention) {
    errors.push({
      field: 'dayCountConvention',
      message: 'Day count convention is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (!validConventions.includes(terms.dayCountConvention)) {
    errors.push({
      field: 'dayCountConvention',
      message: `Day count convention must be one of: ${validConventions.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }
  
  return errors;
}

/**
 * Validate prepayment parameters
 */
export function validatePrepayment(
  amount: Big,
  date: Dayjs,
  currentBalance: Big,
  loanStartDate: Dayjs
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!amount || isNegative(amount) || isZero(amount)) {
    errors.push({
      field: 'amount',
      message: 'Prepayment amount must be greater than zero',
      code: 'INVALID_VALUE',
    });
  } else if (amount.gt(currentBalance)) {
    errors.push({
      field: 'amount',
      message: 'Prepayment amount cannot exceed current balance',
      code: 'MAX_VALUE_EXCEEDED',
    });
  }
  
  if (!date || !date.isValid()) {
    errors.push({
      field: 'date',
      message: 'Prepayment date is invalid',
      code: 'INVALID_DATE',
    });
  } else if (date.isBefore(loanStartDate)) {
    errors.push({
      field: 'date',
      message: 'Prepayment date cannot be before loan start date',
      code: 'INVALID_DATE_RANGE',
    });
  }
  
  return errors;
}

/**
 * Check if loan terms are valid
 */
export function isValidLoanTerms(terms: LoanTerms): boolean {
  const errors = validateLoanTerms(terms);
  return errors.length === 0;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }
  
  return errors
    .map(error => `${error.field}: ${error.message}`)
    .join('\n');
}