/**
 * Supabase Client Singleton
 *
 * Provides authenticated and service-role Supabase clients
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Singleton instances
let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get the anonymous Supabase client
 * Used for operations that respect RLS
 */
export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });
  }

  return anonClient;
}

/**
 * Get the service role Supabase client
 * Used for admin operations that bypass RLS
 */
export function getServiceSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

/**
 * Create a Supabase client with a user's JWT token
 * Used for operations that should respect the user's permissions
 */
export function getSupabaseClientWithToken(token: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
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
