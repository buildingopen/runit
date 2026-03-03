# Runtime Control Plane
# Multi-stage build for production deployment

# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace config files
COPY package*.json ./
COPY .npmrc ./
COPY turbo.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/control-plane/package*.json ./services/control-plane/

# Install dependencies
RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY services/control-plane ./services/control-plane
COPY tsconfig.json ./

# Build packages in order
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/control-plane

# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install Python + pip (required for Modal bridge), Docker CLI (required for Docker backend),
# and su-exec (for entrypoint privilege drop)
RUN apk add --no-cache python3 py3-pip docker-cli su-exec && \
    pip3 install --no-cache-dir --break-system-packages modal

# Create non-root user with docker group access
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 controlplane && \
    addgroup controlplane docker 2>/dev/null || true

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/services/control-plane/package*.json ./services/control-plane/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/control-plane && \
    npm cache clean --force

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/control-plane/dist ./services/control-plane/dist

# Copy OpenAPI spec (loaded at runtime)
COPY --from=builder /app/services/control-plane/docs ./services/control-plane/docs

# Create data directory for SQLite (OSS mode)
RUN mkdir -p /data && chown controlplane:nodejs /data

# Set ownership
RUN chown -R controlplane:nodejs /app

# Copy entrypoint (runs as root, fixes bind-mount perms, drops to controlplane)
COPY services/control-plane/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Entrypoint fixes bind-mount permissions then drops to controlplane user
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "services/control-plane/dist/main.js"]
