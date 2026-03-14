# RunIt Pre-Release Review (PRR)

**Date:** March 12, 2025  
**Version:** 0.1.0  
**Reviewer:** Automated PRR

---

## Executive Summary

RunIt is a well-architected platform for turning AI-generated Python code into live, shareable apps. The codebase demonstrates strong security practices, clear separation of concerns, and thoughtful UX. Several items need attention before launch: test environment configuration, npm vulnerabilities, and CI reliability.

---

## Scores (0-100)

| Category | Score | Notes |
|----------|-------|-------|
| **UX** | 82 | Polished marketing page, auto-generated forms, good error display. Some loading states could be clearer. |
| **Security** | 85 | Strong sandbox, envelope encryption, timing-safe auth. npm audit shows 5 vulnerabilities to address. |
| **Launch Readiness** | 78 | Core flows work; test flakiness and env config gaps need fixing. |
| **Code Quality** | 88 | Clean architecture, good test coverage, consistent patterns. |
| **Documentation** | 80 | Solid README, .env.example, CONTRIBUTING. API docs could be richer. |

**Overall Launch Readiness: 78/100**

---

## 1. UX Review (82/100)

### Strengths
- **Marketing page:** Clean, modern design with gradient accents, trust badges ("Free forever", "No credit card"), testimonials, and template gallery. Follows CLAUDE.md terminology (Action, Go Live, Memory).
- **Auto-generated forms:** OpenAPI schema drives form generation; type hints map to inputs. Good for non-technical users.
- **Result display:** `ResultViewer` shows HTTP status, duration, warnings, error messages, and suggested fixes. `AutoMappedOutput` renders URLs as clickable links.
- **Error handling:** Global `error.tsx` with "Something went wrong" and Try again. Run errors show `error_message`, `error_class`, `suggested_fix`.
- **Share flow:** Share links, share modal. Clear CTA hierarchy.

### Areas to Improve
- **Loading states:** Deploying page and run execution could use more explicit progress indicators.
- **Empty states:** Some pages could better guide first-time users.
- **Accessibility:** No explicit aria-labels or keyboard nav audit; consider a pass.
- **Mobile:** Sticky CTA exists; full mobile responsiveness not deeply validated.

---

## 2. Security Audit (85/100)

### Strengths
- **Docker sandbox:** Runner uses `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges:true`, `--pids-limit 256`. Strong isolation.
- **Secrets:** Envelope encryption (AES-256-GCM) with KMS support. LocalKMS uses PBKDF2 (100k iterations). AWS KMS option for production.
- **Auth:** Timing-safe API key comparison. Bearer token validation. DEV_MODE blocked in production.
- **Security headers:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy. Production: HSTS, CSP.
- **Sensitive data:** Authorization, cookie, proxy headers stripped before persisting runs.
- **Command injection:** `spawn` used with array args (no shell). Projects route uses `spawn(cmd, args)` for git/zip.
- **Rate limiting:** Optional (cloud mode). IP filtering for runs (cloud mode).
- **Request validation:** Body size limit, Content-Type validation, request timeout (30s).

### Vulnerabilities (npm audit)
```
5 vulnerabilities (2 low, 1 moderate, 2 high)
- @hono/node-server: authorization bypass (high)
- express-rate-limit: IPv4-mapped IPv6 bypass (high)
- fast-xml-parser: stack overflow (moderate)
- hono: prototype pollution (moderate)
```
**Action:** Run `npm audit fix` and verify no regressions. Consider pinning fixed versions.

### Recommendations
- Add `RUNIT_DATA_DIR` to vitest config so tests don't require manual env in CI.
- Document that `MASTER_ENCRYPTION_KEY` is required; fail fast if missing in production.
- Consider adding request signing or CSRF for state-changing operations if applicable.

---

## 3. Test Results

