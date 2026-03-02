/**
 * Integration tests for Projects API routes
 *
 * Tests for CRUD operations on /projects endpoints
 * Mocks Supabase client and database stores
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database stores before importing routes
vi.mock('../../src/db/projects-store', () => ({
  createProject: vi.fn(),
  createProjectAtomic: vi.fn(),
  getProject: vi.fn(),
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  listVersions: vi.fn(),
  getLatestVersion: vi.fn(),
  createVersion: vi.fn(),
}));

vi.mock('../../src/db/runs-store', () => ({
  listProjectRuns: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock('../../src/db/billing-store', () => ({
  incrementProjectsCount: vi.fn().mockResolvedValue(undefined),
  getUserTier: vi.fn().mockResolvedValue('free'),
}));

vi.mock('../../src/config/tiers', () => ({
  getTierLimits: vi.fn().mockReturnValue({
    cpuRunsPerHour: 50, gpuRunsPerHour: 5, maxConcurrentCpu: 1,
    maxConcurrentGpu: 1, maxProjects: 3, maxSecretsPerProject: 5, maxFileSizeMB: 10,
  }),
}));

vi.mock('../../src/lib/openapi/zip-extractor', () => ({
  extractOpenAPIFromZip: vi.fn(),
}));

vi.mock('../../src/lib/validation-utils', () => ({
  validateProjectName: vi.fn(() => ({ valid: true })),
  validateBase64: vi.fn(() => ({ valid: true })),
  validateZipMagicBytes: vi.fn(() => ({ valid: true })),
  validateZipDataSize: vi.fn(() => ({ valid: true })),
  validateZipDecompressionSafe: vi.fn(() => ({ valid: true })),
}));

import projects from '../../src/routes/projects';
import * as projectsStore from '../../src/db/projects-store';
import * as runsStore from '../../src/db/runs-store';
import { getAuthContext } from '../../src/middleware/auth';
import { extractOpenAPIFromZip } from '../../src/lib/openapi/zip-extractor';
import {
  validateProjectName,
  validateBase64,
  validateZipMagicBytes,
  validateZipDataSize,
  validateZipDecompressionSafe,
} from '../../src/lib/validation-utils';

describe('POST /projects - Create project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset validation mocks to valid state
    vi.mocked(validateProjectName).mockReturnValue({ valid: true });
    vi.mocked(validateBase64).mockReturnValue({ valid: true });
    vi.mocked(validateZipMagicBytes).mockReturnValue({ valid: true });
    vi.mocked(validateZipDataSize).mockReturnValue({ valid: true });
    vi.mocked(validateZipDecompressionSafe).mockReturnValue({ valid: true });
  });

  it('should create a project with valid ZIP data', async () => {
    const mockProject = {
      id: 'proj-123',
      slug: 'my-project-proj-123',
      name: 'My Project',
      owner_id: 'user-1',
      status: 'draft',
      deployed_at: null,
      deploy_error: null,
      runtime_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockVersion = {
      id: 'ver-123',
      project_id: 'proj-123',
      version_hash: 'abc123def456',
      code_bundle_ref: 'base64data',
      openapi: null,
      endpoints: [],
      entrypoint: 'main.py',
      detected_env_vars: ['API_KEY'],
      status: 'ready',
      created_at: new Date().toISOString(),
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.createProjectAtomic).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.createVersion).mockResolvedValue(mockVersion as any);
    vi.mocked(extractOpenAPIFromZip).mockResolvedValue({
      openapi: { openapi: '3.0.0' },
      endpoints: [],
      entrypoint: 'main.py',
      detected_env_vars: ['API_KEY'],
    });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
        zip_data: 'UEsDBBQAAAAIAA==', // minimal valid base64
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project_id).toBe('proj-123');
    expect(body.project_slug).toBe('my-project-proj-123');
    expect(body.version_id).toBe('ver-123');
    expect(body.status).toBe('draft');
  });

  it('should return 400 when name is missing', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: 'zip',
        zip_data: 'UEsDBBQAAAAIAA==',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('should return 400 when source_type is missing', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('should return 400 for invalid source_type', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'invalid',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid source_type');
  });

  it('should return 400 when zip_data missing for ZIP upload', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('zip_data required');
  });

  it('should return 400 when github_url missing for GitHub import', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'github',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('github_url required');
  });

  it('should return 400 for invalid project name', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(validateProjectName).mockReturnValue({ valid: false, error: 'Invalid project name' });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Project!',
        source_type: 'zip',
        zip_data: 'UEsDBBQAAAAIAA==',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid project name');
  });

  it('should return 400 for invalid base64 data', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(validateProjectName).mockReturnValue({ valid: true });
    vi.mocked(validateBase64).mockReturnValue({ valid: false, error: 'Invalid base64 encoding' });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
        zip_data: '!!!invalid-base64!!!',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid base64');
  });

  it('should return 400 for oversized ZIP', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(validateProjectName).mockReturnValue({ valid: true });
    vi.mocked(validateBase64).mockReturnValue({ valid: true });
    vi.mocked(validateZipDataSize).mockReturnValue({ valid: false, error: 'ZIP file exceeds maximum size' });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
        zip_data: 'UEsDBBQAAAAIAA==',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('exceeds maximum size');
  });

  it('should return 400 for invalid ZIP magic bytes', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(validateProjectName).mockReturnValue({ valid: true });
    vi.mocked(validateBase64).mockReturnValue({ valid: true });
    vi.mocked(validateZipDataSize).mockReturnValue({ valid: true });
    vi.mocked(validateZipMagicBytes).mockReturnValue({ valid: false, error: 'Not a valid ZIP file' });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
        zip_data: 'bm90LWEtemlw', // "not-a-zip" in base64
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Not a valid ZIP');
  });

  it('should return 400 for potential zip bomb', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(validateProjectName).mockReturnValue({ valid: true });
    vi.mocked(validateBase64).mockReturnValue({ valid: true });
    vi.mocked(validateZipDataSize).mockReturnValue({ valid: true });
    vi.mocked(validateZipMagicBytes).mockReturnValue({ valid: true });
    vi.mocked(validateZipDecompressionSafe).mockReturnValue({ valid: false, error: 'Potential zip bomb detected' });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
        zip_data: 'UEsDBBQAAAAIAA==',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('zip bomb');
  });

  it('should return 401 when user not authenticated', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await projects.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Project',
        source_type: 'zip',
        zip_data: 'UEsDBBQAAAAIAA==',
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });
});

describe('GET /projects - List projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return list of user projects', async () => {
    const mockProjects = [
      {
        id: 'proj-1',
        slug: 'project-one',
        name: 'Project One',
        owner_id: 'user-1',
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'proj-2',
        slug: 'project-two',
        name: 'Project Two',
        owner_id: 'user-1',
        status: 'live',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.listProjects).mockResolvedValue(mockProjects as any);
    vi.mocked(projectsStore.getLatestVersion).mockResolvedValue({
      version_hash: 'v1hash',
    } as any);

    const res = await projects.request('/', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.projects[0].project_id).toBe('proj-1');
    expect(body.projects[0].name).toBe('Project One');
  });

  it('should return empty list when user has no projects', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.listProjects).mockResolvedValue([]);

    const res = await projects.request('/', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('should return 401 for unauthenticated users', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await projects.request('/', { method: 'GET' });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });
});

describe('GET /projects/:id - Get single project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return project details for owner', async () => {
    const mockProject = {
      id: 'proj-123',
      slug: 'my-project',
      name: 'My Project',
      owner_id: 'user-1',
      status: 'draft',
      deployed_at: null,
      deploy_error: null,
      runtime_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockVersions = [
      {
        id: 'ver-1',
        version_hash: 'abc123',
        created_at: '2024-01-01T00:00:00Z',
        status: 'ready',
        detected_env_vars: ['API_KEY'],
        endpoints: [{ id: 'ep-1', method: 'GET', path: '/hello' }],
      },
    ];

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.listVersions).mockResolvedValue(mockVersions as any);

    const res = await projects.request('/proj-123', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project_id).toBe('proj-123');
    expect(body.name).toBe('My Project');
    expect(body.detected_env_vars).toContain('API_KEY');
    expect(body.versions).toHaveLength(1);
  });

  it('should return 404 for non-existent project', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);

    const res = await projects.request('/non-existent', { method: 'GET' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });

  it('should return 403 when accessing another user\'s project', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-2', // Different owner
      status: 'draft',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

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
      status: 'draft',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await projects.request('/proj-123', { method: 'GET' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /projects/:id - Delete project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete project owned by user', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-1',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.deleteProject).mockResolvedValue(true);

    const res = await projects.request('/proj-123', { method: 'DELETE' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.project_id).toBe('proj-123');
    expect(projectsStore.deleteProject).toHaveBeenCalledWith('proj-123');
  });

  it('should return 401 when user not authenticated', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: null, isAuthenticated: false });

    const res = await projects.request('/proj-123', { method: 'DELETE' });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 404 for non-existent project', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);

    const res = await projects.request('/non-existent', { method: 'DELETE' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });

  it('should return 403 when deleting another user\'s project', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-2', // Different owner
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await projects.request('/proj-123', { method: 'DELETE' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });
});

describe('GET /projects/:id/endpoints - Get project endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return endpoints for project owner', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-1',
    };

    const mockVersion = {
      id: 'ver-1',
      endpoints: [
        { id: 'ep-1', method: 'GET', path: '/hello', summary: 'Say hello' },
        { id: 'ep-2', method: 'POST', path: '/data', summary: 'Submit data' },
      ],
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getLatestVersion).mockResolvedValue(mockVersion as any);

    const res = await projects.request('/proj-123/endpoints', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endpoints).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.endpoints[0].endpoint_id).toBe('ep-1');
  });

  it('should return 403 when accessing endpoints of another user\'s project', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-2',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await projects.request('/proj-123/endpoints', { method: 'GET' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });

  it('should return 404 when project not found', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);

    const res = await projects.request('/proj-123/endpoints', { method: 'GET' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });

  it('should return 404 when version not found', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-1',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(projectsStore.getLatestVersion).mockResolvedValue(null);

    const res = await projects.request('/proj-123/endpoints', { method: 'GET' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Version not found');
  });
});

describe('GET /projects/:id/runs - List project runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return runs for project owner', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-1',
    };

    const mockRuns = [
      {
        id: 'run-1',
        endpoint_id: 'ep-1',
        status: 'success',
        created_at: '2024-01-01T00:00:00Z',
        duration_ms: 150,
      },
      {
        id: 'run-2',
        endpoint_id: 'ep-1',
        status: 'failed',
        created_at: '2024-01-02T00:00:00Z',
        duration_ms: 50,
      },
    ];

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(runsStore.listProjectRuns).mockResolvedValue(mockRuns as any);

    const res = await projects.request('/proj-123/runs', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.runs[0].run_id).toBe('run-1');
  });

  it('should return 403 when accessing runs of another user\'s project', async () => {
    const mockProject = {
      id: 'proj-123',
      owner_id: 'user-2',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(mockProject as any);

    const res = await projects.request('/proj-123/runs', { method: 'GET' });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not authorized');
  });

  it('should return 404 when project not found', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);

    const res = await projects.request('/proj-123/runs', { method: 'GET' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });
});
