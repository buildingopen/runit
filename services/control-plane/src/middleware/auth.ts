/**
 * Authentication Middleware
 *
 * JWT validation via Supabase Auth
 */

import type { Context, Next } from 'hono';
import { getSupabaseClient, isSupabaseConfigured } from '../db/supabase.js';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

// Key for storing auth context in Hono's context
const AUTH_CONTEXT_KEY = 'authContext';

/**
 * DEV_MODE Security Validation
 * Runs once on module load to validate dev mode configuration
 */
function validateDevModeConfiguration(): void {
  const devMode = process.env.DEV_MODE === 'true';
  const nodeEnv = process.env.NODE_ENV;

  if (devMode) {
    // CRITICAL: Fail fast if DEV_MODE is enabled in production
    if (nodeEnv === 'production') {
      console.error(
        'FATAL: DEV_MODE=true is not allowed when NODE_ENV=production. ' +
          'This is a critical security violation. Shutting down.'
      );
      process.exit(1);
    }

    // Require explicit DEV_USER_ID to prevent accidental anonymous access
    if (!process.env.DEV_USER_ID) {
      console.error(
        'FATAL: DEV_MODE=true requires DEV_USER_ID environment variable to be set. ' +
          'This prevents anonymous mock user creation.'
      );
      process.exit(1);
    }

    // Emit startup warning
    console.warn(
      '⚠️  DEV_MODE enabled - authentication bypassed. Never use in production!'
    );
    console.warn(`   DEV_USER_ID: ${process.env.DEV_USER_ID}`);
    console.warn(`   NODE_ENV: ${nodeEnv || 'not set'}`);
  }
}

// Run validation on module load
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
 * Auth middleware - validates JWT and attaches user to context
 * Does NOT block unauthenticated requests (use requireAuth for that)
 */
export async function authMiddleware(c: Context, next: Next) {
  // Initialize auth context as unauthenticated
  const authContext: AuthContext = {
    user: null,
    isAuthenticated: false,
  };

  // In production, Supabase MUST be configured
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: Supabase is not configured in production');
      return c.json({ error: 'Server misconfiguration' }, 500);
    }

    // Dev mode only: create a mock user when Supabase is unavailable
    // Note: DEV_MODE validation happens at module load (validateDevModeConfiguration)
    if (process.env.DEV_MODE === 'true' && process.env.DEV_USER_ID) {
      const devUserId = process.env.DEV_USER_ID;
      authContext.user = {
        id: devUserId,
        email: 'dev@localhost',
        role: 'authenticated',
      };
      authContext.isAuthenticated = true;

      // Audit log for every request using mock user
      console.warn(
        `[DEV_MODE AUDIT] Mock user request: ${c.req.method} ${c.req.path} | User: ${devUserId} | Time: ${new Date().toISOString()}`
      );
    }
    c.set(AUTH_CONTEXT_KEY, authContext);
    return next();
  }

  // Extract token from Authorization header
  const authHeader = c.req.header('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    c.set(AUTH_CONTEXT_KEY, authContext);
    return next();
  }

  try {
    // Validate the JWT using Supabase
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      // Invalid token - treat as unauthenticated
      c.set(AUTH_CONTEXT_KEY, authContext);
      return next();
    }

    // Valid token - attach user to context
    authContext.user = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
    };
    authContext.isAuthenticated = true;
    c.set(AUTH_CONTEXT_KEY, authContext);
  } catch (err) {
    // On error, treat as unauthenticated
    console.error('Auth middleware error:', err);
    c.set(AUTH_CONTEXT_KEY, authContext);
  }

  return next();
}

/**
 * Get auth context from Hono context
 */
export function getAuthContext(c: Context): AuthContext {
  return c.get(AUTH_CONTEXT_KEY) || { user: null, isAuthenticated: false };
}

/**
 * Get authenticated user from Hono context
 * Throws if not authenticated
 */
export function getAuthUser(c: Context): AuthUser {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    throw new Error('User is not authenticated');
  }
  return authContext.user;
}

/**
 * Middleware that requires authentication
 * Returns 401 if not authenticated
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
 * Middleware that optionally requires authentication
 * Passes through but attaches user if available
 */
export async function optionalAuth(c: Context, next: Next) {
  // Auth middleware already handles this - just continue
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

    // If auth is not required, continue
    if (!options.required) {
      return next();
    }

    // Check for share link access
    if (options.allowShareLinks) {
      const shareId = c.req.param('share_id') || c.req.query('share_id');
      if (shareId) {
        // Share link access - continue without auth
        return next();
      }
    }

    // Require authentication
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
