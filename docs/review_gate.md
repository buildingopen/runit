# PR Review Criteria - Scope Compliance Gate

**Every PR must pass these checks before merge. This is the enforcement mechanism for v0 scope discipline.**

---

## 1. Non-Goals Check (MANDATORY)

**Question:** Does this PR implement any feature from `docs/non_goals.md`?

**How to check:**
1. Read the PR description and code changes
2. Cross-reference with `docs/non_goals.md` (all 15 categories)
3. If match found → **REJECT** with reference to specific non-goal

**Example rejection:**
```
❌ This implements "Custom Base Images" (Non-Goal #7, Infrastructure section).

This is explicitly excluded from v0 per docs/non_goals.md.

Alternative: User can request additions to the curated base image.
```

**Pass criteria:** PR implements ZERO non-goals.

---

## 2. Cut Features Check (MANDATORY)

**Question:** Does this PR implement any feature from `docs/scope_cut_plan.md`?

**How to check:**
1. Review the 30 explicitly cut features
2. Check if PR re-introduces any cut feature
3. If match found → **REJECT** with reference to specific cut number

**Example rejection:**
```
❌ This implements Cut #6: Warm Runtime / Container Reuse.

This was explicitly cut to maintain security simplicity in v0.

Rationale: Fresh container per run = simpler security model.
When: v1, when cold start complaints justify complexity.
```

**Pass criteria:** PR implements ZERO cut features.

---

## 3. Core Constraints Check (MANDATORY)

**Question:** Does this PR violate any v0 non-negotiables?

**Check these explicitly:**

### 3.1 Runtime Model
- [ ] **NO per-user Modal apps** (must use single Modal app factory)
- [ ] **NO uvicorn/ports** (must use in-process execution via httpx.AsyncClient)
- [ ] **NO PaaS concepts** in UI ("deploy", "service", "instance")

### 3.2 Security & Sharing
- [ ] **Secrets NEVER shared** (not in responses, share links, or logs)
- [ ] **Non-owners CANNOT see logs** (owner-only always)
- [ ] **Share links expose Run Pages only** (not code, not env)

### 3.3 Scope Discipline
- [ ] **NO always-on hosting** features
- [ ] **NO multi-service apps** support
- [ ] **NO WebSockets** implementation
- [ ] **NO external DB provisioning**
- [ ] **NO complex IAM** (owner-only in v0)

**Example rejection:**
```
❌ This PR exposes secrets in the RunEnvelope returned to non-owners.

VIOLATION: Non-negotiable #2 (Security & Sharing)
"Non-owners CANNOT see logs or anything that could expose secrets."

Required fix: Redact all secrets before returning RunEnvelope.
```

**Pass criteria:** ZERO constraint violations.

---

## 4. Mental Model Consistency Check

**Question:** Does this PR use correct terminology?

**Required terminology:**

| Concept | Use | Never Say |
|---------|-----|-----------|
| The product | "Run Pages" or "Execution Layer" | Deploy, Service, Platform |
| Primary objects | Projects, Endpoints, Runs | Deployments, Services, Instances |
| User action | "Run this endpoint" | Deploy, Execute, Invoke |
| State | "Ready to run" | Running, Active, Live |
| Result | "Run completed" | Deployment succeeded |
| Past runs | "History" | Logs, Runs list |

**Check:**
- [ ] UI copy uses approved terms only
- [ ] Code comments use approved terms
- [ ] API endpoint names align with mental model

**Example rejection:**
```
❌ Button text says "Deploy Endpoint" (line 42, RunPage.tsx)

Should be: "Run Endpoint" or just "Run"

Reason: We are NOT a deployment platform. "Run" is the approved term.
```

**Pass criteria:** 100% terminology compliance.

---

## 5. UX Complexity Check

**Question:** Does this PR add unnecessary complexity to the UI?

**Red flags:**
- [ ] New settings page
- [ ] New "Advanced" section (before v0 is done)
- [ ] Multi-step wizard
- [ ] Dashboard view
- [ ] Left nav expansion
- [ ] Configuration file required for basic use

**Golden rule:** "One primary CTA per page"

**Check:**
- [ ] Each new page has exactly ONE primary action
- [ ] No settings pages (unless critical, owner-only)
- [ ] No multi-step flows (upload → endpoints → run should be direct)

**Example rejection:**
```
❌ This adds a "Project Settings" page with 12 configuration options.

VIOLATION: "Advanced is an anti-feature" in v0 (CLAUDE.md section 34.4)

v0 should be "no config by default". These settings should be:
- Auto-detected (preferred)
- In optional executionlayer.toml (for edge cases)
- Deferred to v1 (if not critical)
```

**Pass criteria:** UI stays simple and focused.

