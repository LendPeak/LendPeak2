import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from '../../config';
import { asyncHandler } from '../utils/async-handler';
import Redis from 'ioredis';

const router = Router();

// Simple health check
router.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: config.apiVersion,
    services: {
      api: 'healthy',
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      health.services.database = 'healthy';
    } else if (mongoose.connection.readyState === 0) {
      health.services.database = 'disconnected';
    } else {
      health.services.database = 'connecting';
    }
  } catch (error) {
    health.services.database = 'error';
  }

  // In development without DB, still return 200
  if (config.isDevelopment && health.services.database === 'disconnected') {
    return res.status(200).json({
      ...health,
      status: 'ok (development mode)',
      warning: 'Running without database connection',
    });
  }

  // In production, return 503 if DB is down
  if (!config.isDevelopment && health.services.database !== 'healthy') {
    return res.status(503).json({
      ...health,
      status: 'unhealthy',
      error: 'Database connection required',
    });
  }

  res.json(health);
}));

// Detailed health check
router.get('/health/detailed', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: config.apiVersion,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: { status: 'unknown', latency: 0 },
      redis: { status: 'unknown', latency: 0 },
    },
  };

  // Check MongoDB
  try {
    const dbStart = Date.now();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      health.checks.database.status = 'healthy';
      health.checks.database.latency = Date.now() - dbStart;
    } else {
      health.checks.database.status = 'disconnected';
    }
  } catch (error) {
    health.checks.database.status = 'error';
  }

  // Overall health
  const unhealthyServices = Object.values(health.checks).filter(
    check => check.status !== 'healthy' && check.status !== 'disconnected',
  );

  if (unhealthyServices.length > 0 && !config.isDevelopment) {
    health.status = 'unhealthy';
    return res.status(503).json(health);
  }

  res.json({
    ...health,
    responseTime: Date.now() - startTime,
  });
}));

export default router;