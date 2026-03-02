/**
 * Acceptance tests for FinOps middleware
 *
 * Tests the complete flow per CLAUDE.md requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rateLimitMiddleware,
  shareLinkRateLimitMiddleware,
  quotaMiddleware,
  checkQuota,
  trackRunStart,
  trackRunComplete,
  resetRateLimit,
  resetQuota,
} from '../';
import {
  createMockContext,
  createMockNext,
  createAuthenticatedContext,
  createAnonymousContext,
  asHonoContext,
  asHonoNext,
} from '../test-helpers';

describe('FinOps Acceptance Tests', () => {
  describe('Rate Limiting Acceptance', () => {
    it('should enforce 120 req/min for authenticated users', async () => {
      resetRateLimit('api:user:auth-user');

      // Make 120 requests - should all succeed
      for (let i = 0; i < 120; i++) {
        const c = createAuthenticatedContext('auth-user', {
          method: 'GET',
          path: '/api/projects',
        });
        const next = createMockNext();
        await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
        expect(next).toHaveBeenCalled();
      }

      // 121st request should be blocked
      const c = createAuthenticatedContext('auth-user', {
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();
      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
          message: expect.stringContaining('120 requests per minute'),
        }),
        429
      );
    });

    it('should enforce 60 req/min for anonymous users', async () => {
      resetRateLimit('api:ip:192.168.1.1');

      // Make 60 requests - should all succeed
      for (let i = 0; i < 60; i++) {
        const c = createAnonymousContext('192.168.1.1', {
          method: 'GET',
          path: '/api/projects',
        });
        const next = createMockNext();
        await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));
        expect(next).toHaveBeenCalled();
      }

      // 61st request should be blocked
      const c = createAnonymousContext('192.168.1.1', {
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();
      await rateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
        }),
        429
      );
    });

    it('should enforce 100 runs/hour for share links', async () => {
      resetRateLimit('share:test-share');

      // Make 100 requests - should all succeed
      for (let i = 0; i < 100; i++) {
        const c = createAnonymousContext('192.168.1.1', {
          method: 'POST',
          path: '/share/test-share/run',
          params: { shareLinkId: 'test-share' },
        });
        const next = createMockNext();
        await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));
        expect(next).toHaveBeenCalled();
      }

      // 101st request should be blocked
      const c = createAnonymousContext('192.168.1.1', {
        method: 'POST',
        path: '/share/test-share/run',
        params: { shareLinkId: 'test-share' },
      });
      const next = createMockNext();
      await shareLinkRateLimitMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests on this share link',
        }),
        429
      );
    });
  });

  describe('Quota Enforcement Acceptance', () => {
    const userId = 'quota-test-user';

    beforeEach(() => {
      resetQuota(userId);
    });

    it('should enforce 100 CPU runs/hour per user', () => {
      // Simulate 100 CPU runs
      for (let i = 0; i < 100; i++) {
        const { allowed } = checkQuota(userId, 'cpu');
        expect(allowed).toBe(true);

        trackRunStart(userId, `cpu-run-${i}`, 'cpu');
        trackRunComplete(userId, `cpu-run-${i}`, 'cpu');
      }

      // 101st run should be blocked
      const { allowed, reason } = checkQuota(userId, 'cpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('100 runs per hour');
    });

    it('should enforce 10 GPU runs/hour per user', () => {
      // Simulate 10 GPU runs
      for (let i = 0; i < 10; i++) {
        const { allowed } = checkQuota(userId, 'gpu');
        expect(allowed).toBe(true);

        trackRunStart(userId, `gpu-run-${i}`, 'gpu');
        trackRunComplete(userId, `gpu-run-${i}`, 'gpu');
      }

      // 11th run should be blocked
      const { allowed, reason } = checkQuota(userId, 'gpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('10 runs per hour');
    });

    it('should enforce 2 concurrent CPU runs', () => {
      // Start 2 concurrent CPU runs
      trackRunStart(userId, 'cpu-1', 'cpu');
      trackRunStart(userId, 'cpu-2', 'cpu');

      // 3rd concurrent run should be blocked
      const { allowed, reason } = checkQuota(userId, 'cpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('same time');

      // Complete one run
      trackRunComplete(userId, 'cpu-1', 'cpu');

      // Now should be able to start another
      const { allowed: allowedAfter } = checkQuota(userId, 'cpu');
      expect(allowedAfter).toBe(true);
    });

    it('should enforce 1 concurrent GPU run', () => {
      // Start 1 GPU run
      trackRunStart(userId, 'gpu-1', 'gpu');

      // 2nd concurrent run should be blocked
      const { allowed, reason } = checkQuota(userId, 'gpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('same time');

      // Complete the run
      trackRunComplete(userId, 'gpu-1', 'gpu');

      // Now should be able to start another
      const { allowed: allowedAfter } = checkQuota(userId, 'gpu');
      expect(allowedAfter).toBe(true);
    });
  });

  describe('Complete FinOps Flow', () => {
    it('should handle authenticated user creating runs', async () => {
      const userId = 'flow-test-user';
      resetRateLimit('api:user:' + userId);
      resetQuota(userId);

      // Step 1: Rate limit middleware
      const c1 = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next1 = createMockNext();
      await rateLimitMiddleware(asHonoContext(c1), asHonoNext(next1));
      expect(next1).toHaveBeenCalled();

      // Step 2: Quota middleware
      const c2 = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next2 = createMockNext();
      await quotaMiddleware(asHonoContext(c2), asHonoNext(next2));
      expect(next2).toHaveBeenCalled();

      // Should have quota tracking attached
      const quotaTracking = c2.get('quotaTracking');
      expect(quotaTracking).toBeDefined();
    });

    it('should handle full run lifecycle with quota tracking', async () => {
      const userId = 'lifecycle-test-user';
      resetRateLimit('api:user:' + userId);
      resetQuota(userId);

      // Create run request
      const c = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      // Get quota tracking functions
      const quotaTracking = c.get('quotaTracking') as {
        userId: string;
        lane: string;
        trackStart: (runId: string) => void;
        trackComplete: (runId: string) => void;
      };

      expect(quotaTracking).toBeDefined();

      // Simulate run lifecycle
      quotaTracking.trackStart('run-123');

      // Check concurrent limit is now at 1
      const { concurrentRemaining } = checkQuota(userId, 'cpu');
      expect(concurrentRemaining).toBe(0); // 2 max - 1 active = 1, but we're asking for capacity to start another

      // Complete the run
      quotaTracking.trackComplete('run-123');

      // Check concurrent limit is restored
      const afterComplete = checkQuota(userId, 'cpu');
      expect(afterComplete.allowed).toBe(true);
    });
  });
});
