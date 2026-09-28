import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Glyph, type GlyphName } from '../components/art/glyphs';
import { formatMinor } from '../utils/money';
import { currencyForCountry, localeForCountry, MARKET_COUNTRIES } from '../lib/countries';
import { Reveal } from '../motion/reveal';
import type { Order } from '../lib/types';
import { readLocalAvatar, saveLocalAvatar } from '../lib/localAvatar';

interface Favorite {
  id: string;
  target_type: 'farmer' | 'product' | 'market';
  target_id: string;
  name: string;
  photo_url: string | null;
  href: string;
  created_at: string;
}

const orderStatus: Record<Order['status'], string> = {
  placed: 'Placed', accepted: 'Confirmed', preparing: 'Preparing',
  ready_for_pickup: 'Ready to collect', completed: 'Collected', cancelled: 'Cancelled',
};

const accountLinks: { to: string; label: string; icon: GlyphName; customerOnly?: boolean }[] = [
  { to: '/account', label: 'My profile', icon: 'grid' },
  { to: '/orders', label: 'My orders', icon: 'basket', customerOnly: true },
  { to: '/products', label: 'Browse produce', icon: 'leaf' },
  { to: '/markets', label: 'Markets', icon: 'pin' },
  { to: '/farmers', label: 'Farmers', icon: 'farm' },
  { to: '/favorites', label: 'Saved places', icon: 'star', customerOnly: true },
  { to: '/notifications', label: 'Alerts', icon: 'clock', customerOnly: true },
];

