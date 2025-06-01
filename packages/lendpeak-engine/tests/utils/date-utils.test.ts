import dayjs from 'dayjs';
import {
  calculateDayCount,
  getDayCountDenominator,
  isLeapYear,
  addMonthsWithEndOfMonth,
  getNextPaymentDate,
  calculateNumberOfPayments,
  parseDate,
  formatDate,
} from '../../src/utils/date-utils';

describe('Date Utils', () => {
  describe('calculateDayCount', () => {
    it('should calculate 30/360 day count correctly', () => {
      const start = dayjs('2024-01-01');
      const end = dayjs('2024-01-31');
      expect(calculateDayCount(start, end, '30/360')).toBe(30);
      
      const start2 = dayjs('2024-01-31');
      const end2 = dayjs('2024-02-29');
      expect(calculateDayCount(start2, end2, '30/360')).toBe(29); // 30/360 treats 31st as 30th
      
      const start3 = dayjs('2024-01-15');
      const end3 = dayjs('2024-02-15');
      expect(calculateDayCount(start3, end3, '30/360')).toBe(30);
    });

    it('should calculate actual day count correctly', () => {
      const start = dayjs('2024-01-01');
      const end = dayjs('2024-01-31');
      expect(calculateDayCount(start, end, 'actual/360')).toBe(30);
      expect(calculateDayCount(start, end, 'actual/365')).toBe(30);
      
      // Leap year February
      const start2 = dayjs('2024-02-01');
      const end2 = dayjs('2024-03-01');
      expect(calculateDayCount(start2, end2, 'actual/actual')).toBe(29);
    });

    it('should handle year boundaries', () => {
      const start = dayjs('2023-12-15');
      const end = dayjs('2024-01-15');
      expect(calculateDayCount(start, end, '30/360')).toBe(30);
      expect(calculateDayCount(start, end, 'actual/365')).toBe(31);
    });
  });

  describe('getDayCountDenominator', () => {
    it('should return correct denominators', () => {
      expect(getDayCountDenominator('30/360')).toBe(360);
      expect(getDayCountDenominator('actual/360')).toBe(360);
      expect(getDayCountDenominator('actual/365')).toBe(365);
      expect(getDayCountDenominator('actual/actual', 2024)).toBe(366); // Leap year
      expect(getDayCountDenominator('actual/actual', 2023)).toBe(365); // Non-leap year
    });
  });

  describe('isLeapYear', () => {
    it('should identify leap years correctly', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(1900)).toBe(false); // Divisible by 100 but not 400
      expect(isLeapYear(2100)).toBe(false);
    });
  });

  describe('addMonthsWithEndOfMonth', () => {
    it('should handle end of month correctly', () => {
      const jan31 = dayjs('2024-01-31');
      const feb29 = addMonthsWithEndOfMonth(jan31, 1);
      expect(feb29.format('YYYY-MM-DD')).toBe('2024-02-29'); // Leap year
      
      const mar31 = addMonthsWithEndOfMonth(feb29, 1);
      expect(mar31.format('YYYY-MM-DD')).toBe('2024-03-31');
    });

    it('should handle mid-month dates normally', () => {
      const jan15 = dayjs('2024-01-15');
      const feb15 = addMonthsWithEndOfMonth(jan15, 1);
      expect(feb15.format('YYYY-MM-DD')).toBe('2024-02-15');
    });

    it('should handle multiple months', () => {
      const jan31 = dayjs('2024-01-31');
      const apr30 = addMonthsWithEndOfMonth(jan31, 3);
      expect(apr30.format('YYYY-MM-DD')).toBe('2024-04-30');
    });
  });

  describe('getNextPaymentDate', () => {
    it('should calculate monthly payments correctly', () => {
      const start = dayjs('2024-01-15');
      const next = getNextPaymentDate(start, 'monthly');
      expect(next.format('YYYY-MM-DD')).toBe('2024-02-15');
    });

    it('should calculate semi-monthly payments correctly', () => {
      const firstHalf = dayjs('2024-01-10');
      const next1 = getNextPaymentDate(firstHalf, 'semi-monthly');
      expect(next1.format('YYYY-MM-DD')).toBe('2024-01-15');
      
      const secondHalf = dayjs('2024-01-20');
      const next2 = getNextPaymentDate(secondHalf, 'semi-monthly');
      expect(next2.format('YYYY-MM-DD')).toBe('2024-02-01');
    });

    it('should calculate bi-weekly payments correctly', () => {
      const start = dayjs('2024-01-01');
      const next = getNextPaymentDate(start, 'bi-weekly');
      expect(next.format('YYYY-MM-DD')).toBe('2024-01-15');
    });

    it('should calculate other frequencies correctly', () => {
      const start = dayjs('2024-01-01');
      
      expect(getNextPaymentDate(start, 'weekly').format('YYYY-MM-DD')).toBe('2024-01-08');
      expect(getNextPaymentDate(start, 'quarterly').format('YYYY-MM-DD')).toBe('2024-04-01');
      expect(getNextPaymentDate(start, 'semi-annually').format('YYYY-MM-DD')).toBe('2024-07-01');
      expect(getNextPaymentDate(start, 'annually').format('YYYY-MM-DD')).toBe('2025-01-01');
    });
  });

  describe('calculateNumberOfPayments', () => {
    it('should calculate payment counts correctly', () => {
      expect(calculateNumberOfPayments(12, 'monthly')).toBe(12);
      expect(calculateNumberOfPayments(12, 'semi-monthly')).toBe(24);
      expect(calculateNumberOfPayments(12, 'quarterly')).toBe(4);
      expect(calculateNumberOfPayments(12, 'semi-annually')).toBe(2);
      expect(calculateNumberOfPayments(12, 'annually')).toBe(1);
      
      // Approximate for non-monthly frequencies
      expect(calculateNumberOfPayments(12, 'bi-weekly')).toBeCloseTo(26, 0);
      expect(calculateNumberOfPayments(12, 'weekly')).toBeCloseTo(52, 0);
    });
  });

  describe('parseDate and formatDate', () => {
    it('should parse dates correctly', () => {
      const date1 = parseDate('2024-01-15');
      expect(date1.format('YYYY-MM-DD')).toBe('2024-01-15');
      
      const date2 = parseDate('01/15/2024', 'MM/DD/YYYY');
      expect(date2.format('YYYY-MM-DD')).toBe('2024-01-15');
    });

    it('should format dates correctly', () => {
      const date = dayjs('2024-01-15');
      
      expect(formatDate(date)).toBe('2024-01-15');
      expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2024');
      expect(formatDate(date, 'MMM D, YYYY')).toBe('Jan 15, 2024');
      expect(formatDate(date, 'DD-MM-YYYY')).toBe('15-01-2024');
    });
  });
});