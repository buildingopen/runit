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
    if (isProduction) {
      // This should never happen as env.ts validates SENTRY_DSN in production
      console.error('[Sentry] FATAL: SENTRY_DSN not set in production');
      process.exit(1);
    }
    console.log('[Sentry] Skipping initialization (no DSN configured in development)');
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
    if (isProduction) {
      console.error('[Sentry] FATAL: Failed to initialize in production:', error);
      process.exit(1);
    }
    console.warn('[Sentry] Failed to initialize (development):', error);
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
  } catch {
    // Don't let Sentry errors break the app
  }
}

/**
 * Capture a message with optional level
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentryInitialized) return;

  try {
    Sentry.captureMessage(message, level);
  } catch {
    // Don't let Sentry errors break the app
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(id: string, email?: string): void {
  if (!sentryInitialized) return;

  try {
    Sentry.setUser({ id, email });
  } catch {
    // Ignore
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!sentryInitialized) return;

  try {
    Sentry.setUser(null);
  } catch {
    // Ignore
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
  } catch {
    // Ignore
  }
}
