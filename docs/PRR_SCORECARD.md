# PRR Scorecard

Use this scorecard to grade launch readiness with evidence.

## Scoring Model (0-100)

| Category | Weight | What must be true |
|----------|--------|-------------------|
| Reliability | 30 | CI gates are green and blocking on core paths |
| Developer Experience | 25 | Quick Start and self-host paths work without guesswork |
| Documentation | 20 | Docs are current, consistent, and command-verified |
| Security and Trust | 15 | Security workflow, policy, and dependency checks are active |
| Growth Assets | 10 | Demo visuals, social preview, and launch copy are present |

## Evidence Checklist

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

### Developer Experience (25)

- [ ] Quick Start (`docker run`) works from `README.md`
- [ ] Web is reachable on `3000` and API on `3001`
- [ ] Self-host path (`docker-compose up --build`) works
- [ ] `npm run verify` succeeds locally
- [ ] First app can go live and run

### Documentation (20)

- [ ] `README.md`, `docs/DEVELOPMENT_SETUP.md`, and `docs/TESTING_GUIDE.md` agree
- [ ] No conflicting port/URL instructions
- [ ] Fresh-machine checklist completed
- [ ] Launch guides present (`LAUNCH_FIRST_APP.md`, `LAUNCH_KIT.md`)

### Security and Trust (15)

- [ ] `SECURITY.md` is current
- [ ] Security workflow is active (`.github/workflows/security.yml`)
- [ ] Dependabot config exists (`.github/dependabot.yml`)
- [ ] Secrets scanning active in CI

### Growth Assets (10)

- [ ] README has demo visuals above the fold
- [ ] Social preview image configured in `apps/web/app/layout.tsx`
- [ ] Launch copy is ready in `docs/LAUNCH_KIT.md`
- [ ] Quick onboarding path is ready in `docs/LAUNCH_FIRST_APP.md`

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
