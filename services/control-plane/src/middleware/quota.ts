/**
 * ABOUTME: Quota enforcement middleware for run execution
 * ABOUTME: Tracks hourly and concurrent usage per user
 */

import type { Context, Next } from 'hono';

interface QuotaUsage {
  cpuRunsThisHour: number;
  gpuRunsThisHour: number;
  activeCpuRuns: Set<string>;
  activeGpuRuns: Set<string>;
  hourlyResetAt: number;
}

// In-memory store for v0
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

/**
 * Get or create quota usage for a user
 */
function getQuotaUsage(userId: string): QuotaUsage {
  const now = Date.now();
  const existing = quotaStore.get(userId);

  // Reset if hour has passed
  if (existing && now >= existing.hourlyResetAt) {
    quotaStore.delete(userId);
  }

  if (!quotaStore.has(userId)) {
    const usage: QuotaUsage = {
      cpuRunsThisHour: 0,
      gpuRunsThisHour: 0,
      activeCpuRuns: new Set(),
      activeGpuRuns: new Set(),
      hourlyResetAt: now + 3600_000 // 1 hour
    };
    quotaStore.set(userId, usage);
    return usage;
  }

  return quotaStore.get(userId)!;
}

/**
 * Reset quota for testing
 */
export function resetQuota(userId: string): void {
  quotaStore.delete(userId);
}

/**
 * Check if user can start a new run
 */
export function checkQuota(userId: string, lane: 'cpu' | 'gpu'): {
  allowed: boolean;
  reason?: string;
  runsRemaining?: number;
  concurrentRemaining?: number;
} {
  const usage = getQuotaUsage(userId);
  const limits = QUOTA_LIMITS[lane];

  // Check hourly quota
  const runsThisHour = lane === 'cpu' ? usage.cpuRunsThisHour : usage.gpuRunsThisHour;
  if (runsThisHour >= limits.runsPerHour) {
    return {
      allowed: false,
      reason: `${lane.toUpperCase()} quota exceeded: ${limits.runsPerHour} runs per hour`,
      runsRemaining: 0
    };
  }

  // Check concurrent quota
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

/**
 * Track the start of a run
 */
export function trackRunStart(userId: string, runId: string, lane: 'cpu' | 'gpu'): void {
  const usage = getQuotaUsage(userId);

  if (lane === 'cpu') {
    usage.cpuRunsThisHour++;
    usage.activeCpuRuns.add(runId);
  } else {
    usage.gpuRunsThisHour++;
    usage.activeGpuRuns.add(runId);
  }

  quotaStore.set(userId, usage);
}

/**
 * Track the completion of a run
 */
export function trackRunComplete(userId: string, runId: string, lane: 'cpu' | 'gpu'): void {
  const usage = quotaStore.get(userId);
  if (!usage) return;

  if (lane === 'cpu') {
    usage.activeCpuRuns.delete(runId);
  } else {
    usage.activeGpuRuns.delete(runId);
  }

  quotaStore.set(userId, usage);
}

/**
 * Quota enforcement middleware
 */
export async function quotaMiddleware(c: Context, next: Next) {
  // Only apply to run endpoints
  const path = c.req.path;
  if (!path.includes('/runs') || c.req.method !== 'POST') {
    return next();
  }

  // Get user ID (placeholder - implement based on auth system)
  const userId = c.req.header('x-user-id') || 'anonymous';

  // Get lane from request body
  const body = await c.req.json().catch(() => ({}));
  const lane = body.lane || 'cpu';

  if (lane !== 'cpu' && lane !== 'gpu') {
    return c.json({ error: 'Invalid lane. Must be "cpu" or "gpu"' }, 400);
  }

  // Check quota
  const result = checkQuota(userId, lane);

  if (!result.allowed) {
    const usage = getQuotaUsage(userId);
    return c.json({
      error: 'Quota exceeded',
      message: result.reason,
      quota: {
        cpu: {
          runsThisHour: usage.cpuRunsThisHour,
          runsPerHour: QUOTA_LIMITS.cpu.runsPerHour,
          activeConcurrent: usage.activeCpuRuns.size,
          maxConcurrent: QUOTA_LIMITS.cpu.maxConcurrent
        },
        gpu: {
          runsThisHour: usage.gpuRunsThisHour,
          runsPerHour: QUOTA_LIMITS.gpu.runsPerHour,
          activeConcurrent: usage.activeGpuRuns.size,
          maxConcurrent: QUOTA_LIMITS.gpu.maxConcurrent
        },
        resetAt: new Date(usage.hourlyResetAt).toISOString()
      }
    }, 429);
  }

  // Add tracking helpers to context - runs.ts will call trackStart with actual runId
  c.set('quotaTracking', {
    userId,
    lane,
    trackStart: (runId: string) => trackRunStart(userId, runId, lane),
    trackComplete: (runId: string) => trackRunComplete(userId, runId, lane)
  });

  // Set quota headers
  c.header('X-Quota-CPU-Remaining', result.runsRemaining?.toString() || '0');
  c.header('X-Quota-CPU-Concurrent', result.concurrentRemaining?.toString() || '0');

  return next();
}

/**
 * Admin endpoint to view quota stats
 */
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

  return {
    totalUsers: stats.length,
    users: stats
  };
}
