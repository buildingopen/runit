# Phase Gates & Success Criteria

**Status:** Complete ✅
**Last Updated:** 2024-12-30

## Overview

This document defines **what must be completed at each phase** and **how we know it works**. Each phase has clear entry criteria, success criteria, and exit gates.

**Phases:**
1. **Week 1-2:** Foundation
2. **Week 3-4:** Core Build
3. **Week 5:** Integration
4. **Week 6:** Polish & Launch

---

## Phase 1: Foundation (Week 1-2)

### Entry Criteria

✅ Repository scaffolded
✅ Git worktrees created for all 10 agents
✅ Testing infrastructure ready
✅ Development environment documented
✅ Execution protocol defined

### Agents Active in This Phase

- **Agent 1 (ARCHITECT)** - Define contracts
- **Agent 4 (AESTHETIC)** - Create design system
- **Agent 10 (CUTTER)** - Document non-goals

**Why these three first:**
- Agent 1 defines the API contracts that Agents 2, 3, 6, 7 will implement
- Agent 4 creates UI primitives that Agent 5 will use
- Agent 10 establishes scope discipline from day 1

### Success Criteria

#### Agent 1 (ARCHITECT)

**Must Complete:**
1. ✅ Define all contracts in `packages/shared/src/contracts/`
   - `BuildRequest` / `BuildResponse`
   - `GetOpenAPIRequest` / `GetOpenAPIResponse`
   - `RunEndpointRequest` / `RunEndpointResponse`
   - `GetRunRequest` / `GetRunResponse`

2. ✅ Define all shared types in `packages/shared/src/types/`
   - `RunEnvelope`
   - `OpenAPIEndpointMeta`
   - `FormModel`
   - `ErrorResponse`
   - `Artifact`

3. ✅ Create Zod schemas for validation in `packages/shared/src/schemas/`

4. ✅ Implement basic control-plane routes (stubs OK)
   - `GET /health` - Health check
   - `POST /projects` - Create project
   - `GET /projects/:id` - Get project
   - `POST /projects/:id/versions` - Create version

**Acceptance Test:**
```bash
# Import contracts in other services without errors
cd services/runner
python -c "from packages.shared import RunEndpointRequest"  # Should work (TypeScript→Python bridge pending)

# TypeScript imports work
cd services/control-plane
npm run build  # Should compile without errors
```

**Exit Criteria:**
- [ ] All contracts defined and exported
- [ ] TypeScript strict mode passes
- [ ] Contract tests pass (100% coverage)
- [ ] Other agents can import contracts

---

#### Agent 4 (AESTHETIC)

**Must Complete:**
1. ✅ Define design tokens in `packages/ui/src/tokens.ts`
   - Spacing scale (xs, sm, md, lg, xl, 2xl, 3xl)
   - Typography scale (pageTitle, sectionTitle, body, helper, code)
   - Color system (background, surface, border, accent, semantic)
   - Border radius (sm, md, lg)

2. ✅ Create core UI primitives
   - `Button` (primary, secondary, ghost variants)
   - `Card`
   - `Input`
   - `Select`
   - `Panel`

3. ✅ Configure Tailwind CSS 4 in `apps/web/tailwind.config.ts`

4. ✅ Create global styles in `apps/web/styles/globals.css`

**Acceptance Test:**
```typescript
// Render Button component
import { Button } from '@execution-layer/ui';

<Button variant="primary">Click me</Button>
// Should render with correct styles
```

**Exit Criteria:**
- [ ] All design tokens exported
- [ ] Core UI components functional
- [ ] Tailwind config uses tokens
- [ ] Component tests pass (80% coverage)
- [ ] Agent 5 can use UI components

---

#### Agent 10 (CUTTER)

**Must Complete:**
1. ✅ Create `docs/non_goals.md` - What we DON'T build in v0
2. ✅ Create `docs/scope_cut_plan.md` - Features explicitly cut
3. ✅ Create `docs/review_gate.md` - PR review criteria
4. ✅ Create `.github/PULL_REQUEST_TEMPLATE.md` - PR template with scope checklist

