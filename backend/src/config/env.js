const dotenv = require('dotenv');

// Load environment variables from .env file if present
dotenv.config();

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const isDevelopment = env === 'development';
const isTest = env === 'test';

function validateEnv() {
  const missing = [];

  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      missing.push('JWT_SECRET is required in production');
    } else if (process.env.JWT_SECRET.length < 32) {
      missing.push('JWT_SECRET must be at least 32 characters in production');
    }

    if (!process.env.MONGODB_URI) {
      missing.push('MONGODB_URI is required in production');
    }

    if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
      missing.push('REDIS_HOST or REDIS_URL is required in production');
    }
  }

  if (missing.length > 0) {
    throw new Error(`[Config Error] Environment validation failed:\n - ${missing.join('\n - ')}`);
  }
}

// Perform initial validation
if (!isTest) {
  validateEnv();
}

const config = {
  env,
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || undefined
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY, 10) || 2
  },
  jwt: {
    secret: process.env.JWT_SECRET || (isTest ? 'test-jwt-secret-key' : 'codearena-dev-local-secret-key-32charsmin!'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000'
  },
  logging: {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')
  },
  execution: {
    mode: process.env.EXECUTION_MODE || 'docker',
    sandboxImage: process.env.CODEARENA_SANDBOX_IMAGE || 'codearena-sandbox:v1'
  },
  rateLimits: {
    registerMax: parseInt(process.env.RATE_LIMIT_REGISTER_MAX, 10) || 5,
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 10,
    submissionMax: parseInt(process.env.RATE_LIMIT_SUBMISSION_MAX, 10) || 10
  },
  workspaceBase: process.env.CODEARENA_WORKSPACE_BASE || '/tmp/codearena-workspaces',
  isProduction,
  isDevelopment,
  isTest,
  validateEnv
};

module.exports = config;
