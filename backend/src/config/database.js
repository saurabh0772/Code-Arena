const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

// Register connection lifecycle event listeners
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established', { host: mongoose.connection.host });
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost / disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully');
});

/**
 * Connect to MongoDB with optional exponential backoff retry.
 * In 'test' environment, retries are disabled to allow fast test execution.
 */
const connectDB = async (retries = 5, delayMs = 1000) => {
  const maxRetries = config.env === 'test' ? 1 : retries;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const conn = await mongoose.connect(config.mongodb.uri, {
        serverSelectionTimeoutMS: 5000
      });
      return conn;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} of ${maxRetries} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        throw error;
      }
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting MongoDB', { error: error.message });
  }
};

const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDB,
  disconnectDB,
  isConnected
};
