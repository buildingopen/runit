// ABOUTME: Feature flags derived from RUNIT_MODE env var (oss|cloud).
// ABOUTME: Controls auth mode, billing, quotas, rate limiting, and IP filtering per deployment mode.

export type RunitMode = 'oss' | 'cloud';

export interface FeatureFlags {
  mode: RunitMode;
  isOSS: boolean;
  isCloud: boolean;
  authMode: 'api-key' | 'supabase';
  billing: boolean;
  quotas: boolean;
  rateLimiting: boolean;
  ipFiltering: boolean;
}

function resolveFeatures(): FeatureFlags {
  const mode = (process.env.RUNIT_MODE || 'oss') as RunitMode;
  const isOSS = mode === 'oss';
  const isCloud = mode === 'cloud';

  // AUTH_MODE can override the default per mode
  const authMode = (process.env.AUTH_MODE || (isOSS ? 'api-key' : 'supabase')) as 'api-key' | 'supabase';

  return {
    mode,
    isOSS,
    isCloud,
    authMode,
    billing: isCloud,
    quotas: isCloud,
    rateLimiting: isCloud,
    ipFiltering: isCloud,
  };
}

export const features: FeatureFlags = resolveFeatures();
