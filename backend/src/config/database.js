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
 * Resolves Mongoose connection options based on configuration.
 *
 * Distinct Deployment Topologies:
 * 1. Explicit ReplicaSet mode (MONGODB_REPLICA_SET set):
 *    Configures replicaSet, readPreference ('primaryPreferred' by default), and retryWrites: true.
 *    Connection failures in this mode fail fast without silent downgrade to standalone.
 * 2. Managed MongoDB mode (URI starts with mongodb+srv:// or contains replicaSet=):
 *    Atlas / cloud-managed parameters respected.
 * 3. Standalone mode (local Docker Compose dev):
 *    Direct single-node connection options.
 *
 * @param {Object} [overrides={}]
 * @returns {Object} Connection options object for mongoose.connect
 */
function getMongooseOptions(overrides = {}) {
  const options = {
    serverSelectionTimeoutMS: 5000,
    ...overrides
  };

  const uri = (overrides.uri || config.mongodb.uri || '').trim();
  const explicitReplicaSet = overrides.replicaSet || config.mongodb.replicaSet;
  const explicitReadPreference = overrides.readPreference || config.mongodb.readPreference;
  const explicitRetryWrites = overrides.retryWrites !== undefined ? overrides.retryWrites : config.mongodb.retryWrites;

  if (explicitReplicaSet) {
    options.replicaSet = explicitReplicaSet;
    options.readPreference = explicitReadPreference || 'primaryPreferred';
    options.retryWrites = explicitRetryWrites !== undefined ? explicitRetryWrites : true;
    logger.info('MongoDB configured in explicit ReplicaSet mode', {
      replicaSet: options.replicaSet,
      readPreference: options.readPreference,
      retryWrites: options.retryWrites
    });
  } else if (uri.startsWith('mongodb+srv://') || uri.includes('replicaSet=')) {
    if (explicitReadPreference) options.readPreference = explicitReadPreference;
    if (explicitRetryWrites !== undefined) options.retryWrites = explicitRetryWrites;
  } else {
    if (explicitReadPreference) options.readPreference = explicitReadPreference;
    if (explicitRetryWrites !== undefined) options.retryWrites = explicitRetryWrites;
  }

  return options;
}

/**
 * Connect to MongoDB with optional exponential backoff retry.
 * In 'test' environment, retries are disabled to allow fast test execution.
 */
const connectDB = async (retries = 5, delayMs = 1000, optionsOverride = {}) => {
  const maxRetries = config.env === 'test' ? 1 : retries;
  let attempt = 0;
  const mongooseOptions = getMongooseOptions(optionsOverride);

  while (attempt < maxRetries) {
    attempt++;
    try {
      const conn = await mongoose.connect(config.mongodb.uri, mongooseOptions);
      return conn;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} of ${maxRetries} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        if (mongooseOptions.replicaSet) {
          logger.error('Failed to connect to configured MongoDB ReplicaSet — fail-fast without silent downgrade', {
            replicaSet: mongooseOptions.replicaSet
          });
        }
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
  isConnected,
  getMongooseOptions
};
