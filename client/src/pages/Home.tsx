import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Glyph } from '../components/art/glyphs';
import { Thumb } from '../components/art/Thumb';
import { MarketCard, MarketCardSkeleton } from '../components/discovery/MarketCard';
import { SkeletonRow, StateNote } from '../components/discovery/StateNote';
import { OpenState, Stars } from '../components/discovery/pieces';
import { buttonClass } from '../components/ui/Button';
import { chipClass } from '../components/ui/Chip';
import { LAGOS, dayList, lagosClock, lagosToday, useFarmerList, useNearbyMarkets } from '../lib/discovery';
import { CATEGORIES, FRESH_THIS_WEEK, stockState } from '../lib/showcase';
import type { ShowcaseProduct } from '../lib/showcase';
import type { FarmerSummary } from '../lib/types';
import { formatKobo } from '../utils/kobo';
import { Reveal } from '../motion/reveal';

/**
 * The landing screen.
 *
 * The photograph carries the claim, so the copy sits on top of it rather than beside a second
 * column of marketing text: one idea, one image, and the two calls to action that a first-time
 * visitor can actually take. Everything below the fold is live data — the market list, the map,
 * the stalls — because the app's whole argument is that this week's stock is knowable.
 */
const MarketMap = lazy(() => import('../components/discovery/MarketMap'));

/** A fix on Lekki Phase 1, so a first-time visitor can see the distance query work at all. */
const LEKKI = { lat: 6.4551, lng: 3.3795 };

const QUICK_LINKS = [
  { label: 'Open right now', to: '/markets?open=1' },
  { label: 'Saturday markets', to: '/markets?day=sat' },
  { label: 'Near Lekki Phase 1', to: `/markets?lat=${LEKKI.lat}&lng=${LEKKI.lng}&radius=10` },
  { label: 'All markets', to: '/markets' },
];

function Hero() {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    navigate(q ? `/markets?q=${encodeURIComponent(q)}` : '/markets');
  }

  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      {/* Wide screens: the photograph is anchored to the right edge at its own aspect ratio, so
          the farmer stands on the right of the frame instead of behind the copy and nothing about
          it is cropped or dimmed. Narrow screens have no room beside the copy, so it bleeds. */}
      <picture>
        <source srcSet="/img/hero-farmer.webp" type="image/webp" />
        <img
          src="/img/hero-farmer.jpg"
          alt="A farmer at the head of his row, holding a crate of just-picked vegetables"
          width={1364}
          height={768}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center lg:left-auto lg:right-0 lg:h-full lg:w-auto lg:max-w-none lg:object-contain lg:[mask-image:linear-gradient(to_right,transparent,rgba(0,0,0,0.4)_12%,#000_30%)]"
        />
      </picture>

      <div className="mx-auto flex max-w-7xl flex-col px-4 pb-14 pt-16 md:pb-20 md:pt-24">
        <div className="max-w-2xl lg:max-w-xl">
          <Reveal className="flex flex-col" y={12} stagger={0.07}>
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted [text-shadow:0_1px_14px_rgba(4,21,14,0.95)]">
              Local farmers
              <span aria-hidden className="text-accent">
                ·
              </span>
              Fresh produce
              <span aria-hidden className="text-accent">
                ·
              </span>
              Stronger communities
            </p>

            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] md:text-6xl [text-shadow:0_2px_22px_rgba(4,21,14,0.95)]">
              Fresh from the market.
              <span className="block text-accent">Before you get there.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-primary/85 md:text-lg [text-shadow:0_1px_16px_rgba(4,21,14,0.95)]">
              See what each stall actually has left this week, reserve it against a pickup
              window, and pay the farmer at the market. Nothing is charged online.
            </p>

            <form onSubmit={submit} className="mt-7 flex max-w-md gap-2">
              <label htmlFor="hero-search" className="sr-only">
                Search markets, farmers or produce
              </label>
              <div className="relative flex-1">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                >
                  <Glyph name="search" size={17} />
                </span>
                <input
                  id="hero-search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search markets, farmers or produce"
                  className="h-11 w-full rounded-full border border-line bg-surface/90 pl-10 pr-3 text-sm text-primary outline-none backdrop-blur transition placeholder:text-muted/70 focus:border-accent"
                />
              </div>
              <button type="submit" className={buttonClass('primary', 'md', 'h-11 shrink-0')}>
                Search
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/markets" className={buttonClass('ghost', 'md', 'bg-surface/85 backdrop-blur')}>
                Explore markets
                <Glyph name="arrow" size={16} />
              </Link>
              <Link to="/products" className={buttonClass('ghost', 'md', 'bg-surface/85 backdrop-blur')}>
                Browse produce
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      <span className="absolute right-5 top-6 hidden -rotate-3 rounded-lg border border-accent/40 bg-base/70 px-3 py-1.5 font-display text-xs font-semibold text-accent backdrop-blur md:block">
        Local. Fresh. Trusted.
      </span>
    </section>
  );
}

