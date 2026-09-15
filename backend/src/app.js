const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const { isConnected } = require('./config/database');
const notFound = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');

const app = express();

// Security headers middleware
app.use(helmet());

// CORS configuration
app.use(cors());

// Request body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
if (config.env !== 'test') {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  const dbConnected = isConnected();
  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: dbConnected ? 'ok' : 'error',
    service: 'codearena-backend',
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// 404 Not Found handler
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
