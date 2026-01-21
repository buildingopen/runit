# Execution Layer Control Plane
# Multi-stage build for production deployment

# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY package*.json ./
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

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 controlplane

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/services/control-plane/package*.json ./services/control-plane/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=packages/shared --workspace=services/control-plane && \
    npm cache clean --force

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/control-plane/dist ./services/control-plane/dist

# Set ownership
RUN chown -R controlplane:nodejs /app

# Switch to non-root user
USER controlplane

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the server
CMD ["node", "services/control-plane/dist/main.js"]
