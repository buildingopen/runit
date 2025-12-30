# Scope Cut Plan - Features Explicitly Removed from v0

**This document tracks features that were considered but explicitly cut from v0 to maintain focus.**

Each entry includes: what was cut, why, and when it might return.

---

## Cut #1: Private GitHub Repository Import

**What:** OAuth-based import of private GitHub repos.

**Why Cut:**
- Adds OAuth flow complexity (login, token refresh, permissions)
- Requires GitHub App setup and management
- Not needed for demo/share use cases
- Public repos + ZIP upload covers 95% of v0 needs

**Alternative in v0:** ZIP upload, public repo HTTPS clone.

**When it might return:** v1, when user base justifies OAuth complexity.

**Effort saved:** 2-3 weeks of OAuth implementation + security review.

---

## Cut #2: Automatic GitHub Sync

**What:** Automatically re-import code when GitHub repo updates.

**Why Cut:**
- Requires webhook infrastructure
- Breaks "immutable version" model
- Users expect explicit version control
- Adds "magic" that can confuse users

**Alternative in v0:** Manual re-import creates new version.

**When it might return:** v1+, as opt-in feature for active development.

**Effort saved:** Webhook infrastructure, version conflict handling, UI for sync status.

---

## Cut #3: Streaming Responses

**What:** Support for streaming responses (SSE, chunked transfer).

**Why Cut:**
- UI complexity (live-updating result viewer)
- Runner complexity (async streaming through Modal)
- Not needed for "run and get result" model
- Most FastAPI endpoints return complete responses

**Alternative in v0:** Request → wait → complete result.

**When it might return:** v1, for long-running LLM/streaming use cases.

**Effort saved:** Streaming transport, UI live updates, partial result handling.

---

## Cut #4: Real-Time Logs During Execution

**What:** Live log streaming while run is in progress.

**Why Cut:**
- Requires WebSocket or SSE infrastructure
- Adds UI complexity (live log viewer)
- Owner-only logs can be viewed after completion
- Not critical for 60-second runs

**Alternative in v0:** Logs available after run completes (owner-only).

**When it might return:** v1, for longer GPU runs or debugging.

**Effort saved:** WebSocket infrastructure, live UI updates.

---

## Cut #5: Multi-File Uploads in Single Field

**What:** Support for array of files in single `UploadFile` field.

**Why Cut:**
- UI complexity (multi-file picker, drag-drop zone)
- Form generation complexity (array of files vs single file)
- Edge case (most endpoints take single file or JSON)

**Alternative in v0:** Multiple single-file fields, or JSON with file URLs.

**When it might return:** v1, if user demand justifies complexity.

**Effort saved:** Complex form UI, multi-file handling in runner.

---

## Cut #6: Warm Runtime / Container Reuse

**What:** Keep containers warm between runs to reduce cold start.

**Why Cut:**
- Adds state management complexity
- Requires cleanup between runs (security risk)
- Increases cost (idle containers)
- Fresh container = simpler security model

**Alternative in v0:** Fresh container per run, dependency caching by hash.

**When it might return:** v1, when cold start complaints justify complexity.

**Effort saved:** Container lifecycle management, cleanup logic, cost optimization.

---

## Cut #7: Custom Base Images

**What:** Allow users to specify custom Docker base images.

**Why Cut:**
- Security nightmare (arbitrary images)
- Breaks "curated fat base image" model
- Adds build complexity and time
- Most users don't need this

**Alternative in v0:** Rich base image with common libs (pandas, playwright, etc.).

**When it might return:** v2+, for power users with strict requirements.

**Effort saved:** Image validation, security scanning, build caching per image.

---

## Cut #8: Custom System Packages (apt-get at runtime)

**What:** Allow `apt-get install` during container build.

**Why Cut:**
- Security risk (arbitrary package installation)
- Slow builds (network latency, installation time)
- Dependency conflicts
- Most needs covered by base image

**Alternative in v0:** Request additions to base image via feedback.

**When it might return:** v1+, with strict allowlisting.

**Effort saved:** Package validation, build caching, security review.

---

## Cut #9: Poetry / PDM / Conda Support

**What:** Support for Poetry lockfiles, PDM, Conda environments.

**Why Cut:**
- Each tool requires different installation logic
- Increases build complexity
- `pip + requirements.txt` covers vast majority
- Can convert Poetry → requirements.txt externally

**Alternative in v0:** `pip install -r requirements.txt` or `pip install .`.

**When it might return:** v1, if user demand justifies.

**Effort saved:** Multi-tool support, testing matrix, documentation.

---

## Cut #10: Context Auto-Refresh

**What:** Automatically refresh context when it's stale.

**Why Cut:**
- "Magic" behavior that can surprise users
- Unpredictable costs if context fetch is expensive
- User should control freshness explicitly