---

## 6. Ownership Boundary Check

**Question:** Does this PR put code in the wrong service?

**Enforce strict ownership** (from CLAUDE.md section 35.2):

| What | Must Be In | NEVER In |
|------|-----------|-----------|
| Modal code | `services/runner` | `apps/web`, `services/control-plane` |
| UI components | `apps/web`, `packages/ui` | `services/*` |
| Database queries | `services/control-plane` | `apps/web`, `services/runner` |
| Execution logic | `services/runner` | `apps/web`, `services/control-plane` |
| Share link logic | `services/control-plane` | `services/runner` |
| Form generation | `packages/openapi-form` | `services/control-plane`, `services/runner` |
| Type definitions | `packages/shared` | Scattered everywhere |

**Example rejection:**
```
❌ This adds OpenAPI parsing to control-plane (src/routes/versions.ts)

VIOLATION: OpenAPI extraction belongs in services/runner (CLAUDE.md 35.2)

Control-plane should call runner.getOpenAPI(version_id), not parse itself.
```

**Pass criteria:** Code is in the correct service.

---

## 7. Contract Compliance Check

**Question:** Does this PR break or bypass internal contracts?

**Check these contracts** (from CLAUDE.md section 35.3):

### 7.1 Runner API Contract
- [ ] All calls to runner use `RunEndpointRequest` schema
- [ ] All responses use `RunEndpointResponse` schema
- [ ] No ad-hoc data structures bypass contracts

### 7.2 RunEnvelope Contract
- [ ] UI consumes `RunEnvelope` only (not raw runner response)
- [ ] All runs return normalized envelope
- [ ] No bypassing envelope for "special cases"

### 7.3 Artifacts Contract
- [ ] Runner collects from `/artifacts/**` only
- [ ] Control-plane generates signed URLs on demand
- [ ] Artifacts stored with run metadata

**Example rejection:**
```
❌ This modifies RunEndpointResponse to add custom field "raw_logs_unredacted"

VIOLATION: Contract defined in packages/shared/src/contracts/runner.ts

Logs are already in `logs` field (redacted). Adding unredacted version:
1. Breaks security contract (secrets may leak)
2. Violates schema stability

Required: Use existing `logs` field only.
```

**Pass criteria:** All contracts respected.

---

## 8. Test Coverage Check

**Question:** Does this PR include appropriate tests?

**Required tests by change type:**

| Change Type | Required Tests |
|-------------|----------------|
| New API endpoint | Integration test calling endpoint |
| Runner execution logic | Unit test + integration test with sample repo |
| UI component | Component test (React Testing Library) |
| Form generation | Unit test mapping schema → form model |
| Share link logic | E2E test (Playwright) |
| Secrets handling | Security test (redaction validation) |
| Error handling | Unit test for each error class |

**Minimum bar:**
- [ ] New code has >70% coverage
- [ ] Critical paths have integration tests
- [ ] Security-critical code has explicit tests

**Example rejection:**
```
❌ This adds secrets redaction logic but has no tests.

REQUIRED: Tests validating:
1. Common secret patterns are redacted (API keys, tokens, JWTs)
2. Exact secret values are replaced
3. Redaction doesn't break valid JSON
4. Edge cases (secrets in nested objects, arrays)

Add tests in services/runner/tests/unit/test_redaction.py
```

**Pass criteria:** Appropriate test coverage exists.

---

## 9. Performance Impact Check

**Question:** Does this PR violate performance constraints?

**Hard limits (from CLAUDE.md section 16):**

| Limit | Threshold | Enforcement |
|-------|-----------|-------------|
| CPU run timeout | 60s | Hard kill |
| GPU run timeout | 180s | Hard kill |
| Build/install timeout | 300s | Fail with clear error |
| Import timeout | 30s | Fail with clear error |
| Request payload | 1MB JSON, 25MB files | Reject at API layer |
| Response stored | 5MB | Truncate + artifact |
| Artifacts total | 50MB | Reject exceeding uploads |

**Check:**
- [ ] No unbounded operations
- [ ] No N+1 queries
- [ ] No synchronous calls in hot path (use async)
- [ ] No loading entire datasets into memory

**Example rejection:**
```
❌ This loads entire response_body into memory for redaction (line 234)

ISSUE: For 5MB responses, this causes memory spike + GC pressure.

REQUIRED: Stream-based redaction or chunk processing.
```

**Pass criteria:** Performance constraints respected.

---

## 10. Security Baseline Check

**Question:** Does this PR maintain security posture?

**Required checks:**

### 10.1 Secrets Handling
- [ ] Secrets never in plaintext (encrypted at rest)
- [ ] Secrets redacted from logs automatically
- [ ] Secrets never in share links
- [ ] Secrets never in error messages

