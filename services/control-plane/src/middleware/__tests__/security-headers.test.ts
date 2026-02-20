import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { securityHeadersMiddleware } from '../security-headers';

describe('securityHeadersMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('adds base security headers in non-production', async () => {
    const app = new Hono();
    app.use('/*', securityHeadersMiddleware);
    app.get('/ok', (c) => c.json({ ok: true }));

    const res = await app.request('/ok');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('adds HSTS and CSP in production', async () => {
    process.env.NODE_ENV = 'production';

    const app = new Hono();
    app.use('/*', securityHeadersMiddleware);
    app.get('/ok', (c) => c.json({ ok: true }));

    const res = await app.request('/ok');
    expect(res.status).toBe(200);
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });
});
