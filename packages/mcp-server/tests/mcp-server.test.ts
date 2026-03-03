// ABOUTME: Tests for the RunIt MCP server tool handlers.
// ABOUTME: Mocks @runit/client and MCP SDK to capture tool registrations and test handler logic directly.

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---- Capture tool registrations ----
const registeredTools: Record<string, { handler: Function }> = {};

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class MockMcpServer {
    tool(name: string, _desc: string, _schema: any, handler: Function) {
      registeredTools[name] = { handler };
    }
    async connect() {}
  }
  return { McpServer: MockMcpServer };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  class MockStdioServerTransport {}
  return { StdioServerTransport: MockStdioServerTransport };
});

// ---- Mock RunitClient ----
const mockClient = {
  deploy: vi.fn(),
  listProjects: vi.fn(),
  run: vi.fn(),
  waitForRun: vi.fn(),
  listSecrets: vi.fn(),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
  getProjectRuns: vi.fn(),
  getRunStatus: vi.fn(),
  getProject: vi.fn(),
  listVersions: vi.fn(),
  promote: vi.fn(),
  rollback: vi.fn(),
  putStorage: vi.fn(),
  getStorage: vi.fn(),
  deleteStorage: vi.fn(),
  listStorage: vi.fn(),
  createShareLink: vi.fn(),
  listShareLinks: vi.fn(),
  disableShareLink: vi.fn(),
  fetchContext: vi.fn(),
  listContexts: vi.fn(),
  deleteContext: vi.fn(),
};

vi.mock('@runit/client', () => {
  class MockRunitClient {
    constructor() {
      return mockClient;
    }
  }
  return { RunitClient: MockRunitClient };
});

