import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';

interface Favorite { target_type: 'farmer' | 'product' | 'market'; target_id: string }
export function FavoriteToggle({ type, id }: { type: Favorite['target_type']; id: string }) {
  const { api, profile, status } = useAuth();
  const client = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const enabled = status === 'ready' && profile?.role === 'customer';
  const favorites = useQuery({ queryKey: ['favorites'], enabled, queryFn: () => api.get<Favorite[]>('/favorites') });
  const active = favorites.data?.some((favorite) => favorite.target_type === type && favorite.target_id === id) ?? false;
  if (!enabled) return <Link to="/signin" aria-label="Sign in to save this favorite" title="Sign in to save" className="inline-grid h-9 w-9 place-items-center rounded-full border border-line bg-sheet/90 text-lg text-primary">♡</Link>;
  async function toggle() {
    setBusy(true); setError('');
    try {
      if (active) await api.delete(`/favorites/${type}/${id}`);
      else await api.put('/favorites', { target_type: type, target_id: id });
      await client.invalidateQueries({ queryKey: ['favorites'] });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update favorite.'); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-center"><button type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={active} aria-label={active ? 'Remove from favorites' : 'Add to favorites'} title={error || (active ? 'Remove from favorites' : 'Add to favorites')} className={`inline-grid h-9 w-9 place-items-center rounded-full border border-line bg-sheet/90 text-lg transition hover:border-accent ${active ? 'text-accent' : 'text-primary'}`}>{active ? '♥' : '♡'}</button>{error ? <span role="alert" className="sr-only">{error}</span> : null}</span>;
}
