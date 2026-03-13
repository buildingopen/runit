# RunIt PRR 100 Execution Plan

This plan defines the remaining work to move from a critical `88/100` to an evidence-backed `100/100` (10/10 launch readiness).

## Objective

- Reach a true `100/100` in `docs/PRR_SCORECARD.md`
- Ensure every "Pass" claim maps to passing evidence
- Close remaining manual validation gaps with auditable records

## Governance and Accountability

Use this table as the required control plane for execution.

| Phase | Owner | Backup Owner | Target Date | Hard Cutoff (Local Time) |
|------|-------|--------------|-------------|---------------------------|
| Phase 1: Reliability Recovery | Federico (Release Engineer) | Control Plane Maintainer | 2026-03-13 | 18:00 |
| Phase 2: Fresh-Machine Validation | Federico (DX Owner) | Federico (Release Engineer) | 2026-03-14 | 18:00 |
| Phase 3: Real-World Validation | Federico (Product/Launch Owner) | Federico (DX Owner) | 2026-03-15 | 16:00 |
| Phase 4: Final Closure and Scoring | Federico (Release Owner) | Federico (Product/Launch Owner) | 2026-03-15 | 20:00 |

If a phase misses cutoff, release status is automatically **No-Go** until re-planned.

## Current Critical Baseline

| Category | Critical Score | Gap to Close |
|----------|----------------|--------------|
| Reliability | 27/30 | Non-smoke load scenarios currently failing thresholds |
| Developer Experience | 22/25 | Fresh-machine success not fully recorded |
| Documentation | 18/20 | Manual checklist completion evidence incomplete |
| Security and Trust | 15/15 | None |
| Growth Assets | 8/10 | Real-world launch asset validation missing |
| Total | 88/100 | 12 points |

---

## Phase 1: Reliability Recovery (P0)

### Goal

Turn non-smoke load test evidence from "ran" to "passed".

### Scope

- `.github/workflows/load-test.yml`
- `services/control-plane/tests/load/k6-config.js`
- `services/control-plane/tests/load/scenarios/mixed-workload.js`
- `docs/PRR_SCORECARD.md`

### Tasks

1. **Capture failure diagnostics from the latest workflow runs**
   - Export threshold failures for `load`, `stress`, `spike`
   - Identify top failing checks by endpoint and percentile

2. **Select and apply one reliability policy**
   - **Option A (preferred):** improve performance/error behavior, keep thresholds
   - **Option B:** adjust thresholds to realistic CI baseline, document rationale

   Required before Option B:
   - Root-cause note that explains whether failures come from product behavior or shared-runner variance
   - Before/after metric snapshot (`p95`, `p99`, error rate) with run URLs
   - Approval from Release Owner and Control Plane Maintainer

3. **Re-run scenarios via workflow_dispatch**
   - Run `load`
   - Run `stress`
   - Run `spike`
   - Repeat full set until criteria are met in two consecutive attempts

4. **Update scorecard evidence**
   - Attach final run URLs
   - Replace any failing links currently marked as pass
   - Update Reliability subtotal only when all three are green

### Exit Criteria

- All 3 non-smoke scenarios pass in CI
- No failing run is cited as "Pass" in scorecard
- Two consecutive full scenario sets (`load`, `stress`, `spike`) pass on the same branch

### Evidence to Record

- Run URL (load):
- Run URL (stress):
- Run URL (spike):
- Threshold summary:

---

## Phase 2: Fresh-Machine Validation Closure (P0)

### Goal

Prove first-time setup works end-to-end on a clean environment.

### Scope

- `docs/README.md` (fresh-machine checklist)
- `docs/RELEASE_CHECKLIST.md`
- `infra/scripts/fresh-machine-verify.sh`
- `docs/PRR_SCORECARD.md`

### Tasks

1. **Run clean-environment verification**
   - Preferred: clean VM/machine
   - Fallback: fresh temp clone with no prior artifacts
   - Minimum matrix: one macOS run and one Linux run (or document justified exception)

2. **Execute and capture these checks**
   - Quick Start container on ports `3000` and `3001`
   - `docker-compose up --build` and `/health` on `3001`
   - `npm run verify`
   - `npx playwright test tests/e2e/golden-path.spec.ts`
   - README command parity confirmation

3. **Create auditable record**
   - Date/time
   - Environment (OS, node, docker versions)
   - Command outputs (pass/fail)
   - Any deviations and fixes
   - Commit SHA under test
   - Verifier name

4. **Scorecard/checklist alignment**
   - Mark manual checks complete in `docs/RELEASE_CHECKLIST.md`
   - Update DevEx and Documentation evidence rows to reference actual run

### Exit Criteria

