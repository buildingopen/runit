/**
 * HTTPS Redirect Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { httpsRedirectMiddleware } from '../https-redirect';

describe('HTTPS Redirect Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('in development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should not redirect HTTP requests', async () => {
      const app = new Hono();
      app.use('/*', httpsRedirectMiddleware);
      app.get('/api/data', (c) => c.json({ data: 'test' }));

      const res = await app.request('/api/data', {
        headers: {
          'x-forwarded-proto': 'http',
          'host': 'localhost:3001',
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBe('test');
    });
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should redirect HTTP to HTTPS', async () => {
      const app = new Hono();
      app.use('/*', httpsRedirectMiddleware);
      app.get('/api/data', (c) => c.json({ data: 'test' }));

      const res = await app.request('http://example.com/api/data', {
        headers: {
          'x-forwarded-proto': 'http',
          'host': 'example.com',
        },
      });

      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://example.com/api/data');
    });

    it('should not redirect HTTPS requests', async () => {
      const app = new Hono();
      app.use('/*', httpsRedirectMiddleware);
      app.get('/api/data', (c) => c.json({ data: 'test' }));

      const res = await app.request('/api/data', {
        headers: {
          'x-forwarded-proto': 'https',
          'host': 'example.com',
        },
      });

      expect(res.status).toBe(200);
    });

    it('should not redirect health check endpoints', async () => {
      const app = new Hono();
      app.use('/*', httpsRedirectMiddleware);
      app.get('/health', (c) => c.json({ status: 'healthy' }));
      app.get('/health/deep', (c) => c.json({ status: 'healthy' }));
      app.get('/', (c) => c.json({ name: 'API' }));

      // Health endpoint
      const healthRes = await app.request('/health', {
        headers: {
          'x-forwarded-proto': 'http',
          'host': 'example.com',
        },
      });
      expect(healthRes.status).toBe(200);

      // Deep health endpoint
      const deepHealthRes = await app.request('/health/deep', {
        headers: {
          'x-forwarded-proto': 'http',
          'host': 'example.com',
        },
      });
      expect(deepHealthRes.status).toBe(200);

      // Root endpoint
      const rootRes = await app.request('/', {
        headers: {
          'x-forwarded-proto': 'http',
          'host': 'example.com',
        },
      });
      expect(rootRes.status).toBe(200);
    });

    it('should preserve query strings in redirect', async () => {
      const app = new Hono();
      app.use('/*', httpsRedirectMiddleware);
      app.get('/api/search', (c) => c.json({ results: [] }));

      const res = await app.request('http://example.com/api/search?q=test&page=2', {
        headers: {
          'x-forwarded-proto': 'http',
          'host': 'example.com',
        },
      });

      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://example.com/api/search?q=test&page=2');
    });

    it('should not redirect when x-forwarded-proto is not set', async () => {
      const app = new Hono();
      app.use('/*', httpsRedirectMiddleware);
      app.get('/api/data', (c) => c.json({ data: 'test' }));

      const res = await app.request('/api/data', {
        headers: {
          'host': 'example.com',
        },
      });

      // No x-forwarded-proto header means we can't determine protocol
      expect(res.status).toBe(200);
    });
  });
});
