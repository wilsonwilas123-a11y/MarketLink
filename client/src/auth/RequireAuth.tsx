import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../lib/types';
import { useAuth } from './AuthProvider';
import { COMPLETE_PROFILE_PATH, signInPath } from './paths';

/**
 * Gate for the screens behind an account.
 *
 * It waits rather than guessing: while `/api/me` is still in flight the gate has no idea
 * whether the visitor is signed in, and redirecting on that assumption is how a reload of a
 * dashboard throws you out to the sign-in page.
 */
export function RequireAuth({ roles, loginPath, children }: { roles?: readonly Role[]; loginPath?: string; children: ReactNode }) {
  const { status, profile } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <CheckingSession />;

  if (status === 'profile_needed') return <Navigate to={COMPLETE_PROFILE_PATH} replace />;

  if (status !== 'ready' || !profile)
    return <Navigate to={loginPath ?? signInPath(location.pathname + location.search)} replace />;

  if (roles && !roles.includes(profile.role)) return <WrongRole role={profile.role} adminLoginPath={loginPath} />;

  return <>{children}</>;
}

function CheckingSession() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-24">
      <p className="text-sm text-muted" role="status">
        Checking your session…
      </p>
      <div className="mt-4 space-y-3" aria-hidden>
        <div className="h-10 w-3/4 animate-pulse rounded-xl bg-elevated" />
        <div className="h-10 w-1/2 animate-pulse rounded-xl bg-elevated" />
      </div>
    </section>
  );
}

const roleLanding: Record<Role, { label: string; to: string }> = {
  customer: { label: 'your dashboard', to: '/account' },
  farmer: { label: 'your stall', to: '/farmers/dashboard' },
  admin: { label: 'the admin queue', to: '/admin' },
};

/**
 * Says why the screen did not open instead of redirecting: a redirect on a role mismatch can
 * bounce a farmer and a customer between two dashboards forever.
 */
function WrongRole({ role, adminLoginPath }: { role: Role; adminLoginPath?: string }) {
  const landing = roleLanding[role];

  return (
    <section className="mx-auto w-full max-w-md px-4 py-24">
      <h1 className="font-display text-2xl font-bold">Not your area</h1>
      <p className="mt-2 text-sm text-muted">
        You are signed in as a {role}. {landing.label} is where your own work is.
      </p>
      <Link
        to={landing.to}
        className="mt-6 inline-flex h-10 items-center rounded-full bg-accent px-5 font-semibold text-on-block"
      >
        Go to {landing.label}
      </Link>
      {adminLoginPath ? <Link to="/admin/signin" className="ml-4 text-sm font-semibold text-accent underline underline-offset-4">Use the admin sign-in</Link> : null}
    </section>
  );
}
