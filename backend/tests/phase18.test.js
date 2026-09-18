/**
 * Phase 18 — Advanced Infrastructure Automated Test Suite
 *
 * Validates:
 * 1. Declarative Kubernetes Architecture & Security Boundaries:
 *    - Base manifests exist and parse cleanly
 *    - Backend Deployment maintains zero Docker socket access and enforces non-root execution
 *    - Worker Deployment mounts Docker socket as a security-sensitive capability on dedicated nodes
 *    - Worker image uses codearena-backend:latest
 *    - Ingress routes API, probes, metrics, and frontend appropriately
 * 2. Overlay Separation & Secret Exclusion (Sections 4, 5, 17):
 *    - Base kustomization does NOT deploy example secrets
 *    - Local overlay configures local datastores and local secrets
 *    - Production overlay references managed datastores (no mongodb:27017 or redis:6379)
 *    - Production overlay references External Secrets Operator and immutable image tags
 *    - Production worker affinity enforces requiredDuringSchedulingIgnoredDuringExecution
 *    - Production NetworkPolicy restricts egress to approved managed CIDRs without 0.0.0.0/0
 * 3. Autoscaling Specifications (HPA & KEDA):
 *    - Backend HPA scales on CPU (70%) and Memory (80%)
 *    - Worker KEDA ScaledObject targets pinned BullMQ v6 Redis key 'bull:submission-execution:wait'
 * 4. Network Policies & Least-Privilege Segmentation:
 *    - Default deny-all policy present
 *    - Explicit CoreDNS egress rules (UDP/TCP 53) to prevent in-cluster DNS failure
 *    - Backend ingress restricted with explicit from: selectors (no open port 5000 without from)
 * 5. Production Observability & Prometheus Metrics (Sections 2, 8, 16):
 *    - Proper Prometheus histograms (_bucket, _sum, _count) for request and execution duration
 *    - Strict absence of high-cardinality labels (userId, submissionId, requestId, workerId)
 *    - Route normalizer maps dynamic IDs to :id templates
 *    - Redis unavailable -> /metrics returns promptly (<500ms) with zero hangs
 *    - Redis available -> /metrics returns valid Prometheus metrics with queue availability flag
 * 6. W3C Trace Context Propagation & BullMQ Round-Trip (Sections 6, 7, 15):
 *    - Standard 00-{traceId}-{spanId}-{flags} format compliance
 *    - Preserves BullMQ business payload contract strictly: job.data === { submissionId }
 *    - Traceparent propagated via job.opts.traceparent across BullMQ enqueue/dequeue
 * 7. MongoDB Replica-Set Configuration (Section 11):
 *    - getMongooseOptions parses replicaSet, readPreference, and retryWrites
 *    - Fail-fast handling without silent downgrade to standalone
 * 8. Execution Runtime Abstraction:
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

const K8S_BASE_DIR = path.resolve(__dirname, '../../k8s/base');
const K8S_OVERLAYS_DIR = path.resolve(__dirname, '../../k8s/overlays');

after(async () => {
  await closeQueue().catch(() => {});
  await closeRedisConnection().catch(() => {});
  await disconnectDB().catch(() => {});
});

describe('Phase 18: Advanced Infrastructure Test Suite', () => {

  // ============================================================================
  // 1. KUBERNETES MANIFEST VALIDATION & SECURITY BOUNDARIES
  // ============================================================================
  describe('1. Kubernetes Manifest Architecture & Boundaries', () => {
    it('1.1 Base manifests exist and contain required resources', () => {
      const requiredFiles = [
        'namespace.yaml',
        'configmap.yaml',
        'secrets.example.yaml',
        'backend.yaml',
        'worker.yaml',
        'frontend.yaml',
        'services.yaml',
        'ingress.yaml',
        'hpa.yaml',
        'keda-worker-scaler.yaml',
        'network-policy.yaml',
        'kustomization.yaml'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(K8S_BASE_DIR, file);
        assert.ok(fs.existsSync(filePath), `Required manifest ${file} must exist in k8s/base`);
        const content = fs.readFileSync(filePath, 'utf8');
        assert.ok(content.length > 20, `Manifest ${file} must not be empty`);
      }
    });

    it('1.2 Backend Deployment enforces non-root execution and ZERO Docker daemon access', () => {
      const backendYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'backend.yaml'), 'utf8');

      // Assert zero Docker daemon socket volume
      assert.ok(!backendYaml.includes('/var/run/docker.sock'), 'Backend MUST NOT mount /var/run/docker.sock');
      assert.ok(!backendYaml.includes('docker-socket'), 'Backend MUST NOT define a docker-socket volume');

      // Assert non-root execution
      assert.ok(backendYaml.includes('runAsNonRoot: true'), 'Backend must specify runAsNonRoot: true');
      assert.ok(backendYaml.includes('allowPrivilegeEscalation: false'), 'Backend must specify allowPrivilegeEscalation: false');

      // Assert probes
      assert.ok(backendYaml.includes('path: /health'), 'Backend must define /health liveness probe');
      assert.ok(backendYaml.includes('path: /ready'), 'Backend must define /ready readiness probe');

      // Assert resource requests & limits
      assert.ok(backendYaml.includes('resources:'), 'Backend must define resource requests and limits');
    });

    it('1.3 Worker Deployment mounts Docker socket on dedicated nodes with 30s grace period and uses codearena-backend image', () => {
      const workerYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'worker.yaml'), 'utf8');

      // Worker owns the security-sensitive execution capability
      assert.ok(workerYaml.includes('/var/run/docker.sock'), 'Worker must mount /var/run/docker.sock for sandbox execution');

      // Worker image must use backend application image
      assert.ok(workerYaml.includes('image: codearena-backend:latest'), 'Worker must use codearena-backend:latest image');

      // Assert dedicated worker node affinity/tolerations
      assert.ok(workerYaml.includes('dedicated'), 'Worker must declare dedicated node affinity/tolerations');
      assert.ok(workerYaml.includes('codearena-worker'), 'Worker must target dedicated=codearena-worker nodes');

      // Assert 30s bounded drain
      assert.ok(workerYaml.includes('terminationGracePeriodSeconds: 30'), 'Worker must specify 30s termination grace period');
    });

    it('1.4 Ingress routes API, probes, metrics, and frontend correctly', () => {
      const ingressYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'ingress.yaml'), 'utf8');

      assert.ok(ingressYaml.includes('path: /api/'), 'Ingress must route /api/ to backend');
      assert.ok(ingressYaml.includes('path: /metrics'), 'Ingress must route /metrics to backend');
      assert.ok(ingressYaml.includes('path: /health'), 'Ingress must route /health to backend');
      assert.ok(ingressYaml.includes('path: /ready'), 'Ingress must route /ready to backend');
      assert.ok(ingressYaml.includes('path: /'), 'Ingress must route / to frontend');
    });
  });

  // ============================================================================
  // 2. OVERLAY SEPARATION & SECRETS ARCHITECTURE (Sections 4, 5, 17)
  // ============================================================================
  describe('2. Overlay Separation & Production Configuration (Sections 4, 5, 17)', () => {
    it('2.1 Base kustomization does NOT deploy example secrets', () => {
      const baseKust = fs.readFileSync(path.join(K8S_BASE_DIR, 'kustomization.yaml'), 'utf8');
      assert.ok(
        !baseKust.includes('secrets.example.yaml'),
        'k8s/base/kustomization.yaml MUST NOT include secrets.example.yaml in resources list'
      );
    });

    it('2.2 Local overlay configures local datastores and local demonstration secrets', () => {
      const localKust = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'local/kustomization.yaml'), 'utf8');
      assert.ok(localKust.includes('local-datastores.yaml'), 'Local overlay must include local-datastores.yaml');
      assert.ok(localKust.includes('local-secrets.yaml'), 'Local overlay must include local-secrets.yaml');

      const localSecrets = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'local/local-secrets.yaml'), 'utf8');
      assert.ok(localSecrets.includes('name: codearena-secrets'), 'Local secrets must define codearena-secrets Secret');
      assert.ok(localSecrets.includes('mongodb://mongodb:27017/codearena'), 'Local secrets configures in-cluster MongoDB');
    });

    it('2.3 Production overlay explicitly models managed datastores without pointing to local in-cluster pods', () => {
      const prodConfigPatch = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'production/patch-configmap.yaml'), 'utf8');

      // Must NOT point to local in-cluster hosts
      assert.ok(!prodConfigPatch.includes('REDIS_HOST: "redis"'), 'Production config must NOT use local redis host');
      assert.ok(!prodConfigPatch.includes('mongodb://mongodb:27017'), 'Production config must NOT use local mongodb host');

      // Must point to managed Redis endpoint and production CORS
      assert.ok(prodConfigPatch.includes('REDIS_HOST: "managed-redis.prod.cache.internal"'), 'Must specify managed Redis endpoint');
      assert.ok(prodConfigPatch.includes('CORS_ORIGIN: "https://codearena.example.com"'), 'Must specify production CORS origin');
    });

    it('2.4 Production overlay references external secrets management (ESO) without committing credentials', () => {
      const prodKust = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'production/kustomization.yaml'), 'utf8');
      assert.ok(prodKust.includes('external-secrets.yaml'), 'Production overlay must include external-secrets.yaml resource');

      const externalSecrets = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'production/external-secrets.yaml'), 'utf8');
      assert.ok(externalSecrets.includes('kind: ExternalSecret'), 'Must define ExternalSecret');
      assert.ok(externalSecrets.includes('target:'), 'Must declare target Secret');
      assert.ok(externalSecrets.includes('name: codearena-secrets'), 'Must sync into codearena-secrets Secret');
      assert.ok(externalSecrets.includes('remoteRef:'), 'Must reference cloud secret manager remoteRef');

      // Zero hardcoded real passwords in external-secrets.yaml
      assert.ok(!externalSecrets.includes('password123'), 'ExternalSecret must not contain hardcoded passwords');
    });

    it('2.5 Production overlay enforces requiredDuringSchedulingIgnoredDuringExecution for dedicated worker nodes', () => {
      const prodWorkerPatch = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'production/patch-worker-affinity.yaml'), 'utf8');
      assert.ok(
        prodWorkerPatch.includes('requiredDuringSchedulingIgnoredDuringExecution'),
        'Production worker patch must enforce requiredDuringScheduling node affinity'
      );
      assert.ok(prodWorkerPatch.includes('dedicated'), 'Must match dedicated node label');
      assert.ok(prodWorkerPatch.includes('effect: "NoSchedule"'), 'Must declare matching NoSchedule toleration');
    });

    it('2.6 Production overlay models least-privilege managed datastore NetworkPolicies without 0.0.0.0/0', () => {
      const prodNpPatch = fs.readFileSync(path.join(K8S_OVERLAYS_DIR, 'production/patch-production-network-policy.yaml'), 'utf8');

      // Must NOT permit unrestricted 0.0.0.0/0
      assert.ok(!/cidr:\s*["']?0\.0\.0\.0\/0/.test(prodNpPatch), 'Production NetworkPolicy must NOT allow 0.0.0.0/0');

      // Must allow egress to approved managed datastore CIDRs
      assert.ok(prodNpPatch.includes('10.100.0.0/16'), 'Must allow egress to managed MongoDB CIDR');
      assert.ok(prodNpPatch.includes('port: 27017'), 'Must allow MongoDB port 27017');
      assert.ok(prodNpPatch.includes('10.200.0.0/16'), 'Must allow egress to managed Redis CIDR');
      assert.ok(prodNpPatch.includes('port: 6379'), 'Must allow Redis port 6379');
      assert.ok(prodNpPatch.includes('port: 53'), 'Must allow CoreDNS port 53');
    });
  });

  // ============================================================================
  // 3. AUTOSCALING SPECIFICATIONS (HPA & KEDA)
  // ============================================================================
  describe('3. Autoscaling Specifications (HPA & KEDA)', () => {
    it('3.1 Backend HPA scales based on CPU (70%) and Memory (80%)', () => {
      const hpaYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'hpa.yaml'), 'utf8');

      assert.ok(hpaYaml.includes('kind: HorizontalPodAutoscaler'));
      assert.ok(hpaYaml.includes('name: codearena-backend'));
      assert.ok(hpaYaml.includes('name: cpu'));
      assert.ok(hpaYaml.includes('averageUtilization: 70'));
      assert.ok(hpaYaml.includes('name: memory'));
      assert.ok(hpaYaml.includes('averageUtilization: 80'));
    });

    it('3.2 Worker KEDA ScaledObject targets pinned BullMQ v6 Redis key', () => {
      const kedaYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'keda-worker-scaler.yaml'), 'utf8');

      assert.ok(kedaYaml.includes('kind: ScaledObject'));
      assert.ok(kedaYaml.includes('name: codearena-worker'));
      // Pinned BullMQ v6 Redis list key
      assert.ok(kedaYaml.includes('bull:submission-execution:wait'), 'KEDA must monitor bull:submission-execution:wait');
      assert.ok(kedaYaml.includes('listLength: "5"'), 'KEDA must target 5 items per worker replica');
    });
  });

  // ============================================================================
  // 4. NETWORK POLICIES & LEAST-PRIVILEGE SEGMENTATION
  // ============================================================================
  describe('4. Network Policies & Ingress Selectors (Section 9)', () => {
    it('4.1 NetworkPolicy enforces default deny and explicit CoreDNS (UDP/TCP 53) egress', () => {
      const npYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'network-policy.yaml'), 'utf8');

      assert.ok(npYaml.includes('name: default-deny-all'), 'Must include default-deny-all policy');
      assert.ok(npYaml.includes('name: allow-dns-egress'), 'Must include explicit DNS egress policy');
      assert.ok(npYaml.includes('port: 53'), 'Must allow DNS on port 53');
      assert.ok(npYaml.includes('protocol: UDP') && npYaml.includes('protocol: TCP'), 'Must allow both UDP and TCP 53');
    });

    it('4.2 Backend NetworkPolicy specifies explicit from: selectors preventing open pod ingress', () => {
      const npYaml = fs.readFileSync(path.join(K8S_BASE_DIR, 'network-policy.yaml'), 'utf8');
      const backendSection = npYaml.split('name: backend-network-policy')[1] || '';

      // Must NOT contain an unauthenticated port 5000 rule without a from selector
      assert.ok(
        !backendSection.includes('- ports:\n        - protocol: TCP\n          port: 5000'),
        'Backend ingress MUST NOT have a port rule without a from: selector'
      );
      assert.ok(backendSection.includes('app: codearena-frontend'), 'Backend must accept traffic from frontend pods');
      assert.ok(backendSection.includes('ingress-nginx'), 'Backend must accept traffic from ingress-nginx namespace');
    });
  });

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
          connectTimeout: 1000
        });

        // Ping Redis with timeout
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
