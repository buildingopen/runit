// ABOUTME: Enforces per-user hourly run quotas and concurrent run limits for CPU/GPU lanes.
// ABOUTME: Uses DB-backed tracking (Supabase) when available, falls back to in-memory; returns 429 when exceeded.
/**
 * Quota Enforcement Middleware
 *
 * Tracks hourly and concurrent usage per authenticated user.
 * Uses DB-backed quotas when Supabase is configured.
 */

import type { Context, Next } from 'hono';
import { getAuthContext } from './auth.js';
import { isSupabaseConfigured, getServiceSupabaseClient } from '../db/supabase.js';
import { logger } from '../lib/logger.js';
import { getUserTier } from '../db/billing-store.js';
import { getTierLimits } from '../config/tiers.js';

interface QuotaUsage {
  cpuRunsThisHour: number;
  gpuRunsThisHour: number;
  activeCpuRuns: Set<string>;
  activeGpuRuns: Set<string>;
  hourlyResetAt: number;
}

// In-memory store (fallback)
const quotaStore = new Map<string, QuotaUsage>();

// Default limits (used when billing store is not available)
const DEFAULT_QUOTA_LIMITS = {
  cpu: {
    runsPerHour: 100,
    maxConcurrent: 2
  },
  gpu: {
    runsPerHour: 10,
    maxConcurrent: 1
  }
};

/**
 * Get quota limits for a user, using tier-based billing when available.
 */
async function getQuotaLimitsForUser(userId: string): Promise<{ cpu: { runsPerHour: number; maxConcurrent: number }; gpu: { runsPerHour: number; maxConcurrent: number } }> {
  try {
    const tier = await getUserTier(userId);
    const tierLimits = getTierLimits(tier);
    return {
      cpu: { runsPerHour: tierLimits.cpuRunsPerHour, maxConcurrent: tierLimits.maxConcurrentCpu },
      gpu: { runsPerHour: tierLimits.gpuRunsPerHour, maxConcurrent: tierLimits.maxConcurrentGpu },
    };
  } catch {
    return DEFAULT_QUOTA_LIMITS;
  }
}

// Keep a reference used by in-memory check functions (backward compat)
const QUOTA_LIMITS = DEFAULT_QUOTA_LIMITS;

// --- In-memory helpers ---

function getQuotaUsageMemory(userId: string): QuotaUsage {
  const now = Date.now();
  const existing = quotaStore.get(userId);

  if (existing && now >= existing.hourlyResetAt) {
    quotaStore.delete(userId);
  }

  if (!quotaStore.has(userId)) {
    const usage: QuotaUsage = {
      cpuRunsThisHour: 0,
      gpuRunsThisHour: 0,
      activeCpuRuns: new Set(),
      activeGpuRuns: new Set(),
      hourlyResetAt: now + 3600_000
    };
    quotaStore.set(userId, usage);
    return usage;
  }

  return quotaStore.get(userId)!;
}

// --- DB-backed helpers ---

async function getOrCreateDBQuota(userId: string, lane: 'cpu' | 'gpu') {
  const supabase = getServiceSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  const { data: existing } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('period', 'hourly')
    .gte('period_start', hourStart.toISOString())
    .single();

  if (existing) return existing;

  // Create new period
  const { data: created } = await supabase
    .from('usage_quotas')
    .upsert({
      user_id: userId,
      period: 'hourly',
      period_start: hourStart.toISOString(),
      cpu_run_count: 0,
      gpu_run_count: 0,
      active_cpu_runs: 0,
      active_gpu_runs: 0,
    }, { onConflict: 'user_id,period,period_start' })
    .select()
    .single();

  return created;
}

export function resetQuota(userId: string): void {
  quotaStore.delete(userId);
}

export function checkQuota(userId: string, lane: 'cpu' | 'gpu'): {
  allowed: boolean;
  reason?: string;
  runsRemaining?: number;
  concurrentRemaining?: number;
} {
  return checkQuotaInMemory(userId, lane);
}