**Acceptance Test:**
```markdown
# Non-goals document exists and has clear categories:
- Authentication (no private GitHub repos)
- Runtime (no WebSockets)
- Infrastructure (no external DB provisioning)
- Dependencies (pip only, no Poetry)
```

**Exit Criteria:**
- [ ] Non-goals documented
- [ ] Scope cut plan defined
- [ ] PR template enforces scope discipline
- [ ] All agents aware of non-goals

---

### Week 2 Checkpoint (End of Phase 1)

**Integration Test:** "Can import shared contracts in all services"

```bash
# Test 1: TypeScript services can import contracts
cd services/control-plane
npm run build  # ✅ Compiles

# Test 2: UI can import and use components
cd apps/web
npm run build  # ✅ Compiles

# Test 3: All tests pass
npm run test  # ✅ All pass
```

**Decision Point:** Only proceed to Phase 2 if **all 3 agents complete** and integration test passes.

---

## Phase 2: Core Build (Week 3-4)

### Entry Criteria

✅ Phase 1 complete (contracts defined, design system ready)
✅ All agents merged Phase 1 work to `main`
✅ Integration test passed

### Agents Active in This Phase

- **Agent 2 (KERNEL)** - Modal runtime
- **Agent 3 (BRIDGE)** - OpenAPI extraction
- **Agent 5 (RUNPAGE)** - Run Page UI
- **Agent 8 (DELIGHT)** - SDK + samples

**Dependencies:**
- Agent 2 depends on Agent 1 (contracts)
- Agent 3 depends on Agent 2 (runtime exists)
- Agent 5 depends on Agent 3 (OpenAPI extraction) + Agent 4 (UI components)
- Agent 8 works in parallel (independent)

### Success Criteria

#### Agent 2 (KERNEL)

**Must Complete:**
1. ✅ Modal app with base image
   ```python
   app = modal.App("execution-layer-runtime")
   base_image = modal.Image.debian_slim()...
   ```

2. ✅ CPU lane function
   ```python
   @app.function(image=base_image, cpu=2.0, memory=4096, timeout=60)
   def run_endpoint_cpu(payload: dict) -> dict:
       ...
   ```

3. ✅ GPU lane function
   ```python
   @app.function(gpu="A10G", timeout=180)
   def run_endpoint_gpu(payload: dict) -> dict:
       ...
   ```

4. ✅ In-process execution via `httpx.AsyncClient`
   ```python
   async with httpx.AsyncClient(
       transport=httpx.ASGITransport(app=app),
       base_url="http://app"
   ) as client:
       response = await client.request(...)
   ```

5. ✅ Dependency caching by hash

6. ✅ Artifact collection from `/artifacts`

**Acceptance Test:**
```bash
# Deploy to Modal
cd services/runner
modal deploy src/modal_app.py

# Test execution
modal run src/modal_app.py::run_endpoint_cpu \
  --payload '{"entrypoint": "main:app", ...}'

# ✅ Should return RunEndpointResponse
```

**Exit Criteria:**
- [ ] Modal app deploys successfully
- [ ] Sample FastAPI app runs in CPU lane
- [ ] Artifacts collected correctly
- [ ] Dependencies cached (no reinstall on 2nd run)
- [ ] Integration tests pass (90% coverage)

---

#### Agent 3 (BRIDGE)

**Must Complete:**
1. ✅ Entrypoint detection (5 patterns)
   ```python
   detect_entrypoint("/workspace")  # → "main:app"
   ```

2. ✅ FastAPI app import with timeout (30s)

3. ✅ OpenAPI extraction
   ```python
   openapi_spec = app.openapi()
   normalized = normalize_spec(openapi_spec)
   ```

4. ✅ Schema normalization for Run Page

5. ✅ Error taxonomy (20+ classes)
   ```python
   ENTRYPOINT_NOT_FOUND
   IMPORT_ERROR
   OPENAPI_GENERATION_FAILED
   ...
   ```

