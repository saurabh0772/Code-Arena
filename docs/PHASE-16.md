# CodeArena — Phase 16: Horizontal Scaling

## 1. Objective

The objective of Phase 16 is to evolve CodeArena from a single-backend-instance architecture into a horizontally scalable system capable of running **multiple stateless backend/API instances** simultaneously behind a reverse-proxy load balancer.

In this phase:
- The API tier is made fully stateless with respect to persistent and authentication state.
- Traffic is distributed across API replicas using a lightweight Nginx reverse proxy.
- All backend replicas coordinate via a shared MongoDB database and shared Redis instance.
- Rate limiting is made cluster-aware and globally synchronized across backend replicas via Redis.
- Individual backend processes carry unique runtime identities (`API_INSTANCE_ID`) for clear request tracing alongside unique request correlation IDs (`X-Request-Id`).
- Each backend instance supports independent graceful shutdown without disrupting peer instances.
- Docker Compose natively supports replica scaling via `docker compose up --scale backend=2 --scale worker=2 -d`.

---

## 2. Phase 15 → Phase 16 Evolution

In **Phase 15**, CodeArena scaled the background worker pool to support multiple concurrent worker daemons (`Worker A`, `Worker B`, `Worker C`) executing jobs from a single BullMQ queue. However, the API tier remained a single process binding host port 5000.

In **Phase 16**, horizontal scaling expands to the API tier:

```text
Phase 15: Single Backend API + Scaled Workers

                    Client / Browser
                           ↓
                   Backend API (Port 5000)
                           ↓
                   MongoDB + Redis
                           ↓
                 Worker A / Worker B (Scaled)
```

```text
Phase 16: Scaled API Replicas + Reverse Proxy + Scaled Workers

                    Client / Frontend
                           ↓
              Reverse Proxy / Load Balancer
                 (Nginx on Host Port 5000)
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │Backend 1│   │Backend 2│   │Backend N│
        │ (API-1) │   │ (API-2) │   │ (API-N) │
        └────┬────┘   └────┬────┘   └────┬────┘
             │             │             │
             └─────────────┼─────────────┘
                           ↓
                     ┌───────────┐
                     │  MongoDB  │
                     └───────────┘
                           +
                     ┌───────────┐
                     │   Redis   │
                     └─────┬─────┘
                           ↓
                    ┌──────────────┐
                    │ Worker Pool  │
                    │ Worker A/B/C │
                    └──────┬───────┘
                           ↓
                    Execution Engine
                           ↓
                     Docker Sandbox
```

---

## 3. Horizontal Scaling Model

Horizontal scaling in Phase 16 means:
$$\text{Single Backend Instance} \longrightarrow \text{Backend}_1, \text{Backend}_2, \dots, \text{Backend}_N$$

Incoming traffic is balanced across healthy backend instances through a single stable entry point. The backend instances do not maintain private in-memory session or user registries; all persistent state is maintained externally in MongoDB and Redis.

```text
       Stateless API Tier                   Shared External State Tier
┌─────────────────────────────────┐        ┌────────────────────────────┐
│ Backend Replica 1 (ephemeral)   │───────▶│ MongoDB: Persistent data   │
│ Backend Replica 2 (ephemeral)   │───────▶│ Redis: Queue & Rate Limits │
│ Backend Replica 3 (ephemeral)   │───────▶│ Docker DooD: Sandboxes     │
└─────────────────────────────────┘        └────────────────────────────┘
```

---

## 4. Stateless Backend Architecture

The backend API instances are designed to be completely stateless:
1. **No In-Memory Sessions**: User authentication is mediated entirely by signed JSON Web Tokens (JWT).
2. **Stateless JWT Verification**: Any backend instance can authenticate any incoming request using the shared `JWT_SECRET` and MongoDB query for active account status (`User.findById(decoded.sub)`).
3. **No Process-Local User Registries**: No instance-level user lookup maps, authentication state caches, or connection stores exist.
4. **No Sticky Sessions**: Clients can send sequential requests to different backend replicas (e.g. `POST /login` to Backend 1, `GET /problems` to Backend 2, `POST /submissions` to Backend 3) with identical results.
5. **No Local Filesystem State**: API instances do not rely on local file persistence for application correctness; sandbox workspace tempdirs remain strictly bounded within the execution engine.

