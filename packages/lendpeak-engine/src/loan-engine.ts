import Big from 'big.js';
import dayjs, { Dayjs } from 'dayjs';
import {
  LoanTerms,
  AmortizationSchedule,
  PaymentCalculationResult,
  InterestCalculationResult,
  InterestCalculationParams,
  PrepaymentParams,
  LoanModification,
  ValidationError,
  Payment,
} from './types';
import {
  generateAmortizationSchedule,
  generatePartialAmortizationSchedule,
  recalculateWithPrepayment,
} from './calculators/amortization-calculator';
import {
  calculateLoanPayment,
  calculateAmortizingPayment,
  calculateInterestOnlyPayment,
  getPaymentPeriodsPerYear,
} from './calculators/payment-calculator';
import {
  calculateSimpleInterest,
  calculateCompoundInterest,
  calculateDailyInterestAccrual,
  calculateAccruedInterest,
  calculateEffectiveInterestRate,
  calculateNominalInterestRate,
} from './calculators/interest-calculator';
import {
  validateLoanTerms,
  validatePrepayment,
  isValidLoanTerms,
} from './validators/loan-validator';
import { toBig, round, formatCurrency, formatPercentage } from './utils/decimal-utils';
import { parseDate, formatDate, getNextPaymentDate, addMonthsWithEndOfMonth } from './utils/date-utils';

/**
 * Main LoanEngine class - Stateless loan calculation engine
 * 
 * This engine provides comprehensive loan calculations including:
 * - Payment calculations (monthly, bi-weekly, etc.)
 * - Amortization schedules
 * - Interest calculations (simple, compound, amortized)
 * - Prepayment scenarios
 * - Loan modifications
 * - APR calculations
 * 
 * All calculations use Big.js for decimal precision and dayjs for date handling.
 */
export class LoanEngine {
  /**
   * Create a new loan with the given terms
   */
  static createLoan(
    principal: string | number | Big,
    annualInterestRate: string | number | Big,
    termMonths: number,
    startDate: string | Date | Dayjs,
    options: Partial<LoanTerms> = {}
  ): LoanTerms {
    const start = typeof startDate === 'string' 
      ? parseDate(startDate) 
      : dayjs(startDate);
    
    return {
      principal: toBig(principal),
      annualInterestRate: toBig(annualInterestRate),
      termMonths,
      startDate: start,
      paymentFrequency: options.paymentFrequency || 'monthly',
      interestType: options.interestType || 'amortized',
      dayCountConvention: options.dayCountConvention || '30/360',
      firstPaymentDate: options.firstPaymentDate ? 
        (typeof options.firstPaymentDate === 'string' ? parseDate(options.firstPaymentDate) : dayjs(options.firstPaymentDate)) : 
        undefined,
      balloonPayment: options.balloonPayment,
      balloonPaymentDate: options.balloonPaymentDate ? 
        (typeof options.balloonPaymentDate === 'string' ? parseDate(options.balloonPaymentDate) : dayjs(options.balloonPaymentDate)) : 
        undefined,
      roundingConfig: options.roundingConfig || { method: 'HALF_UP', decimalPlaces: 2 },
    };
  }
  
  /**
   * Validate loan terms
   */
  static validate(terms: LoanTerms): ValidationError[] {
    return validateLoanTerms(terms);
  }
  
  /**
   * Check if loan terms are valid
   */
  static isValid(terms: LoanTerms): boolean {
    return isValidLoanTerms(terms);
  }
  
  /**
   * Calculate monthly payment and total interest
   */
  static calculatePayment(terms: LoanTerms): PaymentCalculationResult {
    return calculateLoanPayment(terms);
  }
  
  /**
   * Generate complete amortization schedule
   */
  static generateSchedule(terms: LoanTerms): AmortizationSchedule {
    return generateAmortizationSchedule(terms);
  }
  
  /**
   * Generate partial amortization schedule
   */
  static generatePartialSchedule(
    terms: LoanTerms,
    startingBalance: string | number | Big,
    startingPaymentNumber: number,
    numberOfPayments: number
  ): Payment[] {
    return generatePartialAmortizationSchedule(
      terms,
      toBig(startingBalance),
      startingPaymentNumber,
      numberOfPayments
    );
  }
  
