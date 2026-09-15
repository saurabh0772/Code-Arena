# CodeArena

Online Judge & Secure Code Execution Platform

CodeArena is being developed incrementally, beginning with the backend foundation.

## Current Status: Phase 1 — Repository & Backend Setup

At this stage, the repository structure is established and the minimal Node.js / Express backend foundation is initialized.

Application features (such as user authentication, problem and test case management, submission handling, database storage, and the secure execution engine) are scheduled for subsequent development phases and are not yet implemented.

## Project Structure

```text
CodeArena/
├── frontend/             # Frontend application (placeholder)
├── backend/              # Node.js / Express modular monolith backend
│   ├── src/
│   │   ├── config/       # Configuration modules
│   │   ├── middleware/   # Custom Express middlewares
│   │   ├── modules/      # Domain modules (auth, users, problems, etc.)
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── problems/
│   │   │   ├── test-cases/
│   │   │   └── submissions/
│   │   ├── utils/        # Utility helpers
│   │   ├── app.js        # Express application configuration
│   │   └── server.js     # Server entrypoint & HTTP listener
│   ├── tests/            # Test suites
│   ├── .env.example      # Sample environment configuration
│   ├── .gitignore        # Backend gitignore
│   ├── Dockerfile        # Backend container definition
│   └── package.json      # Dependencies and scripts
├── execution-engine/     # Isolated execution service (placeholder)
├── docs/                 # Architecture, specifications, and ADRs
├── docker-compose.yml    # Minimal Docker Compose definition
├── .gitignore            # Root gitignore
└── README.md             # Project overview
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)

### Running the Backend Locally

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the server:
   ```bash
   npm start
   ```
   Or run in development mode with automatic reload:
   ```bash
   npm run dev
   ```

5. Verify server status:
   ```bash
   curl http://localhost:5000/health
   ```