### 10.2 Container Security
- [ ] Runs as non-root user (uid 1000)
- [ ] Read-only root filesystem
- [ ] No privileged mode
- [ ] Network policy enforced (blocks private IPs)

### 10.3 Input Validation
- [ ] All user inputs validated (Zod schemas)
- [ ] No SQL injection vectors
- [ ] No path traversal (artifacts, bundles)
- [ ] File uploads size-limited

**Example rejection:**
```
❌ This PR reads user-provided file path without validation (line 156)

SECURITY RISK: Path traversal vulnerability
Example: user provides "../../etc/passwd"

REQUIRED: Validate path is within /workspace or /artifacts only.
```

**Pass criteria:** Security baseline maintained.

---

## 11. Documentation Alignment Check

**Question:** Does this PR require documentation updates?

**Check if PR includes:**

| Change | Requires Doc Update |
|--------|---------------------|
| New error class | Update error taxonomy (errors/taxonomy.py) |
| New API endpoint | Update API contracts doc |
| New UI flow | Update screenshots (if major) |
| New constraint | Update CLAUDE.md |
| Breaking change | Update IMPLEMENTATION_READY.md |

**Example rejection:**
```
❌ This adds new error class NETWORK_POLICY_VIOLATION but doesn't update docs.

REQUIRED:
1. Add to services/runner/src/errors/taxonomy.py
2. Add user-friendly message
3. Add suggested fix
4. Update docs/SUPPORT_MATRIX.md if changes supported features
```

**Pass criteria:** Docs updated where needed.

---

## 12. Demo Compatibility Check

**Question:** Does this PR break the canonical demo?

**Golden demo: `extract-company`** (CLAUDE.md section 34.2)

**Check:**
- [ ] Demo still runs without modification
- [ ] Demo still demonstrates all core features
- [ ] Demo still completes in <10 seconds

**If demo breaks, PR must:**
1. Update demo to work with changes
2. Justify why breaking change is necessary
3. Provide migration path for existing users

**Example rejection:**
```
❌ This changes OpenAPI parsing logic and breaks extract-company demo.

ERROR: Demo fails with OPENAPI_GENERATION_FAILED

REQUIRED:
1. Fix parsing to handle demo's schema
2. Add integration test with demo repo
3. Verify demo still runs end-to-end
```

**Pass criteria:** Demo remains functional.

---

## Fast Rejection Checklist

**Reviewers: Use this quick checklist for immediate rejection.**

Reject immediately if PR:
- [ ] Implements any non-goal (section 1)
- [ ] Re-introduces cut feature (section 2)
- [ ] Violates core constraints (section 3)
- [ ] Uses wrong terminology in UI (section 4)
- [ ] Adds settings page or wizard (section 5)
- [ ] Puts code in wrong service (section 6)
- [ ] Breaks internal contracts (section 7)
- [ ] Has zero tests for new code (section 8)
- [ ] Exceeds performance limits (section 9)
- [ ] Introduces security vulnerability (section 10)
- [ ] Missing required docs (section 11)
- [ ] Breaks canonical demo (section 12)

**If any box checked → REJECT with reference to specific section.**

---

## Approval Criteria

**PR can be approved when:**

✅ All 12 checks pass
✅ Zero non-goals implemented
✅ Zero cut features re-introduced
✅ All constraints respected
✅ Terminology correct
✅ UI stays simple
✅ Code in correct service
✅ Contracts respected
✅ Tests included
✅ Performance maintained
✅ Security baseline upheld
✅ Docs updated
✅ Demo still works

---

## Review Template

**Copy/paste this into PR reviews:**

```markdown
## Scope Compliance Review

### ✅ Passed Checks
- [ ] Non-goals check (section 1)
- [ ] Cut features check (section 2)
- [ ] Core constraints (section 3)
- [ ] Terminology (section 4)
- [ ] UX complexity (section 5)
- [ ] Ownership boundaries (section 6)
- [ ] Contract compliance (section 7)
- [ ] Test coverage (section 8)
- [ ] Performance (section 9)
- [ ] Security (section 10)
- [ ] Documentation (section 11)
- [ ] Demo compatibility (section 12)

### ⚠️ Issues Found
[List any violations with section references]

### 🚀 Approval Status
- [ ] APPROVED - All checks passed
- [ ] CHANGES REQUESTED - See issues above
- [ ] REJECTED - Implements non-goal or cut feature

### 📝 Notes
[Any additional context or suggestions]
```

---

**Last Updated:** 2024-12-30
**Owner:** Agent 10 (Guardrail/Scope Killer)
**Enforcement:** MANDATORY for all PRs
**Status:** ACTIVE
