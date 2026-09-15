const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const app = require('./app');

let server;

const startServer = async () => {
  try {
    // Connect to MongoDB first (fail-fast)
    await connectDB();

    // Start Express HTTP server
    server = app.listen(config.port, () => {
      console.log(`CodeArena backend server running in ${config.env} mode on port ${config.port}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown handler
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = { startServer, shutdown };
