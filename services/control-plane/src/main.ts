/**
 * Control Plane API
 *
 * Source of truth for projects, versions, runs, secrets, and sharing.
 */

import 'dotenv/config';
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
import { rateLimitMiddleware } from './middleware/rate-limit';
import { quotaMiddleware } from './middleware/quota';
import { bodySizeLimitMiddleware, contentTypeMiddleware } from './middleware/request-validation';
import { authMiddleware } from './middleware/auth';
import { loggerMiddleware, devLoggerMiddleware } from './middleware/logger';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { validateEnv } from './lib/env';
import { initSentry, captureException } from './lib/sentry';
import { logger } from './lib/logger';

// Validate environment variables at boot
validateEnv();

// Initialize Sentry (async, non-blocking)
initSentry().catch(() => {});

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
const isProduction = process.env.NODE_ENV === 'production';
app.use('/*', isProduction ? loggerMiddleware : devLoggerMiddleware);

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
    features: ['projects', 'runs', 'secrets', 'context', 'rate-limiting', 'quotas'],
    endpoints: {
      projects: '/projects',
      runs: '/runs',
      health: '/health',
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
  try {
    const start = Date.now();
    const { isSupabaseConfigured } = await import('./db/supabase.js');
    if (isSupabaseConfigured()) {
      const { getServiceSupabaseClient } = await import('./db/supabase.js');
      const supabase = getServiceSupabaseClient();
      const { error } = await supabase.from('projects').select('id').limit(1);
      checks.supabase = error
        ? { status: 'degraded', latency_ms: Date.now() - start, error: error.message }
        : { status: 'healthy', latency_ms: Date.now() - start };
    } else {
      checks.supabase = { status: 'not_configured' };
    }
  } catch (err) {
    checks.supabase = { status: 'unhealthy', error: err instanceof Error ? err.message : String(err) };
  }

  // Check Modal
  try {
    const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
    checks.modal = hasModal
      ? { status: 'configured' }
      : { status: 'not_configured' };
  } catch {
    checks.modal = { status: 'unhealthy' };
  }

  const overall = Object.values(checks).every((ch) => ch.status === 'healthy' || ch.status === 'configured')
    ? 'healthy'
    : Object.values(checks).some((ch) => ch.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

  return c.json({
    status: overall,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
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

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Execution Layer Control Plane                              ║
║  Port: ${port}                                              ║
║  Status: Running                                            ║
╚════════════════════════════════════════════════════════════╝

Available routes:
  GET    /                          - API info
  GET    /health                    - Health check
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
function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down gracefully...`);

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
