#!/usr/bin/env bash
set -euo pipefail

# Runtime AI Backend Deploy Script
# Usage: ./deploy.sh [user@host] [deploy-dir]

REMOTE="${1:-root@65.21.90.216}"
DEPLOY_DIR="${2:-/opt/runtime-api}"

echo "==> Deploying Runtime AI backend to $REMOTE:$DEPLOY_DIR"

# Sync code to server (exclude node_modules, .git, .env)
echo "==> Syncing files..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude '__pycache__' \
  ../ "$REMOTE:$DEPLOY_DIR/"

# Build and restart on server
echo "==> Building and restarting..."
ssh "$REMOTE" << 'ENDSSH'
  cd /opt/runtime-api/infra
  docker compose build --no-cache
  docker compose up -d
  echo "==> Waiting for health check..."
  sleep 5
  for i in 1 2 3 4 5; do
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
      echo "==> Health check passed!"
      exit 0
    fi
    echo "   Attempt $i/5 - waiting..."
    sleep 3
  done
  echo "==> Health check failed!"
  docker compose logs --tail=50
  exit 1
ENDSSH

echo "==> Deploy complete!"
