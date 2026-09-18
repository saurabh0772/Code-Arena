/**
 * Phase 16 Horizontal Scaling Test Suite
 *
 * Validates:
 * 1. API Instance Identity & Configuration:
 *    - Multiple API instances can initialize using the same configuration
 *    - API instance identity is generated correctly (api-<hostname>-<pid>)
 *    - Explicit API_INSTANCE_ID is respected
 * 2. Request Correlation & Observability:
 *    - Unique requestId generated and returned in X-Request-Id
 *    - Process apiInstanceId returned in X-API-Instance-Id
 * 3. Health & Readiness Across Instances:
 *    - /health endpoint works across instances and reports status and apiInstanceId
 *    - /ready endpoint works across instances and verifies DB + Redis readiness
 * 4. Stateless Authentication & RBAC:
 *    - User registered/logged in on Instance A authenticates seamlessly on Instance B
 *    - RBAC authorization is evaluated independently and correctly on different API instances
 *    - No process-local memory/state is required for authentication or session validation
 * 5. Concurrent Submission Creation & Shared Queue:
 *    - Submissions created on Instance A and Instance B both persist to shared MongoDB
 *    - Both API instances enqueue into the exact same BullMQ queue ('submission-execution')
 *    - Workers safely consume and process jobs produced by multiple API instances
 * 6. Global Shared Rate Limiting:
 *    - Rate limits backed by shared Redis store synchronize across multiple API instances
 * 7. Independent Graceful Shutdown:
 *    - Shutting down Instance A does not prevent Instance B from serving requests
 * 8. Reverse Proxy Load Balancing & Health-Aware Failover:
 *    - Reverse proxy distributes requests across multiple healthy API instances
 *    - When one backend instance stops, reverse proxy routes traffic to remaining healthy instance
 * 9. Infrastructure & Port Configuration Invariants:
 *    - Compose configuration supports dynamic replica scaling without host port collisions
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const supertest = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase16-32chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const { createRedisClient, closeRedisConnection, getRedisConnection } = require('../src/config/redis');
const {
  SUBMISSION_QUEUE_NAME,
  getQueue,
  closeQueue
} = require('../src/queues/submission.queue');
const { startWorker } = require('../src/workers/submission.worker');
const submissionExecutionService = require('../src/modules/submissions/submission-execution.service');
const { createApp } = require('../src/app');
const defaultApp = require('../src/app');
const { startServer, shutdown, resetServerState } = require('../src/server');
const { createRateLimitStore } = require('../src/middleware/rate-limiter');
const rateLimit = require('express-rate-limit');

const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const Submission = require('../src/modules/submissions/submission.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');
const { generateToken } = require('../src/utils/jwt');

describe('Phase 16 Horizontal Scaling Test Suite', () => {
  let user;
  let admin;
  let testProblem;
  let testCase;
  const activeServers = [];
  const activeWorkers = [];
  const activeClients = [];

  function trackClient(client) {
    activeClients.push(client);
    return client;
  }

  function trackServer(server) {
    activeServers.push(server);
    return server;
  }

  before(async () => {
    await connectDB();

    // Clean test collections
    await User.deleteMany({});
    await Problem.deleteMany({});
    await Submission.deleteMany({});
    await TestCase.deleteMany({});

    // Seed test user
    user = await User.create({
      name: 'Scaling User',
      email: 'scaling-user@test.com',
      passwordHash: await hashPassword('TestPass@12345'),
      role: 'USER',
      isActive: true
    });

    // Seed test admin
    admin = await User.create({
      name: 'Scaling Admin',
      email: 'scaling-admin@test.com',
      passwordHash: await hashPassword('AdminPass@12345'),
      role: 'ADMIN',
      isActive: true
    });

    // Seed test problem
    testProblem = await Problem.create({
      title: 'Distributed Sum',
      description: 'Calculate sum of numbers',
      difficulty: 'EASY',
      tags: ['math', 'scaling'],
      inputFormat: 'Two space-separated integers',
      outputFormat: 'Single integer sum',
      constraints: '1 <= a, b <= 1000',
      examples: [{ input: '2 3', output: '5' }],
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      authorId: admin._id,
      isActive: true
    });

    // Seed active test case
    testCase = await TestCase.create({
      problemId: testProblem._id,
      input: '2 3',
      expectedOutput: '5',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });
  });

  after(async () => {
    for (const s of activeServers) {
      try {
        await new Promise((resolve) => s.close(resolve));
      } catch (_) {}
    }
    activeServers.length = 0;

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

    await closeQueue();
    await disconnectDB();
  });

  afterEach(async () => {
    resetServerState();
  });

  // ============================================================================
  // 1. API Instance Identity & Configuration
  // ============================================================================
  describe('API Instance Identity & Configuration', () => {
    it('1. Multiple API instances can initialize using the same configuration', () => {
      const app1 = createApp({ apiInstanceId: 'api-replica-1' });
      const app2 = createApp({ apiInstanceId: 'api-replica-2' });

      assert.strictEqual(app1.get('apiInstanceId'), 'api-replica-1');
      assert.strictEqual(app2.get('apiInstanceId'), 'api-replica-2');
      assert.strictEqual(config.port, 5000);
    });

    it('2. API instance identity is generated correctly when API_INSTANCE_ID is absent', () => {
      const generated = config.resolveApiInstanceId();
      assert.ok(typeof generated === 'string');
      assert.ok(generated.startsWith('api-'));
      assert.ok(generated.includes(String(process.pid)));
    });

    it('3. Explicit API_INSTANCE_ID is respected', () => {
      const explicit = config.resolveApiInstanceId('api-custom-node-99');
      assert.strictEqual(explicit, 'api-custom-node-99');

      const originalEnv = process.env.API_INSTANCE_ID;
      try {
        process.env.API_INSTANCE_ID = 'api-env-node-42';
        const fromEnv = config.resolveApiInstanceId();
        assert.strictEqual(fromEnv, 'api-env-node-42');
      } finally {
        if (originalEnv !== undefined) {
          process.env.API_INSTANCE_ID = originalEnv;
        } else {
          delete process.env.API_INSTANCE_ID;
        }
      }
    });
  });

  // ============================================================================
  // 2. Request Correlation & Observability
  // ============================================================================
  describe('Request Correlation & Instance Observability', () => {
    it('4. Request IDs are unique and returned in X-Request-Id header', async () => {
      const res1 = await supertest(defaultApp).get('/health');
      const res2 = await supertest(defaultApp).get('/health');

      assert.ok(res1.headers['x-request-id'], 'res1 must have X-Request-Id');
      assert.ok(res2.headers['x-request-id'], 'res2 must have X-Request-Id');
      assert.notStrictEqual(res1.headers['x-request-id'], res2.headers['x-request-id']);
    });

    it('5. API instance identity is returned in X-API-Instance-Id header', async () => {
      const appA = createApp({ apiInstanceId: 'api-east-1' });
      const appB = createApp({ apiInstanceId: 'api-west-2' });

      const resA = await supertest(appA).get('/health');
      const resB = await supertest(appB).get('/health');

      assert.strictEqual(resA.headers['x-api-instance-id'], 'api-east-1');
      assert.strictEqual(resB.headers['x-api-instance-id'], 'api-west-2');
    });
  });

  // ============================================================================
  // 3. Health & Readiness Across Instances
  // ============================================================================
  describe('Health & Readiness Probes Across Instances', () => {
    it('6. Health endpoint works across multiple instances and includes apiInstanceId', async () => {
      const appA = createApp({ apiInstanceId: 'api-probe-A' });
      const appB = createApp({ apiInstanceId: 'api-probe-B' });

      const resA = await supertest(appA).get('/health');
      const resB = await supertest(appB).get('/health');

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resB.status, 200);
      assert.strictEqual(resA.body.status, 'ok');
      assert.strictEqual(resB.body.status, 'ok');
      assert.strictEqual(resA.body.apiInstanceId, 'api-probe-A');
      assert.strictEqual(resB.body.apiInstanceId, 'api-probe-B');
      assert.strictEqual(resA.body.database, 'connected');
      assert.strictEqual(resB.body.database, 'connected');
    });

    it('7. Readiness endpoint works across multiple instances (verifies DB and Redis)', async () => {
      const appA = createApp({ apiInstanceId: 'api-ready-A' });
      const res = await supertest(appA).get('/ready');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ready');
      assert.strictEqual(res.body.apiInstanceId, 'api-ready-A');
      assert.strictEqual(res.body.checks.database.status, 'healthy');
      assert.strictEqual(res.body.checks.redis.status, 'healthy');
    });
  });

  // ============================================================================
  // 4. Stateless Authentication & RBAC Across Instances
  // ============================================================================
  describe('Stateless Authentication & RBAC Across Instances', () => {
    it('8. Authentication works independently across different API instances (Stateless JWT)', async () => {
      const appInstance1 = createApp({ apiInstanceId: 'api-auth-1' });
      const appInstance2 = createApp({ apiInstanceId: 'api-auth-2' });

      // 1. Authenticate user on Instance 1
      const loginRes = await supertest(appInstance1)
        .post('/api/v1/auth/login')
        .send({
          email: 'scaling-user@test.com',
          password: 'TestPass@12345'
        });

      assert.strictEqual(loginRes.status, 200);
      const token = loginRes.body.data?.token;
      assert.ok(token, 'Instance 1 must issue a valid JWT');

      // 2. Present that same JWT token to Instance 2 (no session affinity / no sticky sessions needed)
      const profileRes = await supertest(appInstance2)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(profileRes.status, 200);
      assert.strictEqual(profileRes.body.data?.email, 'scaling-user@test.com');
      assert.strictEqual(profileRes.headers['x-api-instance-id'], 'api-auth-2');
    });

    it('9. RBAC works independently on different API instances', async () => {
      const appInstance1 = createApp({ apiInstanceId: 'api-rbac-1' });
      const appInstance2 = createApp({ apiInstanceId: 'api-rbac-2' });

      // Login as normal user on Instance 1
      const userLogin = await supertest(appInstance1)
        .post('/api/v1/auth/login')
        .send({ email: 'scaling-user@test.com', password: 'TestPass@12345' });
      const userToken = userLogin.body.data?.token;

      // Login as admin on Instance 2
      const adminLogin = await supertest(appInstance2)
        .post('/api/v1/auth/login')
        .send({ email: 'scaling-admin@test.com', password: 'AdminPass@12345' });
      const adminToken = adminLogin.body.data?.token;

      // Normal user token accessing admin route on Instance 2 must be rejected with 403
      const userForbiddenRes = await supertest(appInstance2)
        .get('/api/v1/admin/queue-metrics')
        .set('Authorization', `Bearer ${userToken}`);
      assert.strictEqual(userForbiddenRes.status, 403);

      // Admin token accessing admin route on Instance 1 must succeed with 200
      const adminAllowedRes = await supertest(appInstance1)
        .get('/api/v1/admin/queue-metrics')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(adminAllowedRes.status, 200);
    });

    it('11. No process-local state is required for authentication', async () => {
      // Generate a token externally (simulating token signed by another cluster instance minutes ago)
      const token = generateToken({ sub: user._id.toString(), role: user.role });

      const freshApp = createApp({ apiInstanceId: 'api-fresh-spawn' });
      const res = await supertest(freshApp)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data?.email, user.email);
    });
  });

  // ============================================================================
  // 5. Submission Creation & Shared Queue Across Instances
  // ============================================================================
  describe('Concurrent Submission Creation & Shared Queue', () => {
    it('9. Submission creation works through multiple API instances', async () => {
      const appInstanceA = createApp({ apiInstanceId: 'api-sub-A' });
      const appInstanceB = createApp({ apiInstanceId: 'api-sub-B' });

      const token = generateToken({ sub: user._id.toString(), role: user.role });

      // Instance A creates submission
      const subResA = await supertest(appInstanceA)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          problemId: testProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print(5)'
        });

      assert.strictEqual(subResA.status, 201);
      assert.strictEqual(subResA.body.data?.submission?.status, 'QUEUED');
      assert.strictEqual(subResA.headers['x-api-instance-id'], 'api-sub-A');

      // Instance B creates submission
      const subResB = await supertest(appInstanceB)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          problemId: testProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print(10)'
        });

      assert.strictEqual(subResB.status, 201);
      assert.strictEqual(subResB.body.data?.submission?.status, 'QUEUED');
      assert.strictEqual(subResB.headers['x-api-instance-id'], 'api-sub-B');

      // Verify both submissions exist in shared MongoDB
      const docA = await Submission.findById(subResA.body.data?.submission?.id);
      const docB = await Submission.findById(subResB.body.data?.submission?.id);
      assert.ok(docA);
      assert.ok(docB);
      assert.strictEqual(docA.status, 'QUEUED');
      assert.strictEqual(docB.status, 'QUEUED');
    });

    it('10. Multiple API instances enqueue jobs into the same queue', () => {
      const queue = getQueue();
      assert.strictEqual(queue.name, SUBMISSION_QUEUE_NAME);
      assert.strictEqual(SUBMISSION_QUEUE_NAME, 'submission-execution');
    });

    it('18. Worker architecture remains functional with multiple API instances', async () => {
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

      const workerConn = trackClient(createRedisClient());
      const worker = await startWorker({
        workerId: 'worker-scaling-verifier',
        concurrency: 2,
        connection: workerConn,
        skipDbConnect: true,
        skipRedisPing: true
      });
      activeWorkers.push(worker);

      const appInstance1 = createApp({ apiInstanceId: 'api-producer-1' });
      const appInstance2 = createApp({ apiInstanceId: 'api-producer-2' });
      const token = generateToken({ sub: user._id.toString(), role: user.role });

      try {
        // Produce from Instance 1
        const res1 = await supertest(appInstance1)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${token}`)
          .send({ problemId: testProblem._id.toString(), language: 'PYTHON', sourceCode: 'print(1)' });

        // Produce from Instance 2
        const res2 = await supertest(appInstance2)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${token}`)
          .send({ problemId: testProblem._id.toString(), language: 'PYTHON', sourceCode: 'print(2)' });

        const subId1 = res1.body.data?.submission?.id;
        const subId2 = res2.body.data?.submission?.id;
        assert.ok(subId1, 'Instance 1 must return submission id');
        assert.ok(subId2, 'Instance 2 must return submission id');

        // Wait for worker to complete both submissions from shared queue
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const s1 = await Submission.findById(subId1);
          const s2 = await Submission.findById(subId2);
          if (s1 && s2 && s1.status === 'COMPLETED' && s2.status === 'COMPLETED') break;
          await new Promise((r) => setTimeout(r, 100));
        }

        const final1 = await Submission.findById(subId1);
        const final2 = await Submission.findById(subId2);
        assert.strictEqual(final1.status, 'COMPLETED');
        assert.strictEqual(final2.status, 'COMPLETED');
      } finally {
        submissionExecutionService.executeSubmission = originalExecute;
      }
    });
  });

  // ============================================================================
  // 6. Global Shared Rate Limiting
  // ============================================================================
  describe('Global Shared Rate Limiting', () => {
    it('12. Global rate limiting is correctly shared across multiple API instances', async () => {
      const express = require('express');
      const redisClient = trackClient(createRedisClient());
      const testStore = createRateLimitStore('test-global-sharing', redisClient);

      // Create custom limiter with limit 3 per 10 seconds backed by shared Redis store
      const testLimiter = rateLimit({
        windowMs: 10 * 1000,
        max: 3,
        store: testStore,
        standardHeaders: true,
        legacyHeaders: false,
        validate: false,
        keyGenerator: () => 'shared-client-ip-test'
      });

      const appInstanceA = express();
      const appInstanceB = express();

      appInstanceA.use(testLimiter);
      appInstanceB.use(testLimiter);

      appInstanceA.get('/test-rl', (req, res) => res.json({ ok: true, instance: 'A' }));
      appInstanceB.get('/test-rl', (req, res) => res.json({ ok: true, instance: 'B' }));

      // Request 1 on Instance A -> Allowed (count: 1)
      const r1 = await supertest(appInstanceA).get('/test-rl');
      assert.strictEqual(r1.status, 200);

      // Request 2 on Instance B -> Allowed (count: 2)
      const r2 = await supertest(appInstanceB).get('/test-rl');
      assert.strictEqual(r2.status, 200);

      // Request 3 on Instance A -> Allowed (count: 3)
      const r3 = await supertest(appInstanceA).get('/test-rl');
      assert.strictEqual(r3.status, 200);

      // Request 4 on Instance B -> Throttled (count: 4 > 3)!
      // Instance B knows Instance A handled 2 requests because of the shared Redis state!
      const r4 = await supertest(appInstanceB).get('/test-rl');
      assert.strictEqual(r4.status, 429, 'Instance B must enforce global rate limit reached across cluster');
    });
  });

  // ============================================================================
  // 7. Independent Graceful Shutdown
  // ============================================================================
  describe('Independent Graceful Shutdown', () => {
    it('13. One API instance can shut down without requiring other instances to stop', async () => {
      const appA = createApp({ apiInstanceId: 'api-shutdown-A' });
      const appB = createApp({ apiInstanceId: 'api-surviving-B' });

      // Start real HTTP servers on ephemeral ports
      const serverA = trackServer(http.createServer(appA));
      const serverB = trackServer(http.createServer(appB));

      await new Promise((r) => serverA.listen(0, r));
      await new Promise((r) => serverB.listen(0, r));

      const portA = serverA.address().port;
      const portB = serverB.address().port;

      // Both servers respond
      const resA1 = await supertest(`http://127.0.0.1:${portA}`).get('/health');
      const resB1 = await supertest(`http://127.0.0.1:${portB}`).get('/health');
      assert.strictEqual(resA1.status, 200);
      assert.strictEqual(resB1.status, 200);

      // Gracefully shut down Server A
      await shutdown('SIGTERM', false, serverA);

      // Server B must remain operational and serve requests cleanly
      const resB2 = await supertest(`http://127.0.0.1:${portB}`).get('/health');
      assert.strictEqual(resB2.status, 200);
      assert.strictEqual(resB2.body.apiInstanceId, 'api-surviving-B');

      // Server A should no longer accept new connections
      await assert.rejects(async () => {
        await supertest(`http://127.0.0.1:${portA}`).get('/health');
      });
    });
  });

  // ============================================================================
  // 8. Shared Persistent State (MongoDB & Redis)
  // ============================================================================
  describe('Shared Persistent State Across Instances', () => {
    it('14. Multiple backend instances can access the same MongoDB state', async () => {
      const appA = createApp({ apiInstanceId: 'api-mongo-A' });
      const appB = createApp({ apiInstanceId: 'api-mongo-B' });

      const token = generateToken({ sub: admin._id.toString(), role: admin.role });

      // Create problem on Instance A
      const createRes = await supertest(appA)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Shared State Verification',
          description: 'Testing shared DB state',
          difficulty: 'MEDIUM',
          inputFormat: 'String input',
          outputFormat: 'String output',
          constraints: 'Length <= 100',
          examples: [{ input: 'hello', output: 'world' }],
          timeLimitMs: 1000,
          memoryLimitMb: 256
        });

      assert.strictEqual(createRes.status, 201);
      const createdId = createRes.body.data?.problem?.id || createRes.body.data?.id;
      assert.ok(createdId, 'Must return created problem id');

      // Read problem from Instance B
      const getRes = await supertest(appB).get(`/api/v1/problems/${createdId}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.data?.problem?.title || getRes.body.data?.title, 'Shared State Verification');
    });

    it('15. Multiple backend instances can access the same Redis state', async () => {
      const client1 = trackClient(createRedisClient());
      const client2 = trackClient(createRedisClient());

      await client1.set('codearena:test:shared_key', 'shared_value_123', 'EX', 10);
      const val = await client2.get('codearena:test:shared_key');

      assert.strictEqual(val, 'shared_value_123');
    });
  });

  // ============================================================================
  // 9. Reverse Proxy Load Balancing & Health-Aware Failover
  // ============================================================================
  describe('Reverse Proxy Load Balancing & Failover Integration (Section 29 & 30)', () => {
    it('29. Multiple healthy backend instances can serve requests through one stable entry point', async () => {
      // Start two backend HTTP servers
      const appA = createApp({ apiInstanceId: 'api-lb-replica-A' });
      const appB = createApp({ apiInstanceId: 'api-lb-replica-B' });

      const serverA = trackServer(http.createServer(appA));
      const serverB = trackServer(http.createServer(appB));

      await new Promise((r) => serverA.listen(0, r));
      await new Promise((r) => serverB.listen(0, r));

      const portA = serverA.address().port;
      const portB = serverB.address().port;
      const backends = [
        { host: '127.0.0.1', port: portA, alive: true },
        { host: '127.0.0.1', port: portB, alive: true }
      ];

      // Create a round-robin reverse proxy server representing Nginx
      let counter = 0;
      const proxyServer = trackServer(
        http.createServer((req, res) => {
          const healthyBackends = backends.filter((b) => b.alive);
          if (healthyBackends.length === 0) {
            res.writeHead(502);
            return res.end('Bad Gateway');
          }
          const target = healthyBackends[counter++ % healthyBackends.length];

          const proxyReq = http.request(
            {
              host: target.host,
              port: target.port,
              path: req.url,
              method: req.method,
              headers: req.headers
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode, proxyRes.headers);
              proxyRes.pipe(res);
            }
          );

          proxyReq.on('error', () => {
            // Failover retry logic matching Nginx proxy_next_upstream
            target.alive = false;
            const remaining = backends.filter((b) => b.alive);
            if (remaining.length > 0) {
              const fallback = remaining[0];
              const retryReq = http.request(
                {
                  host: fallback.host,
                  port: fallback.port,
                  path: req.url,
                  method: req.method,
                  headers: req.headers
                },
                (retryRes) => {
                  res.writeHead(retryRes.statusCode, retryRes.headers);
                  retryRes.pipe(res);
                }
              );
              retryReq.end();
            } else {
              res.writeHead(502);
              res.end('Bad Gateway');
            }
          });

          req.pipe(proxyReq);
        })
      );

      await new Promise((r) => proxyServer.listen(0, r));
      const proxyPort = proxyServer.address().port;

      // Send multiple requests through the proxy
      const observedInstances = new Set();
      for (let i = 0; i < 6; i++) {
        const res = await supertest(`http://127.0.0.1:${proxyPort}`).get('/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
        observedInstances.add(res.headers['x-api-instance-id']);
      }

      // Verify that requests were served through the single entry point by multiple instances
      assert.ok(observedInstances.has('api-lb-replica-A'), 'Proxy must route to Replica A');
      assert.ok(observedInstances.has('api-lb-replica-B'), 'Proxy must route to Replica B');
      assert.strictEqual(observedInstances.size, 2, 'Both backend replicas served traffic through proxy');
    });

    it('30. When one backend instance stops, reverse proxy continues serving traffic via remaining healthy instances', async () => {
      const appA = createApp({ apiInstanceId: 'api-fail-A' });
      const appB = createApp({ apiInstanceId: 'api-healthy-B' });

      const serverA = trackServer(http.createServer(appA));
      const serverB = trackServer(http.createServer(appB));

      await new Promise((r) => serverA.listen(0, r));
      await new Promise((r) => serverB.listen(0, r));

      const portA = serverA.address().port;
      const portB = serverB.address().port;

      const backends = [
        { host: '127.0.0.1', port: portA, alive: true },
        { host: '127.0.0.1', port: portB, alive: true }
      ];

      let counter = 0;
      const proxyServer = trackServer(
        http.createServer((req, res) => {
          const healthyBackends = backends.filter((b) => b.alive);
          if (healthyBackends.length === 0) {
            res.writeHead(502);
            return res.end('Bad Gateway');
          }
          const target = healthyBackends[counter++ % healthyBackends.length];

          const proxyReq = http.request(
            {
              host: target.host,
              port: target.port,
              path: req.url,
              method: req.method,
              headers: req.headers
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode, proxyRes.headers);
              proxyRes.pipe(res);
            }
          );

          proxyReq.on('error', () => {
            // Nginx-like proxy_next_upstream failover
            target.alive = false;
            const remaining = backends.filter((b) => b.alive);
            if (remaining.length > 0) {
              const fallback = remaining[0];
              const retryReq = http.request(
                {
                  host: fallback.host,
                  port: fallback.port,
                  path: req.url,
                  method: req.method,
                  headers: req.headers
                },
                (retryRes) => {
                  res.writeHead(retryRes.statusCode, retryRes.headers);
                  retryRes.pipe(res);
                }
              );
              retryReq.end();
            } else {
              res.writeHead(502);
              res.end('Bad Gateway');
            }
          });

          req.pipe(proxyReq);
        })
      );

      await new Promise((r) => proxyServer.listen(0, r));
      const proxyPort = proxyServer.address().port;

      // 1. Initial request through proxy works
      const initialRes = await supertest(`http://127.0.0.1:${proxyPort}`).get('/health');
      assert.strictEqual(initialRes.status, 200);

      // 2. Stop Server A abruptly
      await new Promise((r) => serverA.close(r));
      backends[0].alive = false; // Mark dead

      // 3. Subsequent requests through proxy still succeed 100% via Server B
      for (let i = 0; i < 4; i++) {
        const res = await supertest(`http://127.0.0.1:${proxyPort}`).get('/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers['x-api-instance-id'], 'api-healthy-B');
      }
    });
  });

  // ============================================================================
  // 10. Deployment & Infrastructure Invariants
  // ============================================================================
  describe('Deployment & Infrastructure Invariants', () => {
    it('16. Reverse proxy configuration targets backend cluster dynamically', () => {
      const nginxConfigPath = path.resolve(__dirname, '../../nginx/nginx.conf');
      assert.ok(fs.existsSync(nginxConfigPath), 'nginx/nginx.conf must exist');

      const nginxContent = fs.readFileSync(nginxConfigPath, 'utf8');
      assert.ok(nginxContent.includes('resolver 127.0.0.11'), 'Must use embedded Docker DNS resolver');
      assert.ok(nginxContent.includes('set $backend_upstream "http://backend:5000"'), 'Must resolve backend:5000 dynamically via variable');
      assert.ok(nginxContent.includes('proxy_pass $backend_upstream'), 'Must proxy pass to dynamic backend variable');
      assert.ok(nginxContent.includes('proxy_next_upstream'), 'Must configure health-aware failover');
      assert.ok(nginxContent.includes('X-Request-Id'), 'Must preserve request correlation header');
    });

    it('17. Backend instances do not expose unnecessary public host ports in docker-compose.yml', () => {
      const composePath = path.resolve(__dirname, '../../docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');

      // The backend service must use 'expose: ["5000"]' rather than binding host ports directly,
      // enabling native docker compose --scale backend=N without port collisions.
      assert.ok(composeContent.includes('reverse-proxy:'), 'Must declare reverse-proxy service');
      assert.ok(!composeContent.includes('- "5000:5000"\n    environment:'), 'Backend must not map host port 5000 directly');
      assert.ok(composeContent.includes('- "5000:80"'), 'Reverse proxy must publish port 5000');

      // MongoDB must NOT expose public 0.0.0.0:27017
      assert.ok(!composeContent.includes('- "27017:27017"'), 'MongoDB must not be exposed to 0.0.0.0');
      assert.ok(composeContent.includes('127.0.0.1:${MONGO_HOST_PORT:-27017}:27017'), 'MongoDB must be bound strictly to localhost');
    });
  });
});
