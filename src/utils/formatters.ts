import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format a number as currency
 */
export const formatCurrency = (amount: number | string): string => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format a number as percentage
 */
export const formatPercentage = (value: number | string, decimals: number = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${(num * 100).toFixed(decimals)}%`;
};

/**
 * Format a date
 */
export const formatDate = (date: string | Date, formatString: string = 'MMM d, yyyy'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatString);
};

/**
 * Format a date as relative time
 */
export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format loan status
 */
export const formatLoanStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    DELINQUENT: 'Delinquent',
    DEFAULT: 'In Default',
    FORBEARANCE: 'In Forbearance',
    CLOSED: 'Closed',
    CHARGED_OFF: 'Charged Off',
  };

  return statusMap[status] || status;
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  
  return phone;
};

/**
 * Format SSN (last 4 digits only)
 */
export const formatSSN = (ssn: string): string => {
  if (!ssn || ssn.length < 4) return '****';
  return `***-**-${ssn.slice(-4)}`;
};

/**
 * Format account number (masked)
 */
export const formatAccountNumber = (accountNumber: string): string => {
  if (!accountNumber || accountNumber.length < 4) return '****';
  const lastFour = accountNumber.slice(-4);
  const masked = '*'.repeat(Math.max(0, accountNumber.length - 4));
  return masked + lastFour;
};

/**
 * Format duration in months
 */
export const formatDuration = (months: number): string => {
  if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  let result = `${years} year${years !== 1 ? 's' : ''}`;
  if (remainingMonths > 0) {
    result += ` ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  }
  
  return result;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Format credit score with rating
 */
export const formatCreditScore = (score: number): { score: string; rating: string; color: string } => {
  let rating: string;
  let color: string;

  if (score >= 800) {
    rating = 'Exceptional';
    color = 'text-green-600';
  } else if (score >= 740) {
    rating = 'Very Good';
    color = 'text-green-500';
  } else if (score >= 670) {
    rating = 'Good';
    color = 'text-yellow-600';
  } else if (score >= 580) {
    rating = 'Fair';
    color = 'text-orange-600';
  } else {
    rating = 'Poor';
    color = 'text-red-600';
  }

  return {
    score: score.toString(),
    rating,
    color,
  };
};

/**
 * Pluralize a word
 */
export const pluralize = (count: number, singular: string, plural?: string): string => {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + 's'}`;
};