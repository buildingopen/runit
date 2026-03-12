// ABOUTME: SQLite persistence layer for OSS mode. Single-file database at /data/runit.db.
// ABOUTME: Creates tables on startup matching the Supabase schema. Used when Supabase is not configured.

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger.js';

let db: Database.Database | null = null;
let currentDBPath: string | null = null;

function getDefaultDataDir(): string {
  if (process.env.NODE_ENV === 'test') {
    return join(process.cwd(), '.runit-test-data');
  }
  return '/data';
}

function getDBDir(): string {
  return process.env.RUNIT_DATA_DIR || getDefaultDataDir();
}

function getDBPath(): string {
  return join(getDBDir(), 'runit.db');
}

export function getSQLiteDB(): Database.Database {
  const dbDir = getDBDir();
  const dbPath = getDBPath();

  if (db && currentDBPath === dbPath) return db;
  if (db && currentDBPath !== dbPath) {
    db.close();
    db = null;
  }

  // Ensure directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  currentDBPath = dbPath;

  // WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  // FK constraints handled at application layer (matching in-memory store behavior)
  db.pragma('foreign_keys = OFF');

  runMigrations(db);

  logger.info(`[SQLite] Database initialized at ${dbPath}`);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      deployed_at TEXT,
      deploy_error TEXT,
      runtime_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL /* ref: projects(id) */,
      version_hash TEXT NOT NULL,
      code_bundle_ref TEXT NOT NULL,
      openapi TEXT,
      endpoints TEXT,
      deps_hash TEXT,
      base_image_version TEXT,
      entrypoint TEXT,
      installed_packages TEXT,
      detected_env_vars TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, version_hash)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL /* ref: projects(id) */,
      version_id TEXT NOT NULL,
      endpoint_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      request_params TEXT,
      request_body TEXT,
      request_headers TEXT,
      request_files TEXT,
      response_status INTEGER,
      response_body TEXT,
      response_content_type TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      duration_ms INTEGER,
      resource_lane TEXT DEFAULT 'cpu',
      base_image_version TEXT,
      error_class TEXT,
      error_message TEXT,
      suggested_fix TEXT,
      logs TEXT,
      artifacts TEXT,
      warnings TEXT,
      redactions_applied INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL /* ref: projects(id) */,
      key TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, key)
    );

    CREATE TABLE IF NOT EXISTS contexts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL /* ref: projects(id) */,
      name TEXT,
      url TEXT NOT NULL,
      data TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL /* ref: projects(id) */,
      target_type TEXT NOT NULL,
      target_ref TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      run_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_runs_owner_id ON runs(owner_id);
    CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_share_links_project_id ON share_links(project_id);
    CREATE INDEX IF NOT EXISTS idx_secrets_project_id ON secrets(project_id);
    CREATE INDEX IF NOT EXISTS idx_contexts_project_id ON contexts(project_id);
    CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

    CREATE TABLE IF NOT EXISTS storage_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL /* ref: projects(id) */,
      key TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'json',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_storage_entries_project_id ON storage_entries(project_id);
  `);

  // Phase 3 migration: add dev/prod version tracking
  const cols = db.pragma('table_info(projects)') as Array<{ name: string }>;
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('dev_version_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN dev_version_id TEXT`);
  }
  if (!colNames.includes('prod_version_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN prod_version_id TEXT`);
  }
}

/**
 * Safely parse JSON from SQLite text columns, returning null on failure.
 */
export function parseJSON<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Stringify value for SQLite JSON storage.
 */
export function toJSON(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeSQLiteDB(): void {
  if (db) {
    db.close();
    db = null;
    currentDBPath = null;
  }
}
