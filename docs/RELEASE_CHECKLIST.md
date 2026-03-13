# Release Checklist

This checklist defines go/no-go criteria before tagging a release.

## Pre-Release Checks

### CI and Quality Gates

- [ ] Latest `main` commit has green CI (`.github/workflows/ci.yml`)
- [ ] Security workflow passed (`.github/workflows/security.yml`)
- [ ] No failing required checks on protected branch

### Manual Smoke Checks

- [ ] Quick Start command from `README.md` works on a clean machine
- [ ] `docker-compose up --build` works and `/health` responds on `3001`
- [ ] Web UI can upload sample app, go live, and execute one run
- [ ] Share link can be created and opened

Run `./infra/scripts/fresh-machine-verify.sh` for a guided checklist. See `docs/README.md` Fresh-Machine Validation Checklist.

### Documentation and Assets

- [ ] `README.md` reflects current commands and runtime defaults
- [ ] `CHANGELOG.md` updated for the release
- [ ] Launch docs updated (`LAUNCH_KIT.md`, `LAUNCH_FIRST_APP.md`)
- [ ] PRR scorecard completed (`PRR_SCORECARD.md`)

## Go / No-Go Rule

Release only if all are true:

- [ ] PRR score is `>= 90/100`
- [ ] No unresolved P0 issue
- [ ] Golden-path E2E is green

If any condition fails, mark release as **No-Go** and create a remediation issue.

## Rollback Notes

If severe regression is found after release:

1. Pause promotion and communicate incident in issue tracker.
2. Revert to previous known-good image tag in deployment target.
3. Re-run smoke checks on rollback version.
4. Open follow-up issue with root cause and prevention action.

## Post-Launch Monitoring (First 24h)

- [ ] Watch new issues labeled `bug` and `launch`
- [ ] Track failures in CI and fix regressions quickly
- [ ] Collect onboarding friction reports from `Launch Feedback` template
- [ ] Update launch copy/docs if repeated confusion appears
