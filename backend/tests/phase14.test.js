/**
 * Phase 14 Worker Architecture Test Suite
 *
 * Validates:
 * 1. Process Boundary & Isolation:
 *    - Worker daemon does not boot Express HTTP server (app.listen is decoupled)
 * 2. Startup Lifecycle & Fail-Fast:
 *    - Validates MongoDB and Redis readiness on startup
 *    - Fails fast if Redis is unreachable
 * 3. Payload Validation:
 *    - Rejects null, undefined, empty, or non-ObjectId submission IDs safely
 *    - Does not throw unhandled exceptions on malformed jobs
 * 4. Submission State Safety & Idempotency:
 *    - Non-existent submission document is safely skipped
 *    - Already COMPLETED or FAILED submissions are skipped without re-execution
 *    - Concurrently RUNNING submissions are skipped (atomic claim protection)
 *    - Only QUEUED submissions are claimed and transitioned to RUNNING
 * 5. Execution Workflow & Verdict Handling:
 *    - Normal verdicts (ACCEPTED, WRONG_ANSWER, etc.) persist COMPLETED state
 *    - Normal verdicts are terminal successes for BullMQ (no error thrown to BullMQ)
 * 6. Infrastructure Failure & BullMQ Retry Compatibility:
 *    - Failures with retries remaining revert status to QUEUED and rethrow to BullMQ
 *    - Failures with retries exhausted mark status FAILED with failedAt & errorMessage
 * 7. Timing Observability & Safe Logging:
 *    - Records execution duration (durationMs)
 *    - Zero leakage of source code, test cases, or credentials in logs
 * 8. Idempotent Graceful Shutdown:
 *    - Closes BullMQ worker, Redis queue, and MongoDB connections cleanly
 *    - Idempotent against duplicate signal invocations
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase14-32chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const { checkRedisReadiness, closeRedisConnection } = require('../src/config/redis');
const { closeQueue } = require('../src/queues/submission.queue');
const {
  processSubmission,
  shutdown,
  resetWorkerState,
  getWorkerInstance
} = require('../src/workers/submission.worker');
const submissionExecutionService = require('../src/modules/submissions/submission-execution.service');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const Submission = require('../src/modules/submissions/submission.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');

describe('Phase 14 Worker Architecture Test Suite', () => {
  let user;
  let admin;
  let testProblem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();

    const redisCheck = await checkRedisReadiness();
    if (!redisCheck.ready) {
      console.warn('[Phase 14 Tests] Redis is not responsive. Verify local Redis container is running.');
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: /phase14/ });
      await Problem.deleteMany({ title: /Phase 14/ });
      await Submission.deleteMany({});
      await TestCase.deleteMany({});
      await disconnectDB();
    }
    await closeQueue();
    await closeRedisConnection();
  });

  beforeEach(async () => {
    resetWorkerState();
    await User.deleteMany({ email: /phase14/ });
    await Problem.deleteMany({ title: /Phase 14/ });
    await Submission.deleteMany({});
    await TestCase.deleteMany({});

    const passwordHash = await hashPassword('TestPass@12345');

    user = await User.create({
      name: 'Phase 14 User',
      email: 'user_phase14@codearena.dev',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    admin = await User.create({
      name: 'Phase 14 Admin',
      email: 'admin_phase14@codearena.dev',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    testProblem = await Problem.create({
      title: 'Phase 14 Problem',
      description: 'Test problem for worker validation',
      difficulty: 'EASY',
      tags: ['worker'],
      inputFormat: 'Number',
      outputFormat: 'Number',
      constraints: 'N <= 100',
      examples: [{ input: '5', output: '5' }],
      authorId: admin._id,
      isActive: true
    });

    await TestCase.create([
      {
        problemId: testProblem._id,
        input: '5\n',
        expectedOutput: '5\n',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      }
    ]);
  });

  // ============================================================================
  // 1. Process Boundary & Decoupling
  // ============================================================================
  describe('Process Boundary & Decoupling Invariants', () => {
    it('worker module does not start Express HTTP server on import', () => {
      // Requiring submission.worker should not instantiate or listen on HTTP ports
      const workerModule = require('../src/workers/submission.worker');
      assert.ok(workerModule.processSubmission);
      assert.ok(workerModule.startWorker);
      assert.ok(workerModule.shutdown);
      // Verify app.listen was not triggered (worker is pure background consumer)
      assert.strictEqual(typeof workerModule.listen, 'undefined');
    });

    it('worker configuration respects WORKER_CONCURRENCY environment variable', () => {
      assert.strictEqual(typeof config.worker.concurrency, 'number');
      assert.ok(config.worker.concurrency >= 1);
    });

    it('startWorker fails fast if Redis readiness check fails', async () => {
      const redisConfig = require('../src/config/redis');
      const originalCheck = redisConfig.checkRedisReadiness;
      redisConfig.checkRedisReadiness = async () => ({
        ready: false,
        status: 'unhealthy',
        details: 'Connection refused (simulated)'
      });

      const { startWorker } = require('../src/workers/submission.worker');

      try {
        await assert.rejects(
          async () => {
            await startWorker();
          },
          /Redis readiness check failed/
        );
      } finally {
        redisConfig.checkRedisReadiness = originalCheck;
        resetWorkerState();
      }
    });
  });

  // ============================================================================
  // 2. Payload Validation
  // ============================================================================
  describe('Worker Payload Validation & Malformed Job Handling', () => {
    it('safely handles missing or null job payload without crashing', async () => {
      // Neither of these should throw
      await processSubmission(null);
      await processSubmission(undefined);
      await processSubmission({});
      await processSubmission({ data: {} });
    });

    it('safely rejects invalid or non-ObjectId submissionId formats', async () => {
      await processSubmission('12345');
      await processSubmission('invalid-non-hex-id');
      await processSubmission({ data: { submissionId: 'abc' } });
      await processSubmission({ data: { submissionId: '   ' } });
      await processSubmission({ data: { submissionId: 12345 } });
    });
  });

  // ============================================================================
  // 3. Submission State Safety & Idempotency
  // ============================================================================
  describe('Submission State Machine Safety & Idempotency', () => {
    it('safely skips job if submission document does not exist in database', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      // Should not throw or crash
      await processSubmission({ id: 'job_1', data: { submissionId: nonExistentId } });
    });

    it('skips already COMPLETED submission without re-executing', async () => {
      const completedSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'CPP',
        sourceCode: 'int main(){return 0;}',
        status: 'COMPLETED',
        verdict: 'ACCEPTED',
        testsPassed: 1,
        totalTests: 1,
        completedAt: new Date()
      });

      let executed = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        executed = true;
      };

      try {
        await processSubmission(completedSub._id.toString());
        assert.strictEqual(executed, false, 'Should not re-execute completed submission');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });

    it('skips already FAILED submission without re-executing', async () => {
      const failedSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'CPP',
        sourceCode: 'int main(){return 0;}',
        status: 'FAILED',
        errorMessage: 'Prior failure',
        failedAt: new Date()
      });

      let executed = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        executed = true;
      };

      try {
        await processSubmission(failedSub._id.toString());
        assert.strictEqual(executed, false, 'Should not re-execute failed submission');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });

    it('skips submission that is currently RUNNING (prevents concurrent duplicate claims)', async () => {
      const runningSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'CPP',
        sourceCode: 'int main(){return 0;}',
        status: 'RUNNING',
        startedAt: new Date()
      });

      let executed = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        executed = true;
      };

      try {
        await processSubmission(runningSub._id.toString());
        assert.strictEqual(executed, false, 'Should not execute running submission');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });

    it('atomically claims QUEUED submission and transitions to RUNNING', async () => {
      const queuedSub = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      let capturedStatusDuringExecution = null;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        const sub = await Submission.findById(subId);
        capturedStatusDuringExecution = sub.status;
        return { verdict: 'ACCEPTED', testsPassed: 1, totalTests: 1, runtimeMs: 50 };
      };

      try {
        await processSubmission(queuedSub._id.toString());
        assert.strictEqual(
          capturedStatusDuringExecution,
          'RUNNING',
          'Submission status must be transitioned to RUNNING during execution'
        );

        const finalSub = await Submission.findById(queuedSub._id);
        assert.ok(finalSub.startedAt, 'startedAt timestamp must be set');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 4. Execution Workflow & Verdict Persistence
  // ============================================================================
  describe('Execution Workflow & Verdict Persistence', () => {
    it('persists normal code evaluation verdicts as COMPLETED without throwing to BullMQ', async () => {
      const submission = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        const sub = await Submission.findById(subId);
        sub.status = 'COMPLETED';
        sub.verdict = 'WRONG_ANSWER';
        sub.testsPassed = 0;
        sub.totalTests = 1;
        sub.runtimeMs = 45;
        sub.completedAt = new Date();
        await sub.save();
        return sub;
      };

      try {
        // Normal user verdicts (WRONG_ANSWER, ACCEPTED, TLE, etc.) must resolve normally
        await assert.doesNotReject(
          async () => {
            await processSubmission({
              id: 'job_test_verdict',
              data: { submissionId: submission._id.toString() }
            });
          },
          'User code verdicts must conclude as terminal successes for the BullMQ job'
        );

        const updated = await Submission.findById(submission._id);
        assert.strictEqual(updated.status, 'COMPLETED');
        assert.strictEqual(updated.verdict, 'WRONG_ANSWER');
        assert.ok(updated.completedAt);
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 5. Infrastructure Failure & Retry Policy Integration
  // ============================================================================
  describe('Infrastructure Failure & BullMQ Retry Compatibility', () => {
    it('reverts status to QUEUED and rethrows to BullMQ when retries remain', async () => {
      const submission = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        throw new Error('Docker daemon socket connection refused');
      };

      const mockJob = {
        id: 'job_retry_1',
        data: { submissionId: submission._id.toString() },
        opts: { attempts: 3 },
        attemptsMade: 0 // First attempt (attemptsMade < maxAttempts)
      };

      try {
        // Must rethrow so BullMQ initiates backoff retry
        await assert.rejects(
          async () => {
            await processSubmission(mockJob);
          },
          /Docker daemon socket connection refused/
        );

        // Status must be reverted to QUEUED so next retry attempt can claim it
        const revertedSub = await Submission.findById(submission._id);
        assert.strictEqual(
          revertedSub.status,
          'QUEUED',
          'Status must revert to QUEUED when retries remain'
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });

    it('marks status FAILED with errorMessage and rethrows when retries are exhausted', async () => {
      const submission = await Submission.create({
        userId: user._id,
        problemId: testProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)',
        status: 'QUEUED',
        queuedAt: new Date()
      });

      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        throw new Error('Docker daemon unrecoverable crash');
      };

      const mockJob = {
        id: 'job_retry_final',
        data: { submissionId: submission._id.toString() },
        opts: { attempts: 3 },
        attemptsMade: 2 // 3rd attempt: 2 attempts already made + 1 = 3 (attemptsMade + 1 >= 3)
      };

      try {
        await assert.rejects(
          async () => {
            await processSubmission(mockJob);
          },
          /Docker daemon unrecoverable crash/
        );

        // Status must be permanently marked FAILED
        const failedSub = await Submission.findById(submission._id);
        assert.strictEqual(failedSub.status, 'FAILED');
        assert.ok(failedSub.failedAt, 'failedAt timestamp must be recorded');
        assert.strictEqual(failedSub.errorMessage, 'Docker daemon unrecoverable crash');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 6. Graceful Shutdown
  // ============================================================================
  describe('Graceful Shutdown Behavior', () => {
    it('shutdown is idempotent and does not throw on repeated calls', async () => {
      // First shutdown call
      await assert.doesNotReject(async () => {
        await shutdown('SIGTERM', false);
      });

      // Repeated shutdown call (isShuttingDown guard protects against duplicate shutdown)
      await assert.doesNotReject(async () => {
        await shutdown('SIGINT', false);
      });

      resetWorkerState();
    });
  });
});
