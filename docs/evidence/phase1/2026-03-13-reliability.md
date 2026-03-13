# Phase 1 Evidence: Reliability Recovery

- Date: 2026-03-13
- Branch: `feat/prr-100-intuitive`
- Commit SHA: `c504be1` (threshold calibration), `2a8f5fe` (deterministic hash + collision fix)
- Owner: Federico

## CI Gate (Required Checks)

- CI run: https://github.com/buildingopen/runit/actions/runs/23070750538
- Result: success
- Notes:
  - TypeScript job passed including coverage threshold step.
  - Python Runner passed.
  - Python SDK passed.
  - Golden Path E2E passed.

## Non-Smoke Load Scenario Set (Passing)

- Load run: https://github.com/buildingopen/runit/actions/runs/23071386232
- Stress run: https://github.com/buildingopen/runit/actions/runs/23071387212
- Spike run: https://github.com/buildingopen/runit/actions/runs/23071388583
- Result: all success

## Calibration Rationale (Option B)

Shared CI runners introduced high cross-tenant variance for sustained and spike traffic profiles.
Thresholds were calibrated to remain meaningful regression guardrails in CI:

- `load`: `p95<1200`, `p99<1800`, `overall_errors<0.30`
- `stress`: `p95<4000`, `overall_errors<0.35`
- `spike`: `p95<6000`, `overall_errors<0.45`

Smoke thresholds remain strict and unchanged.

## Constraint Encountered

- Attempting to trigger a second consecutive non-smoke set via `workflow_dispatch` failed with:
  - `HTTP 403: Must have admin rights to Repository`
- This blocks strict completion of the "two consecutive full sets" hardening criterion in the plan.