---

## 5. Shared MongoDB & Internal Networking

All backend instances connect to the exact same MongoDB database deployment:

$$\text{Backend}_1, \text{Backend}_2, \text{Backend}_N \longrightarrow \text{mongodb://mongodb:27017/codearena}$$

- **Single Source of Truth**: User records, problems, test cases, submissions, and audit logs reside in the shared MongoDB instance.
- **Atomic Operations**: State transitions (e.g. `QUEUED` → `RUNNING`, atomic updates) are handled natively by MongoDB document locks, preserving race condition protection regardless of which API instance initiates the query.
- **Connection Pools**: Each backend process maintains its own independent Mongoose connection pool (`maxPoolSize`, `serverSelectionTimeoutMS: 5000`).
- **Internal Network Security**: MongoDB is an internal service on the Docker network and is not required to be publicly exposed for the horizontally scaled architecture. In `docker-compose.yml`, MongoDB is kept internal with `expose: ["27017"]`. An optional localhost-only port binding (`127.0.0.1:${MONGO_HOST_PORT:-27017}:27017`) is provided strictly for development and host test suites, and is never exposed to public `0.0.0.0`.

---

## 6. Shared Redis

All backend instances connect to the shared Redis deployment:

$$\text{Backend}_1, \text{Backend}_2, \text{Backend}_N \longrightarrow \text{redis:6379}$$

Shared Redis serves two core responsibilities:
1. **BullMQ Submission Queue (`submission-execution`)**: All API replicas produce jobs to the same queue. Each job carries strictly `{ submissionId }`.
2. **Cluster-Wide Rate Limiting (`codearena:rl:*`)**: Rate limit hits are counted in Redis keys with standard TTL expiration, ensuring cluster-wide rate enforcement.
3. **Network Isolation**: Redis is exposed internally on port `6379`, with an optional localhost-only port binding (`127.0.0.1:${REDIS_HOST_PORT:-6380}:6379`) for host testing.

---

## 7. Load Balancer & Dynamic Replica Discovery

CodeArena uses a reverse proxy as the stable entry point for multiple backend replicas. The reverse proxy resolves and routes traffic to available backend instances according to the configured Docker/Nginx mechanism.

### 7.1. Why Open-Source Nginx Requires Variable DNS Resolution
In open-source Nginx:
- Static `upstream` blocks (e.g., `upstream backend_cluster { server backend:5000; }`) resolve domain names **only once at startup** using system resolver `/etc/resolv.conf`. They ignore the `resolver` directive (the `resolve` parameter on `server` directives is an Nginx Plus proprietary feature).
- If replicas are scaled dynamically (`docker compose up --scale backend=3 -d`) after Nginx starts, a static upstream block will never pick up the new container IPs, and if Nginx starts before backend DNS is available, startup fails with `host not found in upstream`.

### 7.2. The Variable-Based Runtime Resolution Solution
To achieve true dynamic replica discovery without requiring an Nginx reload or hardcoded replica hostnames:
1. Nginx is configured with Docker's embedded DNS server:
   ```nginx
   resolver 127.0.0.11 valid=5s ipv6=off;
   resolver_timeout 3s;
   ```
2. Proxy passes evaluate the upstream target dynamically using a variable:
   ```nginx
   set $backend_upstream "http://backend:5000";
   proxy_pass $backend_upstream;
   ```
3. When `proxy_pass` uses a variable containing a hostname, Nginx is forced to query the configured resolver at runtime respecting the TTL (`valid=5s`).
4. Docker's embedded DNS daemon at `127.0.0.11` resolves `backend` to the IP addresses of all active containers for that service, returning round-robin rotated A records.
5. Nginx iterates through the resolved IP addresses to distribute incoming requests across replicas.

### 7.3. Health-Aware Failover (`proxy_next_upstream`)
Because open-source Nginx does not perform active background HTTP health polling, it uses passive request-time failover:
```nginx
proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 3;
proxy_next_upstream_timeout 10s;
```
If a request routed to one backend replica encounters a connection failure, timeout, or server error, Nginx transparently re-routes the request to an alternate resolved backend IP before responding to the client.

### 7.4. Request Tracing Header Preservation
Nginx preserves client tracing headers by forwarding `$http_x_request_id`:
```nginx
proxy_set_header X-Request-Id $http_x_request_id;
```
Upstream response headers (`X-Request-Id` and `X-API-Instance-Id`) pass through Nginx to the client unchanged.

---

## 8. API Instance Identity

To provide operational tracing across horizontal replicas, each backend process derives a distinguishable identity:

### 8.1. Identity Resolution (`resolveApiInstanceId`)
1. **Explicit Parameter**: Passed programmatically during startup or test runs (`createApp({ apiInstanceId })`).
2. **Environment Variable**: `API_INSTANCE_ID` if explicitly configured.
3. **Runtime Fallback**: `api-${os.hostname()}-${process.pid}` (e.g. `api-2ac2934fc68f-19`).

### 8.2. Response Tagging
Every HTTP response carries the header:
```http
X-API-Instance-Id: api-2ac2934fc68f-19
```

---

## 9. Request IDs vs. Instance IDs

CodeArena strictly differentiates between **request identity** and **process identity**:

| Dimension | `requestId` | `apiInstanceId` |
| :--- | :--- | :--- |
| **Identifies** | The individual HTTP transaction | The operating system process / container |
| **Scope** | Ephemeral, per-request | Process lifetime |
| **Header** | `X-Request-Id` (e.g. `phase16-live-trace-1789710579878`) | `X-API-Instance-Id` (e.g. `api-2ac2934fc68f-19`) |
| **Propagation** | Passed through logs and error envelopes | Tagged in server logs and response headers |

### 9.1. Structured HTTP Access Logs
```json
{
  "apiInstanceId": "api-2ac2934fc68f-19",
  "requestId": "phase16-live-trace-1789710579878",
  "method": "POST",
  "url": "/api/v1/submissions",
  "statusCode": 201,
  "durationMs": 18,
  "userAgent": "Mozilla/5.0 ...",
  "ip": "127.0.0.1"
}
```
All sensitive credentials, tokens, source code, and hidden tests are strictly redacted.

---

## 10. Health and Readiness Probes

The application provides clearly separated health probe semantics:

### 10.1. Lightweight Process Liveness Probe (`GET /health`)
- **Semantics**: Answers *"Is this Node.js process alive and able to accept HTTP traffic?"*
- **Behavior**: Always returns HTTP 200 with process identity and database connectivity status as informational metadata:
  ```json
  {
    "status": "ok",
    "service": "codearena-backend",
    "apiInstanceId": "api-2ac2934fc68f-19",
    "database": "connected",
    "timestamp": "2026-09-18T05:49:40.123Z"
  }
  ```
- **Rationale**: A liveness probe must not fail (HTTP 503) merely because an external dependency is degraded; failing a liveness probe would trigger unnecessary container restarts in crash loops.

### 10.2. Deep Dependency Readiness Probe (`GET /ready`)
- **Semantics**: Answers *"Is this backend instance ready to handle user requests?"*
- **Checks**:
  1. MongoDB connectivity (`isConnected()`)
  2. Execution Engine adapter readiness (`checkExecutionReadiness()`)
  3. Redis queue readiness (`checkRedisReadiness()`)
- **Behavior**: Returns HTTP 200 `{ "status": "ready" }` if all dependencies are healthy; returns HTTP 503 `{ "status": "not_ready" }` if any dependency is unavailable.
- **Container Healthcheck**: In `docker-compose.yml`, the backend healthcheck runs `curl -fsS http://localhost:5000/ready` so Docker monitors deep dependency readiness.

---

## 11. Rate Limiting (Cluster-Aware)

In Phase 16, rate limiting is backed by shared Redis using `rate-limit-redis`:

```text
Client ──▶ Backend 1 ──▶ Redis Key: codearena:rl:register:192.168.1.5 (Count: 1)
Client ──▶ Backend 2 ──▶ Redis Key: codearena:rl:register:192.168.1.5 (Count: 2)
Client ──▶ Backend 3 ──▶ Redis Key: codearena:rl:register:192.168.1.5 (Count: 3)
```

- **Global Rate Enforcement**: A client distributing requests across multiple backend replicas cannot bypass rate limits.
- **Fail-Open Resilience**: Configured with `passOnStoreError: true`. If Redis becomes temporarily unreachable, requests are allowed rather than failing with 500 internal server errors.
- **Prefix Isolation**:
  - `codearena:rl:register:` (5 per 15 min per IP)
  - `codearena:rl:login:` (10 per 15 min per IP)
  - `codearena:rl:submission:` (10 per minute per authenticated user)

---

## 12. Graceful Shutdown

Each backend instance handles termination signals (`SIGTERM`, `SIGINT`) independently:
1. **Cease Connection Ingestion**: Stops accepting new connections on the HTTP server (`server.close()`).
2. **In-Flight Draining**: Active HTTP requests are given time to complete.
3. **Owned Resource Closure**: Closes process-owned BullMQ queue client.
4. **Database Disconnection**: Disconnects process-owned MongoDB connection pool.
5. **Safety Guard**: 10-second unreferenced timer (`forceExitTimer`) forces termination if any resource hangs.
6. **Isolation**: Shutting down Backend 1 has zero impact on Backend 2, Backend 3, or the shared database and queue clusters.

---

## 13. Docker Compose Scaling

### 13.1. Scaling Command
```bash
docker compose up --build --scale backend=2 --scale worker=2 -d
```

### 13.2. Compose Architecture
```yaml
services:
  reverse-proxy:
    image: nginx:1.25-alpine
    ports:
      - "5000:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      backend:
        condition: service_started

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    expose:
      - "5000"   # Internal network only; no host port conflicts during scaling
    environment:
      - PORT=5000
      - API_INSTANCE_ID=${API_INSTANCE_ID:-}
      ...
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:5000/ready"]

  mongodb:
    image: mongo:7.0
    expose:
      - "27017"
    ports:
      - "127.0.0.1:${MONGO_HOST_PORT:-27017}:27017"   # Development-only binding
```

---

## 14. Failure Behavior

| Scenario | System Behavior |
| :--- | :--- |
| **Backend Replica 2 Crashes** | Nginx `proxy_next_upstream` detects connection failure and routes traffic to remaining healthy replicas. Shared state in MongoDB and Redis remains uncorrupted. |
| **Backend Replica 1 Gracefully Shuts Down** | Active HTTP requests finish cleanly; new requests are routed by Nginx to remaining instances. |
| **Redis Becomes Unreachable** | Rate limiting fails open (`passOnStoreError: true`); `/ready` reports `unhealthy`; submissions fail fast with `503 QUEUE_UNAVAILABLE`. |
| **MongoDB Becomes Unreachable** | Backend returns `503` on `/ready`; Nginx marks upstream down upon request failure. |

---

## 15. Testing & Live Verification

### 15.1. Automated Unit Tests (`backend/tests/phase16.test.js`)
Contains 21 comprehensive test cases validating all Phase 16 architectural invariants:
- Identity generation and environment overrides
- Header propagation (`X-Request-Id` and `X-API-Instance-Id`)
- Lightweight liveness (`/health`) and deep readiness (`/ready`)
- Stateless authentication and RBAC across independent app instances
- Concurrent submission creation and shared BullMQ queue operations
- Global Redis-backed rate limiting
- Independent graceful shutdown
- Dynamic Nginx configuration and Docker Compose port invariants

### 15.2. Live Integration Verification Script (`scripts/verify-phase16-live.js`)
A dedicated live verification script tests the actual running Docker Compose stack:
```bash
# 1. Start scaled cluster
docker compose up --build --scale backend=2 -d

# 2. Run live verification
node scripts/verify-phase16-live.js
# Or from backend directory:
npm run verify:phase16
```

**Verification Steps Executed by the Script**:
1. Checks gateway health on `/proxy-health` (verifies Nginx process is up).
2. Checks backend liveness through proxy on `/health` (verifies backend response).
3. Checks deep readiness on `/ready` (verifies MongoDB and Redis health).
4. Verifies `X-Request-Id` correlation propagation through Nginx.
5. Sends 40 HTTP requests through the single Nginx entry point (`http://localhost:5000`).
6. Collects `X-API-Instance-Id` from each response and asserts `observedBackendIds.size >= 2` when 2 replicas are running.
7. Prints a traffic distribution summary table.
8. If only 1 replica is active in Docker, reports a clear diagnostic message indicating multi-replica verification requires `--scale backend=2`.

### 15.3. Live Failure & Failover Verification Procedure
To manually verify failover behavior:
1. Start two backend replicas: `docker compose up --scale backend=2 -d`
2. Confirm both instances receive traffic: `node scripts/verify-phase16-live.js`
3. Stop one backend replica: `docker stop codearena-distributedonlinejudge-backend-2`
4. Re-run verification: `node scripts/verify-phase16-live.js`
   - Observe that 100% of requests succeed via the remaining healthy instance.
5. Restart the stopped replica: `docker compose up --scale backend=2 -d`
6. Re-run verification and observe traffic distribution resumes across both instances.

---

## 16. Limitations & Honest Architectural Realities

The Phase 16 implementation adheres to distributed systems best practices and explicitly acknowledges its boundaries:

> [!IMPORTANT]
> **Scope & Reliability Limitations**:
> 1. **Application-Level Foundation, Not Cloud Autoscaling**:
>    Phase 16 establishes the application-level foundation for scaling by making backend instances stateless and shared-state aware. It does not implement automated orchestration, cloud load balancers, or autoscaling metrics (e.g. Kubernetes HPA).
> 2. **No Guaranteed Request Preservation During Sudden Hard Crash**:
>    If a backend instance experiences a hard kill (`SIGKILL`, host power loss) mid-flight, TCP connections drop. While Nginx retries idempotent GET requests on connection error (`proxy_next_upstream`), in-flight POST operations cannot be automatically safely retried without idempotency keys.
> 3. **Single MongoDB & Redis Nodes**:
>    Phase 16 scales the stateless compute tier (APIs and workers). Database clustering (MongoDB replica sets/sharding) and Redis clustering/Sentinel belong to future infrastructure phases.
> 4. **Passive Failover, Not Active Health Polling**:
>    Standard open-source Nginx does not perform active background HTTP health checks. Upstream failures are detected passively upon request failure and retried via `proxy_next_upstream`.
> 5. **No Distributed Service Discovery Registry**:
>    Local routing relies on Docker internal DNS resolution. Consul, Eureka, and service meshes are intentionally excluded.

---

## 17. Future Work

- **Phase 17 — Distributed Execution Architecture**: Decoupling the execution engine into standalone remote execution agents across heterogeneous host nodes.
- **Phase 18 — Advanced Infrastructure**: Kubernetes deployment, Horizontal Pod Autoscaling (HPA), MongoDB Replica Sets, Redis Sentinel, and production observability platforms.
