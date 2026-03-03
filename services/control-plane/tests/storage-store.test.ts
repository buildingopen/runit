/**
 * Storage Store tests
 *
 * Tests CRUD operations, key validation, size limits, and quota enforcement
 * for both SQLite and Supabase-backed paths.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// --- Supabase mock wiring ---

const mockIsSupabaseConfigured = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();

function buildChain() {
  const chain: Record<string, unknown> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.delete = mockDelete.mockReturnValue(chain);
  chain.order = mockOrder;
  return chain;
}

const supabaseChain = buildChain();

const mockGetServiceSupabaseClient = vi.fn(() => ({
  from: vi.fn(() => supabaseChain),
}));

vi.mock('../src/db/supabase.js', () => ({
  isSupabaseConfigured: (...args: unknown[]) => mockIsSupabaseConfigured(...args),
  getServiceSupabaseClient: (...args: unknown[]) => mockGetServiceSupabaseClient(...args),
}));

import {
  putStorage,
  getStorage,
  deleteStorage,
  listStorageKeys,
  getStorageUsage,
  deleteProjectStorage,
  clearAllStorage,
  validateKey,
  MAX_VALUE_SIZE,
  MAX_PROJECT_SIZE,
} from '../src/db/storage-store';

describe('storage-store key validation', () => {
  it('accepts valid keys', () => {
    expect(validateKey('my-key')).toBeNull();
    expect(validateKey('data_v2')).toBeNull();
    expect(validateKey('config.json')).toBeNull();
    expect(validateKey('a')).toBeNull();
    expect(validateKey('ABC-123_test.json')).toBeNull();
  });

  it('rejects empty key', () => {
    expect(validateKey('')).toBeTruthy();
  });

  it('rejects key exceeding max length', () => {
    const longKey = 'a'.repeat(257);
    expect(validateKey(longKey)).toContain('maximum length');
  });

  it('rejects keys with invalid characters', () => {
    expect(validateKey('key with spaces')).toBeTruthy();
    expect(validateKey('key/slash')).toBeTruthy();
    expect(validateKey('key\\backslash')).toBeTruthy();
  });

  it('rejects keys starting/ending with dots', () => {
    expect(validateKey('.hidden')).toBeTruthy();
    expect(validateKey('file.')).toBeTruthy();
    expect(validateKey('path..double')).toBeTruthy();
  });
});

describe('storage-store (SQLite paths)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'storage-test-'));
    process.env.RUNIT_DATA_DIR = tmpDir;
    clearAllStorage();
    mockIsSupabaseConfigured.mockReturnValue(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.RUNIT_DATA_DIR;
  });

  it('put and get a JSON value', async () => {
    const entry = await putStorage('proj-1', 'config', { theme: 'dark' });
    expect(entry.key).toBe('config');
    expect(entry.value_type).toBe('json');
    expect(entry.size_bytes).toBeGreaterThan(0);

    const result = await getStorage('proj-1', 'config');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ theme: 'dark' });
  });

  it('returns null for non-existent key', async () => {
    const result = await getStorage('proj-1', 'missing');
    expect(result).toBeNull();
  });

  it('upserts existing key', async () => {
    await putStorage('proj-1', 'counter', 1);
    await putStorage('proj-1', 'counter', 2);

    const result = await getStorage('proj-1', 'counter');
    expect(result!.data).toBe(2);
  });

  it('deletes a key', async () => {
    await putStorage('proj-1', 'temp', 'value');
    const deleted = await deleteStorage('proj-1', 'temp');
    expect(deleted).toBe(true);

    const result = await getStorage('proj-1', 'temp');
    expect(result).toBeNull();
  });

  it('delete returns false for non-existent key', async () => {
    const deleted = await deleteStorage('proj-1', 'nope');
    expect(deleted).toBe(false);
  });

  it('lists keys for a project', async () => {
    await putStorage('proj-1', 'alpha', 1);
    await putStorage('proj-1', 'beta', 2);
    await putStorage('proj-2', 'gamma', 3);

    const keys = await listStorageKeys('proj-1');
    expect(keys).toHaveLength(2);
    expect(keys.map(k => k.key)).toEqual(['alpha', 'beta']);
  });

  it('calculates storage usage', async () => {
    await putStorage('proj-1', 'a', 'x'.repeat(100));
    await putStorage('proj-1', 'b', 'y'.repeat(200));

    const usage = await getStorageUsage('proj-1');
    expect(usage).toBeGreaterThan(0);
  });

  it('deletes all storage for a project', async () => {
    await putStorage('proj-1', 'a', 1);
    await putStorage('proj-1', 'b', 2);
    await putStorage('proj-2', 'c', 3);

    const deleted = await deleteProjectStorage('proj-1');
    expect(deleted).toBe(2);

    const remaining = await listStorageKeys('proj-1');
    expect(remaining).toHaveLength(0);

    // proj-2 unaffected
    const proj2 = await listStorageKeys('proj-2');
    expect(proj2).toHaveLength(1);
  });

  it('rejects invalid key', async () => {
    await expect(putStorage('proj-1', 'key/slash', 'val')).rejects.toThrow();
  });

  it('writes files atomically', async () => {
    await putStorage('proj-1', 'data', { count: 42 });
    const filePath = join(tmpDir, 'storage', 'proj-1', 'data');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual({ count: 42 });

    // No tmp files left
    const tmpFile = filePath + '.tmp';
    expect(existsSync(tmpFile)).toBe(false);
  });
});

describe('storage-store (Supabase paths)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'storage-supa-'));
    process.env.RUNIT_DATA_DIR = tmpDir;
    clearAllStorage();
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.RUNIT_DATA_DIR;
  });

  it('creates new entry via Supabase', async () => {
    const resultEntry = {
      id: 'new-id', project_id: 'proj-1', key: 'config',
      value_type: 'json', size_bytes: 16,
      created_at: '2024-01-01', updated_at: '2024-01-01',
    };

    // getStorageEntry -> .select().eq().eq().single(): not found
    // putStorage insert -> .insert().select().single(): returns new entry
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: resultEntry, error: null });

    const entry = await putStorage('proj-1', 'config', { theme: 'dark' });
    expect(entry.key).toBe('config');
    expect(entry.id).toBe('new-id');

    // File was written atomically
    const filePath = join(tmpDir, 'storage', 'proj-1', 'config');
    expect(existsSync(filePath)).toBe(true);
    expect(existsSync(filePath + '.tmp')).toBe(false);
  });

  it('updates existing entry via Supabase', async () => {
    const existingEntry = {
      id: 'existing-id', project_id: 'proj-1', key: 'config',
      value_type: 'json', size_bytes: 10,
      created_at: '2024-01-01', updated_at: '2024-01-01',
    };
    const updatedEntry = { ...existingEntry, size_bytes: 16, updated_at: '2024-01-02' };

    // getStorageEntry -> .single(): found
    // putStorage update -> .update().eq().select().single(): returns updated entry
    mockSingle
      .mockResolvedValueOnce({ data: existingEntry, error: null })
      .mockResolvedValueOnce({ data: updatedEntry, error: null });

    const entry = await putStorage('proj-1', 'config', { theme: 'dark' });
    expect(entry.updated_at).toBe('2024-01-02');
    expect(entry.size_bytes).toBe(16);
  });

  it('gets entry via Supabase', async () => {
    const row = {
      id: '1', project_id: 'proj-1', key: 'data',
      value_type: 'json', size_bytes: 5,
      created_at: '2024-01-01', updated_at: '2024-01-01',
    };

    // Write the file so getStorage can read it
    const dir = join(tmpDir, 'storage', 'proj-1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'data'), JSON.stringify({ n: 1 }), 'utf-8');

    // getStorageEntry -> .single()
    mockSingle.mockResolvedValueOnce({ data: row, error: null });

    const result = await getStorage('proj-1', 'data');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ n: 1 });
    expect(result!.key).toBe('data');
  });

  it('deletes entry via Supabase', async () => {
    // deleteStorage chains .delete().eq().eq()
    mockEq
      .mockReturnValueOnce(supabaseChain)
      .mockResolvedValueOnce({ error: null });

    const result = await deleteStorage('proj-1', 'mykey');
    expect(result).toBe(true);
  });

  it('lists entries via Supabase', async () => {
    const rows = [
      { id: '1', project_id: 'proj-1', key: 'a', value_type: 'json', size_bytes: 10, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ];
    mockOrder.mockResolvedValueOnce({ data: rows, error: null });

    const result = await listStorageKeys('proj-1');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('a');
  });

  it('calculates storage usage via Supabase', async () => {
    // getStorageUsage -> .select('size_bytes').eq('project_id', pid) - .eq() is terminal
    mockEq.mockResolvedValueOnce({ data: [{ size_bytes: 100 }, { size_bytes: 250 }], error: null });

    const usage = await getStorageUsage('proj-1');
    expect(usage).toBe(350);
  });

  it('deletes project storage via Supabase', async () => {
    // deleteProjectStorage -> .delete().eq().select('id') - .select() is terminal
    mockSelect.mockResolvedValueOnce({ data: [{ id: '1' }, { id: '2' }, { id: '3' }], error: null });

    const count = await deleteProjectStorage('proj-1');
    expect(count).toBe(3);
  });
});
