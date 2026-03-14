# RunIt - Self-hosted Python API platform
# Usage: docker build -t runit . && docker run -p 3000:3000 -p 3001:3001 -v /var/run/docker.sock:/var/run/docker.sock -v /tmp/runit-workspaces:/tmp/runit-workspaces -v /tmp/runit-storage:/tmp/runit-storage runit
#
# For docker-compose (builds runner image too):
#   docker-compose up --build

# Stage 1: Build everything
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copy everything (filtered by .dockerignore)
COPY . .

# Install and build
RUN npm ci
ENV NEXT_PUBLIC_API_URL=""
RUN npx turbo run build --filter=@runit/control-plane --filter=@runit/web

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache docker-cli su-exec python3

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 controlplane && \
    addgroup controlplane docker 2>/dev/null || true

# Copy monorepo root + install production deps
COPY --from=builder /app/package.json /app/package-lock.json /app/.npmrc /app/turbo.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/control-plane/package.json ./services/control-plane/
RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/control-plane && \
    npm cache clean --force

# Copy API built output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/control-plane/dist ./services/control-plane/dist
COPY --from=builder /app/services/control-plane/docs ./services/control-plane/docs

# Copy Next.js standalone build
COPY --from=builder /app/apps/web/.next/standalone ./web
COPY --from=builder /app/apps/web/.next/static ./web/apps/web/.next/static

# Data directory for SQLite
RUN mkdir -p /data && chown controlplane:nodejs /data
RUN chown -R controlplane:nodejs /app

# Entrypoint for Docker socket permissions
COPY --from=builder /app/services/control-plane/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV COMPUTE_BACKEND=docker
ENV RUNIT_MODE=oss
ENV RUNIT_DATA_DIR=/data
ENV RUNNER_WORKSPACE_DIR=/tmp/runit-workspaces
ENV RUNNER_STORAGE_BASE_DIR=/tmp/runit-storage

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "PORT=3001 node services/control-plane/dist/main.js & HOSTNAME=0.0.0.0 PORT=3000 node web/apps/web/server.js"]
