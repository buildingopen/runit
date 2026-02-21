// ABOUTME: Hono-based API server entry point: wires up all middleware (auth, CORS, rate-limit, quota, metrics, security) and routes.
// ABOUTME: Runs startup health checks, boot migrations, graceful shutdown, and serves both /v1/* (versioned) and /* (legacy) APIs.
/**
 * Control Plane API
 *
 * Source of truth for projects, versions, runs, secrets, and sharing.
 * Production-hardened with:
 * - Request timeouts
 * - HTTPS redirect
 * - Circuit breakers
 * - Prometheus metrics
 * - CSP violation reporting
 * - OpenTelemetry distributed tracing
 */

// IMPORTANT: Tracing must be imported BEFORE any other imports
// to ensure proper instrumentation of HTTP clients and servers
import { shutdownTracing } from './lib/tracing.js';

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from package directory (not cwd which may be monorepo root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import projects from './routes/projects.js';
import endpoints from './routes/endpoints.js';
import runs from './routes/runs.js';
import openapi from './routes/openapi.js';
import secrets from './routes/secrets.js';
import contextRoutes from './routes/context';
import { projectShare, shareLinks } from './routes/share.js';
import deploy from './routes/deploy.js';
import metrics from './routes/metrics';
import { rateLimitMiddleware, shutdownRateLimit } from './middleware/rate-limit';
import { quotaMiddleware } from './middleware/quota';
import { bodySizeLimitMiddleware, contentTypeMiddleware } from './middleware/request-validation';
import { authMiddleware } from './middleware/auth';
import { loggerMiddleware, devLoggerMiddleware } from './middleware/logger';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { requestTimeoutMiddleware } from './middleware/request-timeout';
import { httpsRedirectMiddleware } from './middleware/https-redirect';
import { metricsMiddleware } from './middleware/metrics';
import { validateEnv } from './lib/env';
import { initSentry, captureException, isSentryInitialized } from './lib/sentry';
import { logger } from './lib/logger';
import { testSupabaseConnection, isSupabaseConfigured } from './db/supabase';
import { getCircuitBreakerStats, hasOpenCircuit } from './lib/circuit-breaker';
import { openAPISpec } from './lib/openapi-spec';
import { isDraining, setDraining } from './lib/server-state';
import { activeConnections } from './lib/metrics';

// Validate environment variables at boot
validateEnv();

// Initialize Sentry (blocking in production)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  await initSentry();
} else {
  initSentry().catch((err) => {
    logger.warn('Sentry init failed in development', { error: String(err) });
  });
}

// Startup health check - verify critical dependencies
async function startupHealthCheck(): Promise<void> {
  logger.info('[Startup] Running health checks...');

  // Check Supabase connectivity
  if (isSupabaseConfigured()) {
    const supabaseCheck = await testSupabaseConnection();
    if (!supabaseCheck.connected) {
      if (isProduction) {
        logger.error('[Startup] FATAL: Supabase connectivity check failed', undefined, {
          error: supabaseCheck.error,
        });
        process.exit(1);
      } else {
        logger.warn('[Startup] Supabase connectivity check failed (continuing in development)', {
          error: supabaseCheck.error,
        });
      }
    } else {
      logger.info(`[Startup] Supabase connected (${supabaseCheck.latencyMs}ms)`);
    }
  } else {
    logger.warn('[Startup] Supabase not configured');
  }

  // Check Modal credentials
  const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
  if (hasModal) {
    logger.info('[Startup] Modal credentials configured');
  } else {
    logger.warn('[Startup] Modal credentials not configured (deployments will fail)');
  }

  // Check Sentry
  if (isSentryInitialized()) {
    logger.info('[Startup] Sentry initialized');
  } else if (isProduction) {
    logger.error('[Startup] FATAL: Sentry not initialized in production');
    process.exit(1);
  }

  logger.info('[Startup] Health checks complete');
}

// Run startup health checks
await startupHealthCheck();

// Run database migrations (async, non-blocking — app starts regardless)
import('./db/migrate-boot.js').catch((err) => {
  logger.error('Boot migration failed', err instanceof Error ? err : new Error(String(err)));
});

const app = new Hono();

// Global error handler for JSON parse errors and other exceptions
app.onError((err, c) => {
  // Handle JSON parse errors specifically
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({
      error: 'Invalid JSON in request body',
      details: err.message,
    }, 400);
  }

  // Log and track unexpected errors
  logger.error('Unhandled error', err);
  captureException(err instanceof Error ? err : new Error(String(err)));
  return c.json({
    error: 'Internal server error',
  }, 500);
});

