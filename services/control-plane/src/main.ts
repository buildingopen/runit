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
 */

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
import { validateEnv } from './lib/env';
import { initSentry, captureException, isSentryInitialized } from './lib/sentry';
import { logger } from './lib/logger';
import { testSupabaseConnection, isSupabaseConfigured } from './db/supabase';
import { getCircuitBreakerStats, hasOpenCircuit } from './lib/circuit-breaker';
import { httpRequestsTotal, httpRequestDuration } from './lib/metrics';

// Validate environment variables at boot
validateEnv();

// Initialize Sentry (blocking in production)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  await initSentry();
} else {
  initSentry().catch(() => {});
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
import('./db/migrate-boot.js').catch(() => {});

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

// Request metrics tracking
app.use('/*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = (Date.now() - start) / 1000;

  const path = c.req.path.replace(/\/[a-f0-9-]{36}/g, '/:id');  // Normalize UUIDs
  httpRequestsTotal.inc({
    method: c.req.method,
    path,
    status: c.res.status.toString(),
  });
  httpRequestDuration.observe({
    method: c.req.method,
    path,
    status: c.res.status.toString(),
  }, duration);
});

// Body size limit (5MB default) - prevents large payload attacks
app.use('/*', bodySizeLimitMiddleware);

// Content-Type validation for POST/PUT/PATCH requests
app.use('/*', contentTypeMiddleware);

// Authentication middleware - validates JWT and attaches user to context
app.use('/*', authMiddleware);

// Apply rate limiting (120/min auth, 60/min anon)
app.use('/*', rateLimitMiddleware);

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

// OpenAPI specification for this API
app.get('/openapi.json', (c) => {
  return c.json({
    openapi: '3.0.3',
    info: {
      title: 'Execution Layer Control Plane API',
      version: '0.1.0',
      description: 'API for managing projects, runs, secrets, and sharing in the Execution Layer platform',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local development' },
    ],
    paths: {
      '/': {
        get: {
          summary: 'API Info',
          description: 'Returns basic information about the API',
          responses: { '200': { description: 'API information' } },
        },
      },
      '/health': {
        get: {
          summary: 'Health Check',
          description: 'Returns health status of the API',
          responses: { '200': { description: 'Health status' } },
        },
      },
      '/health/deep': {
        get: {
          summary: 'Deep Health Check',
          description: 'Returns health status including external dependencies',
          responses: {
            '200': { description: 'All systems healthy' },
            '503': { description: 'One or more systems unhealthy' },
          },
        },
      },
      '/metrics': {
        get: {
          summary: 'Prometheus Metrics',
          description: 'Returns Prometheus-formatted metrics',
          responses: { '200': { description: 'Metrics in text format' } },
        },
      },
      '/projects': {
        get: {
          summary: 'List Projects',
          description: 'Returns a list of all projects',
          responses: { '200': { description: 'List of projects' } },
        },
        post: {
          summary: 'Create Project',
          description: 'Creates a new project from ZIP or GitHub',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    source_type: { type: 'string', enum: ['zip', 'github'] },
                    zip_data: { type: 'string' },
                    github_url: { type: 'string' },
                  },
                  required: ['name', 'source_type'],
                },
              },
            },
          },
          responses: { '201': { description: 'Project created' } },
        },
      },
      '/projects/{project_id}': {
        get: {
          summary: 'Get Project',
          description: 'Returns details of a specific project',
          parameters: [{ name: 'project_id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Project details' } },
        },
        delete: {
          summary: 'Delete Project',
          description: 'Deletes a project and all its data',
          parameters: [{ name: 'project_id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Project deleted' } },
        },
      },
      '/projects/{project_id}/endpoints': {
        get: {
          summary: 'List Endpoints',
          description: 'Returns endpoints for a project version',
          parameters: [{ name: 'project_id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'List of endpoints' } },
        },
      },
      '/runs': {
        post: {
          summary: 'Create Run',
          description: 'Executes an endpoint and returns run ID',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    project_id: { type: 'string' },
                    version_id: { type: 'string' },
                    endpoint_id: { type: 'string' },
                    json: { type: 'object' },
                    lane: { type: 'string', enum: ['cpu', 'gpu'] },
                  },
                  required: ['project_id', 'version_id', 'endpoint_id'],
                },
              },
            },
          },
          responses: { '202': { description: 'Run created' } },
        },
      },
      '/runs/{run_id}': {
        get: {
          summary: 'Get Run Status',
          description: 'Returns status and result of a run',
          parameters: [{ name: 'run_id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Run status' } },
        },
      },
    },
  });
});

// Mount routes
app.route('/projects', projects);
app.route('/projects', endpoints);     // /projects/:id/endpoints
app.route('/projects', openapi);       // /projects/:id/versions/:vid/extract-openapi
app.route('/projects', secrets);       // /projects/:id/secrets
app.route('/projects', contextRoutes); // /projects/:id/context
app.route('/projects', projectShare);  // /projects/:id/share
app.route('/projects', deploy);        // /projects/:id/deploy, /projects/:id/deploy/stream
app.route('/share', shareLinks);       // /share/:share_id
app.route('/runs', runs);
app.route('/metrics', metrics);        // /metrics

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Execution Layer Control Plane                              ║
║  Port: ${port}                                              ║
║  Status: Running                                            ║
║  Mode: ${isProduction ? 'PRODUCTION' : 'development'}                                      ║
╚════════════════════════════════════════════════════════════╝

Available routes:
  GET    /                          - API info
  GET    /health                    - Health check
  GET    /health/deep               - Deep health check
  GET    /metrics                   - Prometheus metrics
  POST   /projects                  - Create project
  GET    /projects                  - List projects
  GET    /projects/:id              - Get project details
  GET    /projects/:id/endpoints    - List endpoints
  POST   /projects/:id/versions/:vid/extract-openapi - Extract OpenAPI
  POST   /projects/:id/secrets      - Store encrypted secret
  GET    /projects/:id/secrets      - List secrets (masked)
  PUT    /projects/:id/secrets/:key - Update secret
  DELETE /projects/:id/secrets/:key - Delete secret
  POST   /projects/:id/context      - Fetch context from URL
  GET    /projects/:id/context      - List contexts
  GET    /projects/:id/context/:cid - Get context
  PUT    /projects/:id/context/:cid - Refresh context
  DELETE /projects/:id/context/:cid - Delete context
  POST   /projects/:id/deploy       - Start deployment
  GET    /projects/:id/deploy/stream - SSE deploy progress
  GET    /projects/:id/deploy/status - Get deploy status
  POST   /projects/:id/redeploy     - Redeploy with latest code
  POST   /runs                      - Execute endpoint
  GET    /runs/:id                  - Get run status
  POST   /projects/:id/share        - Create share link
  GET    /projects/:id/shares       - List share links (owner-only)
  DELETE /projects/:id/share/:sid   - Disable share link
  GET    /share/:share_id           - Get share link data

Modal Runtime: execution-layer-runtime (deployed)
`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Graceful shutdown handler
async function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  // Shutdown rate limit (close Redis connection)
  await shutdownRateLimit();

  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed. Exiting.');
    process.exit(0);
  });

  // Force exit after 10s if connections don't drain
  setTimeout(() => {
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
