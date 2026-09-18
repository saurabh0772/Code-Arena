/**
 * Centralized Redis Configuration & Connection Management
 *
 * Responsibilities:
 * - Centralizes Redis client creation, configuration, and lifecycle
 * - Supports host/port/password and REDIS_URL connection string formats
 * - Enforces required BullMQ connection parameters (maxRetriesPerRequest: null, enableReadyCheck: false)
 * - Configures resilient retry strategy with capped exponential backoff
 * - Implements safe error logging that never leaks authentication credentials
 * - Provides Redis readiness checks and graceful connection closure
 */

const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

let sharedRedisClient = null;

/**
 * Builds the standard ioredis connection options from configuration.
 *
 * @param {Object} [overrides={}] Optional option overrides
 * @returns {Object|string} Connection options or URL string with options
 */
function getRedisConfigOptions(overrides = {}) {
  const baseOptions = {
    maxRetriesPerRequest: null, // Mandatory for BullMQ queues and workers
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy(times) {
      // Exponential backoff capped at 3000ms
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    ...overrides
  };

  return baseOptions;
}

/**
 * Creates and returns a new ioredis client instance.
 * Useful when BullMQ requires independent client connections (e.g. subscriber/blocking clients).
 *
 * @param {Object} [options={}] Additional ioredis options
 * @returns {Redis}
 */
function createRedisClient(options = {}) {
  const redisOptions = getRedisConfigOptions(options);

  let client;
  if (config.redis.url) {
    client = new Redis(config.redis.url, redisOptions);
  } else {
    client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      ...redisOptions
    });
  }

  client.on('error', (err) => {
    logger.error('redis_client_error', {
      error: err.message,
      host: config.redis.host,
      port: config.redis.port
    });
  });

  return client;
}

/**
 * Returns a shared singleton ioredis connection for general application use.
 *
 * @returns {Redis}
 */
function getRedisConnection() {
  if (sharedRedisClient) {
    return sharedRedisClient;
  }

  sharedRedisClient = createRedisClient();
  return sharedRedisClient;
}

/**
 * Performs a deep readiness check via Redis PING.
 *
 * @param {Redis} [client] Optional client instance to check
 * @returns {Promise<{ ready: boolean, status: string, latencyMs?: number, details?: string }>}
 */
async function checkRedisReadiness(client = null) {
  const start = Date.now();
  const targetClient = client || getRedisConnection();

  try {
    const pong = await targetClient.ping();
    const latencyMs = Date.now() - start;
    const ready = pong === 'PONG';

    return {
      ready,
      status: ready ? 'healthy' : 'unhealthy',
      latencyMs
    };
  } catch (error) {
    return {
      ready: false,
      status: 'unhealthy',
      details: error.message
    };
  }
}

/**
 * Gracefully closes the shared Redis connection.
 *
 * @returns {Promise<void>}
 */
async function closeRedisConnection() {
  if (sharedRedisClient) {
    try {
      if (sharedRedisClient.status === 'ready' || sharedRedisClient.status === 'connecting') {
        await sharedRedisClient.quit();
      } else {
        sharedRedisClient.disconnect();
      }
    } catch (err) {
      logger.warn('redis_disconnect_warning', { error: err.message });
      try {
        sharedRedisClient.disconnect();
      } catch (_) {
        // Ignore forced disconnect error
      }
    }
    sharedRedisClient = null;
  }
}

module.exports = {
  getRedisConfigOptions,
  createRedisClient,
  getRedisConnection,
  checkRedisReadiness,
  closeRedisConnection
};
