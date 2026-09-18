const express = require('express');
const auditLogController = require('./audit-log.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

const router = express.Router();

// GET /api/v1/admin/audit-logs - ADMIN only
router.get('/audit-logs', authenticate, authorize('ADMIN'), auditLogController.getAuditLogs);

// GET /api/v1/admin/queue-metrics - ADMIN only
router.get('/queue-metrics', authenticate, authorize('ADMIN'), auditLogController.getQueueMetrics);

module.exports = router;
