# Execution Layer - Open Source Roadmap

> **Goal:** Make this project fully functional and ready for public open source release.
>
> **Total Estimated Effort:** 55-70 hours
>
> **Last Updated:** 2025-02-06

---

## Current State Assessment

| Component | Completeness | Notes |
|-----------|--------------|-------|
| Web UI | ~80% | Pages exist, some wiring incomplete |
| Control Plane API | ~60% | Routes exist, Modal integration stubbed |
| Runner/Executor | ~70% | Execution logic exists, Modal functions missing |
| SDK | ~90% | Core functionality works |
| Modal Integration | **0%** | Critical blocker - functions don't exist |
| E2E Tests | **0%** | Golden path test is 100% mocked |
| Documentation | ~70% | Some false claims, setup incomplete |

### False Claims to Fix

| Claimed Feature | Reality | Action |
|-----------------|---------|--------|
| Cost Monitoring | Not implemented | Remove from features list |
| GPU Detection | Test skipped, not working | Implement or remove claim |
| Share Links | Backend only, no UI | Complete UI or document as API-only |
| Automatic OpenAPI | Requires bridge service | Document prerequisite |

---

## Phase 1: Core Functionality

*Make claimed features actually work.*

**Total: 20-25 hours**

### 1.1 Modal App Functions (CRITICAL BLOCKER)

**Priority:** P0 - Everything depends on this
**Effort:** 4-5 hours
**Dependencies:** None

**Files:**
- `services/runner/src/modal_app.py` (currently skeleton)

**What exists:** Empty Modal app structure
**What's missing:** Actual execution functions

**Tasks:**
- [ ] Create `run_endpoint_cpu(payload)` Modal function
- [ ] Create `run_endpoint_gpu(payload)` Modal function
- [ ] Each function must:
  - Accept `RunEndpointRequest` payload
  - Extract ZIP bundle from `payload.code_bundle` (base64 → bytes)
  - Install dependencies via `pip install -r requirements.txt`
  - Import FastAPI app from entrypoint (e.g., `main:app`)
  - Execute endpoint using `httpx.AsyncClient` with `ASGITransport`
  - Collect artifacts from `/artifacts/` directory
  - Return `RunEndpointResponse` with status, body, artifacts
- [ ] Configure Modal image with Python 3.11 + common deps
- [ ] Configure volume mounts: `/workspace`, `/artifacts`, `/context`
- [ ] Test deployment: `modal deploy services/runner/src/modal_app.py`

**Acceptance Criteria:**
- `modal deploy` succeeds
- Manual test: call function with sample payload, get response
- Control plane can invoke functions via `modal-client.ts`

---

### 1.2 OpenAPI Bridge Service

**Priority:** P0 - Blocks endpoint detection and form generation
**Effort:** 3-4 hours
**Dependencies:** None (can parallel with 1.1)

**Files:**
- `services/control-plane/src/lib/openapi/bridge.py` (skeleton)

**What exists:** Empty Python file
**What's missing:** FastAPI endpoint extraction logic

**Tasks:**
- [ ] Create Flask/FastAPI server with routes:
  - `POST /extract` - takes ZIP path, returns OpenAPI schema
  - `GET /health` - health check
- [ ] Extraction logic:
  - Unzip to temp directory
  - Find `main.py` or configured entrypoint
  - Dynamically import FastAPI app
  - Call `app.openapi()` to get schema
  - Return as JSON
- [ ] Error handling:
  - Non-FastAPI apps → helpful error message
  - Missing main.py → suggest correct structure
  - Syntax errors → return line number
  - Import errors → list missing packages
- [ ] Add startup script or document how to run

**Acceptance Criteria:**
- Bridge starts: `python services/control-plane/src/lib/openapi/bridge.py`
- Extract from sample: `services/runner/samples/extract-company/`
- Returns valid OpenAPI 3.0 schema
- Skipped tests pass: `npm run test -- openapi/extractor.test.ts`

---

### 1.3 OpenAPI Integration in Control Plane

**Priority:** P0
**Effort:** 2-3 hours
**Dependencies:** 1.2 (bridge must exist)

**Files:**
- `services/control-plane/src/routes/projects.ts` (lines 140-180)
- `services/control-plane/src/openapi-extractor.ts`

**What exists:** Route calls `extractOpenAPIFromZip` which is stubbed
**What's missing:** Actual bridge integration

