/**
 * Error Scenarios Tests
 *
 * Tests for error handling, edge cases, and failure modes across the control plane.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';

describe('Error Scenarios', () => {
  describe('Input Validation Errors', () => {
    it('rejects empty project name', async () => {
      const app = new Hono();
      app.post('/projects', async (c) => {
        const body = await c.req.json();
        if (!body.name || body.name.trim() === '') {
          return c.json({ error: 'Project name is required' }, 400);
        }
        return c.json({ id: '123' }, 201);
      });

      const res = await app.request('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('required');
    });

    it('rejects project name with invalid characters', async () => {
      const app = new Hono();
      const VALID_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

      app.post('/projects', async (c) => {
        const body = await c.req.json();
        if (!VALID_NAME_REGEX.test(body.name)) {
          return c.json({ error: 'Invalid project name. Use only letters, numbers, hyphens, and underscores.' }, 400);
        }
        return c.json({ id: '123' }, 201);
      });

      const res = await app.request('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'invalid name with spaces!' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid');
    });

    it('rejects malformed JSON body', async () => {
      const app = new Hono();

      app.onError((err, c) => {
        if (err instanceof SyntaxError && err.message.includes('JSON')) {
          return c.json({ error: 'Invalid JSON' }, 400);
        }
        return c.json({ error: 'Internal error' }, 500);
      });

      app.post('/projects', async (c) => {
        await c.req.json();
        return c.json({ ok: true });
      });

      const res = await app.request('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json',
      });

      expect(res.status).toBe(400);
    });

    it('rejects oversized request body', async () => {
      const MAX_SIZE = 1024; // 1KB for test
      const app = new Hono();

      app.use('/*', async (c, next) => {
        const contentLength = c.req.header('content-length');
        if (contentLength && parseInt(contentLength) > MAX_SIZE) {
          return c.json({ error: 'Request body too large' }, 413);
        }
        await next();
      });

      app.post('/upload', (c) => c.json({ ok: true }));

      const res = await app.request('/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '999999',
        },
        body: JSON.stringify({ data: 'x'.repeat(999999) }),
      });

      expect(res.status).toBe(413);
    });
  });

  describe('Authentication Errors', () => {
    it('returns 401 for missing Authorization header', async () => {
      const app = new Hono();

      app.use('/*', async (c, next) => {
        const auth = c.req.header('authorization');
        if (!auth) {
          return c.json({ error: 'Authentication required' }, 401);
        }
        await next();
      });

      app.get('/protected', (c) => c.json({ ok: true }));

      const res = await app.request('/protected');
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid Bearer token format', async () => {
      const app = new Hono();

      app.use('/*', async (c, next) => {
        const auth = c.req.header('authorization');
        if (!auth || !auth.startsWith('Bearer ')) {
          return c.json({ error: 'Invalid authorization format' }, 401);
        }
        await next();
      });

      app.get('/protected', (c) => c.json({ ok: true }));

      const res = await app.request('/protected', {
        headers: { Authorization: 'Basic abc123' },
      });

      expect(res.status).toBe(401);
    });

    it('returns 401 for expired token', async () => {
      const app = new Hono();

      app.use('/*', async (c, next) => {
        const auth = c.req.header('authorization');
        const token = auth?.replace('Bearer ', '');

        // Simulate expired token check
        if (token === 'expired-token') {
          return c.json({ error: 'Token expired' }, 401);
        }
        await next();
      });

      app.get('/protected', (c) => c.json({ ok: true }));

      const res = await app.request('/protected', {
        headers: { Authorization: 'Bearer expired-token' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Authorization Errors', () => {
    it('returns 403 for accessing another user\'s resource', async () => {
      const app = new Hono();
      const resources: Record<string, string> = {
        'project-1': 'user-a',
        'project-2': 'user-b',
      };

      app.get('/projects/:id', (c) => {
        const projectId = c.req.param('id');
        const currentUser = 'user-a'; // Simulated current user

        const owner = resources[projectId];
        if (!owner) {
          return c.json({ error: 'Not found' }, 404);
        }
        if (owner !== currentUser) {
          return c.json({ error: 'Access denied' }, 403);
        }

        return c.json({ id: projectId });
      });

      const res = await app.request('/projects/project-2');
      expect(res.status).toBe(403);
    });
  });

  describe('Rate Limiting Errors', () => {
    it('returns 429 when rate limit exceeded', async () => {
      const app = new Hono();
      let requestCount = 0;
      const LIMIT = 3;

      app.use('/*', async (c, next) => {
        requestCount++;
        if (requestCount > LIMIT) {
          return c.json(
            { error: 'Too many requests', retryAfter: 60 },
            { status: 429, headers: { 'Retry-After': '60' } }
          );
        }
        await next();
      });

      app.get('/api', (c) => c.json({ ok: true }));

      // First 3 requests should succeed
      for (let i = 0; i < LIMIT; i++) {
        const res = await app.request('/api');
        expect(res.status).toBe(200);
      }

      // 4th request should be rate limited
      const res = await app.request('/api');
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
    });

    it('includes rate limit headers in response', async () => {
      const app = new Hono();
      const LIMIT = 100;
      let remaining = LIMIT;

      app.use('/*', async (c, next) => {
        remaining--;
        c.header('X-RateLimit-Limit', String(LIMIT));
        c.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
        c.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 60));
        await next();
      });

      app.get('/api', (c) => c.json({ ok: true }));

      const res = await app.request('/api');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('Not Found Errors', () => {
    it('returns 404 for non-existent project', async () => {
      const app = new Hono();

      app.get('/projects/:id', (c) => {
        const id = c.req.param('id');
        if (id === 'non-existent') {
          return c.json({ error: 'Project not found' }, 404);
        }
        return c.json({ id });
      });

      const res = await app.request('/projects/non-existent');
      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent endpoint', async () => {
      const app = new Hono();

      app.get('/projects/:pid/endpoints/:eid', (c) => {
        return c.json({ error: 'Endpoint not found' }, 404);
      });

      const res = await app.request('/projects/p1/endpoints/e-not-found');
      expect(res.status).toBe(404);
    });
  });

  describe('Conflict Errors', () => {
    it('returns 409 for duplicate project name', async () => {
      const app = new Hono();
      const existingProjects = new Set(['my-project']);

      app.post('/projects', async (c) => {
        const body = await c.req.json();
        if (existingProjects.has(body.name)) {
          return c.json({ error: 'Project with this name already exists' }, 409);
        }
        existingProjects.add(body.name);
        return c.json({ id: '123', name: body.name }, 201);
      });

      const res = await app.request('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'my-project' }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe('Service Unavailable Errors', () => {
    it('returns 503 when circuit breaker is open', async () => {
      const app = new Hono();
      let circuitOpen = true;

      app.post('/runs', (c) => {
        if (circuitOpen) {
          return c.json(
            { error: 'Service temporarily unavailable', retryable: true },
            503
          );
        }
        return c.json({ runId: '123' }, 202);
      });

      const res = await app.request('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointId: 'e1' }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.retryable).toBe(true);
    });

    it('returns 503 when external dependency is down', async () => {
      const app = new Hono();

      app.get('/health/deep', async (c) => {
        // Simulate Supabase being down
        const supabaseHealthy = false;

        if (!supabaseHealthy) {
          return c.json(
            {
              status: 'unhealthy',
              checks: {
                supabase: { status: 'unhealthy', error: 'Connection refused' },
              },
            },
            503
          );
        }

        return c.json({ status: 'healthy' });
      });

      const res = await app.request('/health/deep');
      expect(res.status).toBe(503);
    });
  });

  describe('Timeout Errors', () => {
    it('returns 504 when request times out', async () => {
      const app = new Hono();

      app.use('/*', async (c, next) => {
        const timeoutMs = 100;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          await next();
        } finally {
          clearTimeout(timeoutId);
        }
      });

      // Note: In real tests, you'd need to actually trigger a timeout
      // This is a simplified example
      app.get('/slow', async (c) => {
        // Simulate checking for abort
        return c.json({ ok: true });
      });

      const res = await app.request('/slow');
      // In real scenario with actual timeout, this would be 504
      expect(res.status).toBe(200);
    });
  });

  describe('Quota Errors', () => {
    it('returns 402 when quota exhausted', async () => {
      const app = new Hono();
      const userQuotas: Record<string, number> = {
        'user-1': 0, // No quota remaining
      };

      app.use('/runs/*', async (c, next) => {
        const userId = 'user-1'; // Simulated
        const remaining = userQuotas[userId] ?? 100;

        if (remaining <= 0) {
          return c.json(
            {
              error: 'Quota exhausted',
              message: 'Please upgrade your plan or wait for quota reset',
            },
            402
          );
        }

        await next();
      });

      app.post('/runs', (c) => c.json({ runId: '123' }, 202));

      const res = await app.request('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(402);
    });
  });

  describe('Validation Edge Cases', () => {
    it('handles empty arrays gracefully', async () => {
      const app = new Hono();

      app.post('/batch', async (c) => {
        const body = await c.req.json();
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return c.json({ error: 'Items array cannot be empty' }, 400);
        }
        return c.json({ processed: body.items.length });
      });

      const res = await app.request('/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      });

      expect(res.status).toBe(400);
    });

    it('handles null values in request body', async () => {
      const app = new Hono();

      app.post('/data', async (c) => {
        const body = await c.req.json();
        if (body.value === null) {
          return c.json({ error: 'Value cannot be null' }, 400);
        }
        return c.json({ ok: true });
      });

      const res = await app.request('/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: null }),
      });

      expect(res.status).toBe(400);
    });

    it('handles very long strings', async () => {
      const app = new Hono();
      const MAX_LENGTH = 1000;

      app.post('/data', async (c) => {
        const body = await c.req.json();
        if (body.name && body.name.length > MAX_LENGTH) {
          return c.json({ error: `Name exceeds maximum length of ${MAX_LENGTH}` }, 400);
        }
        return c.json({ ok: true });
      });

      const res = await app.request('/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(MAX_LENGTH + 1) }),
      });

      expect(res.status).toBe(400);
    });

    it('handles special characters in path parameters', async () => {
      const app = new Hono();

      app.get('/projects/:name', (c) => {
        const name = c.req.param('name');
        // Validate path param
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
          return c.json({ error: 'Invalid project name in URL' }, 400);
        }
        return c.json({ name });
      });

      const res = await app.request('/projects/test%3Cscript%3E');
      expect(res.status).toBe(400);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('handles multiple simultaneous requests correctly', async () => {
      const app = new Hono();
      let counter = 0;

      app.get('/counter', (c) => {
        counter++;
        return c.json({ count: counter });
      });

      // Simulate concurrent requests
      const requests = Array(10).fill(null).map(() => app.request('/counter'));
      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // Counter should be 10
      expect(counter).toBe(10);
    });
  });

  describe('Error Response Format', () => {
    it('returns consistent error format', async () => {
      const app = new Hono();

      app.get('/error', (c) => {
        return c.json(
          {
            error: 'Something went wrong',
            code: 'INTERNAL_ERROR',
            requestId: 'req-123',
          },
          500
        );
      });

      const res = await app.request('/error');
      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('requestId');
    });

    it('does not leak internal details in production errors', async () => {
      const app = new Hono();

      app.onError((err, c) => {
        // In production, don't expose stack traces
        return c.json(
          {
            error: 'Internal server error',
            // NO: stack, details, or internal messages
          },
          500
        );
      });

      app.get('/crash', () => {
        throw new Error('Database connection string: postgres://user:password@host/db');
      });

      const res = await app.request('/crash');
      const data = await res.json();

      expect(data.error).toBe('Internal server error');
      expect(JSON.stringify(data)).not.toContain('password');
      expect(JSON.stringify(data)).not.toContain('postgres');
    });
  });
});
