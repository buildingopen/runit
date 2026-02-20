// ABOUTME: Supabase client singletons (anon + service-role) with timeout-wrapped fetch and connection health testing.
// ABOUTME: Also defines the full Database interface for type-safe queries across all tables.
/**
 * Supabase Client Singleton
 *
 * Provides authenticated and service-role Supabase clients
 * with explicit pool and timeout configuration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables - read lazily to ensure dotenv has loaded
function getEnvVars() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

// Connection pool configuration
const POOL_CONFIG = {
  // Maximum number of connections in the pool (per client type)
  // Supabase client doesn't directly expose pool size, but we can configure fetch timeout
  requestTimeout: 10_000,  // 10s timeout for individual requests
  realtimeTimeout: 30_000, // 30s for realtime connections

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,  // 1s base delay
};

// Singleton instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anonClient: SupabaseClient<any, any, any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serviceClient: SupabaseClient<any, any, any> | null = null;

/**
 * Create Supabase client options with production-ready configuration
 */
function createClientOptions(isServiceRole: boolean = false) {
  return {
    auth: {
      autoRefreshToken: !isServiceRole,  // Auto-refresh for user tokens only
      persistSession: false,  // Don't persist sessions (server-side)
      detectSessionInUrl: false,
    },
    global: {
      fetch: createTimeoutFetch(POOL_CONFIG.requestTimeout),
    },
    db: {
      schema: 'public',
    },
    // Realtime disabled for control-plane (not needed)
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  };
}

/**
 * Create a fetch function with timeout
 */
function createTimeoutFetch(timeoutMs: number) {
  return async (input: URL | Request | string, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnvVars();
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get the anonymous Supabase client
 * Used for operations that respect RLS
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): SupabaseClient<any, any, any> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnvVars();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, createClientOptions(false));
  }

  return anonClient;
}

/**
 * Get the service role Supabase client
 * Used for admin operations that bypass RLS
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getServiceSupabaseClient(): SupabaseClient<any, any, any> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnvVars();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, createClientOptions(true));
  }

  return serviceClient;
}

/**
 * Create a Supabase client with a user's JWT token
 * Used for operations that should respect the user's permissions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClientWithToken(token: string): SupabaseClient<any, any, any> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnvVars();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...createClientOptions(false),
    global: {
      fetch: createTimeoutFetch(POOL_CONFIG.requestTimeout),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Test Supabase connectivity
 * Used for health checks
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    if (!isSupabaseConfigured()) {
      return { connected: false, latencyMs: 0, error: 'Not configured' };
    }

    const supabase = getServiceSupabaseClient();
    const { error } = await supabase.from('projects').select('id').limit(1);

    if (error) {
      return { connected: false, latencyMs: Date.now() - start, error: error.message };
    }

    return { connected: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Database types for type-safe queries
 */
export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          slug: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          slug?: string;
          name?: string;
          updated_at?: string;
        };
      };
      project_versions: {
        Row: {
          id: string;
          project_id: string;
          version_hash: string;
          code_bundle_ref: string;
          openapi: Record<string, unknown> | null;
          endpoints: Record<string, unknown>[] | null;
          deps_hash: string | null;
          base_image_version: string | null;
          entrypoint: string | null;
          installed_packages: Record<string, unknown> | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_hash: string;
          code_bundle_ref: string;
          openapi?: Record<string, unknown> | null;
          endpoints?: Record<string, unknown>[] | null;
          deps_hash?: string | null;
          base_image_version?: string | null;
          entrypoint?: string | null;
          installed_packages?: Record<string, unknown> | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          openapi?: Record<string, unknown> | null;
          endpoints?: Record<string, unknown>[] | null;
          status?: string;
        };
      };
      runs: {
        Row: {
          id: string;
          project_id: string;
          version_id: string;
          endpoint_id: string;
          owner_id: string;
          request_params: Record<string, unknown> | null;
          request_body: Record<string, unknown> | null;
          request_headers: Record<string, unknown> | null;
          request_files: Record<string, unknown> | null;
          response_status: number | null;
          response_body: Record<string, unknown> | null;
          response_content_type: string | null;
          status: string;
          duration_ms: number | null;
          resource_lane: string | null;
          base_image_version: string | null;
          error_class: string | null;
          error_message: string | null;
          suggested_fix: string | null;
          logs: string | null;
          artifacts: Record<string, unknown>[] | null;
          warnings: string[] | null;
          redactions_applied: boolean;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_id: string;
          endpoint_id: string;
          owner_id: string;
          request_params?: Record<string, unknown> | null;
          request_body?: Record<string, unknown> | null;
          request_headers?: Record<string, unknown> | null;
          request_files?: Record<string, unknown> | null;
          status?: string;
          resource_lane?: string | null;
        };
        Update: {
          response_status?: number | null;
          response_body?: Record<string, unknown> | null;
          response_content_type?: string | null;
          status?: string;
          duration_ms?: number | null;
          error_class?: string | null;
          error_message?: string | null;
          suggested_fix?: string | null;
          logs?: string | null;
          artifacts?: Record<string, unknown>[] | null;
          warnings?: string[] | null;
          redactions_applied?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      secrets: {
        Row: {
          id: string;
          project_id: string;
          key: string;
          encrypted_value: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          key: string;
          encrypted_value: string;
          created_by: string;
        };
        Update: {
          encrypted_value?: string;
          updated_at?: string;
        };
      };
      contexts: {
        Row: {
          id: string;
          project_id: string;
          name: string | null;
          url: string;
          data: Record<string, unknown>;
          size_bytes: number;
          fetched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name?: string | null;
          url: string;
          data: Record<string, unknown>;
          size_bytes: number;
          fetched_at?: string;
        };
        Update: {
          name?: string | null;
          data?: Record<string, unknown>;
          size_bytes?: number;
          fetched_at?: string;
          updated_at?: string;
        };
      };
      share_links: {
        Row: {
          id: string;
          project_id: string;
          target_type: string;
          target_ref: string;
          enabled: boolean;
          created_by: string;
          created_at: string;
          run_count: number;
          success_count: number;
          last_run_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          target_type: string;
          target_ref: string;
          enabled?: boolean;
          created_by: string;
        };
        Update: {
          enabled?: boolean;
          run_count?: number;
          success_count?: number;
          last_run_at?: string | null;
        };
      };
    };
  };
}
