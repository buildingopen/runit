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

if docker info >/dev/null 2>&1; then
  echo "OK  docker daemon reachable"
else
  echo "WARN  docker daemon not reachable yet"
  echo "      Start Docker before running docker-compose or local executions"
fi

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

if [[ ! -f "apps/web/.env.local" ]]; then
  mkdir -p apps/web
  cat > apps/web/.env.local <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
  echo "OK  Created apps/web/.env.local with local API URL"
else
  echo "OK  apps/web/.env.local already exists"
fi

echo ""
echo "Choose one path:"
echo ""
echo "  Quick self-host path"
echo "    1) npm install"
echo "    2) docker-compose up --build"
echo "    3) Open API health: http://localhost:3001/health"
echo ""
echo "  Manual local dev path"
echo "    1) npm install"
echo "    2) cd services/control-plane && npm run dev"
echo "    3) In a second terminal: npm run dev:local"
echo "    4) Open web UI: http://localhost:3000"
echo ""
echo "Tip: run 'runit doctor' after installing the CLI."
