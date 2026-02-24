// ABOUTME: Per-user/IP rate limiting with three storage backends: Redis (distributed), Supabase (persistent), in-memory (dev).
// ABOUTME: Separate limits for authenticated users (120/min), anonymous (60/min), and share links (100/hr); returns 429 when exceeded.
/**
 * Rate Limiting Middleware
 *
 * Priority order:
 * 1. Redis (if REDIS_URL configured) - distributed rate limiting
 * 2. DB-backed (if Supabase configured) - persistent rate limiting
 * 3. In-memory fallback - for development
 */

import type { Context, Next } from 'hono';
import { getAuthContext } from './auth.js';
import { isSupabaseConfigured, getServiceSupabaseClient } from '../db/supabase.js';
import { rateLimitHitsTotal } from '../lib/metrics';
import { logger } from '../lib/logger';

// Redis client (lazy initialized)
let redisClient: RedisClient | null = null;
let redisInitialized = false;

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  quit(): Promise<void>;
}

/**
 * Initialize Redis client if REDIS_URL is set
 */
async function initRedis(): Promise<RedisClient | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('[RateLimit] Redis not configured, using fallback');
    return null;
  }

  try {
    // Dynamic import to avoid requiring ioredis when not used
    const { default: Redis } = await import('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 100, 3000);
      },
    });

    // Test connection
    await client.ping();
    logger.info('[RateLimit] Redis connected successfully');

    redisClient = {
      get: (key) => client.get(key),
      set: async (key, value, options) => {
        if (options?.EX) {
          await client.set(key, value, 'EX', options.EX);
        } else {
          await client.set(key, value);
        }
      },
      incr: (key) => client.incr(key),
      expire: (key, seconds) => client.expire(key, seconds).then(() => {}),
      quit: () => client.quit().then(() => {}),
    };

    return redisClient;
  } catch (error) {
    logger.warn('[RateLimit] Redis connection failed, using fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

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
 * Redis-backed rate limit check (preferred)
 */
async function checkRateLimitRedis(
  redis: RedisClient,
  key: string,
  limit: number,
  windowMs: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const redisKey = `ratelimit:${key}`;

  // Increment counter
  const count = await redis.incr(redisKey);

  // Set expiry on first request
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  const resetAt = Date.now() + windowMs;

  if (count <= limit) {
    return {
      allowed: true,
      remaining: limit - count,
      resetAt,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt,
  };
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

  // Atomic increment: only update if count < limit (prevents race condition)
  const resetAt = new Date(existing.window_start).getTime() + windowMs;
  const { data: updated, error: updateError } = await supabase
    .from('rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', key)
    .lt('count', limit)
    .select('count')
    .single();

  if (updateError || !updated) {
    // Limit exceeded (or concurrent request already incremented past limit)
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: limit - updated.count,
    resetAt,
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
  // Try Redis first
  const redis = await initRedis();
  if (redis) {
    try {
      return await checkRateLimitRedis(redis, key, limit, windowMs);
    } catch (error) {
      logger.warn('[RateLimit] Redis check failed, falling back', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Try Supabase
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
    // Track metric
    rateLimitHitsTotal.inc({
      type: 'api',
      key_type: isAuthenticated ? 'user' : 'ip',
    });

    return c.json({
      error: 'Too many requests',
      message: isAuthenticated
        ? `You can make up to ${config.requestsPerMinute} requests per minute. Please wait a moment and try again.`
        : `You can make up to ${config.requestsPerMinute} requests per minute. Sign in for higher limits.`,
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
    // Track metric
    rateLimitHitsTotal.inc({
      type: 'share_link',
      key_type: 'share_id',
    });

    return c.json({
      error: 'Too many requests on this share link',
      message: `This share link allows up to ${LIMITS.shareLink.runsPerHour} runs per hour. Please wait and try again.`,
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

/**
 * Graceful shutdown for Redis connection
 */
export async function shutdownRateLimit(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
