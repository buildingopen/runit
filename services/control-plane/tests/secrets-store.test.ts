/**
 * Secrets Store tests
 *
 * Covers Supabase-backed paths (lines 76-222, 236-258) that are uncovered
 * by existing secrets.test.ts (which only tests in-memory mode).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Supabase mock wiring ---

const mockIsSupabaseConfigured = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockUpsert = vi.fn();

function buildChain(terminal?: Record<string, unknown>) {
  const chain: Record<string, unknown> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.delete = mockDelete.mockReturnValue(chain);
  chain.order = mockOrder;
  chain.upsert = mockUpsert.mockReturnValue(chain);
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
  storeSecret,
  getProjectSecrets,
  getSecret,
  deleteSecret,
  secretExists,
  getProjectSecretCount,
  clearAllSecrets,
  deleteProjectSecrets,
} from '../src/db/secrets-store';

describe('secrets-store (in-memory paths)', () => {
  beforeEach(() => {
    clearAllSecrets();
    mockIsSupabaseConfigured.mockReturnValue(false);
    vi.clearAllMocks();
  });

  it('getSecret returns null for non-existent key', async () => {
    const result = await getSecret('proj-1', 'MISSING');
    expect(result).toBeNull();
  });

  it('secretExists returns true/false correctly', async () => {
    expect(await secretExists('proj-1', 'K')).toBe(false);
    await storeSecret('proj-1', 'K', 'enc-val');
    expect(await secretExists('proj-1', 'K')).toBe(true);
  });

  it('getProjectSecretCount counts correctly', async () => {
    expect(await getProjectSecretCount('proj-1')).toBe(0);
    await storeSecret('proj-1', 'A', 'v1');
    await storeSecret('proj-1', 'B', 'v2');
    await storeSecret('proj-2', 'C', 'v3');
    expect(await getProjectSecretCount('proj-1')).toBe(2);
    expect(await getProjectSecretCount('proj-2')).toBe(1);
  });

  it('deleteProjectSecrets removes all secrets for a project', async () => {
    await storeSecret('proj-1', 'A', 'v1');
    await storeSecret('proj-1', 'B', 'v2');
    await storeSecret('proj-2', 'C', 'v3');

    const deleted = await deleteProjectSecrets('proj-1');
    expect(deleted).toBe(2);

    expect(await getProjectSecretCount('proj-1')).toBe(0);
    expect(await getProjectSecretCount('proj-2')).toBe(1);
  });

  it('deleteProjectSecrets returns 0 when no secrets exist', async () => {
    const deleted = await deleteProjectSecrets('no-project');
    expect(deleted).toBe(0);
  });
});

describe('secrets-store (Supabase-backed paths)', () => {
  beforeEach(() => {
    clearAllSecrets();
    mockIsSupabaseConfigured.mockReturnValue(true);
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
  });

  describe('storeSecret', () => {
    it('updates existing secret when found in DB', async () => {
      const existingRow = {
        id: 'existing-id',
        project_id: 'proj-1',
        key: 'API_KEY',
        encrypted_value: 'old-enc',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // First call: select existing
      mockSingle.mockResolvedValueOnce({ data: existingRow, error: null });

      const updatedRow = { ...existingRow, encrypted_value: 'new-enc', updated_at: '2024-06-01T00:00:00Z' };
      // Second call: update returns updated row
      mockSingle.mockResolvedValueOnce({ data: updatedRow, error: null });

      const result = await storeSecret('proj-1', 'API_KEY', 'new-enc', 'user-1');
      expect(result).toEqual(updatedRow);
    });

    it('throws when update fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'x' }, error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } });

      await expect(storeSecret('proj-1', 'K', 'v')).rejects.toThrow('Failed to update secret: update failed');
    });

    it('creates new secret when not found in DB', async () => {
      // Select returns nothing
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const newRow = {
        id: 'new-id',
        project_id: 'proj-1',
        key: 'NEW_KEY',
        encrypted_value: 'enc',
        created_by: 'system',
        created_at: '2024-06-01',
        updated_at: '2024-06-01',
      };
      mockSingle.mockResolvedValueOnce({ data: newRow, error: null });

      const result = await storeSecret('proj-1', 'NEW_KEY', 'enc');
      expect(result).toEqual(newRow);
    });

    it('throws when insert fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

      await expect(storeSecret('proj-1', 'K', 'v')).rejects.toThrow('Failed to create secret: insert failed');
    });
  });

  describe('getProjectSecrets', () => {
    it('returns secrets ordered by key', async () => {
      const rows = [
        { id: '1', project_id: 'proj-1', key: 'A', encrypted_value: 'v1' },
        { id: '2', project_id: 'proj-1', key: 'B', encrypted_value: 'v2' },
      ];
      mockOrder.mockResolvedValueOnce({ data: rows, error: null });

      const result = await getProjectSecrets('proj-1');
      expect(result).toEqual(rows);
    });

    it('returns empty array when data is null', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: null });
      const result = await getProjectSecrets('proj-1');
      expect(result).toEqual([]);
    });

    it('throws on DB error', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });
      await expect(getProjectSecrets('proj-1')).rejects.toThrow('Failed to list secrets: db error');
    });
  });

  describe('getSecret', () => {
    it('returns secret when found', async () => {
      const row = { id: '1', project_id: 'proj-1', key: 'K', encrypted_value: 'enc' };
      mockSingle.mockResolvedValueOnce({ data: row, error: null });

      const result = await getSecret('proj-1', 'K');
      expect(result).toEqual(row);
    });

    it('returns null when not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      const result = await getSecret('proj-1', 'MISSING');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
      const result = await getSecret('proj-1', 'K');
      expect(result).toBeNull();
    });
  });

  describe('deleteSecret', () => {
    it('returns true on success', async () => {
      // deleteSecret chains .delete().eq('project_id',...).eq('key',...)
      // First eq is intermediate (returns chain), second is terminal (resolves)
      mockEq
        .mockReturnValueOnce(supabaseChain)
        .mockResolvedValueOnce({ error: null });

      const result = await deleteSecret('proj-1', 'K');
      expect(result).toBe(true);
    });

    it('throws on error', async () => {
      mockEq
        .mockReturnValueOnce(supabaseChain)
        .mockResolvedValueOnce({ error: { message: 'delete failed' } });
      await expect(deleteSecret('proj-1', 'K')).rejects.toThrow('Failed to delete secret: delete failed');
    });
  });

  describe('getProjectSecretCount', () => {
    it('returns count from DB', async () => {
      mockEq.mockResolvedValueOnce({ count: 5, error: null });

      const result = await getProjectSecretCount('proj-1');
      expect(result).toBe(5);
    });

    it('returns 0 when count is null', async () => {
      mockEq.mockResolvedValueOnce({ count: null, error: null });
      const result = await getProjectSecretCount('proj-1');
      expect(result).toBe(0);
    });

    it('throws on error', async () => {
      mockEq.mockResolvedValueOnce({ count: null, error: { message: 'count error' } });
      await expect(getProjectSecretCount('proj-1')).rejects.toThrow('Failed to count secrets: count error');
    });
  });

  describe('deleteProjectSecrets', () => {
    it('returns count of deleted rows', async () => {
      mockSelect.mockResolvedValueOnce({
        data: [{ id: '1' }, { id: '2' }, { id: '3' }],
        error: null,
      });

      const result = await deleteProjectSecrets('proj-1');
      expect(result).toBe(3);
    });

    it('returns 0 when data is null', async () => {
      mockSelect.mockResolvedValueOnce({ data: null, error: null });
      const result = await deleteProjectSecrets('proj-1');
      expect(result).toBe(0);
    });

    it('throws on error', async () => {
      mockSelect.mockResolvedValueOnce({ data: null, error: { message: 'del error' } });
      await expect(deleteProjectSecrets('proj-1')).rejects.toThrow(
        'Failed to delete project secrets: del error'
      );
    });
  });
});
