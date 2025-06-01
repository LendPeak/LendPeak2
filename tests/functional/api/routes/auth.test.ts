import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../../src/api';
import { UserModel } from '../../../src/schemas/user.schema';
import { UserActivityModel } from '../../../src/schemas/user-activity.schema';
import { UserRole, UserStatus } from '../../../src/models/user.model';
import { config } from '../../../src/config';
import jwt from 'jsonwebtoken';

describe('Auth Routes', () => {
  let testUser: any;
  let authTokens: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    await mongoose.connect(config.database.uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
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

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'NewPassword123!',
        firstName: 'New',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
      expect(response.body.data.user.lastName).toBe(userData.lastName);
      expect(response.body.data.user.roles).toContain(UserRole.VIEWER);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('email');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('password');
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          username: 'anotheruser',
          password: 'TestPassword123!',
          firstName: 'Another',
          lastName: 'User',
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'another@example.com',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Another',
          lastName: 'User',
        })
        .expect(409);

      expect(response.body.error.code).toBe('USERNAME_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      authTokens = response.body.data.tokens;
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for locked account', async () => {
      await UserModel.findByIdAndUpdate(testUser._id, { 
        status: UserStatus.LOCKED,
        failedLoginAttempts: 5,
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        })
        .expect(403);

      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'WrongPassword123!',
            })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    beforeEach(async () => {
      // Login to get tokens
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      
      authTokens = response.body.data.tokens;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: authTokens.refreshToken,
        })
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.accessToken).not.toBe(authTokens.accessToken);
      expect(response.body.data.refreshToken).not.toBe(authTokens.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser._id, type: 'refresh' },
        config.auth.jwtSecret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: expiredToken,
        })
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    beforeEach(async () => {
      // Login to get tokens
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      
      authTokens = response.body.data.tokens;
    });

    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          refreshToken: authTokens.refreshToken,
        })
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');

      // Verify refresh token is revoked
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: authTokens.refreshToken,
        })
        .expect(401);

      expect(refreshResponse.body.error.code).toBe('TOKEN_REVOKED');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: authTokens.refreshToken,
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should initiate password reset', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'test@example.com',
        })
        .expect(200);

      expect(response.body.message).toContain('password reset instructions');

      // Verify reset token was created
      const user = await UserModel.findOne({ email: 'test@example.com' });
      expect(user?.passwordResetToken).toBeDefined();
      expect(user?.passwordResetExpires).toBeDefined();
    });

    it('should not reveal non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200);

      expect(response.body.message).toContain('password reset instructions');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Initiate password reset
      const forgotResponse = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'test@example.com',
        });

      // Get reset token from database (in real app, this would be sent via email)
      const user = await UserModel.findOne({ email: 'test@example.com' });
      resetToken = user!.passwordResetToken!;
    });

    it('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!',
        })
        .expect(200);

      expect(response.body.message).toBe('Password reset successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'NewPassword123!',
        })
        .expect(200);

      expect(loginResponse.body.data.user.email).toBe('test@example.com');
    });

    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should validate new password strength', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          password: 'weak',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    beforeEach(async () => {
      // Login to get tokens
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      
      authTokens = response.body.data.tokens;
    });

    it('should change password with correct current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'NewPassword123!',
        })
        .expect(200);

      expect(loginResponse.body.data.user.email).toBe('test@example.com');
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      // Create unverified user
      const unverifiedUser = await UserModel.create({
        email: 'unverified@example.com',
        username: 'unverified',
        password: 'TestPassword123!',
        firstName: 'Unverified',
        lastName: 'User',
        emailVerified: false,
        emailVerificationToken: 'test-verification-token',
      });

      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({
          token: 'test-verification-token',
        })
        .expect(200);

      expect(response.body.message).toBe('Email verified successfully');

      // Verify email is marked as verified
      const user = await UserModel.findById(unverifiedUser._id);
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerificationToken).toBeUndefined();
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({
          token: 'invalid-token',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    beforeEach(async () => {
      // Login to get tokens
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      
      authTokens = response.body.data.tokens;
    });

    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.firstName).toBe('Test');
      expect(response.body.data.lastName).toBe('User');
      expect(response.body.data.roles).toContain(UserRole.VIEWER);
      expect(response.body.data.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});