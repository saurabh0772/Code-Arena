# CodeArena — Scalability Strategy

## 1. Purpose

This document describes how CodeArena can scale from the MVP to a system capable of handling larger workloads.

The strategy focuses on scaling:

- API traffic
- Database operations
- Code execution
- Background processing

The MVP will not implement all scaling mechanisms immediately.

---

# 2. Scalability Principle

The most important principle is:

> Scale the expensive parts independently from the normal API workload.

Code execution is significantly more resource-intensive than normal API requests.

Therefore execution should eventually become independently scalable.

---

# 3. MVP Architecture

The initial system is intentionally simple:

```text
Frontend
   |
   v
Backend
   |
   +---- MongoDB
   |
   +---- Execution Engine
             |
             v
        Docker Sandbox
```

This is sufficient for the first working version.

---

# 4. Main Scaling Challenges

CodeArena's major scaling challenges are:

### API Traffic

Large numbers of users may browse problems and submit solutions.

### Database Growth

Submission records can grow rapidly.

### Code Execution

Execution consumes:

- CPU
- Memory
- Processes
- Time

### Concurrent Submissions

Many simultaneous submissions can overload the execution environment.

---

# 5. Backend Scaling

The Backend should remain as stateless as practical.

Instead of:

```text
Single Backend
```

future deployments can use:

```text
             Load Balancer
                  |
        +---------+---------+
        |         |         |
        v         v         v
    Backend   Backend   Backend
```

Any Backend instance should be able to handle an authenticated request.

Persistent state belongs in shared infrastructure such as MongoDB and future queues.

---

# 6. Horizontal Scaling

Horizontal scaling means adding more instances instead of continuously increasing the resources of one instance.

Example:

```text
1 Backend
   ↓
2 Backends
   ↓
5 Backends
   ↓
N Backends
```

A load balancer distributes requests between instances.

---

# 7. Execution Scaling

Execution should eventually be separated from normal API traffic.

Future architecture:

```text
Backend
   |
   v
Queue
   |
   +---- Worker 1
   |
   +---- Worker 2
   |
   +---- Worker 3
```

Each worker processes execution jobs.

---

# 8. Why a Queue?

A queue provides buffering between API requests and execution capacity.

Without a queue:

```text
100 Submissions
      |
      v
Execution
      |
      v
Resource Overload
```

With a queue:

```text
100 Submissions
      |
      v
     Queue
      |
      v
Controlled Workers
```

The queue allows execution capacity to be controlled independently.

---

# 9. Worker Pool

A worker pool can process multiple submissions concurrently.

```text
                 Queue
                   |
        +----------+----------+
        |          |          |
        v          v          v
     Worker 1   Worker 2   Worker 3
        |          |          |
        v          v          v
     Sandbox    Sandbox    Sandbox
```

The number of workers can be adjusted based on available resources.

---

# 10. Backpressure

If submissions arrive faster than workers can process them, jobs remain queued.

```text
Submission Rate
      >
Worker Capacity
      |
      v
Queue Growth
```

This prevents the API from attempting to execute unlimited programs simultaneously.

---

# 11. Database Scaling

MongoDB performance should first be improved through:

- Correct schema design
- Appropriate indexes
- Efficient queries
- Pagination
- Avoiding unnecessary document retrieval

Only after these approaches are insufficient should more complex database scaling be introduced.

---

# 12. Submission Data Growth

Submissions can become the largest collection.

Example:

```text
Users
   |
   v
Problems
   |
   v
Many Submissions
```

Queries should use indexes such as:

```text
userId + createdAt
problemId + createdAt
userId + problemId + createdAt
```

Pagination should be used for submission history.

---

# 13. Database Read Scaling

If read traffic becomes high, MongoDB read scaling strategies can be considered.

Possible future approach:

```text
Application
     |
     v
MongoDB Cluster
   /       \
Read      Primary
Nodes
```

This should only be introduced when actual workload requires it.

---

# 14. Caching

Frequently requested data may eventually be cached.

