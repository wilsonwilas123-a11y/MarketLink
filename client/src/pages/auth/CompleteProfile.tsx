import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../lib/api';
import { homeFor } from '../../auth/paths';
import { AuthFrame, AuthUnavailable, FormAlert } from './AuthFrame';
import { DetailsFields, emptyDetails, useDetails } from './DetailsFields';

/**
 * The screen a session lands on when `/api/me` answers `profile_missing`: the sign-in worked
 * and the profile row does not exist, usually because the tab was closed mid-signup.
 */
export default function CompleteProfile() {
  const { completeBootstrap, status, profile, configured } = useAuth();
  const details = useDetails(emptyDetails);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return null;
  if (status === 'ready') return <Navigate to={profile ? homeFor(profile.role) : '/account'} replace />;
  if (status !== 'profile_needed') return <Navigate to="/signin" replace />;

  if (!configured) {
    return (
      <AuthFrame title="Finish setting up" note="This build has no Supabase project to finish setting up against.">
        <AuthUnavailable />
      </AuthFrame>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!details.valid) {
      details.showAllErrors();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await completeBootstrap({
        ...details.values,
        full_name: details.values.full_name.trim(),
        phone: details.values.phone.trim(),
        address: details.values.address.trim(),
        country: details.values.role === 'farmer' ? details.values.country : undefined,
        stall_name: details.values.role === 'farmer' ? details.values.stall_name.trim() : undefined,
      });
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

  return (
    <AuthFrame
      title="Finish setting up"
      note="Your sign-in works. The market still needs a name and a number it can reach you on."
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? <FormAlert>{error}</FormAlert> : null}

        <DetailsFields
          values={details.values}
          errors={details.errors}
          setField={details.setField}
          touch={details.touch}
        />

        <Button type="submit" loading={busy} className="w-full">
          {busy ? 'Saving' : 'Save and continue'}
        </Button>
      </form>
    </AuthFrame>
  );
}
