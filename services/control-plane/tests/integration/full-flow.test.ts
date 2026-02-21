import { describe, expect, it, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// In-memory stores for integration testing (avoids pulling real store files into coverage)
const projectsMap = new Map<string, any>();
const versionsMap = new Map<string, any>();
const runsMap = new Map<string, any>();

vi.mock('../../src/db/projects-store', () => ({
  createProject: vi.fn(async (input: any) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const project = { id, ...input, slug: `${input.name}-${id.slice(0, 8)}`, status: 'draft', created_at: now, updated_at: now };
    projectsMap.set(id, project);
    return project;
  }),
  getProject: vi.fn(async (id: string) => projectsMap.get(id) || null),
  createVersion: vi.fn(async (input: any) => {
    const id = uuidv4();
    const version = { id, ...input, deps_hash: null, base_image_version: null, installed_packages: null, detected_env_vars: input.detected_env_vars || [], status: input.status || 'pending', created_at: new Date().toISOString() };
    versionsMap.set(id, version);
    return version;
  }),
  getVersion: vi.fn(async (id: string) => versionsMap.get(id) || null),
  listVersions: vi.fn(async (projectId: string) => Array.from(versionsMap.values()).filter((v: any) => v.project_id === projectId)),
  getLatestVersion: vi.fn(async (projectId: string) => {
    const versions = Array.from(versionsMap.values()).filter((v: any) => v.project_id === projectId);
    return versions[versions.length - 1] || null;
  }),
  listProjects: vi.fn(async () => []),
}));

vi.mock('../../src/db/runs-store', () => ({
  createRun: vi.fn(async (input: any) => {
    const id = uuidv4();
    const run = { id, ...input, status: 'queued', response_status: null, response_body: null, response_content_type: null, duration_ms: null, error_class: null, error_message: null, suggested_fix: null, logs: null, artifacts: null, warnings: null, redactions_applied: false, created_at: new Date().toISOString(), started_at: null, completed_at: null, expires_at: new Date(Date.now() + 86400000).toISOString() };
    runsMap.set(id, run);
    return run;
  }),
  getRun: vi.fn(async (id: string) => runsMap.get(id) || null),
  markRunStarted: vi.fn(async (id: string) => {
    const run = runsMap.get(id);
    if (run) { run.status = 'running'; run.started_at = new Date().toISOString(); }
    return run || null;
  }),
  markRunSuccess: vi.fn(async (id: string, result: any) => {
    const run = runsMap.get(id);
    if (run) { Object.assign(run, { status: 'success', ...result, completed_at: new Date().toISOString() }); }
    return run || null;
  }),
  markRunError: vi.fn(async (id: string, error: any) => {
    const run = runsMap.get(id);
    if (run) { Object.assign(run, { status: 'error', ...error, completed_at: new Date().toISOString() }); }
    return run || null;
  }),
  markRunTimeout: vi.fn(async (id: string, opts: any) => {
    const run = runsMap.get(id);
    if (run) { Object.assign(run, { status: 'timeout', ...opts, completed_at: new Date().toISOString() }); }
    return run || null;
  }),
  listProjectRuns: vi.fn(async () => []),
}));

vi.mock('../../src/lib/modal/client', () => ({
  executeOnModal: vi.fn(),
}));

vi.mock('../../src/lib/openapi/zip-extractor', () => ({
  extractOpenAPIFromZip: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
  getAuthUser: vi.fn(),
  authMiddleware: vi.fn((_c: any, next: any) => next()),
  requireAuth: vi.fn((_c: any, next: any) => next()),
}));

vi.mock('../../src/encryption/kms', () => ({
  encryptSecretsBundle: vi.fn(),
}));

vi.mock('../../src/routes/secrets', () => ({
  getDecryptedSecretsForRun: vi.fn(),
}));

vi.mock('../../src/lib/validation-utils', () => ({
  validateProjectName: () => ({ valid: true }),
  validateBase64: () => ({ valid: true }),
  validateZipMagicBytes: () => ({ valid: true }),
  validateZipDataSize: () => ({ valid: true }),
  validateZipDecompressionSafe: () => ({ valid: true }),
}));

import { Hono } from 'hono';
import projects from '../../src/routes/projects';
import runs from '../../src/routes/runs';
import { executeOnModal } from '../../src/lib/modal/client';
import { extractOpenAPIFromZip } from '../../src/lib/openapi/zip-extractor';
import { getAuthContext } from '../../src/middleware/auth';
import { getDecryptedSecretsForRun } from '../../src/routes/secrets';

