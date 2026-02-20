import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe('db/supabase', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('detects configuration state', async () => {
    const mod = await import('../src/db/supabase');
    expect(mod.isSupabaseConfigured()).toBe(false);
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    expect(mod.isSupabaseConfigured()).toBe(true);
  });

  it('creates and caches anonymous/service clients', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    process.env.SUPABASE_ANON_KEY = 'anon';
    const anon = { kind: 'anon' };
    const service = { kind: 'service' };
    mockCreateClient.mockReturnValueOnce(anon).mockReturnValueOnce(service);

    const mod = await import('../src/db/supabase');
    expect(mod.getSupabaseClient()).toBe(anon);
    expect(mod.getSupabaseClient()).toBe(anon);
    expect(mod.getServiceSupabaseClient()).toBe(service);
    expect(mod.getServiceSupabaseClient()).toBe(service);
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  it('throws when required env vars are missing', async () => {
    const mod = await import('../src/db/supabase');
    expect(() => mod.getSupabaseClient()).toThrow('SUPABASE_URL');
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    expect(() => mod.getServiceSupabaseClient()).toThrow('service role');
  });

  it('creates token-scoped client with auth header', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    mockCreateClient.mockReturnValue({ kind: 'tokenClient' });
    const mod = await import('../src/db/supabase');

    mod.getSupabaseClientWithToken('jwt-token');
    const options = mockCreateClient.mock.calls[0][2] as { global: { headers: Record<string, string> } };
    expect(options.global.headers.Authorization).toBe('Bearer jwt-token');
  });

  it('reports supabase connectivity status and errors', async () => {
    const mod = await import('../src/db/supabase');
    const notConfigured = await mod.testSupabaseConnection();
    expect(notConfigured.connected).toBe(false);
    expect(notConfigured.error).toBe('Not configured');

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    process.env.SUPABASE_ANON_KEY = 'anon';

    const okClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    };
    mockCreateClient.mockReset().mockReturnValue(okClient);
    const ok = await mod.testSupabaseConnection();
    expect(ok.connected).toBe(true);

    const failingClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ error: { message: 'db down' } }),
        })),
      })),
    };
    mockCreateClient.mockReset().mockReturnValue(failingClient);
    vi.resetModules();
    const mod2 = await import('../src/db/supabase');
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    const fail = await mod2.testSupabaseConnection();
    expect(fail.connected).toBe(false);
    expect(fail.error).toBe('db down');
  });
});
