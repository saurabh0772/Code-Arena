/**
 * CodeArena — Phase 17: Distributed Submission Worker Daemon
 *
 * Responsibilities:
 * - Subscribes to the shared BullMQ 'submission-execution' queue
 * - Consumes submission jobs asynchronously with configurable concurrency
 * - Supports multiple independent distributed worker instances running concurrently
 * - Emits collision-resistant worker identity (WORKER_ID or worker-<hostname>-<pid>-<random>)
 * - Registers with ephemeral Redis worker registry and maintains periodic liveness heartbeats
 * - Enforces idempotency against duplicate delivery and handles crash-recovery retries cleanly
 * - Attaches execution diagnostic metadata (execution: { workerId, startedAt, completedAt })
 * - Coordinates code execution strictly via Execution Engine boundary
 * - Records job processing timing metrics (durationMs) for operational observability
 * - Performs fail-fast dependency validation on startup (MongoDB + Redis readiness)
 * - Implements graceful draining and shutdown (DRAINING state, worker.pause, connection cleanup)
 * - Decoupled completely from HTTP API server processes
 */

const os = require('os');
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
const workerRegistry = require('./worker-registry.service');
const metricsService = require('../modules/observability/metrics.service');
const logger = require('../utils/logger');

let worker = null;
let isShuttingDown = false;
let currentWorkerId = null;

/**
 * Resolves the worker identity for this runtime instance.
 * Delegates to config.resolveWorkerId for collision-resistant identification.
 *
 * @param {string} [explicitId]
 * @returns {string} Safe non-sensitive worker identifier
 */
function resolveWorkerId(explicitId) {
  return config.resolveWorkerId(explicitId);
}

/**
 * Validates and parses worker concurrency.
 * Rejects 0, negative numbers, NaN, non-integers, safely defaulting to defaultVal.
 *
 * @param {any} val
 * @param {number} [defaultVal=2]
 * @returns {number}
 */
function parseWorkerConcurrency(val, defaultVal = 2) {
  if (val === undefined || val === null || String(val).trim() === '') {
    return defaultVal;
  }
  const parsed = Number(val);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultVal;
  }
  return parsed;
}

/**
 * Determines whether an error is a non-retryable domain or system configuration failure.
 * Non-retryable errors (e.g. problem not ready, missing test cases, validation failures)
 * should immediately mark the submission as FAILED and never be retried by BullMQ.
 *
 * @param {Error} error
 * @returns {boolean}
 */
function isNonRetryableError(error) {
  if (!error) return false;
  if (error.isNonRetryable === true) return true;
  if (error.errorCode === 'PROBLEM_NOT_READY' || error.errorCode === 'VALIDATION_ERROR') return true;
  if (error.name === 'ValidationError') return true;
  if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    return true;
  }
  return false;
}

/**
 * Processes a single submission job by ID or BullMQ Job.
 * Uses atomic MongoDB operations to claim QUEUED or stale RUNNING submissions,
 * ensuring that active executions cannot be stolen by concurrent workers,
 * while allowing retry attempts from crashed workers to be reclaimed once stale.
 *
 * Distinguishes user-code verdicts (COMPLETED) from infrastructure errors (retries)
 * and non-retryable domain configuration failures (immediate FAILED without retry).
 *
 * @param {string|Object} submissionIdOrJob
 * @param {Object} [options={}]
 * @param {string} [options.workerId]
 * @param {number} [options.staleTimeoutMs]
 * @returns {Promise<void>}
 */