**Tasks:**
- [ ] After ZIP upload in `projects.ts`:
  - Save ZIP to temp location
  - Call bridge at `http://localhost:5555/extract`
  - Parse response as OpenAPI schema
  - Store in `ProjectVersion.openapi_schema`
  - Extract endpoints array from schema paths
  - Store in `ProjectVersion.endpoints`
- [ ] If bridge fails:
  - Return clear error to user (not silent 201)
  - Don't create version as "live"
- [ ] Validate schema is valid OpenAPI 3.0

**Acceptance Criteria:**
- ZIP upload → endpoints visible in API response
- `GET /projects/:id/endpoints` returns extracted endpoints
- Web UI can fetch and display endpoints

---

### 1.4 Artifact Storage

**Priority:** P1
**Effort:** 2-3 hours
**Dependencies:** 1.1 (Modal must execute)

**Files:**
- `services/runner/src/artifacts/collector.py` (exists, incomplete)
- `services/runner/src/artifacts/storage.py` (exists, incomplete)
- `services/control-plane/src/routes/artifacts.ts` (may need creation)

**What exists:** Skeleton collector
**What's missing:** S3 upload, signed URLs, local fallback

**Tasks:**
- [ ] In Modal execution (after endpoint runs):
  - List files in `/artifacts/` directory
  - For each file: size, MIME type, content preview
  - Upload to S3 (production) or store in DB (dev)
  - Generate signed download URLs (S3) or serve URLs (local)
  - Return in response as `artifacts[]`
- [ ] Local development mode:
  - Store artifact bytes in database
  - Serve from `GET /artifacts/:run_id/:filename`
- [ ] Production mode:
  - Upload to S3 bucket
  - Generate pre-signed URLs (1 hour expiry)

**Acceptance Criteria:**
- Run returns `result.artifacts` with working `download_url`
- Clicking URL downloads the file
- Works in both local (DB) and production (S3) modes

---

### 1.5 Context & Secrets Injection

**Priority:** P1
**Effort:** 2-3 hours
**Dependencies:** 1.1 (Modal must execute)

**Files:**
- `services/runner/src/context/mounter.py` (exists, untested)
- `services/runner/src/secrets/injector.py` (exists, untested)

**What exists:** Code structure
**What's missing:** Integration with Modal execution

**Tasks:**
- [ ] Context mounting in Modal:
  - Receive `context_ref` in payload
  - Download context JSON from control plane
  - Write to `/context/{name}.json`
  - SDK reads via `context.get_context("name")`
- [ ] Secrets injection in Modal:
  - Receive `secrets_ref` (encrypted bundle)
  - Decrypt using AWS KMS (or local key in dev)
  - Inject as env vars: `SECRET_*`
  - SDK reads via `context.get_secret("KEY")`
- [ ] Add integration tests

**Acceptance Criteria:**
- SDK `get_context()` returns uploaded JSON
- SDK `get_secret()` returns decrypted value
- Sample app can use both features

---

### 1.6 Web UI Form Wiring

**Priority:** P1
**Effort:** 2-3 hours
**Dependencies:** 1.3 (OpenAPI must be extracted)

**Files:**
- `apps/web/app/p/[project_id]/page.tsx`
- `packages/openapi-form/src/` (component exists)

**What exists:** OpenAPIForm component, Run page structure
**What's missing:** Full integration

**Tasks:**
- [ ] On Run page load:
  - Fetch project endpoints from API
  - Fetch OpenAPI schema for selected endpoint
  - Pass schema to `<OpenAPIForm />` component
- [ ] Form generates fields from schema:
  - String → text input
  - Number → number input
  - Boolean → toggle
  - Object → nested fields
  - Array → repeatable section
- [ ] Form submission:
  - Collect form data as JSON
  - Call `POST /runs` with request body
  - Poll `GET /runs/:id` for status
  - Show result JSON + artifacts when complete
- [ ] Loading, error, empty states

**Acceptance Criteria:**
- Form fields appear for all schema properties
- Validation matches OpenAPI requirements
- Submit → see JSON result and downloadable artifacts

---

### 1.7 Database Persistence

**Priority:** P2 (works with in-memory for dev)
**Effort:** 3-4 hours
**Dependencies:** None (parallel)

**Files:**
- `services/control-plane/src/db/` (stores exist, use in-memory)
- `supabase/migrations/` (may need creation)

**What exists:** In-memory stores as fallback
**What's missing:** Supabase schema, real persistence

