const AuditLog = require('./audit-log.model');
const logger = require('../../utils/logger');

/**
 * Record an administrative audit action
 * Fire-and-forget style to avoid failing parent operations
 */
async function logAuditAction({ userId, action, targetType, targetId, details = {}, ip = null }) {
  try {
    const log = await AuditLog.create({
      userId,
      action,
      targetType,
      targetId,
      details,
      ip
    });
    logger.info(`audit.${action.toLowerCase()}`, {
      userId: userId?.toString(),
      targetType,
      targetId: targetId?.toString(),
      action
    });
    return log;
  } catch (err) {
    logger.error('Failed to write audit log', {
      error: err.message,
      action,
      targetType,
      targetId: targetId?.toString()
    });
    return null;
  }
}

/**
 * Retrieve audit logs with filtering and pagination (ADMIN only)
 */
async function getAuditLogs(queryParams = {}) {
  const query = {};

  if (queryParams.action) {
    query.action = queryParams.action;
  }
  if (queryParams.targetType) {
    query.targetType = queryParams.targetType;
  }
  if (queryParams.targetId) {
    query.targetId = queryParams.targetId;
  }
  if (queryParams.userId) {
    query.userId = queryParams.userId;
  }

  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(query)
  ]);

  return {
    logs: logs.map((log) => ({
      id: log._id.toString(),
      userId: log.userId ? (typeof log.userId === 'object' ? log.userId._id.toString() : log.userId.toString()) : null,
      user: log.userId && typeof log.userId === 'object' ? {
        id: log.userId._id.toString(),
        name: log.userId.name,
        email: log.userId.email
      } : null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId.toString(),
      details: log.details,
      ip: log.ip,
      createdAt: log.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

module.exports = {
  logAuditAction,
  getAuditLogs
};
