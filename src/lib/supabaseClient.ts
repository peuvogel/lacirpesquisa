import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/** Browser client for catalog metrics (anon RLS). Null when env is missing. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  // Unit tests use local packs; never open a live Supabase socket in vitest.
  if (import.meta.env.MODE === 'test') return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
