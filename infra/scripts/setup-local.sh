#!/usr/bin/env bash
set -euo pipefail

echo "RunIt local setup"
echo ""

require_cmd() {
  local cmd="$1"
  local help="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "OK  $cmd found"
  else
    echo "FAIL  $cmd not found"
    echo "      $help"
    exit 1
  fi
}

require_cmd "node" "Install Node.js 20.x"
require_cmd "npm" "Install npm (>= 9)"
require_cmd "python3" "Install Python 3.11+"
require_cmd "docker" "Install Docker Desktop / Docker Engine"
require_cmd "openssl" "Install OpenSSL (required for encryption key generation)"

if [[ ! -f ".env" ]]; then
  if [[ ! -f ".env.example" ]]; then
    echo "FAIL  .env.example not found in repo root"
    exit 1
  fi

  cp .env.example .env
  KEY="$(openssl rand -base64 32)"
  # macOS-compatible inline replacement via perl
  perl -i -pe "s/^MASTER_ENCRYPTION_KEY=.*/MASTER_ENCRYPTION_KEY=${KEY//\//\\/}/" .env
  echo "OK  Created .env with generated MASTER_ENCRYPTION_KEY"
else
  echo "OK  .env already exists"
fi

echo ""
echo "Next steps:"
echo "  1) npm install"
echo "  2) docker-compose up --build"
echo "  3) Open web UI: http://localhost:3000 (if using all-in-one container)"
echo "     or API: http://localhost:3001/health (compose control-plane)"
echo ""
echo "Tip: run 'runit doctor' after installing the CLI."
