/**
 * ABOUTME: Rate limiting middleware for API endpoints
 * ABOUTME: Prevents abuse with per-IP and per-user rate limits
 */

import type { Context, Next } from 'hono';
import { getAuthContext } from './auth.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for v0
const rateLimitStore = new Map<string, RateLimitEntry>();

const LIMITS = {
  authenticated: {
    requestsPerMinute: 120,
    windowMs: 60_000
  },
  anonymous: {
    // Increased from 10 to 60 for better dev/demo experience
    // In production, consider lower limits with auth-based increases
    requestsPerMinute: 60,
    windowMs: 60_000
  },
  shareLink: {
    runsPerHour: 100,
    windowMs: 3600_000
  }
};

/**
 * Get rate limit key for request
 * Uses user ID for authenticated users, IP for anonymous
 */
function getRateLimitKey(c: Context, prefix: string = 'api'): string {
  const authContext = getAuthContext(c);

  // Use user ID for authenticated users
  if (authContext.isAuthenticated && authContext.user) {
    return `${prefix}:user:${authContext.user.id}`;
  }

  // Fall back to IP-based rate limiting for anonymous users
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  return `${prefix}:ip:${ip}`;
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
  // Skip rate limiting in development mode
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_RATE_LIMIT === 'true') {
    return next();
  }

  const key = getRateLimitKey(c, 'api');
  const authContext = getAuthContext(c);
  const isAuthenticated = authContext.isAuthenticated;

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
 * Reset rate limit for testing
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
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
