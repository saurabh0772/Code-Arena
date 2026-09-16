const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Ensure environment is test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-codearena-phase3';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena_test';

const app = require('../src/app');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/modules/users/user.model');
const authenticate = require('../src/middleware/authenticate');
const authorize = require('../src/middleware/authorize');
const { hashPassword } = require('../src/utils/password');

const express = require('express');
const errorHandler = require('../src/middleware/error-handler');

// Isolated test app for testing RBAC authorize middleware
const testRbacApp = express();
testRbacApp.use(express.json());
testRbacApp.get('/api/v1/test-rbac/admin-only', authenticate, authorize('ADMIN'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome Admin', role: req.user.role });
});

testRbacApp.get('/api/v1/test-rbac/user-only', authenticate, authorize('USER'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome User', role: req.user.role });
});
testRbacApp.use(errorHandler);

describe('Phase 3 Authentication, JWT & RBAC Test Suite', () => {
  before(async () => {
    // Override URI to dedicated test database
    config.mongodb.uri = process.env.MONGODB_URI;
    await connectDB();
  });

  after(async () => {
    // Clean up and disconnect
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await disconnectDB();
    }
  });

  beforeEach(async () => {
    // Clear users before each test
    await User.deleteMany({});
  });

  // ==========================================
  // REGRESSION VERIFICATION: Health Check
  // ==========================================
  describe('Health Check Regression', () => {
    it('GET /health returns 200 and database connected status', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.service, 'codearena-backend');
      assert.equal(res.body.database, 'connected');
    });
  });

  // ==========================================
  // REGISTRATION TESTS
  // ==========================================
  describe('POST /api/v1/auth/register', () => {
    it('Valid registration succeeds and returns safe user data', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Saurabh Kumar',
          email: 'saurabh@example.com',
          password: 'Password123!'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.user);
      assert.ok(res.body.data.user.id);
      assert.equal(res.body.data.user.name, 'Saurabh Kumar');
      assert.equal(res.body.data.user.email, 'saurabh@example.com');
      assert.equal(res.body.data.user.role, 'USER');

      // Ensure password and passwordHash are NEVER returned
      assert.equal(res.body.data.user.password, undefined);
      assert.equal(res.body.data.user.passwordHash, undefined);
      assert.equal(res.body.data.password, undefined);
      assert.equal(res.body.data.passwordHash, undefined);
    });

    it('Password is saved hashed and never stored as plaintext in MongoDB', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Hash Tester',
          email: 'hash@example.com',
          password: 'SecretPlaintextPassword123'
        });

      const userInDb = await User.findOne({ email: 'hash@example.com' });
      assert.ok(userInDb);
      assert.notEqual(userInDb.passwordHash, 'SecretPlaintextPassword123');
      // Argon2 hashes start with $argon2
      assert.ok(userInDb.passwordHash.startsWith('$argon2'));
      assert.equal(userInDb.password, undefined);
    });

    it('Duplicate email registration is rejected with 409 Conflict', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Existing User',
          email: 'duplicate@example.com',
          password: 'Password123!'
        });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another User',
          email: 'duplicate@example.com',
          password: 'DifferentPassword123!'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /User already exists/i);
    });

    it('Duplicate email normalized case-insensitively is rejected', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Case User',
          email: 'mixedcase@example.com',
          password: 'Password123!'
        });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Case User 2',
          email: 'MixedCase@example.COM',
          password: 'Password123!'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /User already exists/i);
    });

    it('Invalid email format is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Invalid Email',
          email: 'not-an-email',
          password: 'Password123!'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('Missing required fields are rejected with 400', async () => {
      // Missing name
      const res1 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'missing@example.com',
          password: 'Password123!'
        });
      assert.equal(res1.status, 400);

      // Missing email
      const res2 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Missing Email',
          password: 'Password123!'
        });
      assert.equal(res2.status, 400);

      // Missing password
      const res3 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Missing Password',
          email: 'missingpw@example.com'
        });
      assert.equal(res3.status, 400);
    });

    it('Weak / short password (< 8 chars) is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Short Password',
          email: 'short@example.com',
          password: '123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /at least 8 characters/i);
    });

    it('Client cannot register as ADMIN; server ignores/resets role to USER', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Hacker',
          email: 'hacker@example.com',
          password: 'Password123!',
          role: 'ADMIN',
          isActive: false
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.user.role, 'USER');

      const userInDb = await User.findOne({ email: 'hacker@example.com' });
      assert.equal(userInDb.role, 'USER');
      assert.equal(userInDb.isActive, true);
    });
  });

  // ==========================================
  // LOGIN TESTS
  // ==========================================
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Register a standard user
      const passwordHash = await hashPassword('ValidPassword123!');
      await User.create({
        name: 'Login User',
        email: 'login@example.com',
        passwordHash,
        role: 'USER',
        isActive: true
      });
    });

    it('Valid credentials succeed and return JWT and safe user data', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'ValidPassword123!'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.ok(res.body.data.user);
      assert.equal(res.body.data.user.email, 'login@example.com');
      assert.equal(res.body.data.user.role, 'USER');

      // Ensure password / hash never exposed
      assert.equal(res.body.data.user.password, undefined);
      assert.equal(res.body.data.user.passwordHash, undefined);

      // Verify JWT structure and payload claims
      const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
      assert.equal(decoded.sub, res.body.data.user.id);
      assert.equal(decoded.role, 'USER');
    });

    it('Invalid password fails with 401 and generic error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid email or password');
    });

    it('Invalid email fails with 401 and generic error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'ValidPassword123!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid email or password');
    });

    it('Inactive user cannot log in', async () => {
      const inactiveHash = await hashPassword('InactivePass123!');
      await User.create({
        name: 'Inactive User',
        email: 'inactive@example.com',
        passwordHash: inactiveHash,
        role: 'USER',
        isActive: false
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'InactivePass123!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  // ==========================================
  // AUTHENTICATION MIDDLEWARE TESTS
  // ==========================================
  describe('Authentication Middleware', () => {
    let activeUser;
    let validToken;

    beforeEach(async () => {
      const passwordHash = await hashPassword('Password123!');
      activeUser = await User.create({
        name: 'Auth Middleware User',
        email: 'middleware@example.com',
        passwordHash,
        role: 'USER',
        isActive: true
      });

      validToken = jwt.sign(
        { sub: activeUser._id.toString(), role: activeUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('Missing Authorization header fails with 401', async () => {
      const res = await request(app).get('/api/v1/users/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Malformed Authorization header fails with 401', async () => {
      const res1 = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Basic 123456');
      assert.equal(res1.status, 401);

      const res2 = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer');
      assert.equal(res2.status, 401);
    });

    it('Invalid / forged JWT fails with 401', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.token.value');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Expired JWT fails with 401', async () => {
      const expiredToken = jwt.sign(
        { sub: activeUser._id.toString(), role: activeUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Valid JWT succeeds and loads current user', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.email, 'middleware@example.com');
      assert.equal(res.body.data.id, activeUser._id.toString());
    });

    it('Nonexistent user token fails with 401', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const fakeToken = jwt.sign(
        { sub: nonExistentId.toString(), role: 'USER' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('Inactive user token fails with 401', async () => {
      activeUser.isActive = false;
      await activeUser.save();

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /inactive/i);
    });
  });

  // ==========================================
  // ROLE-BASED ACCESS CONTROL (RBAC) TESTS
  // ==========================================
  describe('RBAC Authorization Middleware', () => {
    let userToken;
    let adminToken;

    beforeEach(async () => {
      const hash = await hashPassword('Password123!');

      const user = await User.create({
        name: 'Regular User',
        email: 'user@example.com',
        passwordHash: hash,
        role: 'USER',
        isActive: true
      });

      const admin = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: hash,
        role: 'ADMIN',
        isActive: true
      });

      userToken = jwt.sign(
        { sub: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      adminToken = jwt.sign(
        { sub: admin._id.toString(), role: admin.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('USER cannot access ADMIN-only protected route (403 Forbidden)', async () => {
      const res = await request(testRbacApp)
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /insufficient permissions/i);
    });

    it('ADMIN can access ADMIN-only protected route (200 OK)', async () => {
      const res = await request(testRbacApp)
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.role, 'ADMIN');
    });

    it('Client cannot manipulate its role through request headers or body', async () => {
      const res = await request(testRbacApp)
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${userToken}`)
        .set('role', 'ADMIN')
        .set('x-role', 'ADMIN')
        .send({ role: 'ADMIN' });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('USER can access USER-allowed route (200 OK)', async () => {
      const res = await request(testRbacApp)
        .get('/api/v1/test-rbac/user-only')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.role, 'USER');
    });
  });

  // ==========================================
  // GET /api/v1/users/me TESTS
  // ==========================================
  describe('GET /api/v1/users/me', () => {
    it('Requires authentication (401 without token)', async () => {
      const res = await request(app).get('/api/v1/users/me');
      assert.equal(res.status, 401);
    });

    it('Derives identity from token and returns safe user data without password/hash', async () => {
      const hash = await hashPassword('SecretMe123!');
      const user = await User.create({
        name: 'Profile User',
        email: 'profile@example.com',
        passwordHash: hash,
        role: 'USER',
        isActive: true
      });

      const token = jwt.sign(
        { sub: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, user._id.toString());
      assert.equal(res.body.data.name, 'Profile User');
      assert.equal(res.body.data.email, 'profile@example.com');
      assert.equal(res.body.data.role, 'USER');
      assert.equal(res.body.data.isActive, true);

      // Sensitive fields must NEVER be present
      assert.equal(res.body.data.password, undefined);
      assert.equal(res.body.data.passwordHash, undefined);
      if (res.body.data.user) {
        assert.equal(res.body.data.user.password, undefined);
        assert.equal(res.body.data.user.passwordHash, undefined);
      }
    });
  });
});
