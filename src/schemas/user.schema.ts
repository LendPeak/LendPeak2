import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { IUser, UserRole, UserStatus, ROLE_PERMISSIONS } from '../models/user.model';

const RefreshTokenSchema = new Schema({
  token: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  deviceInfo: String,
  ipAddress: String,
  isRevoked: {
    type: Boolean,
    default: false,
  },
  revokedAt: Date,
  revokedReason: String,
}, { _id: false });

const UserSchema = new Schema<IUser>({
  // Basic info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Don't include password by default
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  
  // Authentication
  roles: [{
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.VIEWER,
  }],
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE,
    index: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: Date,
  
  // Security
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: Date,
  passwordChangedAt: Date,
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockoutUntil: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false,
  },
  
  // Session management
  refreshTokens: [RefreshTokenSchema],
  lastLoginAt: Date,
  lastLoginIp: String,
  
  // Permissions
  permissions: [String],
  departments: [String],
  allowedLoanTypes: [String],
  maxLoanAmount: Number,
  
  // Audit
  createdBy: String,
  updatedBy: String,
  deactivatedAt: Date,
  deactivatedBy: String,
}, {
  timestamps: true,
});

// Indexes
UserSchema.index({ email: 1, status: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ 'refreshTokens.token': 1 });
UserSchema.index({ passwordResetToken: 1 });
UserSchema.index({ emailVerificationToken: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update password changed timestamp
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to set permissions based on roles
UserSchema.pre('save', function(next) {
  if (this.isModified('roles')) {
    // Combine permissions from all roles
    const allPermissions = new Set<string>();
    
    this.roles.forEach(role => {
      const rolePermissions = ROLE_PERMISSIONS[role ] || [];
      rolePermissions.forEach(permission => allPermissions.add(permission));
    });
    
    // Add any custom permissions
    this.permissions.forEach(permission => allPermissions.add(permission));
    
    this.permissions = Array.from(allPermissions);
  }
  
  next();
});

// Methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.createPasswordResetToken = function(): string {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  
  return resetToken;
};

UserSchema.methods.createEmailVerificationToken = function(): string {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return verificationToken;
};

UserSchema.methods.hasPermission = function(permission: string): boolean {
  return this.permissions.includes(permission);
};

UserSchema.methods.hasRole = function(role: UserRole): boolean {
  return this.roles.includes(role);
};

UserSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.lockoutUntil && this.lockoutUntil > new Date());
};

UserSchema.methods.incrementFailedLogins = async function(): Promise<void> {
  this.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    this.status = UserStatus.LOCKED;
  }
  
  await this.save();
};

UserSchema.methods.resetFailedLogins = async function(): Promise<void> {
  this.failedLoginAttempts = 0;
  this.lockoutUntil = undefined;
  
  if (this.status === UserStatus.LOCKED) {
    this.status = UserStatus.ACTIVE;
  }
  
  await this.save();
};

export const UserModel = model<IUser>('User', UserSchema);