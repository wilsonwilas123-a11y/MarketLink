import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The account behind a bearer token, before we know anything about their profile.
 */
export interface AuthSubject {
  id: string;
  email: string | null;
}

/**
 * Everything `requireAuth` needs from an identity provider. Declared as an interface
 * rather than taken as a SupabaseClient so tests can substitute a stub and never reach
 * the network.
 */
export interface AuthVerifier {
  getUser(token: string): Promise<AuthSubject | null>;
}

export function makeSupabaseAuth(client: SupabaseClient): AuthVerifier {
  return {
    async getUser(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },
  };
}

/**
 * A service-role client. This is the only object in the codebase allowed to bypass row
 * level security, which is why it is built here and nowhere else — one place to grep for
 * when auditing whether the privileged key leaked.
 */
export function makeSupabaseAdmin(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
