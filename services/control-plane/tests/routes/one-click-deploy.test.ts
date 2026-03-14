/**
 * Tests for one-click deploy endpoint (POST /v1/deploy)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock features to OSS mode (unlimited tier)
vi.mock('../../src/config/features', () => ({
  features: {
    mode: 'oss',
    isOSS: true,
    isCloud: false,
    authMode: 'api-key',
    billing: false,
    quotas: false,
    rateLimiting: false,
    ipFiltering: false,
  },
}));

// Mock supabase
vi.mock('../../src/db/supabase.js', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
  getServiceSupabaseClient: () => null,
}));

// Mock deploy bridge
const mockRunDeployment = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/lib/deploy-bridge.js', () => ({
  runDeployment: (...args: unknown[]) => mockRunDeployment(...args),
}));

// Mock deploy state
vi.mock('../../src/lib/deploy-state.js', () => ({
  initDeploy: vi.fn(),
  isDeploying: () => false,
  completeDeploy: vi.fn(),
  failDeploy: vi.fn(),
  getDeployState: () => null,
  updateDeployProgress: vi.fn(),
  subscribeToDeploy: vi.fn(),
}));

// Mock OpenAPI extractor
const mockExtractOpenAPI = vi.fn().mockResolvedValue({
  openapi: { openapi: '3.0.0', paths: { '/hello': { post: { summary: 'Say hello' } } } },
  endpoints: [{ id: 'post--hello', method: 'POST', path: '/hello', summary: 'Say hello' }],
  entrypoint: '_runit_wrapper:app',
  detected_env_vars: [],
  auto_wrapped: true,
  updated_code_bundle: 'UEsFake==',
});
vi.mock('../../src/lib/openapi/zip-extractor.js', () => ({
  extractOpenAPIFromZip: (...args: unknown[]) => mockExtractOpenAPI(...args),
}));

// Mock auth
vi.mock('../../src/middleware/auth.js', () => ({
  getAuthContext: (c: any) => c.get('authContext') || { user: null, isAuthenticated: false },
  getAuthUser: (c: any) => {
    const ctx = c.get('authContext');
    if (!ctx?.isAuthenticated || !ctx.user) throw new Error('Not authenticated');
    return ctx.user;
  },
}));

// Mock billing
vi.mock('../../src/db/billing-store.js', () => ({
  getUserTier: () => Promise.resolve('unlimited'),
  incrementProjectsCount: () => Promise.resolve(),
}));

// Mock tiers
vi.mock('../../src/config/tiers.js', () => ({
  getTierLimits: () => ({
    maxProjects: 999999,
    maxRunsPerHour: 999999,
    maxConcurrentRuns: 999999,
    maxGPURunsPerHour: 999999,
    maxConcurrentGPURuns: 999999,
    maxSecretsPerProject: 999999,
    maxContextsPerProject: 999999,
  }),
}));

// Mock validation utils
vi.mock('../../src/lib/validation-utils.js', () => ({
  validateProjectName: (name: string) => {
    if (!name || name.length < 2) return { valid: false, error: 'Name too short' };
    return { valid: true };
  },
  validateBase64: () => ({ valid: true }),
  validateZipMagicBytes: () => ({ valid: true }),
  validateZipDataSize: () => ({ valid: true }),
  validateZipDecompressionSafe: () => ({ valid: true }),
}));

// Import after mocks
import { Hono } from 'hono';
import oneClickDeploy from '../../src/routes/one-click-deploy';

// Create test app
function createApp() {
  const app = new Hono();

  // Attach auth middleware that auto-authenticates
  app.use('/*', async (c, next) => {
    c.set('authContext', {
      user: { id: 'test-user', email: 'test@test.com', role: 'authenticated' },
      isAuthenticated: true,
    });
    return next();
  });

  app.route('/deploy', oneClickDeploy);
  return app;
}

describe('One-Click Deploy (POST /v1/deploy)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('deploys raw Python code and returns URL', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'def hello(name: str) -> dict:\n    return {"message": f"Hello {name}"}',
        name: 'hello-test',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.project_id).toBeDefined();
    expect(data.version_id).toBeDefined();
    expect(data.endpoints).toHaveLength(1);
    expect(data.endpoints[0].path).toBe('/hello');
  });

  it('returns 400 for missing code', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('code');
  });

  it('returns 400 for missing name', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'print("hi")' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('name');
  });

  it('returns 400 for invalid name', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'print("hi")', name: 'x' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('short');
  });

  it('calls runDeployment when endpoints found', async () => {
    await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'def greet(name: str) -> str:\n    return f"Hi {name}"',
        name: 'greet-app',
      }),
    });

    expect(mockRunDeployment).toHaveBeenCalled();
  });

  it('creates share link when endpoints found', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'def calc(x: int, y: int) -> int:\n    return x + y',
        name: 'calculator',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.share_id).toBeDefined();
    expect(data.url).toMatch(/\/s\//);
  });

  it('handles deploy failure gracefully', async () => {
    mockRunDeployment.mockRejectedValueOnce(new Error('Deploy failed'));

    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'def broken(x: int) -> int:\n    return x',
        name: 'broken-app',
      }),
    });

    // Still returns 201, but with failed status
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('failed');
  });

  it('handles requirements array', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'import requests\ndef fetch_url(url: str) -> dict:\n    return {"status": 200}',
        name: 'fetcher',
        requirements: ['requests==2.31.0'],
      }),
    });

    expect(res.status).toBe(201);
  });
});