- All fresh-machine checklist items pass with recorded output
- DevEx and Documentation claims are backed by dated evidence
- Evidence captured for required environment matrix (or approved exception logged)

### Evidence to Record

- Environment:
- Verification date:
- Verification log path:
- Checklist completion owner:
- Commit SHA under test:

Use this canonical file path for each run:

- `docs/evidence/fresh-machine/<YYYY-MM-DD>-<env>-verification.md`

---

## Phase 3: Real-World Launch Asset Validation (P1)

### Goal

Validate launch assets outside CI and repository-only checks.

### Scope

- `apps/web/app/layout.tsx`
- `apps/web/public/og/runit-social-preview.svg`
- `docs/LAUNCH_KIT.md`
- `docs/LAUNCH_FIRST_APP.md`
- `docs/PRR_SCORECARD.md`

### Tasks

1. **Social preview validation**
   - Share a real URL in at least two external channels (for example, X and LinkedIn or Slack and X)
   - Confirm OG card renders correctly (image/title/description)

2. **Launch copy validation**
   - Send launch copy to at least 3 real readers
   - Capture feedback on clarity and positioning

3. **First-app onboarding validation**
   - Ask at least 2 new users to follow `docs/LAUNCH_FIRST_APP.md`
   - Capture friction points and update docs if needed

4. **Record proof in scorecard**
   - Date, channel, result, reviewer/reader initials

### Exit Criteria

- At least two external OG validations completed
- At least three launch-copy feedback artifacts logged
- At least two onboarding walkthrough artifacts logged
- Growth Assets score justified by real-world evidence

### Evidence to Record

- Shared URL:
- Channel used:
- OG render result:
- Copy feedback summary:
- Onboarding friction notes:

---

## Phase 4: Final Evidence Closure and Scoring (P0)

### Goal

Produce a defensible `100/100` package and release decision.

### Scope

- `docs/PRR_SCORECARD.md`
- `docs/RELEASE_CHECKLIST.md`
- `infra/scripts/verify-prr-artifacts.sh`

### Tasks

1. **Reconcile all evidence links**
   - Verify each referenced run is green where marked "Pass"
   - Remove stale links to failed runs
   - Ensure every evidence item references the release candidate commit SHA

2. **Run artifact verification**
   - `npm run verify:prr-artifacts`

3. **Finalize scorecard**
   - Update category subtotals and total
   - Update residual risks section with factual status only

4. **Finalize go/no-go checklist**
   - Complete all required checkboxes
   - Record final release decision

### Exit Criteria

- Scorecard totals `100/100` with evidence-backed rows
- Release checklist fully complete
- No unresolved P0 issues
- All evidence artifacts are SHA-aligned with the final release candidate

---

## Operating Rules

- Do not mark a category point complete without a linked artifact.
- If a run fails, keep it as failure evidence and run a new attempt.
- Keep one source of truth for final scoring: `docs/PRR_SCORECARD.md`.
- Keep manual sign-offs explicit (date + owner).
- Do not accept evidence older than the final release candidate SHA.
- If any phase regresses another gate, revert or patch before moving forward.
- If a cutoff is missed, freeze phase advancement and reset go/no-go to **No-Go**.

## Rollback and Reversion Rules

- If reliability changes cause new CI regressions, revert reliability changes and open remediation issue.
- If threshold tuning is used, retain a rollback commit ready to restore original thresholds.
- If documentation claims exceed evidence, downgrade score immediately and re-open closure tasks.

## Recommended Execution Order

1. Phase 1 (Reliability)
2. Phase 2 (Fresh-machine)
3. Phase 3 (Real-world validation)
4. Phase 4 (Final closure)

## Suggested Timeline

- Day 1: Phase 1
- Day 2: Phase 2
- Day 3: Phase 3 and Phase 4

- Day 1 (`2026-03-13`): Phase 1 complete by 18:00
- Day 2 (`2026-03-14`): Phase 2 complete by 18:00
- Day 3 (`2026-03-15`): Phase 3 complete by 16:00, Phase 4 complete by 20:00

Status command dashboard:

- `./infra/scripts/prr-status.sh`

## Definition of Done (10/10)

All conditions must be true:

1. `load`, `stress`, `spike` are green and linked in scorecard
2. Fresh-machine checklist is fully passed and recorded
3. Real-world launch asset validation is completed and logged
4. `docs/PRR_SCORECARD.md` is consistent, auditable, and totals `100/100`

## Final Sign-Off Block (Required)

Fill this block at closure time:

- Release candidate SHA:
- Release owner:
- QA/Verification owner:
- Security owner:
- Decision date/time:
- Decision: Go / No-Go
- Residual risks accepted (if any):
- Rollback owner:
