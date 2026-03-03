/**
 * Integration tests for runit.yaml support in the extraction pipeline.
 * Tests that runit.yaml metadata is correctly merged into auto-detected endpoints.
 */
import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { extractOpenAPIFromZip } from '../../src/lib/openapi/zip-extractor.js';

function makeZip(files: Record<string, string>): string {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf-8'));
  }
  return zip.toBuffer().toString('base64');
}

describe('runit.yaml integration with extraction pipeline', () => {
  it('merges runit.yaml summary/description over auto-detected endpoints', async () => {
    const bundle = makeZip({
      'main.py': `
def greet(name: str) -> dict:
    """Say hello."""
    return {"message": f"Hello {name}!"}
`,
      'runit.yaml': `
endpoints:
  greet:
    summary: Greet a person by name
    description: Returns a personalized greeting message
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].path).toBe('/greet');
    expect(result.endpoints[0].summary).toBe('Greet a person by name');
    expect(result.endpoints[0].description).toBe('Returns a personalized greeting message');
  }, 30000);

  it('merges runit.yaml input/output schemas into endpoints', async () => {
    const bundle = makeZip({
      'main.py': `
def add(x: int, y: int) -> int:
    return x + y
`,
      'runit.yaml': `
endpoints:
  POST /add:
    summary: Add two numbers
    inputs:
      type: object
      required: [x, y]
      properties:
        x:
          type: integer
          description: First number
        y:
          type: integer
          description: Second number
    outputs:
      type: object
      properties:
        result:
          type: integer
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].summary).toBe('Add two numbers');
    expect(result.endpoints[0].requestBody).toBeDefined();
    expect(result.endpoints[0].responses).toBeDefined();

    // Verify requestBody structure
    const rb = result.endpoints[0].requestBody as any;
    expect(rb.content['application/json'].schema.required).toEqual(['x', 'y']);
  }, 30000);

  it('adds runit.yaml secrets to detected_env_vars', async () => {
    const bundle = makeZip({
      'main.py': `
import os
API_KEY = os.getenv("OPENAI_KEY")

def run(prompt: str) -> dict:
    return {"result": prompt}
`,
      'runit.yaml': `
secrets:
  - OPENAI_KEY
  - DATABASE_URL
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.detected_env_vars).toContain('OPENAI_KEY');
    expect(result.detected_env_vars).toContain('DATABASE_URL');
  }, 30000);

  it('returns runit_config in extraction result', async () => {
    const bundle = makeZip({
      'main.py': `
def process(text: str) -> dict:
    return {"processed": text}
`,
      'runit.yaml': `
name: text-processor
version: 2
runtime: python3.11
network: true
dependencies:
  - requests==2.31.0
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.runit_config).toBeDefined();
    expect(result.runit_config!.name).toBe('text-processor');
    expect(result.runit_config!.version).toBe(2);
    expect(result.runit_config!.runtime).toBe('python3.11');
    expect(result.runit_config!.network).toBe(true);
    expect(result.runit_config!.dependencies).toEqual(['requests==2.31.0']);
  }, 30000);

  it('works without runit.yaml (backward compatible)', async () => {
    const bundle = makeZip({
      'main.py': `
def hello(name: str) -> dict:
    return {"msg": f"Hi {name}"}
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.endpoints.length).toBe(1);
    expect(result.runit_config).toBeUndefined();
  }, 30000);

  it('uses runit.yaml entrypoint override', async () => {
    const bundle = makeZip({
      'main.py': `
def hello(name: str) -> dict:
    return {"msg": f"Hi {name}"}
`,
      'runit.yaml': `
entrypoint: "main:custom_app"
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.entrypoint).toBe('main:custom_app');
  }, 30000);

  it('handles runit.yml (alternative extension)', async () => {
    const bundle = makeZip({
      'main.py': `
def test(x: int) -> int:
    return x * 2
`,
      'runit.yml': `
name: yml-test
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.runit_config).toBeDefined();
    expect(result.runit_config!.name).toBe('yml-test');
  }, 30000);

  it('merges multiple endpoints from runit.yaml', async () => {
    const bundle = makeZip({
      'main.py': `
def add(x: int, y: int) -> int:
    return x + y

def multiply(x: int, y: int) -> int:
    return x * y
`,
      'runit.yaml': `
endpoints:
  add:
    summary: Add numbers
    lane: cpu
  multiply:
    summary: Multiply numbers
    lane: gpu
    timeout_seconds: 120
`,
    });

    const result = await extractOpenAPIFromZip(bundle);
    expect(result.endpoints.length).toBe(2);

    const addEp = result.endpoints.find(e => e.path === '/add');
    const mulEp = result.endpoints.find(e => e.path === '/multiply');
    expect(addEp!.summary).toBe('Add numbers');
    expect(mulEp!.summary).toBe('Multiply numbers');
  }, 30000);
});
