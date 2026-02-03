/**
 * Sentry Error Tracking
 *
 * Optional Sentry integration for production error monitoring.
 * Only initializes if SENTRY_DSN is set and @sentry/node is installed.
 */

let sentryInitialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SentryModule: any = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  try {
    // Dynamic import — use variable to prevent TypeScript from resolving at compile time
    const moduleName = '@sentry/node';
    SentryModule = await import(moduleName).catch(() => null);
    if (!SentryModule) {
      console.warn('[Sentry] @sentry/node not installed, skipping error tracking');
      return;
    }

    SentryModule.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      release: `control-plane@${process.env.npm_package_version || '0.1.0'}`,
    });
    sentryInitialized = true;
    console.log('[Sentry] Initialized');
  } catch {
    console.warn('[Sentry] Failed to initialize');
  }
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!sentryInitialized || !SentryModule) return;

  try {
    if (context) {
      SentryModule.withScope((scope: { setExtra: (k: string, v: unknown) => void }) => {
        for (const [key, value] of Object.entries(context)) {
          scope.setExtra(key, value);
        }
        SentryModule.captureException(error);
      });
    } else {
      SentryModule.captureException(error);
    }
  } catch {
    // Don't let Sentry errors break the app
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentryInitialized || !SentryModule) return;

  try {
    SentryModule.captureMessage(message, level);
  } catch {
    // Don't let Sentry errors break the app
  }
}

export function setUser(id: string, email?: string): void {
  if (!sentryInitialized || !SentryModule) return;

  try {
    SentryModule.setUser({ id, email });
  } catch {
    // Ignore
  }
}
