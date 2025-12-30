/**
 * Acceptance tests for FinOps middleware
 *
 * Tests the complete flow per CLAUDE.md requirements
 */

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

describe('FinOps Acceptance Tests', () => {
  describe('Rate Limiting Acceptance', () => {
    it('should enforce 60 req/min for authenticated users', () => {
      const req = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        user: { id: 'auth-user' },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      const next = jest.fn();

      resetRateLimit('user:auth-user');

      // Make 60 requests - should all succeed
      for (let i = 0; i < 60; i++) {
        rateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(60);

      // 61st request should be blocked
      rateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(60); // Still 60
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
          message: expect.stringContaining('60 requests per minute'),
        })
      );
    });

    it('should enforce 10 req/min for anonymous users', () => {
      const req = {
        ip: '192.168.1.1',
        connection: { remoteAddress: '192.168.1.1' },
        user: null,
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      const next = jest.fn();

      resetRateLimit('ip:192.168.1.1');

      // Make 10 requests - should all succeed
      for (let i = 0; i < 10; i++) {
        rateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(10);

      // 11th request should be blocked
      rateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(10); // Still 10
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should enforce 100 runs/hour for share links', () => {
      const req = {
        params: { shareLinkId: 'test-share' },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const next = jest.fn();

      resetRateLimit('share:test-share');

      // Make 100 requests - should all succeed
      for (let i = 0; i < 100; i++) {
        shareLinkRateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(100);

      // 101st request should be blocked
      shareLinkRateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(100); // Still 100
      expect(res.status).toHaveBeenCalledWith(429);
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
      expect(reason).toContain('CPU quota exceeded');
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
      expect(reason).toContain('GPU quota exceeded');
    });

    it('should enforce 2 concurrent CPU runs', () => {
      // Start 2 concurrent CPU runs
      trackRunStart(userId, 'cpu-1', 'cpu');
      trackRunStart(userId, 'cpu-2', 'cpu');

      // 3rd concurrent run should be blocked
      const { allowed, reason } = checkQuota(userId, 'cpu');
      expect(allowed).toBe(false);
      expect(reason).toContain('concurrency limit');

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
      expect(reason).toContain('concurrency limit');

      // Complete the run
      trackRunComplete(userId, 'gpu-1', 'gpu');

      // Now should be able to start another
      const { allowed: allowedAfter } = checkQuota(userId, 'gpu');
      expect(allowedAfter).toBe(true);
    });
  });

  describe('Complete FinOps Flow', () => {
    it('should handle authenticated user creating runs', () => {
      const userId = 'flow-test-user';
      const req = {
        ip: '10.0.0.1',
        user: { id: userId },
        body: { lane: 'cpu' },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      const next = jest.fn();

      resetRateLimit('user:' + userId);
      resetQuota(userId);

      // Apply both middlewares
      rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();

      quotaMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Should have quota tracking attached
      expect(req.quotaTracking).toBeDefined();
    });

    it('should block anonymous GPU runs', () => {
      const req = {
        ip: '10.0.0.2',
        user: null,
        body: { lane: 'gpu' },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const next = jest.fn();

      quotaMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
