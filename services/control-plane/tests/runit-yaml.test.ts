import { describe, it, expect } from 'vitest';
import { parseRunitYaml, getRequiredSecrets, matchEndpoint } from '../src/lib/runit-yaml.js';

describe('parseRunitYaml', () => {
  it('parses full config with all fields', () => {
    const yaml = `
name: my-project
version: 2
runtime: python3.11
entrypoint: main.py
endpoints:
  POST /generate:
    description: Generate text
    summary: Text generation endpoint
    inputs:
      type: object
      properties:
        prompt:
          type: string
    outputs:
      type: object
      properties:
        text:
          type: string
    lane: gpu
    timeout_seconds: 120
secrets:
  - API_KEY
  - DB_URL
network: true
dependencies:
  - numpy
  - torch
`;
    const config = parseRunitYaml(yaml);
    expect(config).not.toBeNull();
    expect(config!.name).toBe('my-project');
    expect(config!.version).toBe(2);
    expect(config!.runtime).toBe('python3.11');
    expect(config!.entrypoint).toBe('main.py');
    expect(config!.network).toBe(true);
    expect(config!.dependencies).toEqual(['numpy', 'torch']);
    expect(config!.secrets).toEqual(['API_KEY', 'DB_URL']);

    const ep = config!.endpoints!['POST /generate'];
    expect(ep).toBeDefined();
    expect(ep.description).toBe('Generate text');
    expect(ep.summary).toBe('Text generation endpoint');
    expect(ep.lane).toBe('gpu');
    expect(ep.timeout_seconds).toBe(120);
    expect(ep.inputs!.type).toBe('object');
    expect(ep.outputs!.type).toBe('object');
  });

  it('parses minimal config with just secrets list', () => {
    const config = parseRunitYaml('secrets:\n  - TOKEN');
    expect(config).not.toBeNull();
    expect(config!.secrets).toEqual(['TOKEN']);
    expect(config!.name).toBeUndefined();
    expect(config!.endpoints).toBeUndefined();
  });

  it('returns null for empty string', () => {
    expect(parseRunitYaml('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseRunitYaml('   \n  ')).toBeNull();
  });

  it('returns null for invalid YAML', () => {
    expect(parseRunitYaml('{{{')).toBeNull();
  });

  it('returns null for YAML that parses to a scalar', () => {
    expect(parseRunitYaml('just a string')).toBeNull();
  });

  it('returns null for YAML that parses to null', () => {
    expect(parseRunitYaml('null')).toBeNull();
  });

  it('normalizes endpoint keys: "POST /foo"', () => {
    const config = parseRunitYaml(`
endpoints:
  POST /foo:
    description: test
`);
    expect(config!.endpoints).toHaveProperty('POST /foo');
  });

  it('normalizes endpoint keys: "/foo" stays as path-only', () => {
    const config = parseRunitYaml(`
endpoints:
  /foo:
    description: test
`);
    expect(config!.endpoints).toHaveProperty('/foo');
  });

  it('normalizes endpoint keys: bare "foo" becomes "/foo"', () => {
    const config = parseRunitYaml(`
endpoints:
  foo:
    description: test
`);
    expect(config!.endpoints).toHaveProperty('/foo');
  });

  it('normalizes endpoint keys: lowercase method uppercased', () => {
    const config = parseRunitYaml(`
endpoints:
  post /bar:
    description: test
`);
    expect(config!.endpoints).toHaveProperty('POST /bar');
  });

  it('parses secrets as array', () => {
    const config = parseRunitYaml(`
secrets:
  - A
  - B
  - C
`);
    expect(Array.isArray(config!.secrets)).toBe(true);
    expect(config!.secrets).toEqual(['A', 'B', 'C']);
  });

  it('parses secrets as object with required/optional', () => {
    const config = parseRunitYaml(`
secrets:
  API_KEY:
    description: The API key
    required: true
  OPTIONAL_KEY:
    description: Optional
    required: false
`);
    expect(Array.isArray(config!.secrets)).toBe(false);
    const secrets = config!.secrets as Record<string, { description?: string; required?: boolean }>;
    expect(secrets.API_KEY.required).toBe(true);
    expect(secrets.API_KEY.description).toBe('The API key');
    expect(secrets.OPTIONAL_KEY.required).toBe(false);
  });

  it('defaults secret required to true when not specified', () => {
    const config = parseRunitYaml(`
secrets:
  MY_SECRET:
    description: no required field
`);
    const secrets = config!.secrets as Record<string, { required?: boolean }>;
    expect(secrets.MY_SECRET.required).toBe(true);
  });

  it('handles secret object entry with null value', () => {
    const config = parseRunitYaml(`
secrets:
  BARE_SECRET:
`);
    // null value entry is not an object, so it gets { required: true }
    const secrets = config!.secrets as Record<string, { required?: boolean }>;
    expect(secrets).toBeDefined();
  });

  it('parses network as boolean', () => {
    const on = parseRunitYaml('network: true');
    expect(on!.network).toBe(true);

    const off = parseRunitYaml('network: false');
    expect(off!.network).toBe(false);
  });

  it('ignores network if not boolean', () => {
    const config = parseRunitYaml('network: "yes"');
    expect(config!.network).toBeUndefined();
  });

  it('parses dependencies array', () => {
    const config = parseRunitYaml(`
dependencies:
  - flask
  - requests
`);
    expect(config!.dependencies).toEqual(['flask', 'requests']);
  });

  it('parses version as number', () => {
    const config = parseRunitYaml('version: 3');
    expect(config!.version).toBe(3);
  });

  it('parses version as string', () => {
    const config = parseRunitYaml('version: "1.2.0"');
    expect(config!.version).toBe('1.2.0');
  });
});

describe('getRequiredSecrets', () => {
  it('returns all secrets from array (all required)', () => {
    const config = parseRunitYaml(`
secrets:
  - A
  - B
`)!;
    expect(getRequiredSecrets(config)).toEqual(['A', 'B']);
  });

  it('returns only required secrets from object', () => {
    const config = parseRunitYaml(`
secrets:
  KEEP:
    required: true
  SKIP:
    required: false
  DEFAULT:
    description: no required field
`)!;
    const required = getRequiredSecrets(config);
    expect(required).toContain('KEEP');
    expect(required).toContain('DEFAULT');
    expect(required).not.toContain('SKIP');
  });

  it('returns empty array when secrets missing', () => {
    const config = parseRunitYaml('name: test')!;
    expect(getRequiredSecrets(config)).toEqual([]);
  });

  it('returns empty array for empty secrets array', () => {
    const config = parseRunitYaml('secrets: []')!;
    expect(getRequiredSecrets(config)).toEqual([]);
  });
});

describe('matchEndpoint', () => {
  it('"POST /foo" matches method + path', () => {
    expect(matchEndpoint('POST /foo', { method: 'POST', path: '/foo' })).toBe(true);
  });

  it('"POST /foo" does not match wrong method', () => {
    expect(matchEndpoint('POST /foo', { method: 'GET', path: '/foo' })).toBe(false);
  });

  it('"POST /foo" does not match wrong path', () => {
    expect(matchEndpoint('POST /foo', { method: 'POST', path: '/bar' })).toBe(false);
  });

  it('"/foo" matches any method at that path', () => {
    expect(matchEndpoint('/foo', { method: 'GET', path: '/foo' })).toBe(true);
    expect(matchEndpoint('/foo', { method: 'POST', path: '/foo' })).toBe(true);
    expect(matchEndpoint('/foo', { method: 'DELETE', path: '/foo' })).toBe(true);
  });

  it('"/foo" does not match different path', () => {
    expect(matchEndpoint('/foo', { method: 'GET', path: '/bar' })).toBe(false);
  });

  it('"foo" auto-prefixed to "/foo"', () => {
    expect(matchEndpoint('foo', { method: 'POST', path: '/foo' })).toBe(true);
    expect(matchEndpoint('foo', { method: 'GET', path: '/foo' })).toBe(true);
  });

  it('method matching is case insensitive', () => {
    expect(matchEndpoint('post /foo', { method: 'POST', path: '/foo' })).toBe(true);
    expect(matchEndpoint('Post /foo', { method: 'POST', path: '/foo' })).toBe(true);
    expect(matchEndpoint('POST /foo', { method: 'post', path: '/foo' })).toBe(true);
  });

  it('non-matching returns false', () => {
    expect(matchEndpoint('GET /api', { method: 'POST', path: '/other' })).toBe(false);
    expect(matchEndpoint('generate', { method: 'GET', path: '/predict' })).toBe(false);
  });
});
