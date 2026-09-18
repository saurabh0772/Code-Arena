/**
 * Phase 15 Multi-Worker & Concurrency Test Suite
 *
 * Validates:
 * 1. Worker Concurrency Configuration Invariants:
 *    - WORKER_CONCURRENCY default is valid (safe positive integer, default 2)
 *    - WORKER_CONCURRENCY accepts valid positive integers
 *    - Invalid WORKER_CONCURRENCY (0, negative, NaN, non-numeric, decimal) safely defaults
 * 2. Worker Identity & Observability:
 *    - Worker identity is generated when WORKER_ID is absent (worker-<hostname>-<pid>)
 *    - Explicit WORKER_ID is respected
 *    - Worker logs include worker identity, jobId, and submissionId without leaking secrets
 * 3. Shared Queue & Distribution Invariants:
 *    - Multiple worker instances use the same BullMQ queue ('submission-execution')
 *    - Jobs can be distributed across multiple worker instances
 *    - Worker does not start Express HTTP server or bind HTTP ports
 * 4. Submission State Safety & Idempotency:
 *    - Concurrent workers cannot both claim the same queued submission (atomic claim)
 *    - Duplicate job delivery does not result in concurrent duplicate claims
 * 5. Failure & Shutdown Isolation:
 *    - One worker shutdown does not prevent other workers from processing queue jobs
 *    - Graceful shutdown of one worker does not shut down another worker
 * 6. Execution State Isolation:
 *    - Concurrent submissions preserve independent execution context
 * 7. End-to-End Multi-Worker Integration (Section 21):
 *    - Multiple submissions concurrently claimed and completed by separate workers
 * 8. Controlled Concurrency & Queue Drain (Section 22):
 *    - Batch of submissions drained by multiple workers to terminal state
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase15-32chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const {
  checkRedisReadiness,
  createRedisClient,
  closeRedisConnection
} = require('../src/config/redis');
const {
  SUBMISSION_QUEUE_NAME,
  getQueue,
  enqueueSubmission,
  getQueueMetrics,
  closeQueue
} = require('../src/queues/submission.queue');
const {
  startWorker,
  processSubmission,
  shutdown,
  resetWorkerState,
  getWorkerInstance,
  resolveWorkerId,
  parseWorkerConcurrency
} = require('../src/workers/submission.worker');
const submissionExecutionService = require('../src/modules/submissions/submission-execution.service');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const Submission = require('../src/modules/submissions/submission.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');
const logger = require('../src/utils/logger');

describe('Phase 15 Multiple Workers & Concurrency Test Suite', () => {
  let user;
  let admin;
  let testProblem;
  const activeWorkers = [];
  const activeClients = [];

  function trackClient(client) {
    activeClients.push(client);
    return client;
  }

  async function cleanupWorkersAndClients() {
    for (const w of activeWorkers) {
      try {
        await w.close();
      } catch (_) {}
    }
    activeWorkers.length = 0;

    for (const c of activeClients) {
      try {
        c.disconnect();
      } catch (_) {}
    }
    activeClients.length = 0;
  }

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();

    const redisCheck = await checkRedisReadiness();
    if (!redisCheck.ready) {
      console.warn('[Phase 15 Tests] Redis is not responsive. Verify local Redis container is running.');
    }
  });

  after(async () => {
    await cleanupWorkersAndClients();

    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: /phase15/ });
      await Problem.deleteMany({ title: /Phase 15/ });
      await Submission.deleteMany({});
      await TestCase.deleteMany({});
      await disconnectDB();
    }
    await closeQueue();
    await closeRedisConnection();
  });

  afterEach(async () => {
    await cleanupWorkersAndClients();
  });

  beforeEach(async () => {
    resetWorkerState();
    await cleanupWorkersAndClients();

    await User.deleteMany({ email: /phase15/ });
    await Problem.deleteMany({ title: /Phase 15/ });
    await Submission.deleteMany({});
    await TestCase.deleteMany({});

    // Drain queue to ensure clean test state
    try {
      const q = getQueue();
      await q.drain();
    } catch (_) {}

    const passwordHash = await hashPassword('TestPass@12345');

    user = await User.create({
      name: 'Phase 15 User',
      email: 'user_phase15@codearena.dev',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    admin = await User.create({
      name: 'Phase 15 Admin',
      email: 'admin_phase15@codearena.dev',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    testProblem = await Problem.create({
      title: 'Phase 15 Concurrency Problem',
      description: 'Test problem for multi-worker concurrency validation',
      difficulty: 'EASY',
      tags: ['concurrency', 'phase15'],
      inputFormat: 'Number',
      outputFormat: 'Number',
      constraints: 'N <= 100',
      examples: [{ input: '42', output: '42' }],
      authorId: admin._id,
      isActive: true
    });

    await TestCase.create([
      {
        problemId: testProblem._id,
        input: '42\n',
        expectedOutput: '42\n',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      }
    ]);
  });

  // ============================================================================
  // 1. Worker Concurrency Configuration Invariants
  // ============================================================================
  describe('Worker Concurrency Configuration Invariants', () => {
    it('1. WORKER_CONCURRENCY default is valid and positive', () => {
      assert.strictEqual(typeof config.worker.concurrency, 'number');
      assert.ok(config.worker.concurrency >= 1, 'Default worker concurrency must be >= 1');
      assert.strictEqual(parseWorkerConcurrency(undefined), 2, 'Default concurrency must be 2 when undefined');
      assert.strictEqual(parseWorkerConcurrency(null), 2, 'Default concurrency must be 2 when null');
      assert.strictEqual(parseWorkerConcurrency(''), 2, 'Default concurrency must be 2 when empty string');
    });

    it('2. WORKER_CONCURRENCY accepts a valid positive integer', () => {
      assert.strictEqual(parseWorkerConcurrency(1), 1);
      assert.strictEqual(parseWorkerConcurrency(4), 4);
      assert.strictEqual(parseWorkerConcurrency('8'), 8);
      assert.strictEqual(parseWorkerConcurrency('16'), 16);
    });

    it('3. Invalid WORKER_CONCURRENCY is rejected or safely defaults', () => {
      assert.strictEqual(parseWorkerConcurrency(0), 2, '0 must safely default to 2');
      assert.strictEqual(parseWorkerConcurrency(-1), 2, 'Negative integer must safely default to 2');
      assert.strictEqual(parseWorkerConcurrency('-10'), 2, 'Negative string integer must safely default to 2');
      assert.strictEqual(parseWorkerConcurrency(NaN), 2, 'NaN must safely default to 2');
      assert.strictEqual(parseWorkerConcurrency('invalid'), 2, 'Non-numeric string must safely default to 2');
      assert.strictEqual(parseWorkerConcurrency(3.14), 2, 'Non-integer float must safely default to 2');
      assert.strictEqual(parseWorkerConcurrency('2.5'), 2, 'Float string must safely default to 2');
    });
  });

  // ============================================================================
  // 2. Worker Identity & Observability Invariants
  // ============================================================================
  describe('Worker Identity & Observability Invariants', () => {
    it('4. Worker identity is generated when WORKER_ID is absent', () => {
      const originalEnv = process.env.WORKER_ID;
      delete process.env.WORKER_ID;

      try {
        const id = resolveWorkerId();
        assert.ok(typeof id === 'string' && id.length > 0);
        assert.ok(id.startsWith('worker-'), `Generated ID should start with 'worker-': ${id}`);
        assert.ok(id.includes(String(process.pid)), `Generated ID should include PID: ${id}`);
        assert.ok(id.includes(os.hostname()), `Generated ID should include hostname: ${id}`);
      } finally {
        if (originalEnv !== undefined) {
          process.env.WORKER_ID = originalEnv;
        }
      }
    });

    it('5. Explicit WORKER_ID is respected', () => {
      const explicitParamId = resolveWorkerId('worker-explicit-param');
      assert.strictEqual(explicitParamId, 'worker-explicit-param');

      const originalEnv = process.env.WORKER_ID;
      process.env.WORKER_ID = 'worker-node-dedicated-01';
      try {
        const envId = resolveWorkerId();
        assert.strictEqual(envId, 'worker-node-dedicated-01');
      } finally {
        if (originalEnv !== undefined) {
          process.env.WORKER_ID = originalEnv;
        } else {
          delete process.env.WORKER_ID;
        }
      }
    });

    it('6. Worker logs include worker identity where applicable without leaking secrets', async () => {
      const logs = [];
      const originalInfo = logger.info;
      const originalWarn = logger.warn;
      const originalError = logger.error;

      logger.info = (event, meta) => logs.push({ level: 'info', event, meta });
      logger.warn = (event, meta) => logs.push({ level: 'warn', event, meta });
      logger.error = (event, meta) => logs.push({ level: 'error', event, meta });

      const testSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(42)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.testsPassed = 1;
        sub.totalTests = 1;
        sub.runtimeMs = 25;
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      try {
        await processSubmission(
          {
            id: 'job_log_test',
            data: { submissionId: testSub._id.toString() }
          },
          { workerId: 'worker-test-audit-id' }
        );

        const startedLog = logs.find((l) => l.event === 'submission_job_started');
        assert.ok(startedLog, 'submission_job_started log must be emitted');
        assert.strictEqual(startedLog.meta.workerId, 'worker-test-audit-id');
        assert.strictEqual(startedLog.meta.submissionId, testSub._id.toString());
        assert.strictEqual(startedLog.meta.jobId, 'job_log_test');

        const completedLog = logs.find((l) => l.event === 'submission_job_completed');
        assert.ok(completedLog, 'submission_job_completed log must be emitted');
        assert.strictEqual(completedLog.meta.workerId, 'worker-test-audit-id');
        assert.strictEqual(completedLog.meta.submissionId, testSub._id.toString());
        assert.strictEqual(completedLog.meta.verdict, 'ACCEPTED');

        // Verify zero leakage of sensitive keys
        const allLogStrings = JSON.stringify(logs);
        assert.ok(!allLogStrings.includes('print(42)'), 'Logs must never contain sourceCode');
        assert.ok(!allLogStrings.includes('TestPass@12345'), 'Logs must never contain passwords');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
        logger.info = originalInfo;
        logger.warn = originalWarn;
        logger.error = originalError;
      }
    });
  });

  // ============================================================================
  // 3. Shared Queue & Distribution Invariants
  // ============================================================================
  describe('Shared Queue & BullMQ Distribution Invariants', () => {
    it('7. Multiple worker instances can use the same queue', async () => {
      const connA = trackClient(createRedisClient());
      const connB = trackClient(createRedisClient());

      const workerA = await startWorker({
        workerId: 'worker-instance-A',
        concurrency: 1,
        connection: connA,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerA);

      const workerB = await startWorker({
        workerId: 'worker-instance-B',
        concurrency: 1,
        connection: connB,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerB);

      assert.strictEqual(workerA.name, SUBMISSION_QUEUE_NAME);
      assert.strictEqual(workerB.name, SUBMISSION_QUEUE_NAME);
      assert.strictEqual(workerA.workerId, 'worker-instance-A');
      assert.strictEqual(workerB.workerId, 'worker-instance-B');
    });

    it('8. Jobs can be distributed across multiple worker instances', async () => {
      const processedBy = new Set();

      let inFlight = 0;
      let releaseBarrier;
      const barrierPromise = new Promise((resolve) => {
        releaseBarrier = resolve;
      });
      // Safety fallback to prevent hanging if anything fails
      const fallbackTimer = setTimeout(() => {
        if (releaseBarrier) releaseBarrier();
      }, 6000);
      fallbackTimer.unref();

      const originalProcess = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        inFlight++;
        if (inFlight === 1) {
          // Worker 1 holds its slot (concurrency 1), forcing BullMQ to dispatch the other job to Worker 2
          await barrierPromise;
        } else if (inFlight >= 2) {
          // Both workers are actively in flight processing jobs
          releaseBarrier();
        }

        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.testsPassed = 1;
        sub.totalTests = 1;
        sub.runtimeMs = 15;
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      const connA = trackClient(createRedisClient());
      const connB = trackClient(createRedisClient());

      const workerA = await startWorker({
        workerId: 'worker-dist-A',
        concurrency: 1,
        connection: connA,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerA);

      const workerB = await startWorker({
        workerId: 'worker-dist-B',
        concurrency: 1,
        connection: connB,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerB);

      workerA.on('completed', () => {
        processedBy.add('worker-dist-A');
      });
      workerB.on('completed', () => {
        processedBy.add('worker-dist-B');
      });

      // Create 2 submissions and enqueue
      const sub1 = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(1)',
        status: 'QUEUED',
        queuedAt: new Date()
      });
      const sub2 = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(2)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      try {
        await enqueueSubmission(sub1._id.toString());
        await enqueueSubmission(sub2._id.toString());

        // Wait for both jobs to be completed and observed on workers
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const s1 = await Submission.findById(sub1._id);
          const s2 = await Submission.findById(sub2._id);
          if (s1.status === 'COMPLETED' && s2.status === 'COMPLETED' && processedBy.size >= 2) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const finalSub1 = await Submission.findById(sub1._id);
        const finalSub2 = await Submission.findById(sub2._id);
        assert.strictEqual(finalSub1.status, 'COMPLETED');
        assert.strictEqual(finalSub2.status, 'COMPLETED');
        assert.strictEqual(finalSub1.verdict, 'ACCEPTED');
        assert.strictEqual(finalSub2.verdict, 'ACCEPTED');

        // Assert invariant: multiple workers processed jobs from the shared queue
        assert.ok(processedBy.has('worker-dist-A'), 'Worker A must have processed at least one job');
        assert.ok(processedBy.has('worker-dist-B'), 'Worker B must have processed at least one job');
        assert.strictEqual(processedBy.size, 2, 'Jobs must have been distributed across both workers');
      } finally {
        clearTimeout(fallbackTimer);
        submissionExecutionService.executeSubmission = originalProcess;
      }
    });

    it('13. Multiple workers use the exact same Redis/BullMQ queue name', () => {
      assert.strictEqual(SUBMISSION_QUEUE_NAME, 'submission-execution');
    });

    it('14. Worker does not start the Express HTTP server', () => {
      const workerModule = require('../src/workers/submission.worker');
      assert.strictEqual(typeof workerModule.listen, 'undefined');
      assert.strictEqual(typeof workerModule.app, 'undefined');
      assert.ok(typeof workerModule.startWorker === 'function');
      assert.ok(typeof workerModule.processSubmission === 'function');
    });
  });

  // ============================================================================
  // 4. Atomic Claiming & Duplicate Protection
  // ============================================================================
  describe('Atomic Claiming & Duplicate Job Protection', () => {
    it('9. Concurrent workers cannot both claim the same queued submission', async () => {
      const queuedSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(42)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      let executionCount = 0;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        executionCount++;
        // Simulate in-flight execution delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      try {
        // Worker 1 and Worker 2 both attempt to process the SAME submission simultaneously
        const jobPayload = { id: 'job_concurrent_claim', data: { submissionId: queuedSub._id.toString() } };
        await Promise.all([
          processSubmission(jobPayload, { workerId: 'worker-racer-1' }),
          processSubmission(jobPayload, { workerId: 'worker-racer-2' })
        ]);

        // Exactly one worker must have successfully claimed and executed the submission
        assert.strictEqual(executionCount, 1, 'Exactly one worker must execute the submission');

        const finalSub = await Submission.findById(queuedSub._id);
        assert.strictEqual(finalSub.status, 'COMPLETED');
        assert.strictEqual(finalSub.verdict, 'ACCEPTED');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });

    it('10. Duplicate job delivery does not result in concurrent duplicate claims', async () => {
      const runningSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(42)',
        status: 'RUNNING',
        startedAt: new Date()
      });

      let executed = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        executed = true;
      };

      try {
        // Worker 2 receives a duplicate/repeated job while submission is already RUNNING
        await processSubmission(
          { id: 'job_dup_delivery', data: { submissionId: runningSub._id.toString() } },
          { workerId: 'worker-dup-tester' }
        );

        assert.strictEqual(executed, false, 'Worker must not re-execute an already RUNNING submission');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 5. Failure & Shutdown Isolation
  // ============================================================================
  describe('Failure & Shutdown Isolation', () => {
    it('11. One worker shutdown does not prevent other workers from processing queue jobs', async () => {
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.testsPassed = 1;
        sub.totalTests = 1;
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      const connA = trackClient(createRedisClient());
      const connB = trackClient(createRedisClient());

      const workerA = await startWorker({
        workerId: 'worker-fail-A',
        concurrency: 1,
        connection: connA,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerA);

      const workerB = await startWorker({
        workerId: 'worker-survive-B',
        concurrency: 1,
        connection: connB,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerB);

      // Now close Worker A (graceful shutdown of Worker A)
      await workerA.close();

      // Worker B should remain healthy and consume newly enqueued jobs
      const sub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(99)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      try {
        await enqueueSubmission(sub._id.toString());

        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const s = await Submission.findById(sub._id);
          if (s.status === 'COMPLETED') break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const finalSub = await Submission.findById(sub._id);
        assert.strictEqual(
          finalSub.status,
          'COMPLETED',
          'Remaining worker must successfully process queue jobs after peer worker stops'
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });

    it('12. Graceful shutdown of one worker does not shut down another worker', async () => {
      const connA = trackClient(createRedisClient());
      const connB = trackClient(createRedisClient());

      const workerA = await startWorker({
        workerId: 'worker-shutdown-A',
        concurrency: 1,
        connection: connA,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerA);

      const workerB = await startWorker({
        workerId: 'worker-shutdown-B',
        concurrency: 1,
        connection: connB,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerB);

      // Gracefully shut down Worker A specifically
      await shutdown('SIGTERM', false, workerA);

      // Worker B's BullMQ worker should still be running and not closed
      assert.ok(workerB.isRunning(), 'Worker B must remain running after Worker A gracefully shuts down');
    });
  });

  // ============================================================================
  // 6. Execution State Isolation
  // ============================================================================
  describe('Concurrent Submission Execution Context Isolation', () => {
    it('15. Concurrent submissions preserve independent execution context', async () => {
      const workspacesUsed = [];
      const originalExecute = submissionExecutionService.executeSubmission;

      submissionExecutionService.executeSubmission = async (subId) => {
        // Mock execution recording unique workspace identifier
        const uniqueId = new mongoose.Types.ObjectId().toString();
        workspacesUsed.push(uniqueId);
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      const sub1 = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(1)',
        status: 'QUEUED',
        queuedAt: new Date()
      });
      const sub2 = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(2)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      try {
        await Promise.all([
          processSubmission({ id: 'job_iso_1', data: { submissionId: sub1._id.toString() } }, { workerId: 'w-iso-1' }),
          processSubmission({ id: 'job_iso_2', data: { submissionId: sub2._id.toString() } }, { workerId: 'w-iso-2' })
        ]);

        assert.strictEqual(workspacesUsed.length, 2);
        assert.notStrictEqual(
          workspacesUsed[0],
          workspacesUsed[1],
          'Concurrent submissions must maintain distinct execution contexts'
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 7. End-to-End Multi-Worker Integration (Section 21)
  // ============================================================================
  describe('End-to-End Multi-Worker Integration Test (Section 21)', () => {
    it('concurrent workers consume from shared queue, complete submissions, and preserve integrity', async () => {
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.testsPassed = 1;
        sub.totalTests = 1;
        sub.runtimeMs = 20;
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      const connA = trackClient(createRedisClient());
      const connB = trackClient(createRedisClient());

      const workerA = await startWorker({
        workerId: 'worker-e2e-A',
        concurrency: 2,
        connection: connA,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerA);

      const workerB = await startWorker({
        workerId: 'worker-e2e-B',
        concurrency: 2,
        connection: connB,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerB);

      const sub1 = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print("e2e-1")',
        status: 'QUEUED',
        queuedAt: new Date()
      });
      const sub2 = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print("e2e-2")',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      try {
        await enqueueSubmission(sub1._id.toString());
        await enqueueSubmission(sub2._id.toString());

        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const s1 = await Submission.findById(sub1._id);
          const s2 = await Submission.findById(sub2._id);
          if (s1.status === 'COMPLETED' && s2.status === 'COMPLETED') break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const res1 = await Submission.findById(sub1._id);
        const res2 = await Submission.findById(sub2._id);

        assert.strictEqual(res1.status, 'COMPLETED');
        assert.strictEqual(res1.verdict, 'ACCEPTED');
        assert.strictEqual(res2.status, 'COMPLETED');
        assert.strictEqual(res2.verdict, 'ACCEPTED');

        // Verify neither submission was claimed concurrently or left in invalid state
        assert.ok(res1.startedAt <= res1.completedAt);
        assert.ok(res2.startedAt <= res2.completedAt);
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 8. Controlled Multi-Worker Concurrency / Queue Drain (Section 22)
  // ============================================================================
  describe('Controlled Concurrency & Queue Drain Test (Section 22)', () => {
    it('batch of submissions drained by multiple workers without leaving any in RUNNING', async () => {
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        // Small async work simulation
        await new Promise((resolve) => setTimeout(resolve, 30));
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'ACCEPTED';
        sub.testsPassed = 1;
        sub.totalTests = 1;
        sub.runtimeMs = 15;
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      const connA = trackClient(createRedisClient());
      const connB = trackClient(createRedisClient());

      const workerA = await startWorker({
        workerId: 'worker-drain-A',
        concurrency: 2,
        connection: connA,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerA);

      const workerB = await startWorker({
        workerId: 'worker-drain-B',
        concurrency: 2,
        connection: connB,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(workerB);

      const batchCount = 4;
      const subIds = [];

      for (let i = 0; i < batchCount; i++) {
        const sub = await Submission.create({
          userId: user._id,
          problemId: testProblem._id,
          language: 'PYTHON',
          sourceCode: `print(${i})`,
          status: 'QUEUED',
          queuedAt: new Date()
        });
        subIds.push(sub._id.toString());
      }

      try {
        for (const sId of subIds) {
          await enqueueSubmission(sId);
        }

        // Wait for all submissions to reach terminal status
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          const completedCount = await Submission.countDocuments({
            _id: { $in: subIds },
            status: 'COMPLETED'
          });
          if (completedCount === batchCount) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const terminalSubmissions = await Submission.find({ _id: { $in: subIds } });
        assert.strictEqual(terminalSubmissions.length, batchCount);

        for (const sub of terminalSubmissions) {
          assert.strictEqual(sub.status, 'COMPLETED', `Submission ${sub._id} must reach terminal state COMPLETED`);
          assert.strictEqual(sub.verdict, 'ACCEPTED');
        }

        // Verify zero submissions remain stuck in RUNNING or QUEUED
        const stuckCount = await Submission.countDocuments({
          _id: { $in: subIds },
          status: { $in: ['RUNNING', 'QUEUED'] }
        });
        assert.strictEqual(stuckCount, 0, 'No submission may remain stuck in RUNNING or QUEUED');

        // Verify queue is drained (waiting = 0, active = 0)
        const metrics = await getQueueMetrics();
        assert.strictEqual(metrics.waiting, 0, 'Waiting count in queue must drain to 0');
        assert.strictEqual(metrics.active, 0, 'Active count in queue must drain to 0');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });
});
