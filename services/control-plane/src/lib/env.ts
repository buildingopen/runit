// ABOUTME: Validates required environment variables at startup with custom validators (encryption key, CORS origins).
// ABOUTME: Fatal-exits in production for missing/invalid vars; warns and continues in development.
/**
 * Environment Variable Validation
 *
 * Validates required environment variables at boot.
 * Fails fast with clear error messages if critical vars are missing in production.
 */

interface EnvVar {
  name: string;
  required: 'always' | 'production' | 'optional';
  description: string;
  validate?: (value: string) => { valid: boolean; error?: string };
}

/**
 * Validate MASTER_ENCRYPTION_KEY is exactly 32 bytes (base64 encoded)
 */
function validateEncryptionKey(value: string): { valid: boolean; error?: string } {
  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 32) {
      return {
        valid: false,
        error: `MASTER_ENCRYPTION_KEY must be exactly 32 bytes (got ${decoded.length} bytes). Generate with: openssl rand -base64 32`
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'MASTER_ENCRYPTION_KEY must be valid base64. Generate with: openssl rand -base64 32'
    };
  }
}

/**
 * Validate CORS_ORIGINS is a valid comma-separated list of URLs
 */
function validateCorsOrigins(value: string): { valid: boolean; error?: string } {
  const origins = value.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    return { valid: false, error: 'CORS_ORIGINS must contain at least one origin' };
  }

  for (const origin of origins) {
    try {
      new URL(origin);
    } catch {
      return { valid: false, error: `Invalid origin in CORS_ORIGINS: ${origin}` };
    }
  }
  return { valid: true };
}

/**
 * Determine requirement level based on RUNIT_MODE.
 * In OSS mode, Supabase/Stripe/cloud-only vars are optional.
 * In cloud mode (production), they remain required.
 */
function cloudOnly(): 'production' | 'optional' {
  return (process.env.RUNIT_MODE || 'oss') === 'oss' ? 'optional' : 'production';
}

const ENV_VARS: EnvVar[] = [
  { name: 'RUNIT_MODE', required: 'optional', description: 'Deployment mode: oss (default) or cloud' },
  { name: 'API_KEY', required: 'optional', description: 'API key for OSS mode authentication (omit for single-user auto-auth)' },
  { name: 'SUPABASE_URL', required: cloudOnly(), description: 'Supabase project URL (cloud mode only)' },
  { name: 'SUPABASE_ANON_KEY', required: cloudOnly(), description: 'Supabase anonymous key (cloud mode only)' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: cloudOnly(), description: 'Supabase service role key (cloud mode only)' },
  {
    name: 'MASTER_ENCRYPTION_KEY',
    required: 'always',
    description: 'Master encryption key (base64, 32 bytes)',
    validate: validateEncryptionKey
  },
  {
    name: 'SENTRY_DSN',
    required: 'optional',
    description: 'Sentry DSN for error tracking (optional)'
  },
  {
    name: 'CORS_ORIGINS',
    required: cloudOnly(),
    description: 'Comma-separated list of allowed CORS origins',
    validate: validateCorsOrigins
  },
  { name: 'MODAL_TOKEN_ID', required: 'optional', description: 'Modal API token ID (required for deployments)' },
  { name: 'MODAL_TOKEN_SECRET', required: 'optional', description: 'Modal API token secret (required for deployments)' },
  { name: 'STREAM_TOKEN_SECRET', required: cloudOnly(), description: 'Signing key for SSE stream tokens (cloud mode only)' },
  { name: 'METRICS_TOKEN', required: cloudOnly(), description: 'Bearer token for /metrics endpoint (cloud mode only)' },
  { name: 'REDIS_URL', required: 'optional', description: 'Redis URL for distributed rate limiting (optional)' },
  { name: 'FRONTEND_URL', required: 'optional', description: 'Frontend URL for Stripe checkout redirects (e.g. https://your-app.com)' },
  { name: 'STRIPE_SECRET_KEY', required: 'optional', description: 'Stripe API secret key (required for billing)' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: 'optional', description: 'Stripe webhook signing secret' },
  { name: 'STRIPE_PRO_PRICE_ID', required: 'optional', description: 'Stripe price ID for Pro tier' },
  { name: 'STRIPE_TEAM_PRICE_ID', required: 'optional', description: 'Stripe price ID for Team tier' },
];

/**
 * Validate all required environment variables.
 * In production, missing required vars cause a fatal exit.
 * In development, missing vars produce warnings.
 */
export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    const isEmpty = !value || value.trim() === '';

    if (isEmpty) {
      if (envVar.required === 'optional') {
        warnings.push(`  - ${envVar.name}: ${envVar.description}`);
      } else if (envVar.required === 'always' || (envVar.required === 'production' && isProduction)) {
        missing.push(`  - ${envVar.name}: ${envVar.description}`);
      } else {
        warnings.push(`  - ${envVar.name}: ${envVar.description}`);
      }
    } else if (envVar.validate) {
      // Run validation if value exists
      const result = envVar.validate(value);
      if (!result.valid) {
        if (envVar.required === 'always' || (envVar.required === 'production' && isProduction)) {
          invalid.push(`  - ${envVar.name}: ${result.error}`);
        } else {
          warnings.push(`  - ${envVar.name}: ${result.error}`);
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n[ENV] Missing or invalid optional environment variables:\n${warnings.join('\n')}\n`);
  }

  if (invalid.length > 0) {
    console.error(`\n[FATAL] Invalid environment variables:\n${invalid.join('\n')}\n`);
    if (isProduction) {
      process.exit(1);
    } else {
      console.warn('[ENV] Running in development mode - continuing with invalid vars.\n');
    }
  }

  if (missing.length > 0) {
    console.error(`\n[FATAL] Missing required environment variables:\n${missing.join('\n')}\n`);
    if (isProduction) {
      process.exit(1);
    } else {
      console.warn('[ENV] Running in development mode - continuing with missing vars.\n');
    }
  }
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get environment variable with type safety
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue!;
}
