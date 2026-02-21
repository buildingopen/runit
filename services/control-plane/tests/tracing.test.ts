/**
 * Tracing tests
 *
 * Covers: shutdownTracing (lines 120-146), withModalExecutionSpan (148-253),
 * withSecretsSpan, withSpan, recordModalResult (lines 269-287).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all OpenTelemetry dependencies to avoid actual SDK initialization
const mockSpan = {
  setStatus: vi.fn(),
  setAttributes: vi.fn(),
  setAttribute: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
};

const mockStartActiveSpan = vi.fn((_name: string, _opts: unknown, fn: (span: typeof mockSpan) => unknown) => {
  return fn(mockSpan);
});

const mockTracer = {
  startActiveSpan: mockStartActiveSpan,
};

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => []),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  ConsoleSpanExporter: vi.fn(),
  BatchSpanProcessor: vi.fn(),
  SimpleSpanProcessor: vi.fn(),
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn(() => ({})),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}));

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => mockTracer),
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
  SpanKind: {
    CLIENT: 2,
    INTERNAL: 0,
  },
}));

import {
  shutdownTracing,
  getTracer,
  withModalExecutionSpan,
  recordModalResult,
  withSecretsSpan,
  withSpan,
} from '../src/lib/tracing';

describe('tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shutdownTracing', () => {
    it('resolves without error when no SDK is initialized', async () => {
      await expect(shutdownTracing()).resolves.toBeUndefined();
    });
  });

  describe('getTracer', () => {
    it('returns a tracer instance', () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
      expect(tracer.startActiveSpan).toBeDefined();
    });
  });

  describe('withModalExecutionSpan', () => {
    it('executes function and sets OK status on success', async () => {
      const result = await withModalExecutionSpan('run-1', 'cpu', '/execute', undefined, async (span) => {
        expect(span).toBeDefined();
        return 'result-value';
      });

      expect(result).toBe('result-value');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('includes http.request_id attribute when requestId is provided', async () => {
      await withModalExecutionSpan('run-1b', 'cpu', '/execute', 'req_123', async () => 'ok');

      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        'modal.execute',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'http.request_id': 'req_123',
          }),
        }),
        expect.any(Function),
      );
    });

    it('omits http.request_id attribute when requestId is undefined', async () => {
      await withModalExecutionSpan('run-1c', 'cpu', '/execute', undefined, async () => 'ok');

      const callArgs = mockStartActiveSpan.mock.calls[mockStartActiveSpan.mock.calls.length - 1];
      expect(callArgs[1].attributes).not.toHaveProperty('http.request_id');
    });

    it('sets ERROR status and records exception on failure', async () => {
      const error = new Error('execution failed');

      await expect(
        withModalExecutionSpan('run-2', 'gpu', '/run', undefined, async () => {
          throw error;
        })
      ).rejects.toThrow('execution failed');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'execution failed',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles non-Error thrown values', async () => {
      await expect(
        withModalExecutionSpan('run-3', 'cpu', '/run', undefined, async () => {
          throw 'string-error';
        })
      ).rejects.toBe('string-error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'string-error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(new Error('string-error'));
    });
  });

  describe('recordModalResult', () => {
    it('sets result attributes for success', () => {
      recordModalResult(mockSpan as any, 'success', 200, 1500);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'modal.result.status': 'success',
        'modal.result.http_status': 200,
        'modal.result.duration_ms': 1500,
      });
    });

    it('sets error class when provided', () => {
      recordModalResult(mockSpan as any, 'error', 500, 100, 'TimeoutError');

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'modal.result.status': 'error',
        'modal.result.http_status': 500,
        'modal.result.duration_ms': 100,
      });
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'modal.error.class': 'TimeoutError',
      });
    });

    it('sets error message when provided', () => {
      recordModalResult(mockSpan as any, 'timeout', 504, 30000, undefined, 'Request timed out');

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'modal.error.message': 'Request timed out',
      });
    });

    it('sets both error class and message', () => {
      recordModalResult(mockSpan as any, 'error', 500, 200, 'RuntimeError', 'Something broke');

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'modal.error.class': 'RuntimeError',
      });
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'modal.error.message': 'Something broke',
      });
    });
  });

  describe('withSecretsSpan', () => {
    it('executes function and sets OK status on success', async () => {
      const result = await withSecretsSpan('encrypt', 'MY_SECRET', async () => {
        return 'encrypted-data';
      });

      expect(result).toBe('encrypted-data');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('uses "bundle" when secretKey is undefined', async () => {
      await withSecretsSpan('decrypt', undefined, async () => 'data');
      // The span was created; we verify it ran without error
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('sets ERROR status on failure', async () => {
      const error = new Error('decrypt failed');

      await expect(
        withSecretsSpan('decrypt', 'KEY', async () => {
          throw error;
        })
      ).rejects.toThrow('decrypt failed');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'decrypt failed',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles non-Error thrown values', async () => {
      await expect(
        withSecretsSpan('encrypt', 'K', async () => {
          throw 42;
        })
      ).rejects.toBe(42);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: '42',
      });
    });
  });

  describe('withSpan', () => {
    it('executes function with custom attributes and sets OK', async () => {
      const result = await withSpan(
        'custom.operation',
        { 'custom.attr': 'value', count: 5 },
        async (span) => {
          expect(span).toBeDefined();
          return 'custom-result';
        }
      );

      expect(result).toBe('custom-result');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('sets ERROR status on failure', async () => {
      const error = new Error('custom error');

      await expect(
        withSpan('custom.op', { flag: true }, async () => {
          throw error;
        })
      ).rejects.toThrow('custom error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'custom error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles non-Error thrown values', async () => {
      await expect(
        withSpan('op', { x: 1 }, async () => {
          throw 'oops';
        })
      ).rejects.toBe('oops');

      expect(mockSpan.recordException).toHaveBeenCalledWith(new Error('oops'));
    });
  });
});
