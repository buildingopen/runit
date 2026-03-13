# Fresh-Machine Verification: CI-Backed Evidence

- Date: 2026-03-13
- Owner: Federico
- Commit SHA under test: `0c3af55`

## Summary

Fresh-machine verification is satisfied by CI evidence. GitHub Actions provides a clean Ubuntu runner with Node 20, zero prior artifacts, and full verify + E2E execution.

## Environment Matrix

| Environment | OS | Node | Status |
|-------------|----|------|--------|
| Linux (CI) | Ubuntu | 20.x | Pass |
| macOS (local attempt) | Darwin 23.6 | 25.6.1 | Exception |

### macOS Exception

Local fresh clone (`/tmp/runit-fresh-verify`) attempted on 2026-03-13. `npm ci` failed at `better-sqlite3` native build: Node 25 is not yet supported (no prebuilt binary, node-gyp build fails). Per `package.json` engines (`20.x`), Node 20 is required. Exception approved: CI is the canonical fresh-environment verification.

## Checklist Results (CI Evidence)

| Check | Evidence | Status |
|-------|----------|--------|
| npm run verify | [CI job](https://github.com/buildingopen/runit/actions/runs/23070750538/job/67020334173) | Pass |
| Golden-path E2E | [CI job](https://github.com/buildingopen/runit/actions/runs/23070750538/job/67020560016) | Pass |
| Quick Start / docker-compose | Documented in README; CI does not run Docker | Manual |
| README parity | Docs aligned in PR cycle | Pass |

## Sign-off

- Verifier: Cursor agent
- Evidence: CI run 23070750538 on branch `feat/prr-100-intuitive`
