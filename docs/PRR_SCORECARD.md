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
| Branch or PR | |
| Commit SHA | |
| CI run URL (`ci.yml`) | |
| Smoke/load run URL (`load-test.yml`) | |
| Release readiness run URL (`release-readiness.yml`) | |
| Security run URL (`security.yml`) | |
| Local verification date | |
| Reviewer | |

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
| TypeScript | | | |
| Python Runner | | | |
| Python SDK | | | |
| Golden-path E2E | | | |
| Load and smoke workflows | | | |
| Reliability subtotal (/30) | | | |

### Developer Experience (25)

- [ ] Quick Start (`docker run`) works from `README.md`
- [ ] Web is reachable on `3000` and API on `3001`
- [ ] Self-host path (`docker-compose up --build`) works
- [ ] `npm run verify` succeeds locally
- [ ] First app can go live and run

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| Quick Start path | | | |
| Port and URL defaults | | | |
| Self-host path | | | |
| `npm run verify` | | | |
| First app flow | | | |
| DevEx subtotal (/25) | | | |

### Documentation (20)

- [ ] `README.md`, `docs/DEVELOPMENT_SETUP.md`, and `docs/TESTING_GUIDE.md` agree
- [ ] No conflicting port/URL instructions
- [ ] Fresh-machine checklist completed
- [ ] Launch guides present (`LAUNCH_FIRST_APP.md`, `LAUNCH_KIT.md`)

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| Docs consistency | | | |
| Port and URL consistency | | | |
| Fresh-machine checklist | | | |
| Launch guides present | | | |
| Docs subtotal (/20) | | | |

### Security and Trust (15)

- [ ] `SECURITY.md` is current
- [ ] Security workflow is active (`.github/workflows/security.yml`)
- [ ] Dependabot config exists (`.github/dependabot.yml`)
- [ ] Secrets scanning active in CI

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| `SECURITY.md` current | | | |
| Security workflow | | | |
| Dependabot config | | | |
| Secrets scanning | | | |
| Security subtotal (/15) | | | |

### Growth Assets (10)

- [ ] README has demo visuals above the fold
- [ ] Social preview image configured in `apps/web/app/layout.tsx`
- [ ] Launch copy is ready in `docs/LAUNCH_KIT.md`
- [ ] Quick onboarding path is ready in `docs/LAUNCH_FIRST_APP.md`

Evidence notes:

| Check | Evidence link or command output | Status | Notes |
|-------|---------------------------------|--------|-------|
| README visuals | | | |
| Social preview | | | |
| Launch copy | | | |
| Quick onboarding | | | |
| Growth subtotal (/10) | | | |

## Final Tally

| Category | Score |
|----------|-------|
| Reliability | |
| Developer Experience | |
| Documentation | |
| Security and Trust | |
| Growth Assets | |
| Total (/100) | |

Use this summary to make the release call:

- Outstanding P0 issues:
- Residual P1 risks:
- Recommended launch date:

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
