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

async function runBootMigrations(): Promise<void> {
  if (!isSupabaseConfigured()) {
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
      const { error: rpcError } = await supabase.rpc('exec_sql', { sql });
      if (rpcError) throw rpcError;
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
