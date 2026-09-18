const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const { isConnected } = require('./config/database');
const notFound = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');
const requestId = require('./middleware/request-id');
const logger = require('./utils/logger');
const { checkExecutionReadiness } = require('./modules/submissions/execution.adapter');
const { checkRedisReadiness } = require('./queues/submission.queue');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const problemRoutes = require('./modules/problems/problem.routes');
const { testCaseRouter } = require('./modules/test-cases/test-case.routes');
const submissionRoutes = require('./modules/submissions/submission.routes');
const docsRoutes = require('./docs/docs.routes');
const adminAuditRoutes = require('./modules/audit/audit-log.routes');

const app = express();

// Security headers middleware
app.use(helmet());

// Correlation / Request ID middleware
app.use(requestId);

// CORS configuration (restricted by CORS_ORIGIN in production, localhost in development)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true
  })
);

// Request body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
if (config.env !== 'test') {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('http_request', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        userAgent: req.get('user-agent'),
        ip: req.ip
      });
    });
    next();
  });
}

// Health check endpoint (Liveness probe)
app.get('/health', (req, res) => {
  const dbConnected = isConnected();
  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: dbConnected ? 'ok' : 'error',
    service: 'codearena-backend',
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Readiness check endpoint (Deep probe: DB + Execution Engine + Redis)
app.get('/ready', async (req, res) => {
  const dbConnected = isConnected();
  const execution = await checkExecutionReadiness();
  const redis = await checkRedisReadiness();
  const isReady = dbConnected && execution.ready && redis.ready;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'codearena-backend',
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbConnected ? 'healthy' : 'unhealthy'
      },
      execution: {
        status: execution.ready ? 'healthy' : 'unhealthy',
        mode: execution.mode,
        details: execution.details
      },
      redis: {
        status: redis.status,
        details: redis.details
      }
    }
  });
});

// API v1 Documentation
app.use('/api/v1/docs', docsRoutes);

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/problems', problemRoutes);
app.use('/api/v1/test-cases', testCaseRouter);
app.use('/api/v1/submissions', submissionRoutes);
app.use('/api/v1/admin', adminAuditRoutes);

// 404 Not Found handler
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
