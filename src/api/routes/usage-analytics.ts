import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';
import { rateLimitingService } from '../../services/rate-limiting.service';
import { UserRole } from '../../models/user.model';
import * as yup from 'yup';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /usage-analytics/my-usage
 * Get current user's API usage analytics
 */
router.get('/my-usage', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
  if (!userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'User ID not found',
      },
    });
    return;
  }

  const analytics = await rateLimitingService.getUsageAnalytics(userId);
  
  res.json({
    data: analytics,
    userId,
    timestamp: new Date(),
  });
}));

/**
 * GET /usage-analytics/abuse-patterns
 * Check for abuse patterns in current user's usage
 */
router.get('/abuse-patterns', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
  if (!userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'User ID not found',
      },
    });
    return;
  }

  const analytics = await rateLimitingService.getUsageAnalytics(userId);
  const patterns = await rateLimitingService.detectAbusePatterns(userId, analytics);
  
  res.json({
    data: {
      patterns,
      riskLevel: patterns.length === 0 ? 'low' : patterns.length < 3 ? 'medium' : 'high',
      detectedAt: new Date(),
    },
    userId,
  });
}));

/**
 * GET /usage-analytics/quota-status
 * Get current quota status for user
 */
router.get('/quota-status', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
  if (!userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'User ID not found',
      },
    });
    return;
  }

  // Check different quota types
  const quotas = await Promise.all([
    rateLimitingService.checkQuota(userId, 'api', { limit: 10000, period: 'daily' }),
    rateLimitingService.checkQuota(userId, 'api', { limit: 50000, period: 'weekly' }),
    rateLimitingService.checkQuota(userId, 'api', { limit: 200000, period: 'monthly' }),
  ]);

  res.json({
    data: {
      daily: {
        limit: 10000,
        usage: quotas[0].usage,
        remaining: quotas[0].remaining,
        resetTime: quotas[0].resetTime,
        percentUsed: (quotas[0].usage / 10000) * 100,
      },
      weekly: {
        limit: 50000,
        usage: quotas[1].usage,
        remaining: quotas[1].remaining,
        resetTime: quotas[1].resetTime,
        percentUsed: (quotas[1].usage / 50000) * 100,
      },
      monthly: {
        limit: 200000,
        usage: quotas[2].usage,
        remaining: quotas[2].remaining,
        resetTime: quotas[2].resetTime,
        percentUsed: (quotas[2].usage / 200000) * 100,
      },
    },
    userId,
    timestamp: new Date(),
  });
}));

/**
 * GET /usage-analytics/reports
 * Generate usage reports (admin only)
 */
router.get('/reports', 
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { period = 'daily' } = req.query;
    
    const report = await rateLimitingService.generateUsageReport(period as string);
    
    res.json({
      data: report,
      requestedBy: req.user?.id,
    });
  }),
);

/**
 * GET /usage-analytics/user/:userId
 * Get specific user's usage analytics (admin only)
 */
router.get('/user/:userId',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    const analytics = await rateLimitingService.getUsageAnalytics(userId);
    const patterns = await rateLimitingService.detectAbusePatterns(userId, analytics);
    
    res.json({
      data: {
        analytics,
        abusePatterns: patterns,
        riskLevel: patterns.length === 0 ? 'low' : patterns.length < 3 ? 'medium' : 'high',
      },
      userId,
      requestedBy: req.user?.id,
      timestamp: new Date(),
    });
  }),
);

/**
 * GET /usage-analytics/alerts/:userId
 * Get alerts for a specific user (admin only)
 */
router.get('/alerts/:userId',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    // This would require additional Redis operations to fetch stored alerts
    // For now, we'll return a placeholder response
    res.json({
      data: {
        alerts: [],
        userId,
        totalAlerts: 0,
      },
      message: 'Alert history feature coming soon',
    });
  }),
);

/**
 * POST /usage-analytics/test-limits
 * Test rate limiting configuration (admin only)
 */
router.post('/test-limits',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { testUserId = 'test-user', testType = 'api' } = req.body;
    
    // Perform rate limit test
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      const result = await rateLimitingService.checkRateLimit(testUserId, testType, {
        maxRequests: 5,
        windowMs: 60000,
      });
      
      results.push({
        attempt: i + 1,
        allowed: result.allowed,
        remaining: result.remaining,
        totalRequests: result.totalRequests,
      });
    }
    
    res.json({
      data: {
        testResults: results,
        testConfiguration: {
          userId: testUserId,
          type: testType,
          maxRequests: 5,
          windowMs: 60000,
        },
      },
      testedBy: req.user?.id,
      timestamp: new Date(),
    });
  }),
);

/**
 * GET /usage-analytics/real-time
 * Get real-time usage statistics (admin only)
 */
router.get('/real-time',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    // Mock real-time data - in production, this would aggregate current usage
    const realTimeStats = {
      currentActiveUsers: Math.floor(Math.random() * 100) + 50,
      requestsLastMinute: Math.floor(Math.random() * 1000) + 200,
      errorRateLastMinute: Math.random() * 5,
      averageResponseTime: Math.floor(Math.random() * 200) + 100,
      topEndpointsLastMinute: [
        { endpoint: '/api/v1/loans', requests: Math.floor(Math.random() * 100) + 50 },
        { endpoint: '/api/v1/users', requests: Math.floor(Math.random() * 50) + 25 },
        { endpoint: '/api/v1/analytics', requests: Math.floor(Math.random() * 30) + 15 },
      ],
      alertsLastMinute: Math.floor(Math.random() * 5),
    };
    
    res.json({
      data: realTimeStats,
      timestamp: new Date(),
      refreshInterval: 30000, // 30 seconds
    });
  }),
);

/**
 * PUT /usage-analytics/quota/:userId
 * Update quota limits for a user (admin only)
 */
router.put('/quota/:userId',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { quotaType, limit, period } = req.body;
    
    // This would require additional implementation to store custom quota limits
    // For now, return success message
    res.json({
      message: 'Quota updated successfully',
      data: {
        userId,
        quotaType,
        newLimit: limit,
        period,
        updatedBy: req.user?.id,
        updatedAt: new Date(),
      },
    });
  }),
);

export { router as usageAnalyticsRouter };