/**
 * Storage API route tests
 *
 * Tests CRUD operations on /projects/:projectId/storage endpoints
 * Mocks storage store, auth, and project store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/storage-store', () => ({
  putStorage: vi.fn(),
  getStorage: vi.fn(),
  deleteStorage: vi.fn(),
  listStorageKeys: vi.fn(),
  getStorageUsage: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../src/db/projects-store', () => ({
  getProject: vi.fn(),
}));

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import storage from '../../src/routes/storage';
import * as storageStore from '../../src/db/storage-store';
import * as projectsStore from '../../src/db/projects-store';
import { getAuthContext } from '../../src/middleware/auth';

const mockProject = { id: 'proj-1', owner_id: 'user-1', name: 'Test', slug: 'test', status: 'draft' };

describe('PUT /projects/:projectId/storage/:key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a value', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.putStorage).mockResolvedValue({
      id: 'entry-1',
      project_id: 'proj-1',
      key: 'config',
      value_type: 'json',
      size_bytes: 20,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    const res = await storage.request('/proj-1/storage/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { theme: 'dark' } }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe('config');
    expect(body.size_bytes).toBe(20);
    expect(storageStore.putStorage).toHaveBeenCalledWith('proj-1', 'config', { theme: 'dark' }, 'json');
  });

  it('returns 400 when value is missing', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await storage.request('/proj-1/storage/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('returns 413 when value exceeds size limit', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.putStorage).mockRejectedValue(new Error('Value size (11000000 bytes) exceeds maximum of 10485760 bytes'));

    const res = await storage.request('/proj-1/storage/big', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(100) }),
    });

    expect(res.status).toBe(413);
  });

  it('returns 413 when project quota exceeded', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.putStorage).mockRejectedValue(new Error('Project storage quota exceeded'));

    const res = await storage.request('/proj-1/storage/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'data' }),
    });

    expect(res.status).toBe(413);
  });

  it('returns 400 for invalid key', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.putStorage).mockRejectedValue(new Error('Key must contain only alphanumeric'));

    const res = await storage.request('/proj-1/storage/bad%2Fkey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'data' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await storage.request('/proj-1/storage/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'data' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-2' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await storage.request('/proj-1/storage/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'data' }),
    });

    expect(res.status).toBe(403);
  });
});

describe('GET /projects/:projectId/storage/:key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stored value', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.getStorage).mockResolvedValue({
      id: 'entry-1',
      project_id: 'proj-1',
      key: 'config',
      value_type: 'json',
      size_bytes: 20,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      data: { theme: 'dark' },
    });

    const res = await storage.request('/proj-1/storage/config', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe('config');
    expect(body.value).toEqual({ theme: 'dark' });
  });

  it('returns 404 for missing key', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.getStorage).mockResolvedValue(null);

    const res = await storage.request('/proj-1/storage/missing', { method: 'GET' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /projects/:projectId/storage/:key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a key', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.deleteStorage).mockResolvedValue(true);

    const res = await storage.request('/proj-1/storage/config', { method: 'DELETE' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('GET /projects/:projectId/storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all keys with usage info', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(storageStore.listStorageKeys).mockResolvedValue([
      {
        id: 'entry-1',
        project_id: 'proj-1',
        key: 'config',
        value_type: 'json' as const,
        size_bytes: 20,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]);
    vi.mocked(storageStore.getStorageUsage).mockResolvedValue(20);

    const res = await storage.request('/proj-1/storage', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.usage_bytes).toBe(20);
    expect(body.quota_bytes).toBe(100 * 1024 * 1024);
  });
});
