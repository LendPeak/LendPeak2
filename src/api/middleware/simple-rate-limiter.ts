import { Request, Response, NextFunction } from 'express';

// Simple no-op rate limiter for development
// In production, use API Gateway or similar service for rate limiting

export const apiLimiter = (req: Request, res: Response, next: NextFunction) => {
  // No rate limiting in development
  next();
};

export const ipRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // No rate limiting in development
  next();
};

export const authLimiter = (req: Request, res: Response, next: NextFunction) => {
  // No rate limiting in development
  next();
};

export const rateLimitAnalytics = (req: Request, res: Response, next: NextFunction) => {
  // No analytics collection in development
  next();
};