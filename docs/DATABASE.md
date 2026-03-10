# Database Schema

> Supabase PostgreSQL schema for RunIt

## Overview

RunIt uses **Supabase PostgreSQL** with Row Level Security (RLS) policies. The backend uses a service role key to bypass RLS for operations.

## Entity Relationship Diagram

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
└─────────────┘  │  │ version_hash     │  │            │
                 │  │ openapi (JSONB)  │  │            │
                 │  │ endpoints (JSONB)│  │            │
                 │  └──────────────────┘  │            │
                 │                        │            │
                 │  ┌──────────────────┐  │            │
                 ├─▶│      runs        │◀─┘            │
                 │  ├──────────────────┤               │
                 │  │ id (PK)          │               │
                 │  │ project_id (FK)  │               │
                 │  │ version_id (FK)  │               │
                 │  │ status           │               │
                 │  │ duration_ms      │               │
                 │  │ artifacts (JSONB)│               │
                 │  └──────────────────┘               │
                 │                                      │
                 │  ┌──────────────────┐               │
                 ├─▶│     secrets      │               │
                 │  ├──────────────────┤               │
                 │  │ id (PK)          │               │
                 │  │ project_id (FK)  │               │
                 │  │ key              │               │
                 │  │ encrypted_value  │               │
                 │  └──────────────────┘               │
                 │                                      │
                 │  ┌──────────────────┐               │
                 ├─▶│    contexts      │               │
                 │  ├──────────────────┤               │
                 │  │ id (PK)          │               │
                 │  │ project_id (FK)  │               │
                 │  │ url              │               │
                 │  │ data (JSONB)     │               │
                 │  └──────────────────┘               │
                 │                                      │
                 │  ┌──────────────────┐               │
                 └─▶│   share_links    │               │
                    ├──────────────────┤               │
                    │ id (PK)          │               │
                    │ project_id (FK)  │               │
                    │ target_type      │               │
                    │ enabled          │               │
                    └──────────────────┘               │
```

## Tables

### projects

Core project records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| `owner_id` | TEXT | NOT NULL | User ID from auth |
| `slug` | TEXT | NOT NULL, UNIQUE | URL-friendly name |
| `name` | TEXT | NOT NULL | Display name |
| `status` | TEXT | DEFAULT 'draft' | draft, deploying, live, failed |
| `deployed_at` | TIMESTAMPTZ | NULLABLE | Last deployment time |
| `deploy_error` | TEXT | NULLABLE | Error if failed |
| `runtime_url` | TEXT | NULLABLE | Public endpoint URL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Auto-updated |

**Indexes:** `owner_id`, `slug`, `status`

---

### project_versions

Immutable code snapshots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Version identifier |
| `project_id` | UUID | FK → projects ON DELETE CASCADE | Parent project |
| `version_hash` | TEXT | NOT NULL | SHA hash of code |
| `code_bundle_ref` | TEXT | NOT NULL | Storage reference |
| `openapi` | JSONB | NULLABLE | OpenAPI 3.0 spec |
| `endpoints` | JSONB | DEFAULT [] | Endpoint definitions |
| `deps_hash` | TEXT | NULLABLE | Dependencies hash |
| `entrypoint` | TEXT | NULLABLE | e.g., "main.handler" |
| `status` | TEXT | DEFAULT 'pending' | pending, building, ready, failed |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique:** `(project_id, version_hash)`

---

### runs

Execution records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Run identifier |
| `project_id` | UUID | FK → projects | |
| `version_id` | UUID | FK → project_versions | |
| `endpoint_id` | TEXT | NOT NULL | Endpoint invoked |
| `owner_id` | TEXT | NOT NULL | User who ran |
| `request_body` | JSONB | NULLABLE | Request payload |
| `response_status` | INTEGER | NULLABLE | HTTP status |
| `response_body` | JSONB | NULLABLE | Response payload |
| `status` | TEXT | DEFAULT 'pending' | queued, running, success, error, timeout |
| `duration_ms` | INTEGER | NULLABLE | Execution time |
| `resource_lane` | TEXT | NULLABLE | cpu or gpu |
| `error_class` | TEXT | NULLABLE | Exception type |
| `error_message` | TEXT | NULLABLE | Error details |
| `logs` | TEXT | NULLABLE | Stdout/stderr |
| `artifacts` | JSONB | DEFAULT [] | Generated files |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `expires_at` | TIMESTAMPTZ | DEFAULT NOW() + 30 days | TTL |

**Indexes:** `project_id`, `owner_id`, `status`, `created_at`, `expires_at`

---

### secrets

Encrypted environment variables.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → projects ON DELETE CASCADE | |
| `key` | TEXT | NOT NULL | Env var name |
| `encrypted_value` | TEXT | NOT NULL | AES-256-GCM encrypted |
| `created_by` | TEXT | NOT NULL | Creator user ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique:** `(project_id, key)`

**Security:** Values encrypted client-side before storage. See `encryption/kms.ts`.

---

### contexts

Cached external data for injection.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → projects ON DELETE CASCADE | |
| `name` | TEXT | NULLABLE | User-provided name |
| `url` | TEXT | NOT NULL | Source URL |
| `data` | JSONB | NOT NULL | Parsed content |
| `size_bytes` | INTEGER | NOT NULL | For quota tracking |
| `fetched_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Limits:** 1MB per context, 1MB total per project