**Acceptance Test:**
```bash
# Test entrypoint detection
cd services/runner
pytest tests/unit/test_detect.py -v

# Test OpenAPI extraction
pytest tests/unit/test_openapi.py -v

# ✅ All tests pass
```

**Exit Criteria:**
- [ ] Entrypoint detection works for all 5 patterns
- [ ] OpenAPI extraction works for sample apps
- [ ] Error taxonomy complete with friendly messages
- [ ] Unit tests pass (95% coverage)

---

#### Agent 5 (RUNPAGE)

**Must Complete:**
1. ✅ Endpoint list page
   ```
   /p/:project → Shows all endpoints
   ```

2. ✅ Run Page route
   ```
   /p/:project/e/:endpoint → Shows Run Page form
   ```

3. ✅ Form generation from OpenAPI schema
   - String fields → text input
   - Number fields → number input
   - Boolean → checkbox
   - Enum → dropdown
   - Fallback to JSON editor for complex schemas

4. ✅ Result viewer (JSON + artifacts)

5. ✅ "Run" button triggers execution

**Acceptance Test:**
```bash
# E2E test
cd apps/web
npm run test:e2e

# ✅ Golden path test passes:
# 1. Navigate to /p/test-project
# 2. See endpoints list
# 3. Click endpoint
# 4. Fill form
# 5. Click "Run"
# 6. See result
```

**Exit Criteria:**
- [ ] Endpoints list renders from OpenAPI
- [ ] Run Page form renders for simple schemas
- [ ] Result viewer shows JSON
- [ ] Artifacts downloadable
- [ ] E2E tests pass

---

#### Agent 8 (DELIGHT)

**Must Complete:**
1. ✅ Golden demo: `extract-company`
   ```python
   # services/runner/samples/extract-company/main.py
   @app.post("/extract_company")
   async def extract_company(req: CompanyRequest):
       # Fetch URL, extract metadata, write artifact
       ...
   ```

2. ✅ Sample: `hello-world`
   ```python
   @app.get("/")
   async def root():
       return {"message": "Hello World"}
   ```

3. ✅ Sample: `file-upload`
   ```python
   @app.post("/upload")
   async def upload(file: UploadFile):
       ...
   ```

4. ✅ Python SDK helpers (optional)
   ```python
   # packages/sdk/src/context.py
   def get_context(name: str) -> dict:
       return json.load(open(f"/context/{name}.json"))
   ```

**Acceptance Test:**
```bash
# Test samples locally
cd services/runner/samples/extract-company
python main.py  # FastAPI app starts

# Test via Modal
cd services/runner
modal run src/modal_app.py::run_endpoint_cpu \
  --payload '{"entrypoint": "samples.extract-company.main:app", ...}'

# ✅ Returns result
```

**Exit Criteria:**
- [ ] All 3 samples work
- [ ] Golden demo (extract-company) passes E2E
- [ ] Sample tests pass (pytest)

---

### Week 4 Checkpoint (End of Phase 2)

**Integration Test:** "Upload ZIP → Extract OpenAPI → Render form → Run → See result"

```bash
# E2E test (manual if automated not ready)
1. Start web UI: cd apps/web && npm run dev
2. Start control-plane: cd services/control-plane && npm run dev
3. Modal runner: cd services/runner && modal serve src/modal_app.py

4. Navigate to http://localhost:3000
5. Upload samples/extract-company.zip
6. Should see endpoint "POST /extract_company"
7. Click endpoint → See form
8. Fill form: url = "https://example.com"
9. Click "Run"
10. Should see result + artifact download link

✅ Integration test passes
```

**Decision Point:** Only proceed to Phase 3 if **core flow works end-to-end**.

---

## Phase 3: Integration (Week 5)

### Entry Criteria

✅ Phase 2 complete (core flow works)
✅ Modal execution proven
✅ Run Page renders and executes

### Agents Active in This Phase

- **Agent 6 (MEMORY)** - Context system
- **Agent 7 (TRUST)** - Secrets system
- **Agent 9 (FINOPS)** - Rate limiting & quotas

