# RunIt - Self-hosted Python API platform
# Usage: docker build -t runit . && docker run -p 3000:3000 runit
#
# For docker-compose (builds runner image too):
#   docker-compose up --build

# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY .npmrc ./
COPY turbo.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/control-plane/package*.json ./services/control-plane/

RUN npm ci

COPY packages/shared ./packages/shared
COPY services/control-plane ./services/control-plane
COPY tsconfig.json ./

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/control-plane

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache docker-cli su-exec

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 controlplane && \
    addgroup controlplane docker 2>/dev/null || true

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/services/control-plane/package*.json ./services/control-plane/

RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/control-plane && \
    npm cache clean --force

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/control-plane/dist ./services/control-plane/dist
COPY --from=builder /app/services/control-plane/docs ./services/control-plane/docs

RUN mkdir -p /data && chown controlplane:nodejs /data
RUN chown -R controlplane:nodejs /app

COPY services/control-plane/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV COMPUTE_BACKEND=docker
ENV RUNIT_MODE=oss
ENV RUNIT_DATA_DIR=/data

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "services/control-plane/dist/main.js"]
