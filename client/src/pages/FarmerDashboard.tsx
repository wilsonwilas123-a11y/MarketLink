import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import type { FarmerStatus } from '../lib/types';

const states: Record<FarmerStatus, { badge: string; tone: 'warn' | 'accent' | 'danger'; heading: string; body: string }> = {
  pending: {
    badge: 'Awaiting approval',
    tone: 'warn',
    heading: 'The market admin is looking at your stall',
    body: 'Approved stalls show up in the market directory and start taking pickup orders. Nothing is wrong — this is the first week every stall goes through.',
  },
  approved: {
    badge: 'Live',
    tone: 'accent',
    heading: 'Your stall is in the directory',
    body: 'Weekly stock, incoming orders and reviews are managed from this screen. They land here as those parts of MarketLink are built.',
  },
  suspended: {
    badge: 'Suspended',
    tone: 'danger',
    heading: 'Your stall is hidden from shoppers',
    body: 'A market admin paused this stall. Ask at the market office, or use the contact page and we will look at it with you.',
  },
};

/**
 * The farmer's own screen. A pending stall is a state people arrive in and worry about, so it
 * is the one this phase has to get right: named, explained, and clear about what happens next.
 */
export default function FarmerDashboard() {
  const { profile, farmer, signOut } = useAuth();

  if (!profile) return null;

  if (!farmer) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold leading-tight">No stall yet</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is a farmer account but has no stall attached to it. The market office can
          add one, or you can start again from the signup page.
        </p>
        <Link
          to="/signup"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-accent px-5 font-semibold text-ink"
        >
          Set up a stall
        </Link>
      </section>
    );
  }

  const state = states[farmer.status];

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Stall</p>
          <h1 className="font-display text-3xl font-bold leading-tight">{farmer.stall_name}</h1>
        </div>
        <span>
          <Badge tone={state.tone}>{state.badge}</Badge>
        </span>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-lg font-semibold">{state.heading}</h2>
        <p className="mt-2 text-sm text-muted">{state.body}</p>

        <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">Contact</dt>
            <dd className="num text-primary">{profile.phone}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">Owner</dt>
            <dd className="text-primary">{profile.full_name}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">Where</dt>
            <dd className="text-primary">{profile.address ?? 'Not given yet'}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          to="/account"
          className="inline-flex h-10 items-center rounded-full border border-line px-5 text-sm text-primary hover:bg-elevated"
        >
          Account details
        </Link>
        <Button variant="danger" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </section>
  );
}
