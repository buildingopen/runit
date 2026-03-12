#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"

echo "Running RunIt smoke checks"
echo "  Web: ${WEB_BASE_URL}"
echo "  API: ${API_BASE_URL}"

echo "1) API health"
curl --fail --silent --show-error "${API_BASE_URL}/health" > /dev/null

echo "2) API deep health"
curl --fail --silent --show-error "${API_BASE_URL}/health/deep" > /dev/null

echo "3) OpenAPI spec"
curl --fail --silent --show-error "${API_BASE_URL}/v1/openapi.json" > /dev/null

echo "4) API docs landing"
curl --fail --silent --show-error "${API_BASE_URL}/docs" > /dev/null

echo "5) Web root"
curl --fail --silent --show-error "${WEB_BASE_URL}" > /dev/null

echo "Smoke checks passed"
