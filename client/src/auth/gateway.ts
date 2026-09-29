import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../lib/api';


export interface AuthGateway {
  currentToken: () => Promise<string | null>;
  /** Calls `listener` whenever Supabase changes the session. Returns an unsubscribe. */
  onChange: (listener: (token: string | null) => void) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** `false` means Supabase emailed a confirmation link instead of issuing a session. */
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

/** Supabase's errors are `AuthApiError`; everything else means the request never landed. */
function authError(message: string): ApiError {
  return new ApiError(401, 'unauthenticated', message);
}

function tokenOf(session: Session | null): string | null {
  return session?.access_token ?? null;
}

export function supabaseGateway(client: SupabaseClient): AuthGateway {
  return {
    currentToken: async () => tokenOf((await client.auth.getSession()).data.session),

    onChange: (listener) => {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        // Replaying the stored session is not a change, and the provider reads it on mount.
        if (event === 'INITIAL_SESSION') return;
        listener(tokenOf(session));
      });
      return () => subscription.unsubscribe();
    },

    signIn: async (email, password) => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw authError(error.message);
    },

    signInWithGoogle: async () => {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/signin` },
      });
      if (error) throw authError(error.message);
    },

    signUp: async (email, password) => {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw authError(error.message);
      return data.session !== null;
    },

    signOut: async () => {
      // A website's Sign out button should clear this browser session. Global sign-out
      // calls the auth service to revoke every device and can report a network error even
      // after the local session has already been removed.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw authError(error.message);
    },
  };
}

/**
 * `null` when the build carries no Supabase project, which is how a checkout that has only
 * run the migrations still browses: the auth screens read this and say so instead of
 * rendering a form that cannot work.
 */
export function makeGateway(client: SupabaseClient | null): AuthGateway | null {
  return client ? supabaseGateway(client) : null;
}
