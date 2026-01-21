/**
 * Tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimitMiddleware, shareLinkRateLimitMiddleware, resetRateLimit } from '../rate-limit';
import {
  createMockContext,
  createMockNext,
  createAuthenticatedContext,
  createAnonymousContext,
  asHonoContext,
  asHonoNext,
} from '../test-helpers';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset rate limits before each test
    resetRateLimit('api:ip:127.0.0.1');
    resetRateLimit('api:user:test-user');
    resetRateLimit('share:share-123');
  });

  describe('Anonymous Users', () => {
    it('should allow requests within limit (60/min for anonymous)', async () => {
      // Make 60 requests (the anonymous limit)
      for (let i = 0; i < 60; i++) {
        const c = createAnonymousContext('127.0.0.1', {
          method: 'GET',
          path: '/api/projects',
        });
        const next = createMockNext();

        await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

        expect(next).toHaveBeenCalled();
        expect(c.json).not.toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Rate limit exceeded' }),
          429
        );
      }
    });

    it('should block requests exceeding limit', async () => {
      // Use up the limit
      for (let i = 0; i < 60; i++) {
        const c = createAnonymousContext('127.0.0.1', {
          method: 'GET',
          path: '/api/projects',
        });
        const next = createMockNext();
        await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      }

      // 61st request should be blocked
      const c = createAnonymousContext('127.0.0.1', {
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
        }),
        429
      );
    });

    it('should set rate limit headers', async () => {
      const c = createAnonymousContext('127.0.0.1', {
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(c._responseHeaders.get('X-RateLimit-Limit')).toBeDefined();
      expect(c._responseHeaders.get('X-RateLimit-Remaining')).toBeDefined();
      expect(c._responseHeaders.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('Authenticated Users', () => {
    beforeEach(() => {
      resetRateLimit('api:user:test-user');
    });

    it('should allow requests within limit (120/min for authenticated)', async () => {
      // Make 120 requests (the authenticated limit)
      for (let i = 0; i < 120; i++) {
        const c = createAuthenticatedContext('test-user', {
          method: 'GET',
          path: '/api/projects',
        });
        const next = createMockNext();

        await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

        expect(next).toHaveBeenCalled();
        expect(c.json).not.toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Rate limit exceeded' }),
          429
        );
      }
    });

    it('should block requests exceeding limit', async () => {
      // Use up the limit
      for (let i = 0; i < 120; i++) {
        const c = createAuthenticatedContext('test-user', {
          method: 'GET',
          path: '/api/projects',
        });
        const next = createMockNext();
        await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      }

      // 121st request should be blocked
      const c = createAuthenticatedContext('test-user', {
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
        }),
        429
      );
    });
  });

  describe('Share Link Rate Limiting', () => {
    beforeEach(() => {
      resetRateLimit('share:share-123');
    });

    it('should allow requests within limit (100/hour)', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        const c = createAnonymousContext('127.0.0.1', {
          method: 'POST',
          path: '/share/share-123/run',
          params: { shareLinkId: 'share-123' },
        });
        const next = createMockNext();

        await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));

        expect(next).toHaveBeenCalled();
        expect(c.json).not.toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Share link rate limit exceeded' }),
          429
        );
      }
    });

    it('should block requests exceeding limit (100/hour)', async () => {
      // Use up the limit
      for (let i = 0; i < 100; i++) {
        const c = createAnonymousContext('127.0.0.1', {
          method: 'POST',
          path: '/share/share-123/run',
          params: { shareLinkId: 'share-123' },
        });
        const next = createMockNext();
        await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));
      }

      // 101st request should be blocked
      const c = createAnonymousContext('127.0.0.1', {
        method: 'POST',
        path: '/share/share-123/run',
        params: { shareLinkId: 'share-123' },
      });
      const next = createMockNext();

      await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Share link rate limit exceeded',
        }),
        429
      );
    });

    it('should pass through if no share link ID', async () => {
      const c = createAnonymousContext('127.0.0.1', {
        method: 'POST',
        path: '/runs',
        params: {},
      });
      const next = createMockNext();

      await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();
      expect(c.json).not.toHaveBeenCalled();
    });
  });
});
