import Big from 'big.js';
import { Dayjs } from 'dayjs';
import {
  LoanTerms,
  PaymentCalculationResult,
  PaymentFrequency,
} from '../types';
import {
  toBig,
  safeDivide,
  compoundInterestFactor,
  isZero,
  roundMoney,
} from '../utils/decimal-utils';
import { calculateNumberOfPayments } from '../utils/date-utils';

/**
 * Get the number of payment periods per year based on frequency
 */
export function getPaymentPeriodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'monthly':
      return 12;
    case 'semi-monthly':
      return 24;
    case 'bi-weekly':
      return 26;
    case 'weekly':
      return 52;
    case 'quarterly':
      return 4;
    case 'semi-annually':
      return 2;
    case 'annually':
      return 1;
    default:
      throw new Error(`Unsupported payment frequency: ${frequency}`);
  }
}

/**
 * Calculate the regular payment amount for an amortizing loan
 * Using the standard amortization formula: P * (r(1+r)^n) / ((1+r)^n - 1)
 */
export function calculateAmortizingPayment(
  principal: Big,
  annualRate: Big,
  numberOfPayments: number,
  paymentFrequency: PaymentFrequency
  // roundingConfig?: any removed
): Big {
  // If interest rate is zero, simply divide principal by number of payments
  if (isZero(annualRate)) {
    const payment = safeDivide(principal, toBig(numberOfPayments));
    // return roundingConfig ? roundMoney(payment, roundingConfig) : payment;
    return payment;
  }
  
  // Calculate period interest rate
  const periodsPerYear = getPaymentPeriodsPerYear(paymentFrequency);
  const periodRate = safeDivide(annualRate, toBig(periodsPerYear * 100));
  
  // Calculate payment using amortization formula
  const compoundFactor = compoundInterestFactor(periodRate, numberOfPayments);
  const numerator = principal.times(periodRate).times(compoundFactor);
  const denominator = compoundFactor.minus(1);
  
  const payment = safeDivide(numerator, denominator);
  // return roundingConfig ? roundMoney(payment, roundingConfig) : payment;
  return payment;
}

/**
 * Calculate payment for interest-only loan
 */
export function calculateInterestOnlyPayment(
  principal: Big,
  annualRate: Big,
  paymentFrequency: PaymentFrequency
  // roundingConfig?: any removed
): Big {
  const periodsPerYear = getPaymentPeriodsPerYear(paymentFrequency);
  const periodRate = safeDivide(annualRate, toBig(periodsPerYear * 100));
  
  const payment = principal.times(periodRate);
  // return roundingConfig ? roundMoney(payment, roundingConfig) : payment;
  return payment;
}

/**
 * Calculate payment with balloon payment
 */
export function calculatePaymentWithBalloon(
  principal: Big,
  annualRate: Big,
  numberOfPayments: number,
  balloonAmount: Big,
  paymentFrequency: PaymentFrequency
  // roundingConfig?: any removed
): Big {
  // If interest rate is zero
  if (isZero(annualRate)) {
    const principalToPay = principal.minus(balloonAmount);
    const payment = safeDivide(principalToPay, toBig(numberOfPayments));
    // return roundingConfig ? roundMoney(payment, roundingConfig) : payment;
    return payment;
  }
  
  // Calculate present value of balloon payment
  const periodsPerYear = getPaymentPeriodsPerYear(paymentFrequency);
  const periodRate = safeDivide(annualRate, toBig(periodsPerYear * 100));
  const discountFactor = compoundInterestFactor(periodRate, numberOfPayments);
  const balloonPV = safeDivide(balloonAmount, discountFactor);
  
  // Calculate payment for remaining principal
  const adjustedPrincipal = principal.minus(balloonPV);
  return calculateAmortizingPayment(
    adjustedPrincipal,
    annualRate,
    numberOfPayments,
    paymentFrequency
    // roundingConfig removed
  );
}

/**
 * Calculate total payment information for a loan
 */
