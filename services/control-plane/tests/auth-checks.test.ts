/**
 * Tests for authorization checks on GET endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database stores before importing routes
vi.mock('../src/db/runs-store', () => ({
  getRun: vi.fn(),
  listProjectRuns: vi.fn(),
}));

vi.mock('../src/db/projects-store', () => ({
  getProject: vi.fn(),
  listVersions: vi.fn(),
  getLatestVersion: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock('../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock('../src/db/billing-store', () => ({
  incrementProjectsCount: vi.fn().mockResolvedValue(undefined),
  getUserTier: vi.fn().mockResolvedValue('free'),
}));

vi.mock('../src/config/tiers', () => ({
  getTierLimits: vi.fn().mockReturnValue({
    cpuRunsPerHour: 50, gpuRunsPerHour: 5, maxConcurrentCpu: 1,
    maxConcurrentGpu: 1, maxProjects: 3, maxSecretsPerProject: 5, maxFileSizeMB: 10,
  }),
}));

import runs from '../src/routes/runs';
import projects from '../src/routes/projects';
import * as runsStore from '../src/db/runs-store';
import * as projectsStore from '../src/db/projects-store';
import { getAuthContext } from '../src/middleware/auth';

describe('GET /runs/:id Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if run not found', async () => {
    vi.mocked(runsStore.getRun).mockResolvedValue(null);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const req = new Request('http://localhost/runs/run-123');
    const res = await runs.request('/run-123', { method: 'GET' }, { req });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Run not found');
  });

  it('should allow owner to access their run', async () => {
    const mockRun = {
      id: 'run-123',
      project_id: 'proj-1',
      version_id: 'ver-1',
      endpoint_id: 'ep-1',
      owner_id: 'user-1',
      status: 'success',
      created_at: new Date().toISOString(),
    };
    vi.mocked(runsStore.getRun).mockResolvedValue(mockRun as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await runs.request('/run-123', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run_id).toBe('run-123');
  });

  it('should deny access to run owned by different user', async () => {
    const mockRun = {
      id: 'run-123',
      project_id: 'proj-1',
      version_id: 'ver-1',
      endpoint_id: 'ep-1',
      owner_id: 'user-2', // Different owner
      status: 'success',
      created_at: new Date().toISOString(),
    };
    vi.mocked(runsStore.getRun).mockResolvedValue(mockRun as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await runs.request('/run-123', { method: 'GET' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });

  it('should return 401 for unauthenticated access to any run', async () => {
    const mockRun = {
      id: 'run-123',
      project_id: 'proj-1',
      version_id: 'ver-1',
      endpoint_id: 'ep-1',
      owner_id: 'anonymous',
      status: 'success',
      created_at: new Date().toISOString(),
    };
    vi.mocked(runsStore.getRun).mockResolvedValue(mockRun as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await runs.request('/run-123', { method: 'GET' });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 401 for unauthenticated access to user-owned runs', async () => {
    const mockRun = {
      id: 'run-123',
      project_id: 'proj-1',
      version_id: 'ver-1',
      endpoint_id: 'ep-1',
      owner_id: 'user-1',
      status: 'success',
      created_at: new Date().toISOString(),
    };
    vi.mocked(runsStore.getRun).mockResolvedValue(mockRun as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await runs.request('/run-123', { method: 'GET' });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });
});

describe('GET /projects/:id Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if project not found', async () => {
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123', { method: 'GET' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });

  it('should allow owner to access their project', async () => {
    const mockProject = {
      id: 'proj-123',
      slug: 'my-project',
      name: 'My Project',
      owner_id: 'user-1',
      status: 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.listVersions).mockResolvedValue([]);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project_id).toBe('proj-123');
  });

  it('should deny access to project owned by different user', async () => {
    const mockProject = {
      id: 'proj-123',
      slug: 'my-project',
      name: 'My Project',
      owner_id: 'user-2', // Different owner
      status: 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123', { method: 'GET' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });

  it('should return 401 for unauthenticated access to any project', async () => {
    const mockProject = {
      id: 'proj-123',
      slug: 'my-project',
      name: 'My Project',
      owner_id: 'anonymous',
      status: 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await projects.request('/proj-123', { method: 'GET' });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });
});

describe('GET /projects/:id/endpoints Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deny access to endpoints for project owned by different user', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-2',
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123/endpoints', { method: 'GET' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });

  it('should allow owner to access endpoints', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-1',
    };
    const mockVersion = {
      id: 'ver-1',
      endpoints: [{ id: 'ep-1', method: 'GET', path: '/test' }],
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getLatestVersion).mockResolvedValue(mockVersion as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123/endpoints', { method: 'GET' });

    expect(res.status).toBe(200);
  });
});

describe('GET /projects/:id/runs Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deny access to runs for project owned by different user', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-2',
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123/runs', { method: 'GET' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });

  it('should allow owner to access project runs', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-1',
    };
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(runsStore.listProjectRuns).mockResolvedValue([]);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123/runs', { method: 'GET' });

    expect(res.status).toBe(200);
  });

  it('should return 404 if project not found when listing runs', async () => {
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/proj-123/runs', { method: 'GET' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });
});