async function processSubmission(submissionIdOrJob, options = {}) {
  const isJob = typeof submissionIdOrJob === 'object' && submissionIdOrJob !== null;
  const rawSubmissionId = typeof submissionIdOrJob === 'string'
    ? submissionIdOrJob
    : (submissionIdOrJob?.data?.submissionId || submissionIdOrJob?.submissionId);
  const jobId = isJob ? (submissionIdOrJob.id || null) : null;
  const workerId = options.workerId || currentWorkerId || resolveWorkerId();

  // Validate payload: must be a non-empty string and a valid MongoDB ObjectId
  if (
    !rawSubmissionId ||
    typeof rawSubmissionId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(rawSubmissionId.trim())
  ) {
    logger.warn('submission_job_malformed', {
      workerId,
      jobId,
      rawSubmissionId: typeof rawSubmissionId === 'string' ? rawSubmissionId.slice(0, 32) : typeof rawSubmissionId,
      reason: 'Missing or invalid submissionId format in job payload'
    });
    return;
  }

  const submissionId = rawSubmissionId.trim();
  const startTime = Date.now();

  const attemptsMade = isJob && typeof submissionIdOrJob.attemptsMade === 'number'
    ? submissionIdOrJob.attemptsMade
    : 0;

  // W3C Trace Context extracted from BullMQ job options (outside business payload)
  const traceparent = isJob && submissionIdOrJob.opts?.traceparent
    ? submissionIdOrJob.opts.traceparent
    : null;

  logger.info('submission_job_started', {
    submissionId,
    jobId,
    workerId,
    workerPid: process.pid,
    attemptsMade,
    traceparent
  });

  // 1. Atomic claim with Stale Ownership Recovery:
  // - QUEUED submissions are claimed immediately
  // - RUNNING submissions are claimed ONLY if ownership is stale (startedAt < staleCutoff)
  // - Fresh RUNNING submissions are protected against concurrent theft
  const staleTimeoutMs = typeof options.staleTimeoutMs === 'number'
    ? options.staleTimeoutMs
    : (config.worker?.staleTimeoutMs || 30000);
  const staleCutoff = new Date(Date.now() - staleTimeoutMs);

  const claimFilter = {
    _id: submissionId,
    $or: [
      { status: 'QUEUED' },
      {
        status: 'RUNNING',
        $or: [
          { 'execution.startedAt': { $lt: staleCutoff } },
          { 'execution.startedAt': { $exists: false }, startedAt: { $lt: staleCutoff } },
          { 'execution.startedAt': null, startedAt: { $lt: staleCutoff } }
        ]
      }
    ]
  };

  const claimedSubmission = await Submission.findOneAndUpdate(
    claimFilter,
    {
      $set: {
        status: 'RUNNING',
        startedAt: new Date(),
        'execution.workerId': workerId,
        'execution.startedAt': new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!claimedSubmission) {
    // Inspect current status to log appropriate diagnostic reason without leaking secrets
    const existing = await Submission.findById(submissionId);
    if (!existing) {
      logger.warn('submission_job_skipped', {
        submissionId,
        jobId,
        workerId,
        reason: 'Submission document not found in database'
      });
      return;
    }

    if (['COMPLETED', 'FAILED'].includes(existing.status)) {
      logger.info('submission_job_skipped', {
        submissionId,
        jobId,
        workerId,
        status: existing.status,
        verdict: existing.verdict,
        reason: 'Submission already reached terminal state'
      });
      return;
    }

    if (existing.status === 'RUNNING') {
      const activeStartedAt = existing.execution?.startedAt || existing.startedAt;
      const isFresh = activeStartedAt && (Date.now() - new Date(activeStartedAt).getTime()) < staleTimeoutMs;
      logger.info('submission_job_skipped', {
        submissionId,
        jobId,
        workerId,
        status: existing.status,
        currentWorkerId: existing.execution?.workerId,
        isFresh,
        reason: isFresh
          ? 'Submission is actively being processed by another worker with fresh ownership'
          : 'Submission running state could not be claimed atomically'
      });
      return;
    }

    logger.warn('submission_job_skipped', {
      submissionId,
      jobId,
      workerId,
      status: existing.status,
      reason: `Submission not in claimable state (current status: ${existing.status})`
    });
    return;
  }

  // 2. Delegate to Execution Engine workflow
  try {
    const evaluatedSubmission = await submissionExecutionService.executeSubmission(submissionId);
    const durationMs = Date.now() - startTime;

    // Record completedAt in execution metadata
    await Submission.updateOne(
      { _id: submissionId },
      { $set: { 'execution.completedAt': new Date() } }
    );

    metricsService.recordWorkerJob('completed');
    if (evaluatedSubmission) {
      metricsService.recordSubmissionVerdict(claimedSubmission.language, evaluatedSubmission.verdict);
      metricsService.recordExecutionDuration(claimedSubmission.language, durationMs);
    }

    logger.info('submission_job_completed', {
      submissionId,
      jobId,
      workerId,
      verdict: evaluatedSubmission ? evaluatedSubmission.verdict : 'UNKNOWN',
      testsPassed: evaluatedSubmission ? evaluatedSubmission.testsPassed : 0,
      totalTests: evaluatedSubmission ? evaluatedSubmission.totalTests : 0,
      runtimeMs: evaluatedSubmission ? evaluatedSubmission.runtimeMs : null,
      durationMs,
      traceparent
    });
  } catch (error) {
    metricsService.recordWorkerJob('failed');
    metricsService.recordWorkerFailure(isNonRetryableError(error) ? 'domain_failure' : 'infrastructure_failure');

    logger.error('submission_job_failed', {
      submissionId,
      jobId,
      workerId,
      error: error.message,
      traceparent
    });

    if (isNonRetryableError(error)) {
      // Non-retryable domain/system failure (e.g. problem not ready, missing test cases, validation error):
      // Mark directly as FAILED and do not schedule BullMQ retries.
      await Submission.updateOne(
        { _id: submissionId },
        {
          $set: {
            status: 'FAILED',
            failedAt: new Date(),
            'execution.completedAt': new Date(),
            errorMessage: error.message || 'Non-retryable execution error'
          }
        }
      );
      logger.warn('submission_job_non_retryable_failed', {
        submissionId,
        jobId,
        workerId,
        errorCode: error.errorCode || 'NON_RETRYABLE_ERROR',
        error: error.message
      });
      return; // Acknowledge job cleanly without BullMQ retry
    }

    const maxAttempts = isJob && submissionIdOrJob.opts?.attempts ? submissionIdOrJob.opts.attempts : 1;
    const currentAttemptNumber = attemptsMade + 1;
    const hasRetriesRemaining = currentAttemptNumber < maxAttempts;

    if (hasRetriesRemaining) {
      // Revert status to QUEUED so the next BullMQ retry attempt can claim it cleanly
      await Submission.updateOne(
        { _id: submissionId, status: 'RUNNING' },
        { $set: { status: 'QUEUED' } }
      );
      logger.info('submission_job_retry_scheduled', {
        submissionId,
        jobId,
        workerId,
        attemptsMade: currentAttemptNumber,
        maxAttempts
      });
    } else {
      // All retries exhausted: mark as FAILED with error details and completion timestamp
      await Submission.updateOne(
        { _id: submissionId },
        {
          $set: {
            status: 'FAILED',
            failedAt: new Date(),
            'execution.completedAt': new Date(),
            errorMessage: error.message || 'Execution infrastructure failure'
          }
        }
      );
      logger.info('submission_job_marked_failed', {
        submissionId,
        jobId,
        workerId,
        attemptsMade: currentAttemptNumber,
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
 * Registers worker with the distributed worker registry and maintains periodic liveness heartbeats.
 *
 * @param {Object} [options={}]
 * @param {string} [options.workerId]
 * @param {number} [options.concurrency]
 * @param {number} [options.heartbeatIntervalMs]
 * @param {Object} [options.connection]
 * @param {boolean} [options.skipDbConnect]
 * @param {boolean} [options.skipRedisPing]
 * @param {boolean} [options.skipRegistry]
 * @returns {Promise<Worker>}
 */
async function startWorker(options = {}) {
  try {
    const workerId = resolveWorkerId(options.workerId);
    currentWorkerId = workerId;

    // 1. Connect to MongoDB (fail-fast, unless skipDbConnect is true)
    if (!options.skipDbConnect) {
      await connectDB();
      logger.info('Worker connected to MongoDB database successfully.', { workerId });
    }

    // 2. Perform deep readiness check on Redis (fail-fast, unless skipRedisPing is true)
    if (!options.skipRedisPing) {
      const redisStatus = await redisConfig.checkRedisReadiness();
      if (!redisStatus.ready) {
        throw new Error(`Redis readiness check failed: ${redisStatus.details || 'Connection unreachable'}`);
      }
      logger.info('Worker verified Redis connection readiness successfully.', {
        workerId,
        latencyMs: redisStatus.latencyMs
      });
    }

    // 3. Register worker in ephemeral Redis registry with STARTING status
    const concurrency = parseWorkerConcurrency(
      options.concurrency ?? config.worker.concurrency,
      2
    );

    if (!options.skipRegistry) {
      await workerRegistry.registerWorker({
        workerId,
        concurrency,
        status: 'STARTING'
      });
    }

    // 4. Initialize BullMQ Worker with dedicated Redis connection
    const connection = options.connection || redisConfig.createRedisClient();

    const workerInstance = new Worker(
      SUBMISSION_QUEUE_NAME,
      async (job) => {
        await processSubmission(job, { workerId, staleTimeoutMs: options.staleTimeoutMs });
      },
      {
        connection,
        concurrency,
        autorun: true
      }
    );

    workerInstance.workerId = workerId;
    workerInstance.concurrency = concurrency;
    workerInstance._ownsConnection = !options.connection;
    workerInstance._connection = connection;
    workerInstance._heartbeatTimer = null;

    workerInstance.on('failed', (job, err) => {
      logger.error('worker_job_failed_event', {
        workerId,
        jobId: job?.id,
        submissionId: job?.data?.submissionId,
        error: err.message,
        attemptsMade: job?.attemptsMade
      });
    });

    workerInstance.on('error', (err) => {
      logger.error('worker_error_event', {
        workerId,
        error: err.message
      });
    });

    await workerInstance.waitUntilReady();

    if (!options.skipRegistry) {
      await workerRegistry.updateWorkerStatus(workerId, 'READY');

      // Start periodic heartbeat loop
      const heartbeatIntervalMs = options.heartbeatIntervalMs || config.worker.heartbeatIntervalMs || 5000;
      const timer = setInterval(async () => {
        try {
          await workerRegistry.heartbeatWorker(workerId);
        } catch (err) {
          logger.debug('worker_heartbeat_tick_failed', { workerId, error: err.message });
        }
      }, heartbeatIntervalMs);
      timer.unref();
      workerInstance._heartbeatTimer = timer;
    }

    logger.info('worker_started', {
      workerId,
      queue: SUBMISSION_QUEUE_NAME,
      concurrency,
      pid: process.pid,
      hostname: os.hostname()
    });
    console.log(`[CodeArena Worker ${workerId}] Running on queue '${SUBMISSION_QUEUE_NAME}' with concurrency ${concurrency}`);

    worker = workerInstance;
    return workerInstance;
  } catch (error) {
    logger.error('Failed to initialize submission worker', {
      workerId: currentWorkerId || resolveWorkerId(),
      error: error.message
    });
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Gracefully shuts down the worker process.
 * Transition sequence: RUNNING -> DRAINING -> stop intake -> await active jobs -> close connections -> STOPPED.
 * Idempotent: safe against concurrent signal invocations.
 *
 * @param {string} [signal='SIGTERM']
 * @param {boolean} [exitProcess=true] Whether to exit process (set false in unit tests)
 * @param {Worker} [targetWorker=null] Optional specific worker instance to shut down
 * @param {Object} [options={}]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<void>}
 */
async function shutdown(signal = 'SIGTERM', exitProcess = true, targetWorker = null, options = {}) {
  if (isShuttingDown && !targetWorker) {
    logger.warn('worker_shutdown_already_in_progress', { signal });
    return;
  }
  if (!targetWorker) {
    isShuttingDown = true;
  }

  const workerToClose = targetWorker || worker;
  const workerId = workerToClose?.workerId || currentWorkerId || resolveWorkerId();

  logger.info('worker_shutdown_initiated', { workerId, signal, pid: process.pid });
  console.log(`\n[CodeArena Worker ${workerId}] Received ${signal}. Shutting down worker gracefully...`);

  // 1. Update registry status to DRAINING
  try {
    await workerRegistry.updateWorkerStatus(workerId, 'DRAINING');
    logger.info('worker_status_draining', { workerId });
  } catch (err) {
    logger.debug('worker_registry_draining_failed', { workerId, error: err.message });
  }

  // 2. Stop accepting new jobs while active jobs complete
  if (workerToClose) {
    try {
      await workerToClose.pause(true);
    } catch (_) {}

    // Clear heartbeat timer
    if (workerToClose._heartbeatTimer) {
      clearInterval(workerToClose._heartbeatTimer);
      workerToClose._heartbeatTimer = null;
    }
  }

  // 3. Safety guard: force exit after timeout if any connection or sandbox hangs
  const timeoutMs = options.timeoutMs || config.worker.gracefulShutdownTimeoutMs || 10000;
  let forceExitTimer = null;
  if (exitProcess) {
    forceExitTimer = setTimeout(() => {
      logger.error('worker_shutdown_timed_out', { workerId, timeoutMs });
      console.error(`[CodeArena Worker ${workerId}] Graceful shutdown timed out after ${timeoutMs}ms. Forcing exit.`);
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref();
  }

  // 4. Close BullMQ worker instance (waits for in-flight jobs to finish)
  if (workerToClose) {
    try {
      await workerToClose.close();
      console.log(`[CodeArena Worker ${workerId}] BullMQ worker closed.`);
    } catch (err) {
      console.error(`[CodeArena Worker ${workerId}] Error closing worker:`, err.message);
    }

    // Mark as STOPPED in registry
    try {
      await workerRegistry.updateWorkerStatus(workerId, 'STOPPED');
    } catch (_) {}

    if (workerToClose._ownsConnection && workerToClose._connection) {
      try {
        await workerToClose._connection.quit();
      } catch (_) {
        workerToClose._connection.disconnect();
      }
    }
    if (workerToClose === worker) {
      worker = null;
    }
  }

  // If this was a targeted worker shutdown, do not close global queue or db
  if (targetWorker && !exitProcess) {
    if (forceExitTimer) clearTimeout(forceExitTimer);
    return;
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
  currentWorkerId = null;
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
  getWorkerInstance,
  resolveWorkerId,
  parseWorkerConcurrency,
  isNonRetryableError
};
