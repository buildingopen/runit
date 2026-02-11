# Architecture Guide

> A guide for developers new to the Runtime AI codebase.

## Overview

Runtime AI is a serverless platform for deploying Python APIs. Users upload FastAPI apps and get live endpoints instantly.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Request                                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                            │
│  • Project dashboard                                                 │
│  • Auto-generated forms from OpenAPI                                 │
│  • Run history viewer                                                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                services/control-plane (Hono.js)                      │
│  • REST API for projects, runs, secrets                              │
│  • Authentication (Supabase JWT)                                     │
│  • Rate limiting, quotas, circuit breakers                           │
└─────────────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
┌──────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   Supabase (DB)      │ │  Modal (Exec)   │ │   Redis (Cache)     │
│  • Projects          │ │  • Run user     │ │  • Rate limits      │
│  • Runs              │ │    code in      │ │  • Session data     │
│  • Secrets (enc)     │ │    containers   │ │                     │
└──────────────────────┘ └─────────────────┘ └─────────────────────┘
```

## Directory Structure

```
runtime-ai/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── app/                # App router pages
│       ├── components/         # React components
│       └── lib/                # Client utilities
│
├── packages/
│   ├── shared/                 # TypeScript types & contracts
│   │   └── src/contracts/      # API request/response types
│   ├── openapi-form/           # Generate forms from OpenAPI specs
│   ├── ui/                     # Shared React components
│   └── sdk/                    # Python SDK for user apps
│
├── services/
│   ├── control-plane/          # Hono.js API server
│   │   └── src/
│   │       ├── routes/         # API route handlers
│   │       ├── middleware/     # Auth, rate-limit, etc.
│   │       ├── db/             # Database stores
│   │       ├── lib/            # Utilities
│   │       └── encryption/     # KMS & secrets encryption
│   │
│   └── runner/                 # Modal execution runtime
│       ├── src/
│       │   └── modal_app.py    # Modal function definitions
│       └── sdk/                # Python SDK
│
└── docs/                       # Documentation
```

## Key Concepts

### 1. Projects

A **project** is a user-uploaded FastAPI app. It contains:
- Source code (from ZIP upload or GitHub)
- Versions (each upload creates a new version)
- Endpoints (extracted from OpenAPI spec)
- Secrets (encrypted environment variables)

### 2. Runs

A **run** is a single execution of an endpoint. The flow:

```
1. User submits request to /runs
2. Control plane validates & creates run record
3. Control plane calls Modal to execute user code
4. Modal runs the FastAPI endpoint in a container
5. Results stored in run record
6. User polls /runs/:id for status
```

### 3. Secrets

Secrets are encrypted with **envelope encryption**:

```
1. Generate random Data Encryption Key (DEK)
2. Encrypt secret with DEK (AES-256-GCM)
3. Encrypt DEK with Master Key (KMS)
4. Store: encrypted_dek + encrypted_secret
```

At runtime, secrets are decrypted and injected as environment variables.

### 4. Share Links

Share links provide **public access** to specific endpoints without authentication:
- Rate-limited separately from authenticated users
- Time-limited (optional expiry)
- Scoped to specific endpoints

## Code Patterns

### Route Handlers

Routes follow this pattern:

```typescript
// services/control-plane/src/routes/example.ts
import { Hono } from 'hono';
import { getAuthUser } from '../middleware/auth';
import { exampleStore } from '../db/example-store';

const app = new Hono();

// GET /examples
app.get('/', async (c) => {
  const user = getAuthUser(c);  // Throws if not authenticated
  const examples = await exampleStore.list(user.id);
  return c.json({ examples });
});

// POST /examples
app.post('/', async (c) => {
  const user = getAuthUser(c);
  const body = await c.req.json();

  // Validate input
  if (!body.name) {
    return c.json({ error: 'Name required' }, 400);
  }

  const example = await exampleStore.create(user.id, body);
  return c.json(example, 201);
});

export default app;
```

### Database Stores

Database operations are encapsulated in store modules:

```typescript
// services/control-plane/src/db/example-store.ts
import { getSupabaseClient } from './supabase';

