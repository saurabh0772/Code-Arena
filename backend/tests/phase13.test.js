/**
 * Phase 13 Redis + Queue Foundation Test Suite
 *
 * Validates:
 * 1. Redis Connection & Configuration:
 *    - Centralized config parsing, URL & standalone support
 *    - Mandatory BullMQ options: maxRetriesPerRequest: null, enableReadyCheck: false
 *    - Capped exponential retry strategy
 *    - Readiness check returns healthy status and latency
 * 2. BullMQ Queue Module:
 *    - Queue name strictly 'submission-execution'
 *    - Retry policy: attempts: 3, exponential backoff (1000ms delay)
 *    - Retention policy: removeOnComplete (1000/24h), removeOnFail (5000/7d)
 *    - Minimal payload rule: strictly { submissionId } only (no source code, secrets, or test cases)
 *    - Input validation rejects invalid submission IDs
 * 3. Idempotency:
 *    - BullMQ jobId strictly matches submissionId
 *    - Duplicate enqueues for the same submissionId are handled safely
 * 4. Queue Observability:
 *    - getQueueMetrics returns waiting, active, completed, failed, delayed counts
 *    - GET /api/v1/admin/queue-metrics enforces RBAC (401 unauthenticated, 403 regular user, 200 admin)
 * 5. Failure Handling:
 *    - Handled queue enqueue failure results in HTTP 503 QUEUE_UNAVAILABLE
 *    - Database record transitioned to FAILED with errorMessage
 *    - Handled errors do not leave record in QUEUED state
 * 6. Readiness Probe:
 *    - GET /ready verifies Redis health alongside MongoDB and Execution Engine
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase13-32chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const {
  getRedisConfigOptions,
  createRedisClient,
  getRedisConnection,
  checkRedisReadiness,
  closeRedisConnection
} = require('../src/config/redis');
const {
  SUBMISSION_QUEUE_NAME,
  getQueue,
  enqueueSubmission,
  getQueueMetrics,
  closeQueue
} = require('../src/queues/submission.queue');
const submissionService = require('../src/modules/submissions/submission.service');
const submissionQueueModule = require('../src/queues/submission.queue');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const Submission = require('../src/modules/submissions/submission.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');

describe('Phase 13 Redis + Queue Foundation Test Suite', () => {
  let user;
  let userToken;
  let admin;
  let adminToken;
  let activeProblem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();

    const redisStatus = await checkRedisReadiness();
    if (!redisStatus.ready) {
      console.warn('[Phase 13 Tests] Redis is not responsive at localhost:6379. Make sure Redis is running.');
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: /phase13/ });
      await Problem.deleteMany({ title: /Phase 13/ });
      await Submission.deleteMany({});
      await TestCase.deleteMany({});
      await disconnectDB();
    }
    await closeQueue();
    await closeRedisConnection();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /phase13/ });
    await Problem.deleteMany({ title: /Phase 13/ });
    await Submission.deleteMany({});
    await TestCase.deleteMany({});

    const passwordHash = await hashPassword('TestPass@12345');

    user = await User.create({
      name: 'Phase 13 User',
      email: 'user_phase13@codearena.dev',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    admin = await User.create({
      name: 'Phase 13 Admin',
      email: 'admin_phase13@codearena.dev',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    // Obtain JWT tokens
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPass@12345' });
    userToken = userLogin.body.data.token;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'TestPass@12345' });
    adminToken = adminLogin.body.data.token;

    // Create problem & test cases
    activeProblem = await Problem.create({
      title: 'Phase 13 Queue Test Problem',
      description: 'Test problem for queue validation',
      difficulty: 'EASY',
      tags: ['queue', 'redis'],
      inputFormat: 'Single number',
      outputFormat: 'Single number',
      constraints: 'N <= 100',
      examples: [{ input: '42', output: '42' }],
      authorId: admin._id,
      isActive: true
    });

    await TestCase.create([
      {
        problemId: activeProblem._id,
        input: '42\n',
        expectedOutput: '42\n',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      },
      {
        problemId: activeProblem._id,
        input: '100\n',
        expectedOutput: '100\n',
        visibility: 'HIDDEN',
        order: 2,
        isActive: true
      }
    ]);
  });

  // ============================================================================
  // 1. Redis Connection & Centralized Configuration
  // ============================================================================
  describe('Redis Centralized Configuration & Connection Management', () => {
    it('enforces mandatory BullMQ options in getRedisConfigOptions', () => {
      const options = getRedisConfigOptions();
      assert.strictEqual(options.maxRetriesPerRequest, null, 'maxRetriesPerRequest must be null for BullMQ');
      assert.strictEqual(options.enableReadyCheck, false, 'enableReadyCheck must be false for BullMQ');
      assert.strictEqual(typeof options.retryStrategy, 'function', 'retryStrategy must be a function');
    });

    it('calculates capped exponential retry backoff correctly', () => {
      const options = getRedisConfigOptions();
      const strategy = options.retryStrategy;

      assert.strictEqual(strategy(1), 100);
      assert.strictEqual(strategy(5), 500);
      assert.strictEqual(strategy(20), 2000);
      assert.strictEqual(strategy(30), 3000);
      assert.strictEqual(strategy(50), 3000, 'Retry delay must cap at 3000ms');
    });

    it('allows option overrides while preserving BullMQ compliance', () => {
      const options = getRedisConfigOptions({ commandTimeout: 5000 });
      assert.strictEqual(options.commandTimeout, 5000);
      assert.strictEqual(options.maxRetriesPerRequest, null);
      assert.strictEqual(options.enableReadyCheck, false);
    });

    it('getRedisConnection returns a singleton ioredis client that responds to ping', async () => {
      const client = getRedisConnection();
      assert.ok(client, 'Redis client instance should exist');
      const pong = await client.ping();
      assert.strictEqual(pong, 'PONG');
    });

    it('createRedisClient creates a distinct functional client instance', async () => {
      const client = createRedisClient();
      assert.ok(client, 'Independent client created');
      const pong = await client.ping();
      assert.strictEqual(pong, 'PONG');
      await client.quit();
    });

    it('checkRedisReadiness returns healthy status and latency', async () => {
      const result = await checkRedisReadiness();
      assert.strictEqual(result.ready, true);
      assert.strictEqual(result.status, 'healthy');
      assert.strictEqual(typeof result.latencyMs, 'number');
      assert.ok(result.latencyMs >= 0);
    });
  });

  // ============================================================================
  // 2. BullMQ Queue Module & Minimal Payload Invariant
  // ============================================================================
  describe('BullMQ Queue Initialization & Payload Security', () => {
    it('initializes queue with canonical name "submission-execution"', () => {
      assert.strictEqual(SUBMISSION_QUEUE_NAME, 'submission-execution');
      const queue = getQueue();
      assert.strictEqual(queue.name, 'submission-execution');
    });

    it('configures default job options with retry backoff and retention', () => {
      const queue = getQueue();
      const defaults = queue.defaultJobOptions;

      assert.strictEqual(defaults.attempts, 3, 'Must attempt up to 3 times');
      assert.deepStrictEqual(defaults.backoff, {
        type: 'exponential',
        delay: 1000
      });
      assert.strictEqual(defaults.removeOnComplete.count, 1000);
      assert.strictEqual(defaults.removeOnComplete.age, 86400);
      assert.strictEqual(defaults.removeOnFail.count, 5000);
      assert.strictEqual(defaults.removeOnFail.age, 604800);
    });

    it('rejects invalid or empty submissionId string', async () => {
      await assert.rejects(
        () => enqueueSubmission(''),
        /Valid submissionId string is required/
      );
      await assert.rejects(
        () => enqueueSubmission(null),
        /Valid submissionId string is required/
      );
      await assert.rejects(
        () => enqueueSubmission('   '),
        /Valid submissionId string is required/
      );
      await assert.rejects(
        () => enqueueSubmission(12345),
        /Valid submissionId string is required/
      );
    });

    it('enqueues strictly { submissionId } without leaking source code or credentials into Redis', async () => {
      const fakeSubmissionId = new mongoose.Types.ObjectId().toString();
      const job = await enqueueSubmission(fakeSubmissionId);

      assert.ok(job);
      assert.strictEqual(job.id, fakeSubmissionId, 'BullMQ jobId must equal submissionId');
      assert.strictEqual(job.name, 'execute');

      // Verify payload contains strictly submissionId and NOTHING ELSE
      assert.deepStrictEqual(job.data, { submissionId: fakeSubmissionId });
      assert.strictEqual(job.data.sourceCode, undefined, 'Never store source code in Redis');
      assert.strictEqual(job.data.testCases, undefined, 'Never store test cases in Redis');
      assert.strictEqual(job.data.token, undefined, 'Never store token in Redis');
      assert.strictEqual(job.data.password, undefined, 'Never store password in Redis');
      assert.strictEqual(Object.keys(job.data).length, 1, 'job.data must have exactly 1 property');

      // Fetch job back directly from queue to confirm Redis representation
      const queue = getQueue();
      const fetchedJob = await queue.getJob(fakeSubmissionId);
      assert.ok(fetchedJob);
      assert.deepStrictEqual(fetchedJob.data, { submissionId: fakeSubmissionId });

      // Clean up test job
      await fetchedJob.remove();
    });
  });

  // ============================================================================
  // 3. Queue Idempotency
  // ============================================================================
  describe('Queue Idempotency via BullMQ jobId', () => {
    it('uses submissionId as jobId to prevent duplicate job creation in Redis', async () => {
      const testSubmissionId = new mongoose.Types.ObjectId().toString();
      const queue = getQueue();

      const job1 = await enqueueSubmission(testSubmissionId);
      assert.strictEqual(job1.id, testSubmissionId);

      // Attempt duplicate enqueue with identical submissionId
      const job2 = await enqueueSubmission(testSubmissionId);
      assert.strictEqual(job2.id, testSubmissionId);

      // Clean up
      const job = await queue.getJob(testSubmissionId);
      if (job) await job.remove();
    });
  });

  // ============================================================================
  // 4. Queue Observability & Admin Metrics Endpoint
  // ============================================================================
  describe('Queue Observability & Admin Metrics API', () => {
    it('getQueueMetrics returns numeric counts for all BullMQ states', async () => {
      const metrics = await getQueueMetrics();
      assert.ok(metrics, 'Metrics object must be returned');
      assert.strictEqual(typeof metrics.waiting, 'number');
      assert.strictEqual(typeof metrics.active, 'number');
      assert.strictEqual(typeof metrics.completed, 'number');
      assert.strictEqual(typeof metrics.failed, 'number');
      assert.strictEqual(typeof metrics.delayed, 'number');
    });

    it('GET /api/v1/admin/queue-metrics rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/admin/queue-metrics');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('GET /api/v1/admin/queue-metrics rejects non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/queue-metrics')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('GET /api/v1/admin/queue-metrics returns 200 with queue metrics for ADMIN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/queue-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data);
      assert.strictEqual(typeof res.body.data.waiting, 'number');
      assert.strictEqual(typeof res.body.data.active, 'number');
      assert.strictEqual(typeof res.body.data.completed, 'number');
      assert.strictEqual(typeof res.body.data.failed, 'number');
      assert.strictEqual(typeof res.body.data.delayed, 'number');
    });
  });

  // ============================================================================
  // 5. Redis Failure Handling & Atomic State Transitions
  // ============================================================================
  describe('Redis Failure Handling in createSubmission', () => {
    it('transitions submission to FAILED and returns 503 QUEUE_UNAVAILABLE when queue fails', async () => {
      // Mock enqueueSubmission to simulate Redis outage
      const originalEnqueue = submissionQueueModule.enqueueSubmission;
      submissionQueueModule.enqueueSubmission = async () => {
        throw new Error('Connection to Redis refused (test simulation)');
      };

      try {
        const res = await request(app)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            problemId: activeProblem._id.toString(),
            language: 'PYTHON',
            sourceCode: 'print(42)'
          });

        assert.strictEqual(res.statusCode, 503, 'Must return HTTP 503 on queue failure');
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.errorCode, 'QUEUE_UNAVAILABLE');
        assert.strictEqual(
          res.body.message,
          'Failed to queue submission for processing. Please try again.'
        );

        // Verify the database record was transitioned to FAILED and not left in QUEUED
        const failedSub = await Submission.findOne({ userId: user._id, problemId: activeProblem._id });
        assert.ok(failedSub, 'Submission document must exist in MongoDB');
        assert.strictEqual(failedSub.status, 'FAILED');
        assert.ok(failedSub.failedAt, 'failedAt timestamp must be recorded');
        assert.strictEqual(failedSub.errorMessage, 'Failed to enqueue submission for processing');
      } finally {
        submissionQueueModule.enqueueSubmission = originalEnqueue;
      }
    });
  });

  // ============================================================================
  // 6. Deep Readiness Probe (/ready)
  // ============================================================================
  describe('Deep Readiness Probe with Redis Health', () => {
    it('GET /ready reports redis health status alongside db and execution engine', async () => {
      const res = await request(app).get('/ready');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'ready');
      assert.ok(res.body.checks.redis);
      assert.strictEqual(res.body.checks.redis.status, 'healthy');
      assert.strictEqual(res.body.checks.database.status, 'healthy');
    });
  });
});
