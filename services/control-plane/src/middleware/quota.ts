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

interface QuotaUsage {
  cpuRunsThisHour: number;
  gpuRunsThisHour: number;
  activeCpuRuns: Set<string>;
  activeGpuRuns: Set<string>;
  hourlyResetAt: number;
}

// In-memory store (fallback)
const quotaStore = new Map<string, QuotaUsage>();

const QUOTA_LIMITS = {
  cpu: {
    runsPerHour: 100,
    maxConcurrent: 2
  },
  gpu: {
    runsPerHour: 10,
    maxConcurrent: 1
  }
};

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
  const usage = getQuotaUsageMemory(userId);
  const limits = QUOTA_LIMITS[lane];

  const runsThisHour = lane === 'cpu' ? usage.cpuRunsThisHour : usage.gpuRunsThisHour;
  if (runsThisHour >= limits.runsPerHour) {
    return {
      allowed: false,
      reason: `${lane.toUpperCase()} quota exceeded: ${limits.runsPerHour} runs per hour`,
      runsRemaining: 0
    };
  }

  const activeRuns = lane === 'cpu' ? usage.activeCpuRuns : usage.activeGpuRuns;
  if (activeRuns.size >= limits.maxConcurrent) {
    return {
      allowed: false,
      reason: `${lane.toUpperCase()} concurrent limit reached: ${limits.maxConcurrent} max concurrent runs`,
      concurrentRemaining: 0
    };
  }

  return {
    allowed: true,
    runsRemaining: limits.runsPerHour - runsThisHour - 1,
    concurrentRemaining: limits.maxConcurrent - activeRuns.size - 1
  };
}

async function checkQuotaDB(userId: string, lane: 'cpu' | 'gpu'): Promise<{
  allowed: boolean;
  reason?: string;
  runsRemaining?: number;
  concurrentRemaining?: number;
}> {
  const quota = await getOrCreateDBQuota(userId, lane);
  if (!quota) return { allowed: true, runsRemaining: QUOTA_LIMITS[lane].runsPerHour };

  const limits = QUOTA_LIMITS[lane];
  const count = lane === 'cpu' ? quota.cpu_run_count : quota.gpu_run_count;

  if (count >= limits.runsPerHour) {
    return {
      allowed: false,
      reason: `${lane.toUpperCase()} quota exceeded: ${limits.runsPerHour} runs per hour`,
      runsRemaining: 0,
    };
  }

  return {
    allowed: true,
    runsRemaining: limits.runsPerHour - count - 1,
  };
}

export function trackRunStart(userId: string, runId: string, lane: 'cpu' | 'gpu'): void {
  const usage = getQuotaUsageMemory(userId);
  if (lane === 'cpu') {
    usage.cpuRunsThisHour++;
    usage.activeCpuRuns.add(runId);
  } else {
    usage.gpuRunsThisHour++;
    usage.activeGpuRuns.add(runId);
  }
  quotaStore.set(userId, usage);

  // Also update DB if available
  if (isSupabaseConfigured()) {
    trackRunStartDB(userId, lane).catch((err) => {
      logger.warn('Failed to track run start in DB', { userId, lane, error: String(err) });
    });
  }
}

async function trackRunStartDB(userId: string, lane: 'cpu' | 'gpu') {
  const quota = await getOrCreateDBQuota(userId, lane);
  if (!quota) return;

  const supabase = getServiceSupabaseClient();
  const updates: Record<string, number> = {};
  if (lane === 'cpu') {
    updates.cpu_run_count = (quota.cpu_run_count || 0) + 1;
    updates.active_cpu_runs = (quota.active_cpu_runs || 0) + 1;
  } else {
    updates.gpu_run_count = (quota.gpu_run_count || 0) + 1;
    updates.active_gpu_runs = (quota.active_gpu_runs || 0) + 1;
  }
  await supabase.from('usage_quotas').update(updates).eq('id', quota.id);
}

export function trackRunComplete(userId: string, runId: string, lane: 'cpu' | 'gpu'): void {
  const usage = quotaStore.get(userId);
  if (!usage) return;

  if (lane === 'cpu') {
    usage.activeCpuRuns.delete(runId);
  } else {
    usage.activeGpuRuns.delete(runId);
  }
  quotaStore.set(userId, usage);

  if (isSupabaseConfigured()) {
    trackRunCompleteDB(userId, lane).catch((err) => {
      logger.warn('Failed to track run completion in DB', { userId, lane, error: String(err) });
    });
  }
}

async function trackRunCompleteDB(userId: string, lane: 'cpu' | 'gpu') {
  const quota = await getOrCreateDBQuota(userId, lane);
  if (!quota) return;

  const supabase = getServiceSupabaseClient();
  const field = lane === 'cpu' ? 'active_cpu_runs' : 'active_gpu_runs';
  const current = quota[field] || 0;
  await supabase.from('usage_quotas').update({ [field]: Math.max(0, current - 1) }).eq('id', quota.id);
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
    return c.json({ error: 'Authentication required for run execution' }, 401);
  }
  const userId = authContext.user.id;

  const body = await c.req.json().catch(() => ({}));
  const lane = body.lane || 'cpu';

  if (lane !== 'cpu' && lane !== 'gpu') {
    return c.json({ error: 'Invalid lane. Must be "cpu" or "gpu"' }, 400);
  }

  // Check quota (DB-backed if available)
  let result;
  if (isSupabaseConfigured()) {
    try {
      result = await checkQuotaDB(userId, lane);
    } catch {
      result = checkQuota(userId, lane);
    }
  } else {
    result = checkQuota(userId, lane);
  }

  if (!result.allowed) {
    return c.json({
      error: 'Quota exceeded',
      message: result.reason,
    }, 429);
  }

  c.set('quotaTracking', {
    userId,
    lane,
    trackStart: (runId: string) => trackRunStart(userId, runId, lane),
    trackComplete: (runId: string) => trackRunComplete(userId, runId, lane)
  });

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
