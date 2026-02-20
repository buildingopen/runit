// ABOUTME: CLI migration runner that reads .sql files from the migrations directory, applies them in order via Supabase RPC.
// ABOUTME: Tracks applied migrations in a _migrations table to prevent re-application. Run with: npx tsx src/db/migrate.ts
/**
 * Database Migration Runner
 *
 * Reads SQL migration files and applies them in order.
 * Tracks applied migrations in a `_migrations` table.
 *
 * Usage: npx tsx src/db/migrate.ts
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  const supabase = getServiceSupabaseClient();

  // Create migrations tracking table if it doesn't exist
  // Using raw RPC since Supabase JS doesn't support DDL directly
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `
    });
  } catch {
    // If exec_sql doesn't exist, the table may need manual creation
    console.warn('Note: exec_sql RPC not available. Migration table may need manual creation.');
  }
}

async function getAppliedMigrations(): Promise<string[]> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('_migrations')
    .select('name')
    .order('id', { ascending: true });

  if (error) {
    // Table may not exist yet
    return [];
  }

  return (data || []).map((row: { name: string }) => row.name);
}

async function recordMigration(name: string): Promise<void> {
  const supabase = getServiceSupabaseClient();
  await supabase.from('_migrations').insert({ name });
}

async function runMigrations(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured. Skipping migrations.');
    return;
  }

  console.log('Running database migrations...\n');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  // Get migration files sorted by name
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.includes(file)) {
      console.log(`  [skip] ${file} (already applied)`);
      continue;
    }

    console.log(`  [apply] ${file}...`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    try {
      const supabase = getServiceSupabaseClient();
      await supabase.rpc('exec_sql', { sql });
      await recordMigration(file);
      count++;
      console.log(`  [done] ${file}`);
    } catch (err) {
      console.error(`  [FAIL] ${file}:`, err);
      console.error('\nMigration failed. Please apply manually:');
      console.error(`  File: ${join(MIGRATIONS_DIR, file)}`);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log('\nNo new migrations to apply.');
  } else {
    console.log(`\nApplied ${count} migration(s).`);
  }
}

// Run if called directly
runMigrations().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
