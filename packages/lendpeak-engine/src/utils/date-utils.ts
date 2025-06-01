import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { DayCountConvention } from '../types';

// Enable plugins
dayjs.extend(utc);
dayjs.extend(customParseFormat);

/**
 * Calculate the number of days between two dates based on day count convention
 */
export function calculateDayCount(
  startDate: Dayjs,
  endDate: Dayjs,
  convention: DayCountConvention
): number {
  switch (convention) {
    case '30/360':
      return calculate30_360DayCount(startDate, endDate);
    case 'actual/360':
    case 'actual/365':
    case 'actual/actual':
      return calculateActualDayCount(startDate, endDate);
    default:
      throw new Error(`Unsupported day count convention: ${convention}`);
  }
}

/**
 * Calculate days using 30/360 convention
 * Each month is considered to have 30 days
 */
function calculate30_360DayCount(startDate: Dayjs, endDate: Dayjs): number {
  let d1 = startDate.date();
  let d2 = endDate.date();
  
  // Adjust for 30/360 convention rules
  if (d1 === 31) {
    d1 = 30;
  }
  
  if (d2 === 31 && d1 >= 30) {
    d2 = 30;
  }
  
  const m1 = startDate.month();
  const m2 = endDate.month();
  
  const y1 = startDate.year();
  const y2 = endDate.year();
  
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/**
 * Calculate actual days between dates
 */
function calculateActualDayCount(startDate: Dayjs, endDate: Dayjs): number {
  return endDate.diff(startDate, 'day');
}

/**
 * Get the denominator for interest calculation based on day count convention
 */
export function getDayCountDenominator(
  convention: DayCountConvention,
  year?: number
): number {
  switch (convention) {
    case '30/360':
    case 'actual/360':
      return 360;
    case 'actual/365':
      return 365;
    case 'actual/actual':
      // For actual/actual, check if it's a leap year
      if (year) {
        return isLeapYear(year) ? 366 : 365;
      }
      return 365; // Default to 365 if no year provided
    default:
      throw new Error(`Unsupported day count convention: ${convention}`);
  }
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Add months to a date, handling end-of-month scenarios
 */
export function addMonthsWithEndOfMonth(date: Dayjs, months: number): Dayjs {
  const originalDay = date.date();
  const resultDate = date.add(months, 'month');
  
  // If the original date was end of month, ensure result is also end of month
  if (date.date() === date.daysInMonth()) {
    return resultDate.endOf('month').startOf('day');
  }
  
  // If the day doesn't exist in the result month (e.g., Jan 31 + 1 month)
  // dayjs automatically adjusts to the last day of the month
  return resultDate;
}

/**
 * Get the next payment date based on frequency
 */
export function getNextPaymentDate(
  currentDate: Dayjs,
  frequency: string
): Dayjs {
  switch (frequency) {
    case 'monthly':
      return addMonthsWithEndOfMonth(currentDate, 1);
    case 'semi-monthly':
      // If current date is before the 15th, next payment is on the 15th
      // If on or after the 15th, next payment is on the 1st of next month
      if (currentDate.date() < 15) {
        return currentDate.date(15);
      } else {
        return currentDate.add(1, 'month').date(1);
      }
    case 'bi-weekly':
      return currentDate.add(14, 'days');
    case 'weekly':
      return currentDate.add(7, 'days');
    case 'quarterly':
      return addMonthsWithEndOfMonth(currentDate, 3);
    case 'semi-annually':
      return addMonthsWithEndOfMonth(currentDate, 6);
    case 'annually':
      return addMonthsWithEndOfMonth(currentDate, 12);
    default:
      throw new Error(`Unsupported payment frequency: ${frequency}`);
  }
}

/**
 * Calculate the number of payments based on term and frequency
 */
export function calculateNumberOfPayments(
  termMonths: number,
  frequency: string
): number {
  switch (frequency) {
    case 'monthly':
      return termMonths;
    case 'semi-monthly':
      return termMonths * 2;
    case 'bi-weekly':
      return Math.floor((termMonths * 365.25 / 12) / 14);
    case 'weekly':
      return Math.floor((termMonths * 365.25 / 12) / 7);
    case 'quarterly':
      return Math.ceil(termMonths / 3);
    case 'semi-annually':
      return Math.ceil(termMonths / 6);
    case 'annually':
      return Math.ceil(termMonths / 12);
    default:
      throw new Error(`Unsupported payment frequency: ${frequency}`);
  }
}

/**
 * Parse a date string to Dayjs object
 */
export function parseDate(dateString: string, format?: string): Dayjs {
  if (format) {
    return dayjs(dateString, format);
  }
  return dayjs(dateString);
}

/**
 * Format a Dayjs object to string
 */
export function formatDate(date: Dayjs, format: string = 'YYYY-MM-DD'): string {
  return date.format(format);
}

/**
 * Add months to a Date object
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  
  // Handle end of month edge cases
  if (result.getDate() !== date.getDate()) {
    // If day has changed, it means we've rolled over to next month
    // Set to last day of previous month
    result.setDate(0);
  }
  
  return result;
}