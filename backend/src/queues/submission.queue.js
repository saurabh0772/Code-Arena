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
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueSubmission(submissionId) {
  if (!submissionId || typeof submissionId !== 'string' || submissionId.trim().length === 0) {
    throw new Error('Valid submissionId string is required to enqueue submission');
  }

  const sanitizedId = submissionId.trim();
  const queue = getQueue();

  // Use submissionId as jobId to prevent duplicate active/waiting jobs for the same submission
  // Payload strictly contains ONLY submissionId
  const job = await queue.add(
    'execute',
    { submissionId: sanitizedId },
    {
      jobId: sanitizedId
    }
  );

  logger.info('submission_queued', {
    submissionId: sanitizedId,
    jobId: job.id,
    queue: SUBMISSION_QUEUE_NAME
  });

  return job;
}

/**
 * Returns lightweight queue metrics for observability.
 *
 * @returns {Promise<{ waiting: number, active: number, completed: number, failed: number, delayed: number }>}
 */
async function getQueueMetrics() {
  try {
    const queue = getQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed
    };
  } catch (error) {
    logger.error('queue_metrics_error', { error: error.message });
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
