// ABOUTME: Tests for the RunIt CLI commands (deploy, list, logs, delete, status, secrets, share, open).
// ABOUTME: Imports exported program and uses parseAsync() for deterministic async handling.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Shared mock state ----

const mockClient = {
  deploy: vi.fn(),
  listProjects: vi.fn(),
  getProjectRuns: vi.fn(),
  getRunStatus: vi.fn(),
  deleteProject: vi.fn(),
  health: vi.fn(),
  listSecrets: vi.fn(),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
  createShareLink: vi.fn(),
  listShareLinks: vi.fn(),
  disableShareLink: vi.fn(),
  listVersions: vi.fn(),
};

const mockExistsSync = vi.fn().mockReturnValue(true);
const mockReadFileSync = vi.fn().mockReturnValue('def hello(): pass');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock('@runit/client', () => ({
  RunitClient: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  };
});

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Capture console output
let logOutput: string[];
let errorOutput: string[];
let exitCode: number | undefined;
const mockFetch = vi.fn();

async function runCLI(args: string[]): Promise<void> {
  // Import the exported program and parse programmatically
  const { program } = await import('../src/index.js');
  // Reset commander state for fresh parsing
  program.args = [];
  await program.parseAsync(['node', 'runit', ...args]);
}

beforeEach(() => {
  logOutput = [];
  errorOutput = [];
  exitCode = undefined;

  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logOutput.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errorOutput.push(args.map(String).join(' '));
  });
  vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
    exitCode = typeof code === 'number' ? code : code == null ? 0 : Number(code);
    return undefined as never;
  });

  mockClient.deploy.mockReset();
  mockClient.listProjects.mockReset();
  mockClient.getProjectRuns.mockReset();
  mockClient.getRunStatus.mockReset();
  mockClient.deleteProject.mockReset();
  mockClient.health.mockReset();
  mockClient.listSecrets.mockReset();
  mockClient.setSecret.mockReset();
  mockClient.deleteSecret.mockReset();
  mockClient.createShareLink.mockReset();
  mockClient.listShareLinks.mockReset();
  mockClient.disableShareLink.mockReset();
  mockClient.listVersions.mockReset();

  mockExistsSync.mockReset().mockReturnValue(true);
  mockReadFileSync.mockReset().mockReturnValue('def hello(): pass');
  mockWriteFileSync.mockReset();
  mockMkdirSync.mockReset();
  mockExecSync.mockReset();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- deploy ----

