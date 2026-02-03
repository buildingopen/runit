/**
 * Rate Limiting Middleware
 *
 * Uses DB-backed rate limits when Supabase is configured,
 * falls back to in-memory for development.
 */

import type { Context, Next } from 'hono';
import { getAuthContext } from './auth.js';
import { isSupabaseConfigured, getServiceSupabaseClient } from '../db/supabase.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (fallback for dev)
const rateLimitStore = new Map<string, RateLimitEntry>();

const LIMITS = {
  authenticated: {
    requestsPerMinute: 120,
    windowMs: 60_000
  },
  anonymous: {
    requestsPerMinute: 60,
    windowMs: 60_000
  },
  shareLink: {
    runsPerHour: 100,
    windowMs: 3600_000
  }
};

function getRateLimitKey(c: Context, prefix: string = 'api'): string {
  const authContext = getAuthContext(c);

  if (authContext.isAuthenticated && authContext.user) {
    return `${prefix}:user:${authContext.user.id}`;
  }

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  return `${prefix}:ip:${ip}`;
}

/**
 * DB-backed rate limit check
 */
async function checkRateLimitDB(key: string, limit: number, windowMs: number): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const supabase = getServiceSupabaseClient();
  const now = new Date();

  // Try to get existing entry
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .single();

  if (!existing || new Date(existing.window_start).getTime() + windowMs < now.getTime()) {
    // No entry or expired - upsert new window
    await supabase
      .from('rate_limits')
      .upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        window_ms: windowMs,
      }, { onConflict: 'key' });

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now.getTime() + windowMs,
    };
  }

  // Within window - increment
  if (existing.count < limit) {
    await supabase
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('key', key);

    const resetAt = new Date(existing.window_start).getTime() + windowMs;
    return {
      allowed: true,
      remaining: limit - existing.count - 1,
      resetAt,
    };
  }

  // Limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetAt: new Date(existing.window_start).getTime() + windowMs,
  };
}

/**
 * In-memory rate limit check (fallback)
 */
function checkRateLimitMemory(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count < limit) {
    entry.count++;
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }

  return { allowed: false, remaining: 0, resetAt: entry.resetAt };
}

async function checkRateLimit(key: string, limit: number, windowMs: number) {
  if (isSupabaseConfigured()) {
    try {
      return await checkRateLimitDB(key, limit, windowMs);
    } catch {
      // Fall back to in-memory on DB error
      return checkRateLimitMemory(key, limit, windowMs);
    }
  }
  return checkRateLimitMemory(key, limit, windowMs);
}

// Cleanup expired in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_RATE_LIMIT === 'true') {
    return next();
  }

  const key = getRateLimitKey(c, 'api');
  const authContext = getAuthContext(c);
  const isAuthenticated = authContext.isAuthenticated;

  const config = isAuthenticated ? LIMITS.authenticated : LIMITS.anonymous;
  const result = await checkRateLimit(key, config.requestsPerMinute, config.windowMs);

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
  const result = await checkRateLimit(key, LIMITS.shareLink.runsPerHour, LIMITS.shareLink.windowMs);

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

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

export function getRateLimitStats() {
  const stats: Array<{key: string; count: number; resetAt: string}> = [];
  for (const [key, entry] of rateLimitStore.entries()) {
    stats.push({
      key,
      count: entry.count,
      resetAt: new Date(entry.resetAt).toISOString()
    });
  }
  return { totalEntries: stats.length, entries: stats };
}
