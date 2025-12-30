/**
 * Rate limiting middleware
 *
 * Implements per-IP rate limiting:
 * - 60 req/min for authenticated users
 * - 10 req/min for anonymous (share links)
 *
 * Returns 429 with clear message when exceeded
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  authenticated: {
    requestsPerMinute: number;
  };
  anonymous: {
    requestsPerMinute: number;
  };
}

const config: RateLimitConfig = {
  authenticated: {
    requestsPerMinute: 60,
  },
  anonymous: {
    requestsPerMinute: 10,
  },
};

// In-memory store (replace with Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredEntries, 60000);

/**
 * Get rate limit key from request
 */
function getRateLimitKey(ip: string, userId?: string): string {
  // Use user ID if authenticated, otherwise IP
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Check if request exceeds rate limit
 */
function checkRateLimit(
  key: string,
  limit: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + 60000, // 1 minute
    });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    // Limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

/**
 * Express middleware for rate limiting
 */
export function rateLimitMiddleware(req: any, res: any, next: any) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.user?.id; // From auth middleware
  const isAuthenticated = !!userId;

  const limit = isAuthenticated
    ? config.authenticated.requestsPerMinute
    : config.anonymous.requestsPerMinute;

  const key = getRateLimitKey(ip, userId);
  const { allowed, retryAfter } = checkRateLimit(key, limit);

  if (!allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: isAuthenticated
        ? `Rate limit: ${config.authenticated.requestsPerMinute} requests per minute for authenticated users`
        : `Rate limit: ${config.anonymous.requestsPerMinute} requests per minute for anonymous users`,
      retryAfter,
      limit,
      resetAt: Date.now() + (retryAfter || 0) * 1000,
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', (limit - (rateLimitStore.get(key)?.count || 0)).toString());
  res.setHeader('X-RateLimit-Reset', (rateLimitStore.get(key)?.resetAt || 0).toString());

  next();
}

/**
 * Share link rate limiting (stricter)
 * 100 runs/hour per share link
 */
export function shareLinkRateLimitMiddleware(req: any, res: any, next: any) {
  const shareLinkId = req.params.shareLinkId || req.query.shareLinkId;

  if (!shareLinkId) {
    next();
    return;
  }

  const key = `share:${shareLinkId}`;
  const limit = 100; // 100 runs per hour
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window (1 hour)
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + 3600000, // 1 hour
    });
    next();
    return;
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.status(429).json({
      error: 'Share link rate limit exceeded',
      message: `This share link has exceeded its limit of ${limit} runs per hour`,
      retryAfter,
      limit,
      resetAt: entry.resetAt,
    });
    return;
  }

  entry.count++;
  next();
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats() {
  const stats = {
    totalEntries: rateLimitStore.size,
    entries: Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      resetAt: new Date(entry.resetAt).toISOString(),
    })),
  };
  return stats;
}

/**
 * Reset rate limit for a specific key (admin only)
 */
export function resetRateLimit(key: string) {
  rateLimitStore.delete(key);
}

export default {
  rateLimitMiddleware,
  shareLinkRateLimitMiddleware,
  getRateLimitStats,
  resetRateLimit,
};
