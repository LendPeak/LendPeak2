import { Router } from 'express';
import { AuthService } from '../../services/auth.service';
import { UserModel } from '../../schemas/user.schema';
import { validateRequest } from '../middleware/validate-request';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/simple-rate-limiter';
import { asyncHandler } from '../utils/async-handler';
import { 
  loginSchema, 
  registerSchema, 
  refreshTokenSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/auth.validator';
import { UserRole, UserStatus } from '../../models/user.model';
import { logger } from '../../utils/logger';
import { getEmailService } from '../../services/email.service';

const router = Router();
const emailService = getEmailService();
const authService = new AuthService();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', validateRequest({ body: registerSchema }), asyncHandler(async (req, res) => {
  const { email, username, password, firstName, lastName, phoneNumber } = req.body;

  // Check if user already exists
  const existingUser = await UserModel.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    res.status(409).json({
      error: {
        code: 'USER_EXISTS',
        message: 'User with this email or username already exists',
      },
    });
    return;
  }

  // Create new user
  const user = await UserModel.create({
    email,
    username,
    password,
    firstName,
    lastName,
    phoneNumber,
    roles: [UserRole.VIEWER], // Default role
    status: UserStatus.ACTIVE,
    emailVerified: false,
  });

  // Generate verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save();

  // TODO: Send verification email
  // Send verification email
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  try {
    await emailService.sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      htmlBody: `
        <h1>Welcome to Our Platform!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationLink}">${verificationLink}</a>
        <p>If you did not create an account, please ignore this email.</p>
      `,
      textBody: `Welcome! Please verify your email by visiting: ${verificationLink}`,
    });
    logger.info('Verification email sent', { userId: user.id, email });
  } catch (error) {
    logger.error('Failed to send verification email', { userId: user.id, email, error });
    // Continue with registration even if email fails for now
    // In a production app, you might want to handle this more gracefully (e.g., retry, or inform user)
  }

  logger.info('User registered', { userId: user.id, email, verificationToken });

  res.status(201).json({
    message: 'User registered successfully. Please check your email to verify your account.',
    userId: user.id,
  });
}));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  try {
    const { user, tokens } = await authService.login({
      email,
      password,
      ipAddress,
      userAgent,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
      },
      tokens,
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'AUTH_FAILED',
        message: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', validateRequest({ body: refreshTokenSchema }), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  try {
    const tokens = await authService.refreshToken(refreshToken, ipAddress, userAgent);
    res.json({ tokens });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  if (req.user) {
    await authService.logout(req.user.id, refreshToken, ipAddress, userAgent);
  }

  res.json({ message: 'Logout successful' });
}));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post('/forgot-password', authLimiter, validateRequest({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
  const { email } = req.body;
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  const resetToken = await authService.requestPasswordReset(email, ipAddress, userAgent);

  // TODO: Send password reset email
  if (resetToken) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        htmlBody: `
          <h1>Password Reset Request</h1>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>If you did not request a password reset, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        `,
        textBody: `Reset your password by visiting: ${resetLink}`,
      });
      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Failed to send password reset email', { email, error });
      // Do not expose email sending failure to the client to prevent email enumeration
    }
    logger.info('Password reset requested', { email, resetToken }); // Log token for testing/dev if needed
  }

  // Always return success to prevent email enumeration
  res.json({
    message: 'If an account exists with this email, a password reset link has been sent.',
  });
}));

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', validateRequest({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  try {
    await authService.resetPassword(token, password, ipAddress, userAgent);
    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'RESET_FAILED',
        message: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password for authenticated user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password
 */
router.post('/change-password', authenticate, validateRequest({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  // Get user with password
  const user = await UserModel.findById(userId).select('+password');
  
  if (!user) {
    res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
    });
    return;
  }

  // Verify current password
  const isValid = await user.comparePassword(currentPassword);
  
  if (!isValid) {
    res.status(401).json({
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      },
    });
    return;
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Revoke all tokens
  await authService.revokeAllTokens(userId, 'Password changed');

  res.json({ message: 'Password changed successfully. Please login again.' });
}));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User info retrieved
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user!.id);
  
  if (!user) {
    res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
    });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      roles: user.roles,
      permissions: user.permissions,
      status: user.status,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  });
}));

export { router as authRouter };