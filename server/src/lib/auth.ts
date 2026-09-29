import { createClient, type SupabaseClient } from '@supabase/supabase-js';


export interface AuthSubject {
  id: string;
  email: string | null;
}


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


export function makeSupabaseAdmin(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
