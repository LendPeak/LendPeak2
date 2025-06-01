import { Request, Response, NextFunction } from 'express';
import { rateLimitingService, RateLimitOptions } from '../../services/rate-limiting.service';
import { logger } from '../../utils/logger';

declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: {
        remaining: number;
        resetTime: number;
        totalRequests: number;
      };
    }
  }
}

interface AdvancedRateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
  headers?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  enableDynamicLimits?: boolean;
  enableQuotas?: boolean;
  quotaPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  quotaLimit?: number;
}

/**
 * Advanced rate limiter with analytics and dynamic limits
 */
export const createAdvancedRateLimiter = (options: AdvancedRateLimiterOptions) => {
  const defaultOptions: Required<AdvancedRateLimiterOptions> = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later.',
    statusCode: 429,
    headers: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req: Request) => req.ip || 'unknown',
    onLimitReached: () => {},
    enableDynamicLimits: false,
    enableQuotas: false,
    quotaPeriod: 'daily',
    quotaLimit: 1000,
  };

  const config = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const identifier = config.keyGenerator(req);
      const userId = (req as any).user?.id || identifier;
      
      // Get rate limit options
      let rateLimitOptions: RateLimitOptions = {
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        skipSuccessfulRequests: config.skipSuccessfulRequests,
        skipFailedRequests: config.skipFailedRequests,
      };

      // Use dynamic limits if enabled
      if (config.enableDynamicLimits && userId !== identifier) {
        try {
          const analytics = await rateLimitingService.getUsageAnalytics(userId);
          const dynamicLimit = await rateLimitingService.getDynamicRateLimit(userId, analytics);
          rateLimitOptions = { ...rateLimitOptions, ...dynamicLimit };
        } catch (error) {
          logger.warn('Failed to get dynamic rate limit, using default:', error);
        }
      }

      // Check rate limit
      const rateLimitResult = await rateLimitingService.checkRateLimit(
        identifier,
        'api',
        rateLimitOptions,
      );

      // Check quota if enabled
      if (config.enableQuotas && userId !== identifier) {
        const quotaResult = await rateLimitingService.checkQuota(userId, 'api', {
          limit: config.quotaLimit,
          period: config.quotaPeriod,
        });

        if (!quotaResult.allowed) {
          if (config.headers) {
            res.set({
              'X-RateLimit-Limit': config.quotaLimit.toString(),
              'X-RateLimit-Remaining': quotaResult.remaining.toString(),
              'X-RateLimit-Reset': new Date(quotaResult.resetTime).toISOString(),
              'X-RateLimit-Type': 'quota',
            });
          }

          res.status(429).json({
            error: {
              code: 'QUOTA_EXCEEDED',
              message: 'API quota exceeded for this period',
              quotaLimit: config.quotaLimit,
              quotaPeriod: config.quotaPeriod,
              resetTime: quotaResult.resetTime,
            },
          });
          return;
        }
      }

      // Set rate limit headers
      if (config.headers) {
        res.set({
          'X-RateLimit-Limit': rateLimitOptions.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'X-RateLimit-Window': (rateLimitOptions.windowMs / 1000).toString(),
        });
      }

      // Attach rate limit info to request
      req.rateLimitInfo = {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
        totalRequests: rateLimitResult.totalRequests,
      };

      if (!rateLimitResult.allowed) {
        // Call custom handler if provided
        if (config.onLimitReached) {
          config.onLimitReached(req, res);
        }

        res.status(config.statusCode).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: config.message,
            rateLimitInfo: {
              limit: rateLimitOptions.maxRequests,
              remaining: rateLimitResult.remaining,
              resetTime: rateLimitResult.resetTime,
              windowMs: rateLimitOptions.windowMs,
            },
          },
        });
        return;
      }

      // Track response time and status for analytics
      const originalSend = res.send;
      res.send = function(body) {
        const responseTime = Date.now() - startTime;
        
        // Track API usage asynchronously
        setImmediate(async () => {
          try {
            await rateLimitingService.trackAPIUsage(
              userId,
              req.path,
              req.method,
              res.statusCode,
              responseTime,
            );

            // Get analytics and check for abuse patterns
            if (userId !== identifier) {
              const analytics = await rateLimitingService.getUsageAnalytics(userId);
              await rateLimitingService.checkThresholds(userId, analytics);
              
              // Check for abuse patterns periodically
              if (Math.random() < 0.1) { // 10% chance to check
                const abusePatterns = await rateLimitingService.detectAbusePatterns(userId, analytics);
                if (abusePatterns.length > 0) {
                  logger.warn(`Potential abuse detected for user ${userId}:`, abusePatterns);
                }
              }
            }
          } catch (error) {
            logger.error('Failed to track API usage:', error);
          }
        });

        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Rate limiter middleware error:', error);
      // Fail open - allow request if rate limiting fails
      next();
    }
  };
};

/**
 * Preset rate limiters for different scenarios
 */
export const rateLimitPresets = {
  // Strict rate limiting for authentication endpoints
  auth: createAdvancedRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later.',
  }),

  // API rate limiting with quotas
  api: createAdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    enableDynamicLimits: true,
    enableQuotas: true,
    quotaPeriod: 'daily',
    quotaLimit: 10000,
  }),

  // Relaxed rate limiting for file uploads
  upload: createAdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    skipSuccessfulRequests: true,
  }),

  // Aggressive rate limiting for expensive operations
  expensive: createAdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    enableDynamicLimits: true,
  }),

  // Basic rate limiting for public endpoints
  public: createAdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
  }),
};

/**
 * IP-based rate limiter (fallback for unauthenticated requests)
 */
export const ipRateLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000,
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

/**
 * User-based rate limiter
 */
export const userRateLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req: Request) => (req as any).user?.id || req.ip || 'unknown',
  enableDynamicLimits: true,
  enableQuotas: true,
});

/**
 * Middleware to expose rate limiting analytics
 */
export const rateLimitAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  
  if (userId && req.path === '/api/v1/analytics/rate-limits') {
    try {
      const analytics = await rateLimitingService.getUsageAnalytics(userId);
      res.json({
        data: analytics,
        timestamp: new Date(),
      });
      return;
    } catch (error) {
      logger.error('Failed to get rate limit analytics:', error);
      res.status(500).json({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to retrieve rate limit analytics',
        },
      });
      return;
    }
  }
  
  next();
};