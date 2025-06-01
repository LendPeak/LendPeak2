import Big from 'big.js';
import Big from 'big.js';
import dayjs, { Dayjs } from 'dayjs'; // Import Dayjs
import {
  BalloonDetectionConfig,
  BalloonDetectionResult,
  SystemBalloonDefaults
} from '../types/balloon-payment-types';
import { AmortizationSchedule, ScheduledPayment } from '../types/payment-types';
import { roundMoney } from '../utils/decimal-utils';

/**
 * Default system-wide balloon payment configuration
 */
export const DEFAULT_BALLOON_CONFIG: SystemBalloonDefaults = {
  defaultPercentageThreshold: 50, // 50% above regular payment
  defaultAbsoluteThreshold: new Big(500), // $500 above regular payment
  defaultThresholdLogic: 'OR',
  defaultStrategy: 'ALLOW_BALLOON',
  maxBalloonPercentage: 200, // Max 200% above regular payment
  maxExtensionMonths: 24, // Max 2-year extension
  stateOverrides: {
    'CA': { 
      maxBalloonPercentage: 150,
      minNotificationDays: 90
    },
    'NY': { 
      requiresWrittenConsent: true,
      maxBalloonAmount: new Big(50000)
    },
    'TX': {
      prohibitedLoanTypes: ['HOME_EQUITY'],
      maxBalloonPercentage: 100
    }
  }
};

/**
 * Detects if a payment qualifies as a balloon payment
 */
export function isPaymentBalloon(
  payment: Big,
  regularPayment: Big,
  config: BalloonDetectionConfig
): { isBalloon: boolean; exceedsBy: { percentage: Big; absolute: Big } } {
  // Calculate how much the payment exceeds the regular payment
  const absoluteExcess = payment.minus(regularPayment);
  const percentageExcess = regularPayment.gt(0) 
    ? absoluteExcess.div(regularPayment).times(100)
    : new Big(0);
  
  // Check thresholds
  const meetsPercentageThreshold = percentageExcess.gte(config.percentageThreshold);
  const meetsAbsoluteThreshold = absoluteExcess.gte(config.absoluteThreshold);
  
  // Apply threshold logic
  const isBalloon = config.thresholdLogic === 'OR'
    ? meetsPercentageThreshold || meetsAbsoluteThreshold
    : meetsPercentageThreshold && meetsAbsoluteThreshold;
  
  return {
    isBalloon,
    exceedsBy: {
      percentage: roundMoney(percentageExcess),
      absolute: roundMoney(absoluteExcess)
    }
  };
}

/**
 * Analyzes an amortization schedule for balloon payments
 */
export function detectBalloonPayments(
  schedule: AmortizationSchedule,
  config: BalloonDetectionConfig
): BalloonDetectionResult[] {
  if (!config.enabled || schedule.payments.length === 0) {
    return [];
  }
  
  // Calculate the regular payment amount (median of all payments)
  const paymentAmounts = schedule.payments
    .filter(p => p.principal.gt(0) || p.interest.gt(0))
    .map(p => p.principal.plus(p.interest));
  
  if (paymentAmounts.length === 0) {
    return [];
  }
  
  // Sort payments to find median
  const sortedAmounts = [...paymentAmounts].sort((a, b) => 
    a.minus(b).toNumber()
  );
  
  const medianIndex = Math.floor(sortedAmounts.length / 2);
  const regularPayment = sortedAmounts.length % 2 === 0
    ? sortedAmounts[medianIndex - 1].plus(sortedAmounts[medianIndex]).div(2)
    : sortedAmounts[medianIndex];
  
  // Check each payment against balloon criteria
  const results: BalloonDetectionResult[] = [];
  
  schedule.payments.forEach((payment, index) => {
    const totalPayment = payment.principal.plus(payment.interest);
    const { isBalloon, exceedsBy } = isPaymentBalloon(
      totalPayment, 
      regularPayment, 
      config
    );
    
    if (isBalloon) {
      results.push({
        detected: true,
        payment: {
          paymentNumber: payment.paymentNumber,
          dueDate: payment.dueDate,
          amount: totalPayment,
          regularPaymentAmount: regularPayment
        },
        exceedsRegularBy: exceedsBy,
        meetsThreshold: {
          percentage: exceedsBy.percentage.gte(config.percentageThreshold),
          absolute: exceedsBy.absolute.gte(config.absoluteThreshold),
          combined: isBalloon
        }
      });
    }
  });
  
  return results;
}

