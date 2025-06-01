import { Big } from 'big.js';

/**
 * Balloon payment detection configuration
 */
export interface BalloonDetectionConfig {
  enabled: boolean;
  percentageThreshold: number; // e.g., 50 = 50% above regular payment
  absoluteThreshold: Big; // e.g., $500 above regular payment
  thresholdLogic: 'AND' | 'OR'; // How to combine thresholds
}

/**
 * Balloon payment handling strategies
 */
export type BalloonStrategy = 
  | 'ALLOW_BALLOON'      // Keep the balloon payment as-is
  | 'SPLIT_PAYMENTS'     // Distribute across multiple payments
  | 'EXTEND_CONTRACT'    // Extend loan term to reduce payment
  | 'HYBRID';            // Apply different strategies based on amount

/**
 * Configuration for split payment strategy
 */
export interface SplitPaymentConfig {
  numberOfPayments: number; // Number of payments to split across
  distributionMethod: 'EQUAL' | 'GRADUATED'; // How to distribute amount
  maxPaymentIncrease: number; // Max percentage increase per payment (e.g., 0.5 = 50%)
}

/**
 * Configuration for contract extension strategy
 */
export interface ExtendContractConfig {
  maxExtensionMonths: number; // Maximum months to extend
  targetPaymentIncrease: number; // Target payment increase percentage (e.g., 0.1 = 10%)
  requiresApproval: boolean; // Whether extension requires approval
}

/**
 * Configuration for hybrid strategy
 */
export interface HybridStrategyConfig {
  smallBalloonThreshold: Big; // Below this amount, use split payments
  largeBalloonThreshold: Big; // Above this amount, use extension
  // Between thresholds: offer borrower choice
}

/**
 * Balloon strategy configuration based on strategy type
 */
export type BalloonStrategyConfig = 
  | { strategy: 'ALLOW_BALLOON' }
  | { strategy: 'SPLIT_PAYMENTS'; config: SplitPaymentConfig }
  | { strategy: 'EXTEND_CONTRACT'; config: ExtendContractConfig }
  | { strategy: 'HYBRID'; config: HybridStrategyConfig };

/**
 * Complete balloon payment configuration for a loan
 */
export interface LoanBalloonConfig {
  // Detection settings
  detection: BalloonDetectionConfig;
  
  // Handling strategy
  handling: BalloonStrategyConfig;
  
  // Notification settings
  notificationDays: number[]; // Days before balloon to notify (e.g., [180, 90, 30])
  
  // Audit requirements
  audit: {
    requiresApproval: boolean;
    approvalLevel: 'AUTOMATIC' | 'SUPERVISOR' | 'UNDERWRITING';
    documentationRequired: string[];
  };
}

/**
 * Result of balloon payment detection
 */
import { Dayjs } from 'dayjs'; // Import Dayjs

export interface BalloonDetectionResult {
  detected: boolean;
  payment?: {
    paymentNumber: number;
    dueDate: Dayjs; // Changed from Date
    amount: Big;
    regularPaymentAmount: Big;
  };
  exceedsRegularBy?: {
    percentage: Big; // Percentage above regular payment
    absolute: Big; // Dollar amount above regular payment
  };
  meetsThreshold?: {
    percentage: boolean;
    absolute: boolean;
    combined: boolean; // Based on thresholdLogic
  };
}

/**
 * Balloon payment notification schedule
 */
export interface BalloonNotification {
  scheduledDate: Dayjs; // Changed from Date
  daysBefore: number;
  channel: 'EMAIL' | 'MAIL' | 'SMS' | 'PORTAL' | 'ALL';
  template: string;
  sent: boolean;
  sentDate?: Dayjs; // Changed from Date
  deliveryStatus?: 'DELIVERED' | 'FAILED' | 'PENDING';
}

/**
 * System-wide balloon payment defaults
 */
export interface SystemBalloonDefaults {
  // Default detection thresholds
  defaultPercentageThreshold: number;
  defaultAbsoluteThreshold: Big;
  defaultThresholdLogic: 'AND' | 'OR';
  
  // Default handling
  defaultStrategy: BalloonStrategy;
  
  // Compliance limits
  maxBalloonPercentage: number; // Max percentage above regular payment
  maxExtensionMonths: number; // Max months for extension
  
  // State-specific overrides
  stateOverrides: {
    [stateCode: string]: {
      maxBalloonPercentage?: number;
      maxBalloonAmount?: Big;
      requiresWrittenConsent?: boolean;
      prohibitedLoanTypes?: string[];
      minNotificationDays?: number;
    };
  };
}