**Alternative in v0:** Manual "Refresh" button.

**When it might return:** v1, as opt-in feature with clear cost implications.

**Effort saved:** Staleness detection, auto-refresh logic, cost modeling.

---

## Cut #11: AI-Powered Context Extraction

**What:** Use LLM to extract structured data from webpages.

**Why Cut:**
- Adds LLM inference cost to every fetch
- Requires prompt engineering and validation
- BeautifulSoup + OpenGraph covers common cases
- Scope creep into "smart scraping platform"

**Alternative in v0:** Simple HTML parsing (title, description, meta tags).

**When it might return:** v1+, as premium feature.

**Effort saved:** LLM integration, prompt tuning, cost management.

---

## Cut #12: Context from Auth-Protected URLs

**What:** Fetch context from URLs requiring authentication.

**Why Cut:**
- Requires credential management for scraping
- Adds security complexity (storing third-party credentials)
- Most demo use cases use public URLs

**Alternative in v0:** Public URLs only; user can fetch locally and upload.

**When it might return:** v1, with explicit credential storage for scraping.

**Effort saved:** Credential management, browser automation complexity.

---

## Cut #13: Run Approval Workflow

**What:** Require approval before running shared endpoints.

**Why Cut:**
- Not needed when recipient owns/pays for runs
- Adds workflow complexity
- Slows down viral sharing

**Alternative in v0:** Recipient clicks "Run" directly (owns the run).

**When it might return:** v2+, for enterprise collaboration.

**Effort saved:** Approval UI, notification system, workflow logic.

---

## Cut #14: Run Scheduling / Cron

**What:** Schedule runs to repeat at intervals.

**Why Cut:**
- Requires job scheduling infrastructure
- Conflicts with "ephemeral execution" model
- Most v0 use cases are on-demand

**Alternative in v0:** Manual runs or external scheduler calling platform.

**When it might return:** v1+, as separate "workflows" feature.

**Effort saved:** Cron infrastructure, job queue, reliability guarantees.

---

## Cut #15: Run Chaining / Workflows

**What:** Chain multiple endpoints into workflows.

**Why Cut:**
- Requires workflow engine
- UI complexity (workflow builder)
- Out of scope for "run one endpoint"

**Alternative in v0:** Call multiple endpoints manually, or use code orchestration.

**When it might return:** v2, as "Workflows" product extension.

**Effort saved:** Workflow engine, UI builder, execution graph.

---

## Cut #16: A/B Testing for Endpoints

**What:** Run same input against multiple versions, compare results.

**Why Cut:**
- Niche use case
- UI complexity (comparison view)
- Not core to "share and run" model

**Alternative in v0:** Run twice manually, compare outputs.

**When it might return:** v1+, for ML experimentation use cases.

**Effort saved:** Comparison UI, version routing, statistical analysis.

---

## Cut #17: Rate Limiting Per Endpoint

**What:** User-configurable rate limits per endpoint.

**Why Cut:**
- Platform-level rate limits sufficient for v0
- Adds quota management UI
- Not needed for ephemeral execution

**Alternative in v0:** Platform-wide rate limits (200 req/run, 2 req/s per domain).

**When it might return:** v1, for public API / marketplace use cases.

**Effort saved:** Rate limit configuration UI, per-endpoint tracking.

---

## Cut #18: Custom Headers Configuration UI

**What:** UI for adding custom headers (Authorization, etc.).

**Why Cut:**
- Owner can use secrets for API keys
- Share recipients should use their own auth
- Avoids complex header injection UI

**Alternative in v0:** Headers via secrets (environment variables).

**When it might return:** v1, as "Advanced" panel for owner-only.

**Effort saved:** Header management UI, validation, redaction logic.

---

## Cut #19: Response Caching

**What:** Cache responses by input hash, skip execution if cache hit.

**Why Cut:**
- Requires cache storage and invalidation logic
- Can confuse users ("why didn't it run?")
- Not needed for demo/prototype use cases

**Alternative in v0:** Run history shows previous outputs (manual cache).

**When it might return:** v1+, as opt-in feature for expensive endpoints.

**Effort saved:** Cache storage, invalidation logic, UI indicators.

---

## Cut #20: GPU Auto-Detection

**What:** Automatically route to GPU if code imports `torch`/`tensorflow`.

