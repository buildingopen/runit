/**
 * Environment Variable Validation
 *
 * Validates required environment variables at boot.
 * Fails fast with clear error messages if critical vars are missing in production.
 */

interface EnvVar {
  name: string;
  required: 'always' | 'production';
  description: string;
}

const ENV_VARS: EnvVar[] = [
  { name: 'SUPABASE_URL', required: 'production', description: 'Supabase project URL' },
  { name: 'SUPABASE_ANON_KEY', required: 'production', description: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: 'production', description: 'Supabase service role key' },
  { name: 'MASTER_ENCRYPTION_KEY', required: 'production', description: 'Master encryption key (base64, 32 bytes)' },
  { name: 'MODAL_TOKEN_ID', required: 'production', description: 'Modal API token ID' },
  { name: 'MODAL_TOKEN_SECRET', required: 'production', description: 'Modal API token secret' },
];

/**
 * Validate all required environment variables.
 * In production, missing required vars cause a fatal exit.
 * In development, missing vars produce warnings.
 */
export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    const isEmpty = !value || value.trim() === '';

    if (isEmpty) {
      if (envVar.required === 'always' || (envVar.required === 'production' && isProduction)) {
        missing.push(`  - ${envVar.name}: ${envVar.description}`);
      } else {
        warnings.push(`  - ${envVar.name}: ${envVar.description}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n[ENV] Missing optional environment variables:\n${warnings.join('\n')}\n`);
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
