import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../lib/api';
import { homeFor, safeReturnTo } from '../../auth/paths';
import { AuthFrame, AuthUnavailable, FormAlert } from './AuthFrame';
import { PasswordField } from './PasswordField';

export default function SignIn() {
  const { signIn, status, profile, configured } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'ready') {
    return (
      <Navigate
        to={safeReturnTo(params.get('returnTo')) ?? (profile ? homeFor(profile.role) : '/account')}
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

  return (
    <AuthFrame
      title="Sign in"
      note="Your stall, your orders and your details are behind this. Browsing the market is not."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <PasswordField value={password} onChange={setPassword} />

        <Button type="submit" loading={busy} className="w-full">
          {busy ? 'Signing in' : 'Sign in'}
        </Button>

        <p className="text-xs text-muted">
          Nothing is charged here. Orders are paid in person at pickup.
        </p>
      </form>
    </AuthFrame>
  );
}
