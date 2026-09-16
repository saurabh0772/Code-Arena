/**
 * Centralized Rate Limiting Middleware
 * Protects sensitive endpoints against brute force and resource exhaustion.
 *
 * Policies:
 * - Register: 5 requests / 15 minutes / IP
 * - Login: 10 requests / 15 minutes / IP
 * - Submission: 10 requests / minute / authenticated user
 */

const rateLimit = require('express-rate-limit');

const isTestEnv = () => process.env.NODE_ENV === 'test' && !process.env.ENABLE_RATE_LIMIT_IN_TEST;

/**
 * Rate limiter for User Registration
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
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
  registerLimiter,
  loginLimiter,
  submissionLimiter
};
