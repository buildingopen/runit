# Testing Guide

This guide defines the current test strategy and commands for RunIt.

Authoritative CI pass/fail rules are in `docs/QUALITY_GATES.md`.

## Test Layers

- **Golden-path E2E**: validates the core user flow from web UI to execution result.
- **Integration tests**: validates service boundaries and multi-step flows.
- **Unit tests**: validates isolated business logic and utilities.

## Current Stack

- **TypeScript**: Vitest
- **Web E2E**: Playwright
- **Python**: pytest (+ pytest-cov)
- **Load tests**: k6 (control-plane scenarios)

## Runtime Defaults for Tests

- Web UI: `http://localhost:3000`
- Control plane API: `http://localhost:3001`

Keep these defaults aligned with `README.md`, `Dockerfile`, and `docs/DEVELOPMENT_SETUP.md`.

## Commands

### Monorepo

```bash
# Full verification
npm run verify

# Individual gates
npm run lint
npm run test
npm run build
```

### TypeScript Packages and Services

```bash
# Root workspace tests
npm run test

# Control plane tests
cd services/control-plane && npm run test
```

### Python Runner and SDK

```bash
# Runner
cd services/runner && pytest tests/ -v --tb=short --cov=src --cov-report=term-missing

# SDK
cd services/runner/sdk && PYTHONPATH=. pytest tests/ -v --tb=short --cov=runit --cov-report=term-missing
```

### Golden-Path E2E (Playwright)

```bash
# From repo root
npx playwright install --with-deps chromium
npx playwright test tests/e2e/golden-path.spec.ts
```

Playwright uses `playwright.config.ts`, which starts:

- control plane on `3001`
- web app on `3000` with `NEXT_PUBLIC_API_URL=http://localhost:3001`

### Web Package E2E

```bash
cd apps/web
npx playwright install --with-deps chromium
npm run test:e2e
```

## CI Expectations

A PR is healthy only when all blocking jobs pass:

- TypeScript
- Python runner
- Python SDK
- Golden-path E2E

See `.github/workflows/ci.yml` for exact workflow details.

## Troubleshooting

### E2E test fails to connect

- Ensure no local services are already occupying `3000` or `3001`.
- Ensure `NEXT_PUBLIC_API_URL` points to `http://localhost:3001`.
- Reinstall Playwright browser: `npx playwright install --with-deps chromium`.

### Runner execution fails in E2E

- Docker must be available to the control-plane process.
- Validate API health first: `curl http://localhost:3001/health`.

### Coverage gate fails

- Run the exact failing command locally from CI logs.
- Keep Python coverage at or above thresholds defined in `docs/QUALITY_GATES.md`.
