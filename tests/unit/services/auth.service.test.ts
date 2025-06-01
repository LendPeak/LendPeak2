import mongoose from 'mongoose';
import crypto from 'crypto';
import { AuthService } from '../../../src/services/auth.service';
import { UserModel } from '../../../src/schemas/user.schema';
import { UserActivityModel } from '../../../src/schemas/user-activity.schema';
import { UserRole, UserStatus } from '../../../src/models/user.model';
import { config } from '../../../src/config';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let testUser: any;
  
  beforeAll(async () => {
    await mongoose.connect(config.mongodb.uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    authService = new AuthService();
    
    // Create test user
    testUser = await UserModel.create({
      email: 'test@example.com',
      username: 'testuser',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      roles: [UserRole.VIEWER],
      status: UserStatus.ACTIVE,
    });
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
    await UserActivityModel.deleteMany({});
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      const result = await authService.login(credentials);

      expect(result.user.email).toBe(credentials.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      
      // Verify tokens
      const decoded = jwt.verify(result.tokens.accessToken, config.auth.jwtSecret) as any;
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe(result.user.email);
    });

    it('should reject login with invalid password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      await expect(authService.login(credentials))
        .rejects.toThrow('Invalid credentials');
        
      // Check failed login count increased
      const user = await UserModel.findOne({ email: credentials.email });
      expect(user?.failedLoginAttempts).toBe(1);
    });

    it('should reject login with non-existent email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      await expect(authService.login(credentials))
        .rejects.toThrow('Invalid credentials');
    });

    it('should lock account after max failed attempts', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      // Attempt to login with wrong password multiple times
      for (let i = 0; i < 5; i++) {
        await expect(authService.login(credentials))
          .rejects.toThrow();
      }

      // Check account is locked
      const user = await UserModel.findOne({ email: credentials.email });
      expect(user?.status).toBe(UserStatus.LOCKED);
      expect(user?.failedLoginAttempts).toBe(5);
    });

    it('should reject login for inactive user', async () => {
      await UserModel.findByIdAndUpdate(testUser._id, { status: UserStatus.INACTIVE });

      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      await expect(authService.login(credentials))
        .rejects.toThrow('Account is inactive');
    });

    it('should reject login for suspended user', async () => {
      await UserModel.findByIdAndUpdate(testUser._id, { status: UserStatus.SUSPENDED });

      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      await expect(authService.login(credentials))
        .rejects.toThrow('Account is suspended');
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // First login to get tokens
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      // Refresh tokens
      const refreshResult = await authService.refreshToken(
        loginResult.tokens.refreshToken,
        '127.0.0.1',
        'Test Agent'
      );

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.accessToken).not.toBe(loginResult.tokens.accessToken);
      expect(refreshResult.refreshToken).not.toBe(loginResult.tokens.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-token', '127.0.0.1', 'Test Agent'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      // Create expired refresh token
      const expiredToken = jwt.sign(
        { userId: testUser._id, type: 'refresh' },
        config.auth.jwtSecret,
        { expiresIn: '-1h' }
      );

      await expect(authService.refreshToken(expiredToken, '127.0.0.1', 'Test Agent'))
        .rejects.toThrow('Refresh token expired');
    });
  });

  describe('logout', () => {
    it('should logout user and revoke refresh token', async () => {
      // Login first
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      // Logout
      await authService.logout(
        testUser._id.toString(),
        loginResult.tokens.refreshToken,
        '127.0.0.1',
        'Test Agent'
      );

      // Verify token is revoked
      const user = await UserModel.findById(testUser._id);
      const token = user?.refreshTokens.find(t => t.token === loginResult.tokens.refreshToken);
      expect(token?.isRevoked).toBe(true);

      // Verify can't use revoked token
      await expect(authService.refreshToken(
        loginResult.tokens.refreshToken,
        '127.0.0.1',
        'Test Agent'
      )).rejects.toThrow('Refresh token revoked');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      // Create user with reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      await UserModel.findByIdAndUpdate(testUser._id, {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
      });

      // Reset password
      await authService.resetPassword(resetToken, 'NewPassword123!', '127.0.0.1', 'Test Agent');

      // Verify can login with new password
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'NewPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      expect(loginResult.user.email).toBe('test@example.com');
    });

    it('should reject invalid reset token', async () => {
      await expect(authService.resetPassword('invalid-token', 'NewPassword123!', '127.0.0.1', 'Test Agent'))
        .rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject expired reset token', async () => {
      // Create user with expired reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      await UserModel.findByIdAndUpdate(testUser._id, {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() - 3600000), // 1 hour ago
      });

      await expect(authService.resetPassword(resetToken, 'NewPassword123!', '127.0.0.1', 'Test Agent'))
        .rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all user refresh tokens', async () => {
      // Login multiple times to create multiple tokens
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        const result = await authService.login({
          email: 'test@example.com',
          password: 'TestPassword123!',
          ipAddress: `127.0.0.${i}`,
          userAgent: `Test Agent ${i}`,
        });
        tokens.push(result.tokens.refreshToken);
      }

      // Revoke all tokens
      await authService.revokeAllTokens(testUser._id.toString(), 'Security breach');

      // Verify all tokens are revoked
      for (const token of tokens) {
        await expect(authService.refreshToken(token, '127.0.0.1', 'Test Agent'))
          .rejects.toThrow('Refresh token revoked');
      }
    });
  });

  describe('activity logging', () => {
    it('should log successful login', async () => {
      await authService.login({
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      const activities = await UserActivityModel.find({ userId: testUser._id });
      const loginActivity = activities.find(a => a.action === 'LOGIN');
      
      expect(loginActivity).toBeDefined();
      expect(loginActivity?.success).toBe(true);
      expect(loginActivity?.ipAddress).toBe('127.0.0.1');
      expect(loginActivity?.userAgent).toBe('Test Agent');
    });

    it('should log failed login', async () => {
      try {
        await authService.login({
          email: 'test@example.com',
          password: 'WrongPassword123!',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        });
      } catch (error) {
        // Expected to fail
      }

      const activities = await UserActivityModel.find({ userId: testUser._id });
      const failedLogin = activities.find(a => a.action === 'LOGIN' && !a.success);
      
      expect(failedLogin).toBeDefined();
      expect(failedLogin?.metadata?.reason).toBe('Invalid password');
    });

    it('should log logout', async () => {
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'TestPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      await authService.logout(
        testUser._id.toString(), 
        loginResult.tokens.refreshToken,
        '127.0.0.1',
        'Test Agent'
      );

      const activities = await UserActivityModel.find({ userId: testUser._id });
      const logoutActivity = activities.find(a => a.action === 'LOGOUT');
      
      expect(logoutActivity).toBeDefined();
      expect(logoutActivity?.success).toBe(true);
    });
  });
});