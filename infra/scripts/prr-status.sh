#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

GREEN="$(printf '\033[32m')"
YELLOW="$(printf '\033[33m')"
RED="$(printf '\033[31m')"
RESET="$(printf '\033[0m')"

ok() {
  echo "${GREEN}OK${RESET}  $1"
}

warn() {
  echo "${YELLOW}WARN${RESET} $1"
}

fail() {
  echo "${RED}FAIL${RESET} $1"
}

echo "RunIt PRR status dashboard"
echo "Repository: $ROOT_DIR"
echo "Date: $(date -Iseconds)"
echo

# Scorecard and release checklist presence
[[ -f docs/PRR_SCORECARD.md ]] && ok "docs/PRR_SCORECARD.md exists" || fail "docs/PRR_SCORECARD.md missing"
[[ -f docs/RELEASE_CHECKLIST.md ]] && ok "docs/RELEASE_CHECKLIST.md exists" || fail "docs/RELEASE_CHECKLIST.md missing"
[[ -f docs/PRR_100_EXECUTION_PLAN.md ]] && ok "docs/PRR_100_EXECUTION_PLAN.md exists" || fail "docs/PRR_100_EXECUTION_PLAN.md missing"

# Evidence templates
TEMPLATES=(
  "docs/evidence/templates/phase1-reliability-template.md"
  "docs/evidence/templates/phase2-fresh-machine-template.md"
  "docs/evidence/templates/phase3-launch-validation-template.md"
  "docs/evidence/templates/final-signoff-template.md"
)

for template in "${TEMPLATES[@]}"; do
  [[ -f "$template" ]] && ok "$template exists" || fail "$template missing"
done

echo
echo "Scorecard quick checks"
if rg -q 'Total \(/100\).*100/100' docs/PRR_SCORECARD.md; then
  ok "Scorecard currently shows 100/100"
else
  warn "Scorecard does not currently show 100/100"
fi

if rg -q "Residual P1 risks: None|Residual P1 risks: none" docs/PRR_SCORECARD.md; then
  ok "Residual risks marked as none"
else
  warn "Residual risks not yet marked as none"
fi

echo
echo "Script availability"
[[ -x infra/scripts/verify-prr-artifacts.sh ]] && ok "verify-prr-artifacts.sh executable" || warn "verify-prr-artifacts.sh not executable"
[[ -x infra/scripts/fresh-machine-verify.sh ]] && ok "fresh-machine-verify.sh executable" || warn "fresh-machine-verify.sh not executable"

echo
echo "Git branch and head"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "HEAD:   $(git rev-parse --short HEAD)"

echo
echo "Reminder:"
echo "- Use docs/evidence/templates/* for phase evidence."
echo "- Ensure links in docs/PRR_SCORECARD.md point to passing runs."
echo "- Final decision requires completed final-signoff-template.md."
