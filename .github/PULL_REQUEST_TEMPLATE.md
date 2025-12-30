# Pull Request

## Description

**What does this PR do?**
<!-- Brief description of the change -->

**Why is this change needed?**
<!-- Link to issue, user need, or product requirement -->

**Related Issues:**
<!-- Fixes #123, Relates to #456 -->

---

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Security fix

---

## v0 Scope Compliance (MANDATORY)

**This section MUST be completed for all PRs. Incomplete compliance checks will result in automatic rejection.**

### 1. Non-Goals Check ✅

**Does this PR implement ANY feature from `docs/non_goals.md`?**

- [ ] ✅ **NO** - This PR does not implement any non-goal
- [ ] ❌ **YES** - This PR implements a non-goal (EXPLAIN BELOW - will be rejected)

**If YES, which non-goal and why is it justified?**
<!-- This should almost never be checked. If checked, provide strong justification. -->

---

### 2. Cut Features Check ✅

**Does this PR re-introduce ANY feature from `docs/scope_cut_plan.md`?**

- [ ] ✅ **NO** - This PR does not re-introduce any cut feature
- [ ] ❌ **YES** - This PR re-introduces a cut feature (EXPLAIN BELOW - will be rejected)

**If YES, which cut feature (number) and why is it justified?**
<!-- This should almost never be checked. If checked, provide strong justification. -->

---

### 3. Core Constraints Compliance ✅

**Check all that apply to verify this PR respects v0 non-negotiables:**

#### Runtime Model
- [ ] ✅ Uses single Modal app factory (NO per-user Modal apps)
- [ ] ✅ Uses in-process execution via httpx.AsyncClient (NO uvicorn/ports)
- [ ] ✅ Uses product terminology (NO "deploy", "service", "instance" in UI)
- [ ] N/A - Does not touch runtime code

#### Security & Sharing
- [ ] ✅ Secrets are NEVER shared (not in responses, share links, or logs)
- [ ] ✅ Non-owners CANNOT see logs (owner-only enforced)
- [ ] ✅ Share links expose Run Pages only (NO code, env, or internals)
- [ ] N/A - Does not touch secrets or sharing code

#### Scope Discipline
- [ ] ✅ NO always-on hosting features added
- [ ] ✅ NO multi-service support added
- [ ] ✅ NO WebSockets implementation
- [ ] ✅ NO external DB provisioning
- [ ] ✅ NO complex IAM (owner-only preserved)
- [ ] N/A - Does not touch scope-sensitive areas

---

### 4. Terminology Compliance ✅

**If this PR touches UI copy or API naming:**

- [ ] ✅ Uses "Run" (not "Deploy", "Execute", "Invoke")
- [ ] ✅ Uses "Projects, Endpoints, Runs" (not "Deployments, Services, Instances")
- [ ] ✅ Uses "Ready to run" (not "Running", "Active", "Live")
- [ ] ✅ Uses "History" (not "Logs", "Runs list")
- [ ] N/A - Does not add user-facing text

---

### 5. UX Complexity Check ✅

**If this PR touches UI:**

- [ ] ✅ Each page has ONE primary CTA (call-to-action)
- [ ] ✅ NO new settings pages added
- [ ] ✅ NO "Advanced" sections added (unless critical + owner-only)
- [ ] ✅ NO multi-step wizards added
- [ ] ✅ NO dashboard views added
- [ ] N/A - Does not touch UI

---

### 6. Ownership Boundaries ✅

**Check that code is in the correct service:**

| Code Type | Correct Location | ✅ |
|-----------|-----------------|---|
| Modal execution code | `services/runner` | [ ] |
| UI components | `apps/web`, `packages/ui` | [ ] |
| Database queries | `services/control-plane` | [ ] |
| Share link logic | `services/control-plane` | [ ] |
| Form generation | `packages/openapi-form` | [ ] |
| Type definitions | `packages/shared` | [ ] |
| N/A - Does not add code in these areas | | [ ] |

---

### 7. Contract Compliance ✅

**If this PR touches API contracts:**

- [ ] ✅ Runner API uses `RunEndpointRequest/Response` schemas
- [ ] ✅ UI consumes `RunEnvelope` (not raw runner response)
- [ ] ✅ Artifacts use standard storage contract (`/artifacts/**`)
- [ ] ✅ No ad-hoc data structures bypass contracts
- [ ] N/A - Does not touch API contracts