// ---- Import (triggers tool registration) ----
beforeAll(async () => {
  await import('../src/index.js');
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to extract text from MCP tool response
function getText(result: any): string {
  return result.content[0].text;
}

// ============================================================
// deploy
// ============================================================
describe('deploy tool', () => {
  it('returns formatted output on successful deploy', async () => {
    mockClient.deploy.mockResolvedValue({
      project_id: 'proj-123',
      version_hash: 'abc123',
      status: 'ready',
      url: null,
      endpoints: [
        { id: 'ep1', method: 'POST', path: '/generate', summary: 'Generate invoice' },
      ],
      detected_env_vars: ['API_KEY'],
    });

    const result = await registeredTools['deploy'].handler({
      code: 'print("hi")',
      name: 'test-project',
      requirements: ['requests'],
    });

    expect(result.isError).toBeUndefined();
    const text = getText(result);
    expect(text).toContain('Deployed "test-project" successfully');
    expect(text).toContain('Project ID: proj-123');
    expect(text).toContain('Version: abc123');
    expect(text).toContain('Status: ready');
    expect(text).toContain('POST /generate - Generate invoice');
    expect(text).toContain('Detected env vars: API_KEY');
    expect(text).toContain('manage_secrets tool');
    expect(mockClient.deploy).toHaveBeenCalledWith('print("hi")', 'test-project', ['requests'], undefined);
  });

  it('includes share URL when present', async () => {
    mockClient.deploy.mockResolvedValue({
      project_id: 'proj-456',
      version_hash: 'def456',
      status: 'ready',
      url: '/share/xyz',
      endpoints: [],
      detected_env_vars: [],
    });

    const result = await registeredTools['deploy'].handler({
      code: 'print("hi")',
      name: 'url-project',
    });

    const text = getText(result);
    expect(text).toContain('Share URL:');
    expect(text).toContain('/share/xyz');
  });

  it('omits endpoints and env vars sections when empty', async () => {
    mockClient.deploy.mockResolvedValue({
      project_id: 'proj-789',
      version_hash: 'ghi789',
      status: 'ready',
      url: null,
      endpoints: [],
      detected_env_vars: [],
    });

    const result = await registeredTools['deploy'].handler({
      code: 'print("hi")',
      name: 'minimal-project',
    });

    const text = getText(result);
    expect(text).not.toContain('Endpoints:');
    expect(text).not.toContain('Detected env vars');
    expect(text).not.toContain('Share URL');
  });

  it('returns isError on deploy failure', async () => {
    mockClient.deploy.mockRejectedValue(new Error('Syntax error in code'));

    const result = await registeredTools['deploy'].handler({
      code: 'bad code!!!',
      name: 'fail-project',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Deploy failed: Syntax error in code');
  });

  it('handles non-Error thrown values', async () => {
    mockClient.deploy.mockRejectedValue('string error');

    const result = await registeredTools['deploy'].handler({
      code: 'x',
      name: 'fail2',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Deploy failed: string error');
  });
});

// ============================================================
// run
// ============================================================
describe('run tool', () => {
  it('returns formatted result on successful run', async () => {
    mockClient.run.mockResolvedValue({ run_id: 'run-001', status: 'queued' });
    mockClient.waitForRun.mockResolvedValue({
      run_id: 'run-001',
      status: 'success',
      duration_ms: 450,
      result: {
        http_status: 200,
        json: { invoice_id: 'inv-42' },
      },
    });

    const result = await registeredTools['run'].handler({
      project_id: 'proj-123',
      endpoint_id: 'post--generate',
      version_id: 'v1',
      json: { amount: 100 },
    });

    expect(result.isError).toBeUndefined();
    const text = getText(result);
    expect(text).toContain('Run run-001: success');
    expect(text).toContain('Duration: 450ms');
    expect(text).toContain('HTTP Status: 200');
    expect(text).toContain('"invoice_id": "inv-42"');
    expect(mockClient.run).toHaveBeenCalledWith('proj-123', 'v1', 'post--generate', {
      json: { amount: 100 },
      params: undefined,
      timeout_seconds: undefined,
    });
  });

  it('shows error details when run has error result', async () => {
    mockClient.run.mockResolvedValue({ run_id: 'run-002', status: 'queued' });
    mockClient.waitForRun.mockResolvedValue({
      run_id: 'run-002',
      status: 'error',
      duration_ms: 100,
      result: {
        http_status: 500,
        error_class: 'ValueError',
        error_message: 'invalid input',
        suggested_fix: 'Check the input format',
        logs: 'Traceback line 1\nTraceback line 2',
      },
    });

    const result = await registeredTools['run'].handler({
      project_id: 'proj-123',
      endpoint_id: 'post--generate',
      version_id: 'v1',
    });

    const text = getText(result);
    expect(text).toContain('Run run-002: error');
    expect(text).toContain('Error: ValueError: invalid input');
    expect(text).toContain('Fix: Check the input format');
    expect(text).toContain('Logs:\nTraceback line 1');
  });

  it('handles zero duration_ms gracefully', async () => {
    mockClient.run.mockResolvedValue({ run_id: 'run-003', status: 'queued' });
    mockClient.waitForRun.mockResolvedValue({
      run_id: 'run-003',
      status: 'success',
      duration_ms: undefined,
      result: { http_status: 200 },
    });

    const result = await registeredTools['run'].handler({
      project_id: 'p',
      endpoint_id: 'e',
      version_id: 'v',
    });

    const text = getText(result);
    expect(text).toContain('Duration: 0ms');
  });

  it('returns isError on run failure', async () => {
    mockClient.run.mockRejectedValue(new Error('Network timeout'));

    const result = await registeredTools['run'].handler({
      project_id: 'p',
      endpoint_id: 'e',
      version_id: 'v',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Run failed: Network timeout');
  });
});

// ============================================================
// list_projects
// ============================================================
describe('list_projects tool', () => {
  it('returns message when no projects exist', async () => {
    mockClient.listProjects.mockResolvedValue({ projects: [], total: 0 });

    const result = await registeredTools['list_projects'].handler({});

    const text = getText(result);
    expect(text).toContain('No projects found');
    expect(text).toContain('deploy tool');
  });

  it('lists projects with all details', async () => {
    mockClient.listProjects.mockResolvedValue({
      projects: [
        {
          project_id: 'proj-1',
          project_slug: 'my-api',
          name: 'My API',
          status: 'active',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          project_id: 'proj-2',
          project_slug: 'data-pipe',
          name: 'Data Pipeline',
          status: 'stopped',
          created_at: '2025-02-01T00:00:00Z',
        },
      ],
      total: 2,
    });

    const result = await registeredTools['list_projects'].handler({});

    const text = getText(result);
    expect(text).toContain('2 project(s)');
    expect(text).toContain('My API (proj-1)');
    expect(text).toContain('Slug: my-api');
    expect(text).toContain('Status: active');
    expect(text).toContain('Data Pipeline (proj-2)');
    expect(text).toContain('Status: stopped');
  });

  it('shows "unknown" for missing status', async () => {
    mockClient.listProjects.mockResolvedValue({
      projects: [
        {
          project_id: 'proj-x',
          project_slug: 'no-status',
          name: 'No Status',
          created_at: '2025-03-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    const result = await registeredTools['list_projects'].handler({});

    expect(getText(result)).toContain('Status: unknown');
  });

  it('returns isError on failure', async () => {
    mockClient.listProjects.mockRejectedValue(new Error('Unauthorized'));

    const result = await registeredTools['list_projects'].handler({});

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Failed to list projects: Unauthorized');
  });
});

// ============================================================
// get_project
// ============================================================
describe('get_project tool', () => {
  it('shows project details with endpoints and schemas', async () => {
    mockClient.getProject.mockResolvedValue({
      project_id: 'proj-1',
      project_slug: 'my-api',
      name: 'My API',
      status: 'active',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      endpoints: [
        {
          id: 'post--generate',
          method: 'POST',
          path: '/generate',
          summary: 'Generate output',
          description: 'Generates output from input',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    count: { type: 'integer' },
                  },
                  required: ['name'],
                },
              },
            },
          },
        },
      ],
    });

    const result = await registeredTools['get_project'].handler({ project_id: 'proj-1' });

    const text = getText(result);
    expect(text).toContain('My API (proj-1)');
    expect(text).toContain('POST /generate');
    expect(text).toContain('Summary: Generate output');
    expect(text).toContain('Description: Generates output from input');
    expect(text).toContain('Input schema');
    expect(text).toContain('"name"');
  });

  it('shows no endpoints message when none exist', async () => {
    mockClient.getProject.mockResolvedValue({
      project_id: 'proj-2',
      project_slug: 'empty',
      name: 'Empty',
      status: 'active',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      endpoints: [],
    });

    const result = await registeredTools['get_project'].handler({ project_id: 'proj-2' });

    expect(getText(result)).toContain('No endpoints found');
  });

  it('returns isError on failure', async () => {
    mockClient.getProject.mockRejectedValue(new Error('Not found'));

    const result = await registeredTools['get_project'].handler({ project_id: 'proj-missing' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Failed to get project: Not found');
  });
});

// ============================================================
// manage_secrets
// ============================================================
describe('manage_secrets tool', () => {
  it('lists secrets with timestamps', async () => {
    mockClient.listSecrets.mockResolvedValue({
      secrets: [
        { key: 'API_KEY', updated_at: '2025-01-15T10:00:00Z' },
        { key: 'DB_URL', updated_at: '2025-01-20T12:00:00Z' },
      ],
    });

    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'list',
    });

    const text = getText(result);
    expect(text).toContain('Secrets:');
    expect(text).toContain('API_KEY (updated: 2025-01-15T10:00:00Z)');
    expect(text).toContain('DB_URL (updated: 2025-01-20T12:00:00Z)');
  });

  it('returns message when no secrets exist', async () => {
    mockClient.listSecrets.mockResolvedValue({ secrets: [] });

    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'list',
    });

    expect(getText(result)).toContain('No secrets configured');
  });

  it('sets a secret successfully', async () => {
    mockClient.setSecret.mockResolvedValue({ key: 'MY_KEY' });

    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'set',
      key: 'MY_KEY',
      value: 'my-value',
    });

    expect(getText(result)).toContain('Secret "MY_KEY" set successfully');
    expect(mockClient.setSecret).toHaveBeenCalledWith('proj-1', 'MY_KEY', 'my-value');
  });

  it('deletes a secret successfully', async () => {
    mockClient.deleteSecret.mockResolvedValue({ deleted: true });

    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'delete',
      key: 'OLD_KEY',
    });

    expect(getText(result)).toContain('Secret "OLD_KEY" deleted');
    expect(mockClient.deleteSecret).toHaveBeenCalledWith('proj-1', 'OLD_KEY');
  });

  it('returns isError when set without key', async () => {
    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'set',
      value: 'some-value',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('key is required');
  });

  it('returns isError when set without value', async () => {
    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'set',
      key: 'MY_KEY',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('value is required');
  });

  it('returns isError when delete without key', async () => {
    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'delete',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('key is required');
  });

  it('returns isError on API failure', async () => {
    mockClient.listSecrets.mockRejectedValue(new Error('Forbidden'));

    const result = await registeredTools['manage_secrets'].handler({
      project_id: 'proj-1',
      action: 'list',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Secrets operation failed: Forbidden');
  });
});

// ============================================================
// get_logs
// ============================================================
describe('get_logs tool', () => {
  it('returns message when no runs exist', async () => {
    mockClient.getProjectRuns.mockResolvedValue({ runs: [] });

    const result = await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
    });

    expect(getText(result)).toContain('No runs found');
  });

  it('lists runs and fetches latest run details', async () => {
    mockClient.getProjectRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'run-a',
          endpoint_id: 'post--generate',
          status: 'success',
          created_at: '2025-01-20T10:00:00Z',
          duration_ms: 320,
        },
        {
          run_id: 'run-b',
          endpoint_id: 'get--health',
          status: 'success',
          created_at: '2025-01-19T09:00:00Z',
          duration_ms: 50,
        },
      ],
    });
    mockClient.getRunStatus.mockResolvedValue({
      run_id: 'run-a',
      status: 'success',
      result: {
        logs: 'Processing complete\nItems: 42',
      },
    });

    const result = await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
      limit: 5,
    });

    const text = getText(result);
    expect(text).toContain('Recent runs for project proj-1');
    expect(text).toContain('run-a | success | post--generate | 320ms');
    expect(text).toContain('run-b | success | get--health | 50ms');
    expect(text).toContain('Latest run logs:\nProcessing complete');
    expect(mockClient.getProjectRuns).toHaveBeenCalledWith('proj-1', 5);
  });

  it('shows error details from latest run', async () => {
    mockClient.getProjectRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'run-err',
          endpoint_id: 'post--process',
          status: 'error',
          created_at: '2025-01-20T10:00:00Z',
        },
      ],
    });
    mockClient.getRunStatus.mockResolvedValue({
      run_id: 'run-err',
      status: 'error',
      result: {
        error_class: 'RuntimeError',
        error_message: 'Out of memory',
        suggested_fix: 'Reduce batch size',
      },
    });

    const result = await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
    });

    const text = getText(result);
    expect(text).toContain('Latest error: RuntimeError: Out of memory');
    expect(text).toContain('Suggested fix: Reduce batch size');
  });

  it('uses default limit of 10 when not specified', async () => {
    mockClient.getProjectRuns.mockResolvedValue({ runs: [] });

    await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
    });

    expect(mockClient.getProjectRuns).toHaveBeenCalledWith('proj-1', 10);
  });

  it('handles missing duration_ms in run list', async () => {
    mockClient.getProjectRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'run-no-dur',
          endpoint_id: 'post--x',
          status: 'running',
          created_at: '2025-01-20T10:00:00Z',
        },
      ],
    });
    mockClient.getRunStatus.mockResolvedValue({
      run_id: 'run-no-dur',
      status: 'running',
      result: null,
    });

    const result = await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
    });

    expect(getText(result)).toContain('run-no-dur | running | post--x | -ms');
  });

  it('gracefully handles getRunStatus failure for latest run', async () => {
    mockClient.getProjectRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'run-x',
          endpoint_id: 'post--y',
          status: 'success',
          created_at: '2025-01-20T10:00:00Z',
          duration_ms: 100,
        },
      ],
    });
    mockClient.getRunStatus.mockRejectedValue(new Error('Not found'));

    const result = await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
    });

    // Non-fatal: the run list is still returned
    const text = getText(result);
    expect(text).toContain('run-x | success | post--y | 100ms');
    expect(text).not.toContain('Latest run logs');
    expect(result.isError).toBeUndefined();
  });

  it('returns isError on getProjectRuns failure', async () => {
    mockClient.getProjectRuns.mockRejectedValue(new Error('Service unavailable'));

    const result = await registeredTools['get_logs'].handler({
      project_id: 'proj-1',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Failed to get logs: Service unavailable');
  });
});

