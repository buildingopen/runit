// ABOUTME: Tests for RunitClient HTTP client. Mocks global fetch to verify request construction.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunitClient } from '../src/index.js';

function mockFetch(body: unknown = {}, ok = true, status = 200, statusText = 'OK') {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('RunitClient constructor', () => {
  it('sets Authorization header when apiKey is provided', async () => {
    global.fetch = mockFetch({ projects: [], total: 0 });
    const client = new RunitClient({ baseUrl: 'http://host', apiKey: 'my-key' });
    await client.listProjects();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-key',
        }),
      }),
    );
  });

  it('does not set Authorization header when apiKey is omitted', async () => {
    global.fetch = mockFetch({ projects: [], total: 0 });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.listProjects();

    const callHeaders = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('strips trailing slash from baseUrl', async () => {
    global.fetch = mockFetch({ projects: [], total: 0 });
    const client = new RunitClient({ baseUrl: 'http://host/' });
    await client.listProjects();

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe('http://host/v1/projects');
  });
});

describe('deploy()', () => {
  it('calls POST /v1/deploy with code, name, requirements', async () => {
    const response = {
      url: null,
      project_id: 'p1',
      project_slug: 'test',
      version_id: 'v1',
      version_hash: 'abc',
      status: 'deployed',
      share_id: null,
      endpoints: [],
      detected_env_vars: [],
    };
    global.fetch = mockFetch(response);
    const client = new RunitClient({ baseUrl: 'http://host' });
    const result = await client.deploy('print("hi")', 'test-proj', ['requests']);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/deploy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'print("hi")', name: 'test-proj', requirements: ['requests'] }),
      }),
    );
    expect(result).toEqual(response);
  });
});

describe('listProjects()', () => {
  it('calls GET /v1/projects', async () => {
    global.fetch = mockFetch({ projects: [], total: 0 });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.listProjects();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/projects',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('deleteProject()', () => {
  it('calls DELETE /v1/projects/:id', async () => {
    global.fetch = mockFetch({ success: true });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.deleteProject('proj-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/projects/proj-123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('run()', () => {
  it('calls POST /v1/runs with project_id, version_id, endpoint_id, and spread params', async () => {
    global.fetch = mockFetch({ run_id: 'r1', status: 'queued' });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.run('p1', 'v1', 'e1', {
      json: { x: 1 },
      params: { q: 'hello' },
      lane: 'gpu',
      timeout_seconds: 30,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/runs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          project_id: 'p1',
          version_id: 'v1',
          endpoint_id: 'e1',
          json: { x: 1 },
          params: { q: 'hello' },
          lane: 'gpu',
          timeout_seconds: 30,
        }),
      }),
    );
  });
});

describe('getRunStatus()', () => {
  it('calls GET /v1/runs/:id', async () => {
    const status = {
      run_id: 'r1',
      project_id: 'p1',
      version_id: 'v1',
      endpoint_id: 'e1',
      status: 'success',
      created_at: '2026-01-01T00:00:00Z',
    };
    global.fetch = mockFetch(status);
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.getRunStatus('r1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/runs/r1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('waitForRun()', () => {
  it('polls until terminal status is reached', async () => {
    const pending = {
      run_id: 'r1', project_id: 'p1', version_id: 'v1',
      endpoint_id: 'e1', status: 'pending', created_at: '2026-01-01T00:00:00Z',
    };
    const success = { ...pending, status: 'success' };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(pending) })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(pending) })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(success) });
    global.fetch = fetchMock;

    // Override setTimeout to be instant so the test doesn't wait
    vi.useFakeTimers();
    const client = new RunitClient({ baseUrl: 'http://host' });
    const promise = client.waitForRun('r1', 60000);

    // Advance through the polling delays
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    vi.useRealTimers();

    expect(result.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws timeout error when run stays pending', async () => {
    const pending = {
      run_id: 'r1', project_id: 'p1', version_id: 'v1',
      endpoint_id: 'e1', status: 'pending', created_at: '2026-01-01T00:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      json: () => Promise.resolve(pending),
    });

    vi.useFakeTimers();
    const client = new RunitClient({ baseUrl: 'http://host' });
    const promise = client.waitForRun('r1', 100);

    // Attach catch handler immediately to prevent unhandled rejection
    let error: Error | undefined;
    const handled = promise.catch((e: Error) => { error = e; });

    // Advance time past the timeout, flush microtasks between advances
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    await handled;
    vi.useRealTimers();

    expect(error).toBeDefined();
    expect(error!.message).toContain('timed out');
  });
});

describe('error handling', () => {
  it('throws error with message from response body when fetch returns non-ok', async () => {
    global.fetch = mockFetch({ error: 'Project not found' }, false, 404, 'Not Found');
    const client = new RunitClient({ baseUrl: 'http://host' });

    await expect(client.listProjects()).rejects.toThrow('Project not found');
  });

  it('throws with HTTP status when no error field in body', async () => {
    global.fetch = mockFetch({}, false, 500, 'Internal Server Error');
    const client = new RunitClient({ baseUrl: 'http://host' });

    await expect(client.listProjects()).rejects.toThrow('HTTP 500: Internal Server Error');
  });
});

describe('health()', () => {
  it('calls base URL /health, not /v1/health', async () => {
    global.fetch = mockFetch({ status: 'ok' });
    const client = new RunitClient({ baseUrl: 'http://host' });
    const result = await client.health();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/health',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result).toEqual({ status: 'ok' });
  });
});

describe('listSecrets()', () => {
  it('calls GET /v1/projects/:id/secrets', async () => {
    global.fetch = mockFetch({ secrets: [] });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.listSecrets('proj-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/projects/proj-123/secrets',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('setSecret()', () => {
  it('calls POST /v1/projects/:id/secrets with key and value', async () => {
    global.fetch = mockFetch({ key: 'MY_KEY' });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.setSecret('proj-123', 'MY_KEY', 'secret-value');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/projects/proj-123/secrets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'MY_KEY', value: 'secret-value' }),
      }),
    );
  });
});

describe('deleteSecret()', () => {
  it('calls DELETE /v1/projects/:id/secrets/:key', async () => {
    global.fetch = mockFetch({ deleted: true });
    const client = new RunitClient({ baseUrl: 'http://host' });
    await client.deleteSecret('proj-123', 'MY_KEY');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://host/v1/projects/proj-123/secrets/MY_KEY',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