**Tasks:**
- [ ] Create Supabase migration SQL:
  ```sql
  -- projects table
  CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- project_versions table
  CREATE TABLE project_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version_hash TEXT NOT NULL,
    openapi_schema JSONB,
    endpoints JSONB,
    entrypoint TEXT DEFAULT 'main:app',
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- runs table
  CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    version_id UUID REFERENCES project_versions(id),
    endpoint_id TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    request_body JSONB,
    response_body JSONB,
    artifacts JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
  );

  -- secrets table (encrypted values)
  CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name)
  );

  -- contexts table
  CREATE TABLE contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name)
  );
  ```
- [ ] Update stores to use Supabase when configured
- [ ] Keep in-memory fallback for local dev without DB
- [ ] Add RLS policies for multi-tenant security

**Acceptance Criteria:**
- Schema exists in Supabase
- Data persists across server restarts
- RLS prevents cross-user access

---

## Phase 2: Testing

*Prove it actually works with real tests.*

**Total: 10-13 hours**

### 2.1 Real E2E Golden Path Test

**Priority:** P0 - This is the proof it works
**Effort:** 3-4 hours
**Dependencies:** All of Phase 1

**Files:**
- `tests/e2e/golden-path.spec.ts` (currently 100% mocked)

**Current state:** All test steps are commented out, uses mocks

**Tasks:**
- [ ] Remove all mocks - test against real services
- [ ] Test flow:
  1. Upload real ZIP (use `services/runner/samples/extract-company/`)
  2. Verify endpoints extracted
  3. Navigate to run page
  4. Verify form fields generated
  5. Fill form with test data
  6. Click Run
  7. Wait for completion
  8. Verify JSON result
  9. Verify artifact download works
- [ ] Run against test environment (real Modal, real Supabase)
- [ ] Add to CI pipeline (runs on main branch)

**Acceptance Criteria:**
- Test passes with zero mocks
- Runs in CI
- Catches regressions in core flow

---

### 2.2 Feature Integration Tests

**Priority:** P1
**Effort:** 5-6 hours
**Dependencies:** Phase 1

**Files to create:**
- `services/control-plane/tests/integration/projects.test.ts`
- `services/control-plane/tests/integration/runs.test.ts`
- `services/control-plane/tests/integration/artifacts.test.ts`
- `services/runner/tests/integration/test_execution.py`

**Tasks:**
- [ ] Project creation tests:
  - ZIP upload → endpoints extracted
  - GitHub import → repo cloned, endpoints extracted
  - Invalid ZIP → clear error
  - Non-FastAPI app → helpful error message
- [ ] Run execution tests:
  - Simple endpoint → JSON response
  - Endpoint with artifacts → files downloadable
  - Timeout → proper error
  - Runtime error → error message with stack trace
- [ ] Artifact tests:
  - Small file → immediate download
  - Large file (10MB) → works
  - Multiple files → all accessible
- [ ] Error case tests:
  - Missing secrets → clear error
  - Invalid context → clear error
  - Modal timeout → graceful handling

**Acceptance Criteria:**
- Each feature has positive and negative test cases
- Tests run in CI
- Coverage > 70% for critical paths

---

### 2.3 SDK Integration Tests

**Priority:** P1
**Effort:** 2-3 hours
**Dependencies:** 1.5 (context/secrets)

**Files:**
- `services/runner/sdk/tests/test_context.py`
- `services/runner/sdk/tests/test_artifacts.py`
- `services/runner/sdk/tests/test_secrets.py`

**Tasks:**
- [ ] Test `save_artifact()`:
  - JSON file → saved and downloadable
  - Binary file → saved correctly
  - Large file → handles gracefully
- [ ] Test `save_dataframe()`:
  - Pandas DataFrame → CSV/Parquet
  - Polars DataFrame → CSV/Parquet
- [ ] Test `get_context()`:
  - Mounted JSON → readable
  - Missing context → clear error
- [ ] Test `get_secret()`:
  - Injected secret → correct value
  - Missing secret → clear error

**Acceptance Criteria:**
- All SDK functions tested in real Modal environment
- Tests pass in CI

---

### 2.4 Unskip OpenAPI Extractor Tests

**Priority:** P1
**Effort:** 1-2 hours
**Dependencies:** 1.2 (bridge)

**Files:**
- `services/control-plane/tests/openapi/extractor.test.ts`