function checkQuotaInMemory(
  userId: string,
  lane: 'cpu' | 'gpu',
  customLimits?: { cpu: { runsPerHour: number; maxConcurrent: number }; gpu: { runsPerHour: number; maxConcurrent: number } }
): {
  allowed: boolean;
  reason?: string;
  runsRemaining?: number;
  concurrentRemaining?: number;
} {
  const usage = getQuotaUsageMemory(userId);
  const limits = customLimits ? customLimits[lane] : QUOTA_LIMITS[lane];

  const runsThisHour = lane === 'cpu' ? usage.cpuRunsThisHour : usage.gpuRunsThisHour;
  if (runsThisHour >= limits.runsPerHour) {
    return {
      allowed: false,
      reason: `You've reached the limit of ${limits.runsPerHour} runs per hour. Please wait and try again.`,
      runsRemaining: 0
    };
  }

  const activeRuns = lane === 'cpu' ? usage.activeCpuRuns : usage.activeGpuRuns;
  if (activeRuns.size >= limits.maxConcurrent) {
    return {
      allowed: false,
      reason: `You can only run ${limits.maxConcurrent} app${limits.maxConcurrent > 1 ? 's' : ''} at the same time. Wait for a current run to finish.`,
      concurrentRemaining: 0
    };
  }

  return {
    allowed: true,
    runsRemaining: limits.runsPerHour - runsThisHour - 1,
    concurrentRemaining: limits.maxConcurrent - activeRuns.size - 1
  };
}

async function checkQuotaDB(
  userId: string,
  lane: 'cpu' | 'gpu',
  customLimits?: { cpu: { runsPerHour: number; maxConcurrent: number }; gpu: { runsPerHour: number; maxConcurrent: number } }
): Promise<{
  allowed: boolean;
  reason?: string;
  runsRemaining?: number;
  concurrentRemaining?: number;
}> {
  const quota = await getOrCreateDBQuota(userId, lane);
  const limits = customLimits ? customLimits[lane] : QUOTA_LIMITS[lane];
  if (!quota) return { allowed: true, runsRemaining: limits.runsPerHour };

  const count = lane === 'cpu' ? quota.cpu_run_count : quota.gpu_run_count;

  if (count >= limits.runsPerHour) {
    return {
      allowed: false,
      reason: `You've reached the limit of ${limits.runsPerHour} runs per hour. Please wait and try again.`,
      runsRemaining: 0,
    };
  }

  // Check concurrent run limit
  const activeCount = lane === 'cpu' ? (quota.active_cpu_runs || 0) : (quota.active_gpu_runs || 0);
  if (activeCount >= limits.maxConcurrent) {
    return {
      allowed: false,
      reason: `${lane.toUpperCase()} concurrent limit reached: ${limits.maxConcurrent} max concurrent runs`,
      concurrentRemaining: 0,
    };
  }

  return {
    allowed: true,
    runsRemaining: limits.runsPerHour - count - 1,
    concurrentRemaining: limits.maxConcurrent - activeCount - 1,
  };
}

export async function trackRunStart(userId: string, runId: string, lane: 'cpu' | 'gpu'): Promise<void> {
  const usage = getQuotaUsageMemory(userId);
  if (lane === 'cpu') {
    usage.cpuRunsThisHour++;
    usage.activeCpuRuns.add(runId);
  } else {
    usage.gpuRunsThisHour++;
    usage.activeGpuRuns.add(runId);
  }
  quotaStore.set(userId, usage);

  // Synchronously update DB (not fire-and-forget) so quota is consistent
  if (isSupabaseConfigured()) {
    try {
      await trackRunStartDB(userId, lane);
    } catch (err) {
      logger.warn('Failed to track run start in DB', { userId, lane, error: String(err) });
    }
  }
}

