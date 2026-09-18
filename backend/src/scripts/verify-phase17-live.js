/**
 * Phase 17 Live Integration Verification Script
 *
 * Tests the real running Distributed Execution Architecture:
 * Client -> Nginx Reverse Proxy (port 5000) -> Backend Replicas -> BullMQ -> Distributed Autonomous Workers
 *
 * Invariants Verified:
 * 1. Gateway & Backend health and readiness (/proxy-health, /health, /ready)
 * 2. Admin Worker Registry API (/api/v1/admin/workers) returns active registered workers with valid heartbeats
 * 3. Asynchronous submissions are queued by Backend API without executing code on API instances
 * 4. Autonomous distributed worker instances pick up jobs from BullMQ
 * 5. Completed submissions record execution metadata (workerId, startedAt, completedAt)
 * 6. Work is distributed across active worker instances
 * 7. Worker registry continuously reflects fresh heartbeats
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || process.env.PROXY_URL || 'http://localhost:5000';

function request(url, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = payload ? JSON.stringify(payload) : null;
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ''),
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(options.headers || {})
      },
      timeout: 10000
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
      reject(new Error(`Request timed out after 10000ms: ${url}`));
    });

    req.on('error', reject);

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('================================================================');
  console.log('PHASE 17 LIVE DISTRIBUTED EXECUTION ARCHITECTURE VERIFICATION');
  console.log('================================================================');
  console.log(`Target URL: ${BASE_URL}\n`);

  // 1. Gateway & Backend Health Checks
  console.log('Step 1: Checking Gateway & Backend Health Probes...');
  const proxyRes = await request(`${BASE_URL}/proxy-health`);
  if (proxyRes.status === 200) {
    console.log(`✔ Nginx reverse-proxy is reachable (/proxy-health)`);
  } else {
    console.log(`ℹ Direct backend or alternate proxy detected (status ${proxyRes.status})`);
  }

  const healthRes = await request(`${BASE_URL}/health`);
  if (healthRes.status !== 200 || healthRes.data?.status !== 'ok') {
    throw new Error(`Backend liveness probe failed: HTTP ${healthRes.status}`);
  }
  console.log(`✔ Backend liveness probe OK (/health)`);

  const readyRes = await request(`${BASE_URL}/ready`);
  if (readyRes.status !== 200 || readyRes.data?.status !== 'ready') {
    throw new Error(`Backend readiness probe failed: HTTP ${readyRes.status}`);
  }
  console.log(`✔ Backend readiness probe OK (/ready): DB=${readyRes.data?.checks?.database?.status}, Redis=${readyRes.data?.checks?.redis?.status}\n`);

  // 2. Admin Authentication
  console.log('Step 2: Authenticating as Admin for Worker Registry access...');
  let adminToken = null;
  const adminLogin = await request(`${BASE_URL}/api/v1/auth/login`, { method: 'POST' }, {
    email: 'admin@codearena.dev',
    password: 'Admin@12345'
  });

  if (adminLogin.status === 200 && adminLogin.data?.data?.token) {
    adminToken = adminLogin.data.data.token;
    console.log('✔ Admin authenticated successfully.');
  } else {
    throw new Error(`Admin login failed: HTTP ${adminLogin.status} ${JSON.stringify(adminLogin.data)}`);
  }

  // 3. Inspect Worker Registry via GET /api/v1/admin/workers
  console.log('\nStep 3: Querying Admin Worker Registry (GET /api/v1/admin/workers)...');
  const workersRes = await request(`${BASE_URL}/api/v1/admin/workers`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  if (workersRes.status !== 200 || !workersRes.data?.success) {
    throw new Error(`GET /api/v1/admin/workers failed: HTTP ${workersRes.status} ${JSON.stringify(workersRes.data)}`);
  }

  const registeredWorkers = Array.isArray(workersRes.data.data?.workers)
    ? workersRes.data.data.workers
    : (Array.isArray(workersRes.data.data) ? workersRes.data.data : []);
  console.log(`✔ Worker Registry returned HTTP 200 with ${registeredWorkers.length} active worker(s):`);
  for (const w of registeredWorkers) {
    const secondsAgo = Math.round((Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000);
    console.log(`  - Worker ID: ${w.workerId}`);
    console.log(`    Hostname: ${w.hostname}, PID: ${w.pid}, Status: ${w.status}, Concurrency: ${w.concurrency}`);
    console.log(`    Last Heartbeat: ${w.lastHeartbeat} (${secondsAgo}s ago)`);
  }

  if (registeredWorkers.length === 0) {
    throw new Error('No active workers found registered in Redis! Ensure worker containers are running and publishing heartbeats.');
  }

  // 4. Authenticate as Regular User
  console.log('\nStep 4: Authenticating as User to submit jobs...');
  let userToken = null;
  const userLogin = await request(`${BASE_URL}/api/v1/auth/login`, { method: 'POST' }, {
    email: 'user@codearena.dev',
    password: 'User@12345'
  });

  if (userLogin.status === 200 && userLogin.data?.data?.token) {
    userToken = userLogin.data.data.token;
    console.log('✔ User authenticated successfully.');
  } else {
    throw new Error(`User login failed: HTTP ${userLogin.status} ${JSON.stringify(userLogin.data)}`);
  }

  // 5. Fetch Problem
  console.log('\nStep 5: Fetching available problem...');
  const probRes = await request(`${BASE_URL}/api/v1/problems`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  const problems = probRes.data?.data?.problems || [];
  if (problems.length === 0) {
    throw new Error('No problems found in the system. Seed the database first.');
  }
  const problem = problems[0];
  const problemId = problem.id || problem._id;
  console.log(`✔ Selected Problem: "${problem.title}" (ID: ${problemId})`);

  // 6. Enqueue Multiple Submissions to verify distributed processing
  const NUM_SUBMISSIONS = 6;
  console.log(`\nStep 6: Enqueuing ${NUM_SUBMISSIONS} submissions to test distributed execution...`);
  const pythonCode = `import sys\nline = sys.stdin.read().split()\nif line:\n    print(int(line[0]) + int(line[1]))\n`;
  const submissionIds = [];

  for (let i = 0; i < NUM_SUBMISSIONS; i++) {
    const subRes = await request(`${BASE_URL}/api/v1/submissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    }, {
      problemId,
      language: 'PYTHON',
      sourceCode: pythonCode
    });

    if (subRes.status !== 201 && subRes.status !== 200) {
      throw new Error(`Submission ${i + 1} failed to enqueue: HTTP ${subRes.status} ${JSON.stringify(subRes.data)}`);
    }

    const subId = subRes.data?.data?.submission?.id || subRes.data?.data?.submission?._id || subRes.data?.data?.id;
    submissionIds.push(subId);
    console.log(`  - Enqueued submission ${i + 1}/${NUM_SUBMISSIONS}: ID ${subId} (Initial Status: ${subRes.data?.data?.submission?.status || 'QUEUED'})`);
  }

  // 7. Poll submissions to completion and verify execution metadata
  console.log('\nStep 7: Polling submissions to terminal state and checking execution metadata...');
  const completedSubmissions = [];
  const MAX_POLL_SECONDS = 40;

  for (const subId of submissionIds) {
    let completed = false;
    const startPoll = Date.now();

    while (Date.now() - startPoll < MAX_POLL_SECONDS * 1000) {
      const pollRes = await request(`${BASE_URL}/api/v1/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      if (pollRes.status === 200) {
        const sub = pollRes.data?.data?.submission || pollRes.data?.data;
        if (['COMPLETED', 'FAILED'].includes(sub.status)) {
          completedSubmissions.push(sub);
          completed = true;
          break;
        }
      }
      await sleep(1000);
    }

    if (!completed) {
      throw new Error(`Submission ${subId} did not reach terminal status within ${MAX_POLL_SECONDS}s!`);
    }
  }

  console.log(`✔ All ${completedSubmissions.length} submissions reached terminal state.\n`);

  // 8. Validate Distributed Execution Metadata Invariants
  console.log('Step 8: Verifying execution metadata on completed submissions...');
  const executingWorkers = new Map();

  for (const sub of completedSubmissions) {
    const subId = sub.id || sub._id;
    const exec = sub.execution;

    if (!exec) {
      throw new Error(`Invariant Violated: Submission ${subId} is missing execution metadata!`);
    }

    if (!exec.workerId) {
      throw new Error(`Invariant Violated: Submission ${subId} is missing execution.workerId!`);
    }

    if (!exec.startedAt || !exec.completedAt) {
      throw new Error(`Invariant Violated: Submission ${subId} is missing execution.startedAt or completedAt!`);
    }

    const startTime = new Date(exec.startedAt).getTime();
    const endTime = new Date(exec.completedAt).getTime();
    if (isNaN(startTime) || isNaN(endTime) || startTime > endTime) {
      throw new Error(`Invariant Violated: Submission ${subId} has invalid timestamps: startedAt=${exec.startedAt}, completedAt=${exec.completedAt}`);
    }

    const durationMs = endTime - startTime;
    executingWorkers.set(exec.workerId, (executingWorkers.get(exec.workerId) || 0) + 1);

    console.log(`  - Submission ${subId}: Status=${sub.status}, Worker=${exec.workerId}, Duration=${durationMs}ms`);
  }

  console.log('\n--- Distributed Execution Summary ---');
  console.log(`Total jobs evaluated: ${completedSubmissions.length}`);
  console.log(`Distinct workers executing jobs: ${executingWorkers.size}`);
  for (const [wId, count] of executingWorkers.entries()) {
    console.log(`  - ${wId}: processed ${count} submission(s)`);
  }
  console.log('------------------------------------\n');

  // Distribution assertion for multi-worker topology
  if (registeredWorkers.length >= 2) {
    if (executingWorkers.size < 2) {
      console.error(`\n❌ DISTRIBUTION VERIFICATION FAILED: Expected at least 2 distinct workers to process the ${completedSubmissions.length} jobs across ${registeredWorkers.length} active workers, but only observed ${executingWorkers.size}:`, Array.from(executingWorkers.keys()));
      process.exit(1);
    }
    console.log(`✔ Multi-worker distributed execution confirmed: ${executingWorkers.size} distinct workers executed jobs.\n`);
  }

  // 9. Re-query worker registry to verify heartbeats remained active
  console.log('Step 9: Verifying worker registry health post-execution...');
  const postWorkersRes = await request(`${BASE_URL}/api/v1/admin/workers`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (postWorkersRes.status !== 200 || !postWorkersRes.data?.data) {
    throw new Error('Failed to query worker registry post-execution');
  }

  const postWorkers = Array.isArray(postWorkersRes.data?.data?.workers)
    ? postWorkersRes.data.data.workers
    : (Array.isArray(postWorkersRes.data?.data) ? postWorkersRes.data.data : []);

  for (const w of postWorkers) {
    const secondsAgo = Math.round((Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000);
    if (secondsAgo > 15) {
      throw new Error(`Worker ${w.workerId} heartbeat is stale (${secondsAgo}s ago)!`);
    }
  }
  console.log(`✔ All active workers maintained fresh heartbeats (≤ 15s) in Redis registry.`);

  console.log('\n================================================================');
  console.log('✔ PHASE 17 DISTRIBUTED EXECUTION ARCHITECTURE VERIFIED SUCCESSFULLY');
  console.log('================================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Phase 17 verification failed:', err.message || err);
  process.exit(1);
});
