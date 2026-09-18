/**
 * Centralized Rate Limiting Middleware
 * Protects sensitive endpoints against brute force and resource exhaustion.
 *
 * Horizontally Scaled Architecture:
 * - Backed by shared Redis instance via rate-limit-redis so rate limits are globally
 *   enforced across all backend API replicas.
 * - Falls open (passOnStoreError: true) if Redis is temporarily unreachable.
 *
 * Policies:
 * - Register: 5 requests / 15 minutes / IP
 * - Login: 10 requests / 15 minutes / IP
 * - Submission: 10 requests / minute / authenticated user
 */

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisConnection } = require('../config/redis');
const logger = require('../utils/logger');

const isTestEnv = () => process.env.NODE_ENV === 'test' && !process.env.ENABLE_RATE_LIMIT_IN_TEST;

/**
 * Creates a RedisStore for express-rate-limit connected to the shared Redis client.
 *
 * @param {string} prefix Key prefix in Redis
 * @param {import('ioredis').Redis} [customClient] Optional custom client for testing
 * @returns {RedisStore|undefined}
 */
function createRateLimitStore(prefix, customClient = null) {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_RATE_LIMIT_IN_TEST && !customClient) {
    return undefined;
  }
  try {
    const client = customClient || getRedisConnection();
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `codearena:rl:${prefix}:`
    });
  } catch (err) {
    logger.warn('rate_limiter_redis_store_failed', { error: err.message, prefix });
    return undefined;
  }
}

/**
 * Rate limiter for User Registration
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  passOnStoreError: true,
  store: createRateLimitStore('register'),
  skip: isTestEnv,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again in 15 minutes.'
    }
  }
});

/**
 * Rate limiter for User Login
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  passOnStoreError: true,
  store: createRateLimitStore('login'),
  skip: isTestEnv,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again in 15 minutes.'
    }
  }
});

/**
 * Rate limiter for Code Submissions
 * Resource-intensive execution demands strict throttling per user.
 */
const submissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 submissions per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  passOnStoreError: true,
  store: createRateLimitStore('submission'),
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip;
  },
  skip: isTestEnv,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Submission rate limit exceeded. You may submit up to 10 solutions per minute.'
    }
  }
});

module.exports = {
  createRateLimitStore,
  registerLimiter,
  loginLimiter,
  submissionLimiter
};
