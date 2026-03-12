# Quality Gates

This document defines the mandatory pass criteria for CI and local verification.

## Required Local Command

Run this before pushing:

```bash
npm run verify
```

`verify` enforces:

- workspace lint
- workspace tests
- workspace build
- TypeScript coverage thresholds when Vitest coverage provider is available (clear skip otherwise)
- runner pytest suite with `>= 77%` coverage floor
- SDK pytest suite with `>= 77%` coverage floor

## CI Pass Criteria

A PR is considered healthy only when all CI jobs are green:

- TypeScript workspace job
- Python runner job
- Python SDK job
- Golden-path E2E job (blocking on pull requests and `main`)

## Coverage Floors

Coverage is currently enforced for Python services:

- `services/runner`: `>= 77%`
- `services/runner/sdk`: `>= 77%`

Coverage is enforced through CI command flags and mirrored in project config where applicable.

## Flaky Test Policy

- Flaky tests are not accepted as permanent state.
- A flaky test may be quarantined only with:
  - linked tracking issue
  - owner
  - expiration date
- Quarantine must be removed once a fix is merged.

## TypeScript Coverage Activation

TypeScript coverage checks are wired into `npm run verify` and CI using `npm run verify:ts-coverage`.

If `@vitest/coverage-v8` is unavailable, the step exits successfully with an explicit skip message.
Once the package is installed, thresholds are enforced for TypeScript workspaces.

To require fail-fast behavior when the provider is missing:

```bash
REQUIRE_TS_COVERAGE=true npm run verify:ts-coverage
```

To activate enforcement:

```bash
npm install -D @vitest/coverage-v8
```
