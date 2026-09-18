const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Enable rate limit in test environment for this test suite
process.env.NODE_ENV = 'test';
process.env.ENABLE_RATE_LIMIT_IN_TEST = 'true';
process.env.JWT_SECRET = 'test-secret-key-rate-limiting-suite';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const Problem = require('../src/modules/problems/problem.model');
const { hashPassword } = require('../src/utils/password');

describe('CodeArena Rate Limiting Suite', () => {
  let user;
  let token;
  let problem;

  before(async () => {
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();
    await User.deleteMany({});
    await Problem.deleteMany({});

    const passwordHash = await hashPassword('Password123!');
    user = await User.create({
      name: 'Rate Limit Test User',
      email: 'ratelimit@example.com',
      passwordHash,
      role: 'USER',
      isActive: true
    });

    token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    problem = await Problem.create({
      title: 'Rate Limit Problem',
      description: 'Problem description for rate limit testing',
      difficulty: 'EASY',
      tags: ['math'],
      inputFormat: 'Two integers',
      outputFormat: 'One integer',
      constraints: '1 <= N <= 1000',
      examples: [{ input: '1 2', output: '3' }],
      authorId: user._id,
      isActive: true
    });
  });

  after(async () => {
    // Reset test env flag
    delete process.env.ENABLE_RATE_LIMIT_IN_TEST;
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Problem.deleteMany({});
      await disconnectDB();
    }
    const { closeQueue } = require('../src/queues/submission.queue');
    await closeQueue();
  });

  it('enforces registration rate limit: rejects requests exceeding threshold with 429', async () => {
    let lastRes;
    // Register threshold is 5 requests per 15 minutes
    for (let i = 0; i < 7; i++) {
      lastRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: `User ${i}`,
          email: `unique_${i}@example.com`,
          password: 'Password123!'
        });

      if (lastRes.status === 429) break;
    }

    assert.equal(lastRes.status, 429);
    assert.equal(lastRes.body.success, false);
    assert.equal(lastRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('enforces login rate limit: rejects requests exceeding threshold with 429', async () => {
    let lastRes;
    // Login threshold is 10 requests per 15 minutes
    for (let i = 0; i < 12; i++) {
      lastRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'ratelimit@example.com',
          password: 'WrongPassword!'
        });

      if (lastRes.status === 429) break;
    }

    assert.equal(lastRes.status, 429);
    assert.equal(lastRes.body.success, false);
    assert.equal(lastRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('enforces submission rate limit: rejects excessive submissions with 429', async () => {
    let lastRes;
    // Submission threshold is 10 requests per minute
    for (let i = 0; i < 12; i++) {
      lastRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          problemId: problem._id.toString(),
          language: 'CPP',
          sourceCode: '#include <iostream>\nint main(){return 0;}'
        });

      if (lastRes.status === 429) break;
    }

    assert.equal(lastRes.status, 429);
    assert.equal(lastRes.body.success, false);
    assert.equal(lastRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });
});
