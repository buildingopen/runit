/**
 * Control Plane API
 *
 * Source of truth for projects, versions, runs, secrets, and sharing.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import contextRoutes from './routes/context';

const app = new Hono();

app.get('/', (c) => {
  return c.json({
    name: 'Execution Layer Control Plane',
    version: '0.1.0',
    status: 'active',
    features: ['context'],
  });
});

// Context routes (Agent 6 - MEMORY)
app.route('/', contextRoutes);

// TODO: Agent 1 (ARCHITECT) will implement:
// - /projects routes
// - /versions routes
// - /runs routes
// - /secrets routes
// - /share routes

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`Control Plane API starting on port ${port}`);
serve({
  fetch: app.fetch,
  port,
});
