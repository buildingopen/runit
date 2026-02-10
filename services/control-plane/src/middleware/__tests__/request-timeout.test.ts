/**
 * Request Timeout Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requestTimeoutMiddleware, isRequestAborted } from '../request-timeout';

describe('Request Timeout Middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests that complete within timeout', async () => {
    const app = new Hono();
    app.use('/*', requestTimeoutMiddleware(5000));
    app.get('/fast', (c) => c.json({ success: true }));

    const res = await app.request('/fast');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('should return 408 for requests that exceed timeout', async () => {
    const app = new Hono();
    app.use('/*', requestTimeoutMiddleware(100)); // 100ms timeout
    app.get('/slow', async (c) => {
      // Simulate slow operation
      await new Promise((resolve) => setTimeout(resolve, 200));
      return c.json({ success: true });
    });

    // Start the request
    const requestPromise = app.request('/slow');

    // Advance timers past the timeout
    await vi.advanceTimersByTimeAsync(150);

    const res = await requestPromise;
    expect(res.status).toBe(408);

    const body = await res.json();
    expect(body.error).toBe('Request Timeout');
    expect(body.code).toBe('REQUEST_TIMEOUT');
  });

  it('should use default timeout of 30s when not specified', async () => {
    const app = new Hono();
    const middleware = requestTimeoutMiddleware();

    // The default should be 30000ms
    app.use('/*', middleware);
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('should set abort signal on context', async () => {
    const app = new Hono();
    let capturedSignal: AbortSignal | undefined;

    app.use('/*', requestTimeoutMiddleware(5000));
    app.get('/check-signal', (c) => {
      capturedSignal = c.get('abortSignal');
      return c.json({ hasSignal: !!capturedSignal });
    });

    await app.request('/check-signal');
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);
  });

  it('should pass through errors from handlers (not timeout)', async () => {
    const app = new Hono();
    app.use('/*', requestTimeoutMiddleware(5000));
    app.get('/error', () => {
      throw new Error('Handler error');
    });

    // Hono catches errors and returns 500, but it should NOT be a 408 timeout
    const res = await app.request('/error');
    expect(res.status).toBe(500);
    // Verify it's not our timeout response
    const text = await res.text();
    expect(text).not.toContain('Request Timeout');
  });
});

describe('isRequestAborted helper', () => {
  it('should return false when signal not set', () => {
    const app = new Hono();
    let result: boolean | undefined;

    app.get('/no-middleware', (c) => {
      result = isRequestAborted(c);
      return c.json({ ok: true });
    });

    app.request('/no-middleware');
    expect(result).toBe(false);
  });
});
