/**
 * CodeArena — Phase 14: Submission Worker Daemon
 *
 * Responsibilities:
 * - Subscribes to the BullMQ 'submission-execution' queue
 * - Consumes submission jobs asynchronously with configurable concurrency
 * - Enforces idempotency against duplicate / re-delivered jobs via atomic MongoDB state transitions
 * - Coordinates code execution via existing Execution Engine boundary
 * - Records job processing timing metrics (durationMs) for operational observability
 * - Performs fail-fast dependency validation on startup (MongoDB + Redis readiness)
 * - Implements idempotent graceful shutdown with safety termination guard
 * - Decoupled completely from HTTP API server processes
 */

const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/database');
const redisConfig = require('../config/redis');
const {
  SUBMISSION_QUEUE_NAME,
  closeQueue
} = require('../queues/submission.queue');
const Submission = require('../modules/submissions/submission.model');
const submissionExecutionService = require('../modules/submissions/submission-execution.service');
const logger = require('../utils/logger');

let worker = null;
let isShuttingDown = false;

/**
 * Processes a single submission job by ID or BullMQ Job.
 * Uses atomic MongoDB operations to claim QUEUED submissions, ensuring
 * that duplicate or concurrent jobs cannot execute the same submission.
 *
 * Distinguishes user-code verdicts (COMPLETED) from infrastructure errors (retries).
 *
 * @param {string|Object} submissionIdOrJob
 * @returns {Promise<void>}
 */
