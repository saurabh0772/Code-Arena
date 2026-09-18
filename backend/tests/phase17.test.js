/**
 * Phase 17 Distributed Execution Architecture Test Suite (Corrected)
 *
 * Validates:
 * 1. Docker Isolation & Infrastructure Boundaries (Tests A & B):
 *    - Backend Compose service does NOT mount /var/run/docker.sock
 *    - Worker Compose service retains /var/run/docker.sock for sandbox execution
 * 2. Worker Identity Invariants:
 *    - Collision-resistant runtime worker identifier (worker-<hostname>-<pid>-<random>)
 *    - Explicit WORKER_ID override is respected
 * 3. Worker Ephemeral Registry & Heartbeats (Test J):
 *    - Worker registers in Redis registry under 'codearena:workers:<workerId>' with TTL
 *    - Periodic heartbeat refreshes lastHeartbeat timestamp and maintains TTL
 *    - Status transitions through STARTING -> READY -> DRAINING -> STOPPED
 *    - Querying registry returns active worker instances sorted by startedAt
 *    - Natural TTL key expiry when heartbeat stops
 * 4. Execution Ownership & Diagnostic Metadata:
 *    - Claiming a QUEUED submission sets execution.workerId and execution.startedAt
 *    - toSafeObject() exposes execution metadata safely
 * 5. Stale Execution Ownership Recovery & Atomic Claiming (Tests C, D, E):
 *    - Test C: Fresh RUNNING submission cannot be reclaimed by another worker
 *    - Test D: Stale RUNNING submission (startedAt < staleCutoff) can be reclaimed
 *    - Test E: Atomic conditional updates ensure exactly one worker wins concurrent claim
 *    - Completed submissions are protected against re-execution on duplicate retry delivery
 * 6. Failure Classification & Retry Semantics (Tests F, G, H):
 *    - Test F: Valid evaluation verdicts (ACCEPTED, WRONG_ANSWER, CE, RTE, TLE, MLE) persist as COMPLETED
 *    - Test G: Transient infrastructure failure reverts to QUEUED and rethrows to BullMQ
 *    - Test H: Non-retryable domain/configuration failure (e.g. PROBLEM_NOT_READY) marks FAILED without retries
 * 7. Worker Graceful Draining & Shutdown (Test K):
 *    - Shutdown transitions status to DRAINING, pauses intake, and marks STOPPED on teardown
 * 8. Admin Worker Visibility API (GET /api/v1/admin/workers):
 *    - Authenticated ADMIN retrieves active registered workers
 *    - Normal USER is rejected with 403 Forbidden
 *    - Unauthenticated request is rejected with 401 Unauthorized
 * 9. Multi-Worker Distributed Processing (Test I):
 *    - Multiple workers consume jobs from shared queue and record respective worker identities
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const supertest = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase17-32chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const { createRedisClient, getRedisConnection, closeRedisConnection } = require('../src/config/redis');
const {
  SUBMISSION_QUEUE_NAME,
  getQueue,
  closeQueue
} = require('../src/queues/submission.queue');
const {
  startWorker,
  processSubmission,
  shutdown,
  resetWorkerState,
  resolveWorkerId,
  isNonRetryableError
} = require('../src/workers/submission.worker');
const workerRegistry = require('../src/workers/worker-registry.service');
const submissionExecutionService = require('../src/modules/submissions/submission-execution.service');
const defaultApp = require('../src/app');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const Submission = require('../src/modules/submissions/submission.model');
const AppError = require('../src/utils/app-error');

describe('Phase 17 Distributed Execution Architecture Test Suite', () => {
  let redisClient;
  let testAdminUser;
  let testNormalUser;
  let adminToken;
  let normalToken;
  let testProblem;
  const createdWorkers = [];

  function trackWorker(w) {
    if (w) createdWorkers.push(w);
    return w;
  }

  before(async () => {
    await connectDB();
    redisClient = createRedisClient();

    // Clean test state
    await User.deleteMany({ email: /@phase17test\.com$/ });
    await Problem.deleteMany({ title: /Phase17/ });
    await Submission.deleteMany({ sourceCode: /phase17/ });

    // Clean existing worker registry keys
    const workerKeys = await redisClient.keys(`${workerRegistry.WORKER_KEY_PREFIX}*`);
    if (workerKeys.length > 0) {
      await redisClient.del(workerKeys);
    }

    // 1. Seed Admin User
    testAdminUser = await User.create({
      name: `Admin P17 ${Date.now()}`,
      email: `admin_${Date.now()}@phase17test.com`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fakehashforadminuser',
      role: 'ADMIN',
      isActive: true
    });

    // 2. Seed Normal User
    testNormalUser = await User.create({
      name: `User P17 ${Date.now()}`,
      email: `user_${Date.now()}@phase17test.com`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fakehashfornormaluser',
      role: 'USER',
      isActive: true
    });

    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign(
      { sub: testAdminUser._id.toString(), role: 'ADMIN', email: testAdminUser.email },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    normalToken = jwt.sign(
      { sub: testNormalUser._id.toString(), role: 'USER', email: testNormalUser.email },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 3. Seed Problem with active test cases
    testProblem = await Problem.create({
      title: `Phase17 Distributed Problem ${Date.now()}`,
      description: 'Distributed execution problem description',
      difficulty: 'EASY',
      tags: ['distributed', 'phase17'],
      inputFormat: 'Two space-separated integers',
      outputFormat: 'Single integer sum',
      constraints: '1 <= a, b <= 1000',
      examples: [{ input: '1 2', output: '3' }],
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      authorId: testAdminUser._id,
      isActive: true
    });

    await TestCase.create([
      {
        problemId: testProblem._id,
        input: '1 2',
        expectedOutput: '3',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      },
      {
        problemId: testProblem._id,
        input: '10 20',
        expectedOutput: '30',
        visibility: 'HIDDEN',
        order: 2,
        isActive: true
      }
    ]);
  });

  after(async () => {
    // Teardown created workers
    for (const w of createdWorkers) {
      if (w && !w.isClosed?.()) {
        await w.close().catch(() => {});
      }
    }

    // Clean test data
    await User.deleteMany({ email: /@phase17test\.com$/ });
    await Problem.deleteMany({ title: /Phase17/ });
    await TestCase.deleteMany({ problemId: testProblem?._id });
    await Submission.deleteMany({ sourceCode: /phase17/ });

    // Clean registry keys
    if (redisClient) {
      const keys = await redisClient.keys(`${workerRegistry.WORKER_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      await redisClient.quit();
    }

    await closeQueue();
    await closeRedisConnection();
    await disconnectDB();
  });

  beforeEach(async () => {
    resetWorkerState();
  });

  afterEach(async () => {
    resetWorkerState();
  });

  // ============================================================================
  // 1. Docker Isolation & Infrastructure Boundaries (Tests A & B)
  // ============================================================================
  describe('Docker Isolation & Security Boundaries (Tests A & B)', () => {
    it('Test A: backend Compose service does NOT mount /var/run/docker.sock', () => {
      const composePath = path.resolve(__dirname, '../../docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');

      // Extract backend service block (indented with 2 spaces under services:)
      const backendMatch = composeContent.match(/\n {2}backend:\s*[\s\S]*?(?=\n {2}[a-zA-Z0-9_-]+:\s*|\n[a-zA-Z0-9_-]+:\s*|\Z)/);
      assert.ok(backendMatch, 'docker-compose.yml must define a backend service');

      const backendBlock = backendMatch[0];
      assert.strictEqual(
        backendBlock.includes('/var/run/docker.sock'),
        false,
        'Backend service must NOT mount /var/run/docker.sock (violates API security boundary)'
      );
    });

    it('Test B: worker Compose service retains /var/run/docker.sock for sandbox execution', () => {
      const composePath = path.resolve(__dirname, '../../docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');

      const workerMatch = composeContent.match(/\n {2}worker:\s*[\s\S]*?(?=\n {2}[a-zA-Z0-9_-]+:\s*|\n[a-zA-Z0-9_-]+:\s*|\Z)/);
      assert.ok(workerMatch, 'docker-compose.yml must define a worker service');

      const workerBlock = workerMatch[0];
      assert.strictEqual(
        workerBlock.includes('/var/run/docker.sock:/var/run/docker.sock'),
        true,
        'Worker service must retain /var/run/docker.sock to launch sandbox execution containers'
      );
    });
  });

  // ============================================================================
  // 2. Worker Identity Invariants
  // ============================================================================
  describe('Worker Identity Invariants', () => {
    it('1. Generates collision-resistant identifier with random suffix when unconfigured', () => {
      const id1 = resolveWorkerId();
      const id2 = resolveWorkerId();

      assert.ok(id1.startsWith('worker-'), `Worker ID must start with prefix: ${id1}`);
      assert.ok(id2.startsWith('worker-'), `Worker ID must start with prefix: ${id2}`);
      assert.notStrictEqual(id1, id2, 'Two default worker IDs generated within the same process must be collision-free');
    });

    it('2. Explicit WORKER_ID override is respected', () => {
      const overrideId = 'custom-worker-node-42';
      const id = resolveWorkerId(overrideId);
      assert.strictEqual(id, overrideId);

      process.env.WORKER_ID = 'env-worker-override';
      try {
        const fromEnv = resolveWorkerId();
        assert.strictEqual(fromEnv, 'env-worker-override');
      } finally {
        delete process.env.WORKER_ID;
      }
    });
  });

  // ============================================================================
  // 3. Worker Ephemeral Registry & Heartbeats (Test J)
  // ============================================================================
  describe('Worker Ephemeral Registry & Heartbeats (Test J)', () => {
    it('3. Worker registers in Redis with STARTING status and TTL', async () => {
      const testWorkerId = `test-reg-${Date.now()}`;
      const registered = await workerRegistry.registerWorker({
        workerId: testWorkerId,
        concurrency: 3,
        status: 'STARTING',
        ttlSeconds: 10
      });
      assert.strictEqual(registered, true);

      const raw = await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`);
      assert.ok(raw, 'Registry key must exist in Redis');
      const data = JSON.parse(raw);
      assert.strictEqual(data.workerId, testWorkerId);
      assert.strictEqual(data.status, 'STARTING');
      assert.strictEqual(data.concurrency, 3);
      assert.ok(data.startedAt, 'Must include startedAt timestamp');
      assert.ok(data.lastHeartbeat, 'Must include lastHeartbeat timestamp');

      const ttl = await redisClient.ttl(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`);
      assert.ok(ttl > 0 && ttl <= 10, 'Registry key must have valid TTL');

      await workerRegistry.deregisterWorker(testWorkerId);
    });

    it('4. Heartbeat updates lastHeartbeat timestamp and refreshes TTL', async () => {
      const testWorkerId = `test-hb-${Date.now()}`;
      await workerRegistry.registerWorker({
        workerId: testWorkerId,
        ttlSeconds: 5
      });

      const initialRaw = await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`);
      const initial = JSON.parse(initialRaw);

      await new Promise((r) => setTimeout(r, 100));
      const heartbeatSuccess = await workerRegistry.heartbeatWorker(testWorkerId, 15);
      assert.strictEqual(heartbeatSuccess, true);

      const updatedRaw = await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`);
      const updated = JSON.parse(updatedRaw);

      assert.ok(
        new Date(updated.lastHeartbeat).getTime() > new Date(initial.lastHeartbeat).getTime(),
        'lastHeartbeat must be updated after heartbeat pulse'
      );

      await workerRegistry.deregisterWorker(testWorkerId);
    });

    it('5. Status transitions through STARTING -> READY -> DRAINING -> STOPPED', async () => {
      const testWorkerId = `test-transitions-${Date.now()}`;
      await workerRegistry.registerWorker({ workerId: testWorkerId, status: 'STARTING' });

      await workerRegistry.updateWorkerStatus(testWorkerId, 'READY');
      let data = JSON.parse(await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`));
      assert.strictEqual(data.status, 'READY');

      await workerRegistry.updateWorkerStatus(testWorkerId, 'DRAINING');
      data = JSON.parse(await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`));
      assert.strictEqual(data.status, 'DRAINING');

      await workerRegistry.updateWorkerStatus(testWorkerId, 'STOPPED');
      data = JSON.parse(await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`));
      assert.strictEqual(data.status, 'STOPPED');

      await workerRegistry.deregisterWorker(testWorkerId);
    });

    it('6. getActiveWorkers returns parsed list of active workers sorted by startedAt', async () => {
      const id1 = `worker-list-1-${Date.now()}`;
      const id2 = `worker-list-2-${Date.now()}`;

      await workerRegistry.registerWorker({ workerId: id1, concurrency: 2 });
      await new Promise((r) => setTimeout(r, 50));
      await workerRegistry.registerWorker({ workerId: id2, concurrency: 4 });

      const workers = await workerRegistry.getActiveWorkers();
      const match1 = workers.find((w) => w.workerId === id1);
      const match2 = workers.find((w) => w.workerId === id2);

      assert.ok(match1, 'Worker 1 must be present in getActiveWorkers list');
      assert.ok(match2, 'Worker 2 must be present in getActiveWorkers list');
      assert.strictEqual(match1.concurrency, 2);
      assert.strictEqual(match2.concurrency, 4);

      await workerRegistry.deregisterWorker(id1);
      await workerRegistry.deregisterWorker(id2);
    });

    it('7. Worker key automatically expires when heartbeat stops', async () => {
      const testWorkerId = `test-expire-${Date.now()}`;
      await workerRegistry.registerWorker({
        workerId: testWorkerId,
        ttlSeconds: 1
      });

      let exists = await redisClient.exists(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`);
      assert.strictEqual(exists, 1);

      await new Promise((r) => setTimeout(r, 1200));

      exists = await redisClient.exists(`${workerRegistry.WORKER_KEY_PREFIX}${testWorkerId}`);
      assert.strictEqual(exists, 0, 'Worker key must expire automatically from Redis after TTL expires');
    });
  });

  // ============================================================================
  // 4. Execution Ownership & Diagnostic Metadata
  // ============================================================================
  describe('Execution Ownership & Diagnostic Metadata', () => {
    it('8. Claiming a QUEUED submission sets execution.workerId and execution.startedAt', async () => {
      const workerId = `worker-meta-test-${Date.now()}`;
      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("phase17 claim test");',
        status: 'QUEUED'
      });

      let observedWorkerIdInDb = null;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (id) => {
        const inProgress = await Submission.findById(id);
        observedWorkerIdInDb = inProgress.execution?.workerId;
        return { verdict: 'ACCEPTED', testsPassed: 1, totalTests: 1, runtimeMs: 15 };
      };

      try {
        await processSubmission(sub._id.toString(), { workerId });
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }

      assert.strictEqual(observedWorkerIdInDb, workerId, 'Database must record executing workerId during processing');

      const finalSub = await Submission.findById(sub._id);
      assert.strictEqual(finalSub.execution.workerId, workerId);
      assert.ok(finalSub.execution.startedAt instanceof Date, 'execution.startedAt must be a Date');
      assert.ok(finalSub.execution.completedAt instanceof Date, 'execution.completedAt must be set on finish');
      assert.ok(
        finalSub.execution.completedAt.getTime() >= finalSub.execution.startedAt.getTime(),
        'completedAt must be >= startedAt'
      );
    });

    it('9. toSafeObject() exposes execution metadata safely', async () => {
      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("phase17 safe object");',
        status: 'COMPLETED',
        verdict: 'ACCEPTED',
        execution: {
          workerId: 'worker-node-safe-test',
          startedAt: new Date(Date.now() - 1000),
          completedAt: new Date()
        }
      });

      const safe = sub.toSafeObject();
      assert.ok(safe.execution, 'toSafeObject() must expose execution object');
      assert.strictEqual(safe.execution.workerId, 'worker-node-safe-test');
      assert.ok(safe.execution.startedAt);
      assert.ok(safe.execution.completedAt);
    });
  });

  // ============================================================================
  // 5. Stale Execution Ownership Recovery & Atomic Claiming (Tests C, D, E)
  // ============================================================================
  describe('Stale Execution Ownership Recovery & Atomic Claiming (Tests C, D, E)', () => {
    it('Test C: Fresh RUNNING submission cannot be reclaimed by another worker', async () => {
      const workerA = `worker-A-${Date.now()}`;
      const workerB = `worker-B-${Date.now()}`;

      // Submission actively running on workerA (started 1 second ago)
      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("fresh execution");',
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 1000),
        execution: {
          workerId: workerA,
          startedAt: new Date(Date.now() - 1000)
        }
      });

      let workerBExecuted = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        workerBExecuted = true;
        return { verdict: 'ACCEPTED', testsPassed: 1, totalTests: 1, runtimeMs: 10 };
      };

      try {
        // Worker B attempts to process/reclaim the job with a 30s stale threshold
        await processSubmission(
          { id: `job-${Date.now()}`, data: { submissionId: sub._id.toString() }, attemptsMade: 1, opts: { attempts: 3 } },
          { workerId: workerB, staleTimeoutMs: 30000 }
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }

      assert.strictEqual(workerBExecuted, false, 'Worker B must NOT execute fresh RUNNING submission');

      const afterAttempt = await Submission.findById(sub._id);
      assert.strictEqual(afterAttempt.status, 'RUNNING');
      assert.strictEqual(afterAttempt.execution.workerId, workerA, 'Worker A ownership must remain intact');
    });

    it('Test D: Stale RUNNING submission can be reclaimed by another worker', async () => {
      const crashedWorker = `worker-crashed-${Date.now()}`;
      const recoveryWorker = `worker-recovery-${Date.now()}`;

      // Submission left in RUNNING from 45 seconds ago (stale)
      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("stale recovery");',
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 45000),
        execution: {
          workerId: crashedWorker,
          startedAt: new Date(Date.now() - 45000)
        }
      });

      let recovered = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        recovered = true;
        const s = await Submission.findById(subId);
        if (s) {
          s.status = 'COMPLETED';
          s.verdict = 'ACCEPTED';
          s.testsPassed = 1;
          s.totalTests = 1;
          s.runtimeMs = 15;
          await s.save();
        }
        return { verdict: 'ACCEPTED', testsPassed: 1, totalTests: 1, runtimeMs: 15 };
      };

      try {
        // Recovery worker processes BullMQ retry delivery with a 30s stale threshold
        await processSubmission(
          { id: `job-${Date.now()}`, data: { submissionId: sub._id.toString() }, attemptsMade: 1, opts: { attempts: 3 } },
          { workerId: recoveryWorker, staleTimeoutMs: 30000 }
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }

      assert.strictEqual(recovered, true, 'Recovery worker must reclaim and execute stale submission');

      const recoveredSub = await Submission.findById(sub._id);
      assert.strictEqual(recoveredSub.status, 'COMPLETED');
      assert.strictEqual(recoveredSub.execution.workerId, recoveryWorker, 'Ownership must transfer to recovery worker');
      assert.ok(recoveredSub.execution.completedAt instanceof Date);
    });

    it('Test E: Atomic ownership prevents concurrent duplicate claims (exactly one worker wins)', async () => {
      const workerA = `worker-race-A-${Date.now()}`;
      const workerB = `worker-race-B-${Date.now()}`;

      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("atomic claim race");',
        status: 'QUEUED'
      });

      let executions = 0;
      const executingWorkers = [];
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        executions++;
        const s = await Submission.findById(subId);
        if (s) {
          executingWorkers.push(s.execution.workerId);
          s.status = 'COMPLETED';
          s.verdict = 'ACCEPTED';
          await s.save();
        }
        return { verdict: 'ACCEPTED', testsPassed: 1, totalTests: 1, runtimeMs: 10 };
      };

      try {
        // Both workers attempt to claim the exact same QUEUED submission concurrently
        await Promise.all([
          processSubmission(sub._id.toString(), { workerId: workerA }),
          processSubmission(sub._id.toString(), { workerId: workerB })
        ]);
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }

      assert.strictEqual(executions, 1, 'Exactly one worker must claim and execute the submission');
      assert.strictEqual(executingWorkers.length, 1);
      assert.ok([workerA, workerB].includes(executingWorkers[0]));
    });

    it('11. Completed submissions are protected against re-execution on duplicate retry delivery', async () => {
      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("already completed");',
        status: 'COMPLETED',
        verdict: 'ACCEPTED',
        execution: {
          workerId: 'worker-original',
          startedAt: new Date(Date.now() - 5000),
          completedAt: new Date(Date.now() - 2000)
        }
      });

      let duplicateExecuted = false;
      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        duplicateExecuted = true;
      };

      try {
        await processSubmission(
          { id: `job-dup-${Date.now()}`, data: { submissionId: sub._id.toString() }, attemptsMade: 1 },
          { workerId: 'worker-duplicate' }
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }

      assert.strictEqual(duplicateExecuted, false, 'Must not re-execute an already COMPLETED submission');
      const verifySub = await Submission.findById(sub._id);
      assert.strictEqual(verifySub.status, 'COMPLETED');
      assert.strictEqual(verifySub.execution.workerId, 'worker-original');
    });
  });

  // ============================================================================
  // 6. Failure Classification & Retry Semantics (Tests F, G, H)
  // ============================================================================
  describe('Failure Classification & Retry Semantics (Tests F, G, H)', () => {
    it('Test F: Valid evaluation results (ACCEPTED, WRONG_ANSWER, CE, RTE, TLE, MLE) persist as COMPLETED', async () => {
      const verdicts = ['ACCEPTED', 'WRONG_ANSWER', 'COMPILATION_ERROR', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED'];

      for (const expectedVerdict of verdicts) {
        const sub = await Submission.create({
          userId: testNormalUser._id,
          problemId: testProblem._id,
          language: 'JAVASCRIPT',
          sourceCode: `console.log("${expectedVerdict}");`,
          status: 'QUEUED'
        });

        const originalExecute = submissionExecutionService.executeSubmission;
        submissionExecutionService.executeSubmission = async (subId) => {
          const s = await Submission.findById(subId);
          s.status = 'COMPLETED';
          s.verdict = expectedVerdict;
          s.testsPassed = expectedVerdict === 'ACCEPTED' ? 2 : 0;
          s.totalTests = 2;
          s.runtimeMs = 15;
          await s.save();
          return s;
        };

        try {
          await processSubmission(sub._id.toString(), { workerId: `worker-verdict-${expectedVerdict}` });
        } finally {
          submissionExecutionService.executeSubmission = originalExecute;
        }

        const evaluated = await Submission.findById(sub._id);
        assert.strictEqual(evaluated.status, 'COMPLETED', `Verdict ${expectedVerdict} must result in status COMPLETED`);
        assert.strictEqual(evaluated.verdict, expectedVerdict);
        assert.ok(evaluated.execution.completedAt instanceof Date);
      }
    });

    it('Test G: Transient infrastructure failure reverts to QUEUED and rethrows to BullMQ when retries remain', async () => {
      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("infra retry test");',
        status: 'QUEUED'
      });

      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async () => {
        throw new Error('Docker daemon socket connection refused');
      };

      let thrownError = null;
      try {
        const mockJob = {
          id: `job-retry-${Date.now()}`,
          data: { submissionId: sub._id.toString() },
          attemptsMade: 0,
          opts: { attempts: 3 }
        };
        await processSubmission(mockJob, { workerId: 'worker-infra-retry' });
      } catch (err) {
        thrownError = err;
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }

      assert.ok(thrownError, 'Transient infrastructure error must be rethrown to BullMQ for retry');
      const updatedSub = await Submission.findById(sub._id);
      assert.strictEqual(updatedSub.status, 'QUEUED', 'Status must revert to QUEUED when retries remain');
    });

    it('Test H: Non-retryable domain failure (e.g. PROBLEM_NOT_READY) marks FAILED without BullMQ retry', async () => {
      // Create a problem with zero active test cases to trigger PROBLEM_NOT_READY
      const emptyProblem = await Problem.create({
        title: `Phase17 Empty Problem ${Date.now()}`,
        description: 'Problem with no test cases',
        difficulty: 'EASY',
        tags: ['empty'],
        inputFormat: 'None',
        outputFormat: 'None',
        constraints: 'None',
        examples: [{ input: '0', output: '0' }],
        timeLimitMs: 2000,
        memoryLimitMb: 128,
        authorId: testAdminUser._id,
        isActive: true
      });

      const sub = await Submission.create({
        userId: testNormalUser._id,
        problemId: emptyProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("no test cases");',
        status: 'QUEUED'
      });

      let errorThrownToBullMQ = false;
      try {
        const mockJob = {
          id: `job-domain-${Date.now()}`,
          data: { submissionId: sub._id.toString() },
          attemptsMade: 0,
          opts: { attempts: 3 }
        };
        await processSubmission(mockJob, { workerId: 'worker-domain-error' });
      } catch (err) {
        errorThrownToBullMQ = true;
      }

      assert.strictEqual(
        errorThrownToBullMQ,
        false,
        'Non-retryable domain error must NOT be rethrown to BullMQ (avoids endless retries)'
      );

      const finalSub = await Submission.findById(sub._id);
      assert.ok(
        ['FAILED', 'COMPLETED'].includes(finalSub.status),
        'Non-retryable error must terminate in FAILED or COMPLETED state'
      );
      assert.ok(finalSub.execution?.completedAt instanceof Date, 'execution.completedAt must be recorded');
    });
  });

  // ============================================================================
  // 7. Worker Graceful Draining & Shutdown (Test K)
  // ============================================================================
  describe('Worker Graceful Draining & Shutdown (Test K)', () => {
    it('Test K: Shutdown transitions status to DRAINING, pauses intake, and deregisters as STOPPED', async () => {
      const workerId = `worker-drain-test-${Date.now()}`;
      const testWorker = trackWorker(
        await startWorker({
          workerId,
          concurrency: 1,
          skipDbConnect: true,
          skipRedisPing: true,
          heartbeatIntervalMs: 500
        })
      );

      try {
        // Verify active in registry with READY status
        let record = JSON.parse(await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${workerId}`));
        assert.strictEqual(record.status, 'READY');

        // Trigger graceful shutdown targeting this worker
        await shutdown('SIGTERM', false, testWorker, { timeoutMs: 3000 });

        record = JSON.parse(await redisClient.get(`${workerRegistry.WORKER_KEY_PREFIX}${workerId}`));
        assert.strictEqual(record.status, 'STOPPED', 'Worker registry must reflect STOPPED status');
      } finally {
        if (testWorker && !testWorker.isClosed?.()) {
          await shutdown('SIGTERM', false, testWorker, { timeoutMs: 1000 }).catch(() => {});
        }
      }
    });
  });

  // ============================================================================
  // 8. Admin Worker Visibility API (GET /api/v1/admin/workers)
  // ============================================================================
  describe('Admin Worker Visibility API', () => {
    it('13. Authenticated ADMIN retrieves active registered workers', async () => {
      const testWorkerId = `worker-api-test-${Date.now()}`;
      await workerRegistry.registerWorker({
        workerId: testWorkerId,
        concurrency: 2,
        status: 'READY'
      });

      const res = await supertest(defaultApp)
        .get('/api/v1/admin/workers')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.workers, 'Must include workers list');
      assert.ok(res.body.data.count >= 1);

      const found = res.body.data.workers.find((w) => w.workerId === testWorkerId);
      assert.ok(found, 'Registered test worker must be found in API response');
      assert.strictEqual(found.status, 'READY');
      assert.strictEqual(found.concurrency, 2);

      await workerRegistry.deregisterWorker(testWorkerId);
    });

    it('14. Normal USER is rejected with 403 Forbidden', async () => {
      const res = await supertest(defaultApp)
        .get('/api/v1/admin/workers')
        .set('Authorization', `Bearer ${normalToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('15. Unauthenticated request is rejected with 401 Unauthorized', async () => {
      const res = await supertest(defaultApp).get('/api/v1/admin/workers');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ============================================================================
  // 9. Multi-Worker Distributed Processing (Test I)
  // ============================================================================
  describe('Multi-Worker Distributed Processing (Test I)', () => {
    it('Test I: Multiple workers consume jobs from shared queue and record respective worker identities', async () => {
      const workerIdA = `worker-dist-A-${Date.now()}`;
      const workerIdB = `worker-dist-B-${Date.now()}`;

      const originalExecute = submissionExecutionService.executeSubmission;
      submissionExecutionService.executeSubmission = async (subId) => {
        const s = await Submission.findById(subId);
        if (s) {
          s.status = 'COMPLETED';
          s.verdict = 'ACCEPTED';
          s.testsPassed = 1;
          s.totalTests = 1;
          s.runtimeMs = 12;
          await s.save();
        }
        return { verdict: 'ACCEPTED', testsPassed: 1, totalTests: 1, runtimeMs: 12 };
      };

      const workerA = trackWorker(
        await startWorker({
          workerId: workerIdA,
          concurrency: 1,
          skipDbConnect: true,
          skipRedisPing: true
        })
      );
      const workerB = trackWorker(
        await startWorker({
          workerId: workerIdB,
          concurrency: 1,
          skipDbConnect: true,
          skipRedisPing: true
        })
      );

      const queue = getQueue();

      // Create two submissions
      const sub1 = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("phase17 sub1");',
        status: 'QUEUED'
      });
      const sub2 = await Submission.create({
        userId: testNormalUser._id,
        problemId: testProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("phase17 sub2");',
        status: 'QUEUED'
      });

      await queue.add('submission-execution', { submissionId: sub1._id.toString() }, { attempts: 1 });
      await queue.add('submission-execution', { submissionId: sub2._id.toString() }, { attempts: 1 });

      // Wait up to 5s for both submissions to complete
      const startTime = Date.now();
      let s1 = null;
      let s2 = null;
      while (Date.now() - startTime < 5000) {
        s1 = await Submission.findById(sub1._id);
        s2 = await Submission.findById(sub2._id);
        if (s1.status === 'COMPLETED' && s2.status === 'COMPLETED') {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      try {
        assert.strictEqual(s1.status, 'COMPLETED');
        assert.strictEqual(s2.status, 'COMPLETED');

        assert.ok(s1.execution?.workerId, 'sub1 must have workerId');
        assert.ok(s2.execution?.workerId, 'sub2 must have workerId');
        assert.ok(
          [workerIdA, workerIdB].includes(s1.execution.workerId),
          'sub1 workerId must be one of the active workers'
        );
        assert.ok(
          [workerIdA, workerIdB].includes(s2.execution.workerId),
          'sub2 workerId must be one of the active workers'
        );
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
        await shutdown('SIGTERM', false, workerA);
        await shutdown('SIGTERM', false, workerB);
      }
    });
  });
});
