/**
 * Quota enforcement middleware
 *
 * Enforces usage quotas:
 * - 100 CPU runs/hour per user
 * - 10 GPU runs/hour per user
 * - 2 concurrent CPU runs
 * - 1 concurrent GPU run
 *
 * Tracks active runs and prevents quota violations
 */

interface QuotaEntry {
  cpuRunsThisHour: number;
  gpuRunsThisHour: number;
  activeCpuRuns: Set<string>;
  activeGpuRuns: Set<string>;
  hourResetAt: number;
}

interface QuotaLimits {
  cpu: {
    runsPerHour: number;
    maxConcurrent: number;
  };
  gpu: {
    runsPerHour: number;
    maxConcurrent: number;
  };
}

const quotaLimits: QuotaLimits = {
  cpu: {
    runsPerHour: 100,
    maxConcurrent: 2,
  },
  gpu: {
    runsPerHour: 10,
    maxConcurrent: 1,
  },
};

// In-memory store (replace with Redis for production)
const quotaStore = new Map<string, QuotaEntry>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredQuotas() {
  const now = Date.now();
  for (const [userId, entry] of quotaStore.entries()) {
    if (entry.hourResetAt < now) {
      // Reset hourly counters
      entry.cpuRunsThisHour = 0;
      entry.gpuRunsThisHour = 0;
      entry.hourResetAt = now + 3600000; // Next hour
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredQuotas, 60000);

/**
 * Get or create quota entry for user
 */
function getQuotaEntry(userId: string): QuotaEntry {
  let entry = quotaStore.get(userId);

  if (!entry) {
    const now = Date.now();
    entry = {
      cpuRunsThisHour: 0,
      gpuRunsThisHour: 0,
      activeCpuRuns: new Set(),
      activeGpuRuns: new Set(),
      hourResetAt: now + 3600000,
    };
    quotaStore.set(userId, entry);
  }

  return entry;
}

/**
 * Check if user can start a new run
 */
export function checkQuota(
  userId: string,
  lane: 'cpu' | 'gpu'
): { allowed: boolean; reason?: string; resetAt?: number } {
  const entry = getQuotaEntry(userId);
  const now = Date.now();

  // Reset if hour has passed
  if (entry.hourResetAt < now) {
    entry.cpuRunsThisHour = 0;
    entry.gpuRunsThisHour = 0;
    entry.hourResetAt = now + 3600000;
  }

  if (lane === 'cpu') {
    // Check hourly quota
    if (entry.cpuRunsThisHour >= quotaLimits.cpu.runsPerHour) {
      return {
        allowed: false,
        reason: `CPU quota exceeded: ${quotaLimits.cpu.runsPerHour} runs per hour`,
        resetAt: entry.hourResetAt,
      };
    }

    // Check concurrent quota
    if (entry.activeCpuRuns.size >= quotaLimits.cpu.maxConcurrent) {
      return {
        allowed: false,
        reason: `CPU concurrency limit: ${quotaLimits.cpu.maxConcurrent} concurrent runs`,
      };
    }
  } else {
    // GPU lane
    // Check hourly quota
    if (entry.gpuRunsThisHour >= quotaLimits.gpu.runsPerHour) {
      return {
        allowed: false,
        reason: `GPU quota exceeded: ${quotaLimits.gpu.runsPerHour} runs per hour`,
        resetAt: entry.hourResetAt,
      };
    }

    // Check concurrent quota
    if (entry.activeGpuRuns.size >= quotaLimits.gpu.maxConcurrent) {
      return {
        allowed: false,
        reason: `GPU concurrency limit: ${quotaLimits.gpu.maxConcurrent} concurrent runs`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Track run start
 */
export function trackRunStart(userId: string, runId: string, lane: 'cpu' | 'gpu') {
  const entry = getQuotaEntry(userId);

  if (lane === 'cpu') {
    entry.cpuRunsThisHour++;
    entry.activeCpuRuns.add(runId);
  } else {
    entry.gpuRunsThisHour++;
    entry.activeGpuRuns.add(runId);
  }
}

/**
 * Track run completion
 */
export function trackRunComplete(userId: string, runId: string, lane: 'cpu' | 'gpu') {
  const entry = quotaStore.get(userId);
  if (!entry) return;

  if (lane === 'cpu') {
    entry.activeCpuRuns.delete(runId);
  } else {
    entry.activeGpuRuns.delete(runId);
  }
}

/**
 * Express middleware for quota enforcement
 */
export function quotaMiddleware(req: any, res: any, next: any) {
  const userId = req.user?.id;

  if (!userId) {
    // Anonymous users not allowed (should be caught by auth middleware first)
    res.status(401).json({
      error: 'Authentication required',
      message: 'You must be authenticated to create runs',
    });
    return;
  }

  const lane: 'cpu' | 'gpu' = req.body?.lane || 'cpu';
  const { allowed, reason, resetAt } = checkQuota(userId, lane);

  if (!allowed) {
    const response: any = {
      error: 'Quota exceeded',
      message: reason,
      lane,
      limits: {
        cpu: quotaLimits.cpu,
        gpu: quotaLimits.gpu,
      },
    };

    if (resetAt) {
      response.resetAt = resetAt;
      response.retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    }

    res.status(429).json(response);
    return;
  }

  // Attach quota tracking to request
  req.quotaTracking = {
    userId,
    lane,
    trackStart: (runId: string) => trackRunStart(userId, runId, lane),
    trackComplete: (runId: string) => trackRunComplete(userId, runId, lane),
  };

  next();
}

/**
 * Get quota usage for user (for display)
 */
export function getQuotaUsage(userId: string) {
  const entry = quotaStore.get(userId);
  const now = Date.now();

  if (!entry || entry.hourResetAt < now) {
    return {
      cpu: {
        runsThisHour: 0,
        activeConcurrent: 0,
        limits: quotaLimits.cpu,
      },
      gpu: {
        runsThisHour: 0,
        activeConcurrent: 0,
        limits: quotaLimits.gpu,
      },
      resetAt: now + 3600000,
    };
  }

  return {
    cpu: {
      runsThisHour: entry.cpuRunsThisHour,
      activeConcurrent: entry.activeCpuRuns.size,
      limits: quotaLimits.cpu,
    },
    gpu: {
      runsThisHour: entry.gpuRunsThisHour,
      activeConcurrent: entry.activeGpuRuns.size,
      limits: quotaLimits.gpu,
    },
    resetAt: entry.hourResetAt,
  };
}

/**
 * Reset quota for user (admin only)
 */
export function resetQuota(userId: string) {
  quotaStore.delete(userId);
}

/**
 * Get all quota stats (admin/monitoring)
 */
export function getQuotaStats() {
  const stats = {
    totalUsers: quotaStore.size,
    users: Array.from(quotaStore.entries()).map(([userId, entry]) => ({
      userId,
      cpu: {
        runsThisHour: entry.cpuRunsThisHour,
        activeConcurrent: entry.activeCpuRuns.size,
      },
      gpu: {
        runsThisHour: entry.gpuRunsThisHour,
        activeConcurrent: entry.activeGpuRuns.size,
      },
      resetAt: new Date(entry.hourResetAt).toISOString(),
    })),
  };
  return stats;
}

export default {
  quotaMiddleware,
  checkQuota,
  trackRunStart,
  trackRunComplete,
  getQuotaUsage,
  resetQuota,
  getQuotaStats,
};
