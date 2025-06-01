import mongoose from 'mongoose';
import { createServer } from 'http';
import { app } from './api';
import { config } from './config';
import { logger } from './utils/logger';
import { databaseBackup } from './utils/database-backup';
import { initializeWebSocketService } from './services/websocket.service';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

let server: any;
let wsService: any;

async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB (optional in development)
    if (config.isDevelopment && process.env.REQUIRE_DATABASE === 'false') {
      logger.warn('⚠️  Running without MongoDB (development mode)');
      logger.warn('⚠️  Database-dependent features will not work');
    } else {
      logger.info('Connecting to MongoDB...', { uri: config.mongodb.uri });
      
      await mongoose.connect(config.mongodb.uri, {
        dbName: config.mongodb.dbName,
        maxPoolSize: config.mongodb.poolSize,
      });
      
      logger.info('Connected to MongoDB');
    }

    // Set up MongoDB event listeners
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Create HTTP server
    const httpServer = createServer(app);
    
    // Initialize WebSocket service (simplified without Redis)
    wsService = initializeWebSocketService(httpServer);
    logger.info('WebSocket service initialized (in-memory mode)');

    // Start server
    server = httpServer.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`, {
        environment: config.nodeEnv,
        apiVersion: config.apiVersion,
        websocket: 'enabled',
      });
    });

    // Schedule daily backups in production
    if (config.isProduction) {
      setInterval(async () => {
        try {
          await databaseBackup.createBackup({
            compress: true,
            s3Upload: true,
          });
        } catch (error) {
          logger.error('Scheduled backup failed', { error });
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
    }

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down server...');

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close WebSocket connections
  if (wsService) {
    try {
      await wsService.disconnect();
      logger.info('WebSocket service closed');
    } catch (error) {
      logger.error('Error closing WebSocket service', { error });
    }
  }

  // Close database connections
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error });
  }

  process.exit(0);
}

// Start the server
startServer();