// HTTPS redirect (production only)
app.use('/*', httpsRedirectMiddleware);

// Request timeout (30s default)
app.use('/*', requestTimeoutMiddleware(30_000));

// CORS - production-aware origin allowlist
const allowedOrigins = (() => {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return []; // No explicit origins configured
})();

app.use('/*', cors({
  origin: (origin) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin) return '*';

    // Check explicit allowlist first
    if (allowedOrigins.includes(origin)) return origin;

    // In development, allow localhost
    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith('http://localhost:')) return origin;
      if (origin.startsWith('http://127.0.0.1:')) return origin;
    }

    return null;
  },
  credentials: true,
}));

// Security headers
app.use('/*', securityHeadersMiddleware);

// Request logging - use dev logger in development, structured logger in production
app.use('/*', isProduction ? loggerMiddleware : devLoggerMiddleware);

// Request metrics tracking (records duration, count, and active connections)
app.use('/*', metricsMiddleware);

// Body size limit (5MB default) - prevents large payload attacks
app.use('/*', bodySizeLimitMiddleware);

// Content-Type validation for POST/PUT/PATCH requests
app.use('/*', contentTypeMiddleware);

// Authentication middleware - validates JWT and attaches user to context
// Excluded: /metrics (Prometheus scraping), /health (load balancer probes), /openapi.json (docs)
const AUTH_EXCLUDED_PATHS = ['/metrics', '/health', '/openapi.json', '/v1/openapi.json'];
app.use('/*', async (c, next) => {
  if (AUTH_EXCLUDED_PATHS.some(path => c.req.path === path || c.req.path.startsWith(path + '/'))) {
    return next();
  }
  return authMiddleware(c, next);
});

// Apply rate limiting (120/min auth, 60/min anon)
// Excluded: /metrics (Prometheus scraping)
app.use('/*', async (c, next) => {
  if (c.req.path === '/metrics' || c.req.path.startsWith('/metrics/')) {
    return next();
  }
  return rateLimitMiddleware(c, next);
});

// Apply quota enforcement on run endpoints
app.use('/runs/*', quotaMiddleware);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Execution Layer Control Plane',
    version: '0.1.0',
    status: 'operational',
    features: ['projects', 'runs', 'secrets', 'context', 'rate-limiting', 'quotas', 'metrics'],
    endpoints: {
      projects: '/projects',
      runs: '/runs',
      health: '/health',
      metrics: '/metrics',
    },
  });
});

