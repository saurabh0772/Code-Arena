const os = require('os');
const crypto = require('crypto');
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

function parsePositiveInt(val, defaultVal) {
  if (val === undefined || val === null || String(val).trim() === '') {
    return defaultVal;
  }
  const parsed = Number(val);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultVal;
  }
  return parsed;
}

function resolveApiInstanceId(explicitId) {
  if (explicitId && typeof explicitId === 'string' && explicitId.trim().length > 0) {
    return explicitId.trim();
  }
  if (process.env.API_INSTANCE_ID && process.env.API_INSTANCE_ID.trim().length > 0) {
    return process.env.API_INSTANCE_ID.trim();
  }
  return `api-${os.hostname()}-${process.pid}`;
}

function resolveWorkerId(explicitId) {
  if (explicitId && typeof explicitId === 'string' && explicitId.trim().length > 0) {
    return explicitId.trim();
  }
  if (process.env.WORKER_ID && process.env.WORKER_ID.trim().length > 0) {
    return process.env.WORKER_ID.trim();
  }
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `worker-${os.hostname()}-${process.pid}-${randomSuffix}`;
}

const config = {
  env,
  port: parseInt(process.env.PORT, 10) || 5000,
  apiInstanceId: resolveApiInstanceId(),
  resolveApiInstanceId,
  resolveWorkerId,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena',
    replicaSet: (process.env.MONGODB_REPLICA_SET && process.env.MONGODB_REPLICA_SET.trim()) || undefined,
    readPreference: (process.env.MONGODB_READ_PREFERENCE && process.env.MONGODB_READ_PREFERENCE.trim()) || undefined,
    retryWrites: process.env.MONGODB_RETRY_WRITES !== undefined
      ? process.env.MONGODB_RETRY_WRITES === 'true'
      : undefined
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || undefined
  },
  worker: {
    id: (process.env.WORKER_ID && process.env.WORKER_ID.trim()) || null,
    concurrency: parsePositiveInt(process.env.WORKER_CONCURRENCY, 2),
    heartbeatIntervalMs: parsePositiveInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS, 5000),
    gracefulShutdownTimeoutMs: parsePositiveInt(process.env.WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS, 10000),
    staleTimeoutMs: parsePositiveInt(process.env.WORKER_STALE_TIMEOUT_MS, 30000)
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
  validateEnv,
  parsePositiveInt
};

module.exports = config;