/**
 * The live line under the hero.
 *
 * Counted from the same nearby query the rail below renders, so the number and the cards can
 * never disagree, and labelled as "of these" because it describes the circle on the map rather
 * than every market in the state.
 */
function LiveStrip({ total, open }: { total: number; open: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <OpenState open={open > 0} />
      <span className="num">
        {open} of {total} markets within 25 km of central Lagos
      </span>
      <span aria-hidden className="text-line">
        |
      </span>
      <span className="num">{lagosClock()}</span>
      <span>Lagos time</span>
    </span>
  );
}

function MarketsNearYou() {
  const nearby = useNearbyMarkets({ lat: LAGOS.lat, lng: LAGOS.lng, radiusKm: 25 });
  const markets = nearby.data?.data ?? [];
  const open = markets.filter((m) => m.is_open_now).length;
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <section className="mx-auto mt-12 max-w-7xl px-4">
      <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="text-accent" aria-hidden>
                <Glyph name="pin" size={19} />
              </span>
              Markets near you
            </h2>
            <p className="mt-1 text-sm text-muted">
              <LiveStrip total={nearby.data?.meta.total ?? 0} open={open} />
            </p>
          </div>
          <Link to="/markets" className="text-sm text-accent hover:underline">
            Open the full map
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted">Produce</span>
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to={`/products?category=${c.slug}`} className={chipClass()}>
              <Glyph name={c.glyph} size={14} />
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,45%)]">
          <div>
            {nearby.isPending ? (
              <div className="flex flex-col gap-3">
                <MarketCardSkeleton />
                <MarketCardSkeleton />
                <MarketCardSkeleton />
              </div>
            ) : nearby.error ? (
              <StateNote
                label="The nearby list did not load"
                body="Nothing is wrong with the markets — the request failed."
                retry={() => void nearby.refetch()}
              />
            ) : (
              <Reveal className="flex flex-col gap-3" y={10} stagger={0.04}>
                {markets.slice(0, 3).map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    selected={selected === market.id}
                    onFocus={() => setSelected(market.id)}
                  />
                ))}
              </Reveal>
            )}

            <p className="mt-3 text-sm text-muted">
              Distances are straight-line from central Lagos.{' '}
              <Link to="/markets" className="text-accent hover:underline">
                Search your own area
              </Link>
              .
            </p>
          </div>

          <div className="min-h-[320px] overflow-hidden rounded-2xl border border-line lg:min-h-full">
            <Suspense
              fallback={
                <div className="grid h-full min-h-[320px] place-items-center px-6 text-center text-sm text-muted">
                  Loading the map…
                </div>
              }
            >
              <MarketMap
                markets={markets}
                origin={LAGOS}
                selectedId={selected}
                onSelect={setSelected}
                onOpen={(id) => navigate(`/markets/${id}`)}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One week's stock, as a card.
 *
 * No quantity stepper and no cart button: a basket is assembled on the order screen in phase
 * 10, and a control that pretends to hold stock the shopper cannot yet reserve is worse than a
 * link that says where to go next.
 */