/**
 * Finds the most significant balloon payment in a schedule
 */
export function findLargestBalloonPayment(
  schedule: AmortizationSchedule,
  config: BalloonDetectionConfig
): BalloonDetectionResult | null {
  const balloons = detectBalloonPayments(schedule, config);
  
  if (balloons.length === 0) {
    return null;
  }
  
  // Find the balloon with the largest absolute excess
  return balloons.reduce((largest, current) => {
    const largestExcess = largest.exceedsRegularBy?.absolute || new Big(0);
    const currentExcess = current.exceedsRegularBy?.absolute || new Big(0);
    
    return currentExcess.gt(largestExcess) ? current : largest;
  });
}

/**
 * Validates balloon payment against compliance rules
 */
export function validateBalloonCompliance(
  balloon: BalloonDetectionResult,
  state: string,
  loanType: string,
  systemDefaults: SystemBalloonDefaults = DEFAULT_BALLOON_CONFIG
): { 
  compliant: boolean; 
  violations: string[];
} {
  const violations: string[] = [];
  
  if (!balloon.detected || !balloon.payment || !balloon.exceedsRegularBy) {
    return { compliant: true, violations: [] };
  }
  
  // Check system-wide maximum
  if (balloon.exceedsRegularBy.percentage.gt(systemDefaults.maxBalloonPercentage)) {
    violations.push(
      `Balloon payment exceeds maximum allowed percentage of ${systemDefaults.maxBalloonPercentage}%`
    );
  }
  
  // Check state-specific rules
  const stateRules = systemDefaults.stateOverrides[state];
  if (stateRules) {
    // Check state maximum percentage
    if (stateRules.maxBalloonPercentage && 
        balloon.exceedsRegularBy.percentage.gt(stateRules.maxBalloonPercentage)) {
      violations.push(
        `Balloon payment exceeds ${state} maximum of ${stateRules.maxBalloonPercentage}%`
      );
    }
    
    // Check state maximum amount
    if (stateRules.maxBalloonAmount && 
        balloon.payment.amount.gt(stateRules.maxBalloonAmount)) {
      violations.push(
        `Balloon payment exceeds ${state} maximum amount of $${stateRules.maxBalloonAmount}`
      );
    }
    
    // Check prohibited loan types
    if (stateRules.prohibitedLoanTypes && 
        stateRules.prohibitedLoanTypes.includes(loanType)) {
      violations.push(
        `Balloon payments are prohibited for ${loanType} loans in ${state}`
      );
    }
  }
  
  return {
    compliant: violations.length === 0,
    violations
  };
}

/**
 * Calculates notification schedule for a balloon payment
 */
export function calculateBalloonNotificationSchedule(
  balloonDate: Dayjs, // Changed to Dayjs
  notificationDays: number[],
  state?: string,
  systemDefaults: SystemBalloonDefaults = DEFAULT_BALLOON_CONFIG
): Dayjs[] { // Changed to Dayjs[]
  // Get state-specific minimum notification days
  const stateRules = state ? systemDefaults.stateOverrides[state] : undefined;
  const minNotificationDays = stateRules?.minNotificationDays || 0;
  
  // Ensure we meet minimum notification requirements
  const effectiveDays = [...notificationDays];
  if (minNotificationDays > 0 && !effectiveDays.some(d => d >= minNotificationDays)) {
    effectiveDays.push(minNotificationDays);
  }
  
  // Calculate notification dates
  return effectiveDays
    .filter(days => days > 0)
    .sort((a, b) => b - a) // Sort descending to get earliest notification date first when mapped
    .map(days => {
      return balloonDate.subtract(days, 'day'); // Use Dayjs subtract
    })
    .sort((a, b) => a.valueOf() - b.valueOf()); // Sort ascending (earliest date first) for the final output
}