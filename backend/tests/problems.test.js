const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase4';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const { hashPassword } = require('../src/utils/password');

describe('Phase 4 Problem Module Test Suite', () => {
  let adminUser;
  let adminToken;
  let normalUser;
  let userToken;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Problem.deleteMany({});
      await disconnectDB();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});

    const passwordHash = await hashPassword('Password123!');

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    normalUser = await User.create({
      name: 'Normal User',
      email: 'user@example.com',
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
  });

  const sampleProblemData = {
    title: 'Two Sum',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    difficulty: 'EASY',
    tags: ['array', 'hashing'],
    inputFormat: 'The first line contains integers followed by target.',
    outputFormat: 'Return the indices of the two elements.',
    constraints: '2 <= nums.length <= 10^4',
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]'
      }
    ]
  };

  // ==========================================
  // CREATE PROBLEM TESTS
  // ==========================================
  describe('POST /api/v1/problems (Create Problem)', () => {
    it('ADMIN can create a problem with valid payload (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sampleProblemData);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.problem);
      assert.ok(res.body.data.problem.id);
      assert.equal(res.body.data.problem.title, 'Two Sum');
      assert.equal(res.body.data.problem.difficulty, 'EASY');
      assert.deepEqual(res.body.data.problem.tags, ['array', 'hashing']);
      assert.equal(res.body.data.problem.isActive, true);
      assert.equal(res.body.data.problem.authorId, adminUser._id.toString());
      assert.equal(res.body.data.problem.examples.length, 1);
    });

    it('USER cannot create a problem (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${userToken}`)
        .send(sampleProblemData);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /insufficient permissions/i);
    });

    it('Unauthenticated request is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .send(sampleProblemData);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Missing required fields are rejected with 400 Bad Request', async () => {
      // Missing title
      const missingTitle = { ...sampleProblemData, title: '' };
      const res1 = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(missingTitle);
      assert.equal(res1.status, 400);

      // Missing description
      const missingDesc = { ...sampleProblemData, description: '' };
      const res2 = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(missingDesc);
      assert.equal(res2.status, 400);

      // Missing inputFormat
      const missingInput = { ...sampleProblemData, inputFormat: '' };
      const res3 = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(missingInput);
      assert.equal(res3.status, 400);
    });

    it('Invalid difficulty is rejected with 400 Bad Request', async () => {
      const invalidDifficulty = { ...sampleProblemData, difficulty: 'EXTREME' };
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidDifficulty);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Difficulty must be one of: EASY, MEDIUM, HARD/i);
    });

    it('Invalid or empty examples array is rejected with 400 Bad Request', async () => {
      // Empty array
      const emptyExamples = { ...sampleProblemData, examples: [] };
      const res1 = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(emptyExamples);
      assert.equal(res1.status, 400);

      // Malformed example object
      const malformedExamples = {
        ...sampleProblemData,
        examples: [{ input: 123 }] // missing output and invalid input type
      };
      const res2 = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(malformedExamples);
      assert.equal(res2.status, 400);
    });

    it('Client-provided authorId is ignored and assigned authenticated admin ID', async () => {
      const spoofedAuthor = {
        ...sampleProblemData,
        authorId: new mongoose.Types.ObjectId().toString(),
        isActive: false
      };

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(spoofedAuthor);

      assert.equal(res.status, 201);
      assert.equal(res.body.data.problem.authorId, adminUser._id.toString());
      assert.equal(res.body.data.problem.isActive, true);

      const dbProblem = await Problem.findById(res.body.data.problem.id);
      assert.equal(dbProblem.authorId.toString(), adminUser._id.toString());
      assert.equal(dbProblem.isActive, true);
    });
  });

  // ==========================================
  // UPDATE PROBLEM TESTS
  // ==========================================
  describe('PATCH /api/v1/problems/:problemId (Update Problem)', () => {
    let problem;

    beforeEach(async () => {
      problem = await Problem.create({
        ...sampleProblemData,
        authorId: adminUser._id,
        isActive: true
      });
    });

    it('ADMIN can update problem fields partially (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/problems/${problem._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          difficulty: 'MEDIUM',
          tags: ['array', 'two-pointers']
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.problem.difficulty, 'MEDIUM');
      assert.deepEqual(res.body.data.problem.tags, ['array', 'two-pointers']);
      assert.equal(res.body.data.problem.title, 'Two Sum'); // Unmodified
    });

    it('USER cannot update a problem (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/problems/${problem._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ difficulty: 'HARD' });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('Unauthenticated request is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .patch(`/api/v1/problems/${problem._id}`)
        .send({ difficulty: 'HARD' });

      assert.equal(res.status, 401);
    });

    it('Invalid problem ID format is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/problems/not-a-valid-object-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ difficulty: 'MEDIUM' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid problem ID format/i);
    });

    it('Nonexistent problem returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/problems/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ difficulty: 'MEDIUM' });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Problem not found/i);
    });

    it('Client cannot change authorId or isActive via PATCH', async () => {
      const originalAuthorId = problem.authorId.toString();
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/v1/problems/${problem._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Two Sum',
          authorId: fakeId,
          isActive: false
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.problem.authorId, originalAuthorId);
      assert.equal(res.body.data.problem.isActive, true);

      const dbProblem = await Problem.findById(problem._id);
      assert.equal(dbProblem.authorId.toString(), originalAuthorId);
      assert.equal(dbProblem.isActive, true);
    });
  });

  // ==========================================
  // DEACTIVATE PROBLEM TESTS
  // ==========================================
  describe('DELETE /api/v1/problems/:problemId (Deactivate Problem)', () => {
    let problem;

    beforeEach(async () => {
      problem = await Problem.create({
        ...sampleProblemData,
        authorId: adminUser._id,
        isActive: true
      });
    });

    it('ADMIN can deactivate problem (200 OK, soft delete)', async () => {
      const res = await request(app)
        .delete(`/api/v1/problems/${problem._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /deactivated successfully/i);

      // Verify document still exists in MongoDB and isActive is false
      const dbProblem = await Problem.findById(problem._id);
      assert.ok(dbProblem);
      assert.equal(dbProblem.isActive, false);
    });

    it('USER cannot deactivate problem (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/problems/${problem._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);

      const dbProblem = await Problem.findById(problem._id);
      assert.equal(dbProblem.isActive, true);
    });

    it('Unauthenticated request is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .delete(`/api/v1/problems/${problem._id}`);

      assert.equal(res.status, 401);
    });

    it('Nonexistent problem returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/problems/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('Deactivating an already inactive problem is idempotent', async () => {
      problem.isActive = false;
      await problem.save();

      const res = await request(app)
        .delete(`/api/v1/problems/${problem._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  // ==========================================
  // LIST PROBLEMS TESTS
  // ==========================================
  describe('GET /api/v1/problems (List Problems)', () => {
    beforeEach(async () => {
      await Problem.create([
        {
          ...sampleProblemData,
          title: 'Problem Easy 1',
          difficulty: 'EASY',
          authorId: adminUser._id,
          isActive: true
        },
        {
          ...sampleProblemData,
          title: 'Problem Medium 1',
          difficulty: 'MEDIUM',
          authorId: adminUser._id,
          isActive: true
        },
        {
          ...sampleProblemData,
          title: 'Deactivated Problem',
          difficulty: 'HARD',
          authorId: adminUser._id,
          isActive: false
        }
      ]);
    });

    it('Authenticated USER can list active problems', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.problems));
      // Only 2 active problems
      assert.equal(res.body.data.problems.length, 2);

      // Verify deactivated problem is excluded
      const titles = res.body.data.problems.map((p) => p.title);
      assert.ok(titles.includes('Problem Easy 1'));
      assert.ok(titles.includes('Problem Medium 1'));
      assert.ok(!titles.includes('Deactivated Problem'));

      // Verify large fields are omitted from list projection
      const firstProblem = res.body.data.problems[0];
      assert.equal(firstProblem.description, undefined);
      assert.equal(firstProblem.inputFormat, undefined);
      assert.equal(firstProblem.outputFormat, undefined);
      assert.equal(firstProblem.constraints, undefined);
      assert.equal(firstProblem.examples, undefined);
    });

    it('ADMIN can list active problems', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.problems.length, 2);
    });

    it('Filtering by difficulty works (?difficulty=EASY)', async () => {
      const res = await request(app)
        .get('/api/v1/problems?difficulty=EASY')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.problems.length, 1);
      assert.equal(res.body.data.problems[0].title, 'Problem Easy 1');
      assert.equal(res.body.data.problems[0].difficulty, 'EASY');
    });

    it('Unauthenticated request can list active problems (Public API)', async () => {
      const res = await request(app).get('/api/v1/problems');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.problems.length, 2);
    });
  });

  // ==========================================
  // GET SINGLE PROBLEM TESTS
  // ==========================================
  describe('GET /api/v1/problems/:problemId (Get Single Problem)', () => {
    let activeProblem;
    let inactiveProblem;

    beforeEach(async () => {
      activeProblem = await Problem.create({
        ...sampleProblemData,
        title: 'Active Detail Problem',
        authorId: adminUser._id,
        isActive: true
      });

      inactiveProblem = await Problem.create({
        ...sampleProblemData,
        title: 'Inactive Problem',
        authorId: adminUser._id,
        isActive: false
      });
    });

    it('Authenticated USER can retrieve full details of active problem', async () => {
      const res = await request(app)
        .get(`/api/v1/problems/${activeProblem._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.problem);
      assert.equal(res.body.data.problem.id, activeProblem._id.toString());
      assert.equal(res.body.data.problem.title, 'Active Detail Problem');
      assert.equal(res.body.data.problem.description, sampleProblemData.description);
      assert.equal(res.body.data.problem.inputFormat, sampleProblemData.inputFormat);
      assert.equal(res.body.data.problem.outputFormat, sampleProblemData.outputFormat);
      assert.equal(res.body.data.problem.constraints, sampleProblemData.constraints);
      assert.equal(res.body.data.problem.examples.length, 1);
      assert.equal(res.body.data.problem.isActive, true);
    });

    it('ADMIN can retrieve full details of active problem', async () => {
      const res = await request(app)
        .get(`/api/v1/problems/${activeProblem._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.problem.title, 'Active Detail Problem');
    });

    it('Inactive problem returns 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/v1/problems/${inactiveProblem._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Problem not found/i);
    });

    it('Nonexistent problem returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/problems/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('Invalid ID format returns 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/problems/invalid-id-123')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid problem ID format/i);
    });

    it('Unauthenticated request can retrieve active problem details (Public API)', async () => {
      const res = await request(app).get(`/api/v1/problems/${activeProblem._id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.problem.title, 'Active Detail Problem');
    });
  });

  // ==========================================
  // SECURITY & ROLE PROTECTION TESTS
  // ==========================================
  describe('Security & Role Manipulation Resistance', () => {
    it('Client cannot bypass ADMIN check with role in headers or body', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', `Bearer ${userToken}`)
        .set('role', 'ADMIN')
        .set('x-role', 'ADMIN')
        .send({
          ...sampleProblemData,
          role: 'ADMIN'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  // ==========================================
  // REGRESSION VERIFICATION (Phases 1, 2, 3)
  // ==========================================
  describe('Regression Verification', () => {
    it('GET /health continues to return 200 and connected status', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.database, 'connected');
    });

    it('POST /api/v1/auth/register continues to work', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'New Registered User',
          email: 'regression_reg@example.com',
          password: 'Password123!'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.user.email, 'regression_reg@example.com');
      assert.equal(res.body.data.user.role, 'USER');
    });

    it('POST /api/v1/auth/login and GET /api/v1/users/me continue to work', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'Password123!'
        });

      assert.equal(loginRes.status, 200);
      const token = loginRes.body.data.token;
      assert.ok(token);

      const meRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.data.email, 'user@example.com');
    });
  });
});
