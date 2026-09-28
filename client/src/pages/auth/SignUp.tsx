import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../lib/api';
import { homeFor } from '../../auth/paths';
import { AuthDivider, AuthFrame, AuthUnavailable, FormAlert, GoogleButton } from './AuthFrame';
import { DetailsFields, emptyDetails, useDetails } from './DetailsFields';
import { PasswordField } from './PasswordField';

interface Credentials {
  email: string;
  password: string;
}

type CredentialErrors = Partial<Record<keyof Credentials, string>>;

/**
 * Deliberately lax about the address itself: Supabase is the authority on what it accepts, and
 * a stricter client rule would reject a working address. This only catches the obvious typo.
 */
function validateCredentials({ email, password }: Credentials): CredentialErrors {
  const errors: CredentialErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
    errors.email = 'Enter an email we can send a confirmation to.';
  if (password.length < 8) errors.password = 'Use at least 8 characters. A line from a song works.';
  return errors;
}

export default function SignUp() {
  const { signUp, signInWithGoogle, status, profile, configured } = useAuth();
  const details = useDetails(emptyDetails);
  const [credentials, setCredentials] = useState<Credentials>({ email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (status === 'ready') return <Navigate to={profile ? homeFor(profile.role) : '/account'} replace />;
  if (status === 'profile_needed') return <Navigate to="/complete-profile" replace />;

  if (!configured) {
    return (
      <AuthFrame
        title="Create an account"
        note="Signing up needs a Supabase project, and this build has none."
      >
        <AuthUnavailable />
      </AuthFrame>
    );
  }

  if (sentTo) {
    return (
      <AuthFrame
        title="Confirm your email"
        note={`We sent a link to ${sentTo}. Open it, then sign in — MarketLink will ask for the few details a stall or an order needs.`}
        footer={
          <Link to="/signin" className="text-accent underline-offset-4 hover:underline">
            Go to sign in
          </Link>
        }
      >
        <p className="text-sm text-muted">
          Nothing was created yet. Until that link is opened, this address is not an account.
        </p>
      </AuthFrame>
    );
  }

  const credentialErrors = validateCredentials(credentials);
  const showCredentialError = (field: keyof Credentials) =>
    touched ? credentialErrors[field] : undefined;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);

    if (Object.keys(credentialErrors).length > 0 || !details.valid) {
      details.showAllErrors();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp({
        ...details.values,
        full_name: details.values.full_name.trim(),
        phone: details.values.phone.trim(),
        address: details.values.address.trim(),
        country: details.values.country,
        stall_name: details.values.role === 'farmer' ? details.values.stall_name.trim() : undefined,
        ...credentials,
        email: credentials.email.trim(),
      });

      if (needsConfirmation) setSentTo(credentials.email.trim());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not reach MarketLink. Nothing was saved — try again.',
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
      setError(err instanceof ApiError ? err.message : 'Google sign-up could not start. Please try again.');
      setGoogleBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Create an account"
      note="Tell us who you are once. Orders, stall pages and pickup messages all read from it."
      footer={
        <>
          Already registered?{' '}
          <Link to="/signin" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <GoogleButton onClick={() => void onGoogle()} loading={googleBusy} />
      <AuthDivider />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <DetailsFields
          values={details.values}
          errors={details.errors}
          setField={details.setField}
          touch={details.touch}
        />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={credentials.email}
          onChange={(event) =>
            setCredentials((current) => ({ ...current, email: event.target.value }))
          }
          error={showCredentialError('email')}
          required
        />

        <PasswordField
          label="Create a password"
          autoComplete="new-password"
          value={credentials.password}
          onChange={(password) => setCredentials((current) => ({ ...current, password }))}
          error={showCredentialError('password')}
        />

        <Button type="submit" loading={busy} loadingIndicator="spinner" className="w-full">
          {busy ? 'Creating your account' : 'Create account'}
        </Button>

        <p className="text-xs text-muted">
          Orders are paid in person at pickup. MarketLink never asks for card details.
        </p>
      </form>
    </AuthFrame>
  );
}
