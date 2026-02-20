import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSpawn = vi.fn();
const mockWriteFileSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockTmpdir = vi.fn(() => '/tmp');
const mockRandomUUID = vi.fn(() => 'uuid-123');

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));
vi.mock('fs', () => ({
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));
vi.mock('os', () => ({
  tmpdir: () => mockTmpdir(),
}));
vi.mock('crypto', () => ({
  randomUUID: () => mockRandomUUID(),
}));

function createMockPythonProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  return proc;
}

describe('zip-extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('extracts endpoints from runtime OpenAPI output', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');

    const openapi = {
      openapi: '3.0.0',
      x_entrypoint: 'api:app',
      x_detected_env_vars: ['OPENAI_API_KEY'],
      paths: {
        '/health': {
          get: { summary: 'Health', description: 'health endpoint' },
        },
        '/items': {
          post: { summary: 'Create item' },
        },
      },
    };
    proc.stdout.emit('data', Buffer.from(JSON.stringify(openapi)));
    proc.emit('close', 0);

    const result = await promise;
    expect(result.entrypoint).toBe('api:app');
    expect(result.detected_env_vars).toEqual(['OPENAI_API_KEY']);
    expect(result.endpoints).toHaveLength(2);
    expect(result.endpoints[0].id).toContain('get');
    expect(result.openapi).not.toHaveProperty('x_entrypoint');
    expect(result.openapi).not.toHaveProperty('x_detected_env_vars');
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('throws when python returns structured extraction error', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');
    proc.stdout.emit('data', Buffer.from(JSON.stringify({ error: 'Could not find FastAPI app' })));
    proc.emit('close', 0);

    await expect(promise).rejects.toThrow('Could not find FastAPI app');
    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('propagates subprocess stderr failure', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');
    proc.stderr.emit('data', Buffer.from('Traceback...'));
    proc.emit('close', 1);

    await expect(promise).rejects.toThrow('OpenAPI extraction failed: Traceback...');
    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('propagates spawn runtime errors', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');
    proc.emit('error', new Error('spawn failed'));

    await expect(promise).rejects.toThrow('spawn failed');
    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});
