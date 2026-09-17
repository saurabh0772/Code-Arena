const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase6';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const Submission = require('../src/modules/submissions/submission.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');

describe('Phase 6 Submission Module Test Suite', () => {
  let user1;
  let user1Token;
  let user2;
  let user2Token;
  let adminUser;
  let adminToken;
  let activeProblem;
  let inactiveProblem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Problem.deleteMany({});
      await Submission.deleteMany({});
      await TestCase.deleteMany({});
      await disconnectDB();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    await Submission.deleteMany({});
    await TestCase.deleteMany({});

    const passwordHash = await hashPassword('Password123!');

    user1 = await User.create({
      name: 'User One',
      email: 'user1_sub@example.com',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    user2 = await User.create({
      name: 'User Two',
      email: 'user2_sub@example.com',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin_sub@example.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    user1Token = jwt.sign(
      { sub: user1._id.toString(), role: user1.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user2Token = jwt.sign(
      { sub: user2._id.toString(), role: user2.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { sub: adminUser._id.toString(), role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    activeProblem = await Problem.create({
      title: 'Active Problem',
      description: 'Solve this active problem.',
      difficulty: 'EASY',
      tags: ['intro'],
      inputFormat: 'Single number',
      outputFormat: 'Single number',
      constraints: '1 <= n <= 100',
      examples: [{ input: '1', output: '1' }],
      authorId: adminUser._id,
      isActive: true
    });

    inactiveProblem = await Problem.create({
      title: 'Inactive Problem',
      description: 'Cannot submit to this problem.',
      difficulty: 'HARD',
      tags: ['deprecated'],
      inputFormat: 'None',
      outputFormat: 'None',
      constraints: 'None',
      examples: [{ input: '0', output: '0' }],
      authorId: adminUser._id,
      isActive: false
    });

    await TestCase.create({
      problemId: activeProblem._id,
      input: '1',
      expectedOutput: '1',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });
  });

  // ==========================================
  // CREATE SUBMISSION TESTS
  // ==========================================
  describe('POST /api/v1/submissions (Create Submission)', () => {
    it('Authenticated USER can create a submission (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'CPP',
          sourceCode: '#include <iostream>\nint main() { std::cout << 1; return 0; }'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.submission);
      assert.ok(res.body.data.submission.id);
      assert.equal(res.body.data.submission.userId, user1._id.toString());
      assert.equal(res.body.data.submission.problemId, activeProblem._id.toString());
      assert.equal(res.body.data.submission.language, 'CPP');
      assert.equal(res.body.data.submission.sourceCode, '#include <iostream>\nint main() { std::cout << 1; return 0; }');
      assert.equal(res.body.data.submission.status, 'COMPLETED');
      assert.equal(res.body.data.submission.verdict, 'ACCEPTED');
      assert.equal(res.body.data.submission.testsPassed, 1);
      assert.equal(res.body.data.submission.totalTests, 1);
    });

    it('ADMIN can also create a submission (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print("hello world")'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.submission.userId, adminUser._id.toString());
    });

    it('Unauthenticated request is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .send({
          problemId: activeProblem._id.toString(),
          language: 'CPP',
          sourceCode: 'int main(){}'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Submission to non-existent problem is rejected (404 Not Found)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: nonExistentId,
          language: 'JAVASCRIPT',
          sourceCode: 'console.log("test");'
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Problem not found/i);
    });

    it('Submission with invalid problemId format is rejected (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: 'invalid-object-id',
          language: 'CPP',
          sourceCode: 'int main(){}'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('Submission to inactive problem is rejected (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: inactiveProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print("inactive test")'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /inactive problem/i);
    });

    it('Accepts all supported languages: CPP, PYTHON, JAVASCRIPT', async () => {
      const languages = ['CPP', 'PYTHON', 'JAVASCRIPT', 'cpp', 'python', 'javascript'];

      for (const lang of languages) {
        const res = await request(app)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            problemId: activeProblem._id.toString(),
            language: lang,
            sourceCode: '// test code'
          });

        assert.equal(res.status, 201);
        assert.equal(res.body.data.submission.language, lang.toUpperCase());
      }
    });

    it('Rejects unsupported language with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'RUBY',
          sourceCode: 'puts "test"'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Unsupported language/i);
    });

    it('Rejects missing or empty source code with 400 Bad Request', async () => {
      // Missing
      const res1 = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'PYTHON'
        });
      assert.equal(res1.status, 400);

      // Empty string
      const res2 = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: '   \n  '
        });
      assert.equal(res2.status, 400);
    });

    it('Rejects oversized source code (> 64KB)', async () => {
      const hugeCode = 'x = 1;\n'.repeat(10000); // > 70KB

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: hugeCode
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /cannot exceed 64KB/i);
    });

    it('Problem with zero active test cases is rejected with 422 PROBLEM_NOT_READY (no execution)', async () => {
      const zeroTestProblem = await Problem.create({
        title: 'Zero Test Problem',
        description: 'Problem without any test cases',
        difficulty: 'EASY',
        tags: ['empty'],
        inputFormat: 'none',
        outputFormat: 'none',
        constraints: 'none',
        examples: [{ input: '0', output: '0' }],
        authorId: adminUser._id,
        isActive: true
      });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: zeroTestProblem._id.toString(),
          language: 'CPP',
          sourceCode: '#include <iostream>\nint main() { return 0; }'
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'PROBLEM_NOT_READY');
      assert.match(res.body.message, /no active test cases and is not ready for submissions/i);

      // Verify execution engine never ran and no submission record was created
      const count = await Submission.countDocuments({ problemId: zeroTestProblem._id });
      assert.equal(count, 0);
    });

    it('Problem with only inactive test cases is rejected with 422 PROBLEM_NOT_READY', async () => {
      const inactiveTestsProblem = await Problem.create({
        title: 'Inactive Tests Problem',
        description: 'Problem with inactive test cases',
        difficulty: 'MEDIUM',
        tags: ['inactive-tests'],
        inputFormat: 'none',
        outputFormat: 'none',
        constraints: 'none',
        examples: [{ input: '0', output: '0' }],
        authorId: adminUser._id,
        isActive: true
      });

      // Create 3 inactive test cases
      await TestCase.create([
        { problemId: inactiveTestsProblem._id, input: '1', expectedOutput: '1', visibility: 'PUBLIC', order: 1, isActive: false },
        { problemId: inactiveTestsProblem._id, input: '2', expectedOutput: '2', visibility: 'PUBLIC', order: 2, isActive: false },
        { problemId: inactiveTestsProblem._id, input: '3', expectedOutput: '3', visibility: 'HIDDEN', order: 3, isActive: false }
      ]);

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: inactiveTestsProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print(1)'
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'PROBLEM_NOT_READY');

      const count = await Submission.countDocuments({ problemId: inactiveTestsProblem._id });
      assert.equal(count, 0);
    });

    it('Inactive test cases do not count toward totalTests during evaluation', async () => {
      const mixedProblem = await Problem.create({
        title: 'Mixed Problem',
        description: 'Problem with active and inactive test cases',
        difficulty: 'EASY',
        tags: ['mixed'],
        inputFormat: 'none',
        outputFormat: 'none',
        constraints: 'none',
        examples: [{ input: '1', output: '1' }],
        authorId: adminUser._id,
        isActive: true
      });

      // 2 active test cases, 1 inactive
      await TestCase.create([
        { problemId: mixedProblem._id, input: '1', expectedOutput: '1', visibility: 'PUBLIC', order: 1, isActive: true },
        { problemId: mixedProblem._id, input: '2', expectedOutput: '1', visibility: 'HIDDEN', order: 2, isActive: true },
        { problemId: mixedProblem._id, input: '3', expectedOutput: '999', visibility: 'HIDDEN', order: 3, isActive: false }
      ]);

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: mixedProblem._id.toString(),
          language: 'PYTHON',
          sourceCode: 'print(1)'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.submission.status, 'COMPLETED');
      assert.equal(res.body.data.submission.verdict, 'ACCEPTED');
      assert.equal(res.body.data.submission.testsPassed, 2);
      assert.equal(res.body.data.submission.totalTests, 2); // strictly 2 active tests
    });
  });

  // ==========================================
  // OWNERSHIP & SERVER-CONTROLLED FIELDS TESTS
  // ==========================================
  describe('Ownership & Server-Controlled Fields Security', () => {
    it('Client cannot spoof userId; server strictly enforces authenticated user identity', async () => {
      const spoofedUserId = user2._id.toString();

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: spoofedUserId, // Attempt to attribute to user2
          problemId: activeProblem._id.toString(),
          language: 'CPP',
          sourceCode: 'int main(){ return 0; }'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.submission.userId, user1._id.toString());
      assert.notEqual(res.body.data.submission.userId, spoofedUserId);

      // Verify in DB
      const dbSub = await Submission.findById(res.body.data.submission.id);
      assert.equal(dbSub.userId.toString(), user1._id.toString());
    });

    it('Client cannot manipulate status, verdict, or execution metrics', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          problemId: activeProblem._id.toString(),
          language: 'CPP',
          sourceCode: '#include <iostream>\nint main() { std::cout << 1; return 0; }',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          runtimeMs: 10,
          memoryKb: 512,
          testsPassed: 100,
          totalTests: 100
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.submission.status, 'COMPLETED');
      assert.equal(res.body.data.submission.verdict, 'ACCEPTED');
      assert.equal(res.body.data.submission.testsPassed, 1);
      assert.equal(res.body.data.submission.totalTests, 1);
    });
  });

  // ==========================================
  // RETRIEVAL & OBJECT-LEVEL AUTHORIZATION TESTS
  // ==========================================
  describe('GET /api/v1/submissions/:submissionId (Object-Level Authorization)', () => {
    let subUser1;

    beforeEach(async () => {
      subUser1 = await Submission.create({
        userId: user1._id,
        problemId: activeProblem._id,
        language: 'CPP',
        sourceCode: 'code for user1',
        status: 'SUBMITTED',
        verdict: 'PENDING'
      });
    });

    it('Owner (user1) can retrieve their own submission (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${subUser1._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.submission.id, subUser1._id.toString());
      assert.equal(res.body.data.submission.userId, user1._id.toString());
      assert.equal(res.body.data.submission.sourceCode, 'code for user1');
    });

    it('Another user (user2) CANNOT retrieve user1 submission (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${subUser1._id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /permission to view this submission/i);
    });

    it('ADMIN can retrieve another user submission (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${subUser1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.submission.id, subUser1._id.toString());
    });

    it('Non-existent submission returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/submissions/${nonExistentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      assert.equal(res.status, 404);
      assert.match(res.body.message, /Submission not found/i);
    });

    it('Invalid submission ID format returns 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/invalid-id-xyz')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid submission ID format/i);
    });

    it('Unauthenticated request to get submission returns 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${subUser1._id}`);

      assert.equal(res.status, 401);
    });
  });

  // ==========================================
  // USER SUBMISSION HISTORY TESTS
  // ==========================================
  describe('GET /api/v1/submissions/me (User Submissions History)', () => {
    beforeEach(async () => {
      // Create 2 submissions for user1
      await Submission.create([
        {
          userId: user1._id,
          problemId: activeProblem._id,
          language: 'CPP',
          sourceCode: 'sub1 user1',
          status: 'SUBMITTED',
          verdict: 'PENDING'
        },
        {
          userId: user1._id,
          problemId: activeProblem._id,
          language: 'PYTHON',
          sourceCode: 'sub2 user1',
          status: 'SUBMITTED',
          verdict: 'PENDING'
        }
      ]);

      // Create 1 submission for user2
      await Submission.create({
        userId: user2._id,
        problemId: activeProblem._id,
        language: 'JAVASCRIPT',
        sourceCode: 'sub1 user2',
        status: 'SUBMITTED',
        verdict: 'PENDING'
      });
    });

    it('Returns only submissions belonging to the authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/me')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.submissions.length, 2);

      // Verify all belong to user1
      res.body.data.submissions.forEach((sub) => {
        assert.equal(sub.userId, user1._id.toString());
      });

      // User2 submissions should not be present
      const rawString = JSON.stringify(res.body);
      assert.ok(!rawString.includes('sub1 user2'));
    });

    it('User2 receives only their own submission history', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/me')
        .set('Authorization', `Bearer ${user2Token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.submissions.length, 1);
      assert.equal(res.body.data.submissions[0].userId, user2._id.toString());
    });

    it('Filtering by problemId works', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/me?problemId=${activeProblem._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.submissions.length, 2);
    });

    it('Unauthenticated request is rejected with 401', async () => {
      const res = await request(app).get('/api/v1/submissions/me');
      assert.equal(res.status, 401);
    });
  });

  // ==========================================
  // REGRESSION VERIFICATION (Phases 1-5)
  // ==========================================
  describe('Regression Verification', () => {
    it('GET /health continues to return 200', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
    });

    it('Auth endpoints continue to work', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Phase 6 User',
          email: 'phase6reg@example.com',
          password: 'Password123!'
        });
      assert.equal(regRes.status, 201);
    });

    it('Problem endpoints continue to work', async () => {
      const probRes = await request(app)
        .get(`/api/v1/problems/${activeProblem._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      assert.equal(probRes.status, 200);
      assert.equal(probRes.body.data.problem.title, 'Active Problem');
    });
  });
});