export const exampleStore = {
  async list(userId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('examples')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  },

  async create(userId: string, input: CreateExampleInput) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('examples')
      .insert({ user_id: userId, ...input })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
```

### Middleware

Middleware follows Hono patterns:

```typescript
// services/control-plane/src/middleware/example.ts
import type { Context, Next } from 'hono';

export async function exampleMiddleware(c: Context, next: Next) {
  // Before request
  const start = Date.now();

  await next();

  // After request
  const duration = Date.now() - start;
  console.log(`Request took ${duration}ms`);
}
```

## Error Handling

Errors are categorized by the error taxonomy:

```typescript
// services/control-plane/src/lib/errors/taxonomy.ts
export enum ErrorCategory {
  USER_CODE_ERROR = 'user_code_error',      // Bug in user's FastAPI code
  MODAL_EXECUTION_ERROR = 'modal_error',    // Modal infrastructure issue
  VALIDATION_ERROR = 'validation_error',    // Bad input from client
  AUTH_ERROR = 'auth_error',                // Authentication failure
  QUOTA_ERROR = 'quota_error',              // Rate/quota limit hit
}
```

Use the classifier to categorize errors:

```typescript
import { classifyError } from '../lib/errors/classifier';

try {
  await riskyOperation();
} catch (error) {
  const classified = classifyError(error);
  // classified.category, classified.message, classified.retryable
}
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=services/control-plane

# Run with coverage
npm test -- --coverage
```

### E2E Tests

```bash
# Run Playwright tests
npm run test:e2e --workspace=apps/web
```

### Test Patterns

```typescript
// services/control-plane/src/middleware/__tests__/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { exampleMiddleware } from '../example';

describe('Example Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('/*', exampleMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));
  });

  it('should allow requests through', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});
```

## Development Workflow

### 1. Setup

```bash
git clone https://github.com/federicodeponte/runtime-ai.git
cd runtime-ai
npm install
cp .env.example .env  # Edit with your credentials
```

### 2. Run Locally

```bash
# Terminal 1: Web UI
cd apps/web && npm run dev

# Terminal 2: Control Plane
cd services/control-plane && npm run dev

# Terminal 3 (optional): Modal Runtime
cd services/runner && modal serve src/modal_app.py
```

### 3. Make Changes

1. Create a feature branch
2. Make changes
3. Run tests: `npm test`
4. Run build: `npm run build`
5. Submit PR

### 4. Debug Tips

- Check `/health/deep` for service status
- Check `/metrics` for Prometheus metrics
- Look at circuit breaker state in health response
- Use `DEBUG=*` env var for verbose logging

## Security Considerations

### Authentication

- All API routes require Supabase JWT (except `/health`, `/share/:id`)
- JWTs validated on every request via `authMiddleware`
- Never bypass auth in production (DEV_MODE is dev-only)

### Secrets

- Never log secret values
- Secrets encrypted at rest with AES-256-GCM
- Master key from KMS (or env var in dev)
- Audit log for all secret operations

### Input Validation

- All inputs validated with Zod schemas
- ZIP files validated for size, magic bytes, compression ratio
- Path traversal protection in file operations

### Rate Limiting

- 120 req/min authenticated, 60 req/min anonymous
- Redis-backed with fallback to in-memory
- Per-user quotas for run execution

## Deployment

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `MODAL_TOKEN_ID` | Yes | Modal API token ID |
| `MODAL_TOKEN_SECRET` | Yes | Modal API token secret |
| `MASTER_ENCRYPTION_KEY` | Yes | 32-byte base64 key |
| `SENTRY_DSN` | Prod | Sentry DSN for errors |
| `REDIS_URL` | No | Redis URL for rate limiting |
| `CORS_ORIGINS` | Prod | Allowed CORS origins |

### Docker

```bash
docker build -t runtime-ai-control-plane services/control-plane
docker run -p 3001:3001 --env-file .env runtime-ai-control-plane
```

## FAQ

**Q: Where do I add a new API endpoint?**
A: Create or edit a file in `services/control-plane/src/routes/`, then mount it in `main.ts`.

**Q: How do I add a new database table?**
A: Add the migration in Supabase dashboard, create a store file in `db/`, and add types to `packages/shared`.

**Q: How do I debug Modal execution?**
A: Check Modal dashboard for logs. Locally, use `modal serve` with `--tail` flag.

**Q: How do I add a new secret type?**
A: Secrets are generic key-value. Just call the secrets API with any key name.

**Q: Why is my request rate-limited?**
A: Check the `X-RateLimit-*` headers in the response. Authenticated users get 120 req/min.
