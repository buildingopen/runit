#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"

check_url() {
  local label="$1"
  local url="$2"

  echo "${label}"
  if ! curl --fail --silent --show-error "${url}" > /dev/null; then
    echo "Smoke check failed for: ${url}" >&2
    exit 1
  fi
}

echo "Running RunIt smoke checks"
echo "  Web: ${WEB_BASE_URL}"
echo "  API: ${API_BASE_URL}"

check_url "1) API health" "${API_BASE_URL}/health"
check_url "2) API deep health" "${API_BASE_URL}/health/deep"
check_url "3) OpenAPI spec" "${API_BASE_URL}/v1/openapi.json"
check_url "4) API docs landing" "${API_BASE_URL}/docs"
check_url "5) Web root" "${WEB_BASE_URL}"

echo "Smoke checks passed"
