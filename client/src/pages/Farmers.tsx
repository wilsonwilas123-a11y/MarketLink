import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Thumb } from '../components/art/Thumb';
import { Stars } from '../components/discovery/pieces';
import { useFarmer, useFarmerList, useMarketList, WEEK } from '../lib/discovery';
import { CATEGORIES } from '../lib/showcase';
import { addToCart } from '../lib/cart';
import { clock } from '../lib/discovery';
import { formatMinor } from '../utils/money';
import { localProductGlyph, localProductPhoto } from '../lib/productPhoto';
import { FavoriteToggle } from '../components/FavoriteToggle';
import { Reveal } from '../motion/reveal';
import { SearchAutocomplete } from '../components/discovery/SearchAutocomplete';
import { farmerCover } from '../lib/farmerPhoto';


const DEMO_COVERS: Record<string, string> = {
  'Bola Adeyemi': '/img/farmers/bola.jpg',
  'Chidinma Eze': '/img/farmers/chidinma.jpg',
  'Grace Effiong': '/img/farmers/grace.jpg',
  'Mariam Lawal': '/img/farmers/mariam.jpg',
  'Sunday Ochelula': '/img/farmers/sunday.jpg',
  'Ifaturo Ade': '/img/farmers/ifaturo.jpg',
  'Kelechi Anyanwu': '/img/farmers/kelechi.jpg',
  'Seun Oluwale': '/img/farmers/seun.jpg',
};

