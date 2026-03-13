#!/usr/bin/env bash
# Fresh-Machine Verification Script
#
# Run this on a clean machine (or simulated: rm -rf node_modules .turbo; git clean -fdx)
# to validate the release checklist. Records results for PRR scorecard.
#
# Usage: ./infra/scripts/fresh-machine-verify.sh [--simulated]

set -euo pipefail

SIMULATED=false
[[ "${1:-}" == "--simulated" ]] && SIMULATED=true

echo "=== RunIt Fresh-Machine Verification ==="
echo "Date: $(date -I)"
echo "Simulated: $SIMULATED"
echo ""

# 1. Quick Start container (requires Docker)
echo "1) Quick Start container (web 3000, API 3001)"
if command -v docker &>/dev/null; then
  echo "   Docker available. Run: docker run -p 3000:3000 -p 3001:3001 -e NEXT_PUBLIC_API_URL=http://localhost:3001 -e MASTER_ENCRYPTION_KEY=\$(openssl rand -base64 32) ghcr.io/buildingopen/runit"
  echo "   [ ] Manual: verify web on 3000, API on 3001"
else
  echo "   SKIP: Docker not available"
fi

# 2. docker-compose
echo ""
echo "2) docker-compose up --build"
if command -v docker &>/dev/null; then
  echo "   Run: docker-compose up --build -d && curl -sf http://localhost:3001/health"
  echo "   [ ] Manual: verify /health responds on 3001"
else
  echo "   SKIP: Docker not available"
fi

# 3. npm run verify
echo ""
echo "3) npm run verify"
if npm run verify 2>/dev/null; then
  echo "   PASS"
else
  echo "   FAIL or SKIP (check node/native deps)"
fi

# 4. Golden-path E2E
echo ""
echo "4) Golden-path E2E"
if command -v npx &>/dev/null; then
  echo "   Run: npx playwright test tests/e2e/golden-path.spec.ts"
  echo "   [ ] Manual: requires control-plane and web running"
else
  echo "   SKIP: npx not available"
fi

# 5. README commands
echo ""
echo "5) README commands match runtime behavior"
echo "   [ ] Manual: verify README.md commands work"

echo ""
echo "=== Verification complete. Record results in docs/PRR_SCORECARD.md ==="
