import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getVerdictConfig, formatRuntime, formatDate } from '../utils/formatters.js';
import { DEFAULT_CPP_TEMPLATE } from '../utils/constants.js';
import { submissionService } from '../services/api/submission.service.js';

describe('Phase 9 — Frontend Unit & Integration Tests', () => {

  describe('Verdict and Formatting Helpers', () => {
    it('returns appropriate styling for ACCEPTED verdict', () => {
      const config = getVerdictConfig('ACCEPTED');
      assert.equal(config.label, 'Accepted');
      assert.match(config.color, /text-emerald/);
      assert.match(config.bg, /bg-emerald/);
    });

    it('returns appropriate styling for WRONG_ANSWER verdict', () => {
      const config = getVerdictConfig('WRONG_ANSWER');
      assert.equal(config.label, 'Wrong Answer');
      assert.match(config.color, /text-amber/);
    });

    it('returns appropriate styling for COMPILATION_ERROR verdict', () => {
      const config = getVerdictConfig('COMPILATION_ERROR');
      assert.equal(config.label, 'Compilation Error');
      assert.match(config.color, /text-rose/);
    });

    it('returns appropriate styling for RUNTIME_ERROR verdict', () => {
      const config = getVerdictConfig('RUNTIME_ERROR');
      assert.equal(config.label, 'Runtime Error');
      assert.match(config.color, /text-red/);
    });

    it('formats runtime correctly', () => {
      assert.equal(formatRuntime(15), '15 ms');
      assert.equal(formatRuntime(null), '—');
      assert.equal(formatRuntime(undefined), '—');
    });

    it('formats dates gracefully', () => {
      assert.equal(formatDate(null), '—');
      const formatted = formatDate('2026-09-16T12:00:00Z');
      assert.equal(typeof formatted, 'string');
      assert.notEqual(formatted, '—');
    });
  });

  describe('C++ Default Starter Template', () => {
    it('provides valid C++ structure with iostream and main', () => {
      assert.match(DEFAULT_CPP_TEMPLATE, /#include <iostream>/);
      assert.match(DEFAULT_CPP_TEMPLATE, /int main\(\)/);
      assert.match(DEFAULT_CPP_TEMPLATE, /return 0;/);
    });
  });

  describe('Submission Service Payload Security', () => {
    it('strictly constructs payload with only problemId, language, and sourceCode', async () => {
      // Mock fetch to inspect the outgoing request body
      const originalFetch = globalThis.fetch;
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              submission: {
                id: 'mock-sub-123',
                problemId: capturedBody.problemId,
                language: capturedBody.language,
                sourceCode: capturedBody.sourceCode,
                status: 'QUEUED',
                verdict: 'PENDING'
              }
            }
          })
        };
      };

      try {
        await submissionService.createSubmission({
          problemId: '507f1f77bcf86cd799439011',
          language: 'CPP',
          sourceCode: '#include <iostream>\nint main(){ return 0; }',
          // Client attempting to send server-controlled fields
          userId: 'spoofed-user',
          status: 'COMPLETED',
          verdict: 'ACCEPTED',
          runtimeMs: 10,
          testsPassed: 100,
          totalTests: 100
        });

        assert.ok(capturedBody);
        assert.equal(capturedBody.problemId, '507f1f77bcf86cd799439011');
        assert.equal(capturedBody.language, 'CPP');
        assert.equal(capturedBody.sourceCode, '#include <iostream>\nint main(){ return 0; }');

        // Verify client-side code never transmits server-controlled fields
        assert.equal(capturedBody.userId, undefined);
        assert.equal(capturedBody.status, undefined);
        assert.equal(capturedBody.verdict, undefined);
        assert.equal(capturedBody.runtimeMs, undefined);
        assert.equal(capturedBody.testsPassed, undefined);
        assert.equal(capturedBody.totalTests, undefined);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
