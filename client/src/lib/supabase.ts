import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser-side Supabase client, and the reason the anon key is the only key here.
 *
 * The service-role key bypasses row-level security, so it lives in `server/.env` and never
 * enters this bundle. Anything the browser can do with the anon key is limited by the same
 * policies the server's queries pass through.
 */
export function makeClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

let cached: SupabaseClient | null | undefined;

/**
 * `null` when the build carries no Supabase project, which is the normal state for a clone
 * that has only run the migrations. Browsing stays possible; the auth screens say so.
 */
export function getSupabase(): SupabaseClient | null {
  if (cached === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    cached = url && anonKey ? makeClient(url, anonKey) : null;
  }
  return cached;
}