---

## Testing

### Test Coverage ✅

**Required tests included:**

- [ ] Unit tests for new functions/methods
- [ ] Integration tests for API endpoints
- [ ] Component tests for UI components (if applicable)
- [ ] E2E tests for critical user flows (if applicable)
- [ ] Security tests for secrets handling (if applicable)

**Test coverage:**
- New code coverage: **___%** (minimum 70% required)
- Overall coverage change: **+/- ___%**

### Manual Testing ✅

**I have manually tested:**

- [ ] Happy path works as expected
- [ ] Error cases handled gracefully
- [ ] Edge cases considered and tested
- [ ] Canonical demo (`extract-company`) still works
- [ ] No regressions in related features

**Testing steps:**
<!-- Describe how you tested this change manually -->
1.
2.
3.

---

## Performance Impact

**Does this PR impact performance?**

- [ ] ✅ NO performance impact
- [ ] ⚠️ YES - See analysis below

**If YES, performance analysis:**
<!-- Describe impact on timeouts, memory, CPU, or response times -->

**Respects hard limits:**
- [ ] CPU run timeout: 60s
- [ ] GPU run timeout: 180s
- [ ] Build timeout: 300s
- [ ] Import timeout: 30s
- [ ] Request payload: 1MB JSON, 25MB files
- [ ] Response stored: 5MB max
- [ ] Artifacts: 50MB max

---

## Security Review

**Security checklist:**

- [ ] ✅ Secrets never in plaintext
- [ ] ✅ Secrets redacted from logs
- [ ] ✅ Secrets never in share links
- [ ] ✅ All user inputs validated
- [ ] ✅ No SQL injection vectors
- [ ] ✅ No path traversal vulnerabilities
- [ ] ✅ File uploads size-limited
- [ ] ✅ Container runs as non-root (if touching runner)
- [ ] N/A - No security-sensitive changes

---

## Documentation

**Documentation updates:**

- [ ] ✅ Code comments added/updated
- [ ] ✅ API contracts updated (if applicable)
- [ ] ✅ Error taxonomy updated (if new error class)
- [ ] ✅ CLAUDE.md updated (if constraints changed)
- [ ] ✅ README updated (if setup changed)
- [ ] N/A - No documentation needed

---

## Breaking Changes

**Does this PR introduce breaking changes?**

- [ ] ✅ NO breaking changes
- [ ] ⚠️ YES - See migration plan below

**If YES, migration plan:**
<!-- How will existing users/code adapt to this change? -->

---

## Deployment Notes

**Special deployment considerations:**

- [ ] Database migration required (see `infra/migrations/`)
- [ ] Environment variables added/changed
- [ ] Modal secrets need updating
- [ ] Base image rebuild required
- [ ] None - standard deployment

---

## Reviewer Guidance

**What should reviewers focus on?**
<!-- Guide reviewers to the most critical parts of this PR -->

**Areas of concern:**
<!-- Any areas you're unsure about? -->

**Related PRs:**
<!-- Links to related or dependent PRs -->

---

## Pre-Submission Checklist

**Before submitting, I have:**

- [ ] ✅ Read and completed ALL scope compliance checks above
- [ ] ✅ Written/updated tests with >70% coverage
- [ ] ✅ Manually tested the change
- [ ] ✅ Verified canonical demo still works
- [ ] ✅ Updated documentation
- [ ] ✅ Checked for secrets or sensitive data in code
- [ ] ✅ Used correct terminology in UI/API
- [ ] ✅ Followed ownership boundaries
- [ ] ✅ Run `npm run lint` and `npm run build` (if applicable)
- [ ] ✅ Run `pytest` (if applicable)
- [ ] ✅ Reviewed my own code for obvious issues

---

## Final Declaration

**By submitting this PR, I confirm:**

> I have read `docs/non_goals.md`, `docs/scope_cut_plan.md`, and `docs/review_gate.md`.
>
> This PR does NOT implement any non-goal or re-introduce any cut feature.
>
> This PR respects all v0 constraints and maintains scope discipline.

- [ ] ✅ **I confirm the above declaration**

---

**Note to reviewers:** Use the checklist in `docs/review_gate.md` for systematic review.

**Automatic rejection triggers:**
- Incomplete scope compliance section
- Implements non-goal or cut feature
- Violates core constraints
- Zero tests for new code
- Breaks canonical demo
- Uses wrong terminology in UI
