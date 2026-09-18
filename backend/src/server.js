const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const { closeQueue } = require('./queues/submission.queue');
const logger = require('./utils/logger');
const app = require('./app');

let server = null;
let isShuttingDown = false;

/**
 * Starts the CodeArena backend server.
 *
 * @param {number} [customPort] Optional port override
 * @param {Object} [options={}] Optional server configuration options
 * @returns {Promise<import('http').Server>}
 */
const startServer = async (customPort = null, options = {}) => {
  const listenPort = customPort || config.port;
  const apiInstanceId = options.apiInstanceId || config.apiInstanceId;

  try {
    // 1. Connect to MongoDB (fail-fast dependency check)
    if (!options.skipDbConnect) {
      await connectDB();
    }

    // 2. Configure instance identity on app if customized
    if (options.apiInstanceId && typeof app.set === 'function') {
      app.set('apiInstanceId', options.apiInstanceId);
    }

    // 3. Start Express HTTP server
    return new Promise((resolve, reject) => {
      server = app.listen(listenPort, () => {
        logger.info('backend_server_started', {
          apiInstanceId,
          port: listenPort,
          env: config.env
        });
        console.log(`[${apiInstanceId}] CodeArena backend server running in ${config.env} mode on port ${listenPort}`);
        resolve(server);
      });

      server.on('error', (err) => {
        logger.error('backend_server_listen_error', {
          apiInstanceId,
          error: err.message
        });
        reject(err);
      });
    });
  } catch (error) {
    logger.error('backend_server_start_failed', {
      apiInstanceId,
      error: error.message
    });
    console.error(`Failed to start server: ${error.message}`);
    if (options.exitOnError !== false) {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Idempotent graceful shutdown handler.
 *
 * Steps:
 * 1. Halt acceptance of new HTTP connections
 * 2. Drain in-flight HTTP requests
 * 3. Gracefully close BullMQ queue connection
 * 4. Disconnect MongoDB connection pool
 * 5. Clean exit
 *
 * @param {string} [signal='SIGTERM'] Termination signal
 * @param {boolean} [exitProcess=true] Whether to terminate process (false during testing)
 * @param {import('http').Server} [targetServer] Optional server instance override
 * @returns {Promise<void>}
 */
const shutdown = async (signal = 'SIGTERM', exitProcess = true, targetServer = null) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const currentServer = targetServer || server;
  const apiInstanceId = config.apiInstanceId;

  logger.info('backend_shutdown_initiated', {
    apiInstanceId,
    signal,
    pid: process.pid
  });
  console.log(`\n[${apiInstanceId}] Received ${signal}. Shutting down gracefully...`);

  // Safety fallback: force exit if graceful shutdown hangs
  let forceExitTimer;
  if (exitProcess) {
    forceExitTimer = setTimeout(() => {
      logger.error('backend_shutdown_timeout', {
        apiInstanceId,
        message: 'Forced shutdown after 10s timeout'
      });
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();
  }

  // 1. Close HTTP server connections
  if (currentServer && typeof currentServer.close === 'function') {
    await new Promise((resolve) => {
      currentServer.close(() => {
        logger.info('backend_http_server_closed', { apiInstanceId });
        console.log(`[${apiInstanceId}] HTTP server closed`);
        resolve();
      });
    });
  }

  // If this was a targeted server shutdown in tests, do not disconnect shared db or queue
  if (targetServer && !exitProcess) {
    if (forceExitTimer) {
      clearTimeout(forceExitTimer);
    }
    isShuttingDown = false;
    return;
  }

  // 2. Close Redis / BullMQ queue connection
  try {
    await closeQueue();
    logger.info('backend_queue_closed', { apiInstanceId });
  } catch (err) {
    logger.warn('backend_queue_close_error', { apiInstanceId, error: err.message });
  }

  // 3. Disconnect MongoDB
  try {
    await disconnectDB();
    logger.info('backend_database_disconnected', { apiInstanceId });
  } catch (err) {
    logger.warn('backend_database_disconnect_error', { apiInstanceId, error: err.message });
  }

  if (forceExitTimer) {
    clearTimeout(forceExitTimer);
  }

  if (exitProcess) {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  shutdown,
  getServerInstance: () => server,
  resetServerState: () => {
    isShuttingDown = false;
    server = null;
  }
};
