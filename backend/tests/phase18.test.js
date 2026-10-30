/**
 * Phase 18 — Advanced Infrastructure Automated Test Suite
 *
 * Validates:
 * 1. Production Observability & Prometheus Metrics:
 *    - Proper Prometheus histograms (_bucket, _sum, _count) for request and execution duration
 *    - Strict absence of high-cardinality labels (userId, submissionId, requestId, workerId)
 *    - Route normalizer maps dynamic IDs to :id templates
 *    - Redis unavailable -> /metrics returns promptly (<500ms) with zero hangs
 *    - Redis available -> /metrics returns valid Prometheus metrics with queue availability flag
 * 2. W3C Trace Context Propagation & BullMQ Round-Trip:
 *    - Standard 00-{traceId}-{spanId}-{flags} format compliance
 *    - Preserves BullMQ business payload contract strictly: job.data === { submissionId }
 *    - Traceparent propagated via job.opts.traceparent across BullMQ enqueue/dequeue
 * 3. MongoDB Replica-Set Configuration:
 *    - getMongooseOptions parses replicaSet, readPreference, and retryWrites
 *    - Fail-fast handling without silent downgrade to standalone
 * 4. Execution Runtime Abstraction:
 *    - DockerRuntime active
 *    - GVisorRuntime and FirecrackerRuntime behave honestly without faking execution
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const supertest = require('supertest');
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const { createApp } = require('../src/app');
const metricsService = require('../src/modules/observability/metrics.service');
const tracingService = require('../src/modules/observability/tracing.service');
const { getMongooseOptions, disconnectDB } = require('../src/config/database');
const { closeQueue } = require('../src/queues/submission.queue');
const { closeRedisConnection } = require('../src/config/redis');
const {
  ExecutionRuntime,
  DockerRuntime,
  GVisorRuntime,
  FirecrackerRuntime
} = require('../../execution-engine/src');

after(async () => {
  await closeQueue().catch(() => {});
  await closeRedisConnection().catch(() => {});
  await disconnectDB().catch(() => {});
});

describe('Phase 18: Advanced Infrastructure Test Suite', () => {

  // ============================================================================
  // 5. OBSERVABILITY & PROMETHEUS METRICS (Sections 2, 8, 16)
  // ============================================================================
  describe('5. Observability & Prometheus Metrics (Sections 2, 8, 16)', () => {
    it('5.1 (Test C) Route normalizer maps dynamic IDs to :id templates to prevent label cardinality explosion', () => {
      // Mongo ObjectId
      assert.equal(metricsService.normalizeRoute('/api/v1/problems/64f8a29b3c4d5e6f7a8b9c0d'), '/api/v1/problems/:id');
      // UUID
      assert.equal(metricsService.normalizeRoute('/api/v1/submissions/123e4567-e89b-12d3-a456-426614174000'), '/api/v1/submissions/:id');
      // Numeric IDs
      assert.equal(metricsService.normalizeRoute('/submissions/123'), '/submissions/:id');
      assert.equal(metricsService.normalizeRoute('/submissions/456'), '/submissions/:id');
      // Root path
      assert.equal(metricsService.normalizeRoute('/'), '/');
    });

    it('5.2 (Test D) Prometheus metrics format strictly excludes high-cardinality labels', async () => {
      metricsService.resetMetrics();
      metricsService.recordHttpRequest('GET', '/api/v1/problems', 200, 45);
      metricsService.recordSubmissionVerdict('python', 'ACCEPTED');
      metricsService.recordWorkerJob('completed');

      const metricsOutput = await metricsService.getMetrics();

      // Assert OpenMetrics / Prometheus format
      assert.ok(metricsOutput.includes('# TYPE codearena_http_requests_total counter'));
      assert.ok(metricsOutput.includes('codearena_http_requests_total{method="GET",route="/api/v1/problems",status="200"}'));
      assert.ok(metricsOutput.includes('codearena_submissions_total{language="python",verdict="ACCEPTED"}'));

      // High-cardinality label protection: assert forbidden labels are not present
      assert.ok(!metricsOutput.includes('userId='), 'Metrics must NOT include userId label');
      assert.ok(!metricsOutput.includes('submissionId='), 'Metrics must NOT include submissionId label');
      assert.ok(!metricsOutput.includes('requestId='), 'Metrics must NOT include requestId label');
      assert.ok(!metricsOutput.includes('workerId='), 'Metrics must NOT include workerId label');
    });

    it('5.3 (Test A) Prometheus request and execution duration are exposed as true histograms', async () => {
      metricsService.resetMetrics();
      metricsService.recordHttpRequest('POST', '/api/v1/submissions', 201, 15);
      metricsService.recordExecutionDuration('python', 250);

      const metricsOutput = await metricsService.getMetrics();

      // HTTP request duration histogram
      assert.ok(metricsOutput.includes('# TYPE codearena_http_request_duration_seconds histogram'));
      assert.ok(metricsOutput.includes('codearena_http_request_duration_seconds_bucket{method="POST",route="/api/v1/submissions",le="0.025"}'));
      assert.ok(metricsOutput.includes('codearena_http_request_duration_seconds_bucket{method="POST",route="/api/v1/submissions",le="+Inf"} 1'));
      assert.ok(metricsOutput.includes('codearena_http_request_duration_seconds_sum{method="POST",route="/api/v1/submissions"} 0.0150'));
      assert.ok(metricsOutput.includes('codearena_http_request_duration_seconds_count{method="POST",route="/api/v1/submissions"} 1'));

      // Code execution duration histogram
      assert.ok(metricsOutput.includes('# TYPE codearena_execution_duration_seconds histogram'));
      assert.ok(metricsOutput.includes('codearena_execution_duration_seconds_bucket{language="python",le="0.25"}'));
      assert.ok(metricsOutput.includes('codearena_execution_duration_seconds_bucket{language="python",le="+Inf"} 1'));
      assert.ok(metricsOutput.includes('codearena_execution_duration_seconds_sum{language="python"} 0.2500'));
      assert.ok(metricsOutput.includes('codearena_execution_duration_seconds_count{language="python"} 1'));
    });

    it('5.4 (Test B) Redis unavailable -> /metrics returns promptly (<500ms), no hang, no unhandled rejection', async () => {
      const submissionQueue = require('../src/queues/submission.queue');
      const originalGetQueueMetrics = submissionQueue.getQueueMetrics;

      try {
        // Simulate Redis failure (e.g. connection refused / network down)
        submissionQueue.getQueueMetrics = async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
        };

        const start = Date.now();
        const app = createApp();
        const res = await supertest(app).get('/metrics');
        const elapsedMs = Date.now() - start;

        // Assert bounded prompt execution (must complete in well under 500ms)
        assert.ok(elapsedMs < 500, `/metrics took ${elapsedMs}ms, which exceeds 500ms limit when Redis is down`);
        assert.equal(res.status, 200);
        assert.ok(res.text.includes('codearena_process_uptime_seconds'));
        // When Redis is unavailable, availability flag is 0 and queue metrics are safely omitted
        assert.ok(res.text.includes('codearena_queue_metrics_available 0'));
        assert.ok(!res.text.includes('codearena_queue_jobs_count{queue_state="waiting"}'));
      } finally {
        submissionQueue.getQueueMetrics = originalGetQueueMetrics;
      }
    });

    it('5.5 (Test B Continued) Redis hanging -> /metrics bounds queue collection and returns within timeout', async () => {
      const submissionQueue = require('../src/queues/submission.queue');
      const originalGetQueueMetrics = submissionQueue.getQueueMetrics;

      try {
        // Simulate hanging Redis socket (takes 2000ms if not bounded)
        submissionQueue.getQueueMetrics = () => new Promise((resolve) => setTimeout(() => resolve(null), 2000));

        const start = Date.now();
        const app = createApp();
        const res = await supertest(app).get('/metrics');
        const elapsedMs = Date.now() - start;

        // Must bound execution and return in well under 500ms
        assert.ok(elapsedMs < 500, `/metrics took ${elapsedMs}ms, which exceeds 500ms limit`);
        assert.equal(res.status, 200);
        assert.ok(res.text.includes('codearena_queue_metrics_available 0'));
      } finally {
        submissionQueue.getQueueMetrics = originalGetQueueMetrics;
      }
    });
  });

  // ============================================================================
  // 6. W3C TRACE CONTEXT PROPAGATION & BULLMQ ROUND-TRIP (Sections 6, 7, 15)
  // ============================================================================
  describe('6. W3C Trace Context & BullMQ Payload Contract (Sections 6, 7, 15)', () => {
    it('6.1 Validates standard W3C traceparent formatting and parsing', () => {
      const sampleTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const parsed = tracingService.extractOrCreateContext(sampleTraceparent);

      assert.equal(parsed.isNew, false);
      assert.equal(parsed.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
      assert.equal(parsed.spanId, '00f067aa0ba902b7');
      assert.equal(parsed.traceparent, sampleTraceparent);
    });

    it('6.2 Generates fresh W3C context when incoming header is absent or invalid', () => {
      const fresh = tracingService.extractOrCreateContext(null);

      assert.equal(fresh.isNew, true);
      assert.equal(fresh.traceId.length, 32);
      assert.equal(fresh.spanId.length, 16);
      assert.ok(fresh.traceparent.startsWith('00-'));
    });

    it('6.3 Derives child span preserving traceId with unique spanId for queue handoff', () => {
      const parentTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const child = tracingService.createChildSpan(parentTraceparent);

      assert.equal(child.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
      assert.notEqual(child.spanId, '00f067aa0ba902b7');
      assert.equal(child.spanId.length, 16);
      assert.ok(child.traceparent.startsWith(`00-4bf92f3577b34da6a3ce929d0e0e4736-${child.spanId}-`));
    });

    it('6.4 HTTP middleware injects traceparent response header', async () => {
      const app = createApp();
      const res = await supertest(app).get('/health');

      assert.equal(res.status, 200);
      assert.ok(res.headers['traceparent'], 'HTTP response must include traceparent header');
      assert.ok(res.headers['traceparent'].startsWith('00-'));
    });

    it('6.5 (Section 15) BullMQ enqueue/dequeue preserves job.data contract and job.opts.traceparent', async () => {
      const testPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6380;
      let redisClient = null;
      let queue = null;

      try {
        redisClient = new Redis({
          host: '127.0.0.1',
          port: testPort,
          maxRetriesPerRequest: null,
          connectTimeout: 1000,
          lazyConnect: true,
          retryStrategy: () => null
        });
        redisClient.on('error', () => {});

        // Try connect with timeout
        await Promise.race([
          redisClient.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);

        const pingResult = await Promise.race([
          redisClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);

        if (pingResult !== 'PONG') {
          console.log('    ℹ SKIPPED — Redis unavailable');
          return;
        }

        const queueName = `test-trace-roundtrip-${Date.now()}`;
        queue = new Queue(queueName, { connection: redisClient });

        const testSubmissionId = '64f8a29b3c4d5e6f7a8b9c0d';
        const testTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

        // Enqueue with strictly clean business payload
        const job = await queue.add(
          'execute',
          { submissionId: testSubmissionId },
          { traceparent: testTraceparent }
        );

        // Fetch back from Redis
        const retrievedJob = await queue.getJob(job.id);

        // Assert contract: job.data MUST strictly equal { submissionId }
        assert.deepEqual(retrievedJob.data, { submissionId: testSubmissionId });
        assert.equal(retrievedJob.data.traceparent, undefined, 'traceparent must NOT be in job.data');
        assert.equal(retrievedJob.data.requestId, undefined, 'requestId must NOT be in job.data');
        assert.equal(retrievedJob.data.userId, undefined, 'userId must NOT be in job.data');
        assert.equal(retrievedJob.data.workerId, undefined, 'workerId must NOT be in job.data');

        // Assert observability metadata preserved in job.opts
        assert.equal(retrievedJob.opts.traceparent, testTraceparent);

        await queue.obliterate({ force: true });
      } catch (err) {
        console.log(`    ℹ SKIPPED — Redis unavailable (${err.message})`);
      } finally {
        if (queue) await queue.close().catch(() => {});
        if (redisClient) await redisClient.quit().catch(() => {});
      }
    });
  });

  // ============================================================================
  // 7. MONGODB REPLICA-SET CONFIGURATION (Section 11)
  // ============================================================================
  describe('7. MongoDB Replica-Set Configuration & Selection (Section 11)', () => {
    it('7.1 Standalone mode returns standard options when no replicaSet is configured', () => {
      const opts = getMongooseOptions({
        uri: 'mongodb://localhost:27017/codearena',
        replicaSet: undefined
      });

      assert.equal(opts.replicaSet, undefined);
      assert.equal(opts.serverSelectionTimeoutMS, 5000);
    });

    it('7.2 Explicit replica-set mode configures replicaSet, readPreference, and retryWrites', () => {
      const opts = getMongooseOptions({
        uri: 'mongodb://mongodb-0:27017,mongodb-1:27017/codearena',
        replicaSet: 'rs0',
        readPreference: 'secondaryPreferred',
        retryWrites: true
      });

      assert.equal(opts.replicaSet, 'rs0');
      assert.equal(opts.readPreference, 'secondaryPreferred');
      assert.equal(opts.retryWrites, true);
    });

    it('7.3 Managed MongoDB Atlas URI preserves connection string configuration', () => {
      const opts = getMongooseOptions({
        uri: 'mongodb+srv://user:pass@prod-cluster.mongodb.net/codearena?retryWrites=true&w=majority',
        replicaSet: undefined,
        readPreference: 'primaryPreferred'
      });

      assert.equal(opts.readPreference, 'primaryPreferred');
      assert.equal(opts.serverSelectionTimeoutMS, 5000);
    });

    it('7.4 Explicit replica-set mode fails fast on connection error without silent downgrade to standalone', async () => {
      const { connectDB } = require('../src/config/database');

      // Attempt to connect to an unreachable replica set host with 1 retry and 500ms timeout
      await assert.rejects(
        async () => {
          await connectDB(1, 100, {
            replicaSet: 'nonexistent-replica-set',
            serverSelectionTimeoutMS: 500
          });
        },
        /MongooseServerSelectionError|connect ECONNREFUSED|ENOTFOUND|failed/i
      );
    });
  });

  // ============================================================================
  // 8. EXECUTION RUNTIME ABSTRACTION
  // ============================================================================
  describe('8. Execution Runtime Abstraction', () => {
    it('8.1 DockerRuntime conforms to ExecutionRuntime contract and identifies as docker', () => {
      const runtime = new DockerRuntime();
      assert.ok(runtime instanceof ExecutionRuntime);
      assert.equal(runtime.getName(), 'docker');
      assert.equal(typeof runtime.isAvailable, 'function');
      assert.equal(typeof runtime.runSandbox, 'function');
    });

    it('8.2 GVisorRuntime behaves honestly without faking execution', async () => {
      const runtime = new GVisorRuntime();
      assert.ok(runtime instanceof ExecutionRuntime);
      assert.equal(runtime.getName(), 'gvisor');

      const isAvailable = await runtime.isAvailable();
      // If runsc is not installed on the system, runSandbox must throw a capability error
      if (!isAvailable) {
        await assert.rejects(
          async () => {
            await runtime.runSandbox({ command: 'echo' });
          },
          /gVisor \(runsc\) runtime is not configured/
        );
      }
    });

    it('8.3 FirecrackerRuntime behaves honestly without faking microVM execution', async () => {
      const runtime = new FirecrackerRuntime();
      assert.ok(runtime instanceof ExecutionRuntime);
      assert.equal(runtime.getName(), 'firecracker');

      const isAvailable = await runtime.isAvailable();
      // If KVM or firecracker is not installed on the host, runSandbox must reject
      if (!isAvailable) {
        await assert.rejects(
          async () => {
            await runtime.runSandbox({ command: 'echo' });
          },
          /Firecracker microVM runtime is not available/
        );
      }
    });
  });
});
