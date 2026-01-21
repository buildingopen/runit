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

  // Skip auth validation if Supabase is not configured (dev mode)
  if (!isSupabaseConfigured()) {
    // In dev mode without Supabase, create a mock user
    if (process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true') {
      authContext.user = {
        id: 'dev-user-00000000-0000-0000-0000-000000000000',
        email: 'dev@localhost',
        role: 'authenticated',
      };
      authContext.isAuthenticated = true;
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