Good candidates include:

- Problem lists
- Problem details
- Static metadata
- Language configurations

Example:

```text
Client
  |
  v
Backend
  |
  v
Cache
  |
  +---- Hit → Return Data
  |
  +---- Miss
        |
        v
      MongoDB
```

Submission results and rapidly changing execution state require more careful caching decisions.

---

# 15. Execution Image Scaling

Language environments can be packaged into reusable images.

Example:

```text
C++ Image
Python Image
JavaScript Image
```

Workers can reuse already available images instead of rebuilding environments for every submission.

---

# 16. Resource Isolation

Each submission must have bounded resource usage.

```text
Submission
    |
    v
Sandbox
    |
    +---- CPU Limit
    +---- Memory Limit
    +---- Time Limit
    +---- Process Limit
    +---- Output Limit
```

This protects execution capacity from abusive or inefficient programs.

---

# 17. Autoscaling

A future worker system can scale according to queue pressure.

Conceptually:

```text
Queue Depth
    |
    +---- Low
    |      ↓
    |   Few Workers
    |
    +---- High
           ↓
       More Workers
```

Autoscaling should also consider available CPU and memory.

---

# 18. API Rate Limiting

Submission endpoints should have stricter limits than normal read endpoints.

Example:

```text
Problem Read Requests
        ↓
Higher Limit

Code Submissions
        ↓
Lower Limit
```

This prevents a single user from overwhelming the execution system.

---

# 19. Fault Isolation

Execution failures should not bring down the Backend.

Preferred architecture:

```text
Backend
   |
   v
Execution Boundary
   |
   v
Sandbox
```

A crashed sandbox should affect only its own submission.

---

# 20. Future Architecture

A more scalable version may look like:

```text
                       Internet
                          |
                          v
                    Load Balancer
                          |
                +---------+---------+
                |                   |
                v                   v
           Backend 1           Backend 2
                |                   |
                +---------+---------+
                          |
                          v
                        Queue
                          |
            +-------------+-------------+
            |             |             |
            v             v             v
         Worker 1      Worker 2      Worker 3
            |             |             |
            v             v             v
         Sandbox       Sandbox       Sandbox

                 Backend
                    |
                    v
                 MongoDB
```

---

# 21. Scaling Stages

## Stage 1 — MVP

```text
Backend
  +
Execution Engine
  +
MongoDB
```

---

## Stage 2 — Async Execution

```text
Backend
  |
Queue
  |
Workers
```

---

## Stage 3 — Horizontal Scaling

```text
Load Balancer
      |
Multiple Backend Instances
      |
Queue
      |
Multiple Workers
```

---

## Stage 4 — Advanced Scaling

Potential additions:

- Distributed workers
- Autoscaling
- Caching
- Read replicas
- Stronger sandbox isolation
- Dedicated execution pools
- Multiple execution regions

These should be introduced based on measurable requirements.

---

# 22. What Not to Scale Prematurely

The MVP does not require:

- Kubernetes
- Service mesh
- Multi-region deployment
- Complex microservices
- Distributed databases
- Global worker clusters

The first goal is a correct and secure system.

---

# 23. Scalability Principles

1. Keep the API layer stateless.
2. Scale Backend horizontally when necessary.
3. Separate execution from API workloads.
4. Use queues to control execution pressure.
5. Scale workers independently.
6. Use indexes before introducing complex database scaling.
7. Cache only when useful.
8. Enforce resource limits on every execution.
9. Measure actual bottlenecks before scaling.
10. Prefer incremental architecture evolution.

---

# 24. Final Scaling Strategy

The intended evolution is:

```text
Simple MVP
    ↓
Asynchronous Execution
    ↓
Worker Pool
    ↓
Horizontal Backend Scaling
    ↓
Caching / Database Optimization
    ↓
Autoscaling
    ↓
Advanced Isolation / Distributed Infrastructure
```

CodeArena should scale because there is a demonstrated need, not simply because additional infrastructure is available.