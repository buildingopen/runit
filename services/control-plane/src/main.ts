/**
 * Control Plane API
 *
 * Source of truth for projects, versions, runs, secrets, and sharing.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import secrets from './routes/secrets';

const app = new Hono();

// CORS for web UI
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

app.get('/', (c) => {
  return c.json({
    name: 'Execution Layer Control Plane',
    version: '0.1.0',
    status: 'operational',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

// Mount secrets routes
app.route('/projects', secrets);

// TODO: Agent 1 (ARCHITECT) will implement:
// - /projects routes (projects CRUD)
// - /versions routes
// - /runs routes
// - /share routes

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`Control Plane API starting on port ${port}`);
serve({
  fetch: app.fetch,
  port,
});
