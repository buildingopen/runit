/**
 * Control Plane API
 *
 * Source of truth for projects, versions, runs, secrets, and sharing.
 */

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

  // Log unexpected errors
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
  }, 500);
});

// CORS for web UI - allow all localhost ports for development
app.use('/*', cors({
  origin: (origin) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return '*';
    // Allow any localhost port in development
    if (origin.startsWith('http://localhost:')) return origin;
    if (origin.startsWith('http://127.0.0.1:')) return origin;
    return null;
  },
  credentials: true,
}));

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
  return c.json({ status: 'healthy' });
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

serve({
  fetch: app.fetch,
  port,
});
