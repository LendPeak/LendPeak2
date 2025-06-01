import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: mongoose.ConnectOptions;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected = false;

  private constructor() {
    // Set up mongoose plugins and settings
    mongoose.plugin((schema: any) => {
      schema.set('toJSON', {
        virtuals: true,
        transform: (_doc: any, ret: any) => {
          delete ret._id;
          delete ret.__v;
          return ret;
        },
      });
    });

    // Enable mongoose debug in development
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', true);
    }
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(config: DatabaseConfig): Promise<void> {
    if (this.isConnected) {
      logger.warn('Database already connected');
      return;
    }

    try {
      const defaultOptions: mongoose.ConnectOptions = {
        maxPoolSize: 10,
        minPoolSize: 5,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 5000,
        family: 4,
      };

      const options = {
        ...defaultOptions,
        ...config.options,
        dbName: config.dbName,
      };

      await mongoose.connect(config.uri, options);
      this.isConnected = true;
      
      logger.info('MongoDB connected successfully', {
        dbName: config.dbName,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
      });

      // Set up connection event handlers
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection(): mongoose.Connection {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return mongoose.connection;
  }

  isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async runHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.isConnected) {
        return { healthy: false, details: { error: 'Not connected' } };
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();

      return {
        healthy: true,
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

// Export singleton instance
export const database = DatabaseConnection.getInstance();