function flushPromises(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('full-flow integration: upload -> run -> result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsMap.clear();
    versionsMap.clear();
    runsMap.clear();

    vi.mocked(getAuthContext).mockReturnValue({
      user: { id: 'test-user' },
      isAuthenticated: true,
    });

    vi.mocked(extractOpenAPIFromZip).mockResolvedValue({
      openapi: { openapi: '3.0.0' },
      endpoints: [
        { id: 'ep-1', method: 'POST', path: '/greet', summary: 'Greet' },
      ],
      entrypoint: 'main:app',
      detected_env_vars: [],
    } as any);

    vi.mocked(getDecryptedSecretsForRun).mockResolvedValue({});

    vi.mocked(executeOnModal).mockImplementation(async (req: any) => ({
      run_id: req.run_id,
      status: 'success',
      http_status: 200,
      response_body: { greeting: 'hello world' },
      duration_ms: 42,
      logs: 'ok',
      artifacts: [],
    }));
  });

  it('creates a project, runs it, and retrieves the result', async () => {
    const app = new Hono();
    app.route('/projects', projects);
    app.route('/runs', runs);

    // Step 1: POST /projects with ZIP data
    const createProjectRes = await app.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'integration-test',
        source_type: 'zip',
        zip_data: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
      }),
    });

    expect(createProjectRes.status).toBe(201);
    const projectBody = await createProjectRes.json() as any;
    expect(projectBody.project_id).toBeTruthy();
    expect(projectBody.version_id).toBeTruthy();
    expect(projectBody.endpoints).toHaveLength(1);
    expect(projectBody.endpoints[0].path).toBe('/greet');

    const { project_id, version_id } = projectBody;
    const endpoint_id = projectBody.endpoints[0].id;

    // Step 2: POST /runs with IDs from step 1
    const createRunRes = await app.request('/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id,
        version_id,
        endpoint_id,
        json: { name: 'world' },
      }),
    });

    expect(createRunRes.status).toBe(202);
    const runBody = await createRunRes.json() as any;
    expect(runBody.run_id).toBeTruthy();
    expect(runBody.status).toBe('running');

    const run_id = runBody.run_id;

    // Verify executeOnModal was called with correct cross-store data
    expect(executeOnModal).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id,
        endpoint: 'POST /greet',
        entrypoint: 'main:app',
        request_data: expect.objectContaining({
          json: { name: 'world' },
        }),
      }),
    );

    // Step 3: Wait for async Modal callback to settle
    await flushPromises();

    // Step 4: GET /runs/:run_id -> verify success result
    const getRunRes = await app.request(`/runs/${run_id}`, { method: 'GET' });

    expect(getRunRes.status).toBe(200);
    const resultBody = await getRunRes.json() as any;
    expect(resultBody.run_id).toBe(run_id);
    expect(resultBody.status).toBe('success');
    expect(resultBody.result).toBeTruthy();
    expect(resultBody.result.http_status).toBe(200);
    expect(resultBody.result.json).toEqual({ greeting: 'hello world' });
  });

  it('propagates error status when Modal execution fails', async () => {
    vi.mocked(executeOnModal).mockImplementation(async (req: any) => ({
      run_id: req.run_id,
      status: 'error',
      http_status: 500,
      response_body: null,
      duration_ms: 10,
      error_class: 'USER_CODE_ERROR',
      error_message: 'NameError: name "foo" is not defined',
    }));

    const app = new Hono();
    app.route('/projects', projects);
    app.route('/runs', runs);

    // Create project
    const createProjectRes = await app.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'error-test',
        source_type: 'zip',
        zip_data: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
      }),
    });
    const proj = await createProjectRes.json() as any;

    // Create run
    const createRunRes = await app.request('/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: proj.project_id,
        version_id: proj.version_id,
        endpoint_id: proj.endpoints[0].id,
      }),
    });
    const runBody = await createRunRes.json() as any;

    await flushPromises();

    // Verify error state
    const getRunRes = await app.request(`/runs/${runBody.run_id}`, { method: 'GET' });
    const result = await getRunRes.json() as any;

    expect(result.status).toBe('error');
    expect(result.result.error_class).toBe('USER_CODE_ERROR');
    expect(result.result.error_message).toContain('NameError');
  });
});