**Currently skipped tests (lines 168-253):**
- `should extract OpenAPI from simple_app.py`
- `should handle no_app.py`
- `should handle broken_import.py`
- `should handle custom_entrypoint.py`
- `should detect GPU requirement from endpoint description`

**Tasks:**
- [ ] Start bridge service in test setup
- [ ] Create test fixture apps in `tests/fixtures/`:
  - `simple_app.py` - basic FastAPI
  - `no_app.py` - Python file without FastAPI
  - `broken_import.py` - has import error
  - `custom_entrypoint.py` - app not in main.py
  - `gpu_app.py` - has GPU requirement annotation
- [ ] Unskip tests and verify they pass

**Acceptance Criteria:**
- All 5 tests pass
- No `.skip()` in extractor tests

---

## Phase 3: Documentation

*Make docs match reality.*

**Total: 8-11 hours**

### 3.1 Fix README.md

**Priority:** P0
**Effort:** 2 hours
**Dependencies:** Phase 1 done

**Tasks:**
- [ ] Remove "Cost Monitoring" from features (not implemented)
- [ ] Update Quick Start to be accurate:
  ```markdown
  ## Prerequisites
  - Node.js 20+
  - Python 3.11+
  - Modal account (get token at modal.com)
  - Supabase project (or use local mode)

  ## Setup
  1. Clone: `git clone https://github.com/[ORG]/execution-layer.git`
  2. Install: `npm install`
  3. Configure: `cp .env.example .env` and fill in values
  4. Start bridge: `python services/control-plane/src/lib/openapi/bridge.py`
  5. Deploy Modal: `modal deploy services/runner/src/modal_app.py`
  6. Start dev: `npm run dev`
  ```
- [ ] Add "Known Limitations" section
- [ ] Update architecture diagram if needed
- [ ] Replace `your-org` placeholder with actual org

---

### 3.2 Fix DEVELOPMENT_SETUP.md

**Priority:** P0
**Effort:** 2 hours
**Dependencies:** Phase 1 done

**Tasks:**
- [ ] Document bridge service:
  - What it is
  - How to start it
  - How to verify it's working
- [ ] Document Modal setup:
  - Getting credentials
  - Deploying functions
  - Testing locally without Modal (if possible)
- [ ] Document database setup:
  - Supabase project creation
  - Running migrations
  - Local mode without database
- [ ] Add troubleshooting section

---

### 3.3 Complete SDK_GUIDE.md

**Priority:** P1
**Effort:** 3 hours
**Dependencies:** Phase 1 done

**Tasks:**
- [ ] Add "Setting Up Secrets" section:
  - How to add secret via web UI
  - How encryption works
  - How SDK retrieves them
- [ ] Add "Uploading Context" section:
  - Preparing JSON files
  - Size limits
  - Example usage
- [ ] Add "Testing Locally" section:
  - Setting `EL_CONTEXT_DIR`
  - Setting `SECRET_*` env vars
  - Running FastAPI app locally
- [ ] Verify all code examples work
- [ ] Add troubleshooting for common errors

---

### 3.4 Create API.md

**Priority:** P1
**Effort:** 3-4 hours
**Dependencies:** Phase 1 done

**File:** `docs/API.md`

**Tasks:**
- [ ] Document all endpoints:
  - `POST /projects` - Create project
  - `GET /projects` - List projects
  - `GET /projects/:id` - Get project
  - `DELETE /projects/:id` - Delete project
  - `GET /projects/:id/endpoints` - List endpoints
  - `POST /runs` - Create run
  - `GET /runs/:id` - Get run status
  - `POST /projects/:id/secrets` - Store secret
  - `DELETE /projects/:id/secrets/:name` - Delete secret
  - `POST /projects/:id/contexts` - Upload context
  - `GET /projects/:id/contexts` - List contexts
  - `POST /projects/:id/share` - Create share link
  - `GET /share/:id` - Get share link data
- [ ] Request/response examples for each
- [ ] Error codes and meanings
- [ ] Authentication (JWT via Supabase)
- [ ] Rate limits

---

### 3.5 Update CHANGELOG.md

**Priority:** P2
**Effort:** 0.5 hours

**Tasks:**
- [ ] Change date from `2024-01-XX` to actual release date
- [ ] Remove "Cost Monitoring" from features
- [ ] Ensure listed features match reality

---

## Phase 4: Production Readiness

*Deploy safely and reliably.*

**Total: 10-14 hours**

### 4.1 Deployment Verification

**Priority:** P1
**Effort:** 4-6 hours
**Dependencies:** Phase 1 + 2

**Tasks:**
- [ ] Verify `render.yaml` deploys correctly:
  - Control plane service
  - Web app service
  - Environment variables set
- [ ] Verify Modal functions deployed and callable
- [ ] Verify Supabase migrations run on boot
- [ ] Create deployment checklist document
- [ ] Test full flow in production environment

---

### 4.2 Security Hardening

**Priority:** P1
**Effort:** 3-4 hours
**Dependencies:** Phase 1

**Tasks:**
- [ ] Audit secret redaction:
  - Verify `redaction.ts` catches all SECRET_* patterns
  - Test secrets don't appear in logs
  - Test secrets don't appear in error messages
- [ ] Verify CORS configuration:
  - Only allow production origins
  - No wildcard in production
- [ ] Verify rate limiting:
  - 120 req/min authenticated
  - 60 req/min anonymous
  - Test limits are enforced
- [ ] Verify security headers:
  - CSP, X-Frame-Options, etc.
  - Test with security scanner
- [ ] Remove DEV_MODE from production builds
- [ ] Document security model

---

### 4.3 Monitoring & Observability

**Priority:** P2
**Effort:** 3-4 hours
**Dependencies:** 4.1

**Tasks:**
- [ ] Verify Sentry captures errors:
  - Test error in control plane → appears in Sentry
  - Test error in Modal → appears in Sentry
- [ ] Add key metrics:
  - Run execution time (p50, p95, p99)
  - Run success/failure rate
  - API response times
- [ ] Create basic dashboard
- [ ] Set up alerts for:
  - Error rate > 5%
  - P95 latency > 30s
  - Modal function failures

---

## Task Dependencies

```
Phase 1 (parallel tracks):
├── Track A: Execution
│   └── 1.1 Modal App ──────┬──→ 1.4 Context/Secrets
│                           └──→ 1.5 Artifacts
│
├── Track B: OpenAPI
│   └── 1.2 Bridge ────────────→ 1.3 Integration ────→ 1.6 Form Wiring
│
└── Track C: Database
    └── 1.7 Supabase (parallel, optional for dev)

