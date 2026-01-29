/**
 * Integration tests for Context API
 */

import { describe, test, expect, beforeEach } from 'vitest';

// Mock fetch for testing
global.fetch = async (url: string) => {
  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ACME Inc - Enterprise SaaS Solutions</title>
        <meta name="description" content="Leading provider of enterprise software solutions">
        <meta property="og:title" content="ACME Inc">
        <meta property="og:description" content="Enterprise SaaS platform">
      </head>
      <body>
        <h1>Welcome to ACME</h1>
      </body>
    </html>
  `;

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => mockHtml,
  } as Response;
};

describe('Context Fetcher', () => {
  test('should validate context keys for secrets', async () => {
    const { validateContext } = await import('../src/context-fetcher');

    const validContext = {
      company_name: 'ACME',
      industry: 'SaaS',
    };

    const errors = validateContext(validContext);
    expect(errors).toHaveLength(0);
  });

  test('should reject context with secret-like keys', async () => {
    const { validateContext } = await import('../src/context-fetcher');

    const invalidContext = {
      API_KEY: 'sk-1234',
      company_name: 'ACME',
      SECRET_TOKEN: 'abc123',
    };

    const errors = validateContext(invalidContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.key === 'API_KEY')).toBe(true);
    expect(errors.some((e) => e.key === 'SECRET_TOKEN')).toBe(true);
  });

  test('should reject nested secret keys', async () => {
    const { validateContext } = await import('../src/context-fetcher');

    const invalidContext = {
      company: {
        name: 'ACME',
        auth: {
          API_KEY: 'sk-1234',
        },
      },
    };

    const errors = validateContext(invalidContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.key === 'company.auth.API_KEY')).toBe(true);
  });

  test('should fetch and extract metadata from URL', async () => {
    const { fetchContextFromURL } = await import('../src/context-fetcher');

    const result = await fetchContextFromURL('https://example.com', 'test-company');

    expect(result.id).toBeDefined();
    // og:title takes precedence over <title>
    expect(result.data.title).toBe('ACME Inc');
    // og:description takes precedence over meta description
    expect(result.data.description).toBe('Enterprise SaaS platform');
    expect(result.data.url).toBe('https://example.com');
    expect(result.data.fetched_at).toBeDefined();
  });

  test('should reject invalid URLs', async () => {
    const { fetchContextFromURL } = await import('../src/context-fetcher');

    await expect(
      fetchContextFromURL('ftp://example.com', 'test')
    ).rejects.toThrow('Only HTTP and HTTPS URLs are supported');

    await expect(fetchContextFromURL('not-a-url', 'test')).rejects.toThrow(
      'Invalid URL'
    );
  });
});

// Note: Full integration tests with the Hono server would go here
// These tests would start the server and make real HTTP requests
// For now, we're testing the core logic in isolation
