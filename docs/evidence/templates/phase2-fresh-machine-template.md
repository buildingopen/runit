# Phase 2 Evidence Template: Fresh-Machine Validation

- Date:
- Owner:
- Commit SHA under test:

## Environment Matrix

| Environment | OS | Node | npm | Docker | Status |
|-------------|----|------|-----|--------|--------|
| macOS |  |  |  |  |  |
| Linux |  |  |  |  |  |

If Linux run is not available, document exception and approver:

- Exception reason:
- Approved by:

## Checklist Results

| Check | Command/Action | Result | Evidence |
|------|-----------------|--------|----------|
| Quick Start container ports 3000/3001 | `docker run ...` |  |  |
| `docker-compose up --build` + `/health` | `docker-compose up --build` |  |  |
| Verify suite | `npm run verify` |  |  |
| Golden path E2E | `npx playwright test tests/e2e/golden-path.spec.ts` |  |  |
| README parity | Manual validation |  |  |

## Deviations and Fixes

- Deviation:
- Fix:

## Sign-off

- Verifier:
- Reviewer:
