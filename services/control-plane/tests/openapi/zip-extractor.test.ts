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
    // Script + config file written separately
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    // Script file
    expect(mockWriteFileSync.mock.calls[0][0]).toContain('extract.py');
    // Config file with base64 data (not interpolated into script)
    expect(mockWriteFileSync.mock.calls[1][0]).toContain('config.json');
    const configContent = JSON.parse(mockWriteFileSync.mock.calls[1][1]);
    expect(configContent.zip_base64).toBe('Zm9v');
    expect(configContent.work_dir).toContain('openapi-extract-');
    // Both files cleaned up
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
    // Python spawned with config file as argument
    expect(mockSpawn).toHaveBeenCalledWith('python3', expect.arrayContaining([
      expect.stringContaining('extract.py'),
      expect.stringContaining('config.json'),
    ]));
  });

  it('throws when python returns structured extraction error', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');
    proc.stdout.emit('data', Buffer.from(JSON.stringify({ error: 'Could not find FastAPI app' })));
    proc.emit('close', 0);

    await expect(promise).rejects.toThrow('Could not find FastAPI app');
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it('propagates subprocess stderr failure', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');
    proc.stderr.emit('data', Buffer.from('Traceback...'));
    proc.emit('close', 1);

    await expect(promise).rejects.toThrow('OpenAPI extraction failed: Traceback...');
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it('propagates spawn runtime errors', async () => {
    const proc = createMockPythonProcess();
    mockSpawn.mockReturnValue(proc);

    const mod = await import('../../src/lib/openapi/zip-extractor');
    const promise = mod.extractOpenAPIFromZip('Zm9v');
    proc.emit('error', new Error('spawn failed'));

    await expect(promise).rejects.toThrow('spawn failed');
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });
});
