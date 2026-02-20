import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asHonoContext,
  asHonoNext,
  createAnonymousContext,
  createAuthenticatedContext,
  createMockContext,
  createMockNext,
} from '../src/middleware/test-helpers';

const mockGetAuthContext = vi.fn();
const mockGetAuthUser = vi.fn();
const mockIsSupabaseConfigured = vi.fn();
const mockGetServiceSupabaseClient = vi.fn();

vi.mock('../src/middleware/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock('../src/db/supabase', () => ({
  isSupabaseConfigured: (...args: unknown[]) => mockIsSupabaseConfigured(...args),
  getServiceSupabaseClient: (...args: unknown[]) => mockGetServiceSupabaseClient(...args),
}));

function createSupabaseRowResult(data: unknown, error: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data, error }),
        })),
      })),
    })),
  };
}

describe('authorize middleware helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.DEV_MODE;
    process.env.NODE_ENV = 'test';
  });

  it('checkProjectOwnership handles dev-mode bypass when supabase is disabled', async () => {
    const mod = await import('../src/middleware/authorize');
    mockIsSupabaseConfigured.mockReturnValue(false);
    process.env.NODE_ENV = 'development';

    const c = createAuthenticatedContext('u1');
    const result = await mod.checkProjectOwnership(asHonoContext(c), 'p1');
    expect(result.isOwner).toBe(true);
    expect(result.ownerId).toMatch('dev-user');
  });

  it('checkProjectOwnership returns false when unauthenticated or missing project', async () => {
    const mod = await import('../src/middleware/authorize');
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetAuthContext.mockReturnValue({ isAuthenticated: false, user: null });
    const anon = createAnonymousContext();
    expect(await mod.checkProjectOwnership(asHonoContext(anon), 'p1')).toEqual({
      isOwner: false,
      ownerId: null,
    });

    mockGetAuthContext.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(null, { message: 'not found' }));
    const auth = createAuthenticatedContext('u1');
    expect(await mod.checkProjectOwnership(asHonoContext(auth), 'p1')).toEqual({
      isOwner: false,
      ownerId: null,
    });
  });

  it('checkRunOwnership resolves owner and ownership correctly', async () => {
    const mod = await import('../src/middleware/authorize');
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetAuthContext.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });

    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult({ owner_id: 'u1' }));
    const c = createAuthenticatedContext('u1');
    expect(await mod.checkRunOwnership(asHonoContext(c), 'r1')).toEqual({ isOwner: true, ownerId: 'u1' });

    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult({ owner_id: 'u2' }));
    expect(await mod.checkRunOwnership(asHonoContext(c), 'r1')).toEqual({ isOwner: false, ownerId: 'u2' });
  });

  it('requireProjectOwnership enforces 400/404/403/success flow', async () => {
    const mod = await import('../src/middleware/authorize');
    const middleware = mod.requireProjectOwnership('id');
    const next = createMockNext();

    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetAuthContext.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });

    const missing = createMockContext({ params: {} });
    await middleware(asHonoContext(missing), asHonoNext(next));
    expect(missing.json).toHaveBeenCalledWith({ error: 'Project ID is required' }, 400);

    const notFound = createMockContext({ params: { id: 'p1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(null, { message: 'not found' }));
    await middleware(asHonoContext(notFound), asHonoNext(next));
    expect(notFound.json).toHaveBeenCalledWith({ error: 'Project not found' }, 404);

    const forbidden = createMockContext({ params: { id: 'p1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult({ owner_id: 'u2' }));
    await middleware(asHonoContext(forbidden), asHonoNext(next));
    expect(forbidden.json).toHaveBeenCalledWith(
      {
        error: 'Forbidden',
        message: 'You do not have permission to access this project',
      },
      403
    );

    const allowed = createMockContext({ params: { id: 'p1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult({ owner_id: 'u1' }));
    await middleware(asHonoContext(allowed), asHonoNext(next));
    expect(next).toHaveBeenCalled();
  });

  it('requireRunOwnership enforces 400/404/403/success flow', async () => {
    const mod = await import('../src/middleware/authorize');
    const middleware = mod.requireRunOwnership('id');
    const next = createMockNext();

    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetAuthContext.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });

    const missing = createMockContext({ params: {} });
    await middleware(asHonoContext(missing), asHonoNext(next));
    expect(missing.json).toHaveBeenCalledWith({ error: 'Run ID is required' }, 400);

    const notFound = createMockContext({ params: { id: 'r1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(null, { message: 'not found' }));
    await middleware(asHonoContext(notFound), asHonoNext(next));
    expect(notFound.json).toHaveBeenCalledWith({ error: 'Run not found' }, 404);

    const forbidden = createMockContext({ params: { id: 'r1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult({ owner_id: 'u2' }));
    await middleware(asHonoContext(forbidden), asHonoNext(next));
    expect(forbidden.json).toHaveBeenCalledWith(
      {
        error: 'Forbidden',
        message: 'You do not have permission to access this run',
      },
      403
    );

    const allowed = createMockContext({ params: { id: 'r1' } });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult({ owner_id: 'u1' }));
    await middleware(asHonoContext(allowed), asHonoNext(next));
    expect(next).toHaveBeenCalled();
  });

  it('checkShareLinkAccess handles missing, disabled, and enabled links', async () => {
    const mod = await import('../src/middleware/authorize');

    mockIsSupabaseConfigured.mockReturnValue(false);
    expect(await mod.checkShareLinkAccess('s1')).toEqual({ allowed: false, shareLink: null });

    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(null, { message: 'x' }));
    expect(await mod.checkShareLinkAccess('s1')).toEqual({ allowed: false, shareLink: null });

    const disabled = { id: 's1', project_id: 'p1', target_type: 'run', target_ref: 'r1', enabled: false };
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(disabled));
    expect(await mod.checkShareLinkAccess('s1')).toEqual({ allowed: false, shareLink: disabled });

    const enabled = { ...disabled, enabled: true };
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(enabled));
    expect(await mod.checkShareLinkAccess('s1')).toEqual({ allowed: true, shareLink: enabled });
  });

  it('requireShareLinkOrOwnership allows share-link access and checks ownership fallback', async () => {
    const mod = await import('../src/middleware/authorize');
    const middleware = mod.requireShareLinkOrOwnership('id');
    const next = createMockNext();
    mockIsSupabaseConfigured.mockReturnValue(true);

    const shareAllowed = createMockContext({
      params: { share_id: 's1', id: 'p1' },
    });
    mockGetServiceSupabaseClient.mockReturnValue(
      createSupabaseRowResult({
        id: 's1',
        project_id: 'p1',
        target_type: 'run',
        target_ref: 'r1',
        enabled: true,
      })
    );
    await middleware(asHonoContext(shareAllowed), asHonoNext(next));
    expect(next).toHaveBeenCalled();
    expect(shareAllowed.get('shareLink')).toBeTruthy();

    const authRequired = createMockContext({ params: { id: 'p1' } });
    mockGetAuthContext.mockReturnValue({ isAuthenticated: false, user: null });
    mockGetServiceSupabaseClient.mockReturnValue(createSupabaseRowResult(null, { message: 'x' }));
    await middleware(asHonoContext(authRequired), asHonoNext(next));
    expect(authRequired.json).toHaveBeenCalledWith(
      {
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token or use a share link',
      },
      401
    );

    const noProject = createMockContext({ params: {} });
    mockGetAuthContext.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });
    await middleware(asHonoContext(noProject), asHonoNext(next));
    expect(noProject.json).toHaveBeenCalledWith({ error: 'Project ID or share link is required' }, 400);
  });
});
