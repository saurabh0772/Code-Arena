const config = require('../config/env');

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal server error';

  // Handle MongoDB / Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    message = 'User already exists';
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = err.errors ? Object.values(err.errors).map((val) => val.message) : [];
    message = messages.length > 0 ? messages.join(', ') : 'Validation error';
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path || 'ID'} format`;
  }

  // Handle JWT errors if thrown directly by jsonwebtoken
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }

  if (config.env !== 'test') {
    console.error(`[Error] ${statusCode} - ${message}`);
    if (config.isDevelopment && err.stack) {
      console.error(err.stack);
    }
  }

  const response = {
    success: false,
    message
  };

  if (config.isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
