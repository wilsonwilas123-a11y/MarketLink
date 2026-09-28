import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../auth/AuthProvider';
import { COMPLETE_PROFILE_PATH, homeFor } from '../../auth/paths';
import { localAvatarEventName, readLocalAvatar } from '../../lib/localAvatar';
import { ADMIN_SESSION_EVENT, getAdminEmail } from '../../auth/adminSession';

/**
 * The account corner of the nav.
 *
 * The avatar alone says nothing about who you are signed in as, and a farmer with a pending
 * stall needs the one thing that tells them to stay one click away rather than hidden behind
 * an icon.
 */
export function AccountSlot() {
  const { status, profile, refresh } = useAuth();
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(() => getAdminEmail());

  useEffect(() => {
    const update = () => setAdminEmail(getAdminEmail());
    window.addEventListener(ADMIN_SESSION_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(ADMIN_SESSION_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      setLocalAvatar(null);
      return;
    }
    const profileId = profile.id;
    const update = () => setLocalAvatar(readLocalAvatar(profileId));
    update();
    const eventName = localAvatarEventName();
    window.addEventListener(eventName, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(eventName, update);
      window.removeEventListener('storage', update);
    };
  }, [profile?.id]);

  if (adminEmail) {
    return (
      <Link
        to="/admin"
        aria-label={`Admin profile: ${adminEmail}`}
        className="flex items-center gap-2 rounded-full border border-line bg-elevated py-1 pl-1 pr-3 text-sm text-primary transition hover:border-accent/50"
      >
        <Avatar size={26} />
        <span className="max-w-[9rem] truncate">Admin</span>
      </Link>
    );
  }

  if (status === 'loading') return null;

  if (status === 'ready' && profile) {
    return (
      <Link
        to={homeFor(profile.role)}
        className="flex items-center gap-2 rounded-full border border-line bg-elevated py-1 pl-1 pr-3 text-sm text-primary transition hover:border-accent/50"
      >
        <Avatar src={localAvatar ?? profile.avatar_url} size={26} />
        <span className="max-w-[9rem] truncate">{profile.full_name.split(' ')[0]}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
    );
  }

  if (status === 'profile_needed') {
    return (
      <Link
        to={COMPLETE_PROFILE_PATH}
        className="inline-flex h-8 items-center rounded-full border border-warn/30 bg-warn/10 px-3 text-sm font-semibold text-warn"
      >
        Finish your profile
      </Link>
    );
  }

  if (status === 'error') {
    // The session may be perfectly good — this is a request that failed, so say so and let
    // the retry be one tap rather than sending them through sign-in.
    return (
      <button
        type="button"
        onClick={() => void refresh()}
        className="inline-flex h-8 items-center rounded-full border border-warn/50 px-3 text-sm text-warn transition hover:bg-warn/10"
      >
        Not connected — retry
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/signin"
        className="inline-flex h-8 items-center rounded-full px-3 text-sm text-muted transition hover:text-primary"
      >
        Sign in
      </Link>
      <Link
        to="/signup"
        className="inline-flex h-8 items-center rounded-full bg-accent px-3 text-sm font-semibold text-on-block"
      >
        Join
      </Link>
    </div>
  );
}
