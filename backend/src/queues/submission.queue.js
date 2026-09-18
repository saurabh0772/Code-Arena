/**
 * Submission Queue Module (BullMQ + Redis)
 *
 * Responsibilities:
 * - Centralizes submission job queue initialization and configuration
 * - Produces lightweight submission jobs containing ONLY { submissionId }
 * - Never stores source code, test cases, or credentials in Redis payloads
 * - Provides Redis readiness check and queue metrics for observability
 * - Enforces idempotency using submissionId as the BullMQ jobId
 */

const { Queue } = require('bullmq');
const {
  getRedisConnection,
  closeRedisConnection,
  checkRedisReadiness
} = require('../config/redis');
const logger = require('../utils/logger');

const SUBMISSION_QUEUE_NAME = 'submission-execution';

let submissionQueue = null;

/**
 * Returns the singleton BullMQ submission queue instance.
 *
 * @returns {Queue}
 */
function getQueue() {
  if (submissionQueue) {
    return submissionQueue;
  }

  const connection = getRedisConnection();

  submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        count: 1000,
        age: 86400 // 24 hours
      },
      removeOnFail: {
        count: 5000,
        age: 604800 // 7 days
      }
    }
  });

  submissionQueue.on('error', (err) => {
    logger.error('queue_error', {
      queue: SUBMISSION_QUEUE_NAME,
      error: err.message
    });
  });

  return submissionQueue;
}

/**
 * Enqueues a submission for asynchronous execution.
 * Enforces minimal payload: strictly { submissionId } only.
 *
 * @param {string} submissionId
 * @param {string} submissionId
 * @param {Object} [options={}] Optional job options (e.g. traceparent for W3C trace propagation)
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueSubmission(submissionId, options = {}) {
  if (!submissionId || typeof submissionId !== 'string' || submissionId.trim().length === 0) {
    throw new Error('Valid submissionId string is required to enqueue submission');
  }

  const sanitizedId = submissionId.trim();
  const queue = getQueue();

  // Use submissionId as jobId to prevent duplicate active/waiting jobs for the same submission
  // Payload strictly contains ONLY submissionId (Business payload contract preserved)
  // Observability metadata (W3C traceparent) is passed exclusively via job.opts
  const jobOptions = {
    jobId: sanitizedId
  };

  if (options.traceparent) {
    jobOptions.traceparent = options.traceparent;
  }

  const job = await queue.add(
    'execute',
    { submissionId: sanitizedId },
    jobOptions
  );

  logger.info('submission_queued', {
    submissionId: sanitizedId,
    jobId: job.id,
    traceparent: options.traceparent || null,
    queue: SUBMISSION_QUEUE_NAME
  });

  return job;
}

/**
 * Returns lightweight queue metrics for observability.
 * Bounded by a 250ms timeout to avoid hanging if Redis is unavailable.
 *
 * @returns {Promise<{ waiting: number, active: number, completed: number, failed: number, delayed: number }|null>}
 */
async function getQueueMetrics() {
  try {
    const queue = getQueue();
    let timer;
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), 250);
    });

    const metricsPromise = Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]).then(([waiting, active, completed, failed, delayed]) => {
      clearTimeout(timer);
      return { waiting, active, completed, failed, delayed };
    }).catch((err) => {
      clearTimeout(timer);
      logger.debug('queue_metrics_fetch_error', { error: err.message });
      return null;
    });

    return await Promise.race([metricsPromise, timeoutPromise]);
  } catch (error) {
    logger.debug('queue_metrics_error', { error: error.message });
    return null;
  }
}

/**
 * Gracefully closes the BullMQ queue and Redis client connections.
 *
 * @returns {Promise<void>}
 */
async function closeQueue() {
  if (submissionQueue) {
    try {
      await submissionQueue.close();
    } catch (err) {
      logger.warn('Failed to close submission queue gracefully', { error: err.message });
    }
    submissionQueue = null;
  }

  await closeRedisConnection();
}

module.exports = {
  SUBMISSION_QUEUE_NAME,
  getRedisConnection,
  getQueue,
  enqueueSubmission,
  checkRedisReadiness,
  getQueueMetrics,
  closeQueue
};
