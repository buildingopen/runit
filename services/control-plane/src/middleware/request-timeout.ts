// ABOUTME: Hono middleware that races request handlers against a configurable timeout (default 30s).
// ABOUTME: Returns 408 on timeout and exposes an AbortSignal on context for downstream abort checking.
/**
 * Request Timeout Middleware
 *
 * Global timeout for all requests to prevent hanging connections.
 * Returns 408 Request Timeout if the request exceeds the configured limit.
 */

import type { Context, Next } from 'hono';

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Request timeout middleware
 * Wraps the request handler with a timeout to prevent hanging connections
 */
export function requestTimeoutMiddleware(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return async function (c: Context, next: Next) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Store abort signal on context for downstream handlers to check
    c.set('abortSignal', controller.signal);

    try {
      // Race between the actual handler and the timeout
      const result = await Promise.race([
        next(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('REQUEST_TIMEOUT'));
          });
        }),
      ]);

      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'REQUEST_TIMEOUT') {
        return c.json(
          {
            error: 'Request Timeout',
            message: `Request exceeded the maximum allowed time of ${timeoutMs / 1000} seconds`,
            code: 'REQUEST_TIMEOUT',
          },
          408
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Check if request has been aborted
 */
export function isRequestAborted(c: Context): boolean {
  const signal = c.get('abortSignal') as AbortSignal | undefined;
  return signal?.aborted ?? false;
}
