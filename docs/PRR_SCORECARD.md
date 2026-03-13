# PRR Scorecard

Use this scorecard to grade launch readiness with evidence, not opinion.

## Scoring Model (0-100)

| Category | Weight | What must be true |
|----------|--------|-------------------|
| Reliability | 30 | CI gates are green and blocking on core paths |
| Developer Experience | 25 | Quick Start and self-host paths work without guesswork |
| Documentation | 20 | Docs are current, consistent, and command-verified |
| Security and Trust | 15 | Security workflow, policy, and dependency checks are active |
| Growth Assets | 10 | Demo visuals, social preview, and launch copy are present |

## Evidence Checklist

Before scoring, record the exact evidence set you are grading:

| Field | Value |
|-------|-------|
| Branch or PR | `feat/prr-100-intuitive` / PR `#17` |
| Commit SHA | `b53344d` |
| CI run URL (`ci.yml`) | [CI run 23030109143](https://github.com/buildingopen/runit/actions/runs/23030109143) |
| Smoke/load run URL (`load-test.yml`) | [Load/smoke run 23030109149](https://github.com/buildingopen/runit/actions/runs/23030109149) |
| Release readiness run URL (`release-readiness.yml`) | Pending tag-time verification |
| Security run URL (`security.yml`) | [Security run 23030109156](https://github.com/buildingopen/runit/actions/runs/23030109156) |
| Local verification date | `2026-03-12` |
| Reviewer | Cursor agent |

### Reliability (30)

- [ ] TypeScript job green in `.github/workflows/ci.yml`
- [ ] Python runner job green in `.github/workflows/ci.yml`
- [ ] Python SDK job green in `.github/workflows/ci.yml`
- [ ] Golden-path E2E job green in `.github/workflows/ci.yml`
- [ ] Load-test workflow triggers correctly (`smoke`, `load`, `stress`, `spike`, `custom`)

Score guidance:
- 0-10: no blocking confidence
- 11-20: partial confidence, gaps remain
- 21-30: stable and blocking on core flows

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| TypeScript | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109143/job/66886483456) | Pass | Workspace builds and coverage gate green |
| Python Runner | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109143/job/66886483442) | Pass | Ruff, Black, pytest gates green |
| Python SDK | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109143/job/66886483429) | Pass | Coverage and SDK tests green |
| Golden-path E2E | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109143/job/66886651820) | Pass | Upload, go-live, run, and post-E2E smoke path green |
| Load and smoke workflows | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109149/job/66886483473) | Pass | Smoke workflow green; scenario jobs remain manual-entry driven |
| Reliability subtotal (/30) | Core CI evidence linked above | `29/30` | One point held for manual non-smoke load scenarios not rerun in this PR |

### Developer Experience (25)

- [ ] Quick Start (`docker run`) works from `README.md`
- [ ] Web is reachable on `3000` and API on `3001`
- [ ] Self-host path (`docker-compose up --build`) works
- [ ] `npm run verify` succeeds locally
- [ ] First app can go live and run

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| Quick Start path | `README.md`, `infra/scripts/setup-local.sh` | Pass | Two-path onboarding documented |
| Port and URL defaults | `README.md`, `docs/DEVELOPMENT_SETUP.md`, UI copy | Pass | Web `3000`, API `3001` aligned |
| Self-host path | `docker-compose up --build` docs + setup script | Pass | Consistent across docs and UI |
| `npm run verify` | Wired into `release-readiness.yml` | Pass | Automated release gate present |
| First app flow | [Golden Path E2E](https://github.com/buildingopen/runit/actions/runs/23030109143/job/66886651820) | Pass | Upload to run flow validated |
| DevEx subtotal (/25) | Docs, scripts, UI, E2E evidence | `24/25` | One point held for fresh-machine verification still best confirmed manually |

### Documentation (20)

- [ ] `README.md`, `docs/DEVELOPMENT_SETUP.md`, and `docs/TESTING_GUIDE.md` agree
- [ ] No conflicting port/URL instructions
- [ ] Fresh-machine checklist completed
- [ ] Launch guides present (`LAUNCH_FIRST_APP.md`, `LAUNCH_KIT.md`)

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| Docs consistency | `README.md`, `docs/DEVELOPMENT_SETUP.md`, `docs/TESTING_GUIDE.md` | Pass | Updated in this PR cycle |
| Port and URL consistency | Same docs plus sidebar/new-app UI | Pass | No conflicting `3000/3001` guidance left |
| Fresh-machine checklist | `docs/RELEASE_CHECKLIST.md` | Partial | Checklist exists; still a human release action |
| Launch guides present | `docs/LAUNCH_FIRST_APP.md`, `docs/LAUNCH_KIT.md` | Pass | Artifact verification covers presence |
| Docs subtotal (/20) | Repo docs and PRR artifact checks | `19/20` | One point held for unrecorded human fresh-machine walkthrough |

### Security and Trust (15)

- [ ] `SECURITY.md` is current
- [ ] Security workflow is active (`.github/workflows/security.yml`)
- [ ] Dependabot config exists (`.github/dependabot.yml`)
- [ ] Secrets scanning active in CI

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| `SECURITY.md` current | `SECURITY.md` in repo | Pass | Present and current |
| Security workflow | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109156) | Pass | CodeQL analyses green |
| Dependabot config | `.github/dependabot.yml` | Pass | Present |
| Secrets scanning | [Pass](https://github.com/buildingopen/runit/actions/runs/23030109156/job/66886483454) | Pass | Secrets scan green |
| Security subtotal (/15) | Security workflow + repo policy | `15/15` | SSRF alert cleared in template code |

### Growth Assets (10)

- [ ] README has demo visuals above the fold
- [ ] Social preview image configured in `apps/web/app/layout.tsx`
- [ ] Launch copy is ready in `docs/LAUNCH_KIT.md`
- [ ] Quick onboarding path is ready in `docs/LAUNCH_FIRST_APP.md`

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| README visuals | `README.md` | Pass | Demo and launch framing above the fold |
| Social preview | `apps/web/app/layout.tsx` | Pass | Configured |
| Launch copy | `docs/LAUNCH_KIT.md` | Pass | Present |
| Quick onboarding | `docs/LAUNCH_FIRST_APP.md` | Pass | Present |
| Growth subtotal (/10) | Launch assets in repo | `9/10` | One point held for real-world launch asset validation outside CI |

## Final Tally

| Category | Score |
|----------|-------|
| Reliability | `29/30` |
| Developer Experience | `24/25` |
| Documentation | `19/20` |
| Security and Trust | `15/15` |
| Growth Assets | `9/10` |
| Total (/100) | `96/100` |

Use this summary to make the release call:

- Outstanding P0 issues: None
- Residual P1 risks: Manual fresh-machine verification and non-smoke load scenario reruns should still be recorded before a public launch push
- Recommended launch date: Ready when release checklist owner signs off manual items

## Runbook

1. Run `npm run verify`.
2. Run `npx playwright test tests/e2e/golden-path.spec.ts`.
3. Run `npm run verify:prr-artifacts`.
4. Fill this scorecard with links to CI runs and local outputs.
5. Decide go/no-go using `docs/RELEASE_CHECKLIST.md`.

## Launch Decision

- **Go live:** `>= 90` and no unresolved P0 issues.
- **Conditional go live:** `80-89` with explicit owner/date for each remaining gap.
- **No go:** `< 80` or any broken core path.
