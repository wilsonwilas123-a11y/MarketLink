import { Link } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../auth/AuthProvider';

/**
 * The account screen. Orders, favourites and address editing arrive with their own phases;
 * what is true today is who you are signed in as, and how you leave that state.
 */
export default function Account() {
  const { profile, signOut } = useAuth();

  if (!profile) return null;

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold leading-tight">Your account</h1>

      <Card className="mt-6">
        <div className="flex items-center gap-4 border-b border-line p-5">
          <Avatar src={profile.avatar_url} size={48} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{profile.full_name}</p>
            <p className="num truncate text-sm text-muted">{profile.phone}</p>
          </div>
          <span className="ml-auto">
            <Badge tone={profile.role === 'farmer' ? 'accent' : 'muted'}>{profile.role}</Badge>
          </span>
        </div>

        <dl className="divide-y divide-line text-sm">
          <div className="flex gap-4 px-5 py-3">
            <dt className="w-28 shrink-0 text-muted">Where you are</dt>
            <dd className="text-primary">{profile.address ?? 'Not given yet'}</dd>
          </div>
          <div className="flex gap-4 px-5 py-3">
            <dt className="w-28 shrink-0 text-muted">Signed up</dt>
            <dd className="num text-primary">{new Date(profile.created_at).toLocaleDateString('en-NG')}</dd>
          </div>
          <div className="flex gap-4 px-5 py-3">
            <dt className="w-28 shrink-0 text-muted">Payment</dt>
            <dd className="text-primary">In person, at pickup. Nothing is charged here.</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {profile.role === 'farmer' ? (
          <Link
            to="/farmers/dashboard"
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 font-semibold text-ink"
          >
            Open my stall
          </Link>
        ) : (
          <Link
            to="/markets"
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 font-semibold text-ink"
          >
            Browse the markets
          </Link>
        )}

        <Button variant="danger" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </section>
  );
}
