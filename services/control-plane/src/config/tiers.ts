// ABOUTME: Tier-based limits for Free/Pro/Team billing plans.
// ABOUTME: Used by quota middleware and billing routes to enforce usage limits.

export type Tier = 'free' | 'pro' | 'team';

export interface TierLimits {
  cpuRunsPerHour: number;
  gpuRunsPerHour: number;
  maxConcurrentCpu: number;
  maxConcurrentGpu: number;
  maxProjects: number;
  maxSecretsPerProject: number;
  maxFileSizeMB: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    cpuRunsPerHour: 50,
    gpuRunsPerHour: 5,
    maxConcurrentCpu: 1,
    maxConcurrentGpu: 1,
    maxProjects: 3,
    maxSecretsPerProject: 5,
    maxFileSizeMB: 10,
  },
  pro: {
    cpuRunsPerHour: 500,
    gpuRunsPerHour: 50,
    maxConcurrentCpu: 5,
    maxConcurrentGpu: 2,
    maxProjects: 25,
    maxSecretsPerProject: 20,
    maxFileSizeMB: 50,
  },
  team: {
    cpuRunsPerHour: 2000,
    gpuRunsPerHour: 200,
    maxConcurrentCpu: 10,
    maxConcurrentGpu: 5,
    maxProjects: 100,
    maxSecretsPerProject: 50,
    maxFileSizeMB: 100,
  },
};

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}
