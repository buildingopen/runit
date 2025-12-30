/**
 * ABOUTME: Rate limiting middleware for API endpoints
 * ABOUTME: Prevents abuse with per-IP and per-user rate limits
 */

import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for v0
const rateLimitStore = new Map<string, RateLimitEntry>();

const LIMITS = {
  authenticated: {
    requestsPerMinute: 60,
    windowMs: 60_000
  },
  anonymous: {
    requestsPerMinute: 10,
    windowMs: 60_000
  },
  shareLink: {
    runsPerHour: 100,
    windowMs: 3600_000
  }
};

/**
 * Get rate limit key for request
 */
function getRateLimitKey(c: Context, prefix: string = 'api'): string {
  // In v0, use IP-based rate limiting
  // In production, use user ID for authenticated users
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Check and update rate limit
 */
function checkRateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or expired window
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt
    };
  }

  // Within window
  if (entry.count < limit) {
    entry.count++;
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt
    };
  }

  // Limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetAt: entry.resetAt
  };
}

/**
 * Clean up expired entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Rate limiting middleware for general API requests
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const key = getRateLimitKey(c, 'api');

  // Check if user is authenticated (placeholder - implement based on auth system)
  const isAuthenticated = !!c.req.header('authorization');

  const config = isAuthenticated ? LIMITS.authenticated : LIMITS.anonymous;
  const result = checkRateLimit(key, config.requestsPerMinute, config.windowMs);

  // Set rate limit headers
  c.header('X-RateLimit-Limit', config.requestsPerMinute.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.resetAt.toString());

  if (!result.allowed) {
    return c.json({
      error: 'Rate limit exceeded',
      message: isAuthenticated
        ? `Limit: ${config.requestsPerMinute} requests per minute for authenticated users`
        : `Limit: ${config.requestsPerMinute} requests per minute for anonymous users. Sign in for higher limits.`,
      resetAt: new Date(result.resetAt).toISOString()
    }, 429);
  }

  return next();
}

/**
 * Rate limiting middleware for share link runs
 */
export async function shareLinkRateLimitMiddleware(c: Context, next: Next) {
  const shareLinkId = c.req.param('shareLinkId');
  if (!shareLinkId) {
    return next();
  }

  const key = `share:${shareLinkId}`;
  const result = checkRateLimit(key, LIMITS.shareLink.runsPerHour, LIMITS.shareLink.windowMs);

  c.header('X-RateLimit-Limit', LIMITS.shareLink.runsPerHour.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.resetAt.toString());

  if (!result.allowed) {
    return c.json({
      error: 'Share link rate limit exceeded',
      message: `This share link has exceeded its limit of ${LIMITS.shareLink.runsPerHour} runs per hour`,
      resetAt: new Date(result.resetAt).toISOString()
    }, 429);
  }

  return next();
}

/**
 * Admin endpoint to view rate limit stats
 */
export function getRateLimitStats() {
  const stats: Array<{key: string; count: number; resetAt: string}> = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    stats.push({
      key,
      count: entry.count,
      resetAt: new Date(entry.resetAt).toISOString()
    });
  }

  return {
    totalEntries: stats.length,
    entries: stats
  };
}
