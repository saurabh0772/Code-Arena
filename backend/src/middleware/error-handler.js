const config = require('../config/env');

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  console.error(`[Error] ${statusCode} - ${err.message}`);
  if (config.isDevelopment && err.stack) {
    console.error(err.stack);
  }

  const response = {
    success: false,
    message: err.message || 'Internal server error'
  };

  if (config.isDevelopment) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
