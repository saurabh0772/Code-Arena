const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('./app-error');

/**
 * Generate a signed JWT
 * @param {Object} payload - Token payload (e.g. { sub, role })
 * @returns {string} Signed JWT
 */
const generateToken = (payload) => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured in the environment');
  }

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * Verify a JWT and decode its payload
 * @param {string} token - JWT string
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured in the environment');
  }

  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token has expired', 401);
    }
    throw new AppError('Invalid token', 401);
  }
};

module.exports = {
  generateToken,
  verifyToken
};
