import { Document } from 'mongoose';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  LOAN_OFFICER = 'LOAN_OFFICER',
  UNDERWRITER = 'UNDERWRITER',
  SERVICER = 'SERVICER',
  COLLECTOR = 'COLLECTOR',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
  API_USER = 'API_USER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
}

export interface IUser extends Document {
  // Basic info
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  
  // Authentication
  roles: UserRole[];
  status: UserStatus;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  
  // Security
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordChangedAt?: Date;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  
  // Session management
  refreshTokens: IRefreshToken[];
  lastLoginAt?: Date;
  lastLoginIp?: string;
  
  // Permissions
  permissions: string[];
  departments?: string[];
  allowedLoanTypes?: string[];
  maxLoanAmount?: number;
  
  // Audit
  createdBy?: string;
  updatedBy?: string;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  createPasswordResetToken(): string;
  createEmailVerificationToken(): string;
  hasPermission(permission: string): boolean;
  hasRole(role: UserRole): boolean;
  isAccountLocked(): boolean;
  incrementFailedLogins(): Promise<void>;
  resetFailedLogins(): Promise<void>;
}

export interface IRefreshToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  deviceInfo?: string;
  ipAddress?: string;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
}

export interface IUserActivity {
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// Permission definitions
export const PERMISSIONS = {
  // Loan permissions
  LOAN_CREATE: 'loan:create',
  LOAN_VIEW: 'loan:view',
  LOAN_UPDATE: 'loan:update',
  LOAN_DELETE: 'loan:delete',
  LOAN_APPROVE: 'loan:approve',
  LOAN_DISBURSE: 'loan:disburse',
  
  // Payment permissions
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_REVERSE: 'payment:reverse',
  PAYMENT_WAIVE: 'payment:waive',
  
  // User permissions
  USER_CREATE: 'user:create',
  USER_VIEW: 'user:view',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ASSIGN_ROLES: 'user:assign_roles',
  
  // Report permissions
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',
  REPORT_SCHEDULE: 'report:schedule',
  
  // System permissions
  SYSTEM_CONFIGURE: 'system:configure',
  SYSTEM_AUDIT: 'system:audit',
  SYSTEM_BACKUP: 'system:backup',
} as const;

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(PERMISSIONS),
  
  [UserRole.ADMIN]: [
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.LOAN_UPDATE,
    PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_REVERSE,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
  ],
  
  [UserRole.LOAN_OFFICER]: [
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.LOAN_UPDATE,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  
  [UserRole.UNDERWRITER]: [
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.REPORT_VIEW,
  ],
  
  [UserRole.SERVICER]: [
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  
  [UserRole.COLLECTOR]: [
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
  ],
  
  [UserRole.AUDITOR]: [
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SYSTEM_AUDIT,
  ],
  
  [UserRole.VIEWER]: [
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  
  [UserRole.API_USER]: [
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_UPDATE,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_VIEW,
  ],
};