  /**
   * Calculate simple interest
   */
  static calculateInterest(params: InterestCalculationParams): InterestCalculationResult {
    return calculateSimpleInterest(params);
  }
  
  /**
   * Calculate compound interest
   */
  static calculateCompoundInterest(
    principal: string | number | Big,
    annualRate: string | number | Big,
    years: number,
    compoundingFrequency: number = 12,
    roundingConfig?: LoanTerms['roundingConfig']
  ): Big {
    const periods = years * compoundingFrequency;
    return calculateCompoundInterest(
      toBig(principal),
      toBig(annualRate),
      periods,
      compoundingFrequency,
      roundingConfig
    );
  }
  
  /**
   * Calculate daily interest accrual
   */
  static calculateDailyInterest(
    balance: string | number | Big,
    annualRate: string | number | Big,
    dayCountConvention: LoanTerms['dayCountConvention'] = '30/360',
    date: string | Date | Dayjs = dayjs(),
    roundingConfig?: LoanTerms['roundingConfig']
  ): Big {
    const dateObj = typeof date === 'string' ? parseDate(date) : dayjs(date);
    return calculateDailyInterestAccrual(
      toBig(balance),
      toBig(annualRate),
      dayCountConvention,
      dateObj,
      roundingConfig
    );
  }
  
  /**
   * Calculate accrued interest between dates
   */
  static calculateAccruedInterest(
    principal: string | number | Big,
    annualRate: string | number | Big,
    startDate: string | Date | Dayjs,
    endDate: string | Date | Dayjs,
    dayCountConvention: LoanTerms['dayCountConvention'] = '30/360',
    roundingConfig?: LoanTerms['roundingConfig']
  ): Big {
    const start = typeof startDate === 'string' ? parseDate(startDate) : dayjs(startDate);
    const end = typeof endDate === 'string' ? parseDate(endDate) : dayjs(endDate);
    
    return calculateAccruedInterest(
      toBig(principal),
      toBig(annualRate),
      start,
      end,
      dayCountConvention,
      undefined,
      roundingConfig
    );
  }
  
  /**
   * Calculate effective interest rate from nominal rate
   */
  static calculateEffectiveRate(
    nominalRate: string | number | Big,
    compoundingFrequency: number = 12
  ): Big {
    return calculateEffectiveInterestRate(toBig(nominalRate), compoundingFrequency);
  }
  
  /**
   * Calculate nominal interest rate from effective rate
   */
  static calculateNominalRate(
    effectiveRate: string | number | Big,
    compoundingFrequency: number = 12
  ): Big {
    return calculateNominalInterestRate(toBig(effectiveRate), compoundingFrequency);
  }
  
  /**
   * Apply prepayment to loan and recalculate schedule
   */
  static applyPrepayment(
    schedule: AmortizationSchedule,
    prepayment: PrepaymentParams
  ): AmortizationSchedule {
    return recalculateWithPrepayment(
      schedule,
      prepayment.amount,
      prepayment.date,
      prepayment.applyToPrincipal
    );
  }
  
  /**
   * Apply loan modification and recalculate
   */
  static applyModification(
    terms: LoanTerms,
    modification: LoanModification,
    currentBalance: string | number | Big
  ): LoanTerms {
    const balance = toBig(currentBalance);
    
    // Create new terms with modifications
    const newTerms: LoanTerms = {
      ...terms,
      principal: balance.plus(modification.principalAdjustment || 0),
      annualInterestRate: modification.newRate || terms.annualInterestRate,
      termMonths: modification.newTermMonths || terms.termMonths,
      startDate: modification.effectiveDate,
    };
    
    return newTerms;
  }
  