describe('deploy command', () => {
  it('deploys a file successfully with friendly output', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('def hello(): return "hi"');

    mockClient.deploy.mockResolvedValue({
      status: 'deployed',
      project_id: 'proj-123',
      project_slug: 'hello',
      version_hash: 'abc123',
      url: '/p/hello',
      endpoints: [{ id: 'ep1', method: 'GET', path: '/hello', summary: 'Say hi' }],
      detected_env_vars: [],
    });

    await runCLI(['deploy', 'hello.py']);

    const output = logOutput.join('\n');
    expect(output).toContain('Deploying hello.py');
    expect(output).toContain('Your app is live!');
    expect(output).toContain('/p/hello');
    expect(output).toContain('GET /hello');
    expect(output).toContain('(App: hello, ID: proj-123)');
    expect(exitCode).toBeUndefined();
  });

  it('saves project context after deploy', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('def hello(): return "hi"');

    mockClient.deploy.mockResolvedValue({
      status: 'deployed',
      project_id: 'proj-123',
      project_slug: 'hello',
      version_hash: 'abc123',
      url: '/p/hello',
      endpoints: [{ id: 'ep1', method: 'POST', path: '/greet', summary: 'Say hello' }],
      detected_env_vars: [],
    });

    await runCLI(['deploy', 'hello.py']);

    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();
    const savedData = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(savedData.project_id).toBe('proj-123');
    expect(savedData.name).toBe('hello');
    expect(savedData.actions).toHaveLength(1);
    expect(savedData.actions[0].method).toBe('POST');
  });

  it('shows error when file not found', async () => {
    mockExistsSync.mockReturnValue(false);

    await runCLI(['deploy', 'missing.py']);

    expect(errorOutput.join('\n')).toContain("File 'missing.py' not found");
    expect(exitCode).toBe(1);
  });

  it('passes requirements when provided', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((filePath: unknown) => {
      if (String(filePath).includes('requirements')) {
        return 'numpy==1.24.0\npandas>=2.0\n# comment\n\nrequests';
      }
      return 'def main(): pass';
    });

    mockClient.deploy.mockResolvedValue({
      status: 'deployed',
      project_id: 'proj-456',
      project_slug: 'app',
      version_hash: 'def456',
      url: null,
      endpoints: [],
      detected_env_vars: [],
    });

    await runCLI(['deploy', 'app.py', '-r', 'requirements.txt']);

    expect(mockClient.deploy).toHaveBeenCalledWith(
      'def main(): pass',
      'app',
      ['numpy==1.24.0', 'pandas>=2.0', 'requests'],
    );
  });

  it('shows detected env vars as API keys', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('import os\nos.environ["API_KEY"]');

    mockClient.deploy.mockResolvedValue({
      status: 'deployed',
      project_id: 'proj-789',
      project_slug: 'app',
      version_hash: 'ghi789',
      url: null,
      endpoints: [],
      detected_env_vars: ['API_KEY', 'SECRET_TOKEN'],
    });

    await runCLI(['deploy', 'app.py']);

    const output = logOutput.join('\n');
    expect(output).toContain('API_KEY, SECRET_TOKEN');
    expect(output).toContain('runit secrets set');
  });

  it('handles deploy failure', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('def main(): pass');

    mockClient.deploy.mockRejectedValue(new Error('Server error'));

    await runCLI(['deploy', 'app.py']);

    expect(errorOutput.join('\n')).toContain('Deploy failed: Server error');
    expect(exitCode).toBe(1);
  });

  it('uses custom name when provided with -n', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('def main(): pass');

    mockClient.deploy.mockResolvedValue({
      status: 'deployed',
      project_id: 'proj-custom',
      project_slug: 'my-project',
      version_hash: 'xyz',
      url: null,
      endpoints: [],
      detected_env_vars: [],
    });

    await runCLI(['deploy', 'app.py', '-n', 'my-project']);

    expect(mockClient.deploy).toHaveBeenCalledWith('def main(): pass', 'my-project', undefined);
  });
});

// ---- list ----

describe('list command', () => {
  it('lists apps', async () => {
    mockClient.listProjects.mockResolvedValue({
      projects: [
        {
          project_id: 'p1',
          project_slug: 'hello',
          name: 'hello',
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          project_id: 'p2',
          project_slug: 'world',
          name: 'world',
          status: 'active',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
        },
      ],
      total: 2,
    });

    await runCLI(['list']);

    const output = logOutput.join('\n');
    expect(output).toContain('2 app(s)');
    expect(output).toContain('hello');
    expect(output).toContain('world');
    expect(output).toContain('p1');
    expect(output).toContain('p2');
  });

  it('shows message when no apps exist', async () => {
    mockClient.listProjects.mockResolvedValue({ projects: [], total: 0 });

    await runCLI(['list']);

    const output = logOutput.join('\n');
    expect(output).toContain('No apps found');
  });

  it('handles API failure', async () => {
    mockClient.listProjects.mockRejectedValue(new Error('Server error'));

    await runCLI(['list']);

    expect(errorOutput.join('\n')).toContain('Failed:');
    expect(exitCode).toBe(1);
  });
});

// ---- logs ----