Phase 2 (sequential):
└── ALL Phase 1 ──→ 2.1 Golden Path E2E ──→ 2.2 Feature Tests
                                          └──→ 2.3 SDK Tests
                                          └──→ 2.4 Unskip Tests

Phase 3 (after Phase 1):
└── Phase 1 done ──→ 3.1 README
                 ──→ 3.2 Dev Setup
                 ──→ 3.3 SDK Guide
                 ──→ 3.4 API Docs

Phase 4 (after Phase 2):
└── Phase 2 done ──→ 4.1 Deploy ──→ 4.2 Security
                              └──→ 4.3 Monitoring
```

---

## Quick Reference: Hours by Phase

| Phase | Hours | Description |
|-------|-------|-------------|
| 1 | 20-25 | Core functionality |
| 2 | 10-13 | Testing |
| 3 | 8-11 | Documentation |
| 4 | 10-14 | Production |
| **Total** | **48-63** | |

---

## Minimum Viable Path

**If you only have 15-20 hours, do:**

1. **1.1 Modal App** (4-5h) - Execute code
2. **1.2 OpenAPI Bridge** (3-4h) - Extract endpoints
3. **1.3 OpenAPI Integration** (2-3h) - Wire it up
4. **1.6 Form Wiring** (2-3h) - UI works
5. **2.1 Golden Path Test** (3-4h) - Prove it works

**Result:** User can upload ZIP → see form → run → get result

---

## Getting Started

```bash
# Start with the critical blocker
cd services/runner/src
# Read modal_app.py, understand what's needed
# Implement Modal functions
modal deploy modal_app.py

# Then OpenAPI bridge
cd services/control-plane/src/lib/openapi
python bridge.py  # Start the bridge
# Test: curl -X POST http://localhost:5555/extract -d '{"zip_path": "..."}'

# Then wire up the integration
# Edit services/control-plane/src/routes/projects.ts
# Call bridge after ZIP upload

# Finally, test end-to-end
npm run test tests/e2e/golden-path.spec.ts
```

---

## Notes

- This roadmap assumes one developer working full-time
- Estimates are conservative - experienced dev may be faster
- Phase 1 and Phase 3 can partially overlap
- Phase 4 should only start after Phase 2 passes
