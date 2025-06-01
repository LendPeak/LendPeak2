import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel } from '../schemas/user.schema';
import { UserActivityModel } from '../schemas/user-activity.schema';
import { IUser, UserStatus } from '../models/user.model';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface LoginCredentials {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export class AuthService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';
  private readonly refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000;

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: IUser; tokens: TokenPair }> {
    const { email, password, ipAddress, userAgent } = credentials;

    // Find user with password field
    const user = await UserModel.findOne({ email }).select('+password');
    
    if (!user) {
      await this.logActivity(null, 'LOGIN', false, { email }, ipAddress, userAgent, 'User not found');
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      await this.logActivity(user.id, 'LOGIN', false, { reason: 'Account locked' }, ipAddress, userAgent);
      throw new Error('Account is locked. Please try again later.');
    }

    // Check if account is active
    if (user.status !== UserStatus.ACTIVE) {
      await this.logActivity(user.id, 'LOGIN', false, { status: user.status }, ipAddress, userAgent);
      throw new Error('Account is not active');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await user.incrementFailedLogins();
      await this.logActivity(user.id, 'LOGIN', false, { reason: 'Invalid password' }, ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    // Reset failed login attempts
    await user.resetFailedLogins();

    // Update last login info
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress;
    
    // Generate tokens
    const tokens = await this.generateTokens(user);
    
    // Save refresh token
    user.refreshTokens.push({
      token: tokens.refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.refreshTokenExpiryMs),
      ipAddress,
      deviceInfo: userAgent,
      isRevoked: false,
    });
    
    // Clean up old refresh tokens (keep last 5)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    
    await user.save();
    
    // Log successful login
    await this.logActivity(user.id, 'LOGIN', true, {}, ipAddress, userAgent);
    
    // Remove sensitive data
    const userObject = user.toObject();
    const { password: _password, refreshTokens: _refreshTokens, ...safeUser } = userObject;
    
    return { user: safeUser as IUser, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.auth.jwtSecret) as { id: string };
      
      // Find user and check refresh token
      const user = await UserModel.findById(decoded.id);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Find the refresh token
      const tokenIndex = user.refreshTokens.findIndex(
        rt => rt.token === refreshToken && !rt.isRevoked && rt.expiresAt > new Date()
      );
      
      if (tokenIndex === -1) {
        await this.logActivity(user.id, 'REFRESH_TOKEN', false, { reason: 'Invalid token' }, ipAddress, userAgent);
        throw new Error('Invalid refresh token');
      }
      
      // Revoke old token
      user.refreshTokens[tokenIndex].isRevoked = true;
      user.refreshTokens[tokenIndex].revokedAt = new Date();
      user.refreshTokens[tokenIndex].revokedReason = 'Token refreshed';
      
      // Generate new tokens
      const tokens = await this.generateTokens(user);
      
      // Save new refresh token
      user.refreshTokens.push({
        token: tokens.refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.refreshTokenExpiryMs),
        ipAddress,
        deviceInfo: userAgent,
        isRevoked: false,
      });
      
      await user.save();
      
      await this.logActivity(user.id, 'REFRESH_TOKEN', true, {}, ipAddress, userAgent);
      
      return tokens;
    } catch (error) {
      logger.error('Refresh token failed', { error, refreshToken });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user and revoke tokens
   */
  async logout(userId: string, refreshToken: string, ipAddress: string, userAgent: string): Promise<void> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Revoke the refresh token
    const tokenIndex = user.refreshTokens.findIndex(rt => rt.token === refreshToken);
    
    if (tokenIndex !== -1) {
      user.refreshTokens[tokenIndex].isRevoked = true;
      user.refreshTokens[tokenIndex].revokedAt = new Date();
      user.refreshTokens[tokenIndex].revokedReason = 'User logout';
    }
    
    await user.save();
    
    await this.logActivity(userId, 'LOGOUT', true, {}, ipAddress, userAgent);
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllTokens(userId: string, reason: string): Promise<void> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Revoke all refresh tokens
    user.refreshTokens.forEach(token => {
      if (!token.isRevoked) {
        token.isRevoked = true;
        token.revokedAt = new Date();
        token.revokedReason = reason;
      }
    });
    
    await user.save();
    
    logger.info('All tokens revoked for user', { userId, reason });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: IUser): Promise<TokenPair> {
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };
    
    const accessToken = jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
    });
    
    const refreshToken = jwt.sign(
      { id: user.id },
      config.auth.jwtSecret,
      { expiresIn: this.refreshTokenExpiry }
    );
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  /**
   * Log user activity
   */
  private async logActivity(
    userId: string | null,
    action: string,
    success: boolean,
    metadata: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await UserActivityModel.create({
        userId: userId || 'anonymous',
        action,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success,
        errorMessage,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to log user activity', { error, action, userId });
    }
  }

  /**
   * Verify email verification token
   */
  async verifyEmail(token: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await UserModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });
    
    if (!user) {
      throw new Error('Invalid or expired verification token');
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    
    await user.save();
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string, ipAddress: string, userAgent: string): Promise<string> {
    const user = await UserModel.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists
      await this.logActivity(null, 'PASSWORD_RESET_REQUEST', false, { email }, ipAddress, userAgent, 'User not found');
      return '';
    }
    
    const resetToken = user.createPasswordResetToken();
    await user.save();
    
    await this.logActivity(user.id, 'PASSWORD_RESET_REQUEST', true, {}, ipAddress, userAgent);
    
    return resetToken;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string, ipAddress: string, userAgent: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });
    
    if (!user) {
      await this.logActivity(null, 'PASSWORD_RESET', false, { reason: 'Invalid token' }, ipAddress, userAgent);
      throw new Error('Invalid or expired reset token');
    }
    
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();
    
    // Revoke all tokens after password reset
    await this.revokeAllTokens(user.id, 'Password reset');
    
    await this.logActivity(user.id, 'PASSWORD_RESET', true, {}, ipAddress, userAgent);
  }
}