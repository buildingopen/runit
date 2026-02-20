// ABOUTME: Hono request logging middleware: structured JSON in production, color-coded pretty-print in development.
// ABOUTME: Logs method, path, status, duration, user ID (or IP), and assigns a unique request ID per request.
/**
 * Structured Request Logging Middleware
 *
 * Logs HTTP requests with method, path, status, duration, and user info.
 * Uses structured JSON format in production, pretty-print in development.
 */

import type { Context, Next } from 'hono';
import { getAuthContext } from './auth.js';
import { logger } from '../lib/logger.js';

let requestCounter = 0;

function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

/**
 * Production request logging middleware (structured JSON)
 */
export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  if (path === '/health') {
    return next();
  }

  const requestId = generateRequestId();
  c.set('requestId', requestId);

  let error: string | undefined;

  try {
    await next();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const duration_ms = Date.now() - start;
    const status = c.res.status;
    const authContext = getAuthContext(c);
    const userId = authContext.user?.id;

    const context: Record<string, unknown> = {
      requestId,
      method,
      path,
      status,
      duration_ms,
    };

    if (userId) {
      context.userId = userId;
    } else {
      context.ip = getClientIp(c);
    }

    if (error) {
      context.error = error;
    }

    if (status >= 500) {
      logger.error(`${method} ${path} ${status}`, undefined, context);
    } else if (status >= 400) {
      logger.warn(`${method} ${path} ${status}`, context);
    } else {
      logger.info(`${method} ${path} ${status}`, context);
    }
  }
}

/**
 * Development request logging middleware (human-readable)
 */
export async function devLoggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  if (path === '/health') {
    return next();
  }

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  let statusColor = '\x1b[32m'; // green
  if (status >= 400) statusColor = '\x1b[33m'; // yellow
  if (status >= 500) statusColor = '\x1b[31m'; // red

  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(
    `${dim}${new Date().toISOString()}${reset} ${method.padEnd(6)} ${path} ${statusColor}${status}${reset} ${dim}${duration}ms${reset}`
  );
}
