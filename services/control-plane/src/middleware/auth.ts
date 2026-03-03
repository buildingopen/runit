// ABOUTME: Authentication middleware supporting multiple auth modes: api-key (OSS), supabase JWT (cloud), and dev bypass.
// ABOUTME: In OSS mode with no API_KEY set, auto-authenticates as single-user for local/eval use.

import type { Context, Next } from 'hono';
import { getSupabaseClient, isSupabaseConfigured } from '../db/supabase.js';
import { features } from '../config/features.js';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

const AUTH_CONTEXT_KEY = 'authContext';

// Fixed user ID for single-user OSS mode (no API key set)
const OSS_SINGLE_USER_ID = 'oss-default-user';

/**
 * DEV_MODE Security Validation
 */
function validateDevModeConfiguration(): void {
  const devMode = process.env.DEV_MODE === 'true';
  const nodeEnv = process.env.NODE_ENV;

  if (devMode) {
    if (nodeEnv === 'production') {
      console.error(
        'FATAL: DEV_MODE=true is not allowed when NODE_ENV=production. Shutting down.'
      );
      process.exit(1);
    }

    if (!process.env.DEV_USER_ID) {
      console.error(
        'FATAL: DEV_MODE=true requires DEV_USER_ID environment variable to be set.'
      );
      process.exit(1);
    }

    console.warn(
      '[DEV_MODE] Authentication bypassed. Never use in production!'
    );
    console.warn(`   DEV_USER_ID: ${process.env.DEV_USER_ID}`);
  }
}

validateDevModeConfiguration();

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

/**
 * API key auth: validates Bearer token against API_KEY env var.
 * If API_KEY is not set, auto-authenticates (single-user mode).
 */
function authenticateApiKey(c: Context): AuthContext {
  const apiKey = process.env.API_KEY;

  // No API_KEY configured = single-user auto-auth
  if (!apiKey) {
    return {
      user: { id: OSS_SINGLE_USER_ID, email: 'user@localhost', role: 'authenticated' },
      isAuthenticated: true,
    };
  }

  // API_KEY is set, require a matching Bearer token
  const authHeader = c.req.header('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return { user: null, isAuthenticated: false };
  }

  // Constant-time comparison to prevent timing attacks
  if (token.length !== apiKey.length || !timingSafeEqual(token, apiKey)) {
    return { user: null, isAuthenticated: false };
  }

  return {
    user: { id: OSS_SINGLE_USER_ID, email: 'user@localhost', role: 'authenticated' },
    isAuthenticated: true,
  };
}

/**
 * Constant-time string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Supabase JWT auth. Caller must ensure isSupabaseConfigured() is true.
 */
async function authenticateSupabase(c: Context): Promise<AuthContext> {
  const authHeader = c.req.header('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return { user: null, isAuthenticated: false };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return { user: null, isAuthenticated: false };
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
      },
      isAuthenticated: true,
    };
  } catch {
    return { user: null, isAuthenticated: false };
  }
}

/**
 * Auth middleware - validates credentials and attaches user to context.
 * Mode is determined by features.authMode (api-key or supabase).
 */
export async function authMiddleware(c: Context, next: Next) {
  if (features.authMode === 'api-key') {
    c.set(AUTH_CONTEXT_KEY, authenticateApiKey(c));
    return next();
  }

  // Supabase mode: fail hard if not configured in production
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: Supabase is not configured in production');
      return c.json({ error: 'Server misconfiguration' }, 500);
    }

    // Dev mode bypass
    if (process.env.DEV_MODE === 'true' && process.env.DEV_USER_ID) {
      const devUserId = process.env.DEV_USER_ID;
      console.warn(`[DEV_MODE AUDIT] Mock user request: ${c.req.method} ${c.req.path} | User: ${devUserId}`);
      c.set(AUTH_CONTEXT_KEY, {
        user: { id: devUserId, email: 'dev@localhost', role: 'authenticated' },
        isAuthenticated: true,
      } as AuthContext);
      return next();
    }

    c.set(AUTH_CONTEXT_KEY, { user: null, isAuthenticated: false } as AuthContext);
    return next();
  }

  c.set(AUTH_CONTEXT_KEY, await authenticateSupabase(c));
  return next();
}

/**
 * Get auth context from Hono context
 */
export function getAuthContext(c: Context): AuthContext {
  return c.get(AUTH_CONTEXT_KEY) || { user: null, isAuthenticated: false };
}

/**
 * Get authenticated user from Hono context.
 * Throws if not authenticated.
 */
export function getAuthUser(c: Context): AuthUser {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    throw new Error('User is not authenticated');
  }
  return authContext.user;
}

/**
 * Middleware that requires authentication. Returns 401 if not authenticated.
 */
export async function requireAuth(c: Context, next: Next) {
  const authContext = getAuthContext(c);

  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json(
      {
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header',
      },
      401
    );
  }

  return next();
}

/**
 * Middleware that optionally requires authentication.
 */
export async function optionalAuth(c: Context, next: Next) {
  return next();
}

/**
 * Create a guard for specific routes
 */
export function createAuthGuard(options: {
  required?: boolean;
  allowShareLinks?: boolean;
}) {
  return async (c: Context, next: Next) => {
    const authContext = getAuthContext(c);

    if (!options.required) {
      return next();
    }

    if (options.allowShareLinks) {
      const shareId = c.req.param('share_id') || c.req.query('share_id');
      if (shareId) {
        return next();
      }
    }

    if (!authContext.isAuthenticated || !authContext.user) {
      return c.json(
        {
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token in the Authorization header',
        },
        401
      );
    }

    return next();
  };
}
