const express = require('express');

const app = express();

// Basic application-level middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'backend'
  });
});

module.exports = app;
