import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/routes/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../../src/lib/modal/client', () => ({
  executeOnModal: vi.fn(),
}));

vi.mock('../../src/routes/secrets', () => ({
  getDecryptedSecretsForRun: vi.fn(),
}));

vi.mock('../../src/encryption/kms', () => ({
  encryptSecretsBundle: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../src/db/runs-store', () => ({
  createRun: vi.fn(),
  markRunStarted: vi.fn(),
  markRunSuccess: vi.fn(),
  markRunTimeout: vi.fn(),
  markRunError: vi.fn(),
  getRun: vi.fn(),
  listProjectRuns: vi.fn(),
}));

vi.mock('../../src/db/projects-store', () => ({
  getProject: vi.fn(),
  getVersion: vi.fn(),
}));

import runs from '../../src/routes/runs';
import { executeOnModal } from '../../src/lib/modal/client';
import { getDecryptedSecretsForRun } from '../../src/routes/secrets';
import { encryptSecretsBundle } from '../../src/encryption/kms';
import { getAuthContext } from '../../src/middleware/auth';
import * as runsStore from '../../src/db/runs-store';
import * as projectsStore from '../../src/db/projects-store';

const baseRun = {
  id: 'run-1',
  project_id: 'proj-1',
  version_id: 'ver-1',
  endpoint_id: 'ep-1',
  owner_id: 'user-1',
  request_params: {},
  request_body: {},
  request_headers: {},
  request_files: null,
  response_status: null,
  response_body: null,
  response_content_type: null,
  status: 'queued',
  duration_ms: null,
  resource_lane: 'cpu',
  base_image_version: null,
  error_class: null,
  error_message: null,
  suggested_fix: null,
  logs: null,
  artifacts: null,
  warnings: null,
  redactions_applied: false,
  created_at: new Date().toISOString(),
  started_at: null,
  completed_at: null,
  expires_at: new Date(Date.now() + 1000).toISOString(),
};

const baseVersion = {
  id: 'ver-1',
  project_id: 'proj-1',
  code_bundle_ref: 'bundle-ref',
  entrypoint: 'main:app',
  endpoints: [{ id: 'ep-1', method: 'POST', path: '/extract' }],
};

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('routes/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getAuthContext).mockReturnValue({
      user: { id: 'user-1' },
      isAuthenticated: true,
    });

    vi.mocked(projectsStore.getProject).mockResolvedValue({ id: 'proj-1', owner_id: 'user-1' } as any);
    vi.mocked(projectsStore.getVersion).mockResolvedValue(baseVersion as any);

    vi.mocked(runsStore.createRun).mockResolvedValue(baseRun as any);
    vi.mocked(runsStore.markRunStarted).mockResolvedValue(baseRun as any);
    vi.mocked(runsStore.markRunSuccess).mockResolvedValue(baseRun as any);
    vi.mocked(runsStore.markRunTimeout).mockResolvedValue(baseRun as any);
    vi.mocked(runsStore.markRunError).mockResolvedValue(baseRun as any);

    vi.mocked(getDecryptedSecretsForRun).mockResolvedValue({});
    vi.mocked(encryptSecretsBundle).mockResolvedValue('enc-secrets');

    vi.mocked(executeOnModal).mockResolvedValue({
      run_id: 'run-1',
      status: 'success',
      http_status: 200,
      response_body: { ok: true },
      duration_ms: 123,
      logs: 'done',
      artifacts: [],
    } as any);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await runs.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: 'proj-1' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when project does not exist', async () => {
    vi.mocked(projectsStore.getProject).mockResolvedValue(null);

    const res = await runs.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj-1',
        version_id: 'ver-1',
        endpoint_id: 'ep-1',
      }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Project not found' });
  });

  it('returns 404 when version does not exist or belongs to another project', async () => {
    vi.mocked(projectsStore.getVersion).mockResolvedValue({ ...baseVersion, project_id: 'other' } as any);

    const res = await runs.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj-1',
        version_id: 'ver-1',
        endpoint_id: 'ep-1',
      }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Version not found' });
  });

  it('returns 404 when endpoint is not found on version', async () => {
    vi.mocked(projectsStore.getVersion).mockResolvedValue({ ...baseVersion, endpoints: [] } as any);

    const res = await runs.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj-1',
        version_id: 'ver-1',
        endpoint_id: 'ep-1',
      }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Endpoint not found' });
  });

  it('creates a run and processes successful async completion', async () => {
    vi.mocked(getDecryptedSecretsForRun).mockResolvedValue({ API_KEY: 'abc123secret' });

    const res = await runs.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj-1',
        version_id: 'ver-1',
        endpoint_id: 'ep-1',
        lane: 'gpu',
        timeout_seconds: 90,
        params: { q: 'x' },
        json: { body: true },
        headers: { 'x-test': 'ok' },
        files: [{ filename: 'a.txt', data: 'YQ==', content_type: 'text/plain' }],
      }),
    });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ run_id: 'run-1', status: 'running' });

    expect(runsStore.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        version_id: 'ver-1',
        endpoint_id: 'ep-1',
        owner_id: 'user-1',
        resource_lane: 'gpu',
      })
    );

    expect(encryptSecretsBundle).toHaveBeenCalledWith({ API_KEY: 'abc123secret' });
    expect(executeOnModal).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: 'run-1',
        endpoint: 'POST /extract',
        lane: 'gpu',
        timeout_seconds: 90,
        secrets_ref: 'enc-secrets',
        request_data: expect.objectContaining({
          files: [{ name: 'a.txt', content: 'YQ==', mime: 'text/plain' }],
        }),
      })
    );

    await flushPromises();
    expect(runsStore.markRunSuccess).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ response_status: 200, duration_ms: 123 })
    );
  });

  it('marks run as error when modal execution rejects', async () => {
    vi.mocked(executeOnModal).mockRejectedValue(new Error('modal down'));

    const res = await runs.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj-1',
        version_id: 'ver-1',
        endpoint_id: 'ep-1',
      }),
    });

    expect(res.status).toBe(202);

    await flushPromises();
    expect(runsStore.markRunError).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ error_class: 'EXECUTION_FAILED' })
    );
  });

  it('returns 404 when fetching unknown run', async () => {
    vi.mocked(runsStore.getRun).mockResolvedValue(null);

    const res = await runs.request('/run-404', { method: 'GET' });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Run not found' });
  });

  it('returns 403 when run owner does not match current user', async () => {
    vi.mocked(runsStore.getRun).mockResolvedValue({ ...baseRun, owner_id: 'another-user' } as any);

    const res = await runs.request('/run-1', { method: 'GET' });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Not authorized' });
  });

  it('returns mapped run result payload for terminal states', async () => {
    vi.mocked(runsStore.getRun).mockResolvedValue({
      ...baseRun,
      status: 'success',
      response_status: 201,
      response_content_type: 'application/json',
      response_body: { ok: true },
      artifacts: [{ name: 'a.txt', size: 1, mime: 'text/plain', storage_ref: 's3://a' }],
      redactions_applied: true,
      logs: 'ok',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 12,
    } as any);

    const res = await runs.request('/run-1', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run_id).toBe('run-1');
    expect(body.result.http_status).toBe(201);
    expect(body.result.artifacts[0]).toEqual({
      name: 'a.txt',
      size: 1,
      mime_type: 'text/plain',
      download_url: 's3://a',
    });
  });
});
