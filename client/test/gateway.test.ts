import { describe, expect, it } from 'vitest';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../src/lib/supabase';
import { ApiError } from '../src/lib/api';
import { makeGateway, supabaseGateway } from '../src/auth/gateway';

/**
 * The adapter is the one place the real Supabase shape is touched, so it is worth pinning:
 * a drift here would only show up as "sign-in does nothing" in a live walkthrough.
 */
function fakeClient(session: Session | null, failure: { message: string } | null = null) {
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();

  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb: (event: AuthChangeEvent, session: Session | null) => void) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword: async () =>
        failure ? { data: { session: null }, error: failure } : { data: { session }, error: null },
      signUp: async () =>
        failure ? { data: { session: null }, error: failure } : { data: { session }, error: null },
      signOut: async () => ({ error: null }),
    },
  };

  return { client: client as unknown as SupabaseClient, listeners };
}

const session = { access_token: 'jwt-live' } as Session;

describe('supabaseGateway', () => {
  it('hands over the access token and nothing else', async () => {
    const { client } = fakeClient(session);
    await expect(supabaseGateway(client).currentToken()).resolves.toBe('jwt-live');
  });

  it('reports no token when Supabase holds no session', async () => {
    const { client } = fakeClient(null);
    await expect(supabaseGateway(client).currentToken()).resolves.toBeNull();
  });

  it('turns a rejected password into the same error shape as the API', async () => {
    const { client } = fakeClient(null, { message: 'Invalid login credentials' });
    const err = await supabaseGateway(client)
      .signIn('tunde@marketlink.test', 'wrong')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'unauthenticated', message: 'Invalid login credentials' });
  });

  it('says whether signup produced a session or only an email', async () => {
    await expect(supabaseGateway(fakeClient(session).client).signUp('a@b.test', 'pw')).resolves.toBe(true);
    await expect(supabaseGateway(fakeClient(null).client).signUp('a@b.test', 'pw')).resolves.toBe(false);
  });

  it('forwards real session changes but not the replay on subscribe', async () => {
    const { client, listeners } = fakeClient(session);
    const seen: (string | null)[] = [];
    const unsubscribe = supabaseGateway(client).onChange((token) => seen.push(token));

    for (const cb of listeners) cb('INITIAL_SESSION', session);
    expect(seen).toEqual([]);

    for (const cb of listeners) cb('SIGNED_OUT', null);
    expect(seen).toEqual([null]);

    unsubscribe();
    expect(listeners.size).toBe(0);
  });
});

describe('makeGateway', () => {
  it('is null without a client, which is how a project-less build stays browsable', () => {
    expect(makeGateway(null)).toBeNull();
    expect(getSupabase()).toBeNull();
  });
});
