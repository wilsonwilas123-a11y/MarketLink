import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, createApi, type ApiClient } from '../lib/api';
import { getSupabase } from '../lib/supabase';
import type { BootstrapInput, FarmerLink, Me, Profile } from '../lib/types';
import { makeGateway, type AuthGateway } from './gateway';


export type AuthStatus = 'loading' | 'signed_out' | 'profile_needed' | 'ready' | 'error';

export interface SignUpInput extends BootstrapInput {
  email: string;
  password: string;
}

export interface AuthValue {
  status: AuthStatus;
  /** False when this build has no Supabase project, so screens can say so rather than fail. */
  configured: boolean;
  profile: Profile | null;
  farmer: FarmerLink | null;
  message: string | null;
  api: ApiClient;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  completeBootstrap: (input: BootstrapInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads `/api/me` after a profile or stall change elsewhere. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const NOT_CONFIGURED = new ApiError(
  503,
  'auth_unavailable',
  'This build has no Supabase project configured.',
);

function messageFrom(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/** Codes that mean this session is over, matched on the code rather than the wording. */
function endsSession(err: unknown): ApiError | null {
  return err instanceof ApiError && (err.code === 'unauthenticated' || err.code === 'account_disabled')
    ? err
    : null;
}

export interface AuthProviderProps {
  children: ReactNode;
  gateway?: AuthGateway | null;
  api?: ApiClient;
}

export function AuthProvider({
  children,
  gateway: gatewayProp,
  api: apiProp,
}: AuthProviderProps) {
  const gateway = useMemo(
    () => (gatewayProp === undefined ? makeGateway(getSupabase()) : gatewayProp),
    [gatewayProp],
  );

  const api = useMemo(
    () =>
      apiProp ??
      createApi({
        baseUrl: import.meta.env.VITE_API_URL ?? '/api',
        getToken: async () => (gateway ? gateway.currentToken() : null),
      }),
    [apiProp, gateway],
  );

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [farmer, setFarmer] = useState<FarmerLink | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clear = useCallback(() => {
    setProfile(null);
    setFarmer(null);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!gateway) {
      setStatus('signed_out');
      return;
    }
    if ((await gateway.currentToken()) === null) {
      clear();
      setStatus('signed_out');
      return;
    }

    try {
      const me = await api.get<Me>('/me');
      setProfile(me.profile);
      setFarmer(me.farmer);
      setMessage(null);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'profile_missing') {
        clear();
        setStatus('profile_needed');
        return;
      }
      const over = endsSession(err);
      if (over) {
        await gateway.signOut().catch(() => undefined);
        clear();
        // A stale token explains nothing the user can act on; a deactivated account does.
        setMessage(over.code === 'account_disabled' ? over.message : null);
        setStatus('signed_out');
        return;
      }
      clear();
      setMessage(messageFrom(err));
      setStatus('error');
    }
  }, [api, clear, gateway]);

  useEffect(() => {
    if (!gateway) {
      setStatus('signed_out');
      return;
    }

    // Supabase can change the session on its own — a link opened in another tab, a refresh
    // that fails, a sign-out elsewhere. Re-reading `/api/me` is the only way this context
    // learns about it.
    const unsubscribe = gateway.onChange(() => {
      void refresh();
    });
    void refresh();
    return unsubscribe;
  }, [gateway, refresh]);

  const requireGateway = useCallback(() => {
    if (!gateway) throw NOT_CONFIGURED;
    return gateway;
  }, [gateway]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await requireGateway().signIn(email, password);
      await refresh();
    },
    [refresh, requireGateway],
  );

  const signInWithGoogle = useCallback(async () => {
    await requireGateway().signInWithGoogle();
  }, [requireGateway]);

  const bootstrap = useCallback(
    async (input: BootstrapInput) => {
      await api.post<Profile>('/auth/bootstrap', input);
      await refresh();
    },
    [api, refresh],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const { email, password, ...details } = input;
      const signedIn = await requireGateway().signUp(email, password);

      // With email confirmation on, there is no token to bootstrap with yet; the profile is
      // created after the link is followed, and `/api/me` reports `profile_needed`.
      if (!signedIn) return { needsConfirmation: true };

      await bootstrap(details);
      return { needsConfirmation: false };
    },
    [bootstrap, requireGateway],
  );

  const signOut = useCallback(async () => {
    const auth = requireGateway();
    try {
      await auth.signOut();
    } catch (err) {
      // Supabase can remove the browser session and still return a server-side revocation
      // error. Treat that as logged out; only restore auth state if a local token remains.
      if (await auth.currentToken().catch(() => null)) {
        await refresh();
        setMessage(messageFrom(err));
        return;
      }
    }
    clear();
    setMessage(null);
    setStatus('signed_out');
  }, [clear, refresh, requireGateway]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      configured: gateway !== null,
      profile,
      farmer,
      message,
      api,
      signIn,
      signInWithGoogle,
      signUp,
      completeBootstrap: bootstrap,
      signOut,
      refresh,
    }),
    [api, bootstrap, farmer, gateway, message, profile, refresh, signIn, signInWithGoogle, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
