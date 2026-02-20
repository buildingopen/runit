import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asHonoContext,
  asHonoNext,
  createAnonymousContext,
  createAuthenticatedContext,
  createMockContext,
  createMockNext,
} from '../test-helpers';

const mockGetAuthContext = vi.fn();
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}));

vi.mock('../../lib/logger', () => ({
  logger: mockLogger,
}));

describe('logger middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('skips health endpoint', async () => {
    const { loggerMiddleware } = await import('../logger');
    const c = createMockContext({ path: '/health' });
    const next = createMockNext();
    await loggerMiddleware(asHonoContext(c), asHonoNext(next));
    expect(next).toHaveBeenCalled();
    expect(c.get('requestId')).toBeUndefined();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('logs successful authenticated requests with user id', async () => {
    const { loggerMiddleware } = await import('../logger');
    mockGetAuthContext.mockReturnValue({ user: { id: 'u1' }, isAuthenticated: true });
    const c = createAuthenticatedContext('u1', { path: '/runs', method: 'POST' });
    c.res.status = 201;
    const next = createMockNext();
    await loggerMiddleware(asHonoContext(c), asHonoNext(next));
    expect(next).toHaveBeenCalled();
    expect(c.get('requestId')).toBeTruthy();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('POST /runs 201'),
      expect.objectContaining({ userId: 'u1', status: 201 })
    );
  });

  it('logs warning for 4xx with client IP when anonymous', async () => {
    const { loggerMiddleware } = await import('../logger');
    mockGetAuthContext.mockReturnValue({ user: null, isAuthenticated: false });
    const c = createAnonymousContext('10.0.0.5', { path: '/bad', method: 'GET' });
    c.res.status = 404;
    await loggerMiddleware(asHonoContext(c), asHonoNext(createMockNext()));
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET /bad 404'),
      expect.objectContaining({ ip: '10.0.0.5', status: 404 })
    );
  });

  it('logs error for 5xx', async () => {
    const { loggerMiddleware } = await import('../logger');
    mockGetAuthContext.mockReturnValue({ user: null, isAuthenticated: false });
    const c = createMockContext({
      path: '/explode',
      headers: { 'x-real-ip': '127.0.0.9' },
    });
    c.res.status = 500;
    await loggerMiddleware(asHonoContext(c), asHonoNext(createMockNext()));
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('GET /explode 500'),
      undefined,
      expect.objectContaining({ ip: '127.0.0.9', status: 500 })
    );
  });

  it('captures thrown errors and rethrows', async () => {
    const { loggerMiddleware } = await import('../logger');
    mockGetAuthContext.mockReturnValue({ user: null, isAuthenticated: false });
    const c = createMockContext({ path: '/throws', method: 'PUT' });
    const next = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(loggerMiddleware(asHonoContext(c), asHonoNext(next as never))).rejects.toThrow('boom');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('PUT /throws'),
      expect.objectContaining({ error: 'boom' })
    );
  });
});