async function processSubmission(submissionIdOrJob) {
  const isJob = typeof submissionIdOrJob === 'object' && submissionIdOrJob !== null;
  const rawSubmissionId = typeof submissionIdOrJob === 'string'
    ? submissionIdOrJob
    : (submissionIdOrJob?.data?.submissionId || submissionIdOrJob?.submissionId);
  const jobId = isJob ? (submissionIdOrJob.id || null) : null;

  // Validate payload: must be a non-empty string and a valid MongoDB ObjectId
  if (
    !rawSubmissionId ||
    typeof rawSubmissionId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(rawSubmissionId.trim())
  ) {
    logger.warn('submission_job_malformed', {
      jobId,
      rawSubmissionId: typeof rawSubmissionId === 'string' ? rawSubmissionId.slice(0, 32) : typeof rawSubmissionId,
      reason: 'Missing or invalid submissionId format in job payload'
    });
    return;
  }

  const submissionId = rawSubmissionId.trim();
  const startTime = Date.now();

  logger.info('submission_job_started', {
    submissionId,
    jobId,
    workerPid: process.pid
  });

  // 1. Atomic claim: transition QUEUED -> RUNNING
  // Only ONE worker will successfully transition the submission from QUEUED to RUNNING.
  const claimedSubmission = await Submission.findOneAndUpdate(
    { _id: submissionId, status: 'QUEUED' },
    { $set: { status: 'RUNNING', startedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!claimedSubmission) {
    // Inspect current status to log appropriate reason without logging source code or sensitive data
    const existing = await Submission.findById(submissionId);
    if (!existing) {
      logger.warn('submission_job_skipped', {
        submissionId,
        jobId,
        reason: 'Submission document not found in database'
      });
      return;
    }

    if (['COMPLETED', 'FAILED'].includes(existing.status)) {
      logger.info('submission_job_skipped', {
        submissionId,
        jobId,
        status: existing.status,
        verdict: existing.verdict,
        reason: 'Submission already reached terminal state'
      });
      return;
    }

    if (existing.status === 'RUNNING') {
      logger.info('submission_job_skipped', {
        submissionId,
        jobId,
        status: existing.status,
        reason: 'Submission is already being processed by another worker'
      });
      return;
    }

    logger.warn('submission_job_skipped', {
      submissionId,
      jobId,
      status: existing.status,
      reason: `Submission not in QUEUED state (current status: ${existing.status})`
    });
    return;
  }

  // 2. Delegate to Execution Engine workflow
  try {
    const evaluatedSubmission = await submissionExecutionService.executeSubmission(submissionId);
    const durationMs = Date.now() - startTime;

    logger.info('submission_job_completed', {
      submissionId,
      jobId,
      verdict: evaluatedSubmission ? evaluatedSubmission.verdict : 'UNKNOWN',
      testsPassed: evaluatedSubmission ? evaluatedSubmission.testsPassed : 0,
      totalTests: evaluatedSubmission ? evaluatedSubmission.totalTests : 0,
      runtimeMs: evaluatedSubmission ? evaluatedSubmission.runtimeMs : null,
      durationMs
    });
  } catch (error) {
    logger.error('submission_job_failed', {
      submissionId,
      jobId,
      error: error.message
    });

    const maxAttempts = isJob && submissionIdOrJob.opts?.attempts ? submissionIdOrJob.opts.attempts : 1;
    const attemptsMade = isJob && typeof submissionIdOrJob.attemptsMade === 'number'
      ? submissionIdOrJob.attemptsMade + 1
      : 1;
    const hasRetriesRemaining = attemptsMade < maxAttempts;

    if (hasRetriesRemaining) {
      // Revert status to QUEUED so the next BullMQ retry attempt can atomically claim it
      await Submission.updateOne(
        { _id: submissionId, status: 'RUNNING' },
        { $set: { status: 'QUEUED' } }
      );
      logger.info('submission_job_retry_scheduled', {
        submissionId,
        jobId,
        attemptsMade,
        maxAttempts
      });
    } else {
      // All retries exhausted: mark as FAILED with error details
      await Submission.updateOne(
        { _id: submissionId },
        {
          $set: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: error.message || 'Execution infrastructure failure'
          }
        }
      );
      logger.info('submission_job_marked_failed', {
        submissionId,
        jobId,
        attemptsMade,
        maxAttempts
      });
    }

    // Re-throw to inform BullMQ of failure / trigger retry
    throw error;
  }
}

/**
 * Initializes and starts the BullMQ submission worker daemon.
 * Enforces fail-fast readiness verification on MongoDB and Redis before consuming jobs.
 *
 * @returns {Promise<Worker>}
 */
async function startWorker() {
  try {
    // 1. Connect to MongoDB (fail-fast)
    await connectDB();
    logger.info('Worker connected to MongoDB database successfully.');

    // 2. Perform deep readiness check on Redis (fail-fast)
    const redisStatus = await redisConfig.checkRedisReadiness();
    if (!redisStatus.ready) {
      throw new Error(`Redis readiness check failed: ${redisStatus.details || 'Connection unreachable'}`);
    }
    logger.info('Worker verified Redis connection readiness successfully.', {
      latencyMs: redisStatus.latencyMs
    });

    // 3. Initialize BullMQ Worker with shared Redis connection
    const connection = redisConfig.getRedisConnection();
    const concurrency = config.worker.concurrency || 2;

    worker = new Worker(
      SUBMISSION_QUEUE_NAME,
      async (job) => {
        await processSubmission(job);
      },
      {
        connection,
        concurrency,
        autorun: true
      }
    );

    worker.on('ready', () => {
      logger.info('worker_started', {
        queue: SUBMISSION_QUEUE_NAME,
        concurrency,
        pid: process.pid
      });
      console.log(`[CodeArena Worker] Running on queue '${SUBMISSION_QUEUE_NAME}' with concurrency ${concurrency}`);
    });

    worker.on('failed', (job, err) => {
      logger.error('worker_job_failed_event', {
        jobId: job?.id,
        submissionId: job?.data?.submissionId,
        error: err.message,
        attemptsMade: job?.attemptsMade
      });
    });

    worker.on('error', (err) => {
      logger.error('worker_error_event', {
        error: err.message
      });
    });

    return worker;
  } catch (error) {
    logger.error('Failed to initialize submission worker', { error: error.message });
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Gracefully shuts down the worker process.
 * Idempotent: safe against concurrent signal invocations.
 *
 * @param {string} [signal='SIGTERM']
 * @param {boolean} [exitProcess=true] Whether to exit process (set false in unit tests)
 * @returns {Promise<void>}
 */
async function shutdown(signal = 'SIGTERM', exitProcess = true) {
  if (isShuttingDown) {
    logger.warn('worker_shutdown_already_in_progress', { signal });
    return;
  }
  isShuttingDown = true;

  logger.info('worker_shutdown_initiated', { signal, pid: process.pid });
  console.log(`\n[CodeArena Worker] Received ${signal}. Shutting down worker gracefully...`);

  // Safety guard: force exit after 10 seconds if any connection or sandbox hangs
  let forceExitTimer = null;
  if (exitProcess) {
    forceExitTimer = setTimeout(() => {
      logger.error('worker_shutdown_timed_out', { timeoutMs: 10000 });
      console.error('[CodeArena Worker] Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();
  }

  if (worker) {
    try {
      await worker.close();
      console.log('[CodeArena Worker] BullMQ worker closed.');
    } catch (err) {
      console.error('[CodeArena Worker] Error closing worker:', err.message);
    }
    worker = null;
  }

  try {
    await closeQueue();
    console.log('[CodeArena Worker] Redis queue connections closed.');
  } catch (err) {
    console.error('[CodeArena Worker] Error closing Redis queue:', err.message);
  }

  try {
    await disconnectDB();
    console.log('[CodeArena Worker] MongoDB disconnected. Worker exit cleanly.');
  } catch (err) {
    console.error('[CodeArena Worker] Error disconnecting MongoDB:', err.message);
  }

  if (forceExitTimer) {
    clearTimeout(forceExitTimer);
  }

  if (exitProcess) {
    process.exit(0);
  }
}

/**
 * Resets internal worker state (useful for test suites).
 */
function resetWorkerState() {
  isShuttingDown = false;
  worker = null;
}

/**
 * Returns current BullMQ Worker instance (if initialized).
 */
function getWorkerInstance() {
  return worker;
}

// Bind process signals only when executed directly as a standalone daemon
if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  startWorker();
}

module.exports = {
  startWorker,
  processSubmission,
  shutdown,
  resetWorkerState,
  getWorkerInstance
};
