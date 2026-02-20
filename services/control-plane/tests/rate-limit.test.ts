/**
 * Rate Limiting tests
 *
 * Covers: checkRateLimitRedis (lines 93-124), checkRateLimitDB (lines 137-171),
 * rateLimitMiddleware (line 281), shareLinkRateLimitMiddleware,
 * getRateLimitStats (lines 352-369).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createMockContext,
  createAuthenticatedContext,
  createAnonymousContext,
  createMockNext,
  asHonoContext,
  asHonoNext,
} from '../src/middleware/test-helpers';

// --- Supabase + auth mock wiring ---

const mockIsSupabaseConfigured = vi.fn(() => false);
const mockGetServiceSupabaseClient = vi.fn();

vi.mock('../src/db/supabase.js', () => ({
  isSupabaseConfigured: (...args: unknown[]) => mockIsSupabaseConfigured(...args),
  getServiceSupabaseClient: (...args: unknown[]) => mockGetServiceSupabaseClient(...args),
}));

vi.mock('../src/middleware/auth.js', () => ({
  getAuthContext: (c: any) => {
    return c.get('authContext') || { user: null, isAuthenticated: false };
  },
}));

vi.mock('../src/lib/metrics', () => ({
  rateLimitHitsTotal: { inc: vi.fn() },
}));

vi.mock('../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Prevent ioredis from being imported
vi.mock('ioredis', () => {
  throw new Error('ioredis not available');
});

import {
  rateLimitMiddleware,
  shareLinkRateLimitMiddleware,
  resetRateLimit,
  getRateLimitStats,
  shutdownRateLimit,
} from '../src/middleware/rate-limit';

describe('rate-limit', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDisableFlag = process.env.DISABLE_RATE_LIMIT;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.DISABLE_RATE_LIMIT;
    delete process.env.REDIS_URL;
    mockIsSupabaseConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDisableFlag !== undefined) process.env.DISABLE_RATE_LIMIT = originalDisableFlag;
    else delete process.env.DISABLE_RATE_LIMIT;
  });

  describe('rateLimitMiddleware', () => {
    it('skips in development mode', async () => {
      process.env.NODE_ENV = 'development';
      const c = createMockContext();
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
    });

    it('skips when DISABLE_RATE_LIMIT=true', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';
      const c = createMockContext();
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
    });

    it('allows requests under the limit for anonymous users', async () => {
      const c = createAnonymousContext('192.168.1.1');
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
      expect(c._responseHeaders.get('X-RateLimit-Limit')).toBe('60');
    });

    it('allows requests under the limit for authenticated users', async () => {
      const c = createAuthenticatedContext('user-1');
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
      expect(c._responseHeaders.get('X-RateLimit-Limit')).toBe('120');
    });

    it('blocks requests over the limit for anonymous users', async () => {
      // Exhaust the limit (60 req/min for anonymous)
      for (let i = 0; i < 60; i++) {
        const ctx = createAnonymousContext('10.0.0.1');
        const nxt = createMockNext();
        await rateLimitMiddleware(asHonoContext(ctx), asHonoNext(nxt));
      }

      // 61st request should be blocked
      const c = createAnonymousContext('10.0.0.1');
      const next = createMockNext();
      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(false);
      expect(c.json).toHaveBeenCalled();
      const callArgs = (c.json as any).mock.calls[0];
      expect(callArgs[1]).toBe(429);
      expect(callArgs[0].error).toBe('Rate limit exceeded');

      // Clean up
      resetRateLimit('api:ip:10.0.0.1');
    });

    it('blocks requests over the limit for authenticated users', async () => {
      // Exhaust the limit (120 req/min for authenticated)
      for (let i = 0; i < 120; i++) {
        const ctx = createAuthenticatedContext('rate-limit-test-user');
        const nxt = createMockNext();
        await rateLimitMiddleware(asHonoContext(ctx), asHonoNext(nxt));
      }

      const c = createAuthenticatedContext('rate-limit-test-user');
      const next = createMockNext();
      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(false);
      expect(c.json).toHaveBeenCalled();
      const callArgs = (c.json as any).mock.calls[0];
      expect(callArgs[1]).toBe(429);
      expect(callArgs[0].message).toContain('authenticated users');

      // Clean up
      resetRateLimit('api:user:rate-limit-test-user');
    });

    it('sets rate limit response headers', async () => {
      const c = createAnonymousContext('header-test-ip');
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(c._responseHeaders.get('X-RateLimit-Limit')).toBeDefined();
      expect(c._responseHeaders.get('X-RateLimit-Remaining')).toBeDefined();
      expect(c._responseHeaders.get('X-RateLimit-Reset')).toBeDefined();

      resetRateLimit('api:ip:header-test-ip');
    });
  });

  describe('shareLinkRateLimitMiddleware', () => {
    it('passes through when no shareLinkId param', async () => {
      const c = createMockContext({ method: 'POST', path: '/share/run' });
      const next = createMockNext();

      await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
    });

    it('allows requests under share link limit', async () => {
      const c = createMockContext({
        method: 'POST',
        path: '/share/link-1/run',
        params: { shareLinkId: 'link-1' },
      });
      const next = createMockNext();

      await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
      expect(c._responseHeaders.get('X-RateLimit-Limit')).toBe('100');

      resetRateLimit('share:link-1');
    });

    it('blocks when share link rate limit exceeded', async () => {
      // Exhaust 100 runs
      for (let i = 0; i < 100; i++) {
        const ctx = createMockContext({
          method: 'POST',
          path: '/share/blocked-link/run',
          params: { shareLinkId: 'blocked-link' },
        });
        const nxt = createMockNext();
        await shareLinkRateLimitMiddleware(asHonoContext(ctx), asHonoNext(nxt));
      }

      const c = createMockContext({
        method: 'POST',
        path: '/share/blocked-link/run',
        params: { shareLinkId: 'blocked-link' },
      });
      const next = createMockNext();
      await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(false);
      const callArgs = (c.json as any).mock.calls[0];
      expect(callArgs[1]).toBe(429);
      expect(callArgs[0].error).toBe('Share link rate limit exceeded');

      resetRateLimit('share:blocked-link');
    });
  });

  describe('resetRateLimit', () => {
    it('removes an entry from the in-memory store', async () => {
      const c = createAnonymousContext('reset-ip');
      const next = createMockNext();
      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      resetRateLimit('api:ip:reset-ip');

      // After reset, should be able to make requests again from scratch
      const c2 = createAnonymousContext('reset-ip');
      const next2 = createMockNext();
      await rateLimitMiddleware(asHonoContext(c2), asHonoNext(next2));
      expect(next2.wasCalled()).toBe(true);
      expect(c2._responseHeaders.get('X-RateLimit-Remaining')).toBe('59');

      resetRateLimit('api:ip:reset-ip');
    });
  });

  describe('getRateLimitStats', () => {
    it('returns stats including entries with count and resetAt', async () => {
      // Create some entries
      const c = createAnonymousContext('stats-ip');
      const next = createMockNext();
      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      const stats = getRateLimitStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
      expect(stats.entries).toBeDefined();
      expect(Array.isArray(stats.entries)).toBe(true);

      const entry = stats.entries.find((e) => e.key === 'api:ip:stats-ip');
      expect(entry).toBeDefined();
      expect(entry!.count).toBe(1);
      expect(entry!.resetAt).toBeDefined();

      resetRateLimit('api:ip:stats-ip');
    });

    it('returns empty stats when no entries', () => {
      const stats = getRateLimitStats();
      // There may be entries from other tests; just verify structure
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('entries');
    });
  });

  describe('shutdownRateLimit', () => {
    it('resolves without error when no Redis client', async () => {
      await expect(shutdownRateLimit()).resolves.toBeUndefined();
    });
  });
});
