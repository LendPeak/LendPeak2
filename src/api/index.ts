import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '../config';
import calculationsRouter from './routes/calculations';
import { loansRouter } from './routes/loans';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
// import { analyticsRouter } from './routes/analytics';
// import { recommendationsRouter } from './routes/recommendations';
import { usageAnalyticsRouter } from './routes/usage-analytics';
// import { approvalWorkflowRouter } from './routes/approval-workflow';
// import { documentsRouter } from './routes/documents';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { apiLimiter, ipRateLimiter, rateLimitAnalytics } from './middleware/simple-rate-limiter';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:5173', 'http://localhost:3000'] 
    : config.security.corsOrigins,
  credentials: true,
}));

// Body parsing and compression
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Request logging
app.use(requestLogger);

// Rate limiting
app.use('/api', apiLimiter);
app.use('/api', ipRateLimiter);

// Rate limit analytics
app.use(rateLimitAnalytics);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API version check
app.get('/api/v1', (_req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      loans: '/api/v1/loans',
      calculations: '/api/v1/calculations',
      // analytics: '/api/v1/analytics',
      // recommendations: '/api/v1/recommendations',
      usageAnalytics: '/api/v1/usage-analytics',
      // approvalWorkflow: '/api/v1/approval-workflow',
      // documents: '/api/v1/documents',
    },
  });
});

// API documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'LendPeak2 API Documentation',
}));

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/calculations', calculationsRouter);
app.use('/api/v1/loans', loansRouter);
// app.use('/api/v1/analytics', analyticsRouter);
// app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/usage-analytics', usageAnalyticsRouter);
// app.use('/api/v1/approval-workflow', approvalWorkflowRouter);
// app.use('/api/v1/documents', documentsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handling
app.use(errorHandler);

export { app };