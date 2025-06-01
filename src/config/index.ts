import dotenv from 'dotenv';
import { cleanEnv, str, num, bool, url, makeValidator } from 'envalid';
import Big from 'big.js';

// Load environment variables
dotenv.config();

// Custom validator for comma-separated strings
const csvString = makeValidator<string[]>((input: string) => {
  return input.split(',').map(s => s.trim());
});

// Validate and clean environment variables
const env = cleanEnv(process.env, {
  // Application
  NODE_ENV: str({ choices: ['development', 'test', 'staging', 'production'] }),
  PORT: num({ default: 3000 }),
  API_VERSION: str({ default: 'v1' }),
  
  // Database
  MONGODB_URI: url({ default: 'mongodb://localhost:27017/lendpeak2' }),
  MONGODB_DB_NAME: str({ default: 'lendpeak2' }),
  MONGODB_POOL_SIZE: num({ default: 10 }),
  
  // Redis - Removed (use API Gateway for caching/rate limiting)
  
  // AWS
  AWS_REGION: str({ default: 'us-east-1' }),
  AWS_ACCOUNT_ID: str({ default: '' }),
  
  // Authentication
  COGNITO_USER_POOL_ID: str({ default: '' }),
  COGNITO_CLIENT_ID: str({ default: '' }),
  COGNITO_REGION: str({ default: 'us-east-1' }),
  
  // Payment Processing
  STRIPE_API_KEY: str({ default: '' }),
  STRIPE_WEBHOOK_SECRET: str({ default: '' }),
  STRIPE_API_VERSION: str({ default: '2023-10-16' }),
  
  // Security
  JWT_SECRET: str({ default: 'change-this-in-production' }),
  ENCRYPTION_KEY: str({ default: 'your-encryption-key-32-chars-long' }),
  CORS_ORIGINS: str({ default: 'http://localhost:3000' }),
  
  // Rate Limiting - Removed (use API Gateway)
  
  // Feature Flags
  FEATURE_NEW_CALCULATION_ENGINE: bool({ default: false }),
  FEATURE_ADVANCED_WATERFALLS: bool({ default: false }),
  FEATURE_ML_PREDICTIONS: bool({ default: false }),
  
  // Logging
  LOG_LEVEL: str({ default: 'debug', choices: ['error', 'warn', 'info', 'http', 'debug'] }),
  LOG_FORMAT: str({ default: 'json', choices: ['json', 'simple'] }),
  
  // Compliance
  COMPLIANCE_MODE: str({ default: 'test', choices: ['test', 'production'] }),
  MILITARY_STATUS_API_URL: url({ default: 'https://api.dmdc.osd.mil/scra/v2/' }),
  MILITARY_STATUS_API_KEY: str({ default: '' }),
});

export const config = {
  // Application
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  apiVersion: env.API_VERSION,
  
  // Database
  mongodb: {
    uri: env.MONGODB_URI,
    dbName: env.MONGODB_DB_NAME,
    poolSize: env.MONGODB_POOL_SIZE,
  },
  
  // Redis - Removed (use API Gateway for caching/rate limiting)
  
  
  // Authentication
  auth: {
    cognitoUserPoolId: env.COGNITO_USER_POOL_ID,
    cognitoClientId: env.COGNITO_CLIENT_ID,
    cognitoRegion: env.COGNITO_REGION,
    jwtSecret: env.JWT_SECRET,
  },
  
  // Payment Processing
  stripe: {
    apiKey: env.STRIPE_API_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    apiVersion: env.STRIPE_API_VERSION,
  },
  
  // Security
  security: {
    encryptionKey: env.ENCRYPTION_KEY,
    corsOrigins: env.CORS_ORIGINS.split(',').map(s => s.trim()),
  },
  
  // Rate Limiting - Removed (use API Gateway)
  
  // Feature Flags
  features: {
    newCalculationEngine: env.FEATURE_NEW_CALCULATION_ENGINE,
    advancedWaterfalls: env.FEATURE_ADVANCED_WATERFALLS,
    mlPredictions: env.FEATURE_ML_PREDICTIONS,
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  
  // Compliance
  compliance: {
    mode: env.COMPLIANCE_MODE,
    militaryStatusApi: {
      url: env.MILITARY_STATUS_API_URL,
      key: env.MILITARY_STATUS_API_KEY,
    },
  },
  
  // Business Rules
  businessRules: {
    maxLoanAmount: new Big('10000000'), // $10M
    minLoanAmount: new Big('1000'), // $1K
    maxInterestRate: new Big('0.30'), // 30%
    minInterestRate: new Big('0.01'), // 1%
    maxTermMonths: 480, // 40 years
    minTermMonths: 3,
    defaultGracePeriodDays: 15,
    lateFeeAmount: new Big('25'),
  },
  
  // State APR Caps (simplified example)
  stateAprCaps: {
    AR: new Big('0.17'), // Arkansas 17%
    PA: new Big('0.06'), // Pennsylvania 6%
    // Add more states as needed
    DEFAULT: new Big('0.36'), // Default 36%
  },

  // AWS S3 (document management)
  aws: {
    region: env.AWS_REGION,
    accountId: env.AWS_ACCOUNT_ID,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3: {
      documentBucket: process.env.S3_DOCUMENT_BUCKET || 'lendpeak2-documents',
    },
    cloudFront: {
      enabled: process.env.CLOUDFRONT_ENABLED === 'true',
      domain: process.env.CLOUDFRONT_DOMAIN || '',
    },
  },
};