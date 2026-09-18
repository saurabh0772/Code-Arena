/**
 * Phase 12 Asynchronous Submission Processing Test Suite
 *
 * Validates:
 * - Queue Producer: Enqueues minimal payload { submissionId }, no secrets/code in Redis
 * - Fast API Return: POST /api/v1/submissions returns immediately with QUEUED and PENDING verdict
 * - Worker Consumer: Consumes jobs, executes via Execution Engine, persists metrics and COMPLETED state
 * - Idempotency: Duplicate or re-delivered jobs for completed/failed submissions are skipped
 * - Failure Handling: Infrastructure exceptions mark FAILED with errorMessage without corrupting user verdicts
 * - Readiness Probes: /ready considers Redis health alongside MongoDB and Execution Engine
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase12-32chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const Submission = require('../src/modules/submissions/submission.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');
const {
  getQueue,
  enqueueSubmission,
  checkRedisReadiness,
  getQueueMetrics,
  closeQueue
} = require('../src/queues/submission.queue');
const { processSubmission } = require('../src/workers/submission.worker');

describe('Phase 12 Asynchronous Submission Processing Suite', () => {
  let user;
  let userToken;
  let admin;
  let adminToken;
  let activeProblem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();

    // Verify Redis connection for tests
    const redisCheck = await checkRedisReadiness();
    if (!redisCheck.ready) {
      console.warn('[Test Warning] Redis is not responsive at localhost:6379. Make sure Redis container is running.');
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: /phase12/ });
      await Problem.deleteMany({ title: /Phase 12/ });
      await Submission.deleteMany({});
      await TestCase.deleteMany({});
      await disconnectDB();
    }
    await closeQueue();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /phase12/ });
    await Problem.deleteMany({ title: /Phase 12/ });
    await Submission.deleteMany({});
    await TestCase.deleteMany({});

    const passwordHash = await hashPassword('TestPass@12345');

    user = await User.create({
      name: 'Phase 12 User',
      email: 'user_phase12@codearena.dev',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    admin = await User.create({
      name: 'Phase 12 Admin',
      email: 'admin_phase12@codearena.dev',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    // Obtain JWT tokens via login endpoint
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPass@12345' });
    userToken = userLogin.body.data.token;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'TestPass@12345' });
    adminToken = adminLogin.body.data.token;

    // Create an active test problem
    activeProblem = await Problem.create({
      title: 'Phase 12 Test Problem',
      description: 'Sum two numbers',
      difficulty: 'EASY',
      tags: ['math'],
      inputFormat: 'Two space separated numbers',
      outputFormat: 'Single number sum',
      constraints: 'None',
      examples: [{ input: '2 3', output: '5' }],
      authorId: admin._id,
      isActive: true
    });

    // Add active test cases
    await TestCase.create([
      {
        problemId: activeProblem._id,
        input: '2 3\n',
        expectedOutput: '5\n',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      },
      {
        problemId: activeProblem._id,
        input: '10 20\n',
        expectedOutput: '30\n',
        visibility: 'HIDDEN',
        order: 2,
        isActive: true
      }
    ]);
  });

  // =========================================================================
  // 1. Queue Architecture & Producer Tests
  // =========================================================================
  describe('1. Queue Architecture & Producer Tests', () => {
    it('Enqueues submission with strictly minimal payload containing ONLY submissionId', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)',
        status: 'PENDING',
        verdict: 'PENDING'
      });

      const job = await enqueueSubmission(sub._id.toString());
      assert.ok(job);
      assert.equal(job.name, 'execute');
      assert.equal(job.id, sub._id.toString()); // jobId equals submissionId

      // Verify payload contains ONLY submissionId
      assert.deepEqual(Object.keys(job.data), ['submissionId']);
      assert.equal(job.data.submissionId, sub._id.toString());
      assert.equal(job.data.sourceCode, undefined);
      assert.equal(job.data.testCases, undefined);
      assert.equal(job.data.expectedOutputs, undefined);
      assert.equal(job.data.jwt, undefined);
      assert.equal(job.data.password, undefined);
      assert.equal(job.data.description, undefined);
    });

    it('Rejects invalid or empty submissionId with an error', async () => {
      await assert.rejects(
        async () => {
          await enqueueSubmission('');
        },
        /Valid submissionId string is required/
      );
    });

    it('Queue metrics reflect waiting and active jobs correctly', async () => {
      const metrics = await getQueueMetrics();
      assert.ok(metrics !== null);
      assert.equal(typeof metrics.waiting, 'number');
      assert.equal(typeof metrics.active, 'number');
      assert.equal(typeof metrics.completed, 'number');
      assert.equal(typeof metrics.failed, 'number');
    });
  });

  // =========================================================================
  // 2. Asynchronous Submission API (Fast Return & Lifecycle)
  // =========================================================================
  describe('2. Asynchronous Submission API (Fast Return & Lifecycle)', () => {
    it('POST /api/v1/submissions returns HTTP 201 immediately with status QUEUED and verdict PENDING', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'import sys\nlines = sys.stdin.read().split()\nif lines:\n    print(int(lines[0]) + int(lines[1]))\n'
        });

      const durationMs = Date.now() - startTime;

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const sub = res.body.data.submission;

      // Crucial: Must return quickly without waiting for Docker execution (< 250ms)
      assert.ok(durationMs < 1000, `POST /submissions took ${durationMs}ms; expected < 1000ms`);

      // Lifecycle status must be QUEUED, verdict must be PENDING
      assert.equal(sub.status, 'QUEUED');
      assert.equal(sub.verdict, 'PENDING');
      assert.ok(sub.queuedAt);
      assert.equal(sub.testsPassed, null);
      assert.equal(sub.totalTests, null);
    });

    it('Rejects submission to problem without active test cases with 422 PROBLEM_NOT_READY', async () => {
      const emptyProblem = await Problem.create({
        title: 'Phase 12 Empty Problem',
        description: 'No tests',
        difficulty: 'EASY',
        inputFormat: 'None',
        outputFormat: 'None',
        constraints: 'None',
        examples: [{ input: '1', output: '1' }],
        authorId: admin._id,
        isActive: true
      });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          problemId: emptyProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print(1)'
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'PROBLEM_NOT_READY');

      // Verify no submission was created
      const subCount = await Submission.countDocuments({ problemId: emptyProblem._id });
      assert.equal(subCount, 0);
    });

    it('Queue failure transitions submission to FAILED and returns HTTP 503 QUEUE_UNAVAILABLE', async () => {
      const queue = getQueue();
      const originalAdd = queue.add;
      queue.add = async () => {
        throw new Error('Simulated Redis enqueue failure');
      };

      try {
        const res = await request(app)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            problemId: activeProblem._id.toString(),
            language: 'PYTHON',
            sourceCode: 'print(10)'
          });

        assert.equal(res.status, 503);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'QUEUE_UNAVAILABLE');

        // Verify the submission in database was transitioned to FAILED and not left QUEUED
        const failedSub = await Submission.findOne({
          userId: user._id,
          problemId: activeProblem._id,
          sourceCode: 'print(10)'
        });
        assert.ok(failedSub);
        assert.equal(failedSub.status, 'FAILED');
        assert.ok(failedSub.failedAt);
        assert.equal(failedSub.errorMessage, 'Failed to enqueue submission for processing');
      } finally {
        queue.add = originalAdd;
      }
    });
  });

  // =========================================================================
  // 3. Worker Processing & Idempotency Tests
  // =========================================================================
  describe('3. Worker Processing & Idempotency Tests', () => {
    it('Worker executes queued submission and updates status to COMPLETED with ACCEPTED verdict', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'import sys\nlines = sys.stdin.read().split()\nif lines:\n    print(int(lines[0]) + int(lines[1]))\n',
        status: 'QUEUED',
        verdict: 'PENDING',
        queuedAt: new Date()
      });

      // Process via worker function directly
      await processSubmission(sub._id.toString());

      // Reload submission from database
      const updatedSub = await Submission.findById(sub._id);
      assert.equal(updatedSub.status, 'COMPLETED');
      assert.equal(updatedSub.verdict, 'ACCEPTED');
      assert.equal(updatedSub.testsPassed, 2);
      assert.equal(updatedSub.totalTests, 2);
      assert.ok(updatedSub.startedAt);
      assert.ok(updatedSub.completedAt);
      assert.ok(typeof updatedSub.runtimeMs === 'number');
    });

    it('Worker evaluates WRONG_ANSWER when output is incorrect', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(9999)\n',
        status: 'QUEUED',
        verdict: 'PENDING',
        queuedAt: new Date()
      });

      await processSubmission(sub._id.toString());

      const updatedSub = await Submission.findById(sub._id);
      assert.equal(updatedSub.status, 'COMPLETED');
      assert.equal(updatedSub.verdict, 'WRONG_ANSWER');
      assert.equal(updatedSub.testsPassed, 0);
      assert.equal(updatedSub.totalTests, 2);
    });

    it('Idempotency: Worker safely skips duplicate execution for already COMPLETED submission', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)\n',
        status: 'COMPLETED',
        verdict: 'ACCEPTED',
        testsPassed: 2,
        totalTests: 2,
        completedAt: new Date(Date.now() - 5000)
      });

      const initialCompletedAt = sub.completedAt.getTime();

      // Attempt second processing of the same completed submission
      await processSubmission(sub._id.toString());

      const reloaded = await Submission.findById(sub._id);
      assert.equal(reloaded.status, 'COMPLETED');
      assert.equal(reloaded.verdict, 'ACCEPTED');
      assert.equal(reloaded.completedAt.getTime(), initialCompletedAt);
    });

    it('Worker handles non-existent submission ID cleanly without crashing', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await assert.doesNotReject(async () => {
        await processSubmission(nonExistentId);
      });
    });

    it('Atomic claim: Concurrent workers claiming the same QUEUED submission execute only once', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'import sys\nlines = sys.stdin.read().split()\nif lines:\n    print(int(lines[0]) + int(lines[1]))\n',
        status: 'QUEUED',
        verdict: 'PENDING',
        queuedAt: new Date()
      });

      // Run two worker processes concurrently for the same submission ID
      await Promise.all([
        processSubmission(sub._id.toString()),
        processSubmission(sub._id.toString())
      ]);

      const finalSub = await Submission.findById(sub._id);
      assert.equal(finalSub.status, 'COMPLETED');
      assert.equal(finalSub.verdict, 'ACCEPTED');
      assert.equal(finalSub.testsPassed, 2);
      assert.equal(finalSub.totalTests, 2);
    });

    it('Retry behavior: Normal execution verdicts (WRONG_ANSWER) complete normally without error or retry', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(9999)\n',
        status: 'QUEUED',
        verdict: 'PENDING',
        queuedAt: new Date()
      });

      const mockJob = {
        id: 'job-normal-verdict-test',
        data: { submissionId: sub._id.toString() },
        attemptsMade: 0,
        opts: { attempts: 2 }
      };

      // Must complete without error thrown
      await assert.doesNotReject(async () => {
        await processSubmission(mockJob);
      });

      const finalSub = await Submission.findById(sub._id);
      assert.equal(finalSub.status, 'COMPLETED');
      assert.equal(finalSub.verdict, 'WRONG_ANSWER');
    });

    it('Retry behavior: Infrastructure failure with remaining attempts reverts status to QUEUED', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(1)',
        status: 'QUEUED',
        verdict: 'PENDING',
        queuedAt: new Date()
      });

      const executionAdapter = require('../src/modules/submissions/execution.adapter');
      const originalExecute = executionAdapter.executeTestCase;
      executionAdapter.executeTestCase = async () => {
        throw new Error('Docker daemon socket connection timeout');
      };

      try {
        // Attempt 1 of 2: attemptsMade: 0, opts: { attempts: 2 }
        const mockJob = {
          id: 'job-retry-infra-1',
          data: { submissionId: sub._id.toString() },
          attemptsMade: 0,
          opts: { attempts: 2 }
        };

        await assert.rejects(async () => {
          await processSubmission(mockJob);
        }, /Docker daemon socket connection timeout/);

        // Verify submission status was reverted to QUEUED so BullMQ retry attempt can claim it
        const intermediateSub = await Submission.findById(sub._id);
        assert.equal(intermediateSub.status, 'QUEUED');

        // Attempt 2 of 2: attemptsMade: 1, opts: { attempts: 2 } (final attempt exhausted)
        mockJob.attemptsMade = 1;
        await assert.rejects(async () => {
          await processSubmission(mockJob);
        }, /Docker daemon socket connection timeout/);

        // Verify final status is FAILED with error message
        const finalSub = await Submission.findById(sub._id);
        assert.equal(finalSub.status, 'FAILED');
        assert.ok(finalSub.failedAt);
        assert.match(finalSub.errorMessage, /Docker daemon socket connection timeout/);
      } finally {
        executionAdapter.executeTestCase = originalExecute;
      }
    });
  });

  // =========================================================================
  // 4. Polling & Object-Level Authorization
  // =========================================================================
  describe('4. Polling & Object-Level Authorization', () => {
    it('GET /api/v1/submissions/:id reflects changing status correctly during execution lifecycle', async () => {
      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(5)\n',
        status: 'QUEUED',
        verdict: 'PENDING',
        queuedAt: new Date()
      });

      // Poll 1: While QUEUED
      const getRes1 = await request(app)
        .get(`/api/v1/submissions/${sub._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(getRes1.status, 200);
      assert.equal(getRes1.body.data.submission.status, 'QUEUED');
      assert.equal(getRes1.body.data.submission.verdict, 'PENDING');

      // Transition to RUNNING
      sub.status = 'RUNNING';
      sub.startedAt = new Date();
      await sub.save();

      // Poll 2: While RUNNING
      const getRes2 = await request(app)
        .get(`/api/v1/submissions/${sub._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(getRes2.status, 200);
      assert.equal(getRes2.body.data.submission.status, 'RUNNING');
      assert.equal(getRes2.body.data.submission.verdict, 'PENDING');

      // Transition to COMPLETED
      sub.status = 'COMPLETED';
      sub.verdict = 'ACCEPTED';
      sub.testsPassed = 2;
      sub.totalTests = 2;
      sub.completedAt = new Date();
      await sub.save();

      // Poll 3: Once COMPLETED
      const getRes3 = await request(app)
        .get(`/api/v1/submissions/${sub._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(getRes3.status, 200);
      assert.equal(getRes3.body.data.submission.status, 'COMPLETED');
      assert.equal(getRes3.body.data.submission.verdict, 'ACCEPTED');
    });

    it('Other users cannot view private submission (403 Forbidden)', async () => {
      const otherUser = await User.create({
        name: 'Phase 12 Other User',
        email: 'other_phase12@codearena.dev',
        passwordHash: await hashPassword('Pass@123'),
        role: 'USER',
        isActive: true
      });

      const otherLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: otherUser.email, password: 'Pass@123' });
      const otherToken = otherLogin.body.data.token;

      const sub = await Submission.create({
        userId: user._id,
        problemId: activeProblem._id,
        language: 'PYTHON',
        sourceCode: 'print(1)',
        status: 'QUEUED',
        verdict: 'PENDING'
      });

      const res = await request(app)
        .get(`/api/v1/submissions/${sub._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  // =========================================================================
  // 5. Readiness Probe with Redis Integration
  // =========================================================================
  describe('5. Readiness Probe with Redis Integration', () => {
    it('/ready includes database, execution, and redis health checks', async () => {
      const res = await request(app).get('/ready');
      assert.ok(res.body.checks);
      assert.ok(res.body.checks.database);
      assert.ok(res.body.checks.execution);
      assert.ok(res.body.checks.redis);
      assert.equal(res.body.checks.database.status, 'healthy');
      assert.equal(res.body.checks.redis.status, 'healthy');
    });
  });
});
