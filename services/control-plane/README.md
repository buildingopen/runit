# Control Plane

Hono-based API backend for Runtime AI.

## Features

- Project and endpoint management
- Secrets encryption with AES-256-GCM
- Artifact storage (S3)
- Context source management
- Cost monitoring and rate limiting

## Tech Stack

- [Hono](https://hono.dev) — Web framework
- [Supabase](https://supabase.com) — Database and auth
- [AWS KMS](https://aws.amazon.com/kms/) — Key management
- [AWS S3](https://aws.amazon.com/s3/) — Artifact storage

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
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
AWS_S3_BUCKET=...
AWS_KMS_KEY_ID=...
MASTER_ENCRYPTION_KEY=...
```

## API Routes

- `POST /projects` — Create project from ZIP upload
- `GET /projects/:id` — Get project details
- `POST /projects/:id/run` — Execute endpoint
- `GET /projects/:id/runs` — List run history
- `POST /projects/:id/secrets` — Store encrypted secret
- `POST /projects/:id/context` — Add context source

## Architecture

```
src/
├── main.ts           # Entry point
├── routes/           # API route handlers
├── lib/              # Core utilities
│   ├── encryption.ts # Secrets encryption
│   ├── redaction.ts  # Log redaction
│   └── storage.ts    # S3 operations
└── middleware/       # Request middleware
    ├── auth.ts       # Authentication
    ├── quota.ts      # Usage limits
    └── cost-monitor.ts
```