**All parallel** - No blocking dependencies

### Success Criteria

#### Agent 6 (MEMORY)

**Must Complete:**
1. ✅ Context fetch from URL (platform-side scraper)
   ```typescript
   POST /projects/:id/context
   { "url": "https://example.com", "name": "Company" }
   ```

2. ✅ Context storage (PostgreSQL)

3. ✅ Context mounting at `/context/*.json` (runner)

4. ✅ Context refresh mechanism

5. ✅ Context linting (reject secret patterns)

**Acceptance Test:**
```bash
# Fetch context
curl -X POST http://localhost:3001/projects/test-id/context \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "name": "Test Company"}'

# ✅ Returns: { "id": "...", "data": { "title": "...", "description": "..." }}

# Run uses context
# In runner, verify /context/test-company.json exists
```

**Exit Criteria:**
- [ ] Context fetch works
- [ ] Context mounted in runner
- [ ] Context linting rejects secrets
- [ ] Integration tests pass (85% coverage)

---

#### Agent 7 (TRUST)

**Must Complete:**
1. ✅ Secrets storage (KMS encrypted)
   ```typescript
   POST /projects/:id/secrets
   { "key": "OPENAI_API_KEY", "value": "sk-..." }
   ```

2. ✅ Secrets injection (runner receives decrypted)

3. ✅ Secrets redaction (logs + outputs)

4. ✅ Secrets UI (masked input, owner-only)

5. ✅ Share links never include secrets

**Acceptance Test:**
```bash
# Store secret
curl -X POST http://localhost:3001/projects/test-id/secrets \
  -H "Content-Type: application/json" \
  -d '{"key": "TEST_KEY", "value": "secret-value"}'

# ✅ Stored encrypted

# Run endpoint with secret
# In runner logs, verify "secret-value" is redacted

# Share link
# Verify secrets NOT in share page HTML/API
```

**Exit Criteria:**
- [ ] Secrets encrypted at rest
- [ ] Secrets injected into runner
- [ ] Secrets redacted from logs
- [ ] Share links don't leak secrets
- [ ] Security tests pass (95% coverage)

---

#### Agent 9 (FINOPS)

**Must Complete:**
1. ✅ Rate limiting middleware
   ```typescript
   // 60 req/min for authenticated users
   // 10 req/min for anonymous (share links)
   ```

2. ✅ Quota enforcement
   ```typescript
   // 100 CPU runs/hour
   // 10 GPU runs/hour
   // 2 concurrent CPU runs
   // 1 concurrent GPU run
   ```

3. ✅ Retention cleanup script
   ```typescript
   // Delete runs > 30 days
   // Delete artifacts > 7 days
   // Clear logs > 24 hours
   ```

4. ✅ Cost monitoring (basic metrics)

**Acceptance Test:**
```bash
# Test rate limiting
for i in {1..65}; do
  curl http://localhost:3001/health
done
# ✅ Request 61+ returns 429

# Test quota
# Create 3 concurrent runs
# ✅ 3rd run returns quota error

# Test retention
node infra/scripts/retention-cleanup.ts
# ✅ Old data deleted
```

**Exit Criteria:**
- [ ] Rate limiting works
- [ ] Quota enforcement works
- [ ] Retention cleanup runs
- [ ] Middleware tests pass (90% coverage)

---

### Week 5 Checkpoint (End of Phase 3)

**Integration Test:** "Share endpoint → Recipient runs with their own secrets → Result shown"

```bash
# Full integration test
1. Create project with secret (OWNER)
2. Run endpoint successfully (OWNER)
3. Share endpoint link (OWNER)
4. Open share link (RECIPIENT)
5. Add recipient's own secret (RECIPIENT)
6. Run endpoint (RECIPIENT)
7. See result (RECIPIENT)
8. Verify: Owner can't see recipient's run

✅ Share flow works end-to-end
```

**Decision Point:** Only proceed to Phase 4 if **sharing works** and **secrets never leak**.

---

## Phase 4: Polish & Launch (Week 6)

