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
import { rateLimitMiddleware } from './middleware/rate-limit';
import { quotaMiddleware } from './middleware/quota';

const app = new Hono();

// CORS for web UI
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
}));

// Apply rate limiting (60/min auth, 10/min anon)
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

// Mount routes
app.route('/projects', projects);
app.route('/projects', endpoints);     // /projects/:id/endpoints
app.route('/projects', openapi);       // /projects/:id/versions/:vid/extract-openapi
app.route('/projects', secrets);       // /projects/:id/secrets
app.route('/projects', contextRoutes); // /projects/:id/context
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
  POST   /runs                      - Execute endpoint
  GET    /runs/:id                  - Get run status

Modal Runtime: execution-layer-runtime (deployed)
`);

serve({
  fetch: app.fetch,
  port,
});
