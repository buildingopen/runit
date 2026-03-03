/**
 * Tests for version management routes: list versions, promote, rollback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/projects-store', () => ({
  getProject: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  setProdVersion: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
}));

import { Hono } from 'hono';
import versions from '../../src/routes/versions';
import * as projectsStore from '../../src/db/projects-store';
import { getAuthContext } from '../../src/middleware/auth';

function createApp() {
  const app = new Hono();
  app.route('/projects', versions);
  return app;
}

const mockProject = {
  id: 'proj-1',
  slug: 'test-proj-1',
  name: 'Test',
  owner_id: 'user-1',
  status: 'live',
  dev_version_id: 'v2',
  prod_version_id: 'v1',
  deployed_at: null,
  deploy_error: null,
  runtime_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockVersions = [
  {
    id: 'v2',
    project_id: 'proj-1',
    version_hash: 'hash2',
    code_bundle_ref: 'bundle2',
    openapi: null,
    endpoints: [{ id: 'ep1', method: 'POST', path: '/gen', summary: 'Gen' }],
    entrypoint: 'main.py',
    detected_env_vars: [],
    status: 'ready',
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'v1',
    project_id: 'proj-1',
    version_hash: 'hash1',
    code_bundle_ref: 'bundle1',
    openapi: null,
    endpoints: [{ id: 'ep0', method: 'GET', path: '/health', summary: 'Health' }],
    entrypoint: 'main.py',
    detected_env_vars: [],
    status: 'ready',
    created_at: '2025-01-01T00:00:00Z',
  },
];

describe('GET /projects/:id/versions', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await app.request('/projects/proj-1/versions');
    expect(res.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);

    const res = await app.request('/projects/proj-1/versions');
    expect(res.status).toBe(404);
  });

  it('returns 403 when not project owner', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-2' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await app.request('/projects/proj-1/versions');
    expect(res.status).toBe(403);
  });

  it('lists versions with dev/prod flags', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.listVersions).mockResolvedValue(mockVersions as any);

    const res = await app.request('/projects/proj-1/versions');
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.versions).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.dev_version_id).toBe('v2');
    expect(data.prod_version_id).toBe('v1');

    // v2 is dev
    const v2 = data.versions.find((v: any) => v.version_id === 'v2');
    expect(v2.is_dev).toBe(true);
    expect(v2.is_prod).toBe(false);

    // v1 is prod
    const v1 = data.versions.find((v: any) => v.version_id === 'v1');
    expect(v1.is_dev).toBe(false);
    expect(v1.is_prod).toBe(true);
  });
});

describe('POST /projects/:id/promote', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('promotes dev version to prod', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue(mockVersions[0] as any);
    vi.mocked(projectsStore.setProdVersion).mockResolvedValue(undefined);

    const res = await app.request('/projects/proj-1/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.promoted).toBe(true);
    expect(data.version_id).toBe('v2');
    expect(data.version_hash).toBe('hash2');
    expect(data.previous_version_id).toBe('v1');
    expect(projectsStore.setProdVersion).toHaveBeenCalledWith('proj-1', 'v2');
  });

  it('promotes a specific version', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue(mockVersions[1] as any);
    vi.mocked(projectsStore.setProdVersion).mockResolvedValue(undefined);

    const res = await app.request('/projects/proj-1/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: 'v1' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.promoted).toBe(true);
    expect(data.version_id).toBe('v1');
  });

  it('rejects promotion when version status is not ready', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue({ ...mockVersions[0], status: 'failed' } as any);

    const res = await app.request('/projects/proj-1/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.promoted).toBe(false);
    expect(data.reason).toContain('failed');
  });

  it('rejects promotion when version has no endpoints', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue({ ...mockVersions[0], endpoints: [] } as any);

    const res = await app.request('/projects/proj-1/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.promoted).toBe(false);
    expect(data.reason).toContain('no endpoints');
  });

  it('returns 400 when no dev version exists', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue({
      ...mockProject,
      dev_version_id: null,
    } as any);

    const res = await app.request('/projects/proj-1/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /projects/:id/rollback', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('rolls back to a specific version', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue(mockVersions[1] as any);
    vi.mocked(projectsStore.setProdVersion).mockResolvedValue(undefined);

    const res = await app.request('/projects/proj-1/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: 'v1' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.rolled_back).toBe(true);
    expect(data.version_id).toBe('v1');
    expect(data.version_hash).toBe('hash1');
    expect(data.previous_version_id).toBe('v1');
    expect(projectsStore.setProdVersion).toHaveBeenCalledWith('proj-1', 'v1');
  });

  it('returns 400 when version_id is missing', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await app.request('/projects/proj-1/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when version does not exist', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue(null);

    const res = await app.request('/projects/proj-1/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: 'v-nonexistent' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when version belongs to different project', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue({
      ...mockVersions[0],
      project_id: 'proj-other',
    } as any);

    const res = await app.request('/projects/proj-1/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: 'v2' }),
    });

    expect(res.status).toBe(404);
  });
});
