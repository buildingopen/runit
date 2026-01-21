/**
 * Tests for quota enforcement middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkQuota,
  trackRunStart,
  trackRunComplete,
  quotaMiddleware,
  resetQuota,
} from '../quota';
import {
  createMockContext,
  createMockNext,
  createAuthenticatedContext,
  createAnonymousContext,
  asHonoContext,
  asHonoNext,
} from '../test-helpers';

describe('Quota Enforcement', () => {
  const userId = 'test-user';

  beforeEach(() => {
    // Reset quota before each test
    resetQuota(userId);
  });

  describe('CPU Quotas', () => {
    it('should allow runs within hourly quota (100/hour)', () => {
      // Simulate 100 runs
      for (let i = 0; i < 100; i++) {
        const { allowed } = checkQuota(userId, 'cpu');
        expect(allowed).toBe(true);

        if (allowed) {
          trackRunStart(userId, `run-${i}`, 'cpu');
          trackRunComplete(userId, `run-${i}`, 'cpu');
        }
      }
    });

    it('should block runs exceeding hourly quota', () => {
      // Use up quota
      for (let i = 0; i < 100; i++) {
        trackRunStart(userId, `run-${i}`, 'cpu');
        trackRunComplete(userId, `run-${i}`, 'cpu');
      }

      // Try one more
      const { allowed, reason } = checkQuota(userId, 'cpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('CPU quota exceeded');
    });

    it('should enforce concurrent run limit (2)', () => {
      // Start 2 concurrent runs
      trackRunStart(userId, 'run-1', 'cpu');
      trackRunStart(userId, 'run-2', 'cpu');

      // Try to start a 3rd
      const { allowed, reason } = checkQuota(userId, 'cpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('concurrent limit');
    });

    it('should allow new runs after completing concurrent runs', () => {
      // Start and complete 2 runs
      trackRunStart(userId, 'run-1', 'cpu');
      trackRunStart(userId, 'run-2', 'cpu');

      // Complete one
      trackRunComplete(userId, 'run-1', 'cpu');

      // Should be able to start another
      const { allowed } = checkQuota(userId, 'cpu');
      expect(allowed).toBe(true);
    });
  });

  describe('GPU Quotas', () => {
    it('should allow runs within hourly quota (10/hour)', () => {
      // Simulate 10 runs
      for (let i = 0; i < 10; i++) {
        const { allowed } = checkQuota(userId, 'gpu');
        expect(allowed).toBe(true);

        if (allowed) {
          trackRunStart(userId, `run-${i}`, 'gpu');
          trackRunComplete(userId, `run-${i}`, 'gpu');
        }
      }
    });

    it('should block runs exceeding hourly quota', () => {
      // Use up quota
      for (let i = 0; i < 10; i++) {
        trackRunStart(userId, `run-${i}`, 'gpu');
        trackRunComplete(userId, `run-${i}`, 'gpu');
      }

      // Try one more
      const { allowed, reason } = checkQuota(userId, 'gpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('GPU quota exceeded');
    });

    it('should enforce concurrent run limit (1)', () => {
      // Start 1 run
      trackRunStart(userId, 'run-1', 'gpu');

      // Try to start a 2nd
      const { allowed, reason } = checkQuota(userId, 'gpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('concurrent limit');
    });
  });

  describe('Quota Middleware', () => {
    beforeEach(() => {
      resetQuota(userId);
    });

    it('should allow requests within quota', async () => {
      const c = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();
      expect(c.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Quota exceeded' }),
        429
      );
    });

    it('should block requests exceeding quota', async () => {
      // Use up quota
      for (let i = 0; i < 100; i++) {
        trackRunStart(userId, `run-${i}`, 'cpu');
        trackRunComplete(userId, `run-${i}`, 'cpu');
      }

      const c = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Quota exceeded',
        }),
        429
      );
    });

    it('should pass through for non-run endpoints', async () => {
      const c = createAnonymousContext('127.0.0.1', {
        method: 'GET',
        path: '/projects',
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();
    });

    it('should pass through for non-POST requests', async () => {
      const c = createAnonymousContext('127.0.0.1', {
        method: 'GET',
        path: '/runs/123',
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();
    });

    it('should attach quota tracking to context', async () => {
      const c = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      const quotaTracking = c.get('quotaTracking') as {
        userId: string;
        lane: string;
        trackStart: (runId: string) => void;
        trackComplete: (runId: string) => void;
      };

      expect(quotaTracking).toBeDefined();
      expect(quotaTracking.userId).toBe(userId);
      expect(quotaTracking.lane).toBe('cpu');
      expect(typeof quotaTracking.trackStart).toBe('function');
      expect(typeof quotaTracking.trackComplete).toBe('function');
    });

    it('should set quota headers on successful requests', async () => {
      const c = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'cpu' },
        headers: { 'x-user-id': userId },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(c._responseHeaders.get('X-Quota-CPU-Remaining')).toBeDefined();
      expect(c._responseHeaders.get('X-Quota-CPU-Concurrent')).toBeDefined();
    });

    it('should reject invalid lane', async () => {
      const c = createAuthenticatedContext(userId, {
        method: 'POST',
        path: '/runs',
        body: { lane: 'invalid' },
        headers: { 'x-user-id': userId },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid lane. Must be "cpu" or "gpu"' }),
        400
      );
    });
  });
});
