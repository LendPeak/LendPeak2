import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateRequest } from '../middleware/validate-request';
import { asyncHandler } from '../utils/async-handler';
import { analyticsService } from '../../services/analytics.service';
import Joi from 'joi';
import { UserRole } from '../../models/user.model';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const dateRangeSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required().min(Joi.ref('startDate')),
});

const customReportSchema = Joi.object({
  startDate: Joi.date(),
  endDate: Joi.date().when('startDate', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startDate')),
  }),
  loanStatus: Joi.array().items(Joi.string()),
  userRole: Joi.string(),
  minAmount: Joi.number().min(0),
  maxAmount: Joi.number().when('minAmount', {
    is: Joi.exist(),
    then: Joi.number().min(Joi.ref('minAmount')),
  }),
  includePayments: Joi.boolean(),
});

const exportSchema = Joi.object({
  format: Joi.string().valid('csv', 'json', 'pdf').required(),
});

/**
 * GET /analytics/dashboard
 * Get comprehensive dashboard metrics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const metrics = await analyticsService.getDashboardMetrics();
  
  res.json({
    data: metrics,
    timestamp: new Date(),
  });
}));

/**
 * GET /analytics/portfolio
 * Get loan portfolio analysis
 */
router.get('/portfolio', asyncHandler(async (req, res) => {
  const analysis = await analyticsService.getLoanPortfolioAnalysis();
  
  res.json({
    data: analysis,
    timestamp: new Date(),
  });
}));

/**
 * GET /analytics/revenue
 * Get revenue analysis for date range
 */
router.get('/revenue', 
  validateRequest({ query: dateRangeSchema }),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const revenue = await analyticsService.getRevenueAnalysis(
      new Date(startDate as string),
      new Date(endDate as string),
    );
    
    res.json({
      data: revenue,
      period: { startDate, endDate },
      timestamp: new Date(),
    });
  }),
);

/**
 * GET /analytics/user-growth/:year
 * Get user growth analytics for a specific year
 */
router.get('/user-growth/:year', 
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { year } = req.params;
    
    const growth = await analyticsService.getUserGrowthAnalytics(year);
    
    res.json({
      data: growth,
      year,
      timestamp: new Date(),
    });
  }),
);

/**
 * GET /analytics/performance
 * Get loan performance metrics
 */
router.get('/performance', asyncHandler(async (req, res) => {
  const performance = await analyticsService.getLoanPerformanceMetrics();
  
  res.json({
    data: performance,
    timestamp: new Date(),
  });
}));

/**
 * GET /analytics/collection-efficiency
 * Get collection efficiency metrics
 */
router.get('/collection-efficiency', 
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LOAN_OFFICER),
  asyncHandler(async (req, res) => {
    const efficiency = await analyticsService.getCollectionEfficiency();
    
    res.json({
      data: efficiency,
      timestamp: new Date(),
    });
  }),
);

/**
 * GET /analytics/risk
 * Get risk assessment metrics
 */
router.get('/risk', 
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
  asyncHandler(async (req, res) => {
    const risk = await analyticsService.getRiskAnalytics();
    
    res.json({
      data: risk,
      timestamp: new Date(),
    });
  }),
);

/**
 * POST /analytics/custom-report
 * Generate custom report based on filters
 */
router.post('/custom-report',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({ body: customReportSchema }),
  asyncHandler(async (req, res) => {
    const filters = req.body;
    
    const report = await analyticsService.generateCustomReport(filters);
    
    res.json({
      data: report,
      filters,
    });
  }),
);

/**
 * POST /analytics/export
 * Export analytics data in various formats
 */
router.post('/export',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({ body: exportSchema }),
  asyncHandler(async (req, res) => {
    const { format } = req.body;
    const { type } = req.query;
    
    let data;
    switch (type) {
    case 'dashboard':
      data = await analyticsService.getDashboardMetrics();
      break;
    case 'portfolio':
      data = await analyticsService.getLoanPortfolioAnalysis();
      break;
    case 'performance':
      data = await analyticsService.getLoanPerformanceMetrics();
      break;
    default:
      res.status(400).json({
        error: {
          code: 'INVALID_TYPE',
          message: 'Invalid analytics type for export',
        },
      });
      return;
    }
    
    const buffer = await analyticsService.exportAnalytics(format, data);
    
    const contentTypes = {
      csv: 'text/csv',
      json: 'application/json',
      pdf: 'application/pdf',
    };
    
    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${Date.now()}.${format}"`);
    res.send(buffer);
  }),
);

/**
 * WebSocket endpoint for real-time analytics
 * GET /analytics/realtime
 */
router.get('/realtime', 
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    res.json({
      message: 'Connect via WebSocket for real-time analytics',
      instructions: 'Use socket.emit("analytics:subscribe", { metrics: ["dashboard", "performance"] })',
    });
  }),
);

export { router as analyticsRouter };