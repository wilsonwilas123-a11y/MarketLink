import { describe, expect, it } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, type AuthValue } from '../src/auth/AuthProvider';
import type { AuthGateway } from '../src/auth/gateway';
import type { BootstrapInput } from '../src/lib/types';
import {
  apiFor,
  customerMe,
  customerProfile,
  fakeGateway,
  fakeGatewayRequiringConfirm,
  farmerMe,
  stubFetch,
} from './helpers/auth';

let latest: AuthValue;

function Probe() {
  latest = useAuth();
  return null;
}

type Stubs = Parameters<typeof stubFetch>[0];

function setup(gateway: AuthGateway | null, stubs: Stubs = []) {
  const { fetchImpl, requests } = stubFetch(stubs);
  render(
    <AuthProvider gateway={gateway} api={apiFor(gateway, fetchImpl)}>
      <Probe />
    </AuthProvider>,
  );
  return { requests };
}

const farmDetails: BootstrapInput & { email: string; password: string } = {
  email: 'tunde@marketlink.test',
  password: 'grow-2026',
  full_name: 'Tunde Bakare',
  phone: '+2348031112222',
  role: 'farmer',
  country: 'Nigeria',
};

describe('AuthProvider restore on load', () => {
  it('is signed out with no stored session, and asks the server for nothing', async () => {
    const gateway = fakeGateway(null);
    const { requests } = setup(gateway);

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(requests).toEqual([]);
  });

  it('keeps the session across a reload, which is the phase exit test in miniature', async () => {
    const gateway = fakeGateway('jwt-restored');
    setup(gateway, [{ path: '/me', body: customerMe }]);

    await waitFor(() => expect(latest.status).toBe('ready'));
    expect(latest.profile?.full_name).toBe('Amaka Obi');
    expect(latest.farmer).toBeNull();
  });

  it('says so rather than guessing when the build has no Supabase project', async () => {
    const { requests } = setup(null);

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(latest.configured).toBe(false);
    expect(requests).toEqual([]);
  });

  it('refuses to sign in through a build that cannot reach Supabase', async () => {
    setup(null);
    await waitFor(() => expect(latest.configured).toBe(false));

    let code: string | undefined;
    await act(async () => {
      await latest.signIn('a@b.test', 'pw').catch((err: unknown) => {
        code = (err as { code?: string }).code;
      });
    });

    expect(code).toBe('auth_unavailable');
  });
});

describe('AuthProvider reading /api/me', () => {
  it('routes a valid token with no profile to bootstrap instead of signing out', async () => {
    const gateway = fakeGateway('jwt-half-signed-up');
    setup(gateway, [
      {
        path: '/me',
        status: 401,
        body: {
          error: {
            code: 'profile_missing',
            message: 'This account has no profile yet. Call POST /api/auth/bootstrap first.',
          },
        },
      },
    ]);

    await waitFor(() => expect(latest.status).toBe('profile_needed'));
    expect(gateway.calls).not.toContain('signOut');
  });

  it('ends the session when the server no longer recognises the token', async () => {
    const gateway = fakeGateway('jwt-expired');
    setup(gateway, [
      { path: '/me', status: 401, body: { error: { code: 'unauthenticated', message: 'gone' } } },
    ]);

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(gateway.calls).toContain('signOut');
  });

  it('shows why a deactivated account was signed out', async () => {
    const gateway = fakeGateway('jwt-off');
    setup(gateway, [
      {
        path: '/me',
        status: 403,
        body: { error: { code: 'account_disabled', message: 'This account has been deactivated.' } },
      },
    ]);

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(latest.message).toBe('This account has been deactivated.');
    expect(gateway.calls).toContain('signOut');
  });

  it('reports an error instead of signing out when the API is unreachable', async () => {
    const gateway = fakeGateway('jwt-abc');
    const { requests } = setup(gateway, [{ path: '/me', status: 502, body: '<html>Bad gateway</html>' }]);

    await waitFor(() => expect(latest.status).toBe('error'));
    expect(latest.profile).toBeNull();
    expect(latest.message).toContain('502');
    expect(gateway.calls).not.toContain('signOut');
    expect(requests).toHaveLength(1);
  });
});

describe('AuthProvider signup', () => {
  it('creates the profile and then reads the stall it caused', async () => {
    const gateway = fakeGateway(null);
    const { requests } = setup(gateway, [
      { method: 'POST', path: '/auth/bootstrap', body: farmerMe.profile },
      { path: '/me', body: farmerMe },
    ]);
    await waitFor(() => expect(latest.status).toBe('signed_out'));

    let needsConfirmation: boolean | undefined;
    await act(async () => {
      needsConfirmation = (await latest.signUp(farmDetails)).needsConfirmation;
    });
    await waitFor(() => expect(latest.status).toBe('ready'));

    expect(needsConfirmation).toBe(false);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/auth/bootstrap',
      token: 'a-token',
      body: { full_name: 'Tunde Bakare', phone: '+2348031112222', role: 'farmer' },
    });
    expect(latest.farmer?.status).toBe('pending');
  });

  it('leaves the account alone until a confirmation link is clicked', async () => {
    const gateway = fakeGatewayRequiringConfirm(null);
    const { requests } = setup(gateway);
    await waitFor(() => expect(latest.status).toBe('signed_out'));

    let needsConfirmation: boolean | undefined;
    await act(async () => {
      needsConfirmation = (await latest.signUp(farmDetails)).needsConfirmation;
    });

    expect(needsConfirmation).toBe(true);
    expect(requests).toEqual([]);
    expect(latest.status).toBe('signed_out');
  });

  it('finishes bootstrap for a session that stalled halfway through signup', async () => {
    const gateway = fakeGateway('jwt-restored');
    setup(gateway, [
      {
        path: '/me',
        status: 401,
        body: { error: { code: 'profile_missing', message: 'no profile yet' } },
      },
      { method: 'POST', path: '/auth/bootstrap', body: farmerMe.profile },
      { path: '/me', body: farmerMe },
    ]);
    await waitFor(() => expect(latest.status).toBe('profile_needed'));

    await act(async () => latest.completeBootstrap(farmDetails));
    await waitFor(() => expect(latest.status).toBe('ready'));
    expect(latest.profile?.role).toBe('farmer');
  });
});

describe('AuthProvider sign in and out', () => {
  it('signs in and loads the profile in one action', async () => {
    const gateway = fakeGateway(null);
    setup(gateway, [{ path: '/me', body: customerMe }]);
    await waitFor(() => expect(latest.status).toBe('signed_out'));

    await act(async () => latest.signIn('amaka@marketlink.test', 'pw'));

    expect(gateway.calls).toContain('signIn:amaka@marketlink.test');
    await waitFor(() => expect(latest.status).toBe('ready'));
    expect(latest.profile).toEqual(customerProfile);
  });

  it('clears the profile on sign out', async () => {
    const gateway = fakeGateway('jwt-abc');
    setup(gateway, [{ path: '/me', body: customerMe }]);
    await waitFor(() => expect(latest.status).toBe('ready'));

    await act(async () => latest.signOut());

    expect(latest.status).toBe('signed_out');
    expect(latest.profile).toBeNull();
  });

  it('notices a session that changed in another tab', async () => {
    const gateway = fakeGateway(null);
    setup(gateway, [{ path: '/me', body: customerMe }]);
    await waitFor(() => expect(latest.status).toBe('signed_out'));

    await act(async () => gateway.emit('jwt-from-other-tab'));

    await waitFor(() => expect(latest.status).toBe('ready'));
    expect(latest.profile?.full_name).toBe('Amaka Obi');
  });
});
