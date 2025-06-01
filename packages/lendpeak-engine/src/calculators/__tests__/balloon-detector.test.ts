import Big from 'big.js';
import { 
  detectBalloonPayments, 
  isPaymentBalloon,
  findLargestBalloonPayment,
  validateBalloonCompliance,
  calculateBalloonNotificationSchedule,
  DEFAULT_BALLOON_CONFIG
} from '../balloon-detector';
import { BalloonDetectionConfig } from '../../types/balloon-payment-types';
import { AmortizationSchedule, ScheduledPayment } from '../../types/payment-types';
import { parseDate } from '../../utils/date-utils'; // Import parseDate
import { Dayjs } from 'dayjs'; // Import Dayjs

describe('Balloon Payment Detection', () => {
  const createTestPayment = (
    paymentNumber: number,
    principal: number,
    interest: number,
    dueDate: Dayjs = parseDate('2024-01-01') // Changed to Dayjs and use parseDate
  ): ScheduledPayment => ({
    paymentNumber,
    dueDate, // Now Dayjs
    principal: new Big(principal),
    interest: new Big(interest),
    beginningBalance: new Big(0),
    endingBalance: new Big(0)
  });

  const defaultConfig: BalloonDetectionConfig = {
    enabled: true,
    percentageThreshold: 50,
    absoluteThreshold: new Big(500),
    thresholdLogic: 'OR'
  };

  describe('isPaymentBalloon', () => {
    it('should detect balloon payment exceeding percentage threshold', () => {
      const payment = new Big(1500);
      const regularPayment = new Big(1000);
      
      const result = isPaymentBalloon(payment, regularPayment, defaultConfig);
      
      expect(result.isBalloon).toBe(true);
      expect(result.exceedsBy.percentage.toNumber()).toBeCloseTo(50);
      expect(result.exceedsBy.absolute.toNumber()).toBe(500);
    });

    it('should detect balloon payment exceeding absolute threshold', () => {
      const payment = new Big(1600);
      const regularPayment = new Big(1000);
      
      const result = isPaymentBalloon(payment, regularPayment, defaultConfig);
      
      expect(result.isBalloon).toBe(true);
      expect(result.exceedsBy.absolute.toNumber()).toBe(600);
    });

    it('should not detect small increases as balloon', () => {
      const payment = new Big(1100);
      const regularPayment = new Big(1000);
      
      const result = isPaymentBalloon(payment, regularPayment, defaultConfig);
      
      expect(result.isBalloon).toBe(false);
      expect(result.exceedsBy.percentage.toNumber()).toBeCloseTo(10);
      expect(result.exceedsBy.absolute.toNumber()).toBe(100);
    });

    it('should handle AND logic correctly', () => {
      const config: BalloonDetectionConfig = {
        ...defaultConfig,
        thresholdLogic: 'AND'
      };
      
      // Payment that meets percentage but not absolute
      const payment1 = new Big(1400); // 40% increase, $400 absolute
      const regularPayment = new Big(1000);
      
      const result1 = isPaymentBalloon(payment1, regularPayment, {
        ...config,
        percentageThreshold: 30,
        absoluteThreshold: new Big(500)
      });
      
      expect(result1.isBalloon).toBe(false);
      
      // Payment that meets both thresholds
      const payment2 = new Big(1600); // 60% increase, $600 absolute
      const result2 = isPaymentBalloon(payment2, regularPayment, config);
      
      expect(result2.isBalloon).toBe(true);
    });
  });

  describe('detectBalloonPayments', () => {
    it('should detect multiple balloon payments in schedule', () => {
      const schedule: AmortizationSchedule = {
        payments: [
          createTestPayment(1, 200, 400), // $600 payment
          createTestPayment(2, 200, 400), // $600 payment
          createTestPayment(3, 200, 400), // $600 payment
          createTestPayment(4, 1000, 400), // $1400 payment - balloon
          createTestPayment(5, 200, 400), // $600 payment
          createTestPayment(6, 5000, 400), // $5400 payment - balloon
        ],
        totalPayments: 6,
        totalInterest: new Big(2400),
        totalPrincipal: new Big(6800)
      };
      
      const results = detectBalloonPayments(schedule, defaultConfig);
      
      expect(results).toHaveLength(2);
      expect(results[0].payment?.paymentNumber).toBe(4);
      expect(results[1].payment?.paymentNumber).toBe(6);
    });

    it('should handle disabled detection', () => {
      const schedule: AmortizationSchedule = {
        payments: [
          createTestPayment(1, 200, 400),
          createTestPayment(2, 5000, 400), // Would be balloon if enabled
        ],
        totalPayments: 2,
        totalInterest: new Big(800),
        totalPrincipal: new Big(5200)
      };
      
      const config: BalloonDetectionConfig = {
        ...defaultConfig,
        enabled: false
      };
      
      const results = detectBalloonPayments(schedule, config);
      
      expect(results).toHaveLength(0);
    });

    it('should calculate regular payment as median', () => {
      const schedule: AmortizationSchedule = {
        payments: [
          createTestPayment(1, 190, 410), // $600
          createTestPayment(2, 195, 405), // $600
          createTestPayment(3, 200, 400), // $600
          createTestPayment(4, 205, 395), // $600
          createTestPayment(5, 210, 390), // $600
          createTestPayment(6, 5000, 350), // $5350 - balloon
        ],
        totalPayments: 6,
        totalInterest: new Big(2350),
        totalPrincipal: new Big(6000)
      };
      
      const results = detectBalloonPayments(schedule, defaultConfig);
      
      expect(results).toHaveLength(1);
      expect(results[0].payment?.regularPaymentAmount.toNumber()).toBe(600);
    });
  });

  describe('findLargestBalloonPayment', () => {
    it('should find the largest balloon payment', () => {
      const schedule: AmortizationSchedule = {
        payments: [
          createTestPayment(1, 200, 400), // $600
          createTestPayment(2, 1000, 400), // $1400 - small balloon
          createTestPayment(3, 200, 400), // $600
          createTestPayment(4, 5000, 400), // $5400 - large balloon
        ],
        totalPayments: 4,
        totalInterest: new Big(1600),
        totalPrincipal: new Big(6400)
      };
      
      const result = findLargestBalloonPayment(schedule, defaultConfig);
      
      expect(result).not.toBeNull();
      expect(result?.payment?.paymentNumber).toBe(4);
      expect(result?.payment?.amount.toNumber()).toBe(5400);
    });

    it('should return null if no balloon payments', () => {
      const schedule: AmortizationSchedule = {
        payments: [
          createTestPayment(1, 200, 400),
          createTestPayment(2, 200, 400),
          createTestPayment(3, 200, 400),
        ],
        totalPayments: 3,
        totalInterest: new Big(1200),
        totalPrincipal: new Big(600)
      };
      
      const result = findLargestBalloonPayment(schedule, defaultConfig);
      
      expect(result).toBeNull();
    });
  });

  describe('validateBalloonCompliance', () => {
    it('should validate balloon within system limits', () => {
      const balloon = {
        detected: true,
        payment: {
          paymentNumber: 12,
          dueDate: parseDate(new Date().toISOString()), // Changed to Dayjs
          amount: new Big(1800),
          regularPaymentAmount: new Big(1000)
        },
        exceedsRegularBy: {
          percentage: new Big(80),
          absolute: new Big(800)
        }
      };
      
      const result = validateBalloonCompliance(balloon, 'FL', 'CONVENTIONAL');
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect system-wide violations', () => {
      const balloon = {
        detected: true,
        payment: {
          paymentNumber: 12,
          dueDate: parseDate(new Date().toISOString()), // Changed to Dayjs
          amount: new Big(3500),
          regularPaymentAmount: new Big(1000)
        },
        exceedsRegularBy: {
          percentage: new Big(250), // Exceeds 200% max
          absolute: new Big(2500)
        }
      };
      
      const result = validateBalloonCompliance(balloon, 'FL', 'CONVENTIONAL');
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain(
        'Balloon payment exceeds maximum allowed percentage of 200%'
      );
    });

    it('should detect state-specific violations', () => {
      const balloon = {
        detected: true,
        payment: {
          paymentNumber: 12,
          dueDate: parseDate(new Date().toISOString()), // Changed to Dayjs
          amount: new Big(2000),
          regularPaymentAmount: new Big(1000)
        },
        exceedsRegularBy: {
          percentage: new Big(100),
          absolute: new Big(1000)
        }
      };
      
      // California has 150% max
      const result = validateBalloonCompliance(balloon, 'CA', 'CONVENTIONAL');
      
      expect(result.compliant).toBe(true);
      
      // But if it was higher...
      const largeBalloon = {
        ...balloon,
        payment: {
          ...balloon.payment,
          amount: new Big(2600)
        },
        exceedsRegularBy: {
          percentage: new Big(160),
          absolute: new Big(1600)
        }
      };
      
      const result2 = validateBalloonCompliance(largeBalloon, 'CA', 'CONVENTIONAL');
      
      expect(result2.compliant).toBe(false);
      expect(result2.violations).toContain(
        'Balloon payment exceeds CA maximum of 150%'
      );
    });

    it('should detect prohibited loan types', () => {
      const balloon = {
        detected: true,
        payment: {
          paymentNumber: 12,
          dueDate: parseDate(new Date().toISOString()), // Changed to Dayjs
          amount: new Big(1500),
          regularPaymentAmount: new Big(1000)
        },
        exceedsRegularBy: {
          percentage: new Big(50),
          absolute: new Big(500)
        }
      };
      
      // Texas prohibits balloon payments for home equity loans
      const result = validateBalloonCompliance(balloon, 'TX', 'HOME_EQUITY');
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain(
        'Balloon payments are prohibited for HOME_EQUITY loans in TX'
      );
    });
  });

  describe('calculateBalloonNotificationSchedule', () => {
    it('should calculate notification dates', () => {
      const balloonDate = parseDate('2024-12-31'); // Changed to Dayjs
      const notificationDays = [180, 90, 30, 15];
      
      const dates = calculateBalloonNotificationSchedule(
        balloonDate,
        notificationDays
      );
      
      expect(dates).toHaveLength(4);
      
      // Check days difference instead of exact dates to avoid timezone issues
      const daysDiffs = dates.map(d => 
        // Math.round((balloonDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) // Old Date logic
        Math.round(balloonDate.diff(d, 'day', true)) // Dayjs diff logic (true for float)
      );
      
      expect(daysDiffs[0]).toBe(180);
      expect(daysDiffs[1]).toBe(90);
      expect(daysDiffs[2]).toBe(30);
      expect(daysDiffs[3]).toBe(15);
    });

    it('should include state minimum notification days', () => {
      const balloonDate = parseDate('2024-12-31'); // Changed to Dayjs
      const notificationDays = [30, 15]; // Missing CA's 90-day requirement
      
      const dates = calculateBalloonNotificationSchedule(
        balloonDate,
        notificationDays,
        'CA'
      );
      
      expect(dates).toHaveLength(3);
      expect(dates.some(d => {
        const daysBefore = Math.round(
          // (balloonDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) // Old Date logic
          balloonDate.diff(d, 'day', true) // Dayjs diff logic
        );
        return daysBefore === 90;
      })).toBe(true);
    });

    it('should sort notification dates properly', () => {
      const balloonDate = parseDate('2024-12-31'); // Changed to Dayjs
      const notificationDays = [30, 180, 15, 90]; // Out of order
      
      const dates = calculateBalloonNotificationSchedule(
        balloonDate,
        notificationDays
      );
      
      // Should be sorted with earliest notification first
      expect(dates[0].isBefore(dates[1])).toBe(true); // Use Dayjs isBefore
      expect(dates[1].isBefore(dates[2])).toBe(true); // Use Dayjs isBefore
      expect(dates[2].isBefore(dates[3])).toBe(true); // Use Dayjs isBefore
    });
  });
});