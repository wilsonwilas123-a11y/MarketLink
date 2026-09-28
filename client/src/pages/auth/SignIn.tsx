import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../lib/api';
import { homeFor, safeReturnTo } from '../../auth/paths';
import { AuthDivider, AuthFrame, AuthUnavailable, FormAlert, GoogleButton } from './AuthFrame';
import { PasswordField } from './PasswordField';
import { adminApi, saveAdminToken } from '../../auth/adminSession';

const ADMIN_LOGIN_EMAIL = 'wilsontechtechy@gmail.com';

export default function SignIn({ adminMode = false }: { adminMode?: boolean }) {
  const { signIn, signInWithGoogle, signOut, status, profile, configured } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(adminMode ? ADMIN_LOGIN_EMAIL : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  if (adminMode) return <AdminPasswordSignIn />;

  if (status === 'ready') {
    if (adminMode && profile?.role !== 'admin') {
      return (
        <AuthFrame title="Admin access only" note="This account is not assigned the MarketLink admin role." footer={<Link to="/signin" className="text-accent underline-offset-4 hover:underline">Go to regular sign in</Link>}>
          <FormAlert>Ask the system owner to enable the designated admin account.</FormAlert>
          <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => void signOut()}>Sign out to switch account</Button>
        </AuthFrame>
      );
    }
    return (
      <Navigate
        to={adminMode ? '/admin' : safeReturnTo(params.get('returnTo')) ?? (profile ? homeFor(profile.role) : '/account')}
        replace
      />
    );
  }
  if (status === 'profile_needed') return <Navigate to="/complete-profile" replace />;

  if (!configured) {
    return (
      <AuthFrame title="Sign in" note="Signing in needs a Supabase project, and this build has none.">
        <AuthUnavailable />
      </AuthFrame>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    if (adminMode && email.trim().toLowerCase() !== ADMIN_LOGIN_EMAIL) {
      setError(`Use the designated admin email: ${ADMIN_LOGIN_EMAIL}.`);
      setBusy(false);
      return;
    }
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === 'unauthenticated'
            ? 'That email and password do not match. Check both and try again.'
            : err.message
          : 'We could not reach MarketLink. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Google sign-in could not start. Please try again.');
      setGoogleBusy(false);
    }
  }

  return (
    <AuthFrame
      title={adminMode ? 'Admin sign in' : 'Sign in'}
      note={adminMode
        ? 'Private MarketLink operations access. Use the designated administrator account.'
        : 'Sign in with the same email for either account. Buyers go to their shopping dashboard; sellers go to their stall dashboard.'}
      footer={
        adminMode ? <Link to="/" className="text-accent underline-offset-4 hover:underline">Back to MarketLink</Link> : <>
          New here?{' '}
          <Link to="/signup" className="text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      {!adminMode ? <><GoogleButton onClick={() => void onGoogle()} loading={googleBusy} /><AuthDivider /></> : null}
      <form onSubmit={onSubmit} className="space-y-4">

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          readOnly={adminMode}
          required
        />

        <PasswordField value={password} onChange={setPassword} />

        <Button type="submit" loading={busy} loadingIndicator="spinner" className="w-full">
          {busy ? 'Signing in' : 'Sign in'}
        </Button>

        <p className="text-xs text-muted">
          Nothing is charged here. Orders are paid in person at pickup.
        </p>
      </form>
    </AuthFrame>
  );
}

function AdminPasswordSignIn() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await adminApi.post<{ token: string; email: string }>('/admin/session', {
        email: ADMIN_LOGIN_EMAIL,
        password,
      });
      saveAdminToken(session.token, session.email);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0
        ? 'Admin sign-in failed. Check the password and try again.'
        : 'We could not reach MarketLink. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Admin sign in"
      note="Private MarketLink operations access. Use the designated administrator password."
      footer={<Link to="/" className="text-accent underline-offset-4 hover:underline">Back to MarketLink</Link>}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <Input label="Admin email" type="email" value={ADMIN_LOGIN_EMAIL} readOnly required />
        <PasswordField value={password} onChange={setPassword} />
        <Button type="submit" loading={busy} loadingIndicator="spinner" className="w-full">
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </AuthFrame>
  );
}
