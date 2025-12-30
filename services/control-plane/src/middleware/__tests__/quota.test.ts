/**
 * Tests for quota enforcement middleware
 */

import {
  checkQuota,
  trackRunStart,
  trackRunComplete,
  quotaMiddleware,
  resetQuota,
} from '../quota';

describe('Quota Enforcement', () => {
  const userId = 'test-user';
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      user: { id: userId },
      body: { lane: 'cpu' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();

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
      expect(reason).toContain('concurrency limit');
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
      expect(reason).toContain('concurrency limit');
    });
  });

  describe('Quota Middleware', () => {
    it('should allow requests within quota', () => {
      quotaMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding quota', () => {
      // Use up quota
      for (let i = 0; i < 100; i++) {
        trackRunStart(userId, `run-${i}`, 'cpu');
        trackRunComplete(userId, `run-${i}`, 'cpu');
      }

      quotaMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Quota exceeded',
          lane: 'cpu',
        })
      );
    });

    it('should reject anonymous users', () => {
      req.user = null;

      quotaMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should attach quota tracking to request', () => {
      quotaMiddleware(req, res, next);

      expect(req.quotaTracking).toBeDefined();
      expect(req.quotaTracking.userId).toBe(userId);
      expect(req.quotaTracking.lane).toBe('cpu');
      expect(typeof req.quotaTracking.trackStart).toBe('function');
      expect(typeof req.quotaTracking.trackComplete).toBe('function');
    });
  });
});
