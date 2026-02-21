import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const mockCaptureException = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockRunsInc = vi.fn();
const mockRunDurationObserve = vi.fn();
const mockErrorsInc = vi.fn();
const mockRecordModalResult = vi.fn();

let useFallback = false;

type SpawnBehavior =
  | { kind: 'success'; stdout: string }
  | { kind: 'failure'; stderr: string }
  | { kind: 'error'; error: Error };

const spawnQueue: SpawnBehavior[] = [];

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();

    const behavior = spawnQueue.shift();
    process.nextTick(() => {
      if (!behavior) {
        proc.stdout.emit('data', Buffer.from('{"run_id":"r-default","status":"success","http_status":200,"response_body":{"ok":true},"duration_ms":10}'));
        proc.emit('close', 0);
        return;
      }

      if (behavior.kind === 'success') {
        proc.stdout.emit('data', Buffer.from(behavior.stdout));
        proc.emit('close', 0);
      } else if (behavior.kind === 'failure') {
        proc.stderr.emit('data', Buffer.from(behavior.stderr));
        proc.emit('close', 1);
      } else {
        proc.emit('error', behavior.error);
      }
    });

    return proc;
  }),
}));

vi.mock('../src/lib/circuit-breaker.ts', () => ({
  getModalCircuitBreaker: vi.fn(() => ({ name: 'modal-breaker' })),
  withCircuitBreaker: vi.fn(async (_breaker: unknown, action: () => Promise<unknown>, fallback?: () => unknown) => {
    if (useFallback && fallback) {
      return fallback();
    }
    return action();
  }),
}));

vi.mock('../src/lib/tracing.ts', () => ({
  withModalExecutionSpan: vi.fn(async (_runId: string, _lane: string, _endpoint: string, _requestId: string | undefined, fn: (span: unknown) => Promise<unknown>) => {
    return fn({ span: 'fake' });
  }),
  recordModalResult: (...args: unknown[]) => mockRecordModalResult(...args),
}));

vi.mock('../src/lib/metrics.ts', () => ({
  runsTotal: { inc: (...args: unknown[]) => mockRunsInc(...args) },
  runDuration: { observe: (...args: unknown[]) => mockRunDurationObserve(...args) },
  errorsTotal: { inc: (...args: unknown[]) => mockErrorsInc(...args) },
}));

vi.mock('../src/lib/sentry.ts', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock('../src/lib/logger.ts', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const request = {
  run_id: 'run-123',
  code_bundle: 'YmFzZTY0',
  endpoint: 'GET /health',
  request_data: { json: { ping: true } },
  lane: 'cpu' as const,
  timeout_seconds: 5,
};

describe('lib/modal/client executeOnModal', () => {
  beforeEach(() => {
    spawnQueue.length = 0;
    useFallback = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns success result from modal execution', async () => {
    spawnQueue.push({
      kind: 'success',
      stdout: JSON.stringify({
        run_id: 'run-123',
        status: 'success',
        http_status: 200,
        response_body: { ok: true },
        duration_ms: 25,
      }),
    });

    const { executeOnModal } = await import('../src/lib/modal/client.js');
    const result = await executeOnModal(request);

    expect(result.status).toBe('success');
    expect(result.http_status).toBe(200);
    expect(mockRunsInc).toHaveBeenCalledWith({ status: 'success', lane: 'cpu' });
    expect(mockRunDurationObserve).toHaveBeenCalled();
    expect(mockRecordModalResult).toHaveBeenCalled();
  });

  it('retries transient modal errors and eventually succeeds', async () => {
    spawnQueue.push(
      {
        kind: 'success',
        stdout: JSON.stringify({
          run_id: 'run-123',
          status: 'error',
          http_status: 503,
          response_body: null,
          duration_ms: 10,
          error_class: 'MODAL_EXECUTION_ERROR',
          error_message: 'temporary',
        }),
      },
      {
        kind: 'success',
        stdout: JSON.stringify({
          run_id: 'run-123',
          status: 'success',
          http_status: 200,
          response_body: { ok: true },
          duration_ms: 15,
        }),
      }
    );

    const { executeOnModal } = await import('../src/lib/modal/client.js');
    const result = await executeOnModal(request);

    expect(result.status).toBe('success');
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockRunsInc).toHaveBeenCalledTimes(2);
  }, 10000);

  it('returns non-retryable errors without retrying', async () => {
    spawnQueue.push({
      kind: 'success',
      stdout: JSON.stringify({
        run_id: 'run-123',
        status: 'error',
        http_status: 400,
        response_body: null,
        duration_ms: 7,
        error_class: 'NameError',
        error_message: 'name x is not defined',
      }),
    });

    const { executeOnModal } = await import('../src/lib/modal/client.js');
    const result = await executeOnModal(request);

    expect(result.status).toBe('error');
    expect(result.error_class).toBe('NameError');
    expect(mockRunsInc).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('returns fallback response when circuit breaker is open', async () => {
    useFallback = true;

    const { executeOnModal } = await import('../src/lib/modal/client.js');
    const result = await executeOnModal(request);

    expect(result.status).toBe('error');
    expect(result.http_status).toBe(503);
    expect(result.error_class).toBe('CIRCUIT_BREAKER_OPEN');
    expect(mockRecordModalResult).toHaveBeenCalled();
  });

  it('captures exception after unexpected errors exhaust retries', async () => {
    spawnQueue.push(
      { kind: 'error', error: new Error('spawn failed') },
      { kind: 'error', error: new Error('spawn failed') },
      { kind: 'error', error: new Error('spawn failed') },
      { kind: 'error', error: new Error('spawn failed') }
    );

    const { executeOnModal } = await import('../src/lib/modal/client.js');
    const result = await executeOnModal(request);

    expect(result.status).toBe('error');
    expect(result.error_class).toBe('UNEXPECTED_ERROR');
    expect(mockErrorsInc).toHaveBeenCalledTimes(4);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).not.toHaveBeenCalledWith('Modal execution failed after all retries');
  }, 20000);
});
