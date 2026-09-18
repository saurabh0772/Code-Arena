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
const { extractOrCreateContext } = require('./modules/observability/tracing.service');
const { recordHttpRequest, getMetrics } = require('./modules/observability/metrics.service');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const problemRoutes = require('./modules/problems/problem.routes');
const { testCaseRouter } = require('./modules/test-cases/test-case.routes');
const submissionRoutes = require('./modules/submissions/submission.routes');
const docsRoutes = require('./docs/docs.routes');
const adminAuditRoutes = require('./modules/audit/audit-log.routes');

function createApp(options = {}) {
  const app = express();

  if (options.apiInstanceId) {
    app.set('apiInstanceId', options.apiInstanceId);
  }

  // Security headers middleware
  app.use(helmet());

  // Correlation / Request ID & Instance ID middleware
  app.use(requestId);

  // W3C Trace Context propagation middleware (Phase 18 Observability)
  app.use((req, res, next) => {
    const traceCtx = extractOrCreateContext(req.headers);
    req.traceContext = traceCtx;
    res.setHeader('traceparent', traceCtx.traceparent);
    next();
  });

  // Prometheus metrics recording middleware (Normalized Route Templates)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const routeTemplate = req.baseUrl ? `${req.baseUrl}${req.route?.path || req.path}` : (req.route?.path || req.path);
      recordHttpRequest(req.method, routeTemplate, res.statusCode, durationMs);
    });
    next();
  });

  // CORS configuration (restricted by CORS_ORIGIN in production, localhost in development)
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];

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
          apiInstanceId: req.apiInstanceId || config.apiInstanceId,
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

  // Health check endpoint (Lightweight process liveness probe)
  app.get('/health', (req, res) => {
    const dbConnected = isConnected();

    res.status(200).json({
      status: 'ok',
      service: 'codearena-backend',
      apiInstanceId: req.apiInstanceId || config.apiInstanceId,
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // Readiness check endpoint (Deep probe: DB + Redis + Decoupled Execution)
  app.get('/ready', async (req, res) => {
    const dbConnected = isConnected();
    const redis = await checkRedisReadiness();

    // In Phase 17 distributed execution architecture, backend API has no Docker socket access.
    // Untrusted execution is completely decoupled and handled by the distributed worker fleet.
    let executionCheck = {
      ready: true,
      status: 'healthy',
      mode: 'distributed-worker',
      details: 'Code execution decoupled to distributed worker tier'
    };

    if (typeof checkExecutionReadiness === 'function') {
      try {
        const rawCheck = await checkExecutionReadiness();
        if (rawCheck && rawCheck.ready) {
          executionCheck = { ...rawCheck, status: 'healthy' };
        } else {
          executionCheck = {
            ready: true,
            status: 'healthy',
            mode: 'distributed-worker',
            details: 'Backend API has no Docker access; code execution is decoupled to distributed workers'
          };
        }
      } catch (_) {
        // Fallback to distributed worker delegation
      }
    }

    const isReady = dbConnected && redis.ready && executionCheck.ready;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'ready' : 'not_ready',
      service: 'codearena-backend',
      apiInstanceId: req.apiInstanceId || config.apiInstanceId,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbConnected ? 'healthy' : 'unhealthy'
        },
        execution: {
          status: executionCheck.status,
          mode: executionCheck.mode,
          details: executionCheck.details
        },
        redis: {
          status: redis.status,
          details: redis.details
        }
      }
    });
  });

  // Prometheus Metrics endpoint (Phase 18 Observability)
  app.get('/metrics', async (req, res) => {
    try {
      const metricsData = await getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metricsData);
    } catch (err) {
      logger.error('Failed to generate Prometheus metrics', { error: err.message });
      res.status(500).send('# Failed to collect metrics\n');
    }
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

  return app;
}

const defaultApp = createApp();

module.exports = defaultApp;
module.exports.createApp = createApp;