describe('logs command', () => {
  it('shows run logs', async () => {
    mockClient.getProjectRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'run-1',
          endpoint_id: 'ep-1',
          status: 'success',
          created_at: '2024-01-01T00:00:00Z',
          duration_ms: 123,
        },
        {
          run_id: 'run-2',
          endpoint_id: 'ep-1',
          status: 'error',
          created_at: '2024-01-01T00:01:00Z',
          duration_ms: 456,
        },
      ],
    });

    mockClient.getRunStatus.mockResolvedValue({
      run_id: 'run-1',
      status: 'success',
      result: { logs: 'Hello from the function!' },
    });

    await runCLI(['logs', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('Recent runs');
    expect(output).toContain('run-1');
    expect(output).toContain('run-2');
    expect(output).toContain('123ms');
    expect(output).toContain('Hello from the function!');
  });

  it('shows error details for latest run', async () => {
    mockClient.getProjectRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'run-err',
          endpoint_id: 'ep-1',
          status: 'error',
          created_at: '2024-01-01T00:00:00Z',
          duration_ms: 50,
        },
      ],
    });

    mockClient.getRunStatus.mockResolvedValue({
      run_id: 'run-err',
      status: 'error',
      result: {
        error_class: 'ValueError',
        error_message: 'invalid input',
        suggested_fix: 'Check your input parameters',
      },
    });

    await runCLI(['logs', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('ValueError: invalid input');
    expect(output).toContain('Fix: Check your input parameters');
  });

  it('shows message when no runs found', async () => {
    mockClient.getProjectRuns.mockResolvedValue({ runs: [] });

    await runCLI(['logs', 'proj-empty']);

    const output = logOutput.join('\n');
    expect(output).toContain('No runs found');
  });

  it('handles API failure', async () => {
    mockClient.getProjectRuns.mockRejectedValue(new Error('Server error'));

    await runCLI(['logs', 'proj-missing']);

    expect(errorOutput.join('\n')).toContain('Failed:');
    expect(exitCode).toBe(1);
  });

  it('respects --limit flag', async () => {
    mockClient.getProjectRuns.mockResolvedValue({ runs: [] });

    await runCLI(['logs', 'proj-123', '-l', '5']);

    expect(mockClient.getProjectRuns).toHaveBeenCalledWith('proj-123', 5);
  });
});

// ---- delete ----