function FreshCard({ product }: { product: ShowcaseProduct }) {
  const state = stockState(product.quantity);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent/25">
      <Thumb
        src={product.photo}
        seed={product.key}
        category={product.category}
        glyph={product.glyph}
        label={product.name}
        glyphSize={52}
        className="aspect-[4/3] w-full border-b border-line"
      />

      <span
        className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${
          state.tone === 'ok'
            ? 'bg-accent-soft/90 text-accent'
            : state.tone === 'low'
              ? 'bg-warn/15 text-warn'
              : 'bg-danger/15 text-danger'
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            state.tone === 'ok' ? 'bg-accent' : state.tone === 'low' ? 'bg-warn' : 'bg-danger'
          }`}
        />
        {state.label}
      </span>

      <div className="p-4">
        <h3 className="truncate font-display text-base font-semibold">
          <Link
            to={`/products?q=${encodeURIComponent(product.name)}`}
            className="after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-accent">{product.stall}</p>

        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="num font-display text-lg font-bold">{formatKobo(product.price_kobo)}</span>
          <span className="text-xs text-muted">/{product.unit}</span>
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Stars value={product.rating_avg} count={product.rating_count} />
          <span aria-hidden className="text-line">
            ·
          </span>
          <span className="text-xs text-muted">{product.market}</span>
        </div>

        <p className="num mt-3 border-t border-line pt-3 text-xs text-muted">
          {product.quantity} {product.unit}s left
          <span aria-hidden className="text-line">
            {' '}
            ·{' '}
          </span>
          {product.window}
        </p>
      </div>
    </article>
  );
}

function FarmerCard({ farmer }: { farmer: FarmerSummary }) {
  const tradesToday = farmer.operating_days.includes(lagosToday());

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent/25">
      <Thumb
        src={farmer.cover_url}
        seed={farmer.id}
        glyph="basket"
        label={farmer.stall_name}
        glyphSize={44}
        className="aspect-[16/9] w-full border-b border-line"
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-base font-semibold">
            {farmer.stall_name}
          </h3>
          {tradesToday ? (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
              Trades today
            </span>
          ) : null}
        </div>

        <Stars value={farmer.rating_avg} count={farmer.rating_count} className="mt-1.5" />

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {farmer.description ?? 'This stall has not written a description yet.'}
        </p>

        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
          <span aria-hidden className="text-accent/70">
            <Glyph name="clock" size={13} />
          </span>
          {farmer.operating_days.length
            ? `Trades ${dayList(farmer.operating_days)}`
            : 'No published trading days'}
        </p>
      </div>
    </article>
  );
}

function AskPanel() {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    navigate(q ? `/markets?q=${encodeURIComponent(q)}` : '/markets');
  }

  return (
    <aside className="flex flex-col rounded-2xl border border-line bg-elevated/50 p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">Search</p>
      <h3 className="mt-2 font-display text-lg font-bold leading-snug">What are you looking for?</h3>
      <p className="mt-1 text-sm text-muted">
        Type a crop, an area or a market. The results open on the map.
      </p>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <label htmlFor="ask-search" className="sr-only">
          What are you looking for?
        </label>
        <input
          id="ask-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. fresh tomatoes near Lekki"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 text-sm text-primary outline-none transition placeholder:text-muted/60 focus:border-accent"
        />
        <button
          type="submit"
          aria-label="Search"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-ink transition hover:brightness-110"
        >
          <Glyph name="send" size={17} />
        </button>
      </form>

      <ul className="mt-4 flex flex-col gap-1.5">
        {QUICK_LINKS.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-primary/90 transition-colors hover:border-accent/40 hover:text-accent"
            >
              {link.label}
              <span aria-hidden className="text-muted">
                <Glyph name="arrow" size={14} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function Home() {
  const farmers = useFarmerList({});
  const stalls = farmers.data?.data ?? [];

  return (
    <div className="pb-24">
      <Hero />
      <MarketsNearYou />

      <section className="mx-auto mt-16 max-w-7xl px-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Fresh this week</h2>
            <p className="mt-1 text-sm text-muted">
              Seasonal produce, published by the stall that grew it.
            </p>
          </div>
          <Link to="/products" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </header>

        <Reveal className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" y={16} stagger={0.05}>
          {FRESH_THIS_WEEK.map((product) => (
            <FreshCard key={product.key} product={product} />
          ))}
        </Reveal>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Meet the farmers</h2>
            <p className="mt-1 text-sm text-muted">Real stalls. Their own words. Rated by buyers.</p>
          </div>
          <Link to="/farmers" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {farmers.isPending ? (
            <SkeletonRow count={3} className="grid gap-4 sm:grid-cols-3" />
          ) : farmers.error ? (
            <div className="lg:col-span-2">
              <StateNote
                label="The stall list did not load"
                body="The markets below are unaffected — this request alone failed."
                retry={() => void farmers.refetch()}
              />
            </div>
          ) : (
            <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" y={16} stagger={0.05}>
              {stalls.slice(0, 3).map((farmer) => (
                <FarmerCard key={farmer.id} farmer={farmer} />
              ))}
            </Reveal>
          )}

          <AskPanel />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-surface p-6 md:p-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl font-bold">Run a stall at one of these markets?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Publish what you harvested, set the quantities you are willing to hold, and stop
              selling the same basket to whoever got there first. Listing is free; an admin checks
              the stall before it appears to shoppers.
            </p>
          </div>
          <Link to="/signup" className={buttonClass('primary', 'md', 'shrink-0')}>
            List your stall
          </Link>
        </div>
      </section>
    </div>
  );
}
