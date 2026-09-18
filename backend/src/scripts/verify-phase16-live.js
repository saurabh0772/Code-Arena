/**
 * Phase 16 Live Integration Verification Script
 *
 * Tests the real running Docker Compose architecture:
 * Client -> Nginx Reverse Proxy (port 5000) -> Scaled Backend Replicas (backend:5000)
 *
 * Invariants Verified:
 * 1. Nginx Reverse Proxy is reachable and healthy (/proxy-health)
 * 2. Backend liveness probe responds through Nginx (/health)
 * 3. Backend readiness probe responds through Nginx with dependencies healthy (/ready)
 * 4. Request ID (X-Request-Id) tracing header is preserved across the proxy
 * 5. Multiple backend replicas receive traffic through the single Nginx entry point (when scaled)
 */

const http = require('http');
const { execSync } = require('child_process');

const PROXY_URL = process.env.PROXY_URL || process.env.BASE_URL || 'http://localhost:5000';
const SAMPLE_COUNT = parseInt(process.env.SAMPLE_COUNT || '40', 10);

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ''),
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      timeout: 5000
    };

    const start = Date.now();
    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        let data = null;
        try {
          data = body ? JSON.parse(body) : null;
        } catch {
          data = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          latencyMs
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after 5000ms: ${url}`));
    });

    req.on('error', reject);
    req.end();
  });
}

function getRunningBackendContainerCount() {
  try {
    const output = execSync('docker compose ps backend -q', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const ids = output.trim().split('\n').filter(Boolean);
    return ids.length;
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('================================================================');
  console.log('PHASE 16 LIVE NGINX & HORIZONTAL SCALING VERIFICATION');
  console.log('================================================================');
  console.log(`Target URL: ${PROXY_URL}`);
  console.log(`Sample Count: ${SAMPLE_COUNT}\n`);

  // 1. Verify Nginx Gateway Health
  console.log('Step 1: Checking Nginx Gateway Health (/proxy-health)...');
  try {
    const proxyRes = await request(`${PROXY_URL}/proxy-health`);
    if (proxyRes.status !== 200 || proxyRes.data?.service !== 'codearena-reverse-proxy') {
      console.error(`FAILED: Expected 200 from /proxy-health, got status ${proxyRes.status}`, proxyRes.data);
      process.exit(1);
    }
    console.log(`✔ Nginx reverse-proxy is reachable and healthy (${proxyRes.latencyMs}ms)\n`);
  } catch (err) {
    console.error(`FAILED to connect to Nginx reverse proxy at ${PROXY_URL}: ${err.message}`);
    console.error('Make sure Docker Compose is running: docker compose up -d');
    process.exit(1);
  }

  // 2. Verify Backend Liveness through Proxy
  console.log('Step 2: Checking Backend Liveness through Proxy (/health)...');
  const healthRes = await request(`${PROXY_URL}/health`);
  if (healthRes.status !== 200 || healthRes.data?.status !== 'ok') {
    console.error(`FAILED: Expected 200 from /health, got status ${healthRes.status}`, healthRes.data);
    process.exit(1);
  }
  const sampleInstanceId = healthRes.headers['x-api-instance-id'] || healthRes.data?.apiInstanceId;
  console.log(`✔ Backend liveness OK: instance "${sampleInstanceId}" responded with 200 OK (${healthRes.latencyMs}ms)\n`);

  // 3. Verify Backend Dependency Readiness through Proxy
  console.log('Step 3: Checking Backend Readiness Probe through Proxy (/ready)...');
  const readyRes = await request(`${PROXY_URL}/ready`);
  if (readyRes.status !== 200 || readyRes.data?.status !== 'ready') {
    console.error(`FAILED: Expected 200 ready from /ready, got status ${readyRes.status}`, readyRes.data);
    process.exit(1);
  }
  console.log(`✔ Backend readiness OK: DB=${readyRes.data?.checks?.database?.status}, Redis=${readyRes.data?.checks?.redis?.status} (${readyRes.latencyMs}ms)\n`);

  // 4. Verify Request ID (X-Request-Id) Propagation
  console.log('Step 4: Checking Request ID (X-Request-Id) Tracing Propagation...');
  const testRequestId = `phase16-live-trace-${Date.now()}`;
  const traceRes = await request(`${PROXY_URL}/health`, {
    headers: { 'X-Request-Id': testRequestId }
  });
  if (traceRes.headers['x-request-id'] !== testRequestId) {
    console.error(`FAILED: Expected X-Request-Id "${testRequestId}", got "${traceRes.headers['x-request-id']}"`);
    process.exit(1);
  }
  console.log(`✔ X-Request-Id successfully propagated through Nginx (${testRequestId})\n`);

  // 5. Multi-Request Distribution Sampling
  console.log(`Step 5: Executing ${SAMPLE_COUNT} requests through Nginx to observe backend instances...`);
  const instanceCounts = new Map();
  const latencies = [];

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    try {
      const res = await request(`${PROXY_URL}/health`);
      if (res.status !== 200) {
        console.warn(`[WARN] Request ${i + 1} returned status ${res.status}`);
        continue;
      }

      const instanceId = res.headers['x-api-instance-id'] || res.data?.apiInstanceId || 'unknown';
      instanceCounts.set(instanceId, (instanceCounts.get(instanceId) || 0) + 1);
      latencies.push(res.latencyMs);

      // Brief sleep between queries to allow DNS TTL rotation if applicable
      await sleep(100);
    } catch (err) {
      console.error(`[ERROR] Request ${i + 1} failed: ${err.message}`);
    }
  }

  const observedBackendIds = Array.from(instanceCounts.keys());
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length || 0);

  console.log('\n--- Traffic Distribution Summary ---');
  console.log(`Total successful requests: ${latencies.length} / ${SAMPLE_COUNT}`);
  console.log(`Average latency: ${avgLatency}ms`);
  console.log(`Distinct backend instances observed: ${observedBackendIds.length}`);

  for (const [id, count] of instanceCounts.entries()) {
    const percentage = ((count / latencies.length) * 100).toFixed(1);
    console.log(`  - Instance "${id}": ${count} requests (${percentage}%)`);
  }
  console.log('------------------------------------\n');

  // 6. Assertions based on Running Topology
  const runningContainers = getRunningBackendContainerCount();
  if (runningContainers !== null) {
    console.log(`Docker reports ${runningContainers} backend container(s) running in the stack.`);
  }

  if (runningContainers === 1 || (runningContainers === null && observedBackendIds.length === 1)) {
    if (observedBackendIds.length === 1) {
      console.log('ℹ [DIAGNOSTIC NOTE] Only 1 backend instance was observed.');
      console.log('  To verify multi-replica load-balancing across distinct instances, scale backend replicas:');
      console.log('    docker compose up --scale backend=2 -d');
      console.log('  Then re-run this verification script.\n');
      console.log('Single-instance proxy routing verified successfully.');
      process.exit(0);
    }
  }

  if (observedBackendIds.length < 2) {
    console.error(`FAILED: Expected at least 2 distinct backend instances, but only observed ${observedBackendIds.length}:`, observedBackendIds);
    console.error('If you scaled the backend, ensure Nginx can resolve multiple container IPs via 127.0.0.11.');
    process.exit(1);
  }

  console.log(`✔ SUCCESS: Observed ${observedBackendIds.length} distinct backend instances serving traffic via Nginx.`);
  console.log('Horizontal scaling and dynamic load balancing are verified!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
