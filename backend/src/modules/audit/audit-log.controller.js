const auditLogService = require('./audit-log.service');
const { getQueueMetrics: fetchQueueMetrics } = require('../../queues/submission.queue');
const workerRegistry = require('../../workers/worker-registry.service');
const AppError = require('../../utils/app-error');

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogs(req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

const getQueueMetrics = async (req, res, next) => {
  try {
    const metrics = await fetchQueueMetrics();
    if (!metrics) {
      throw new AppError('Queue service unavailable', 503, 'QUEUE_UNAVAILABLE');
    }
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (err) {
    next(err);
  }
};

const getWorkers = async (req, res, next) => {
  try {
    const workers = await workerRegistry.getActiveWorkers();
    res.status(200).json({
      success: true,
      data: {
        count: workers.length,
        workers
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
  getQueueMetrics,
  getWorkers
};

