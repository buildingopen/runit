/**
 * ABOUTME: Test utilities for Hono middleware tests
 * ABOUTME: Provides mock Context and Next factories for testing
 */

import { vi } from 'vitest';
import type { Context, Next } from 'hono';

interface MockContextOptions {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  authContext?: {
    user: { id: string; email?: string; role?: string } | null;
    isAuthenticated: boolean;
  };
}

interface MockContext {
  req: {
    method: string;
    path: string;
    header: (name: string) => string | undefined;
    json: () => Promise<unknown>;
    param: (name: string) => string | undefined;
    query: (name: string) => string | undefined;
  };
  set: (key: string, value: unknown) => void;
  get: (key: string) => unknown;
  header: (name: string, value: string) => void;
  json: ReturnType<typeof vi.fn>;
  res: { status: number };
  _contextData: Map<string, unknown>;
  _responseHeaders: Map<string, string>;
}

/**
 * Create a mock Hono Context for testing
 */
export function createMockContext(options: MockContextOptions = {}): MockContext {
  const contextData = new Map<string, unknown>();
  const responseHeaders = new Map<string, string>();

  // Initialize auth context if provided
  if (options.authContext) {
    contextData.set('authContext', options.authContext);
  }

  const mockContext: MockContext = {
    req: {
      method: options.method || 'GET',
      path: options.path || '/',
      header: (name: string) => {
        const normalizedName = name.toLowerCase();
        const headers = options.headers || {};
        // Find header case-insensitively
        for (const [key, value] of Object.entries(headers)) {
          if (key.toLowerCase() === normalizedName) {
            return value;
          }
        }
        return undefined;
      },
      json: () => Promise.resolve(options.body || {}),
      param: (name: string) => options.params?.[name],
      query: (name: string) => options.query?.[name],
    },
    set: (key: string, value: unknown) => contextData.set(key, value),
    get: (key: string) => contextData.get(key),
    header: (name: string, value: string) => responseHeaders.set(name, value),
    json: vi.fn((data: unknown, status = 200) => {
      mockContext.res.status = status;
      return { __response: true, data, status };
    }),
    res: { status: 200 },
    _contextData: contextData,
    _responseHeaders: responseHeaders,
  };

  return mockContext;
}

/**
 * Create a mock Next function for testing
 */
export function createMockNext(): ReturnType<typeof vi.fn> & { wasCalled: () => boolean } {
  const next = vi.fn(() => Promise.resolve()) as ReturnType<typeof vi.fn> & { wasCalled: () => boolean };
  next.wasCalled = () => next.mock.calls.length > 0;
  return next;
}

/**
 * Helper to create an authenticated context
 */
export function createAuthenticatedContext(
  userId: string,
  options: Omit<MockContextOptions, 'authContext'> = {}
): MockContext {
  return createMockContext({
    ...options,
    authContext: {
      user: { id: userId, email: `${userId}@test.com`, role: 'authenticated' },
      isAuthenticated: true,
    },
  });
}

/**
 * Helper to create an anonymous context
 */
export function createAnonymousContext(
  ip: string = '127.0.0.1',
  options: Omit<MockContextOptions, 'authContext'> = {}
): MockContext {
  return createMockContext({
    ...options,
    headers: {
      ...options.headers,
      'x-forwarded-for': ip,
    },
    authContext: {
      user: null,
      isAuthenticated: false,
    },
  });
}

/**
 * Type cast helper to use mock context with Hono middleware
 */
export function asHonoContext(mock: MockContext): Context {
  return mock as unknown as Context;
}

/**
 * Type cast helper to use mock next with Hono middleware
 */
export function asHonoNext(mock: ReturnType<typeof vi.fn>): Next {
  return mock as unknown as Next;
}