// ============================================================
// Registration
// ============================================================
// ============================================================
// list_versions
// ============================================================
describe('list_versions tool', () => {
  it('returns message when no versions exist', async () => {
    mockClient.listVersions.mockResolvedValue({ versions: [], total: 0, dev_version_id: null, prod_version_id: null });

    const result = await registeredTools['list_versions'].handler({ project_id: 'proj-1' });

    expect(getText(result)).toContain('No versions found');
  });

  it('lists versions with dev/prod flags', async () => {
    mockClient.listVersions.mockResolvedValue({
      versions: [
        {
          version_id: 'v2',
          version_hash: 'hash2',
          created_at: '2025-02-01T00:00:00Z',
          status: 'ready',
          is_dev: true,
          is_prod: false,
          endpoints: [{ id: 'ep1', method: 'POST', path: '/generate', summary: 'Gen' }],
        },
        {
          version_id: 'v1',
          version_hash: 'hash1',
          created_at: '2025-01-01T00:00:00Z',
          status: 'ready',
          is_dev: false,
          is_prod: true,
          endpoints: [],
        },
      ],
      total: 2,
      dev_version_id: 'v2',
      prod_version_id: 'v1',
    });

    const result = await registeredTools['list_versions'].handler({ project_id: 'proj-1' });

    const text = getText(result);
    expect(text).toContain('2 version(s)');
    expect(text).toContain('hash2 (v2)');
    expect(text).toContain('[DEV]');
    expect(text).toContain('hash1 (v1)');
    expect(text).toContain('[PROD]');
    expect(text).toContain('Dev version: v2');
    expect(text).toContain('Prod version: v1');
  });

  it('returns isError on failure', async () => {
    mockClient.listVersions.mockRejectedValue(new Error('Not found'));

    const result = await registeredTools['list_versions'].handler({ project_id: 'proj-missing' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Failed to list versions: Not found');
  });
});

// ============================================================
// promote
// ============================================================
describe('promote tool', () => {
  it('shows success message on promotion', async () => {
    mockClient.promote.mockResolvedValue({
      promoted: true,
      version_id: 'v2',
      version_hash: 'hash2',
      previous_version_id: 'v1',
    });

    const result = await registeredTools['promote'].handler({ project_id: 'proj-1' });

    const text = getText(result);
    expect(text).toContain('Promoted version hash2 to production');
    expect(text).toContain('Previous prod version: v1');
  });

  it('shows rollback message on failed promotion', async () => {
    mockClient.promote.mockResolvedValue({
      promoted: false,
      rolled_back: true,
      reason: 'Version has no endpoints',
      version_id: 'v1',
    });

    const result = await registeredTools['promote'].handler({ project_id: 'proj-1' });

    const text = getText(result);
    expect(text).toContain('Promotion failed');
    expect(text).toContain('Auto-rolled back to v1');
    expect(text).toContain('Version has no endpoints');
  });

  it('returns isError on API failure', async () => {
    mockClient.promote.mockRejectedValue(new Error('Unauthorized'));

    const result = await registeredTools['promote'].handler({ project_id: 'proj-1' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Promote failed: Unauthorized');
  });
});

// ============================================================
// rollback
// ============================================================
describe('rollback tool', () => {
  it('shows success message on rollback', async () => {
    mockClient.rollback.mockResolvedValue({
      rolled_back: true,
      version_id: 'v1',
      version_hash: 'hash1',
      previous_version_id: 'v2',
    });

    const result = await registeredTools['rollback'].handler({ project_id: 'proj-1', version_id: 'v1' });

    const text = getText(result);
    expect(text).toContain('Rolled back to version hash1 (v1)');
  });

  it('returns isError on failure', async () => {
    mockClient.rollback.mockRejectedValue(new Error('Version not found'));

    const result = await registeredTools['rollback'].handler({ project_id: 'proj-1', version_id: 'v-bad' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Rollback failed: Version not found');
  });
});

// ============================================================
// Registration
// ============================================================
// ============================================================
// storage tools
// ============================================================
describe('storage_set tool', () => {
  it('stores a value successfully', async () => {
    mockClient.putStorage.mockResolvedValue({ key: 'config', size_bytes: 42 });

    const result = await registeredTools['storage_set'].handler({
      project_id: 'proj-1',
      key: 'config',
      value: { theme: 'dark' },
    });

    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain('Stored "config" (42 bytes)');
    expect(mockClient.putStorage).toHaveBeenCalledWith('proj-1', 'config', { theme: 'dark' });
  });

  it('returns isError on failure', async () => {
    mockClient.putStorage.mockRejectedValue(new Error('Quota exceeded'));

    const result = await registeredTools['storage_set'].handler({
      project_id: 'proj-1',
      key: 'big',
      value: 'data',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Storage set failed: Quota exceeded');
  });
});

describe('storage_get tool', () => {
  it('retrieves a value', async () => {
    mockClient.getStorage.mockResolvedValue({ key: 'config', value: { theme: 'dark' } });

    const result = await registeredTools['storage_get'].handler({
      project_id: 'proj-1',
      key: 'config',
    });

    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain('Key: config');
    expect(getText(result)).toContain('"theme": "dark"');
  });

  it('returns isError when not found', async () => {
    mockClient.getStorage.mockRejectedValue(new Error('HTTP 404: Not Found'));

    const result = await registeredTools['storage_get'].handler({
      project_id: 'proj-1',
      key: 'missing',
    });

    expect(result.isError).toBe(true);
  });
});

describe('storage_delete tool', () => {
  it('deletes a key', async () => {
    mockClient.deleteStorage.mockResolvedValue({ success: true });

    const result = await registeredTools['storage_delete'].handler({
      project_id: 'proj-1',
      key: 'old',
    });

    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain('Deleted "old"');
  });
});

describe('storage_list tool', () => {
  it('lists entries with usage', async () => {
    mockClient.listStorage.mockResolvedValue({
      entries: [
        { key: 'config', value_type: 'json', size_bytes: 42, updated_at: '2025-01-01T00:00:00Z' },
      ],
      total: 1,
      usage_bytes: 42,
      quota_bytes: 104857600,
    });

    const result = await registeredTools['storage_list'].handler({ project_id: 'proj-1' });

    const text = getText(result);
    expect(text).toContain('1 key(s)');
    expect(text).toContain('config (json, 42 bytes');
  });

  it('shows empty message', async () => {
    mockClient.listStorage.mockResolvedValue({ entries: [], total: 0, usage_bytes: 0, quota_bytes: 104857600 });

    const result = await registeredTools['storage_list'].handler({ project_id: 'proj-1' });

    expect(getText(result)).toContain('No storage entries found');
  });
});

// ============================================================
// create_share_link
// ============================================================
describe('create_share_link tool', () => {
  it('returns formatted text with share URL on success', async () => {
    mockClient.createShareLink.mockResolvedValue({
      share_id: 'share-abc',
      share_url: '/share/abc',
    });

    const result = await registeredTools['create_share_link'].handler({
      project_id: 'proj-1',
      endpoint_id: 'post--generate',
    });

    expect(result.isError).toBeUndefined();
    const text = getText(result);
    expect(text).toContain('Share link created');
    expect(text).toContain('/share/abc');
    expect(text).toContain('share-abc');
    expect(mockClient.createShareLink).toHaveBeenCalledWith('proj-1', 'endpoint_template', 'post--generate');
  });

  it('returns isError on failure', async () => {
    mockClient.createShareLink.mockRejectedValue(new Error('Endpoint not found'));

    const result = await registeredTools['create_share_link'].handler({
      project_id: 'proj-1',
      endpoint_id: 'bad-endpoint',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Endpoint not found');
  });
});

// ============================================================
// list_share_links
// ============================================================
describe('list_share_links tool', () => {
  it('returns formatted list on success', async () => {
    mockClient.listShareLinks.mockResolvedValue({
      shares: [
        {
          share_id: 'share-1',
          share_url: '/share/1',
          target_type: 'endpoint_template',
          target_ref: 'post--generate',
          enabled: true,
          stats: { run_count: 10, success_count: 8 },
        },
        {
          share_id: 'share-2',
          share_url: '/share/2',
          target_type: 'endpoint_template',
          target_ref: 'get--health',
          enabled: false,
          stats: { run_count: 0, success_count: 0 },
        },
      ],
      total: 2,
    });

    const result = await registeredTools['list_share_links'].handler({
      project_id: 'proj-1',
    });

    expect(result.isError).toBeUndefined();
    const text = getText(result);
    expect(text).toContain('2 share link(s)');
    expect(text).toContain('share-1');
    expect(text).toContain('active');
    expect(text).toContain('share-2');
    expect(text).toContain('disabled');
    expect(text).toContain('post--generate');
    expect(text).toContain('10 runs');
  });

  it('returns empty message when no share links exist', async () => {
    mockClient.listShareLinks.mockResolvedValue({ shares: [], total: 0 });

    const result = await registeredTools['list_share_links'].handler({
      project_id: 'proj-1',
    });

    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain('No share links found.');
  });

  it('returns isError on failure', async () => {
    mockClient.listShareLinks.mockRejectedValue(new Error('Unauthorized'));

    const result = await registeredTools['list_share_links'].handler({
      project_id: 'proj-1',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Unauthorized');
  });
});

// ============================================================
// disable_share_link
// ============================================================
describe('disable_share_link tool', () => {
  it('returns confirmation text on success', async () => {
    mockClient.disableShareLink.mockResolvedValue({ share_id: 'share-abc', status: 'disabled' });

    const result = await registeredTools['disable_share_link'].handler({
      project_id: 'proj-1',
      share_id: 'share-abc',
    });

    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain('share-abc disabled');
    expect(mockClient.disableShareLink).toHaveBeenCalledWith('proj-1', 'share-abc');
  });

  it('returns isError on failure', async () => {
    mockClient.disableShareLink.mockRejectedValue(new Error('Share link not found'));

    const result = await registeredTools['disable_share_link'].handler({
      project_id: 'proj-1',
      share_id: 'share-missing',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Share link not found');
  });
});

// ============================================================
// fetch_context
// ============================================================
describe('fetch_context tool', () => {
  it('returns formatted text on success', async () => {
    mockClient.fetchContext.mockResolvedValue({
      id: 'ctx-123',
      data: { key: 'value' },
    });

    const result = await registeredTools['fetch_context'].handler({
      project_id: 'proj-1',
      name: 'my-context',
      url: 'https://example.com/data.json',
    });

    expect(result.isError).toBeUndefined();
    const text = getText(result);
    expect(text).toContain('Context "my-context" added');
    expect(text).toContain('ID: ctx-123');
    expect(mockClient.fetchContext).toHaveBeenCalledWith('proj-1', 'https://example.com/data.json', 'my-context');
  });

  it('returns isError on failure', async () => {
    mockClient.fetchContext.mockRejectedValue(new Error('URL not reachable'));

    const result = await registeredTools['fetch_context'].handler({
      project_id: 'proj-1',
      name: 'bad',
      url: 'https://bad.example.com',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Failed: URL not reachable');
  });
});

// ============================================================
// list_contexts
// ============================================================
describe('list_contexts tool', () => {
  it('returns message when no contexts exist', async () => {
    mockClient.listContexts.mockResolvedValue({ contexts: [] });

    const result = await registeredTools['list_contexts'].handler({ project_id: 'proj-1' });

    expect(getText(result)).toContain('No context entries found');
  });

  it('lists contexts with details', async () => {
    mockClient.listContexts.mockResolvedValue({
      contexts: [
        {
          id: 'ctx-1',
          name: 'api-docs',
          url: 'https://example.com/api.json',
          size: 1024,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          fetched_at: '2025-01-02T00:00:00Z',
        },
      ],
    });

    const result = await registeredTools['list_contexts'].handler({ project_id: 'proj-1' });

    const text = getText(result);
    expect(text).toContain('1 context(s)');
    expect(text).toContain('ctx-1 [api-docs]');
    expect(text).toContain('https://example.com/api.json');
    expect(text).toContain('1024 bytes');
  });

  it('returns isError on failure', async () => {
    mockClient.listContexts.mockRejectedValue(new Error('Unauthorized'));

    const result = await registeredTools['list_contexts'].handler({ project_id: 'proj-1' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Unauthorized');
  });
});

// ============================================================
// delete_context
// ============================================================
describe('delete_context tool', () => {
  it('returns confirmation text on success', async () => {
    mockClient.deleteContext.mockResolvedValue({ success: true });

    const result = await registeredTools['delete_context'].handler({
      project_id: 'proj-1',
      context_id: 'ctx-123',
    });

    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain('Context ctx-123 removed');
    expect(mockClient.deleteContext).toHaveBeenCalledWith('proj-1', 'ctx-123');
  });

  it('returns isError on failure', async () => {
    mockClient.deleteContext.mockRejectedValue(new Error('Context not found'));

    const result = await registeredTools['delete_context'].handler({
      project_id: 'proj-1',
      context_id: 'ctx-missing',
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Context not found');
  });
});

// ============================================================
// Registration
// ============================================================
describe('tool registration', () => {
  it('registers all 19 tools', () => {
    expect(Object.keys(registeredTools)).toEqual(
      expect.arrayContaining([
        'deploy', 'run', 'list_projects', 'get_project', 'manage_secrets', 'get_logs',
        'list_versions', 'promote', 'rollback',
        'storage_set', 'storage_get', 'storage_delete', 'storage_list',
        'create_share_link', 'list_share_links', 'disable_share_link',
        'fetch_context', 'list_contexts', 'delete_context',
      ])
    );
    expect(Object.keys(registeredTools)).toHaveLength(19);
  });
});
