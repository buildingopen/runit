# RunIt Documentation

## Guides

- [Development Setup](DEVELOPMENT_SETUP.md) — Environment configuration and local development
- [Testing Guide](TESTING_GUIDE.md) — Running unit, integration, and E2E tests
- [SDK Guide](SDK_GUIDE.md) — Using the Python SDK in your FastAPI apps
- [First App in 2 Minutes](LAUNCH_FIRST_APP.md) — Fast onboarding path
- [Launch Kit](LAUNCH_KIT.md) — Distribution copy and launch checklist
- [PRR Scorecard](PRR_SCORECARD.md) — Launch-readiness scoring rubric
- [Release Checklist](RELEASE_CHECKLIST.md) — Go/no-go and rollback runbook

## Additional Resources

- [Contributing](../CONTRIBUTING.md) — How to contribute to RunIt
- [Security](../SECURITY.md) — Security policy and vulnerability reporting
- [Changelog](../CHANGELOG.md) — Version history and release notes

## Fresh-Machine Validation Checklist

Run this checklist before release:

- [ ] Quick Start container runs with web on `3000` and API on `3001`
- [ ] `docker-compose up --build` starts the control plane API on `3001`
- [ ] `npm run verify` passes locally
- [ ] Golden-path E2E passes (`npx playwright test tests/e2e/golden-path.spec.ts`)
- [ ] README commands match actual runtime behavior
