/**
 * Phase 8 MVP Integration Test Suite
 * Connects Backend Modular Monolith to Execution Engine (C++).
 * Verifies End-to-End Online Judge flow:
 * Submission -> Execution -> Test Cases -> Output Comparison -> Verdict -> MongoDB -> Retrieval
 */

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const Submission = require('../src/modules/submissions/submission.model');
const { hashPassword } = require('../src/utils/password');

describe('Phase 8 — CodeArena MVP Integration Test Suite', () => {
  let user1;
  let user2;
  let adminUser;
  let user1Token;
  let user2Token;
  let adminToken;
  let activeProblem;
  let inactiveProblem;

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Submission.deleteMany({});
    await TestCase.deleteMany({});
    await Problem.deleteMany({});
    await User.deleteMany({});

    const passwordHash = await hashPassword('SecurePass123!');

    user1 = await User.create({
      name: 'Coder Alice',
      email: 'alice@example.com',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    user2 = await User.create({
      name: 'Coder Bob',
      email: 'bob@example.com',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    adminUser = await User.create({
      name: 'Admin Boss',
      email: 'boss@example.com',
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
      title: 'Sum of Two Numbers',
      description: 'Given two integers a and b, print their sum.',
      difficulty: 'EASY',
      tags: ['math', 'basics'],
      inputFormat: 'Two integers separated by space',
      outputFormat: 'Single integer',
      constraints: '-1000 <= a, b <= 1000',
      examples: [{ input: '2 3', output: '5' }],
      authorId: adminUser._id,
      isActive: true
    });

    inactiveProblem = await Problem.create({
      title: 'Old Problem',
      description: 'Inactive problem not open for submissions.',
      difficulty: 'HARD',
      tags: ['deprecated'],
      inputFormat: 'None',
      outputFormat: 'None',
      constraints: 'None',
      examples: [{ input: '0', output: '0' }],
      authorId: adminUser._id,
      isActive: false
    });
  });

  // ==========================================
  // TEST 1 — ACCEPTED C++
  // ==========================================
  it('Test 1 — Accepted C++: All test cases pass -> status: COMPLETED, verdict: ACCEPTED', async () => {
    // 1 public, 1 hidden test case
    await TestCase.create([
      {
        problemId: activeProblem._id,
        input: '5 7\n',
        expectedOutput: '12\n',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      },
      {
        problemId: activeProblem._id,
        input: '100 -50\n',
        expectedOutput: '50\n',
        visibility: 'HIDDEN',
        order: 2,
        isActive: true
      }
    ]);

    const validSolution = `
#include <iostream>

int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << std::endl;
    }
    return 0;
}
    `.trim();

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: validSolution
      });

    assert.equal(postRes.status, 201);
    assert.equal(postRes.body.success, true);
    assert.ok(postRes.body.data.submission.id);

    const submissionId = postRes.body.data.submission.id;

    // Retrieve submission via GET
    const getRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.success, true);
    const sub = getRes.body.data.submission;
    assert.equal(sub.status, 'COMPLETED');
    assert.equal(sub.verdict, 'ACCEPTED');
    assert.equal(sub.testsPassed, 2);
    assert.equal(sub.totalTests, 2);
    assert.equal(typeof sub.runtimeMs, 'number');
    assert.equal(sub.memoryKb, null); // memory accounting pending sandbox phase
  });

  // ==========================================
  // TEST 2 — WRONG ANSWER
  // ==========================================
  it('Test 2 — Wrong Answer: Valid C++ with incorrect logic -> status: COMPLETED, verdict: WRONG_ANSWER', async () => {
    await TestCase.create({
      problemId: activeProblem._id,
      input: '4 6\n',
      expectedOutput: '10\n',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });

    const wrongSolution = `
#include <iostream>

int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a * b) << std::endl; // Bug: multiplication instead of sum
    }
    return 0;
}
    `.trim();

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: wrongSolution
      });

    assert.equal(postRes.status, 201);
    const submissionId = postRes.body.data.submission.id;

    const getRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(getRes.status, 200);
    const sub = getRes.body.data.submission;
    assert.equal(sub.status, 'COMPLETED');
    assert.equal(sub.verdict, 'WRONG_ANSWER');
    assert.equal(sub.testsPassed, 0);
    assert.equal(sub.totalTests, 1);
  });

  // ==========================================
  // TEST 3 — COMPILATION ERROR
  // ==========================================
  it('Test 3 — Compilation Error: C++ syntax error -> status: COMPLETED, verdict: COMPILATION_ERROR', async () => {
    await TestCase.create({
      problemId: activeProblem._id,
      input: '1 2\n',
      expectedOutput: '3\n',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });

    const invalidCpp = `
#include <iostream>

int main() {
    syntax_error_not_declared;
    return 0;
}
    `.trim();

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: invalidCpp
      });

    assert.equal(postRes.status, 201);
    const submissionId = postRes.body.data.submission.id;

    const getRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(getRes.status, 200);
    const sub = getRes.body.data.submission;
    assert.equal(sub.status, 'COMPLETED');
    assert.equal(sub.verdict, 'COMPILATION_ERROR');
    assert.equal(sub.testsPassed, 0);
    assert.equal(sub.totalTests, 1);
    assert.equal(sub.runtimeMs, null);
  });

  // ==========================================
  // TEST 4 — RUNTIME ERROR
  // ==========================================
  it('Test 4 — Runtime Error: Non-zero exit code or abort -> status: COMPLETED, verdict: RUNTIME_ERROR', async () => {
    await TestCase.create({
      problemId: activeProblem._id,
      input: '1 2\n',
      expectedOutput: '3\n',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });

    const runtimeCrashCpp = `
#include <cstdlib>

int main() {
    std::abort();
    return 0;
}
    `.trim();

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: runtimeCrashCpp
      });

    assert.equal(postRes.status, 201);
    const submissionId = postRes.body.data.submission.id;

    const getRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(getRes.status, 200);
    const sub = getRes.body.data.submission;
    assert.equal(sub.status, 'COMPLETED');
    assert.equal(sub.verdict, 'RUNTIME_ERROR');
  });

  // ==========================================
  // TEST 5 — HIDDEN TEST SECURITY
  // ==========================================
  it('Test 5 — Hidden Test Security: Hidden test is executed, affects verdict, but is never leaked', async () => {
    // Public test case
    await TestCase.create({
      problemId: activeProblem._id,
      input: '1 1\n',
      expectedOutput: '2\n',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });

    // Hidden test case
    await TestCase.create({
      problemId: activeProblem._id,
      input: '99 1\n',
      expectedOutput: '100\n',
      visibility: 'HIDDEN',
      order: 2,
      isActive: true
    });

    // Hardcoded cheating solution: passes public test (1 1 -> 2), but fails hidden test (99 1 -> 0)
    const cheatSolution = `
#include <iostream>

int main() {
    int a, b;
    if (std::cin >> a >> b) {
        if (a == 1 && b == 1) std::cout << 2 << std::endl;
        else std::cout << 0 << std::endl;
    }
    return 0;
}
    `.trim();

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: cheatSolution
      });

    const submissionId = postRes.body.data.submission.id;

    // 1. Hidden test affected verdict (failed hidden test -> WRONG_ANSWER)
    const getRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    const sub = getRes.body.data.submission;
    assert.equal(sub.verdict, 'WRONG_ANSWER');
    assert.equal(sub.testsPassed, 1);
    assert.equal(sub.totalTests, 2);

    // 2. Submission response does NOT contain any hidden test input or expected output
    const subStr = JSON.stringify(getRes.body);
    assert.equal(subStr.includes('99 1'), false);
    assert.equal(subStr.includes('100'), false);
    assert.equal(sub.input, undefined);
    assert.equal(sub.expectedOutput, undefined);

    // 3. Normal user querying problem test cases ONLY gets public test case
    const testCasesRes = await request(app)
      .get(`/api/v1/problems/${activeProblem._id}/test-cases`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(testCasesRes.status, 200);
    assert.equal(testCasesRes.body.data.testCases.length, 1);
    assert.equal(testCasesRes.body.data.testCases[0].visibility, 'PUBLIC');
    assert.equal(JSON.stringify(testCasesRes.body).includes('99 1'), false);
  });

  // ==========================================
  // TEST 6 — SUBMISSION OWNERSHIP
  // ==========================================
  it('Test 6 — Submission Ownership: Only owner and admin can access submission, other users receive 403', async () => {
    await TestCase.create({
      problemId: activeProblem._id,
      input: '1 1\n',
      expectedOutput: '2\n',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: '#include <iostream>\nint main(){ std::cout << 2; return 0; }'
      });

    const submissionId = postRes.body.data.submission.id;

    // Owner (user1) can access -> 200 OK
    const ownerRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    assert.equal(ownerRes.status, 200);

    // User2 (non-owner) CANNOT access -> 403 Forbidden
    const otherRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user2Token}`);
    assert.equal(otherRes.status, 403);
    assert.match(otherRes.body.message, /Access denied/i);

    // Admin CAN access -> 200 OK
    const adminRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminRes.status, 200);
  });

  // ==========================================
  // TEST 7 — INACTIVE PROBLEM
  // ==========================================
  it('Test 7 — Inactive Problem: Submission rejected with 400 Bad Request, no execution occurs', async () => {
    const res = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: inactiveProblem._id.toString(),
        language: 'CPP',
        sourceCode: '#include <iostream>\nint main(){ return 0; }'
      });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /inactive problem/i);

    const count = await Submission.countDocuments();
    assert.equal(count, 0);
  });

  // ==========================================
  // TEST 8 — MULTIPLE TEST CASES & PARTIAL PASS
  // ==========================================
  it('Test 8 — Multiple Test Cases: Partial pass accurately counts testsPassed and assigns WRONG_ANSWER', async () => {
    // 3 test cases
    await TestCase.create([
      {
        problemId: activeProblem._id,
        input: '1 2\n',
        expectedOutput: '3\n',
        visibility: 'PUBLIC',
        order: 1,
        isActive: true
      },
      {
        problemId: activeProblem._id,
        input: '5 5\n',
        expectedOutput: '10\n',
        visibility: 'PUBLIC',
        order: 2,
        isActive: true
      },
      {
        problemId: activeProblem._id,
        input: '20 30\n',
        expectedOutput: '50\n',
        visibility: 'HIDDEN',
        order: 3,
        isActive: true
      }
    ]);

    // Code passes test 1 (1+2=3) and test 3 (20+30=50), but fails test 2 (fails for 5+5)
    const partialSolution = `
#include <iostream>

int main() {
    int a, b;
    if (std::cin >> a >> b) {
        if (a == 5 && b == 5) std::cout << 999 << std::endl; // Fail test 2
        else std::cout << (a + b) << std::endl;
    }
    return 0;
}
    `.trim();

    const postRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: partialSolution
      });

    const submissionId = postRes.body.data.submission.id;

    const getRes = await request(app)
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(getRes.status, 200);
    const sub = getRes.body.data.submission;
    assert.equal(sub.status, 'COMPLETED');
    assert.equal(sub.verdict, 'WRONG_ANSWER');
    assert.equal(sub.testsPassed, 2);
    assert.equal(sub.totalTests, 3);
  });

  // ==========================================
  // TEST 9 — MULTIPLE SUBMISSIONS
  // ==========================================
  it('Test 9 — Multiple Submissions: Independent submissions do not conflict or overwrite states', async () => {
    await TestCase.create({
      problemId: activeProblem._id,
      input: '3 4\n',
      expectedOutput: '7\n',
      visibility: 'PUBLIC',
      order: 1,
      isActive: true
    });

    // Submission 1: Valid
    const sub1Res = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: '#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout<<a+b; return 0; }'
      });

    // Submission 2: Invalid (Wrong Answer)
    const sub2Res = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        problemId: activeProblem._id.toString(),
        language: 'CPP',
        sourceCode: '#include <iostream>\nint main(){ std::cout<<0; return 0; }'
      });

    const get1 = await request(app)
      .get(`/api/v1/submissions/${sub1Res.body.data.submission.id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    const get2 = await request(app)
      .get(`/api/v1/submissions/${sub2Res.body.data.submission.id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    assert.equal(get1.body.data.submission.verdict, 'ACCEPTED');
    assert.equal(get1.body.data.submission.userId, user1._id.toString());

    assert.equal(get2.body.data.submission.verdict, 'WRONG_ANSWER');
    assert.equal(get2.body.data.submission.userId, user2._id.toString());
  });

  // ==========================================
  // TEST 10 — REGRESSION
  // ==========================================
  it('Test 10 — Regression: Core endpoints (/health, Auth, Problems) remain functional', async () => {
    // Health check
    const healthRes = await request(app).get('/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.database, 'connected');

    // Problem listing
    const probRes = await request(app)
      .get('/api/v1/problems')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.equal(probRes.status, 200);
    assert.ok(probRes.body.data.problems.length >= 1);
  });
});