export function calculateLoanPayment(terms: LoanTerms): PaymentCalculationResult {
  const numberOfPayments = calculateNumberOfPayments(
    terms.termMonths,
    terms.paymentFrequency
  );
  
  let rawMonthlyPayment: Big;
  
  // Calculate payment based on loan type and balloon
  if (terms.balloonPayment && terms.balloonPayment.gt(0)) {
    rawMonthlyPayment = calculatePaymentWithBalloon(
      terms.principal,
      terms.annualInterestRate,
      numberOfPayments,
      terms.balloonPayment,
      terms.paymentFrequency
      // terms.roundingConfig removed
    );
  } else if (terms.interestType === 'simple') {
    rawMonthlyPayment = calculateInterestOnlyPayment(
      terms.principal,
      terms.annualInterestRate,
      terms.paymentFrequency
      // terms.roundingConfig removed
    );
  } else {
    rawMonthlyPayment = calculateAmortizingPayment(
      terms.principal,
      terms.annualInterestRate,
      numberOfPayments,
      terms.paymentFrequency
      // terms.roundingConfig removed
    );
  }
  
  // Calculate totals using raw monthly payment for precision
  const totalRegularPayments = rawMonthlyPayment.times(numberOfPayments);
  const totalPayments = totalRegularPayments.plus(terms.balloonPayment || 0);
  const totalInterest = totalPayments.minus(terms.principal); // This is now based on rawMonthlyPayment
  
  // Round the final results for output
  const roundedMonthlyPayment = terms.roundingConfig ? roundMoney(rawMonthlyPayment, terms.roundingConfig) : rawMonthlyPayment;
  const roundedTotalInterest = terms.roundingConfig ? roundMoney(totalInterest, terms.roundingConfig) : totalInterest;
  const roundedTotalPayments = terms.roundingConfig ? roundMoney(totalPayments, terms.roundingConfig) : totalPayments;
  
  // Calculate effective interest rate using the raw monthly payment for accuracy
  const effectiveInterestRate = calculateEffectiveRate(
    terms.principal,
    rawMonthlyPayment,
    numberOfPayments,
    terms.paymentFrequency,
    terms.balloonPayment
  );
  
  return {
    monthlyPayment: roundedMonthlyPayment, // e.g. 1013.37
    totalInterest: roundedTotalInterest, // e.g. 164813.42 after rounding the precise total
    totalPayments: roundedTotalPayments,
    effectiveInterestRate,
  };
}

/**
 * Calculate effective interest rate using Newton's method
 * This finds the rate that makes the present value of payments equal to the principal
 */
function calculateEffectiveRate(
  principal: Big,
  payment: Big,
  numberOfPayments: number,
  paymentFrequency: PaymentFrequency,
  balloonPayment?: Big
): Big {
  const periodsPerYear = getPaymentPeriodsPerYear(paymentFrequency);
  
  // Initial guess for the rate
  let rate = toBig(0.05).div(periodsPerYear); // Start with 5% annual
  const tolerance = toBig(0.000001);
  const maxIterations = 100;
  
  for (let i = 0; i < maxIterations; i++) {
    // Calculate present value with current rate
    const pv = calculatePresentValue(
      payment,
      rate,
      numberOfPayments,
      balloonPayment
    );
    
    // Check if we're close enough
    const difference = pv.minus(principal);
    if (difference.abs().lt(tolerance)) {
      // Convert to annual rate
      return rate.times(periodsPerYear).times(100);
    }
    
    // Calculate derivative for Newton's method
    const rateDelta = toBig(0.0001);
    const pvDelta = calculatePresentValue(
      payment,
      rate.plus(rateDelta),
      numberOfPayments,
      balloonPayment
    );
    const derivative = safeDivide(pvDelta.minus(pv), rateDelta);
    
    // Update rate
    rate = rate.minus(safeDivide(difference, derivative));
    
    // Ensure rate doesn't go negative
    if (rate.lt(0)) {
      rate = toBig(0.001);
    }
  }
  
  // If we didn't converge, return the nominal rate
  return toBig(periodsPerYear).times(rate).times(100);
}

/**
 * Calculate present value of a series of payments
 */
function calculatePresentValue(
  payment: Big,
  periodRate: Big,
  numberOfPayments: number,
  balloonPayment?: Big
): Big {
  if (isZero(periodRate)) {
    return payment.times(numberOfPayments).plus(balloonPayment || 0);
  }
  
  // PV of regular payments
  const compoundFactor = compoundInterestFactor(periodRate, numberOfPayments);
  const pvAnnuity = payment.times(
    safeDivide(compoundFactor.minus(1), periodRate.times(compoundFactor))
  );
  
  // PV of balloon payment
  let pvBalloon = toBig(0);
  if (balloonPayment && balloonPayment.gt(0)) {
    pvBalloon = safeDivide(balloonPayment, compoundFactor);
  }
  
  return pvAnnuity.plus(pvBalloon);
}