---

### share_links

Public sharing URLs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Share link ID |
| `project_id` | UUID | FK → projects ON DELETE CASCADE | |
| `target_type` | TEXT | NOT NULL | endpoint_template or run_result |
| `target_ref` | TEXT | NOT NULL | Endpoint/run ID |
| `enabled` | BOOLEAN | DEFAULT TRUE | Revocation flag |
| `created_by` | TEXT | NOT NULL | Creator |
| `run_count` | INTEGER | DEFAULT 0 | Total invocations |
| `success_count` | INTEGER | DEFAULT 0 | Successful runs |
| `last_run_at` | TIMESTAMPTZ | NULLABLE | Last access |

---

### rate_limits

Request throttling.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `key` | TEXT | NOT NULL, UNIQUE | "api:user:<id>" or "api:ip:<ip>" |
| `count` | INTEGER | DEFAULT 0 | Requests in window |
| `window_start` | TIMESTAMPTZ | DEFAULT NOW() | Window start |
| `window_ms` | INTEGER | DEFAULT 60000 | Window duration |

**Cleanup:** `cleanup_expired_rate_limits()` runs every 5 minutes via pg_cron

---

### usage_quotas

Per-user execution limits.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL | |
| `period` | TEXT | NOT NULL | hourly, daily, monthly |
| `period_start` | TIMESTAMPTZ | NOT NULL | |
| `cpu_run_count` | INTEGER | DEFAULT 0 | CPU runs in period |
| `gpu_run_count` | INTEGER | DEFAULT 0 | GPU runs in period |
| `active_cpu_runs` | INTEGER | DEFAULT 0 | Concurrent CPU |
| `active_gpu_runs` | INTEGER | DEFAULT 0 | Concurrent GPU |

**Unique:** `(user_id, period, period_start)`

## Row Level Security

All tables have RLS enabled:

```sql
-- Users can only access their own data
CREATE POLICY "users_own_data" ON projects
  FOR ALL USING (owner_id = auth.uid());

-- Service role bypasses RLS for backend operations
```

## Migrations

Location: `/supabase/migrations/`

| Migration | Description |
|-----------|-------------|
| `20260202000000_initial_schema.sql` | Core tables |
| `20260202010000_fix_rls_policies.sql` | RLS fixes |
| `20260203000000_rate_limits_and_quotas.sql` | Rate limiting |

## Store Implementations

| File | Tables |
|------|--------|
| `db/projects-store.ts` | projects, project_versions |
| `db/runs-store.ts` | runs |
| `db/secrets-store.ts` | secrets |
| `db/contexts-store.ts` | contexts |
| `db/share-links-store.ts` | share_links |

## Development Mode

When `SUPABASE_URL` is not configured, stores use in-memory implementations for local development. Data is lost on restart.

## Data Retention

- **Runs:** Auto-expire after 30 days
- **Rate limits:** Cleaned every 5 minutes
- **Quotas:** Reset on period boundaries

## Common Queries

```sql
-- Get user's projects with latest version
SELECT p.*, pv.id as version_id, pv.endpoints
FROM projects p
LEFT JOIN project_versions pv ON pv.project_id = p.id
WHERE p.owner_id = $1
ORDER BY p.created_at DESC, pv.created_at DESC;

-- Get run with artifacts
SELECT r.*, pv.endpoints
FROM runs r
JOIN project_versions pv ON r.version_id = pv.id
WHERE r.id = $1;

-- Check rate limit
SELECT count, window_start
FROM rate_limits
WHERE key = $1
  AND window_start > NOW() - (window_ms || ' milliseconds')::interval;
```