app.get('/health', (c) => {
  if (isDraining()) {
    return c.json({
      status: 'draining',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }, 503);
  }
  return c.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Deep health check — verifies external dependencies
app.get('/health/deep', async (c) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Check Supabase
  if (isSupabaseConfigured()) {
    const supabaseCheck = await testSupabaseConnection();
    checks.supabase = supabaseCheck.connected
      ? { status: 'healthy', latency_ms: supabaseCheck.latencyMs }
      : { status: 'unhealthy', latency_ms: supabaseCheck.latencyMs, error: supabaseCheck.error };
  } else {
    checks.supabase = { status: 'not_configured' };
  }

  // Check Modal
  const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
  checks.modal = hasModal
    ? { status: 'configured' }
    : { status: 'not_configured' };

  // Check Sentry
  checks.sentry = isSentryInitialized()
    ? { status: 'healthy' }
    : { status: 'not_configured' };

  // Check circuit breakers
  const circuitStats = getCircuitBreakerStats();
  checks.circuit_breakers = hasOpenCircuit()
    ? { status: 'degraded', error: 'One or more circuit breakers open' }
    : { status: 'healthy' };

  const overall = Object.values(checks).every((ch) => ch.status === 'healthy' || ch.status === 'configured' || ch.status === 'not_configured')
    ? 'healthy'
    : Object.values(checks).some((ch) => ch.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

  return c.json({
    status: overall,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
    circuitBreakers: circuitStats,
  }, overall === 'unhealthy' ? 503 : 200);
});

// OpenAPI specification for this API (full spec from docs/openapi.yaml)
// Available at both /openapi.json (legacy) and /v1/openapi.json (recommended)
app.get('/openapi.json', (c) => c.json(openAPISpec));
app.get('/v1/openapi.json', (c) => c.json(openAPISpec));

// =============================================================================
// API Routes
// =============================================================================
// All routes available at both /v1/* (versioned) and /* (legacy, deprecated)
// New integrations should use /v1/* prefix for forward compatibility

const apiRouter = new Hono();
apiRouter.route('/projects', projects);
apiRouter.route('/projects', endpoints);     // /projects/:id/endpoints
apiRouter.route('/projects', openapi);       // /projects/:id/versions/:vid/extract-openapi
apiRouter.route('/projects', secrets);       // /projects/:id/secrets
apiRouter.route('/projects', contextRoutes); // /projects/:id/context
apiRouter.route('/projects', projectShare);  // /projects/:id/share
apiRouter.route('/projects', deploy);        // /projects/:id/deploy, /projects/:id/deploy/stream
apiRouter.route('/share', shareLinks);       // /share/:share_id
apiRouter.route('/runs', runs);

// Mount v1 API (recommended)
app.route('/v1', apiRouter);

// Mount legacy routes (deprecated - will be removed in v2)
// Adds Deprecation header so consumers know to migrate to /v1
app.use('/projects/*', async (c, next) => {
  await next();
  c.header('Deprecation', 'true');
  c.header('Sunset', '2026-12-31');
  c.header('Link', '</v1/projects>; rel="successor-version"');
});
app.route('/projects', projects);
app.route('/projects', endpoints);
app.route('/projects', openapi);
app.route('/projects', secrets);
app.route('/projects', contextRoutes);
app.route('/projects', projectShare);
app.route('/projects', deploy);
app.use('/share/*', async (c, next) => {
  await next();
  c.header('Deprecation', 'true');
  c.header('Sunset', '2026-12-31');
  c.header('Link', '</v1/share>; rel="successor-version"');
});
app.route('/share', shareLinks);
app.use('/runs/*', async (c, next) => {
  await next();
  c.header('Deprecation', 'true');
  c.header('Sunset', '2026-12-31');
  c.header('Link', '</v1/runs>; rel="successor-version"');
});
app.route('/runs', runs);

// Metrics always at root (Prometheus convention)
app.route('/metrics', metrics);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`
┌─────────────────────────────────────────────────────────────┐
│  Runtime AI Control Plane                                   │
│  Port: ${String(port).padEnd(52)}│
│  Mode: ${(isProduction ? 'PRODUCTION' : 'development').padEnd(52)}│
│  API:  /v1/* (versioned) or /* (legacy)                     │
└─────────────────────────────────────────────────────────────┘

Routes (all available at /v1/* and /*):
  System:
    GET  /health           Health check
    GET  /health/deep      Deep health check (dependencies)
    GET  /metrics          Prometheus metrics
    GET  /v1/openapi.json  OpenAPI 3.0 specification (full)

  Projects:
    POST /v1/projects      Create project (ZIP/GitHub)
    GET  /v1/projects      List projects
    GET  /v1/projects/:id  Get project details
    DEL  /v1/projects/:id  Delete project

  Endpoints:
    GET  /v1/projects/:id/endpoints                  List endpoints
    POST /v1/projects/:id/versions/:vid/extract-openapi  Extract OpenAPI

  Runs:
    POST /v1/runs          Execute endpoint
    GET  /v1/runs/:id      Get run status/result

  Secrets:
    POST /v1/projects/:id/secrets      Create secret
    GET  /v1/projects/:id/secrets      List secrets (masked)
    PUT  /v1/projects/:id/secrets/:key Update secret
    DEL  /v1/projects/:id/secrets/:key Delete secret

  Sharing:
    POST /v1/projects/:id/share        Create share link
    GET  /v1/projects/:id/shares       List share links
    DEL  /v1/projects/:id/share/:sid   Disable share link
    GET  /v1/share/:share_id           Access shared endpoint
`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Graceful shutdown handler
async function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  // Signal draining so health endpoint returns 503 (load balancer stops sending traffic)
  setDraining(true);

  // Shutdown rate limit (close Redis connection)
  await shutdownRateLimit();

  // Shutdown OpenTelemetry (flush remaining spans)
  await shutdownTracing();

  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed. Exiting.');
    process.exit(0);
  });

  // Poll active connections, exit early when drained
  const drainInterval = setInterval(() => {
    const current = (activeConnections as any).hashMap?.get('')?.value ?? 0;
    if (current <= 0) {
      clearInterval(drainInterval);
      console.log('All connections drained. Exiting.');
      process.exit(0);
    }
  }, 1000);

  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    clearInterval(drainInterval);
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Capture unhandled errors
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  captureException(error);
  // Exit on uncaught exception - let the process manager restart
  process.exit(1);
});