describe('delete command', () => {
  it('deletes an app', async () => {
    mockClient.deleteProject.mockResolvedValue({ success: true });

    await runCLI(['delete', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('proj-123 deleted');
    expect(mockClient.deleteProject).toHaveBeenCalledWith('proj-123');
  });

  it('handles deletion failure', async () => {
    mockClient.deleteProject.mockRejectedValue(new Error('Server error'));

    await runCLI(['delete', 'proj-nonexistent']);

    expect(errorOutput.join('\n')).toContain('Failed:');
    expect(exitCode).toBe(1);
  });
});

// ---- secrets (API Keys) ----

describe('secrets commands', () => {
  it('lists API keys with timestamps', async () => {
    mockClient.listSecrets.mockResolvedValue({
      secrets: [
        { key: 'API_KEY', updated_at: '2025-01-15T10:00:00Z' },
        { key: 'DB_URL', updated_at: '2025-01-20T12:00:00Z' },
      ],
    });

    await runCLI(['secrets', 'list', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('2 API key(s)');
    expect(output).toContain('API_KEY');
    expect(output).toContain('DB_URL');
    expect(output).toContain('2025-01-15T10:00:00Z');
    expect(mockClient.listSecrets).toHaveBeenCalledWith('proj-123');
  });

  it('shows message when no API keys exist', async () => {
    mockClient.listSecrets.mockResolvedValue({ secrets: [] });

    await runCLI(['secrets', 'list', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('No API keys configured.');
  });

  it('sets an API key', async () => {
    mockClient.setSecret.mockResolvedValue({ key: 'MY_KEY' });

    await runCLI(['secrets', 'set', 'MY_KEY', 'my-value', '-a', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('API key "MY_KEY" set.');
    expect(mockClient.setSecret).toHaveBeenCalledWith('proj-123', 'MY_KEY', 'my-value');
  });

  it('deletes an API key', async () => {
    mockClient.deleteSecret.mockResolvedValue({ deleted: true });

    await runCLI(['secrets', 'delete', 'OLD_KEY', '-a', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('API key "OLD_KEY" deleted.');
    expect(mockClient.deleteSecret).toHaveBeenCalledWith('proj-123', 'OLD_KEY');
  });

  it('handles list failure', async () => {
    mockClient.listSecrets.mockRejectedValue(new Error('Server error'));

    await runCLI(['secrets', 'list', 'proj-123']);

    expect(errorOutput.join('\n')).toContain('Failed:');
    expect(exitCode).toBe(1);
  });
});

// ---- share ----

describe('share commands', () => {
  it('creates a share link and shows URL', async () => {
    mockClient.createShareLink.mockResolvedValue({
      share_id: 'share-abc',
      share_url: '/share/abc',
    });

    await runCLI(['share', 'create', 'post--generate', '-a', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('/share/abc');
    expect(output).toContain('share-abc');
    expect(mockClient.createShareLink).toHaveBeenCalledWith('proj-123', 'endpoint_template', 'post--generate');
  });

  it('lists share links with details', async () => {
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

    await runCLI(['share', 'list', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('2 share link(s)');
    expect(output).toContain('share-1');
    expect(output).toContain('active');
    expect(output).toContain('share-2');
    expect(output).toContain('disabled');
    expect(output).toContain('post--generate');
    expect(output).toContain('10');
    expect(mockClient.listShareLinks).toHaveBeenCalledWith('proj-123');
  });

  it('shows message when no share links exist', async () => {
    mockClient.listShareLinks.mockResolvedValue({ shares: [], total: 0 });

    await runCLI(['share', 'list', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('No share links found.');
  });

  it('disables a share link', async () => {
    mockClient.disableShareLink.mockResolvedValue({ share_id: 'share-abc', status: 'disabled' });

    await runCLI(['share', 'disable', 'share-abc', '-a', 'proj-123']);

    const output = logOutput.join('\n');
    expect(output).toContain('share-abc disabled');
    expect(mockClient.disableShareLink).toHaveBeenCalledWith('proj-123', 'share-abc');
  });

  it('handles create failure', async () => {
    mockClient.createShareLink.mockRejectedValue(new Error('Server error'));

    await runCLI(['share', 'create', 'bad-endpoint', '-a', 'proj-123']);

    expect(errorOutput.join('\n')).toContain('Failed:');
    expect(exitCode).toBe(1);
  });
});

// ---- status ----

describe('status command', () => {
  it('shows server health', async () => {
    mockClient.health.mockResolvedValue({ status: 'ok' });

    await runCLI(['status']);

    const output = logOutput.join('\n');
    expect(output).toContain('Status: ok');
  });

  it('handles unreachable server', async () => {
    mockClient.health.mockRejectedValue(new Error('ECONNREFUSED'));

    await runCLI(['status']);

    expect(errorOutput.join('\n')).toContain("Can't reach RunIt server");
    expect(exitCode).toBe(1);
  });
});

// ---- doctor ----

describe('doctor command', () => {
  it('passes when local setup checks are healthy', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.startsWith('docker --version')) return 'Docker version 25.0.0';
      if (cmd.startsWith('docker info')) return '25.0.0';
      return '';
    });
    mockExistsSync.mockImplementation((filePath: unknown) => String(filePath).includes('.runit/project.json'));
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        project_id: 'proj-1',
        name: 'demo',
        slug: 'demo',
        deployed_at: new Date().toISOString(),
        actions: [],
        base_url: 'http://localhost:3001',
      })
    );

    await runCLI(['doctor']);

    const output = logOutput.join('\n');
    expect(output).toContain('RunIt Doctor');
    expect(output).toContain('All checks passed');
    expect(exitCode).toBeUndefined();
  });

  it('fails with actionable fixes when setup is broken', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    mockExecSync.mockImplementation(() => {
      throw new Error('docker missing');
    });
    mockExistsSync.mockReturnValue(false);

    await runCLI(['doctor']);

    const output = logOutput.join('\n');
    expect(output).toContain('FAIL');
    expect(output).toContain('Fix:');
    expect(output).toContain('check(s) need attention');
    expect(exitCode).toBe(1);
  });
});

// ---- error formatting ----

describe('error formatting', () => {
  it('formats ECONNREFUSED errors', async () => {
    mockClient.listProjects.mockRejectedValue(new Error('ECONNREFUSED'));

    await runCLI(['list']);

    expect(errorOutput.join('\n')).toContain("Can't reach RunIt server");
    expect(exitCode).toBe(1);
  });

  it('formats auth errors', async () => {
    mockClient.listProjects.mockRejectedValue(new Error('HTTP 401: Unauthorized'));

    await runCLI(['list']);

    expect(errorOutput.join('\n')).toContain('Authentication failed');
    expect(errorOutput.join('\n')).toContain('RUNIT_API_KEY');
    expect(exitCode).toBe(1);
  });

  it('formats 404 errors', async () => {
    mockClient.getProjectRuns.mockRejectedValue(new Error('HTTP 404: not found'));

    await runCLI(['logs', 'proj-missing']);

    expect(errorOutput.join('\n')).toContain('App not found');
    expect(exitCode).toBe(1);
  });
});