### Passing (with RUNIT_DATA_DIR)
- **Control-plane (isolated):** 515 tests pass when `RUNIT_DATA_DIR=/tmp/runit-test-data` is set.
- **Packages:** client (16), shared (23), mcp-server (61), ui (20), cli (32), openapi-form (31), web (45) all pass.
- **Lint:** All packages pass `npm run lint`.

### Failing / Flaky
- **Fixed:** Added `RUNIT_DATA_DIR=/tmp/runit-test-data` to vitest.config.ts. Storage-store, secrets-store, and one-click-deploy tests now pass.
- **Remaining:** One integration test "version hash is deterministic for same code" fails intermittently (hash differs between runs; likely non-deterministic input in zip/code bundle).
- **Python tests:** `pytest` not in PATH in default environment; `verify:runner` and `verify:sdk` fail. CI may use a different setup.

### Build
- Full `npm run build` can fail if `@runit/shared` is not built first (turbo dependency ordering). Sequential build of shared then control-plane succeeds.
- `@runit/ui` outputs warning: "no output files found for task" (turbo.json outputs key).

### Recommendation
1. Add `RUNIT_DATA_DIR` to `services/control-plane/package.json` test script:  
   `"test": "RUNIT_DATA_DIR=/tmp/runit-test-data NODE_ENV=test ..."`
2. Or set it in `vitest.config.ts` env.
3. Ensure CI sets `RUNIT_DATA_DIR` for control-plane tests.
4. Add pytest to dev setup or document that Python tests require `pip install -e ".[dev]"` in runner.

---

## 4. Launch Readiness (78/100)

### Ready
- Docker Compose works. Health check, tunnel profile.
- README quick start: `docker run -p 3000:3000 ghcr.io/buildingopen/runit`.
- .env.example documents all variables. MASTER_ENCRYPTION_KEY required.
- OSS mode: single-user when no API_KEY; API key auth when set.
- Two-repo strategy (OSS + cloud) is clear. `createApp()` factory allows cloud extension.

### Gaps
1. **Test reliability:** Fix RUNIT_DATA_DIR for CI; resolve one-click-deploy flakiness in parallel runs.
2. **npm vulnerabilities:** Address 5 audit findings.
3. **Build order:** Ensure turbo consistently builds shared before control-plane (or fix workspace resolution).
4. **Python tests:** Document or automate pytest in verify script.
5. **Deprecation warnings:** `punycode` deprecation in Node; consider addressing.

---

## 5. Code Quality (88/100)

- **Architecture:** Clear split: control-plane (Hono), runner (Python/Docker), packages (cli, client, mcp-server, openapi-form, shared, ui), apps (web).
- **Terminology:** CLAUDE.md enforced (Action, API Keys, Memory, Go Live, remember()).
- **Error handling:** Centralized in app.ts. Sentry integration. Logger middleware.
- **Types:** Shared contracts, Zod schemas. TypeScript throughout.
- **No em dashes** in user-facing text (per style guide).

---

## 6. Documentation (80/100)

- README: Quick start, examples, self-hosting, env vars, API reference, architecture.
- CONTRIBUTING: Branch naming, commits, tests, lint.
- .env.example: Comprehensive with comments.
- Inline ABOUTME comments in key modules.
- API: OpenAPI at `/v1/openapi.json`. Could add more examples and error response schemas.

---

## Recommended Actions Before Launch

| Priority | Action |
|----------|--------|
| P0 | ~~Set `RUNIT_DATA_DIR` in control-plane test script or vitest config for CI~~ DONE |
| P0 | Run `npm audit fix` and validate |
| P1 | Fix one-click-deploy test isolation (ensure mocks/DB don't conflict in parallel) |
| P1 | Fix turbo build order or outputs for @runit/ui |
| P2 | Document pytest requirement for `verify:runner` and `verify:sdk` |
| P2 | Add explicit loading states for deploy and run flows |

---

## Conclusion

RunIt is in good shape for a beta launch. The security model is strong, the UX is polished, and the architecture supports both OSS and cloud deployments. Addressing the test environment, npm vulnerabilities, and minor build/test issues will significantly improve launch readiness.
