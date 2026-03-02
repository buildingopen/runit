import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockScope = {
  setExtra: vi.fn(),
};

const mockSentry = {
  init: vi.fn(),
  onUnhandledRejectionIntegration: vi.fn(() => ({ name: 'unhandled-rejection' })),
  withScope: vi.fn((cb: (scope: typeof mockScope) => void) => cb(mockScope)),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
};

vi.mock('@sentry/node', () => mockSentry);

function setEnv(nodeEnv: string, sentryDsn?: string) {
  process.env.NODE_ENV = nodeEnv;
  if (sentryDsn === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = sentryDsn;
  }
}

describe('lib/sentry', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv('test');
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  it('skips initialization when DSN is missing in non-production', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sentry = await import('../src/lib/sentry');

    await sentry.initSentry();

    expect(sentry.isSentryInitialized()).toBe(false);
    expect(mockSentry.init).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Sentry] Skipping initialization (no DSN configured)'
    );

    consoleLogSpy.mockRestore();
  });

  it('initializes sentry when DSN is configured', async () => {
    setEnv('production', 'https://example.com/123');
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sentry = await import('../src/lib/sentry');

    await sentry.initSentry();

    expect(mockSentry.init).toHaveBeenCalledOnce();
    expect(sentry.isSentryInitialized()).toBe(true);
    expect(mockSentry.onUnhandledRejectionIntegration).toHaveBeenCalledOnce();
    expect(consoleLogSpy).toHaveBeenCalledWith('[Sentry] Initialized successfully');

    consoleLogSpy.mockRestore();
  });

  it('logs warning and continues in production when DSN is missing', async () => {
    setEnv('production');
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const sentry = await import('../src/lib/sentry');

    await sentry.initSentry();

    expect(sentry.isSentryInitialized()).toBe(false);
    expect(mockSentry.init).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Sentry] Skipping initialization (no DSN configured - running without error tracking)'
    );

    consoleLogSpy.mockRestore();
  });

  it('captures exception/message/user/breadcrumb after initialization', async () => {
    setEnv('test', 'https://example.com/123');
    const sentry = await import('../src/lib/sentry');

    await sentry.initSentry();

    const err = new Error('boom');
    sentry.captureException(err, { runId: 'r1', attempt: 1 });
    sentry.captureMessage('hello', 'warning');
    sentry.setUser('u1', 'u1@example.com');
    sentry.clearUser();
    sentry.addBreadcrumb('step done', 'run', { lane: 'cpu' });

    expect(mockSentry.withScope).toHaveBeenCalledOnce();
    expect(mockScope.setExtra).toHaveBeenCalledWith('runId', 'r1');
    expect(mockScope.setExtra).toHaveBeenCalledWith('attempt', 1);
    expect(mockSentry.captureException).toHaveBeenCalledWith(err);
    expect(mockSentry.captureMessage).toHaveBeenCalledWith('hello', 'warning');
    expect(mockSentry.setUser).toHaveBeenNthCalledWith(1, { id: 'u1', email: 'u1@example.com' });
    expect(mockSentry.setUser).toHaveBeenNthCalledWith(2, null);
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'step done',
      category: 'run',
      level: 'info',
      data: { lane: 'cpu' },
    });
  });

  it('does nothing for capture helpers when not initialized', async () => {
    const sentry = await import('../src/lib/sentry');

    sentry.captureException(new Error('ignored'));
    sentry.captureMessage('ignored');
    sentry.setUser('u1');
    sentry.clearUser();
    sentry.addBreadcrumb('ignored', 'run');

    expect(mockSentry.captureException).not.toHaveBeenCalled();
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
    expect(mockSentry.setUser).not.toHaveBeenCalled();
    expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('swallows errors in helper methods', async () => {
    setEnv('test', 'https://example.com/123');
    const sentry = await import('../src/lib/sentry');

    await sentry.initSentry();

    mockSentry.captureException.mockImplementation(() => {
      throw new Error('capture fail');
    });
    mockSentry.captureMessage.mockImplementation(() => {
      throw new Error('msg fail');
    });
    mockSentry.setUser.mockImplementation(() => {
      throw new Error('user fail');
    });
    mockSentry.addBreadcrumb.mockImplementation(() => {
      throw new Error('crumb fail');
    });

    expect(() => sentry.captureException(new Error('boom'))).not.toThrow();
    expect(() => sentry.captureMessage('m')).not.toThrow();
    expect(() => sentry.setUser('u')).not.toThrow();
    expect(() => sentry.clearUser()).not.toThrow();
    expect(() => sentry.addBreadcrumb('x', 'cat')).not.toThrow();
  });
});
