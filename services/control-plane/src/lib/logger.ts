// ABOUTME: Structured logger outputting JSON in production, pretty-printed text in development, with child logger support.
// ABOUTME: Automatically redacts API keys, JWTs, DB URLs, bearer tokens, and sensitive field names from all output.
/**
 * Structured Logger
 *
 * JSON-formatted logging for production, pretty-print for development.
 * Wraps console methods with structured context (request ID, user ID, project ID).
 * Includes automatic redaction of sensitive data.
 */

interface LogContext {
  requestId?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

// Patterns for sensitive data that should be redacted
const SENSITIVE_PATTERNS = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-***REDACTED***' },  // OpenAI
  { pattern: /sk_live_[a-zA-Z0-9]{20,}/g, replacement: 'sk_live_***REDACTED***' },  // Stripe live
  { pattern: /sk_test_[a-zA-Z0-9]{20,}/g, replacement: 'sk_test_***REDACTED***' },  // Stripe test
  { pattern: /pk_live_[a-zA-Z0-9]{20,}/g, replacement: 'pk_live_***REDACTED***' },  // Stripe pk live
  { pattern: /pk_test_[a-zA-Z0-9]{20,}/g, replacement: 'pk_test_***REDACTED***' },  // Stripe pk test
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g, replacement: 'AIza***REDACTED***' },  // Google API
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: 'ghp_***REDACTED***' },  // GitHub PAT
  { pattern: /gho_[a-zA-Z0-9]{36}/g, replacement: 'gho_***REDACTED***' },  // GitHub OAuth
  { pattern: /github_pat_[a-zA-Z0-9_]{59,}/g, replacement: 'github_pat_***REDACTED***' },  // GitHub fine-grained PAT
  { pattern: /xox[baprs]-[a-zA-Z0-9-]+/g, replacement: 'xox_***REDACTED***' },  // Slack tokens
  { pattern: /AKIA[A-Z0-9]{16}/g, replacement: 'AKIA***REDACTED***' },  // AWS Access Key ID
  // AWS Secret Access Key - only redact when it looks like it follows an access key pattern
  { pattern: /(aws_secret_access_key|AWS_SECRET_ACCESS_KEY|secretAccessKey)['":\s=]+[a-zA-Z0-9/+=]{40}/gi, replacement: '$1=***REDACTED***' },

  // Database URLs
  { pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@/gi, replacement: 'postgres://***:***@' },
  { pattern: /mysql:\/\/[^:]+:[^@]+@/gi, replacement: 'mysql://***:***@' },
  { pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi, replacement: 'mongodb://***:***@' },
  { pattern: /redis:\/\/[^:]+:[^@]+@/gi, replacement: 'redis://***:***@' },

  // JWT tokens (don't redact fully, keep structure)
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: 'eyJ***JWT_REDACTED***' },

  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi, replacement: 'Bearer ***REDACTED***' },

  // Email addresses (partial redaction)
  { pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '***@$2' },
];

// Fields that should always be redacted
const SENSITIVE_FIELDS = new Set([
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'authorization',
  'auth',
  'credentials',
  'private_key',
  'privatekey',
  'private-key',
  'access_token',
  'accesstoken',
  'access-token',
  'refresh_token',
  'refreshtoken',
  'refresh-token',
  'client_secret',
  'clientsecret',
  'client-secret',
  'encryption_key',
  'encryptionkey',
  'encryption-key',
  'master_key',
  'masterkey',
  'master-key',
]);

/**
 * Redact sensitive data from a string
 */
function redactString(str: string): string {
  let result = str;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Recursively redact sensitive data from an object
 */
function redactObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';

  if (typeof obj === 'string') {
    return redactString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if this field should be fully redacted
      if (SENSITIVE_FIELDS.has(lowerKey)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactObject(value, depth + 1);
      }
    }
    return result;
  }

  return obj;
}

function formatMessage(level: string, message: string, context?: LogContext): string {
  // Redact the message and context
  const redactedMessage = redactString(message);
  const redactedContext = context ? redactObject(context) as LogContext : undefined;

  if (isProduction) {
    return JSON.stringify({
      level,
      message: redactedMessage,
      timestamp: new Date().toISOString(),
      ...redactedContext,
    });
  }

  // Pretty format for development
  const ctx = redactedContext ? ` ${JSON.stringify(redactedContext)}` : '';
  return `[${level.toUpperCase()}] ${redactedMessage}${ctx}`;
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

/**
 * Redact a value manually (for specific use cases)
 */
export function redact(value: unknown): unknown {
  return redactObject(value);
}
