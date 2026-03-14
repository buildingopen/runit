/**
 * Integration tests for one-click deploy endpoint (POST /v1/deploy).
 *
 * Uses REAL: SQLite stores, OpenAPI extraction (Python subprocess), deploy-bridge, deploy-state.
 * Mocks ONLY: auth (inject test user), billing (unlimited tier), supabase (force SQLite path).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Set up isolated temp DB before any module loads
const testDataDir = mkdtempSync(join(tmpdir(), 'runit-test-'));
process.env.RUNIT_DATA_DIR = testDataDir;
process.env.COMPUTE_BACKEND = 'docker';

// Mock features to OSS mode
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

// Force SQLite path (no Supabase)
vi.mock('../../src/db/supabase.js', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
  getServiceSupabaseClient: () => null,
}));

// Mock auth - inject test user
vi.mock('../../src/middleware/auth.js', () => ({
  getAuthContext: (c: any) => c.get('authContext') || { user: null, isAuthenticated: false },
  getAuthUser: (c: any) => {
    const ctx = c.get('authContext');
    if (!ctx?.isAuthenticated || !ctx.user) throw new Error('Not authenticated');
    return ctx.user;
  },
}));

// Mock billing - unlimited tier
vi.mock('../../src/db/billing-store.js', () => ({
  getUserTier: () => Promise.resolve('unlimited'),
  incrementProjectsCount: () => Promise.resolve(),
}));

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

// Import REAL modules (not mocked)
import { Hono } from 'hono';
import oneClickDeploy from '../../src/routes/one-click-deploy.js';
import { closeSQLiteDB } from '../../src/db/sqlite.js';
import * as projectsStore from '../../src/db/projects-store.js';
import * as shareLinksStore from '../../src/db/share-links-store.js';

// Test app
function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('authContext', {
      user: { id: 'test-user-1', email: 'test@test.com', role: 'authenticated' },
      isAuthenticated: true,
    });
    return next();
  });
  app.route('/deploy', oneClickDeploy);
  return app;
}

describe('One-Click Deploy Integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(() => {
    closeSQLiteDB();
    try { rmSync(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('deploys raw Python with typed functions: auto-wraps, creates project in SQLite, returns URL', async () => {
    const code = `
def generate_invoice(client: str, amount: float) -> dict:
    """Generate an invoice for a client."""
    return {"client": client, "amount": amount}
`;
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'invoice-gen' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as any;

    // Response structure
    expect(data.project_id).toBeDefined();
    expect(data.version_id).toBeDefined();
    expect(data.version_hash).toBeDefined();
    expect(data.project_slug).toContain('invoice-gen');
    expect(data.status).toBe('live');

    // Endpoints extracted from real Python
    expect(data.endpoints.length).toBeGreaterThanOrEqual(1);
    const ep = data.endpoints.find((e: any) => e.path === '/generate_invoice');
    expect(ep).toBeDefined();
    expect(ep.method).toBe('POST');

    // Share link created
    expect(data.share_id).toBeDefined();
    expect(data.url).toMatch(/\/s\//);

    // Verify project persisted in SQLite
    const project = await projectsStore.getProject(data.project_id);
    expect(project).not.toBeNull();
    expect(project!.name).toBe('invoice-gen');
    expect(project!.status).toBe('live');
    expect(project!.owner_id).toBe('test-user-1');

    // Verify version persisted
    const versions = await projectsStore.listVersions(data.project_id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
    const matchingVersion = versions.find(v => v.version_hash === data.version_hash);
    expect(matchingVersion).toBeDefined();
    expect(matchingVersion!.version_hash).toBe(data.version_hash);
    expect(versions[0].code_bundle_ref).toBeDefined();
    expect(versions[0].endpoints!.length).toBeGreaterThanOrEqual(1);

    // Verify share link persisted
    const shareLink = await shareLinksStore.getShareLink(data.share_id);
    expect(shareLink).not.toBeNull();
    expect(shareLink!.project_id).toBe(data.project_id);
    expect(shareLink!.target_type).toBe('endpoint_template');
    expect(shareLink!.enabled).toBe(true);
  }, 30000);

  it('deploys FastAPI code without auto-wrapping', async () => {
    const code = `
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/echo")
def echo(data: dict):
    return data
`;
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'fastapi-app' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.status).toBe('live');

    // Should find FastAPI endpoints directly
    expect(data.endpoints.length).toBeGreaterThanOrEqual(2);
    const healthEp = data.endpoints.find((e: any) => e.path === '/health');
    const echoEp = data.endpoints.find((e: any) => e.path === '/echo');
    expect(healthEp).toBeDefined();
    expect(healthEp.method).toBe('GET');
    expect(echoEp).toBeDefined();
    expect(echoEp.method).toBe('POST');
  }, 30000);

  it('detects environment variables in code', async () => {
    const code = `
import os

API_KEY = os.environ.get("STRIPE_API_KEY", "")
DB_URL = os.getenv("DATABASE_URL")

def process_payment(amount: float) -> dict:
    return {"amount": amount, "status": "processed"}
`;
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'payment-processor' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.detected_env_vars).toContain('STRIPE_API_KEY');
    expect(data.detected_env_vars).toContain('DATABASE_URL');
  }, 30000);

  it('deploys multiple functions as separate endpoints', async () => {
    const code = `
def add(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y

def multiply(x: int, y: int) -> int:
    """Multiply two numbers."""
    return x * y

def greet(name: str) -> str:
    return f"Hello {name}"
`;
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'math-utils' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.endpoints.length).toBe(3);

    const paths = data.endpoints.map((e: any) => e.path).sort();
    expect(paths).toEqual(['/add', '/greet', '/multiply']);
  }, 30000);

  it('handles code with no deployable functions gracefully', async () => {
    const code = `
x = 42
print("hello world")
`;
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'no-endpoints' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    // Project created but no endpoints, no deploy, status is draft
    expect(data.project_id).toBeDefined();
    expect(data.endpoints).toEqual([]);
    expect(data.status).toBe('draft');
    expect(data.share_id).toBeNull();
    expect(data.url).toBeNull();
  }, 30000);

  it('handles requirements array in the code bundle', async () => {
    const code = `
import requests

def fetch_url(url: str) -> dict:
    return {"url": url, "status": 200}
`;
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        name: 'url-fetcher',
        requirements: ['requests==2.31.0'],
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.endpoints.length).toBeGreaterThanOrEqual(1);

    // Verify the code bundle stored in version contains requirements.txt
    const versions = await projectsStore.listVersions(data.project_id);
    const bundle = Buffer.from(versions[0].code_bundle_ref, 'base64');
    // ZIP file should contain requirements.txt
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(bundle);
    const entries = zip.getEntries().map(e => e.entryName);
    expect(entries).toContain('requirements.txt');
    const reqContent = zip.getEntry('requirements.txt')!.getData().toString('utf-8');
    expect(reqContent).toContain('requests==2.31.0');
  }, 30000);

  it('returns 400 for missing code', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.error).toContain('code');
  });

  it('returns 400 for missing name', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'print("hi")' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.error).toContain('name');
  });

  it('version hash is deterministic for same code', async () => {
    const code = 'def stable(x: int) -> int:\n    return x * 2';

    const res1 = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'stable-v1' }),
    });
    const res2 = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'stable-v2' }),
    });

    const data1 = await res1.json() as any;
    const data2 = await res2.json() as any;
    expect(data1.version_hash).toBe(data2.version_hash);
    // But different projects
    expect(data1.project_id).not.toBe(data2.project_id);
  }, 30000);
});