export default function Account() {
  const { profile, signOut, api, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState({ full_name: '', phone: '', address: '', country: 'Nigeria' });
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (profile) setLocalPhoto(readLocalAvatar(profile.id));
  }, [profile?.id]);
  const favorites = useQuery({
    queryKey: ['favorites'],
    enabled: profile?.role === 'customer',
    queryFn: () => api.get<Favorite[]>('/favorites'),
  });
  const orders = useQuery({
    queryKey: ['orders', 'recent'],
    enabled: profile?.role === 'customer',
    queryFn: () => api.get<{ data: Order[]; meta: { total: number } }>('/orders?limit=3'),
  });

  if (!profile) return null;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch('/me', {
        full_name: draft.full_name.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim() || null,
        ...(profile?.role === 'customer' ? { country: draft.country } : {}),
      });
      await refresh();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your details.');
    } finally {
      setSaving(false);
    }
  }

  function editProfile() {
    if (!profile) return;
    setDraft({ full_name: profile.full_name, phone: profile.phone, address: profile.address ?? '', country: profile.country });
    setError('');
    setEditing((current) => !current);
  }

  async function uploadAvatar(file?: File) {
    if (!profile || !file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPEG, PNG, or WebP photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Choose a photo smaller than 5 MB.');
      return;
    }

    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const savedPhoto = await saveLocalAvatar(profile.id, file);
      setLocalPhoto(savedPhoto);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Your profile photo could not be saved.');
    } finally {
      setPhotoPreview(null);
      URL.revokeObjectURL(preview);
      setPhotoBusy(false);
    }
  }

  const locale = localeForCountry(profile.country);
  const joined = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(profile.created_at));
  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'there';

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-14 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <div className="grid items-start gap-6 lg:grid-cols-[245px_minmax(0,1fr)] lg:gap-8">
        <aside className="rounded-2xl border border-line bg-surface p-4 shadow-[0_10px_32px_rgba(21,39,29,.045)] lg:sticky lg:top-24">
          <Link to="/account" className="flex items-center gap-3 px-2 py-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-on-block"><Glyph name="leaf" size={19} /></span>
            <span><span className="block font-display text-base font-extrabold leading-tight text-primary">MarketLink</span><span className="mt-0.5 block text-[11px] text-muted">Your account</span></span>
          </Link>
          <div className="my-4 h-px bg-line" />
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.16em] text-muted">Account menu</p>
          <nav aria-label="Account navigation" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {accountLinks.filter((item) => !item.customerOnly || profile.role === 'customer').map((item) => (
              <Link key={item.to} to={item.to} aria-current={item.to === '/account' ? 'page' : undefined} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${item.to === '/account' ? 'bg-accent-soft text-accent' : 'text-body hover:bg-elevated hover:text-primary'}`}>
                <Glyph name={item.icon} size={17} /><span>{item.label}</span>{item.to === '/orders' && orders.data?.meta.total ? <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-muted">{orders.data.meta.total}</span> : null}
              </Link>
            ))}
          </nav>
          <button type="button" className="mt-4 px-3 py-2 text-sm text-muted transition hover:text-primary" onClick={() => void signOut()}>Sign out</button>
        </aside>

        <main className="min-w-0">
          <header className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#0e513b] p-3 text-white shadow-[0_12px_34px_rgba(14,81,59,.15)] sm:p-4">
            <span className="order-3 w-full pl-2 text-xs font-medium text-white/85 sm:order-2 sm:w-auto sm:px-2">{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
            <div className="ml-auto flex items-center gap-2 sm:order-3">
              {profile.role === 'customer' ? <Link to="/notifications" aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/95 text-primary transition hover:bg-white"><Glyph name="clock" size={18} /></Link> : null}
              {profile.role === 'customer' ? <Link to="/cart" aria-label="Your pickup basket" className="grid h-10 w-10 place-items-center rounded-xl bg-white/95 text-primary transition hover:bg-white"><Glyph name="basket" size={18} /></Link> : null}
              <span className="hidden items-center gap-2 rounded-full border border-white/25 px-3 py-2 text-xs font-medium sm:flex"><Avatar src={profile.avatar_url} size={23} />{firstName}</span>
            </div>
          </header>

          <div className="mb-5 mt-7 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4 sm:mt-9">
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-accent">Your MarketLink account</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-.04em] text-primary">My profile</h1><p className="mt-1 text-sm text-muted">Your details for local shopping and market pickup.</p></div>
            <Badge tone={profile.role === 'farmer' ? 'accent' : 'muted'}>{profile.role}</Badge>
          </div>

          <Card className="mb-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar src={photoPreview ?? localPhoto ?? profile.avatar_url} size={76} />
              <div className="min-w-0 flex-1"><p className="font-display text-xl font-bold text-primary sm:text-2xl">{profile.full_name}</p><p className="mt-1 text-sm text-body">{profile.address || 'Add your area to personalize your market search'}</p><p className="num mt-1 text-xs text-muted">{profile.phone}</p></div>
              <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold capitalize text-accent">{profile.role}</span>
              <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 sm:ml-[92px] sm:w-auto sm:border-0 sm:pt-0">
                <button type="button" onClick={() => photoInput.current?.click()} disabled={photoBusy} className="text-sm font-semibold text-accent hover:underline disabled:opacity-50">{photoBusy ? 'Saving photo…' : 'Upload photo'}</button>
                <button type="button" onClick={() => cameraInput.current?.click()} disabled={photoBusy} className="text-sm font-medium text-body hover:text-primary disabled:opacity-50">Take a photo</button>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadAvatar(file); }} />
                <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadAvatar(file); }} />
              </div>
            </div>
            {photoError ? <p role="alert" className="mt-3 text-sm text-danger">{photoError}</p> : null}
          </Card>

          <Card className="mb-5 overflow-hidden">
            <SectionTitle title="Personal information" action={<Button size="sm" variant={editing ? 'ghost' : 'primary'} onClick={editProfile}>{editing ? 'Cancel' : 'Edit details'}{!editing ? <span aria-hidden className="ml-1">↗</span> : null}</Button>} />
            {editing ? (
              <form onSubmit={(event) => void saveProfile(event)} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <label className="text-xs font-medium text-muted">Full name<input required maxLength={120} value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} className="mt-1.5 block h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/10" /></label>
                <label className="text-xs font-medium text-muted">Phone number<input required minLength={7} maxLength={20} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="mt-1.5 block h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/10" /></label>
                <label className="text-xs font-medium text-muted sm:col-span-2">Where you are<input maxLength={240} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} placeholder="Market, neighbourhood or LGA" className="mt-1.5 block h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/10" /></label>
                {profile.role === 'customer' ? <label className="text-xs font-medium text-muted">Country<select value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} className="mt-1.5 block h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/10">{MARKET_COUNTRIES.map(({ name }) => <option key={name} value={name}>{name}</option>)}</select><span className="mt-1 block">Currency: {currencyForCountry(draft.country)}</span></label> : null}
                {error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p> : null}
                <Button type="submit" loading={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </form>
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Full name" value={profile.full_name} />
                <InfoField label="Phone number" value={profile.phone} />
                <InfoField label="Account type" value={profile.role === 'customer' ? 'Buyer' : profile.role === 'farmer' ? 'Seller' : 'Admin'} />
                <InfoField label="Country & currency" value={`${profile.country} · ${currencyForCountry(profile.country)}`} />
                <InfoField label="Member since" value={joined} />
              </dl>
            )}
          </Card>

          <Card className="mb-8 overflow-hidden">
            <SectionTitle title="Your area" action={<Button size="sm" variant="ghost" onClick={editProfile}>{profile.address ? 'Edit area' : 'Add area'}</Button>} />
            <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent"><Glyph name="pin" size={22} /></span>
              <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted">Neighborhood or pickup area</p><p className="mt-1 font-semibold text-primary">{profile.address || 'No area added yet'}</p></div>
              <p className="max-w-sm text-xs leading-relaxed text-muted">This helps you choose nearby markets. Your order is still collected from the market shown at checkout.</p>
            </div>
          </Card>

          {profile.role === 'customer' ? (
            <div className="grid gap-8 xl:grid-cols-2">
              <section aria-labelledby="recent-orders-heading">
                <SectionTitle id="recent-orders-heading" title="Recent orders" action={<Link to="/orders" className="text-sm font-semibold text-accent hover:underline">All orders →</Link>} plain />
                {orders.isPending ? <div className="mt-4 space-y-3" aria-label="Loading recent orders"><Card className="h-20 animate-pulse bg-elevated"><span className="sr-only">Loading order</span></Card><Card className="h-20 animate-pulse bg-elevated"><span className="sr-only">Loading order</span></Card></div> : null}
                {orders.isError ? <Card className="mt-4 p-5 text-sm text-body">Your order history could not load. You can still browse and reserve produce.</Card> : null}
                {orders.data?.data.length ? <Reveal className="mt-4 space-y-3" y={12} stagger={0.06}>{orders.data.data.map((order) => <Link key={order.id} to={`/orders/${encodeURIComponent(order.reference)}`} className="block"><Card className="flex items-center gap-3 p-4 transition hover:border-accent/40"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Glyph name="basket" size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{order.farmer.stall_name}</span><span className="mt-1 block text-xs text-muted">{order.reference} · {order.pickup_date}</span></span><span className="text-right"><span className="block text-xs font-semibold text-primary">{orderStatus[order.status]}</span><span className="num mt-1 block text-xs text-muted">{formatMinor(order.subtotal_minor, order.currency)}</span></span></Card></Link>)}</Reveal> : null}
                {!orders.isPending && !orders.isError && !orders.data?.data.length ? <EmptyPanel icon="basket" title="Your first pickup starts here" body="Reserve from a local farmer and your collection details will appear here." linkTo="/products" linkLabel="Browse produce" /> : null}
              </section>

              <section aria-labelledby="saved-heading">
                <SectionTitle id="saved-heading" title="Saved places & produce" action={<Link to="/favorites" className="text-sm font-semibold text-accent hover:underline">View saved →</Link>} plain />
                {favorites.isPending ? <div className="mt-4 space-y-3" aria-label="Loading saved places"><Card className="h-20 animate-pulse bg-elevated"><span className="sr-only">Loading saved place</span></Card><Card className="h-20 animate-pulse bg-elevated"><span className="sr-only">Loading saved place</span></Card></div> : null}
                {favorites.isError ? <Card className="mt-4 p-5 text-sm text-body">Your saved list could not load right now. Try again in a moment.</Card> : null}
                {favorites.data?.length ? <Reveal className="mt-4 space-y-3" y={12} stagger={0.06}>{favorites.data.slice(0, 4).map((favorite) => <Link key={favorite.id} to={favorite.href} className="block"><Card className="flex items-center gap-3 p-3 transition hover:border-accent/40"><FavoriteImage favorite={favorite} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{favorite.name}</span><span className="mt-1 block text-xs capitalize text-muted">Saved {favorite.target_type}</span></span><span aria-hidden className="text-lg text-accent">♥</span></Card></Link>)}</Reveal> : null}
                {!favorites.isPending && !favorites.isError && !favorites.data?.length ? <EmptyPanel icon="star" title="Keep a good find close" body="Tap the heart on a farmer, market or product and it will be saved here." linkTo="/farmers" linkLabel="Meet local farmers" /> : null}
              </section>
            </div>
          ) : null}
          <button type="button" onClick={() => void signOut()} className="mt-8 text-sm text-muted transition hover:text-primary lg:hidden">Sign out</button>
        </main>
      </div>
    </section>
  );
}

function SectionTitle({ id, title, action, plain = false }: { id?: string; title: string; action: ReactNode; plain?: boolean }) {
  return <header className={`flex items-center justify-between gap-3 ${plain ? 'mb-3 border-b border-line pb-3' : 'border-b border-line px-5 py-4 sm:px-6'}`}><h2 id={id} className="font-display text-lg font-bold text-[#164c3b] sm:text-xl">{title}</h2>{action}</header>;
}

function InfoField({ label, value }: { label: string; value: string }) {
  return <div className="px-5 py-4 sm:px-6 sm:py-5"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-1.5 break-words text-[15px] font-medium text-primary">{value}</dd></div>;
}

function EmptyPanel({ icon, title, body, linkTo, linkLabel }: { icon: GlyphName; title: string; body: string; linkTo: string; linkLabel: string }) {
  return <div className="mt-3 rounded-2xl border border-dashed border-line bg-surface p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Glyph name={icon} size={20} /></span><h3 className="mt-3 font-semibold text-primary">{title}</h3><p className="mt-1 text-sm leading-relaxed text-body">{body}</p><Link to={linkTo} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline">{linkLabel} <span aria-hidden>→</span></Link></div>;
}

function FavoriteImage({ favorite }: { favorite: Favorite }) {
  if (favorite.photo_url) return <img src={favorite.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />;
  const icon: GlyphName = favorite.target_type === 'market' ? 'pin' : favorite.target_type === 'farmer' ? 'farm' : 'leaf';
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Glyph name={icon} size={21} /></span>;
}
