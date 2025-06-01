import rateLimit from 'express-rate-limit';
import { config } from '../../config';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  skipSuccessfulRequests: true,
});

// Rate limiter for creation endpoints
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 creates per hour
  message: {
    error: {
      code: 'CREATE_RATE_LIMIT_EXCEEDED',
      message: 'Too many creation requests, please try again later',
    },
  },
});

// Dynamic rate limiter based on user role
export const dynamicLimiter = (req: any, res: any): number => {
  if (req.user?.roles?.includes('admin')) {
    return 1000; // Higher limit for admins
  }
  if (req.user?.roles?.includes('api')) {
    return 500; // Medium limit for API users
  }
  return 100; // Default limit
};

export const roleLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: dynamicLimiter,
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  standardHeaders: true,
  legacyHeaders: false,
});