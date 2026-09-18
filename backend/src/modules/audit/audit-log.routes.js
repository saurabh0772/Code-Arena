const express = require('express');
const auditLogController = require('./audit-log.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

const router = express.Router();

// GET /api/v1/admin/audit-logs - ADMIN only
router.get('/audit-logs', authenticate, authorize('ADMIN'), auditLogController.getAuditLogs);

// GET /api/v1/admin/queue-metrics - ADMIN only
router.get('/queue-metrics', authenticate, authorize('ADMIN'), auditLogController.getQueueMetrics);

// GET /api/v1/admin/workers - ADMIN only (Phase 17 Worker Registry)
router.get('/workers', authenticate, authorize('ADMIN'), auditLogController.getWorkers);

module.exports = router;
