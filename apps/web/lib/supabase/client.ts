/**
 * Supabase Browser Client
 *
 * Singleton browser client for client-side Supabase operations.
 */

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Return null when Supabase is not configured (e.g., marketing pages)
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  client = createBrowserClient(url, anonKey);
  return client;
}