async function trackRunStartDB(userId: string, lane: 'cpu' | 'gpu') {
  const supabase = getServiceSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  await supabase.rpc('increment_quota_run', {
    p_user_id: userId,
    p_period: 'hourly',
    p_period_start: hourStart.toISOString(),
    p_field: lane === 'cpu' ? 'cpu_run_count' : 'gpu_run_count',
  });
}

export async function trackRunComplete(userId: string, runId: string, lane: 'cpu' | 'gpu'): Promise<void> {
  const usage = quotaStore.get(userId);
  if (!usage) return;

  if (lane === 'cpu') {
    usage.activeCpuRuns.delete(runId);
  } else {
    usage.activeGpuRuns.delete(runId);
  }
  quotaStore.set(userId, usage);

  // Synchronously update DB so active run slots are released promptly
  if (isSupabaseConfigured()) {
    try {
      await trackRunCompleteDB(userId, lane);
    } catch (err) {
      logger.warn('Failed to track run completion in DB', { userId, lane, error: String(err) });
    }
  }
}

async function trackRunCompleteDB(userId: string, lane: 'cpu' | 'gpu') {
  const supabase = getServiceSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  await supabase.rpc('decrement_active_runs', {
    p_user_id: userId,
    p_period: 'hourly',
    p_period_start: hourStart.toISOString(),
    p_field: lane === 'cpu' ? 'active_cpu_runs' : 'active_gpu_runs',
  });
}

/**
 * Quota enforcement middleware
 */
export async function quotaMiddleware(c: Context, next: Next) {
  const path = c.req.path;
  if (!path.includes('/runs') || c.req.method !== 'POST') {
    return next();
  }

  // Require authenticated user
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Please sign in to run apps' }, 401);
  }
  const userId = authContext.user.id;

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON in request body' }, 400);
  }
  const lane = body.lane || 'cpu';

  if (lane !== 'cpu' && lane !== 'gpu') {
    return c.json({ error: 'Invalid lane. Must be "cpu" or "gpu"' }, 400);
  }

  // Check quota (tier-based when billing is available, DB-backed otherwise)
  let result;
  const userLimits = await getQuotaLimitsForUser(userId);
  if (isSupabaseConfigured()) {
    try {
      result = await checkQuotaDB(userId, lane, userLimits);
    } catch {
      result = checkQuotaInMemory(userId, lane, userLimits);
    }
  } else {
    result = checkQuotaInMemory(userId, lane, userLimits);
  }

  if (!result.allowed) {
    return c.json({
      error: 'Usage limit reached',
      message: result.reason,
    }, 429);
  }

  // Store parsed lane + body in context so route handler doesn't re-parse
  c.set('quotaTracking', {
    userId,
    lane,
    trackStart: (runId: string) => trackRunStart(userId, runId, lane),   // now returns Promise
    trackComplete: (runId: string) => trackRunComplete(userId, runId, lane), // now returns Promise
  });
  c.set('parsedBody', body);

  c.header('X-Quota-CPU-Remaining', result.runsRemaining?.toString() || '0');
  c.header('X-Quota-CPU-Concurrent', result.concurrentRemaining?.toString() || '0');

  return next();
}

export function getQuotaStats() {
  const stats: Array<{
    userId: string;
    cpuRunsThisHour: number;
    gpuRunsThisHour: number;
    activeCpuRuns: number;
    activeGpuRuns: number;
    resetAt: string;
  }> = [];

  for (const [userId, usage] of quotaStore.entries()) {
    stats.push({
      userId,
      cpuRunsThisHour: usage.cpuRunsThisHour,
      gpuRunsThisHour: usage.gpuRunsThisHour,
      activeCpuRuns: usage.activeCpuRuns.size,
      activeGpuRuns: usage.activeGpuRuns.size,
      resetAt: new Date(usage.hourlyResetAt).toISOString()
    });
  }

  return { totalUsers: stats.length, users: stats };
}
