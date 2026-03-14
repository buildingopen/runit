# Database

> Storage layer for RunIt

## Overview

RunIt uses **SQLite** for self-hosted deployments. Data is stored in a local file with zero external dependencies.

For cloud deployments, the same store interfaces connect to Supabase PostgreSQL instead.

## Data Model

```
┌─────────────┐
│  projects   │
├─────────────┤
│ id (PK)     │──┬──────────────────────────────────────┐
│ owner_id    │  │                                      │
│ slug        │  │  ┌──────────────────┐               │
│ name        │  ├─▶│ project_versions │               │
│ status      │  │  ├──────────────────┤               │
│ deployed_at │  │  │ id (PK)          │──┐            │
│ runtime_url │  │  │ project_id (FK)  │  │            │
│             │  │  │ version_hash     │  │            │
│             │  │  │ openapi (JSON)   │  │            │
│             │  │  │ endpoints (JSON) │  │            │
│             │  │  └──────────────────┘  │            │
│             │  │                        │            │
│             │  │  ┌──────────────────┐  │            │
│             │  ├─▶│      runs        │◀─┘            │
│             │  │  ├──────────────────┤               │
│             │  │  │ id (PK)          │               │
│             │  │  │ project_id (FK)  │               │
│             │  │  │ version_id (FK)  │               │
│             │  │  │ status           │               │
│             │  │  │ duration_ms      │               │
│             │  │  └──────────────────┘               │
│             │  │                                      │
│             │  │  ┌──────────────────┐               │
│             │  ├─▶│     secrets      │               │
│             │  │  ├──────────────────┤               │
│             │  │  │ id (PK)          │               │
│             │  │  │ project_id (FK)  │               │
│             │  │  │ key              │               │
│             │  │  │ encrypted_value  │               │
│             │  │  └──────────────────┘               │
│             │  │                                      │
│             │  │  ┌──────────────────┐               │
│             │  └─▶│   share_links    │               │
│             │     ├──────────────────┤               │
│             │     │ id (PK)          │               │
│             │     │ project_id (FK)  │               │
│             │     │ target_type      │               │
│             │     │ enabled          │               │
│             │     └──────────────────┘               │
└─────────────┘
```

## Store Pattern

Database operations are encapsulated in store modules under `services/control-plane/src/db/`. Each store checks `isSupabaseConfigured()` at runtime:

- If **Supabase is configured** (cloud mode): uses PostgreSQL via Supabase client
- If **not configured** (self-hosted): uses SQLite via `better-sqlite3`

This means the same code runs in both modes with zero configuration for self-hosted users.

## Store Files

| File | Purpose |
|------|---------|
| `db/projects-store.ts` | Project CRUD, versions |
| `db/runs-store.ts` | Run records, status updates |
| `db/secrets-store.ts` | Encrypted secrets |
| `db/share-links-store.ts` | Public share links |
| `db/contexts-store.ts` | Context data |

## Self-Hosted (SQLite)

SQLite is the default. The database file is created automatically on first run. No setup required.

```bash
# Data persists at:
# ./data/runit.db (or SQLITE_PATH env var)
```

## Cloud Mode (Supabase)

Cloud deployments use Supabase PostgreSQL with Row Level Security. Cloud-specific migrations and RLS policies are maintained separately.

Required env vars for cloud mode:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