### Entry Criteria

✅ Phase 3 complete (sharing works)
✅ Security checklist complete
✅ All acceptance tests pass

### All Agents Active

**Focus:** Bug fixes, edge cases, error messages, final polish

### Success Criteria

#### All Agents

**Must Complete:**
1. ✅ Fix all known bugs
2. ✅ Polish error messages (friendly + actionable)
3. ✅ Complete missing tests
4. ✅ Update documentation
5. ✅ Performance optimization (if needed)

**Agent-Specific:**
- **Agent 1:** Integration verification
- **Agent 2:** Dependency caching optimization
- **Agent 3:** Error message catalog complete
- **Agent 4:** UI polish (spacing, colors, borders)
- **Agent 5:** Form edge cases (file uploads, complex schemas)
- **Agent 6:** Context refresh UX
- **Agent 7:** Output redaction layer
- **Agent 8:** Starter repo templates
- **Agent 9:** Cost dashboard (basic)
- **Agent 10:** Final scope enforcement review

---

### Week 6 Checkpoint (Launch Ready)

**Final Acceptance Tests:** All must pass ✅

#### 1. Golden Path E2E Test
```
✅ Upload → Endpoints list → Run Page → Run → Result → Artifacts
```

#### 2. Share Flow E2E Test
```
✅ Share link → Recipient runs → Result shown → Owner sees metrics only
```

#### 3. Security Tests
```
✅ Secrets never in logs
✅ Secrets never in share links
✅ Secrets redacted from outputs
✅ Network policy blocks private IPs
✅ Non-owner errors are generic
```

#### 4. Error Handling Tests
```
✅ All 20+ error classes have friendly messages
✅ Suggested fixes are actionable
✅ Stack traces owner-only
```

#### 5. Performance Tests
```
✅ First run: < 20s (with cold start)
✅ Cached deps run: < 5s
✅ Form renders: < 1s
✅ Result viewer: < 500ms
```

---

## Definition of Done (v0)

**Product is v0-done when:**

✅ Vibe coder can upload/import FastAPI repo
✅ Sees endpoints list
✅ Runs endpoint via auto-generated form
✅ Sees result (JSON viewer + artifacts)
✅ Shares endpoint link
✅ Recipient runs with their own secrets
✅ Secrets never leaked
✅ Errors are friendly + actionable
✅ Product feels "Colab for Apps" (not PaaS dashboard)
✅ All acceptance tests pass
✅ Security checklist complete
✅ Documentation complete

---

## Launch Checklist

### Pre-Launch (Week 6)

- [ ] All phase gates passed
- [ ] All acceptance tests pass
- [ ] Security checklist complete
- [ ] Documentation complete (`README.md`, `CLAUDE.md`, `DECISIONS.md`)
- [ ] Terms of Service drafted
- [ ] Privacy Policy drafted
- [ ] Abuse reporting email set up
- [ ] Monitoring & observability ready
- [ ] Incident response plan ready

### Launch Day

- [ ] Deploy to production
- [ ] Run smoke tests
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Have rollback plan ready

### Post-Launch (Week 7+)

- [ ] Gather user feedback
- [ ] Fix critical bugs
- [ ] Plan v1 features
- [ ] Iterate on UX

---

## Rollback Criteria

**Immediately rollback if:**

❌ Secrets leak detected
❌ Error rate > 10%
❌ Downtime > 5 minutes
❌ Data loss incident
❌ Security vulnerability discovered

---

## Success Metrics (Post-Launch)

**Week 1:**
- Target: 10 projects created
- Target: 50 runs executed
- Target: 5 share links created

**Week 4:**
- Target: 100 projects
- Target: 1,000 runs
- Target: 50 share links

**Week 12:**
- Target: 500 projects
- Target: 10,000 runs
- Target: 200 share links

**Key metric:** Share link usage rate (% of projects that create share links)

---

## Status: ✅ PHASE GATES DEFINED

All phases have clear success criteria and exit gates.

Next: Agents begin Phase 1 implementation.
