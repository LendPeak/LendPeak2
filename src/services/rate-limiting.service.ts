// Rate limiting removed - use API Gateway or proxy for rate limiting in production

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

// Export empty service that always allows requests
export class RateLimitingService {
  async checkRateLimit(userId?: string, endpoint?: string, options?: any): Promise<RateLimitResult> {
    return {
      allowed: true,
      remaining: 999,
      resetTime: Date.now() + 60000,
      totalRequests: 1,
    };
  }

  async trackAPIUsage(userId?: string, endpoint?: string, responseTime?: number): Promise<void> {
    // No-op
  }

  async getUsageAnalytics(userId?: string) {
    return {
      totalRequests: 0,
      errorCount: 0,
      errorRate: 0,
      averageResponseTime: 0,
      topEndpoints: [],
      errors: {},
      responseTimes: [],
    };
  }

  async detectAbusePatterns(userId: string, analytics?: any): Promise<string[]> {
    return [];
  }

  async checkQuota(userId: string, type?: string, options?: any): Promise<{ 
    allowed: boolean; 
    limit: number; 
    used: number; 
    usage: number;
    remaining: number;
    resetTime: number;
  }> {
    const limit = options?.limit || 10000;
    return {
      allowed: true,
      limit,
      used: 0,
      usage: 0,
      remaining: limit,
      resetTime: Date.now() + 86400000, // 24 hours
    };
  }

  async generateUsageReport(period?: string): Promise<{
    totalRequests: number;
    errorCount: number;
    averageResponseTime: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    timeRanges: Array<{ hour: number; requests: number }>;
  }> {
    return {
      totalRequests: 0,
      errorCount: 0,
      averageResponseTime: 0,
      topEndpoints: [],
      timeRanges: [],
    };
  }
}

export const rateLimitingService = new RateLimitingService();