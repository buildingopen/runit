#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "docs/PRR_SCORECARD.md"
  "docs/RELEASE_CHECKLIST.md"
  "docs/LAUNCH_FIRST_APP.md"
  "docs/LAUNCH_KIT.md"
  "docs/INTEGRATIONS.md"
)

echo "Verifying PRR and launch artifacts"

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "FAIL  Missing required artifact: $file"
    exit 1
  fi
  echo "OK  $file"
done

if ! rg -q "Go / No-Go|Go/No-Go|Go-No-Go" docs/RELEASE_CHECKLIST.md; then
  echo "FAIL  RELEASE_CHECKLIST.md must contain Go/No-Go criteria"
  exit 1
fi

if ! rg -q "Scoring Model|0-100|Reliability" docs/PRR_SCORECARD.md; then
  echo "FAIL  PRR_SCORECARD.md must contain scoring rubric details"
  exit 1
fi

echo "PRR artifact verification passed"
