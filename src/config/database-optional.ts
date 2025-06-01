import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

export async function connectDatabase(required = true): Promise<boolean> {
  try {
    // In development, make database optional
    if (config.isDevelopment && !required) {
      logger.warn('Running in development without database connection');
      return false;
    }

    await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
      maxPoolSize: config.mongodb.poolSize,
    });

    logger.info('MongoDB connected successfully');
    return true;
  } catch (error) {
    if (required) {
      throw error;
    }
    logger.warn('MongoDB connection failed, running without database', { error });
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}