const config = require('../config/env');
const logger = require('../utils/logger');

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal server error';
  let errorCode =
    err.errorCode ||
    (statusCode === 404 ? 'RESOURCE_NOT_FOUND' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');

  // Handle MongoDB / Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY_ERROR';
    message = 'User already exists';
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    const messages = err.errors ? Object.values(err.errors).map((val) => val.message) : [];
    message = messages.length > 0 ? messages.join(', ') : 'Validation error';
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID_FORMAT';
    message = `Invalid ${err.path || 'ID'} format`;
  }

  // Handle JWT errors if thrown directly by jsonwebtoken
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }

  // Structured logging
  logger.error(message, {
    requestId: req?.id,
    statusCode,
    errorCode,
    path: req?.originalUrl,
    method: req?.method,
    stack: config.isProduction ? undefined : err.stack
  });

  const response = {
    success: false,
    message,
    errorCode,
    error: {
      code: errorCode,
      message
    }
  };

  if (req?.id) {
    response.requestId = req.id;
  }

  if (config.isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
