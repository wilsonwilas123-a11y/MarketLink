import { createClient, type SupabaseClient } from '@supabase/supabase-js';


export function makeClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

let cached: SupabaseClient | null | undefined;


export function getSupabase(): SupabaseClient | null {
  if (cached === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    cached = url && anonKey ? makeClient(url, anonKey) : null;
  }
  return cached;
}
