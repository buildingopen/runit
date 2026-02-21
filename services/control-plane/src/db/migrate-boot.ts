// ABOUTME: Non-fatal boot-time migration runner that applies pending SQL migrations on app startup.
// ABOUTME: Uses direct Postgres connection (pg) for DDL execution. Logs warnings on failure and continues.
/**
 * Boot-time Migration Runner (non-fatal)
 *
 * Runs pending migrations at app startup.
 * Failures are logged but do not prevent the app from starting.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Execute raw SQL using direct Postgres connection.
 * Supabase JS client doesn't support DDL, so we use pg directly.
 */
async function execSQL(sql: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set. Required for running migrations.');
  }

  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function runBootMigrations(): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  // Migrations require DATABASE_URL for DDL execution
  if (!process.env.DATABASE_URL) {
    console.warn('[migrations] DATABASE_URL not set, skipping boot migrations.');
    return;
  }

  const supabase = getServiceSupabaseClient();

  // Check which migrations are already applied
  const { data, error } = await supabase
    .from('_migrations')
    .select('name')
    .order('id', { ascending: true });

  if (error) {
    console.warn('[migrations] _migrations table not accessible, skipping:', error.message);
    return;
  }

  const applied = new Set((data || []).map((row: { name: string }) => row.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('[migrations] All migrations applied.');
    return;
  }

  for (const file of pending) {
    console.log(`[migrations] Applying ${file}...`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    try {
      await execSQL(sql);
      await supabase.from('_migrations').insert({ name: file });
      console.log(`[migrations] Applied ${file}`);
    } catch (err) {
      console.warn(`[migrations] Failed to apply ${file}:`, err);
      console.warn('[migrations] Continuing without this migration. Apply manually if needed.');
      break;
    }
  }
}

runBootMigrations().catch((err) => {
  console.warn('[migrations] Boot migration runner failed:', err);
});
