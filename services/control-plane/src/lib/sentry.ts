// ABOUTME: Initializes Sentry error tracking with PII protection; required in production, optional in development.
// ABOUTME: Wraps captureException, captureMessage, user context, and breadcrumbs with safe no-throw guards.
/**
 * Sentry Error Tracking
 *
 * Required in production for error monitoring.
 * In development, Sentry is optional.
 */

import * as Sentry from '@sentry/node';

let sentryInitialized = false;

/**
 * Initialize Sentry error tracking
 * Required in production (validated by env.ts)
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!dsn) {
    console.log(`[Sentry] Skipping initialization (no DSN configured${isProduction ? ' - running without error tracking' : ''})`);
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: isProduction ? 0.1 : 1.0,
      release: `control-plane@${process.env.npm_package_version || '0.1.0'}`,
      integrations: [
        // Capture unhandled promise rejections
        Sentry.onUnhandledRejectionIntegration(),
      ],
      // Don't send PII by default
      sendDefaultPii: false,
      // Attach stack traces to all messages
      attachStacktrace: true,
      // Normalize depth for context
      normalizeDepth: 5,
    });

    sentryInitialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Capture an exception with optional context
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!sentryInitialized) return;

  try {
    if (context) {
      Sentry.withScope((scope) => {
        for (const [key, value] of Object.entries(context)) {
          scope.setExtra(key, value);
        }
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (err) {
    console.warn('[Sentry] captureException failed:', err);
  }
}

/**
 * Capture a message with optional level
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentryInitialized) return;

  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    console.warn('[Sentry] captureMessage failed:', err);
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(id: string, email?: string): void {
  if (!sentryInitialized) return;

  try {
    Sentry.setUser({ id, email });
  } catch (err) {
    console.warn('[Sentry] setUser failed:', err);
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!sentryInitialized) return;

  try {
    Sentry.setUser(null);
  } catch (err) {
    console.warn('[Sentry] clearUser failed:', err);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
  if (!sentryInitialized) return;

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
    });
  } catch (err) {
    console.warn('[Sentry] addBreadcrumb failed:', err);
  }
}
