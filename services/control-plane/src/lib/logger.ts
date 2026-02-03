/**
 * Structured Logger
 *
 * JSON-formatted logging for production, pretty-print for development.
 * Wraps console methods with structured context (request ID, user ID, project ID).
 */

interface LogContext {
  requestId?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

function formatMessage(level: string, message: string, context?: LogContext): string {
  if (isProduction) {
    return JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  // Pretty format for development
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `[${level.toUpperCase()}] ${message}${ctx}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatMessage('info', message, context));
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatMessage('warn', message, context));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = {
      ...context,
      ...(error instanceof Error
        ? { error: error.message, stack: isProduction ? undefined : error.stack }
        : error != null
          ? { error: String(error) }
          : {}),
    };
    console.error(formatMessage('error', message, errorContext));
  },

  debug(message: string, context?: LogContext) {
    if (!isProduction) {
      console.log(formatMessage('debug', message, context));
    }
  },

  /**
   * Create a child logger with pre-set context
   */
  child(defaultContext: LogContext) {
    return {
      info: (msg: string, ctx?: LogContext) => logger.info(msg, { ...defaultContext, ...ctx }),
      warn: (msg: string, ctx?: LogContext) => logger.warn(msg, { ...defaultContext, ...ctx }),
      error: (msg: string, err?: Error | unknown, ctx?: LogContext) =>
        logger.error(msg, err, { ...defaultContext, ...ctx }),
      debug: (msg: string, ctx?: LogContext) => logger.debug(msg, { ...defaultContext, ...ctx }),
    };
  },
};
