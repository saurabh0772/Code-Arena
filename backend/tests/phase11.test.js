// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase11-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const Submission = require('../src/modules/submissions/submission.model');
const AuditLog = require('../src/modules/audit/audit-log.model');

describe('Phase 11 — Production Hardening, Observability & API Quality Suite', () => {
  let userToken;
  let adminToken;
  let normalUser;
  let adminUser;
  let sampleProblem;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test');
    }
  });

  after(async () => {
    await User.deleteMany({ email: /@phase11\.test$/ });
    await Problem.deleteMany({ title: /Phase11/ });
    await TestCase.deleteMany({});
    await Submission.deleteMany({});
    await AuditLog.deleteMany({});
    await mongoose.disconnect();
    const { closeQueue } = require('../src/queues/submission.queue');
    await closeQueue();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /@phase11\.test$/ });
    await Problem.deleteMany({ title: /Phase11/ });
    await TestCase.deleteMany({});
    await Submission.deleteMany({});
    await AuditLog.deleteMany({});

    // Create test admin user directly
    const { hashPassword } = require('../src/utils/password');
    const jwt = require('jsonwebtoken');
    const passwordHash = await hashPassword('Password123!');

    adminUser = await User.create({
      name: 'Phase 11 Admin',
      email: 'admin@phase11.test',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    normalUser = await User.create({
      name: 'Phase 11 User',
      email: 'user@phase11.test',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    adminToken = jwt.sign(
      { sub: adminUser._id.toString(), role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    userToken = jwt.sign(
      { sub: normalUser._id.toString(), role: normalUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create sample problem as admin
    const probRes = await request(app)
      .post('/api/v1/problems')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Phase11 Target Problem',
        description: 'Testing Phase 11 features',
        difficulty: 'MEDIUM',
        tags: ['array', 'phase11'],
        inputFormat: 'Integer N',
        outputFormat: 'Integer N*2',
        constraints: '1 <= N <= 100',
        examples: [{ input: '5', output: '10' }]
      });
    sampleProblem = probRes.body.data.problem;
  });

  // =========================================================================
  // 1. CORRELATION / REQUEST ID TESTS
  // =========================================================================
  describe('Correlation & Request IDs', () => {
    it('Generates and returns X-Request-Id header when not provided by client', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      const requestId = res.headers['x-request-id'];
      assert.ok(requestId, 'X-Request-Id header must be present');
      assert.ok(requestId.startsWith('req_'), 'Generated request ID should start with req_');
    });

    it('Preserves and reflects client-provided X-Request-Id', async () => {
      const clientReqId = 'custom-client-trace-id-12345';
      const res = await request(app)
        .get('/health')
        .set('X-Request-Id', clientReqId);

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-request-id'], clientReqId);
    });

    it('Includes requestId in error response body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@phase11.test', password: 'wrong' });

      assert.equal(res.status, 401);
      assert.ok(res.body.requestId, 'Error body must include requestId');
      assert.equal(res.body.requestId, res.headers['x-request-id']);
    });
  });

  // =========================================================================
  // 2. READINESS PROBE TESTS
  // =========================================================================
  describe('Readiness Probe (GET /ready)', () => {
    it('GET /ready returns 200 and healthy checks when DB and Execution engine are ready', async () => {
      const res = await request(app).get('/ready');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ready');
      assert.equal(res.body.service, 'codearena-backend');
      assert.ok(res.body.checks);
      assert.equal(res.body.checks.database.status, 'healthy');
      assert.equal(res.body.checks.execution.status, 'healthy');
      assert.ok(res.body.timestamp);
    });
  });

  // =========================================================================
  // 3. STRUCTURED ERROR CONTRACT TESTS
  // =========================================================================
  describe('Standardized Error Response Structure', () => {
    it('Error responses contain success: false, message, errorCode, and nested error { code, message }', async () => {
      const res = await request(app)
        .get('/api/v1/problems/000000000000000000000000');

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message);
      assert.ok(res.body.errorCode);
      assert.ok(res.body.error);
      assert.equal(res.body.error.code, res.body.errorCode);
      assert.equal(res.body.error.message, res.body.message);
    });
  });

  // =========================================================================
  // 4. OPENAPI / SWAGGER DOCUMENTATION TESTS
  // =========================================================================
  describe('API Documentation (OpenAPI / Swagger UI)', () => {
    it('GET /api/v1/docs/json returns valid OpenAPI 3.0.3 specification', async () => {
      const res = await request(app).get('/api/v1/docs/json');
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.equal(res.body.openapi, '3.0.3');
      assert.ok(res.body.info.title.includes('CodeArena'));
      assert.ok(res.body.paths['/api/v1/problems']);
      assert.ok(res.body.paths['/api/v1/submissions']);
      assert.ok(res.body.paths['/ready']);
      assert.ok(res.body.components.schemas.Problem);
      assert.ok(res.body.components.schemas.Submission);
    });

    it('GET /api/v1/docs serves Swagger UI HTML page', async () => {
      const res = await request(app).get('/api/v1/docs');
      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/html'));
      assert.ok(res.text.includes('swagger-ui'));
      assert.ok(res.text.includes('/api/v1/docs/json'));
    });
  });

  // =========================================================================
  // 5. PAGINATION, FILTERING & READINESS BREAKDOWN TESTS
  // =========================================================================
  describe('Problems Pagination, Filtering & Readiness Breakdown', () => {
    beforeEach(async () => {
      // Create additional problems
      await Problem.create([
        {
          title: 'Phase11 Easy Tree Problem',
          description: 'Desc',
          difficulty: 'EASY',
          tags: ['tree', 'phase11'],
          inputFormat: 'in',
          outputFormat: 'out',
          constraints: 'c',
          examples: [{ input: '1', output: '2' }],
          authorId: adminUser.id,
          isActive: true
        },
        {
          title: 'Phase11 Hard Graph Problem',
          description: 'Desc',
          difficulty: 'HARD',
          tags: ['graph', 'phase11'],
          inputFormat: 'in',
          outputFormat: 'out',
          constraints: 'c',
          examples: [{ input: '1', output: '2' }],
          authorId: adminUser.id,
          isActive: true
        }
      ]);

      // Add a public test case and a hidden testcase to sampleProblem
      await TestCase.create([
        {
          problemId: sampleProblem.id,
          input: '1\n',
          expectedOutput: '2\n',
          visibility: 'PUBLIC',
          order: 1,
          isActive: true
        },
        {
          problemId: sampleProblem.id,
          input: '5\n',
          expectedOutput: '10\n',
          visibility: 'HIDDEN',
          order: 2,
          isActive: true
        }
      ]);
    });

    it('Returns pagination metadata in GET /api/v1/problems', async () => {
      const res = await request(app)
        .get('/api/v1/problems?page=1&limit=2');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.problems.length, 2);
      assert.ok(res.body.data.pagination);
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 2);
      assert.ok(res.body.data.pagination.total >= 3);
      assert.ok(res.body.data.pagination.totalPages >= 2);
    });

    it('Filters problems by difficulty', async () => {
      const res = await request(app).get('/api/v1/problems?difficulty=HARD');
      assert.equal(res.status, 200);
      res.body.data.problems.forEach((p) => {
        assert.equal(p.difficulty, 'HARD');
      });
    });

    it('Filters problems by search query', async () => {
      const res = await request(app).get('/api/v1/problems?search=Tree');
      assert.equal(res.status, 200);
      assert.ok(res.body.data.problems.some((p) => p.title.includes('Tree')));
    });

    it('Provides readiness breakdown on problems', async () => {
      const res = await request(app).get('/api/v1/problems');
      assert.equal(res.status, 200);

      const target = res.body.data.problems.find((p) => p.id === sampleProblem.id);
      assert.ok(target, 'Sample problem must be present');
      assert.ok(target.readiness, 'Readiness breakdown must be present');
      assert.equal(target.readiness.publicCount, 1);
      assert.equal(target.readiness.hiddenCount, 1);
      assert.equal(target.readiness.totalCount, 2);
      assert.equal(target.readiness.isReady, true);
    });

    it('Unready problem has isReady=false and reports missing requirements', async () => {
      const res = await request(app).get('/api/v1/problems?search=Tree');
      assert.equal(res.status, 200);
      const treeProblem = res.body.data.problems[0];
      assert.equal(treeProblem.readiness.isReady, false);
      assert.equal(treeProblem.readiness.totalCount, 0);
      assert.ok(treeProblem.readiness.missingRequirements.length > 0);
    });
  });

  // =========================================================================
  // 6. SUBMISSIONS PROJECTION & FILTERING TESTS
  // =========================================================================
  describe('Submissions Projection & Filtering', () => {
    beforeEach(async () => {
      await Submission.create([
        {
          userId: normalUser.id,
          problemId: sampleProblem.id,
          language: 'CPP',
          sourceCode: '#include <iostream>\nint main() { return 0; }',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        },
        {
          userId: normalUser.id,
          problemId: sampleProblem.id,
          language: 'PYTHON',
          sourceCode: 'print("hello")',
          status: 'COMPLETED',
          verdict: 'WRONG_ANSWER'
        }
      ]);
    });

    it('Omits sourceCode by default on GET /api/v1/submissions/me for performance', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/me')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.submissions.length, 2);
      res.body.data.submissions.forEach((s) => {
        assert.equal(s.sourceCode, undefined, 'sourceCode should be omitted by default');
      });
    });

    it('Includes sourceCode when ?includeCode=true is explicitly requested', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/me?includeCode=true')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.submissions.length, 2);
      res.body.data.submissions.forEach((s) => {
        assert.ok(s.sourceCode, 'sourceCode should be present when includeCode=true');
      });
    });

    it('Filters submissions by language and verdict', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/me?language=PYTHON&verdict=WRONG_ANSWER')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.submissions.length, 1);
      assert.equal(res.body.data.submissions[0].language, 'PYTHON');
      assert.equal(res.body.data.submissions[0].verdict, 'WRONG_ANSWER');
    });
  });

  // =========================================================================
  // 7. ADMIN AUDIT LOGS TESTS
  // =========================================================================
  describe('Admin Audit Logging (GET /api/v1/admin/audit-logs)', () => {
    it('Records audit entries on problem creation and updates', async () => {
      // Create a test case to generate audit log
      await request(app)
        .post(`/api/v1/problems/${sampleProblem.id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '10\n',
          expectedOutput: '20\n',
          visibility: 'PUBLIC',
          order: 1
        });

      // Query audit logs as ADMIN
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.logs));
      assert.ok(res.body.data.logs.length >= 2);

      const actions = res.body.data.logs.map((l) => l.action);
      assert.ok(actions.includes('PROBLEM_CREATED'));
      assert.ok(actions.includes('TEST_CASE_CREATED'));
    });

    it('Rejects normal USER from reading audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 403);
    });

    it('Rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/audit-logs');
      assert.equal(res.status, 401);
    });
  });
});