  /**
   * Calculate APR (Annual Percentage Rate) including fees
   */
  static calculateAPR(
    principal: string | number | Big,
    monthlyPayment: string | number | Big,
    termMonths: number,
    upfrontFees: string | number | Big = 0
  ): Big {
    const p = toBig(principal);
    const payment = toBig(monthlyPayment);
    const fees = toBig(upfrontFees);
    
    // Net amount received by borrower
    const netPrincipal = p.minus(fees);
    
    // If no payment or principal, return 0
    if (payment.eq(0) || netPrincipal.lte(0)) {
      return toBig(0);
    }
    
    // Calculate the interest rate that makes PV of payments = net principal
    // Using bisection method for simplicity
    let lowRate = toBig(0);
    let highRate = toBig(1); // 100% APR max
    const tolerance = toBig(0.00001);
    const maxIterations = 100;
    
    for (let i = 0; i < maxIterations; i++) {
      const midRate = lowRate.plus(highRate).div(2);
      const monthlyRate = midRate.div(12);
      
      // Calculate present value of payments
      let pv: Big;
      if (monthlyRate.eq(0)) {
        pv = payment.times(termMonths);
      } else {
        const factor = toBig(1).plus(monthlyRate).pow(termMonths);
        pv = payment.times(factor.minus(1)).div(monthlyRate.times(factor));
      }
      
      const diff = pv.minus(netPrincipal);
      
      if (diff.abs().lt(tolerance)) {
        return midRate.times(100);
      }
      
      if (diff.gt(0)) {
        // PV too high, increase rate
        lowRate = midRate;
      } else {
        // PV too low, decrease rate
        highRate = midRate;
      }
    }
    
    return lowRate.plus(highRate).div(2).times(100);
  }
  
  /**
   * Format currency value
   */
  static formatCurrency(
    value: string | number | Big,
    symbol: string = '$',
    decimals: number = 2
  ): string {
    return formatCurrency(toBig(value), symbol, decimals);
  }
  
  /**
   * Format percentage value
   */
  static formatPercentage(
    value: string | number | Big,
    decimals: number = 2
  ): string {
    return formatPercentage(toBig(value), decimals);
  }
  
  /**
   * Format date
   */
  static formatDate(
    date: string | Date | Dayjs,
    format: string = 'YYYY-MM-DD'
  ): string {
    const d = typeof date === 'string' ? parseDate(date) : dayjs(date);
    return formatDate(d, format);
  }
  
  /**
   * Parse date string
   */
  static parseDate(dateString: string, format?: string): Dayjs {
    return parseDate(dateString, format);
  }
  
  /**
   * Get next payment date
   */
  static getNextPaymentDate(
    currentDate: string | Date | Dayjs,
    frequency: LoanTerms['paymentFrequency']
  ): Dayjs {
    const date = typeof currentDate === 'string' ? parseDate(currentDate) : dayjs(currentDate);
    return getNextPaymentDate(date, frequency);
  }
  
  /**
   * Calculate remaining balance at a specific payment number
   */
  static getRemainingBalance(
    schedule: AmortizationSchedule,
    paymentNumber: number
  ): Big {
    const payment = schedule.payments.find(p => p.paymentNumber === paymentNumber);
    return payment ? payment.remainingBalance : toBig(0);
  }
  
  /**
   * Calculate total interest paid up to a specific payment
   */
  static getTotalInterestPaid(
    schedule: AmortizationSchedule,
    paymentNumber: number
  ): Big {
    const payment = schedule.payments.find(p => p.paymentNumber === paymentNumber);
    return payment ? payment.cumulativeInterest : toBig(0);
  }
  
  /**
   * Calculate payoff amount at a specific date
   */
  static getPayoffAmount(
    schedule: AmortizationSchedule,
    payoffDate: string | Date | Dayjs,
    includeAccruedInterest: boolean = true
  ): Big {
    const date = typeof payoffDate === 'string' ? parseDate(payoffDate) : dayjs(payoffDate);
    
    // Find the last payment before payoff date
    let lastPayment: Payment | undefined;
    for (const payment of schedule.payments) {
      if (payment.dueDate.isAfter(date)) {
        break;
      }
      lastPayment = payment;
    }
    
    if (!lastPayment) {
      // Payoff before first payment
      return schedule.totalPrincipal;
    }
    
    let payoffAmount = lastPayment.remainingBalance;
    
    if (includeAccruedInterest && lastPayment.remainingBalance.gt(0)) {
      // Calculate accrued interest from last payment to payoff date
      // This is a simplified calculation - in practice you'd use the actual
      // interest calculation based on the loan terms
      const daysSinceLastPayment = date.diff(lastPayment.dueDate, 'day');
      const dailyRate = schedule.effectiveInterestRate.div(36500); // Approximate daily rate
      const accruedInterest = lastPayment.remainingBalance
        .times(dailyRate)
        .times(daysSinceLastPayment);
      
      payoffAmount = payoffAmount.plus(accruedInterest);
    }
    
    return round(payoffAmount, 2);
  }
}