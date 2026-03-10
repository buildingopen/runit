# Control Plane

Hono-based API backend for RunIt.

## Features

- Project and endpoint management
- Secrets encryption with AES-256-GCM (envelope encryption)
- Context source management
- Share link generation
- `createApp()` factory for extensibility

## Tech Stack

- [Hono](https://hono.dev) - Web framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Database (self-hosted)
- Node.js crypto - Local key management

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Environment Variables

```bash
PORT=3001
MASTER_ENCRYPTION_KEY=          # Required: openssl rand -base64 32
API_KEY=                        # Optional: protect API access
COMPUTE_BACKEND=docker          # Default: docker
RUNNER_IMAGE=runit-runner       # Docker image for sandbox
RUNNER_MEMORY=512m              # Container memory limit
RUNNER_CPUS=1                   # Container CPU limit
```

## API Routes

- `POST /projects` - Create project from ZIP upload
- `GET /projects/:id` - Get project details
- `POST /projects/:id/run` - Execute endpoint
- `GET /projects/:id/runs` - List run history
- `POST /projects/:id/secrets` - Store encrypted secret
- `POST /projects/:id/context` - Add context source

## Architecture

```
src/
├── app.ts            # createApp() factory (importable by cloud-plane)
├── main.ts           # Server entrypoint
├── index.ts          # Library exports
├── routes/           # API route handlers
├── db/               # Database stores (SQLite / Supabase)
├── lib/              # Core utilities
│   ├── compute/      # Docker sandbox management
│   └── encryption/   # Envelope encryption (LocalKMS)
└── middleware/       # Request middleware
    └── auth.ts       # API key authentication
```

## Extensibility

The control plane exports `createApp()` for cloud deployments to extend:

```typescript
import { createApp } from '@runit/control-plane';

const app = createApp({
  authMiddleware: customAuth,
  extraRoutes: [{ path: '/billing', router: billingRoutes }],
  features: { mode: 'cloud', billing: true },
});
```

See the `runit-cloud` repo for a complete cloud implementation.
