import { RateLimitingService } from '../rate-limiting.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('RateLimitingService', () => {
  let rateLimitingService: RateLimitingService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = new Redis() as jest.Mocked<Redis>;
    rateLimitingService = new RateLimitingService(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests under rate limit', async () => {
      mockRedis.multi = jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 5], [null, 'OK']]),
      });

      const result = await rateLimitingService.checkRateLimit('user123', 'api', {
        maxRequests: 100,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(95);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests over rate limit', async () => {
      mockRedis.multi = jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 101], [null, 'OK']]),
      });

      const result = await rateLimitingService.checkRateLimit('user123', 'api', {
        maxRequests: 100,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle different rate limit types', async () => {
      mockRedis.multi = jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 10], [null, 'OK']]),
      });

      const result = await rateLimitingService.checkRateLimit('user123', 'login', {
        maxRequests: 5,
        windowMs: 900000, // 15 minutes
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('trackAPIUsage', () => {
    it('should track API endpoint usage', async () => {
      mockRedis.hincrby = jest.fn().mockResolvedValue(1);
      mockRedis.zadd = jest.fn().mockResolvedValue(1);

      await rateLimitingService.trackAPIUsage('user123', '/api/v1/loans', 'GET', 200, 150);

      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        'api_usage:user:user123',
        '/api/v1/loans:GET',
        1
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'api_response_times:user123',
        Date.now(),
        expect.stringContaining('/api/v1/loans:GET:150ms')
      );
    });

    it('should track error rates', async () => {
      mockRedis.hincrby = jest.fn().mockResolvedValue(1);

      await rateLimitingService.trackAPIUsage('user123', '/api/v1/loans', 'POST', 500, 300);

      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        'api_errors:user:user123',
        '/api/v1/loans:POST:500',
        1
      );
    });
  });

  describe('getUsageAnalytics', () => {
    it('should return user usage analytics', async () => {
      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({
          '/api/v1/loans:GET': '45',
          '/api/v1/users:GET': '12',
        })
        .mockResolvedValueOnce({
          '/api/v1/loans:POST:400': '2',
          '/api/v1/loans:POST:500': '1',
        });

      mockRedis.zrange = jest.fn().mockResolvedValue([
        '/api/v1/loans:GET:120ms',
        '/api/v1/loans:GET:180ms',
        '/api/v1/users:GET:45ms',
      ]);

      const analytics = await rateLimitingService.getUsageAnalytics('user123');

      expect(analytics.totalRequests).toBe(57);
      expect(analytics.errorRate).toBeCloseTo(5.26, 1);
      expect(analytics.averageResponseTime).toBeCloseTo(115, 0);
      expect(analytics.topEndpoints).toEqual([
        { endpoint: '/api/v1/loans:GET', count: 45 },
        { endpoint: '/api/v1/users:GET', count: 12 },
      ]);
    });
  });

  describe('detectAbusePatterns', () => {
    it('should detect high error rate abuse', async () => {
      const analytics = {
        totalRequests: 100,
        errorCount: 60,
        errorRate: 60,
        averageResponseTime: 200,
        topEndpoints: [],
        errors: {},
        responseTimes: [],
      };

      const patterns = await rateLimitingService.detectAbusePatterns('user123', analytics);

      expect(patterns).toContain('High error rate (60%) indicates potential abuse');
    });

    it('should detect rapid fire requests', async () => {
      const analytics = {
        totalRequests: 1000,
        errorCount: 10,
        errorRate: 1,
        averageResponseTime: 50,
        topEndpoints: [
          { endpoint: '/api/v1/loans:GET', count: 950 },
        ],
        errors: {},
        responseTimes: [],
      };

      const patterns = await rateLimitingService.detectAbusePatterns('user123', analytics);

      expect(patterns).toContain('Extremely high request volume (1000 requests)');
      expect(patterns).toContain('Single endpoint dominance: /api/v1/loans:GET (95%)');
    });
  });

  describe('getDynamicRateLimit', () => {
    it('should adjust rate limits based on user behavior', async () => {
      const goodBehaviorAnalytics = {
        totalRequests: 50,
        errorRate: 1,
        averageResponseTime: 120,
        errorCount: 1,
        topEndpoints: [],
        errors: {},
        responseTimes: [],
      };

      const dynamicLimit = await rateLimitingService.getDynamicRateLimit(
        'user123',
        goodBehaviorAnalytics
      );

      expect(dynamicLimit.maxRequests).toBeGreaterThan(100); // Base limit increased
    });

    it('should reduce rate limits for suspicious behavior', async () => {
      const suspiciousBehaviorAnalytics = {
        totalRequests: 500,
        errorRate: 25,
        averageResponseTime: 50,
        errorCount: 125,
        topEndpoints: [],
        errors: {},
        responseTimes: [],
      };

      const dynamicLimit = await rateLimitingService.getDynamicRateLimit(
        'user123',
        suspiciousBehaviorAnalytics
      );

      expect(dynamicLimit.maxRequests).toBeLessThan(100); // Base limit reduced
    });
  });

  describe('generateUsageReport', () => {
    it('should generate comprehensive usage report', async () => {
      mockRedis.keys = jest.fn().mockResolvedValue([
        'api_usage:user:user1',
        'api_usage:user:user2',
      ]);

      mockRedis.hgetall = jest.fn()
        .mockResolvedValueOnce({ '/api/v1/loans:GET': '100' })
        .mockResolvedValueOnce({ '/api/v1/loans:GET': '50' });

      const report = await rateLimitingService.generateUsageReport('daily');

      expect(report.period).toBe('daily');
      expect(report.totalUsers).toBe(2);
      expect(report.totalRequests).toBe(150);
      expect(report.topEndpoints).toEqual([
        { endpoint: '/api/v1/loans:GET', count: 150 }
      ]);
    });
  });

  describe('Quotas', () => {
    it('should track and enforce quotas', async () => {
      mockRedis.get = jest.fn().mockResolvedValue('800');

      const quotaResult = await rateLimitingService.checkQuota('user123', 'monthly', {
        limit: 1000,
        period: 'monthly',
      });

      expect(quotaResult.allowed).toBe(true);
      expect(quotaResult.remaining).toBe(200);
      expect(quotaResult.usage).toBe(800);
    });

    it('should block requests over quota', async () => {
      mockRedis.get = jest.fn().mockResolvedValue('1001');

      const quotaResult = await rateLimitingService.checkQuota('user123', 'monthly', {
        limit: 1000,
        period: 'monthly',
      });

      expect(quotaResult.allowed).toBe(false);
      expect(quotaResult.remaining).toBe(0);
    });
  });

  describe('Alerting', () => {
    it('should trigger alerts for threshold breaches', async () => {
      const mockAlert = jest.fn();
      rateLimitingService.setAlertCallback(mockAlert);

      await rateLimitingService.checkThresholds('user123', {
        totalRequests: 1000,
        errorRate: 30,
        averageResponseTime: 2000,
        errorCount: 300,
        topEndpoints: [],
        errors: {},
        responseTimes: [],
      });

      expect(mockAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIGH_REQUEST_VOLUME',
          userId: 'user123',
          threshold: 500,
          actual: 1000,
        })
      );
    });
  });
});