export default function Farmers() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  const filters = {
    q: q || undefined,
    marketId: params.get('market_id') || undefined,
    category: params.get('category') || undefined,
  };
  const farmers = useFarmerList(filters);
  const markets = useMarketList({});

  function patch(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function search(event: FormEvent) {
    event.preventDefault();
    patch('q', draft.trim());
  }

  const rows = farmers.data?.data ?? [];
  return (
    <section className="mx-auto w-full max-w-[1720px] px-4 py-7 sm:px-6 lg:px-7 md:py-10">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Meet the growers</p>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Local Farmers</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Browse approved farm stalls, their markets, pickup days, and the harvest they have this week.</p>
      </header>
      <form onSubmit={search} className="mt-6 grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-[0_8px_30px_rgba(21,39,29,0.05)] md:grid-cols-[minmax(0,1fr)_14rem_14rem_auto] md:items-end md:p-5">
        <SearchAutocomplete label="Search farmers" value={draft} onChange={setDraft} placeholder="Stall or farmer name" kinds={['farmers']} resultPath="/farmers" />
        <label className="text-sm text-muted">Market
          <select value={filters.marketId ?? ''} onChange={(event) => patch('market_id', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-elevated px-3 text-primary">
            <option value="">All markets</option>
            {(markets.data?.data ?? []).map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">Product category
          <select value={filters.category ?? ''} onChange={(event) => patch('category', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-elevated px-3 text-primary">
            <option value="">All categories</option>
            {CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </label>
        <Button type="submit" size="md">Search</Button>
      </form>

      {farmers.isError ? <Card className="mt-5 p-6 text-sm text-muted">We couldn’t load the farmer directory. Please try again.</Card> : null}
      {farmers.isPending ? (
        <div className="mt-4 grid justify-items-center gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Loading farmers">
          {Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-80 w-full max-w-[22rem] animate-pulse bg-elevated"><span className="sr-only">Loading farmer</span></Card>)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="mt-5 p-10 text-center">
          <h2 className="font-display text-xl font-semibold">No farmers match these filters</h2>
          <p className="mt-2 text-sm text-muted">Try a different market or category.</p>
        </Card>
      ) : (
        <>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
          <p>Showing {rows.length} {rows.length === 1 ? 'farmer' : 'farmers'}</p>
          <p className="hidden sm:block">{markets.data?.data.length ?? 0} pickup markets</p>
        </div>
        <Reveal className="mt-3 grid justify-items-center gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" y={18} stagger={0.055}>
          {rows.map((farmer) => (
            <Card key={farmer.id} className="group relative w-full max-w-[22rem] overflow-hidden rounded-3xl border-line/90 shadow-[0_8px_28px_rgba(21,39,29,0.06)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(21,39,29,0.13)]">
              <div className="absolute right-3 top-3 z-10"><FavoriteToggle type="farmer" id={farmer.id} /></div>
              <Link to={`/farmers/${farmer.id}`} className="block">
                <Thumb src={farmerCover(farmer)} fallbackSrc={DEMO_COVERS[farmer.contact_person] || '/img/farmers/bola.jpg'} seed={farmer.id} glyph="farm" label={farmer.cover_url ? farmer.stall_name : `${farmer.stall_name} — representative farm photo`} className="h-[340px] w-full bg-[#e8efe9] sm:h-[400px]" glyphSize={52} imgClass="object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]" />
              </Link>
              <div className="p-4 md:p-5">
                <Link to={`/farmers/${farmer.id}`} className="font-display text-xl font-semibold leading-snug hover:text-accent">{farmer.stall_name}</Link>
                <p className="mt-1 text-base text-muted">{farmer.contact_person}</p>
                <Stars value={farmer.rating_avg} count={farmer.rating_count} className="mt-2" />
                <p className="mt-3 line-clamp-2 min-h-10 text-base leading-relaxed text-muted">{farmer.description || 'Local produce, available for pickup at the market.'}</p>
                <Link to={`/farmers/${farmer.id}`} className={`${buttonClass('ghost', 'md', 'mt-4 w-full text-base')}`}>View farm</Link>
              </div>
            </Card>
          ))}
        </Reveal>
        </>
      )}
    </section>
  );
}

export function FarmerProfile() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'about' | 'products' | 'reviews'>('about');
  const farmer = useFarmer(id);
  const [added, setAdded] = useState<string | null>(null);

  if (farmer.isPending) return <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted">Loading farmer profile…</div>;
  const profile = farmer.data;
  if (farmer.isError || !profile) return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Farmer not found</h1>
      <p className="mt-2 text-sm text-muted">This stall may no longer be listed.</p>
      <Link to="/farmers" className={`${buttonClass('ghost', 'sm')} mt-5`}>Browse farmers</Link>
    </section>
  );

  const nextPickup = profile.operating_days.map((code) => WEEK.find((day) => day.code === code)?.label).filter(Boolean).join(', ');
  const days = profile.operating_days.map((code) => WEEK.find((day) => day.code === code)?.label).filter(Boolean).join(' · ');
  const tabNames = [
    { value: 'about', label: 'About' },
    { value: 'products', label: 'Products' },
    { value: 'reviews', label: `Reviews (${profile.rating_count})` },
  ] as const;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <Link to="/farmers" className="text-sm text-muted hover:text-primary">← Farmers</Link>
      <Card className="mt-4 overflow-hidden">
        <div className="relative"><Thumb src={farmerCover(profile)} fallbackSrc={DEMO_COVERS[profile.contact_person] || '/img/farmers/bola.jpg'} seed={profile.id} glyph="farm" label={profile.cover_url ? profile.stall_name : `${profile.stall_name} — representative farm photo`} className="h-96 w-full bg-[#e8efe9] md:h-[36rem]" glyphSize={72} imgClass="object-contain" /><div className="absolute right-4 top-4"><FavoriteToggle type="farmer" id={profile.id} /></div></div>
        <div className="flex flex-wrap items-end justify-between gap-5 p-5 md:p-7">
          <div>
            <p className="text-sm text-accent">Local farm stall</p>
            <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{profile.stall_name}</h1>
            <p className="mt-2 text-muted">{profile.contact_person}</p>
            <Stars value={profile.rating_avg} count={profile.rating_count} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={profile.lat != null && profile.lng != null ? `https://www.openstreetmap.org/?mlat=${profile.lat}&mlon=${profile.lng}#map=17/${profile.lat}/${profile.lng}` : '#markets'} target="_blank" rel="noreferrer" className={buttonClass('ghost', 'sm')}>View location</a>
            <Link to="/products" className={buttonClass('primary', 'sm')}>Shop harvest</Link>
          </div>
        </div>
      </Card>

      <nav className="mt-5 flex gap-2 border-b border-line" aria-label="Farmer profile sections">
        {tabNames.map((item) => <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)} className={`border-b-2 px-4 py-3 text-sm ${tab === item.value ? 'border-accent font-semibold text-primary' : 'border-transparent text-muted hover:text-primary'}`}>{item.label}</button>)}
      </nav>

      {tab === 'about' ? (
        <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
          <Card className="p-5">
            <h2 className="font-display text-xl font-semibold">About {profile.stall_name}</h2>
            <p className="mt-3 leading-relaxed text-muted">{profile.description || 'A local farmer sharing this week’s harvest at the market.'}</p>
            <h3 className="mt-6 text-sm font-semibold">Weekly pickup days</h3>
            <p className="mt-1 text-sm text-muted">{days || 'Ask the farmer for this week’s schedule'}</p>
            {profile.pickup_window_start && profile.pickup_window_end ? <p className="mt-1 text-sm text-muted">Pickup window {clock(profile.pickup_window_start)}–{clock(profile.pickup_window_end)}</p> : null}
            <p className="mt-3 text-xs text-muted">Next available days: {nextPickup || 'contact the farmer'}</p>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-xl font-semibold">Markets</h2>
            {profile.lat != null && profile.lng != null ? <div className="mt-3 overflow-hidden rounded-xl border border-line"><iframe title={`${profile.stall_name} pickup location map`} loading="lazy" referrerPolicy="no-referrer" className="h-56 w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${profile.lng-0.012}%2C${profile.lat-0.008}%2C${profile.lng+0.012}%2C${profile.lat+0.008}&layer=mapnik&marker=${profile.lat}%2C${profile.lng}`} /><div className="flex justify-between gap-3 p-3 text-xs"><span className="text-muted">Farmer pickup pin</span><a href={`https://www.google.com/maps/dir/?api=1&destination=${profile.lat},${profile.lng}`} target="_blank" rel="noreferrer" className="text-accent underline">Directions</a></div></div> : <p className="mt-2 text-xs text-muted">This stall has not published a map pin yet.</p>}
            {profile.markets.length ? <ul className="mt-3 divide-y divide-line">{profile.markets.map((market) => <li key={market.id} className="py-3 first:pt-0">
              <Link to={`/markets/${market.id}`} className="font-semibold hover:text-accent">{market.name}</Link>
              <p className="mt-1 text-sm text-muted">{market.address}, {market.city}</p>
              <p className="mt-1 text-xs text-muted">{market.stall_ref ? `Pitch ${market.stall_ref} · ` : ''}{market.days.join(', ')}</p>
            </li>)}</ul> : <p className="mt-3 text-sm text-muted">No pickup markets are listed yet.</p>}
          </Card>
        </div>
      ) : null}

      {tab === 'products' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.products.map((product) => {
            const available = !product.is_sold_out && (product.quantity_available ?? 0) > 0;
            const marketId = profile.markets[0]?.id;
            return <Card key={product.id} className="overflow-hidden">
              <Link to={`/products/${product.id}`}><Thumb src={product.image_urls[0]} fallbackSrc={localProductPhoto(product.name)} seed={product.id} category={product.category.slug} glyph={localProductGlyph(product.name)} className="aspect-[4/3] w-full" /></Link>
              <div className="p-4">
                <Link to={`/products/${product.id}`} className="font-semibold hover:text-accent">{product.name}</Link>
                <p className="mt-2 font-semibold">{formatMinor(product.price_minor, profile.currency)} <span className="text-xs font-normal text-muted">/ {product.unit}</span></p>
                <p className="mt-1 text-xs text-muted">{available ? `${product.quantity_available} available this week` : 'Sold out this week'}</p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!available || !marketId}
                  onClick={() => {
                    if (!marketId || !available) return;
                    addToCart({ product_id: product.id, market_id: marketId, quantity: 1 });
                    setAdded(product.id);
                    window.setTimeout(() => setAdded(null), 1400);
                  }}
                >{added === product.id ? 'Added to cart' : 'Add to cart'}</Button>
              </div>
            </Card>;
          })}
          {profile.products.length === 0 ? <Card className="p-8 text-sm text-muted">No active products listed this week.</Card> : null}
        </div>
      ) : null}

      {tab === 'reviews' ? (
        <div className="mt-6 max-w-3xl space-y-3">
          {profile.reviews.map((review) => <Card key={review.id} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">{review.title || `Customer review · ${review.rating}/5`}</h2>
              <span className="text-xs text-muted">{new Date(review.created_at).toLocaleDateString()}</span>
            </div>
            {review.body ? <p className="mt-2 text-sm leading-relaxed text-muted">{review.body}</p> : null}
            {review.farmer_reply ? <p className="mt-3 rounded-lg bg-elevated p-3 text-sm"><span className="font-semibold">Farmer reply:</span> {review.farmer_reply}</p> : null}
            <p className="mt-3 text-xs text-muted">By {review.customer_name}</p>
          </Card>)}
          {profile.reviews.length === 0 ? <Card className="p-8 text-sm text-muted">No customer reviews yet.</Card> : null}
        </div>
      ) : null}
    </section>
  );
}
