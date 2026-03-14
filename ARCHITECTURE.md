# Architecture Guide

> A guide for developers new to the RunIt codebase.

## Overview

RunIt turns Python functions into live web apps with shareable links.

```
Function (type hints) -> OpenAPI Schema -> Auto-generated Form -> Shareable Link
                              |
                         Docker Sandbox
                              |
                           SQLite
```

## Directory Structure

```
runit/
+-- apps/
|   +-- web/                    # Next.js frontend
|       +-- app/                # App router pages
|       +-- components/         # React components
|       +-- lib/                # Client utilities
|
+-- packages/
|   +-- shared/                 # TypeScript types & contracts
|   +-- openapi-form/           # Generate forms from OpenAPI specs
|   +-- ui/                     # Shared React components
|   +-- cli/                    # CLI tool
|   +-- client/                 # TypeScript API client
|   +-- mcp-server/             # MCP tools for AI agents
|
+-- services/
|   +-- control-plane/          # Hono.js API server
|   |   +-- src/
|   |       +-- app.ts          # createApp() factory (importable by cloud-plane)
|   |       +-- main.ts         # Server entrypoint
|   |       +-- routes/         # API route handlers
|   |       +-- middleware/     # Auth, rate-limit, etc.
|   |       +-- db/             # Database stores (SQLite / Supabase)
|   |       +-- lib/            # Utilities
|   |       +-- encryption/     # KMS & secrets encryption
|   |
|   +-- runner/                 # Python execution runtime
|       +-- src/
|       |   +-- runit/          # Python SDK (app, storage, remember)
|       +-- Dockerfile          # Runner container image
```

## Key Concepts

### 1. Projects

A **project** is a user-uploaded Python app. It contains:
- Source code (from paste, ZIP upload, or GitHub)
- Versions (each upload creates a new version)
- Endpoints (extracted from OpenAPI spec via type hints)
- Secrets (encrypted environment variables)

### 2. Runs

A **run** is a single execution of an endpoint:

```
1. User submits request to /runs
2. Control plane validates & creates run record
3. Control plane spawns a Docker container
4. Runner executes the Python function in isolation
5. Results stored in run record
6. User polls /runs/:id for status
```

### 3. Actions

Users mark functions with `@app.action`:

```python
from runit import app

@app.action
def greet(name: str) -> dict:
    return {"message": f"Hello, {name}!"}
```

The runner discovers actions via the `_runit_action` attribute. If no actions are marked, it falls back to auto-detecting all public functions.

### 4. Secrets

Secrets are encrypted with **envelope encryption**:

```
1. Generate random Data Encryption Key (DEK)
2. Encrypt secret with DEK (AES-256-GCM)
3. Encrypt DEK with Master Key (LocalKMS or AWS KMS)
4. Store: encrypted_dek + encrypted_secret
```

At runtime, secrets are decrypted and injected as environment variables.

### 5. Share Links

Share links provide **public access** to specific endpoints without authentication:
- Rate-limited separately from authenticated users
- Scoped to specific endpoints

## createApp() Factory

The control plane exports a `createApp()` factory that cloud deployments can extend:

```typescript
import { createApp } from '@buildingopen/control-plane';

// OSS mode (default)
const app = createApp();

// Cloud mode (extend with custom auth, routes, features)
const app = createApp({
  authMiddleware: supabaseAuth,
  extraRoutes: [{ path: '/billing', router: billingRoutes }],
  features: { mode: 'cloud', billing: true, quotas: true },
});
```

## Code Patterns

### Route Handlers

Routes follow Hono patterns:

```typescript
import { Hono } from 'hono';
import { getAuthContext } from '../middleware/auth';

const app = new Hono();

app.get('/', async (c) => {
  const auth = getAuthContext(c);
  const data = await store.list(auth.user?.id);
  return c.json({ data });
});

export default app;
```

### Database Stores

Database operations are encapsulated in store modules. Each store uses SQLite by default. When `SUPABASE_URL` is configured (cloud mode), stores use Supabase PostgreSQL instead.

## Testing

```bash
npm test                                      # All tests
npm test --workspace=services/control-plane   # Control plane only
npm run test:e2e --workspace=apps/web         # E2E tests
```

## Self-Hosting

```bash
git clone https://github.com/buildingopen/runit
cd runit
docker-compose up --build
```

Required env: `MASTER_ENCRYPTION_KEY` (generate with `openssl rand -base64 32`).

Optional: `API_KEY`, `COMPUTE_BACKEND=docker`, `RUNNER_IMAGE`, `RUNNER_MEMORY`, `RUNNER_CPUS`.
