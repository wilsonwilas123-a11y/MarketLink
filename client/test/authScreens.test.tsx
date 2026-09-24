import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './helpers/render';
import { ApiError } from '../src/lib/api';
import { customerMe, fakeGateway, fakeGatewayRequiringConfirm, farmerMe } from './helpers/auth';

const me = (body: unknown) => [{ path: '/me', body }];

describe('protected routes', () => {
  it('sends a visitor to sign in and remembers where they were going', async () => {
    const gateway = fakeGateway(null);
    renderApp('/account', { gateway, stubs: me(customerMe) });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText('Email'), 'amaka@marketlink.test');
    await userEvent.type(screen.getByLabelText('Password'), 'grow-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // The point of returnTo: back to the screen they were bounced from.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument(),
    );
  });

  it('keeps a restored session on the dashboard instead of bouncing it to sign in', async () => {
    const gateway = fakeGateway('jwt-restored');
    renderApp('/farmers/dashboard', { gateway, stubs: me(farmerMe) });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Tunde Fresh Produce' })).toBeInTheDocument(),
    );
  });

  it('will not show a farmer’s stall to a customer', async () => {
    const gateway = fakeGateway('jwt-restored');
    renderApp('/farmers/dashboard', { gateway, stubs: me(customerMe) });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Not your area' })).toBeInTheDocument());
    expect(screen.getByText(/signed in as a customer/i)).toBeInTheDocument();
  });

  it('routes a session with no profile to the finish-setup form', async () => {
    const gateway = fakeGateway('jwt-half-signed-up');
    renderApp('/account', {
      gateway,
      stubs: [
        {
          path: '/me',
          status: 401,
          body: { error: { code: 'profile_missing', message: 'no profile yet' } },
        },
      ],
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Finish setting up' })).toBeInTheDocument(),
    );
    expect(gateway.calls).not.toContain('signOut');
  });
});

describe('the farmer’s pending state', () => {
  it('says the stall is awaiting approval, in as many words', async () => {
    const gateway = fakeGateway('jwt-restored');
    renderApp('/farmers/dashboard', { gateway, stubs: me(farmerMe) });

    await waitFor(() => expect(screen.getByText('Awaiting approval')).toBeInTheDocument());
    expect(
      screen.getByText(/market admin is looking at your stall/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Account details' })).toBeInTheDocument();
  });
});

describe('sign in', () => {
  it('signs an existing customer in and lands them on their account', async () => {
    const gateway = fakeGateway(null);
    renderApp('/signin', { gateway, stubs: me(customerMe) });

    await userEvent.type(screen.getByLabelText('Email'), 'amaka@marketlink.test');
    await userEvent.type(screen.getByLabelText('Password'), 'grow-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument(),
    );
    expect(gateway.calls).toContain('signIn:amaka@marketlink.test');
    expect(screen.getByText('Amaka Obi')).toBeInTheDocument();
  });

  it('shows the reason a sign-in failed and stays on the form', async () => {
    const gateway = fakeGateway(null);
    gateway.signIn = async () => {
      throw new ApiError(401, 'unauthenticated', 'Invalid login credentials');
    };
    renderApp('/signin', { gateway, stubs: [] });

    await userEvent.type(screen.getByLabelText('Email'), 'amaka@marketlink.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-one');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /email and password do not match/i,
      ),
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('sign up', () => {
  const fill = async (name: string, phone: string) => {
    await userEvent.type(screen.getByLabelText('Full name'), name);
    await userEvent.type(screen.getByLabelText('Phone number'), phone);
    await userEvent.type(screen.getByLabelText('Email'), `${name.split(' ')[0]}@marketlink.test`);
    await userEvent.type(screen.getByLabelText(/create a password/i), 'grow-2026');
  };

  it('asks what the account is for and sends the answer as the role', async () => {
    const gateway = fakeGateway(null);
    const { requests } = renderApp('/signup', {
      gateway,
      stubs: [
        { method: 'POST', path: '/auth/bootstrap', body: farmerMe.profile },
        ...me(farmerMe),
      ],
    });

    await fill('Tunde Bakare', '08031112222');
    await userEvent.click(screen.getByText('Sell from my stall'));
    expect(
      screen.getByText(/market admin looks at it before shoppers can find it/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Tunde Fresh Produce' })).toBeInTheDocument(),
    );
    expect(requests[0]?.body).toMatchObject({ role: 'farmer', full_name: 'Tunde Bakare' });
  });

  it('refuses to submit a phone number the server would reject', async () => {
    const gateway = fakeGateway(null);
    const { requests } = renderApp('/signup', { gateway });

    await fill('Amaka Obi', '0803');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByText(/number we can call/i)).toBeInTheDocument());
    expect(requests).toEqual([]);
    expect(gateway.calls).toEqual([]);
  });

  it('explains the confirmation email instead of pretending the account exists', async () => {
    const gateway = fakeGatewayRequiringConfirm(null);
    renderApp('/signup', { gateway });

    await fill('Amaka Obi', '08031112222');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Confirm your email' })).toBeInTheDocument(),
    );
    expect(screen.getByText(/amaka@marketlink.test/i)).toBeInTheDocument();
  });
});

describe('finish setup after a stalled signup', () => {
  it('completes bootstrap and opens the stall', async () => {
    const gateway = fakeGateway('jwt-restored');
    const { requests } = renderApp('/complete-profile', {
      gateway,
      stubs: [
        {
          path: '/me',
          status: 401,
          body: { error: { code: 'profile_missing', message: 'no profile yet' } },
        },
        { method: 'POST', path: '/auth/bootstrap', body: farmerMe.profile },
        ...me(farmerMe),
      ],
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Finish setting up' })).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText('Full name'), 'Tunde Bakare');
    await userEvent.type(screen.getByLabelText('Phone number'), '08031112222');
    await userEvent.click(screen.getByText('Sell from my stall'));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Tunde Fresh Produce' })).toBeInTheDocument(),
    );
    expect(requests[1]?.body).toMatchObject({ role: 'farmer' });
    expect(requests[1]?.token).toBe('jwt-restored');
  });
});

describe('the account corner of the nav', () => {
  it('offers joining to a visitor', async () => {
    renderApp('/');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Join' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the signed-in first name and hides the join prompt', async () => {
    const gateway = fakeGateway('jwt-restored');
    renderApp('/', { gateway, stubs: me(customerMe) });

    await waitFor(() => expect(screen.getByRole('link', { name: /Amaka/ })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('nudges a half-created account to finish its profile', async () => {
    const gateway = fakeGateway('jwt-restored');
    renderApp('/', {
      gateway,
      stubs: [
        {
          path: '/me',
          status: 401,
          body: { error: { code: 'profile_missing', message: 'no profile yet' } },
        },
      ],
    });

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Finish your profile' })).toBeInTheDocument(),
    );
  });
});