**Why Cut:**
- Requires code parsing
- False positives (imports torch but doesn't use GPU)
- Adds cost without user consent

**Alternative in v0:** Owner manually toggles "Run with GPU".

**When it might return:** v1, as suggestion (not automatic).

**Effort saved:** AST parsing, import detection, heuristic tuning.

---

## Cut #21: Artifact Versioning

**What:** Version artifacts across runs, show diffs.

**Why Cut:**
- Requires artifact storage and diffing
- Not needed for "download and done" model
- Scope creep into version control

**Alternative in v0:** Each run has its own artifacts (7-day retention).

**When it might return:** v2+, for data pipeline use cases.

**Effort saved:** Versioning logic, diff UI, storage complexity.

---

## Cut #22: Collaborative Debugging

**What:** Share logs/errors with non-owners for debugging.

**Why Cut:**
- Logs are owner-only (may contain secrets)
- Adds sharing permission complexity
- Not core to v0 sharing model

**Alternative in v0:** Owner copies relevant logs manually if needed.

**When it might return:** v1, with explicit log sharing permission.

**Effort saved:** Log sharing permissions, redaction guarantees.

---

## Cut #23: Usage Analytics for Recipients

**What:** Show recipients their usage of shared endpoints.

**Why Cut:**
- Not needed when recipient owns runs
- Adds analytics infrastructure
- Low value for v0

**Alternative in v0:** Recipients see their own run history.

**When it might return:** v1, for power users.

**Effort saved:** Per-recipient analytics, attribution logic.

---

## Cut #24: Template Gallery

**What:** Public gallery of FastAPI templates with ratings/reviews.

**Why Cut:**
- Requires moderation
- Marketplace complexity (ratings, reviews, search)
- Sample repos sufficient for v0

**Alternative in v0:** Curated sample repos in documentation.

**When it might return:** v1+, as community feature.

**Effort saved:** Marketplace UI, moderation, abuse handling.

---

## Cut #25: Multi-Language Support (Non-Python)

**What:** Support Node.js, Go, Ruby, etc.

**Why Cut:**
- Each language requires separate base image
- Testing matrix explosion
- Most FastAPI users are Python-first

**Alternative in v0:** Python 3.11 only.

**When it might return:** v2+, if demand justifies.

**Effort saved:** Multi-language support, cross-language testing.

---

## Cut #26: Browser Automation as Platform Feature

**What:** Built-in browser automation (Playwright as service).

**Why Cut:**
- User code can use Playwright directly
- No need for platform abstraction
- Base image includes Playwright

**Alternative in v0:** User code imports and uses Playwright.

**When it might return:** Never (user code handles this).

**Effort saved:** Browser service infrastructure, session management.

---

## Cut #27: Secrets Rotation

**What:** Automatic secret rotation with version history.

**Why Cut:**
- User manages secrets externally (1Password, Vault)
- Platform doesn't enforce rotation policy
- Manual update sufficient for v0

**Alternative in v0:** User updates secrets manually when needed.

**When it might return:** v1+, for enterprise compliance.

**Effort saved:** Rotation logic, version history, audit trail.

---

## Cut #28: Secrets from External Vaults

**What:** Integrate with 1Password, AWS Secrets Manager, etc.

**Why Cut:**
- Adds OAuth/API integration for each vault
- Users can fetch and inject manually
- Not critical for v0

**Alternative in v0:** User copies secrets into platform.

**When it might return:** v1, for enterprise users.

**Effort saved:** Multiple vault integrations, token management.

---

## Cut #29: Endpoint Versioning UI

**What:** UI for managing multiple versions of single endpoint.

**Why Cut:**
- Project versions already handle this
- Adds UI complexity (version selector)
- Share links pin to project version

**Alternative in v0:** New project version = all endpoints versioned together.

**When it might return:** v1, if users need per-endpoint versioning.

**Effort saved:** Version management UI, routing complexity.

---

## Cut #30: Cost Breakdown by Endpoint

**What:** Show cost breakdown per endpoint run.

**Why Cut:**
- Billing not implemented in v0
- Adds cost tracking complexity
- Hard-coded quotas instead

**Alternative in v0:** Platform-level usage tracking only.

**When it might return:** v1, with billing launch.

**Effort saved:** Cost attribution, billing infrastructure.

---

## Summary: Time & Complexity Saved

**Estimated effort saved by these cuts:**
- **OAuth & integrations:** 4 weeks
- **Streaming & WebSockets:** 3 weeks
- **Warm runtimes & caching:** 4 weeks
- **Multi-language support:** 6 weeks
- **Marketplace & templates:** 4 weeks
- **Advanced analytics:** 2 weeks
- **Workflow engine:** 8 weeks
- **Miscellaneous features:** 4 weeks

**Total:** ~35 weeks (8+ months) saved.

**Result:** v0 can ship in **8-12 weeks** instead of **9+ months**.

---

## How to Use This Document

**For agents:** If tempted to add a feature, check if it's been cut. If yes, **do not build it**.

**For reviews:** Cite specific cut numbers in PR rejections ("This implements Cut #15: Run Scheduling").

**For users:** Sets expectations about what won't be in v0 (and why).

**For planning:** Reference when scoping v1/v2 features.

---

**Last Updated:** 2024-12-30
**Owner:** Agent 10 (Guardrail/Scope Killer)
**Status:** LOCKED for v0
