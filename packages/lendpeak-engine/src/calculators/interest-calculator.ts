import Big from 'big.js';
import { Dayjs } from 'dayjs';
import {
  DayCountConvention,
  InterestCalculationParams,
  InterestCalculationResult,
  RoundingConfig,
} from '../types';
import { calculateDayCount, getDayCountDenominator } from '../utils/date-utils';
import { toBig, safeDivide, roundMoney } from '../utils/decimal-utils';

/**
 * Calculate simple interest for a period
 */
export function calculateSimpleInterest(
  params: InterestCalculationParams
): InterestCalculationResult {
  const { principal, annualRate, startDate, endDate, dayCountConvention, roundingConfig } = params;
  
  // Calculate the number of days
  const dayCount = calculateDayCount(startDate, endDate, dayCountConvention);
  
  // Get the denominator based on convention
  const yearDays = getDayCountDenominator(
    dayCountConvention,
    startDate.year()
  );
  
  // Calculate daily rate
  const dailyRate = safeDivide(annualRate, toBig(yearDays * 100));
  
  // Calculate interest: Principal * Rate * Time
  let interestAmount = principal.times(dailyRate).times(dayCount);
  
  // Apply immediate rounding if config provided
  if (roundingConfig) {
    interestAmount = roundMoney(interestAmount, roundingConfig);
  }
  
  return {
    interestAmount,
    dayCount,
    dailyRate,
  };
}

/**
 * Calculate compound interest for a period
 */
export function calculateCompoundInterest(
  principal: Big,
  annualRate: Big,
  periods: number,
  compoundingFrequency: number = 12,
  roundingConfig?: RoundingConfig
): Big {
  // Convert annual rate to period rate
  const periodRate = safeDivide(
    annualRate,
    toBig(compoundingFrequency * 100)
  );
  
  // Calculate compound interest using formula: P(1 + r)^n - P
  const compoundFactor = toBig(1).plus(periodRate).pow(periods);
  const futureValue = principal.times(compoundFactor);
  
  let interest = futureValue.minus(principal);
  
  // Apply immediate rounding if config provided
  if (roundingConfig) {
    interest = roundMoney(interest, roundingConfig);
  }
  
  return interest;
}

/**
 * Calculate daily interest accrual
 */
export function calculateDailyInterestAccrual(
  outstandingBalance: Big,
  annualRate: Big,
  dayCountConvention: DayCountConvention,
  date: Dayjs,
  roundingConfig?: RoundingConfig
): Big {
  const yearDays = getDayCountDenominator(dayCountConvention, date.year());
  const dailyRate = safeDivide(annualRate, toBig(yearDays * 100));
  
  let dailyInterest = outstandingBalance.times(dailyRate);
  
  // Apply immediate rounding if config provided
  if (roundingConfig) {
    dailyInterest = roundMoney(dailyInterest, roundingConfig);
  }
  
  return dailyInterest;
}

/**
 * Calculate interest for irregular period (e.g., first or last payment)
 */
export function calculateIrregularPeriodInterest(
  principal: Big,
  annualRate: Big,
  startDate: Dayjs,
  endDate: Dayjs,
  dayCountConvention: DayCountConvention,
  roundingConfig?: RoundingConfig
): Big {
  const params: InterestCalculationParams = {
    principal,
    annualRate,
    startDate,
    endDate,
    dayCountConvention,
    roundingConfig,
  };
  
  const result = calculateSimpleInterest(params);
  return result.interestAmount;
}

/**
 * Calculate effective interest rate from nominal rate
 */
export function calculateEffectiveInterestRate(
  nominalRate: Big,
  compoundingFrequency: number
): Big {
  // Effective Rate = (1 + nominal/n)^n - 1
  const n = toBig(compoundingFrequency);
  const periodicRate = safeDivide(nominalRate, n.times(100));
  
  const effectiveRate = toBig(1)
    .plus(periodicRate)
    .pow(compoundingFrequency)
    .minus(1)
    .times(100);
  
  return effectiveRate;
}

/**
 * Calculate nominal interest rate from effective rate
 */
export function calculateNominalInterestRate(
  effectiveRate: Big,
  compoundingFrequency: number
): Big {
  // Nominal Rate = n * ((1 + effective)^(1/n) - 1)
  const n = toBig(compoundingFrequency);
  const effectiveDecimal = safeDivide(effectiveRate, toBig(100));
  
  const nominalRate = n
    .times(
      toBig(1)
        .plus(effectiveDecimal)
        .pow(safeDivide(toBig(1), n))
        .minus(1)
    )
    .times(100);
  
  return nominalRate;
}

/**
 * Calculate accrued interest between two dates with proper day counting
 */
export function calculateAccruedInterest(
  principal: Big,
  annualRate: Big,
  startDate: Dayjs,
  endDate: Dayjs,
  dayCountConvention: DayCountConvention,
  compoundingFrequency?: number,
  roundingConfig?: RoundingConfig
): Big {
  if (!compoundingFrequency || compoundingFrequency === 0) {
    // Simple interest
    const result = calculateSimpleInterest({
      principal,
      annualRate,
      startDate,
      endDate,
      dayCountConvention,
      roundingConfig,
    });
    return result.interestAmount;
  } else {
    // Compound interest - calculate periods based on dates
    const dayCount = calculateDayCount(startDate, endDate, dayCountConvention);
    const yearDays = getDayCountDenominator(dayCountConvention, startDate.year());
    const periods = safeDivide(
      toBig(dayCount * compoundingFrequency),
      toBig(yearDays)
    ).toNumber();
    
    return calculateCompoundInterest(
      principal,
      annualRate,
      periods,
      compoundingFrequency,
      roundingConfig
    );
  }
}