# CodeArena — Database Indexes

## 1. Purpose

Indexes are used to make frequently executed database queries faster.

CodeArena should create indexes based on actual query patterns rather than indexing every field.

---

# 2. Indexing Principles

The database should:

- Index frequently queried fields.
- Support common sorting operations.
- Support filtering operations.
- Avoid unnecessary indexes.
- Avoid indexing large text fields without a specific requirement.

Indexes consume storage and add write overhead.

---

# 3. Users Indexes

## Email

```text
email: 1
```

This index should be unique.

Purpose:

```text
Login
Registration
Duplicate email detection
```

Example:

```text
User.findOne({ email })
```

---

# 4. Problems Indexes

## Active Problems + Difficulty

```text
isActive: 1
difficulty: 1
```

Useful for:

```text
GET /api/v1/problems?difficulty=MEDIUM
```

---

## Tags

```text
tags: 1
```

Useful for filtering problems by tags.

Example:

```text
GET /api/v1/problems?tag=array
```

---

## Created Time

If problems are commonly sorted by creation date:

```text
createdAt: -1
```

This should be added when the query pattern requires it.

---

# 5. TestCases Indexes

## Problem + Active + Order

```text
problemId: 1
isActive: 1
order: 1
```

This supports retrieving active test cases for a problem in execution order.

Example query:

```text
TestCase.find({
    problemId,
    isActive: true
}).sort({ order: 1 })
```

---

# 6. Submissions Indexes

Submissions are expected to grow significantly.

Therefore submission queries require careful indexing.

---

## User + Created Time

```text
userId: 1
createdAt: -1
```

Purpose:

```text
View user's submission history
```

Example:

```text
Submission.find({
    userId
}).sort({
    createdAt: -1
})
```

---

## Problem + Created Time

```text
problemId: 1
createdAt: -1
```

Useful for retrieving recent submissions for a problem.

---

## User + Problem + Created Time

```text
userId: 1
problemId: 1
createdAt: -1
```

Useful for queries such as:

```text
User's submissions for a specific problem
```

---

# 7. Index Summary

| Collection | Index | Purpose |
|---|---|---|
| Users | `email: 1` unique | Login / uniqueness |
| Problems | `isActive: 1, difficulty: 1` | Problem filtering |
| Problems | `tags: 1` | Tag filtering |
| Problems | `createdAt: -1` | Sorting |
| TestCases | `problemId: 1, isActive: 1, order: 1` | Test retrieval |
| Submissions | `userId: 1, createdAt: -1` | User history |
| Submissions | `problemId: 1, createdAt: -1` | Problem submissions |
| Submissions | `userId: 1, problemId: 1, createdAt: -1` | User/problem history |

---

# 8. Fields Not Indexed Initially

The following fields should not receive normal indexes in the MVP without a demonstrated query requirement:

```text
sourceCode
description
input
expectedOutput
errorMessage
```

These fields can be large.

---

# 9. MongoDB `_id`

Every MongoDB document automatically receives an `_id` field.

The default `_id` index is sufficient for direct lookups such as:

```text
Problem.findById(problemId)
Submission.findById(submissionId)
```

No additional index is required for `_id`.

---

# 10. Compound Index Design

Compound indexes should follow the query pattern.

For example:

```text
userId + createdAt
```

is useful when the query is:

```text
Find submissions for this user
Sort by newest
```

The index should therefore match the application's actual access pattern.

---

# 11. Index Trade-offs

Indexes improve reads but have costs.

### Benefits

- Faster queries
- Faster filtering
- Faster sorting
- Better pagination support

### Costs

- Additional storage
- Additional write overhead
- Index maintenance
- More complex database management

Therefore, unnecessary indexes should be avoided.

---

# 12. Pagination

Large collections such as `Submissions` should not be returned completely.

Use pagination:

```text
Request
   |
   v
Indexed Query
   |
   v
Limited Result Set
```

For example:

```text
GET /api/v1/submissions/me?page=1&limit=20
```

For very large datasets, cursor-based pagination can be considered later.

---

# 13. Index Validation

Indexes should be validated against real queries using MongoDB query analysis tools such as:

```text
explain()
```

The goal is to confirm that important queries use appropriate indexes.

---

# 14. Future Indexes

Additional indexes may be introduced when new features are added.

Examples:

```text
Contest queries
Leaderboard queries
User statistics
Search
Analytics
```

Indexes should be added based on measured query requirements rather than assumptions.

---

# 15. Indexing Rule

The general rule for CodeArena is:

```text
Identify Query
      ↓
Measure Query
      ↓
Choose Index
      ↓
Verify with explain()
      ↓
Monitor Performance
```

Do not create indexes simply because a field exists.