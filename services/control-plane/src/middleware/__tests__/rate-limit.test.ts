/**
 * Tests for rate limiting middleware
 */

import { rateLimitMiddleware, shareLinkRateLimitMiddleware, resetRateLimit } from '../rate-limit';

describe('Rate Limiting', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    next = jest.fn();

    // Reset rate limits before each test
    resetRateLimit('ip:127.0.0.1');
    resetRateLimit('user:test-user');
  });

  describe('Anonymous Users', () => {
    it('should allow requests within limit (10/min)', () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        rateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(10);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding limit (10/min)', () => {
      // Make 11 requests
      for (let i = 0; i < 11; i++) {
        rateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(10);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
          limit: 10,
        })
      );
    });

    it('should set rate limit headers', () => {
      rateLimitMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });

  describe('Authenticated Users', () => {
    beforeEach(() => {
      req.user = { id: 'test-user' };
    });

    it('should allow requests within limit (60/min)', () => {
      // Make 60 requests
      for (let i = 0; i < 60; i++) {
        rateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(60);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding limit (60/min)', () => {
      // Make 61 requests
      for (let i = 0; i < 61; i++) {
        rateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(60);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
          limit: 60,
        })
      );
    });
  });

  describe('Share Link Rate Limiting', () => {
    beforeEach(() => {
      req.params = { shareLinkId: 'share-123' };
    });

    it('should allow requests within limit (100/hour)', () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        shareLinkRateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(100);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding limit (100/hour)', () => {
      // Make 101 requests
      for (let i = 0; i < 101; i++) {
        shareLinkRateLimitMiddleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(100);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Share link rate limit exceeded',
          limit: 100,
        })
      );
    });

    it('should pass through if no share link ID', () => {
      req.params = {};
      req.query = {};

      shareLinkRateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
