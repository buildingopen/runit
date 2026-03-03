import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asHonoContext, asHonoNext, createMockContext, createMockNext } from '../src/middleware/test-helpers';

const mockIsSupabaseConfigured = vi.fn();
const mockGetSupabaseClient = vi.fn();

vi.mock('../src/db/supabase', () => ({
  isSupabaseConfigured: (...args: unknown[]) => mockIsSupabaseConfigured(...args),
  getSupabaseClient: (...args: unknown[]) => mockGetSupabaseClient(...args),
}));

// Force Supabase auth mode for these tests (they test Supabase JWT behavior)
vi.mock('../src/config/features', () => ({
  features: {
    mode: 'cloud',
    isOSS: false,
    isCloud: true,
    authMode: 'supabase',
    billing: true,
    quotas: true,
    rateLimiting: true,
    ipFiltering: true,
  },
}));

describe('auth middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevMode = process.env.DEV_MODE;
  const originalDevUserId = process.env.DEV_USER_ID;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.DEV_MODE = 'false';
    delete process.env.DEV_USER_ID;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalDevMode === undefined) delete process.env.DEV_MODE;
    else process.env.DEV_MODE = originalDevMode;

    if (originalDevUserId === undefined) delete process.env.DEV_USER_ID;
    else process.env.DEV_USER_ID = originalDevUserId;
  });

  it('fails fast on invalid DEV_MODE at import-time', async () => {
    process.env.DEV_MODE = 'true';
    process.env.NODE_ENV = 'production';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);

    await expect(import('../src/middleware/auth')).rejects.toThrow('exit');
    exitSpy.mockRestore();
  });

  it('fails fast when DEV_MODE=true and DEV_USER_ID missing', async () => {
    process.env.DEV_MODE = 'true';
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_USER_ID;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);

    await expect(import('../src/middleware/auth')).rejects.toThrow('exit');
    exitSpy.mockRestore();
  });

  it('supports dev-mode mock auth when supabase is disabled', async () => {
    process.env.DEV_MODE = 'true';
    process.env.DEV_USER_ID = 'dev-user-1';
    process.env.NODE_ENV = 'development';
    mockIsSupabaseConfigured.mockReturnValue(false);

    const mod = await import('../src/middleware/auth');
    const c = createMockContext({ method: 'POST', path: '/runs' });
    const next = createMockNext();

    await mod.authMiddleware(asHonoContext(c), asHonoNext(next));
    const auth = mod.getAuthContext(asHonoContext(c));
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.id).toBe('dev-user-1');
    expect(next).toHaveBeenCalled();
  });

  it('returns 500 when supabase is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    mockIsSupabaseConfigured.mockReturnValue(false);

    const mod = await import('../src/middleware/auth');
    const c = createMockContext();
    const next = createMockNext();

    await mod.authMiddleware(asHonoContext(c), asHonoNext(next));
    expect(c.json).toHaveBeenCalledWith({ error: 'Server misconfiguration' }, 500);
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps unauthenticated context when bearer token is missing/invalid', async () => {
    mockIsSupabaseConfigured.mockReturnValue(true);
    const mod = await import('../src/middleware/auth');
    const next = createMockNext();

    const cNoHeader = createMockContext();
    await mod.authMiddleware(asHonoContext(cNoHeader), asHonoNext(next));
    expect(mod.getAuthContext(asHonoContext(cNoHeader))).toEqual({ user: null, isAuthenticated: false });

    const cInvalidHeader = createMockContext({ headers: { authorization: 'Basic abc' } });
    await mod.authMiddleware(asHonoContext(cInvalidHeader), asHonoNext(next));
    expect(mod.getAuthContext(asHonoContext(cInvalidHeader))).toEqual({ user: null, isAuthenticated: false });
  });

  it('authenticates valid bearer token via supabase', async () => {
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'u1@test.com', role: 'authenticated' } },
          error: null,
        }),
      },
    });
    const mod = await import('../src/middleware/auth');
    const c = createMockContext({ headers: { authorization: 'Bearer token-123' } });

    await mod.authMiddleware(asHonoContext(c), asHonoNext(createMockNext()));
    const auth = mod.getAuthContext(asHonoContext(c));
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.id).toBe('u1');
    expect(mod.getAuthUser(asHonoContext(c)).id).toBe('u1');
  });

  it('handles supabase auth errors and thrown errors as unauthenticated', async () => {
    mockIsSupabaseConfigured.mockReturnValue(true);
    const mod = await import('../src/middleware/auth');

    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } }),
      },
    });
    const cError = createMockContext({ headers: { authorization: 'Bearer bad' } });
    await mod.authMiddleware(asHonoContext(cError), asHonoNext(createMockNext()));
    expect(mod.getAuthContext(asHonoContext(cError)).isAuthenticated).toBe(false);

    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error('network')),
      },
    });
    const cThrow = createMockContext({ headers: { authorization: 'Bearer throw' } });
    await mod.authMiddleware(asHonoContext(cThrow), asHonoNext(createMockNext()));
    expect(mod.getAuthContext(asHonoContext(cThrow)).isAuthenticated).toBe(false);
  });

  it('enforces and bypasses guards correctly', async () => {
    mockIsSupabaseConfigured.mockReturnValue(true);
    const mod = await import('../src/middleware/auth');
    const next = createMockNext();

    const unauth = createMockContext();
    await mod.requireAuth(asHonoContext(unauth), asHonoNext(next));
    expect(unauth.json).toHaveBeenCalledWith(
      {
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header',
      },
      401
    );

    const auth = createMockContext();
    auth.set('authContext', { isAuthenticated: true, user: { id: 'u1' } });
    await mod.requireAuth(asHonoContext(auth), asHonoNext(next));
    expect(next).toHaveBeenCalled();

    const optional = createMockContext();
    await mod.optionalAuth(asHonoContext(optional), asHonoNext(next));
    expect(next).toHaveBeenCalled();

    const openGuard = mod.createAuthGuard({ required: false, allowShareLinks: false });
    await openGuard(asHonoContext(createMockContext()), asHonoNext(next));
    expect(next).toHaveBeenCalled();

    const shareGuard = mod.createAuthGuard({ required: true, allowShareLinks: true });
    await shareGuard(
      asHonoContext(createMockContext({ params: { share_id: 's1' } })),
      asHonoNext(next)
    );
    expect(next).toHaveBeenCalled();

    const protectedGuard = mod.createAuthGuard({ required: true, allowShareLinks: false });
    const denied = createMockContext();
    await protectedGuard(asHonoContext(denied), asHonoNext(next));
    expect(denied.json).toHaveBeenCalledWith(
      {
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header',
      },
      401
    );
  });
});
