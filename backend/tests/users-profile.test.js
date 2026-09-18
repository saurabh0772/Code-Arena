const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-users-profile';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const TestCase = require('../src/modules/test-cases/test-case.model');
const Submission = require('../src/modules/submissions/submission.model');
const { hashPassword } = require('../src/utils/password');

describe('User Profile, Solved Problems & Activity Test Suite', () => {
  let user1;
  let user1Token;
  let user2;
  let user2Token;
  let easyProblem1;
  let easyProblem2;
  let mediumProblem;
  let hardProblem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Problem.deleteMany({});
      await TestCase.deleteMany({});
      await Submission.deleteMany({});
      await disconnectDB();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    await TestCase.deleteMany({});
    await Submission.deleteMany({});

    const passwordHash = await hashPassword('Password123!');

    user1 = await User.create({
      name: 'User One',
      email: 'user1@example.com',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    user2 = await User.create({
      name: 'User Two',
      email: 'user2@example.com',
      passwordHash,
      role: 'USER',
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

    // Create 4 test problems
    easyProblem1 = await Problem.create({
      title: 'Sum of Two Numbers',
      description: 'Add two integers',
      difficulty: 'EASY',
      tags: ['math', 'basics'],
      inputFormat: 'Two integers',
      outputFormat: 'One integer',
      constraints: 'N <= 10^9',
      examples: [{ input: '1 2\n', output: '3\n' }],
      authorId: user1._id,
      isActive: true
    });

    easyProblem2 = await Problem.create({
      title: 'Reverse String',
      description: 'Reverse a given string',
      difficulty: 'EASY',
      tags: ['strings'],
      inputFormat: 'String',
      outputFormat: 'Reversed string',
      constraints: 'Length <= 100',
      examples: [{ input: 'abc\n', output: 'cba\n' }],
      authorId: user1._id,
      isActive: true
    });

    mediumProblem = await Problem.create({
      title: 'Valid Parentheses',
      description: 'Check matching brackets',
      difficulty: 'MEDIUM',
      tags: ['stack', 'strings'],
      inputFormat: 'Bracket string',
      outputFormat: 'YES or NO',
      constraints: 'Length <= 10^4',
      examples: [{ input: '()\n', output: 'YES\n' }],
      authorId: user1._id,
      isActive: true
    });

    hardProblem = await Problem.create({
      title: 'Trapping Rain Water',
      description: 'Compute trapped rainwater',
      difficulty: 'HARD',
      tags: ['array', 'two-pointers'],
      inputFormat: 'Array of heights',
      outputFormat: 'Water units',
      constraints: 'N <= 2*10^4',
      examples: [{ input: '3\n1 0 2\n', output: '1\n' }],
      authorId: user1._id,
      isActive: true
    });

    // Create test cases so problems show readiness
    for (const p of [easyProblem1, easyProblem2, mediumProblem, hardProblem]) {
      await TestCase.create([
        {
          problemId: p._id,
          input: 'test in\n',
          expectedOutput: 'test out\n',
          visibility: 'PUBLIC',
          order: 1,
          isActive: true
        },
        {
          problemId: p._id,
          input: 'secret in\n',
          expectedOutput: 'secret out\n',
          visibility: 'HIDDEN',
          order: 2,
          isActive: true
        }
      ]);
    }
  });

  // =========================================================================
  // 1. GET /api/v1/users/me/stats
  // =========================================================================
  describe('GET /api/v1/users/me/stats', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/users/me/stats');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('returns zero statistics safely for user with no submissions without divide-by-zero error', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/stats')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const stats = res.body.data.stats || res.body.data;
      assert.strictEqual(stats.totalSubmissions, 0);
      assert.strictEqual(stats.acceptedSubmissions, 0);
      assert.strictEqual(stats.wrongAnswerSubmissions, 0);
      assert.strictEqual(stats.compilationErrorSubmissions, 0);
      assert.strictEqual(stats.runtimeErrorSubmissions, 0);
      assert.strictEqual(stats.timeLimitExceededSubmissions, 0);
      assert.strictEqual(stats.memoryLimitExceededSubmissions, 0);
      assert.strictEqual(stats.acceptanceRate, 0);
      assert.strictEqual(stats.totalProblemsSolved, 0);
      assert.strictEqual(stats.easySolved, 0);
      assert.strictEqual(stats.mediumSolved, 0);
      assert.strictEqual(stats.hardSolved, 0);
    });

    it('calculates accurate statistics and acceptanceRate for user submissions', async () => {
      // User 1 submissions:
      // easyProblem1: 2 ACCEPTED (should count as 1 problem solved)
      // easyProblem2: 1 WRONG_ANSWER (not solved)
      // mediumProblem: 1 ACCEPTED (1 problem solved)
      // hardProblem: 1 COMPILATION_ERROR, 1 TIME_LIMIT_EXCEEDED
      await Submission.create([
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'CPP',
          sourceCode: 'code1',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          runtimeMs: 10,
          memoryKb: 2000
        },
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'PYTHON',
          sourceCode: 'code2',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          runtimeMs: 15,
          memoryKb: 3000
        },
        {
          userId: user1._id,
          problemId: easyProblem2._id,
          language: 'JAVASCRIPT',
          sourceCode: 'code3',
          status: 'COMPLETED',
          verdict: 'WRONG_ANSWER'
        },
        {
          userId: user1._id,
          problemId: mediumProblem._id,
          language: 'CPP',
          sourceCode: 'code4',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        },
        {
          userId: user1._id,
          problemId: hardProblem._id,
          language: 'CPP',
          sourceCode: 'code5',
          status: 'COMPLETED',
          verdict: 'COMPILATION_ERROR'
        },
        {
          userId: user1._id,
          problemId: hardProblem._id,
          language: 'CPP',
          sourceCode: 'code6',
          status: 'COMPLETED',
          verdict: 'TIME_LIMIT_EXCEEDED'
        }
      ]);

      // User 2 submissions (should be isolated from User 1)
      await Submission.create([
        {
          userId: user2._id,
          problemId: hardProblem._id,
          language: 'CPP',
          sourceCode: 'user2 code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        }
      ]);

      const res = await request(app)
        .get('/api/v1/users/me/stats')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const stats = res.body.data.stats || res.body.data;
      assert.strictEqual(stats.totalSubmissions, 6);
      assert.strictEqual(stats.acceptedSubmissions, 3);
      assert.strictEqual(stats.wrongAnswerSubmissions, 1);
      assert.strictEqual(stats.compilationErrorSubmissions, 1);
      assert.strictEqual(stats.timeLimitExceededSubmissions, 1);
      // 3 accepted out of 6 total = 50.0%
      assert.strictEqual(stats.acceptanceRate, 50.0);
      // Distinct problems solved: easyProblem1 (EASY) and mediumProblem (MEDIUM) = 2
      assert.strictEqual(stats.totalProblemsSolved, 2);
      assert.strictEqual(stats.easySolved, 1);
      assert.strictEqual(stats.mediumSolved, 1);
      assert.strictEqual(stats.hardSolved, 0);
    });

    it('enforces user isolation: user cannot access another user stats via query or body parameters', async () => {
      // Create an accepted submission for User 2
      await Submission.create({
        userId: user2._id,
        problemId: hardProblem._id,
        language: 'CPP',
        sourceCode: 'user2 code',
        status: 'COMPLETED',
        verdict: 'ACCEPTED'
      });

      // User 1 requests stats with spoofed userId in query and body
      const res = await request(app)
        .get(`/api/v1/users/me/stats?userId=${user2._id}`)
        .send({ userId: user2._id.toString() })
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      const stats = res.body.data.stats || res.body.data;
      // User 1 still has 0 submissions
      assert.strictEqual(stats.totalSubmissions, 0);
      assert.strictEqual(stats.totalProblemsSolved, 0);
    });
  });

  // =========================================================================
  // 2. GET /api/v1/users/me/solved-problems
  // =========================================================================
  describe('GET /api/v1/users/me/solved-problems', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/users/me/solved-problems');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('returns empty list and valid pagination when user has no solved problems', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/solved-problems')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.deepStrictEqual(res.body.data.problems, []);
      assert.strictEqual(res.body.data.pagination.total, 0);
    });

    it('returns only problems with at least one ACCEPTED submission and hides secrets/sourceCode', async () => {
      // User 1 solved easyProblem1 and mediumProblem; failed easyProblem2
      await Submission.create([
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'CPP',
          sourceCode: 'sensitive secret source code 1',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        },
        {
          userId: user1._id,
          problemId: easyProblem2._id,
          language: 'CPP',
          sourceCode: 'sensitive secret source code 2',
          status: 'COMPLETED',
          verdict: 'WRONG_ANSWER'
        },
        {
          userId: user1._id,
          problemId: mediumProblem._id,
          language: 'PYTHON',
          sourceCode: 'sensitive secret source code 3',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        }
      ]);

      const res = await request(app)
        .get('/api/v1/users/me/solved-problems')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.problems.length, 2);

      const titles = res.body.data.problems.map((p) => p.title);
      assert.ok(titles.includes('Sum of Two Numbers'));
      assert.ok(titles.includes('Valid Parentheses'));
      assert.ok(!titles.includes('Reverse String')); // WRONG_ANSWER excluded

      // Verify no sensitive fields leaked
      for (const p of res.body.data.problems) {
        assert.strictEqual(p.solved, true);
        assert.strictEqual(p.sourceCode, undefined);
        assert.strictEqual(p.testCases, undefined);
        assert.strictEqual(p.hiddenTestCases, undefined);
      }
    });

    it('supports pagination parameters (page, limit)', async () => {
      // Solve both easy problems and medium problem
      for (const p of [easyProblem1, easyProblem2, mediumProblem]) {
        await Submission.create({
          userId: user1._id,
          problemId: p._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        });
      }

      const page1Res = await request(app)
        .get('/api/v1/users/me/solved-problems?page=1&limit=2')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(page1Res.status, 200);
      assert.strictEqual(page1Res.body.data.problems.length, 2);
      assert.strictEqual(page1Res.body.data.pagination.page, 1);
      assert.strictEqual(page1Res.body.data.pagination.limit, 2);
      assert.strictEqual(page1Res.body.data.pagination.total, 3);
      assert.strictEqual(page1Res.body.data.pagination.totalPages, 2);

      const page2Res = await request(app)
        .get('/api/v1/users/me/solved-problems?page=2&limit=2')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(page2Res.status, 200);
      assert.strictEqual(page2Res.body.data.problems.length, 1);
      assert.strictEqual(page2Res.body.data.pagination.page, 2);
    });

    it('supports difficulty filter', async () => {
      await Submission.create([
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        },
        {
          userId: user1._id,
          problemId: mediumProblem._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        }
      ]);

      const res = await request(app)
        .get('/api/v1/users/me/solved-problems?difficulty=MEDIUM')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.problems.length, 1);
      assert.strictEqual(res.body.data.problems[0].title, 'Valid Parentheses');
    });

    it('enforces user isolation: User 1 does not see User 2 solved problems', async () => {
      // User 2 solves hardProblem
      await Submission.create({
        userId: user2._id,
        problemId: hardProblem._id,
        language: 'CPP',
        sourceCode: 'code',
        status: 'COMPLETED',
        verdict: 'ACCEPTED'
      });

      const res = await request(app)
        .get('/api/v1/users/me/solved-problems')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.problems.length, 0);
    });
  });

  // =========================================================================
  // 3. GET /api/v1/users/me/activity
  // =========================================================================
  describe('GET /api/v1/users/me/activity', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/users/me/activity');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('returns empty activity structure when user has no submissions', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/activity')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.range, '1y');
      assert.strictEqual(res.body.data.totalSubmissions, 0);
      assert.deepStrictEqual(res.body.data.activity, []);
    });

    it('aggregates submissions by date and returns chronological counts', async () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Create 2 submissions yesterday, 3 submissions today for User 1
      await Submission.create([
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          createdAt: yesterday
        },
        {
          userId: user1._id,
          problemId: easyProblem2._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'WRONG_ANSWER',
          createdAt: yesterday
        },
        {
          userId: user1._id,
          problemId: mediumProblem._id,
          language: 'PYTHON',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          createdAt: today
        },
        {
          userId: user1._id,
          problemId: hardProblem._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'COMPILATION_ERROR',
          createdAt: today
        },
        {
          userId: user1._id,
          problemId: hardProblem._id,
          language: 'JAVASCRIPT',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          createdAt: today
        }
      ]);

      // User 2 submission (isolated)
      await Submission.create({
        userId: user2._id,
        problemId: hardProblem._id,
        language: 'CPP',
        sourceCode: 'code',
        status: 'COMPLETED',
        verdict: 'ACCEPTED',
        createdAt: today
      });

      const res = await request(app)
        .get('/api/v1/users/me/activity?range=30d')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.range, '30d');
      assert.strictEqual(res.body.data.totalSubmissions, 5); // Excludes user2

      const activity = res.body.data.activity;
      assert.strictEqual(activity.length, 2);

      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      const yesterdayItem = activity.find((a) => a.date === yesterdayStr);
      const todayItem = activity.find((a) => a.date === todayStr);

      assert.ok(yesterdayItem, 'Yesterday activity item should exist');
      assert.strictEqual(yesterdayItem.submissions, 2);

      assert.ok(todayItem, 'Today activity item should exist');
      assert.strictEqual(todayItem.submissions, 3);
    });

    it('defaults safely to 1y when an unrecognized range query is supplied', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/activity?range=invalid_range')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.range, '1y');
    });
  });

  // =========================================================================
  // 4. GET /api/v1/problems (Solved Status & Query Enhancements)
  // =========================================================================
  describe('GET /api/v1/problems (Solved Status & Query Enhancements)', () => {
    it('returns solved: false for all problems when unauthenticated (Public API)', async () => {
      // User 1 solved easyProblem1
      await Submission.create({
        userId: user1._id,
        problemId: easyProblem1._id,
        language: 'CPP',
        sourceCode: 'code',
        status: 'COMPLETED',
        verdict: 'ACCEPTED'
      });

      const res = await request(app).get('/api/v1/problems');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.problems.length, 4);

      for (const p of res.body.data.problems) {
        assert.strictEqual(p.solved, false);
      }
    });

    it('derives solved: true only for problems the authenticated user has solved with ACCEPTED', async () => {
      // User 1 solved easyProblem1 with ACCEPTED, but failed mediumProblem with WRONG_ANSWER
      await Submission.create([
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        },
        {
          userId: user1._id,
          problemId: mediumProblem._id,
          language: 'CPP',
          sourceCode: 'code',
          status: 'COMPLETED',
          verdict: 'WRONG_ANSWER'
        }
      ]);

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const easyP1 = res.body.data.problems.find((p) => p.id === easyProblem1._id.toString());
      const easyP2 = res.body.data.problems.find((p) => p.id === easyProblem2._id.toString());
      const medP = res.body.data.problems.find((p) => p.id === mediumProblem._id.toString());
      const hardP = res.body.data.problems.find((p) => p.id === hardProblem._id.toString());

      assert.strictEqual(easyP1.solved, true, 'Solved problem should have solved: true');
      assert.strictEqual(easyP2.solved, false, 'Unattempted problem should have solved: false');
      assert.strictEqual(medP.solved, false, 'Failed problem should have solved: false');
      assert.strictEqual(hardP.solved, false, 'Unattempted problem should have solved: false');
    });

    it('supports tag (singular) filter as well as tags (plural)', async () => {
      // ?tag=math
      const resTag = await request(app).get('/api/v1/problems?tag=math');
      assert.strictEqual(resTag.status, 200);
      assert.strictEqual(resTag.body.data.problems.length, 1);
      assert.strictEqual(resTag.body.data.problems[0].title, 'Sum of Two Numbers');

      // ?tags=math,basics
      const resTags = await request(app).get('/api/v1/problems?tags=math,basics');
      assert.strictEqual(resTags.status, 200);
      assert.strictEqual(resTags.body.data.problems.length, 1);
    });

    it('supports title search query', async () => {
      const res = await request(app).get('/api/v1/problems?search=Parentheses');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.problems.length, 1);
      assert.strictEqual(res.body.data.problems[0].title, 'Valid Parentheses');
    });

    it('supports combined filters (difficulty, tag, search, pagination)', async () => {
      const res = await request(app).get(
        '/api/v1/problems?page=1&limit=10&difficulty=EASY&tag=math&search=Sum'
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.problems.length, 1);
      assert.strictEqual(res.body.data.problems[0].title, 'Sum of Two Numbers');
      assert.strictEqual(res.body.data.pagination.total, 1);
    });
  });

  // =========================================================================
  // 5. GET /api/v1/submissions/me (Filters & Pagination Verification)
  // =========================================================================
  describe('GET /api/v1/submissions/me (Filters & Pagination)', () => {
    it('supports filtering by problemId, verdict, and language with pagination', async () => {
      await Submission.create([
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'CPP',
          sourceCode: 'code1',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        },
        {
          userId: user1._id,
          problemId: easyProblem1._id,
          language: 'PYTHON',
          sourceCode: 'code2',
          status: 'COMPLETED',
          verdict: 'WRONG_ANSWER'
        },
        {
          userId: user1._id,
          problemId: mediumProblem._id,
          language: 'CPP',
          sourceCode: 'code3',
          status: 'COMPLETED',
          verdict: 'ACCEPTED'
        }
      ]);

      // Filter by problemId
      const resProb = await request(app)
        .get(`/api/v1/submissions/me?problemId=${easyProblem1._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(resProb.status, 200);
      assert.strictEqual(resProb.body.data.submissions.length, 2);

      // Filter by verdict
      const resVerdict = await request(app)
        .get('/api/v1/submissions/me?verdict=ACCEPTED')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(resVerdict.status, 200);
      assert.strictEqual(resVerdict.body.data.submissions.length, 2);

      // Filter by language
      const resLang = await request(app)
        .get('/api/v1/submissions/me?language=PYTHON')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(resLang.status, 200);
      assert.strictEqual(resLang.body.data.submissions.length, 1);

      // Rejects invalid problemId format with 400 Bad Request
      const resInvalid = await request(app)
        .get('/api/v1/submissions/me?problemId=invalid-id')
        .set('Authorization', `Bearer ${user1Token}`);

      assert.strictEqual(resInvalid.status, 400);
    });
  });
});
