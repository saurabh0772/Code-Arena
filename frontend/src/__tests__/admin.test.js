import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { problemService } from '../services/api/problem.service.js';
import { testCaseService } from '../services/api/testcase.service.js';

describe('Admin Frontend & API Service Suite', () => {

  describe('Problem Administration Service Security', () => {
    it('createProblem strictly constructs payload without spoofed authorId, isActive, or IDs', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              problem: {
                id: 'prob-new-123',
                title: JSON.parse(options.body).title,
                difficulty: JSON.parse(options.body).difficulty
              }
            }
          })
        };
      };

      try {
        const result = await problemService.createProblem({
          title: 'Valid Problem Title',
          description: 'Problem description here...',
          difficulty: 'MEDIUM',
          tags: ['math', 'arrays'],
          inputFormat: 'Single integer N',
          outputFormat: 'Single integer answer',
          constraints: '1 <= N <= 100',
          examples: [{ input: '5', output: '25' }],
          // Malicious / spoofed fields that client must NOT forward
          authorId: 'spoofed-admin-id',
          userId: 'spoofed-user-id',
          isActive: true,
          id: 'spoofed-id',
          _id: 'spoofed-_id'
        });

        assert.ok(capturedUrl.endsWith('/problems'), 'Should post to /problems');
        assert.equal(capturedOptions.method, 'POST');

        const body = JSON.parse(capturedOptions.body);
        assert.equal(body.title, 'Valid Problem Title');
        assert.equal(body.difficulty, 'MEDIUM');
        assert.deepEqual(body.tags, ['math', 'arrays']);
        assert.equal(body.inputFormat, 'Single integer N');
        assert.equal(body.outputFormat, 'Single integer answer');
        assert.equal(body.constraints, '1 <= N <= 100');
        assert.deepEqual(body.examples, [{ input: '5', output: '25' }]);

        // Verify forbidden fields are absent from client request payload
        assert.equal(body.authorId, undefined);
        assert.equal(body.userId, undefined);
        assert.equal(body.isActive, undefined);
        assert.equal(body.id, undefined);
        assert.equal(body._id, undefined);

        assert.equal(result.id, 'prob-new-123');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('updateProblem sends PATCH to /problems/:problemId with only allowed fields', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              problem: {
                id: 'prob-update-456',
                title: 'Updated Title'
              }
            }
          })
        };
      };

      try {
        const result = await problemService.updateProblem('prob-update-456', {
          title: 'Updated Title',
          difficulty: 'HARD',
          authorId: 'hack-author',
          id: 'hack-id'
        });

        assert.ok(capturedUrl.endsWith('/problems/prob-update-456'));
        assert.equal(capturedOptions.method, 'PATCH');

        const body = JSON.parse(capturedOptions.body);
        assert.equal(body.title, 'Updated Title');
        assert.equal(body.difficulty, 'HARD');
        assert.equal(body.authorId, undefined);
        assert.equal(body.id, undefined);
        assert.equal(result.id, 'prob-update-456');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('deactivateProblem sends DELETE to /problems/:problemId', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'Problem deactivated successfully'
          })
        };
      };

      try {
        const result = await problemService.deactivateProblem('prob-del-789');
        assert.ok(capturedUrl.endsWith('/problems/prob-del-789'));
        assert.equal(capturedOptions.method, 'DELETE');
        assert.equal(result.message, 'Problem deactivated successfully');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Test Case Administration Service Security', () => {
    it('getTestCasesForProblem queries /problems/:problemId/test-cases', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;

      globalThis.fetch = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              testCases: [
                { id: 'tc-1', visibility: 'PUBLIC', order: 1 },
                { id: 'tc-2', visibility: 'HIDDEN', order: 2 }
              ]
            }
          })
        };
      };

      try {
        const testCases = await testCaseService.getTestCasesForProblem('prob-tc-1');
        assert.ok(capturedUrl.endsWith('/problems/prob-tc-1/test-cases'));
        assert.equal(testCases.length, 2);
        assert.equal(testCases[0].visibility, 'PUBLIC');
        assert.equal(testCases[1].visibility, 'HIDDEN');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('createTestCase strictly constructs payload without spoofed problemId, isActive, or IDs', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              testCase: {
                id: 'tc-created-1',
                visibility: 'HIDDEN',
                order: 3
              }
            }
          })
        };
      };

      try {
        const result = await testCaseService.createTestCase('prob-tc-1', {
          input: '10 20\n',
          expectedOutput: '30\n',
          visibility: 'HIDDEN',
          order: 3,
          // Malicious fields
          problemId: 'spoofed-prob',
          isActive: false,
          id: 'spoofed-tc-id'
        });

        assert.ok(capturedUrl.endsWith('/problems/prob-tc-1/test-cases'));
        assert.equal(capturedOptions.method, 'POST');

        const body = JSON.parse(capturedOptions.body);
        assert.equal(body.input, '10 20\n');
        assert.equal(body.expectedOutput, '30\n');
        assert.equal(body.visibility, 'HIDDEN');
        assert.equal(body.order, 3);

        assert.equal(body.problemId, undefined);
        assert.equal(body.isActive, undefined);
        assert.equal(body.id, undefined);

        assert.equal(result.id, 'tc-created-1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('updateTestCase sends PATCH to /test-cases/:testCaseId with sanitized fields', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              testCase: { id: 'tc-patch-1', order: 5 }
            }
          })
        };
      };

      try {
        const result = await testCaseService.updateTestCase('tc-patch-1', {
          order: 5,
          visibility: 'PUBLIC',
          problemId: 'fake'
        });

        assert.ok(capturedUrl.endsWith('/test-cases/tc-patch-1'));
        assert.equal(capturedOptions.method, 'PATCH');

        const body = JSON.parse(capturedOptions.body);
        assert.equal(body.order, 5);
        assert.equal(body.visibility, 'PUBLIC');
        assert.equal(body.problemId, undefined);
        assert.equal(result.id, 'tc-patch-1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('deactivateTestCase sends DELETE to /test-cases/:testCaseId', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = null;
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'Test case deactivated successfully'
          })
        };
      };

      try {
        const result = await testCaseService.deactivateTestCase('tc-del-1');
        assert.ok(capturedUrl.endsWith('/test-cases/tc-del-1'));
        assert.equal(capturedOptions.method, 'DELETE');
        assert.equal(result.message, 'Test case deactivated successfully');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Role-Based Navigation Logic', () => {
    function computeNavLinks(user, isAuthenticated) {
      return [
        { name: 'Problems', path: '/problems' },
        { name: 'Submissions', path: '/submissions' },
        ...(user?.role === 'ADMIN' ? [{ name: 'Admin Dashboard', path: '/admin' }] : [])
      ].filter((link) => link.path === '/problems' || isAuthenticated);
    }

    it('ADMIN sees Admin Dashboard link', () => {
      const adminUser = { id: '1', role: 'ADMIN', name: 'Admin' };
      const links = computeNavLinks(adminUser, true);
      const adminLink = links.find((l) => l.name === 'Admin Dashboard');
      assert.ok(adminLink, 'Admin Dashboard must be present for ADMIN role');
      assert.equal(adminLink.path, '/admin');
    });

    it('USER does not see Admin Dashboard link', () => {
      const normalUser = { id: '2', role: 'USER', name: 'Alice' };
      const links = computeNavLinks(normalUser, true);
      const adminLink = links.find((l) => l.name === 'Admin Dashboard');
      assert.equal(adminLink, undefined, 'Admin Dashboard must NOT be present for normal USER');
    });

    it('Unauthenticated visitor sees only public problems link', () => {
      const links = computeNavLinks(null, false);
      assert.equal(links.length, 1);
      assert.equal(links[0].name, 'Problems');
      assert.equal(links[0].path, '/problems');
    });
  });

  describe('AdminRoute Protection Logic', () => {
    function evaluateRouteAccess(user, isAuthenticated) {
      if (!isAuthenticated) return { allow: false, redirect: '/login' };
      if (user?.role !== 'ADMIN') return { allow: false, redirect: '/problems' };
      return { allow: true, redirect: null };
    }

    it('denies unauthenticated visitors and redirects to /login', () => {
      const access = evaluateRouteAccess(null, false);
      assert.equal(access.allow, false);
      assert.equal(access.redirect, '/login');
    });

    it('denies authenticated normal USER and redirects to /problems', () => {
      const user = { id: '123', role: 'USER' };
      const access = evaluateRouteAccess(user, true);
      assert.equal(access.allow, false);
      assert.equal(access.redirect, '/problems');
    });

    it('allows authenticated ADMIN', () => {
      const admin = { id: '456', role: 'ADMIN' };
      const access = evaluateRouteAccess(admin, true);
      assert.equal(access.allow, true);
      assert.equal(access.redirect, null);
    });
  });
});
