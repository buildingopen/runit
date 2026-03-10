#!/usr/bin/env bash
set -euo pipefail

# RunIt Backend Deploy Script (local)
# Usage: ./infra/deploy.sh (run from repo root)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
IMAGE_NAME="runit-api"
CONTAINER_NAME="runit-api"
HEALTH_URL="http://localhost:3001/health"

cd "$REPO_ROOT"

# Verify .env exists
if [[ ! -f .env ]]; then
  echo "ERROR: .env not found at $REPO_ROOT/.env"
  echo "Copy .env.example to .env and fill in the values."
  exit 1
fi

# Build the Docker image
echo "==> Building Docker image..."
docker build -f services/control-plane/Dockerfile -t "$IMAGE_NAME" .

# Stop old container (if running)
if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
  echo "==> Stopping old container..."
  docker stop "$CONTAINER_NAME"
  docker rm "$CONTAINER_NAME"
elif docker ps -aq --filter "name=$CONTAINER_NAME" | grep -q .; then
  echo "==> Removing stopped container..."
  docker rm "$CONTAINER_NAME"
fi

# Start new container via docker-compose
echo "==> Starting container..."
docker-compose -f "$COMPOSE_FILE" up -d

# Health check with retry
echo "==> Waiting for health check..."
for i in 1 2 3 4 5 6; do
  sleep 5
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "==> Health check passed!"
    curl -s "$HEALTH_URL"
    echo ""
    echo "==> Deploy complete!"
    exit 0
  fi
  echo "   Attempt $i/6 - waiting..."
done

echo "==> Health check failed after 30s!"
docker logs --tail=50 "$CONTAINER_NAME"
exit 1
