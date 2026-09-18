const auditLogService = require('./audit-log.service');
const { getQueueMetrics: fetchQueueMetrics } = require('../../queues/submission.queue');
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

module.exports = {
  getAuditLogs,
  getQueueMetrics
};

