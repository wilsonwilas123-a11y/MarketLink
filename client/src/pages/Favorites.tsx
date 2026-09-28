import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../auth/RequireAuth';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Thumb } from '../components/art/Thumb';
import { localProductGlyph, localProductPhoto } from '../lib/productPhoto';
interface Favorite { id: string; target_type: 'farmer' | 'product' | 'market'; target_id: string; name: string; photo_url: string | null; href: string; created_at: string }
function Saved() {
  const { api } = useAuth(); const queryClient = useQueryClient();
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: () => api.get<Favorite[]>('/favorites') });
  async function remove(item: Favorite) { await api.delete(`/favorites/${item.target_type}/${item.target_id}`); await queryClient.invalidateQueries({ queryKey: ['favorites'] }); }
  return <section className="mx-auto max-w-5xl px-4 py-8 md:py-12"><Link to="/account" className="text-sm text-muted">← Account</Link><p className="mt-4 text-sm text-accent">Your shortlist</p><h1 className="font-display text-3xl font-bold">Saved places & produce</h1>
    {favorites.isPending ? <p className="mt-5 text-muted">Loading saved items…</p> : null}{favorites.error ? <p role="alert" className="mt-5 text-danger">Could not load your saved items.</p> : null}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{favorites.data?.map((item) => <Card key={item.id} className="flex flex-col overflow-hidden"><Thumb src={item.photo_url ?? (item.target_type === 'product' ? localProductPhoto(item.name) : null)} seed={item.target_id} glyph={item.target_type === 'market' ? 'pin' : item.target_type === 'farmer' ? 'farm' : localProductGlyph(item.name)} label={item.name} className="aspect-[16/9] w-full" glyphSize={48}/><div className="flex flex-1 flex-col p-5"><p className="text-xs uppercase tracking-wide text-accent">{item.target_type === 'farmer' ? 'Farmer' : item.target_type === 'market' ? 'Market' : 'Produce'}</p><h2 className="mt-2 flex-1 font-display text-xl font-semibold">{item.name}</h2><div className="mt-5 flex gap-2"><Link to={item.href} className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-on-block">View</Link><Button variant="ghost" size="sm" onClick={() => void remove(item)}>Remove</Button></div></div></Card>)}</div>
    {!favorites.isPending && !favorites.data?.length ? <Card className="mt-5 p-8 text-center"><p className="text-muted">Nothing saved yet.</p><Link to="/products" className="mt-3 inline-block text-accent">Browse products and use the heart to save them</Link></Card> : null}</section>;
}
export default function Favorites() { return <RequireAuth roles={['customer']}><Saved /></RequireAuth>; }
