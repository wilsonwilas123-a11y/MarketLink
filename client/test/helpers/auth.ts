import type { AuthGateway } from '../../src/auth/gateway';
import { createApi, type ApiClient } from '../../src/lib/api';
import type { Me, Profile } from '../../src/lib/types';

export const customerProfile: Profile = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'customer',
  full_name: 'Amaka Obi',
  phone: '+2348030000000',
  address: null,
  avatar_url: null,
  is_active: true,
  created_at: '2026-09-24T09:00:00.000Z',
  updated_at: '2026-09-24T09:00:00.000Z',
};

export const farmerMe: Me = {
  profile: { ...customerProfile, id: '22222222-2222-4222-8222-222222222222', role: 'farmer', full_name: 'Tunde Bakare' },
  farmer: { id: '33333333-3333-4333-8333-333333333333', stall_name: 'Tunde Fresh Produce', status: 'pending' },
};

export const customerMe: Me = { profile: customerProfile, farmer: null };

/** Recorded so a test can assert what the browser actually sent, not what it meant to. */
export interface RecordedRequest {
  method: string;
  path: string;
  token: string | null;
  body: unknown;
}

interface Stub {
  method?: string;
  path: string;
  status?: number;
  body?: unknown;
}

/**
 * Stubs are consumed in order, because the interesting auth flows are two calls to the same
 * path: bootstrap, then the `/me` reload it triggers. An unmatched call answers 404 so a
 * wrong path fails as a visible status rather than as `undefined` three asserts up.
 */
export function stubFetch(stubs: Stub[]) {
  const requests: RecordedRequest[] = [];
  const queue = [...stubs];

  const fetchImpl: typeof fetch = async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = String(input).replace(/^\/api/, '');
    const headers = new Headers(init?.headers);

    requests.push({
      method,
      path,
      token: headers.get('authorization')?.replace(/^Bearer /, '') ?? null,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });

    const index = queue.findIndex((s) => (s.method ?? 'GET') === method && s.path === path);
    const stub = index === -1 ? undefined : queue.splice(index, 1)[0];

    const status = stub ? (stub.status ?? 200) : 404;
    const body = stub
      ? (stub.body ?? null)
      : { error: { code: 'not_found', message: `No stub for ${method} ${path}` } };

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetchImpl, requests };
}

export interface FakeGateway extends AuthGateway {
  /** Mutable so a test can hand the provider a token before it reads it. */
  token: string | null;
  calls: string[];
  /** Fires the listeners the way `onAuthStateChange` would. */
  emit: (token: string | null) => void;
}

export function fakeGateway(initial: string | null = null): FakeGateway {
  const listeners = new Set<(token: string | null) => void>();
  const gateway: FakeGateway = {
    token: initial,
    calls: [],
    currentToken: async () => gateway.token,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: async (email) => {
      gateway.calls.push(`signIn:${email}`);
      gateway.token = 'a-token';
    },
    signUp: async (email) => {
      gateway.calls.push(`signUp:${email}`);
      gateway.token = 'a-token';
      return true;
    },
    signOut: async () => {
      gateway.calls.push('signOut');
      gateway.token = null;
    },
    emit: (token) => {
      gateway.token = token;
      for (const listener of listeners) listener(token);
    },
  };

  return gateway;
}

/** A gateway whose signUp hands back no session, i.e. email confirmation is switched on. */
export function fakeGatewayRequiringConfirm(initial: string | null = null): FakeGateway {
  const gateway = fakeGateway(initial);
  gateway.signUp = async (email: string) => {
    gateway.calls.push(`signUp:${email}`);
    return false;
  };
  return gateway;
}

export function apiFor(gateway: AuthGateway | null, fetchImpl: typeof fetch): ApiClient {
  return createApi({
    baseUrl: '/api',
    getToken: async () => (gateway ? gateway.currentToken() : null),
    fetchImpl,
  });
}
