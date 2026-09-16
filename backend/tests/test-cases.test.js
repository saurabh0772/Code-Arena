const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase5';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const { hashPassword } = require('../src/utils/password');

describe('Phase 5 Test Case Module Test Suite', () => {
  let adminUser;
  let adminToken;
  let normalUser;
  let userToken;
  let testProblem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Problem.deleteMany({});
      await TestCase.deleteMany({});
      await disconnectDB();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    await TestCase.deleteMany({});

    const passwordHash = await hashPassword('Password123!');

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin_tc@example.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    normalUser = await User.create({
      name: 'Normal User',
      email: 'user_tc@example.com',
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

    testProblem = await Problem.create({
      title: 'Sum of Two Numbers',
      description: 'Add two numbers and print the sum.',
      difficulty: 'EASY',
      tags: ['math'],
      inputFormat: 'Two integers a and b',
      outputFormat: 'Single integer sum',
      constraints: '-10^9 <= a, b <= 10^9',
      examples: [{ input: '2 3', output: '5' }],
      authorId: adminUser._id,
      isActive: true
    });
  });

  // ==========================================
  // CREATE TEST CASE TESTS
  // ==========================================
  describe('POST /api/v1/problems/:problemId/test-cases (Create Test Case)', () => {
    it('ADMIN can create a PUBLIC test case (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '10 20',
          expectedOutput: '30',
          visibility: 'PUBLIC',
          order: 1
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.testCase);
      assert.ok(res.body.data.testCase.id);
      assert.equal(res.body.data.testCase.problemId, testProblem._id.toString());
      assert.equal(res.body.data.testCase.input, '10 20');
      assert.equal(res.body.data.testCase.expectedOutput, '30');
      assert.equal(res.body.data.testCase.visibility, 'PUBLIC');
      assert.equal(res.body.data.testCase.order, 1);
      assert.equal(res.body.data.testCase.isActive, true);
    });

    it('ADMIN can create a HIDDEN test case (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '1000000 2000000',
          expectedOutput: '3000000',
          visibility: 'HIDDEN',
          order: 2
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.testCase.visibility, 'HIDDEN');
    });

    it('USER cannot create a test case (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: 1
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /insufficient permissions/i);
    });

    it('Unauthenticated request is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .send({
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: 1
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Invalid problemId format is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/problems/invalid-id-xyz/test-cases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: 1
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid problem ID format/i);
    });

    it('Non-existent problem returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/problems/${nonExistentId}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: 1
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Problem not found/i);
    });

    it('Validation rejects missing input or expectedOutput (400 Bad Request)', async () => {
      // Missing input
      const res1 = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: 1
        });
      assert.equal(res1.status, 400);

      // Missing expectedOutput
      const res2 = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '1 2',
          visibility: 'PUBLIC',
          order: 1
        });
      assert.equal(res2.status, 400);
    });

    it('Validation rejects invalid visibility (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PRIVATE', // Invalid enum
          order: 1
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Visibility must be either PUBLIC or HIDDEN/i);
    });

    it('Validation rejects invalid or negative order (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: -5
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /non-negative/i);
    });

    it('Client cannot spoof problemId in body; route param is authoritative', async () => {
      const fakeProblemId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          problemId: fakeProblemId,
          input: '1 2',
          expectedOutput: '3',
          visibility: 'PUBLIC',
          order: 1
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.testCase.problemId, testProblem._id.toString());
      assert.notEqual(res.body.data.testCase.problemId, fakeProblemId);
    });
  });

  // ==========================================
  // RETRIEVAL & HIDDEN TEST CASE SECURITY TESTS
  // ==========================================
  describe('GET /api/v1/problems/:problemId/test-cases (Role-Based Visibility)', () => {
    let publicTc;
    let hiddenTc;
    let inactiveTc;

    beforeEach(async () => {
      publicTc = await TestCase.create({
        problemId: testProblem._id,
        input: 'Public Input',
        expectedOutput: 'Public Output',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      });

      hiddenTc = await TestCase.create({
        problemId: testProblem._id,
        input: 'TOP SECRET HIDDEN INPUT',
        expectedOutput: 'TOP SECRET HIDDEN OUTPUT',
        visibility: 'HIDDEN',
        order: 2,
        isActive: true
      });

      inactiveTc = await TestCase.create({
        problemId: testProblem._id,
        input: 'Inactive Public Input',
        expectedOutput: 'Inactive Public Output',
        visibility: 'PUBLIC',
        order: 3,
        isActive: false
      });
    });

    it('Normal USER receives ONLY active PUBLIC test cases; HIDDEN data is never leaked', async () => {
      const res = await request(app)
        .get(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.testCases));
      // Only 1 testcase (publicTc)
      assert.equal(res.body.data.testCases.length, 1);

      const returnedTc = res.body.data.testCases[0];
      assert.equal(returnedTc.id, publicTc._id.toString());
      assert.equal(returnedTc.input, 'Public Input');
      assert.equal(returnedTc.expectedOutput, 'Public Output');
      assert.equal(returnedTc.visibility, 'PUBLIC');

      // Verify that hidden test case was completely excluded
      const rawString = JSON.stringify(res.body);
      assert.ok(!rawString.includes('TOP SECRET HIDDEN INPUT'));
      assert.ok(!rawString.includes('TOP SECRET HIDDEN OUTPUT'));
      assert.ok(!rawString.includes('Inactive Public Input'));
    });

    it('ADMIN receives all active test cases (both PUBLIC and HIDDEN)', async () => {
      const res = await request(app)
        .get(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.testCases.length, 2);

      const visibilities = res.body.data.testCases.map((tc) => tc.visibility);
      assert.ok(visibilities.includes('PUBLIC'));
      assert.ok(visibilities.includes('HIDDEN'));

      const rawString = JSON.stringify(res.body);
      assert.ok(rawString.includes('TOP SECRET HIDDEN INPUT'));
      assert.ok(rawString.includes('TOP SECRET HIDDEN OUTPUT'));
    });

    it('Normal USER targeting HIDDEN test case by ID gets 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/v1/test-cases/${hiddenTc._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Test case not found/i);
    });

    it('Normal USER targeting active PUBLIC test case by ID succeeds (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/test-cases/${publicTc._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.testCase.id, publicTc._id.toString());
      assert.equal(res.body.data.testCase.visibility, 'PUBLIC');
    });

    it('ADMIN can retrieve HIDDEN test case by ID (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/test-cases/${hiddenTc._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.testCase.id, hiddenTc._id.toString());
      assert.equal(res.body.data.testCase.visibility, 'HIDDEN');
      assert.equal(res.body.data.testCase.input, 'TOP SECRET HIDDEN INPUT');
    });

    it('Normal USER targeting inactive PUBLIC test case by ID gets 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/v1/test-cases/${inactiveTc._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
    });
  });

  // ==========================================
  // UPDATE TEST CASE TESTS
  // ==========================================
  describe('PATCH /api/v1/test-cases/:testCaseId (Update Test Case)', () => {
    let testCase;

    beforeEach(async () => {
      testCase = await TestCase.create({
        problemId: testProblem._id,
        input: 'Original Input',
        expectedOutput: 'Original Output',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      });
    });

    it('ADMIN can update test case partially (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/test-cases/${testCase._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expectedOutput: 'Updated Output',
          order: 10
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.testCase.expectedOutput, 'Updated Output');
      assert.equal(res.body.data.testCase.order, 10);
      assert.equal(res.body.data.testCase.input, 'Original Input'); // Unchanged
    });

    it('ADMIN can change visibility from PUBLIC to HIDDEN (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/test-cases/${testCase._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ visibility: 'HIDDEN' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.testCase.visibility, 'HIDDEN');

      // Now normal USER cannot access it anymore
      const userRes = await request(app)
        .get(`/api/v1/test-cases/${testCase._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      assert.equal(userRes.status, 404);
    });

    it('USER cannot update a test case (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/test-cases/${testCase._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ expectedOutput: 'Hacked' });

      assert.equal(res.status, 403);
    });

    it('Invalid testCaseId format returns 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/test-cases/not-a-valid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: 2 });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid test case ID format/i);
    });

    it('Non-existent testCaseId returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/test-cases/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: 2 });

      assert.equal(res.status, 404);
    });
  });

  // ==========================================
  // DEACTIVATE TEST CASE TESTS
  // ==========================================
  describe('DELETE /api/v1/test-cases/:testCaseId (Deactivate Test Case)', () => {
    let testCase;

    beforeEach(async () => {
      testCase = await TestCase.create({
        problemId: testProblem._id,
        input: 'Deactivate Input',
        expectedOutput: 'Deactivate Output',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      });
    });

    it('ADMIN can deactivate test case (200 OK, soft delete)', async () => {
      const res = await request(app)
        .delete(`/api/v1/test-cases/${testCase._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /deactivated successfully/i);

      // Verify still exists in MongoDB and isActive is false
      const dbTestCase = await TestCase.findById(testCase._id);
      assert.ok(dbTestCase);
      assert.equal(dbTestCase.isActive, false);

      // Deactivated test case is no longer visible to normal users
      const listRes = await request(app)
        .get(`/api/v1/problems/${testProblem._id}/test-cases`)
        .set('Authorization', `Bearer ${userToken}`);
      assert.equal(listRes.body.data.testCases.length, 0);
    });

    it('USER cannot deactivate test case (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/test-cases/${testCase._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 403);

      const dbTestCase = await TestCase.findById(testCase._id);
      assert.equal(dbTestCase.isActive, true);
    });

    it('Non-existent testCaseId returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/test-cases/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
    });
  });

  // ==========================================
  // REGRESSION VERIFICATION (Phases 1-4)
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
          name: 'Phase 5 Reg User',
          email: 'phase5reg@example.com',
          password: 'Password123!'
        });
      assert.equal(regRes.status, 201);
    });

    it('Problem endpoints continue to work', async () => {
      const probRes = await request(app)
        .get(`/api/v1/problems/${testProblem._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(probRes.status, 200);
      assert.equal(probRes.body.data.problem.title, 'Sum of Two Numbers');
    });
  });
});
