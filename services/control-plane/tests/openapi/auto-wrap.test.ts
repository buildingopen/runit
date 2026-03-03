// ABOUTME: Integration tests for auto-wrap functionality in zip-extractor.ts
// ABOUTME: Runs real Python subprocess against real ZIP bundles - no mocks.

import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { extractOpenAPIFromZip } from '../../src/lib/openapi/zip-extractor.js';

function createZipBase64(files: Record<string, string>): string {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf-8'));
  }
  return zip.toBuffer().toString('base64');
}

describe('auto-wrap integration', () => {
  it('wraps a plain function with type hints', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
def generate_invoice(client: str, amount: float) -> dict:
    """Generate an invoice for a client."""
    return {"client": client, "amount": amount}
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.auto_wrapped).toBe(true);
    expect(result.entrypoint).toBe('_runit_wrapper:app');
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('POST');
    expect(result.endpoints[0].path).toBe('/generate_invoice');
    expect(result.updated_code_bundle).toBeDefined();
    expect(typeof result.updated_code_bundle).toBe('string');
  }, 30_000);

  it('wraps multiple plain functions, excluding private helpers', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
def add(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y

def greet(name: str) -> str:
    return f"Hello {name}"

def _private_helper():
    pass
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.auto_wrapped).toBe(true);
    expect(result.endpoints.length).toBe(2);

    const paths = result.endpoints.map((e) => e.path).sort();
    expect(paths).toEqual(['/add', '/greet']);

    // _private_helper must not appear
    const allPaths = result.endpoints.map((e) => e.path);
    expect(allPaths).not.toContain('/_private_helper');
  }, 30_000);

  it('wraps async functions', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
async def fetch_data(url: str) -> dict:
    """Fetch data from URL."""
    return {"url": url}
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.auto_wrapped).toBe(true);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('POST');
    expect(result.endpoints[0].path).toBe('/fetch_data');
  }, 30_000);

  it('does NOT auto-wrap FastAPI code', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.auto_wrapped).toBe(false);
    expect(result.entrypoint).toBe('main:app');
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].path).toBe('/health');
  }, 30_000);

  it('throws when no wrappable functions are found', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
x = 42
print("hello")
`,
    });

    // The Python script exits with code 1 when no endpoints are found.
    // The error JSON goes to stdout, but executePythonScript rejects on
    // non-zero exit code using stderr (which may be empty). Either way,
    // the call must reject.
    await expect(extractOpenAPIFromZip(zipB64)).rejects.toThrow();
  }, 30_000);

  it('wraps functions with Optional parameters', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
from typing import Optional

def search(query: str, limit: Optional[int] = None) -> list:
    """Search for items."""
    return []
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.auto_wrapped).toBe(true);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('POST');
    expect(result.endpoints[0].path).toBe('/search');
  }, 30_000);

  it('includes _runit_wrapper.py in the updated code bundle', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
def generate_invoice(client: str, amount: float) -> dict:
    """Generate an invoice for a client."""
    return {"client": client, "amount": amount}
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.updated_code_bundle).toBeDefined();

    // Decode the updated bundle and check for the wrapper file
    const updatedZip = new AdmZip(Buffer.from(result.updated_code_bundle!, 'base64'));
    const entries = updatedZip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('_runit_wrapper.py');

    // The wrapper should contain FastAPI app creation and the endpoint
    const wrapperEntry = updatedZip.getEntry('_runit_wrapper.py');
    expect(wrapperEntry).toBeDefined();
    const wrapperCode = wrapperEntry!.getData().toString('utf-8');
    expect(wrapperCode).toContain('from fastapi import FastAPI');
    expect(wrapperCode).toContain('app = FastAPI');
    expect(wrapperCode).toContain('generate_invoice');

    // Original main.py should also be in the bundle
    expect(entries).toContain('main.py');
  }, 30_000);

  it('detects environment variables in code', async () => {
    const zipB64 = createZipBase64({
      'main.py': `
import os

API_KEY = os.environ.get("STRIPE_API_KEY", "")
DB_URL = os.getenv("DATABASE_URL")

def process(data: str) -> dict:
    return {"data": data}
`,
    });

    const result = await extractOpenAPIFromZip(zipB64);

    expect(result.detected_env_vars).toContain('STRIPE_API_KEY');
    expect(result.detected_env_vars).toContain('DATABASE_URL');
  }, 30_000);
});
