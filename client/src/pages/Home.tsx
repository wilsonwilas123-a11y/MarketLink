import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Glyph, type GlyphName } from '../components/art/glyphs';
import { Thumb } from '../components/art/Thumb';
import { MarketCard, MarketCardSkeleton } from '../components/discovery/MarketCard';
import { SkeletonRow, StateNote } from '../components/discovery/StateNote';
import { OpenState, Stars } from '../components/discovery/pieces';
import { buttonClass } from '../components/ui/Button';
import { chipClass } from '../components/ui/Chip';
import { LAGOS, dayList, lagosClock, lagosToday, useFarmerList, useNearbyMarkets } from '../lib/discovery';
import { CATEGORIES, FRESH_THIS_WEEK } from '../lib/showcase';
import type { ShowcaseProduct } from '../lib/showcase';
import type { FarmerSummary } from '../lib/types';
import { prefersReducedMotion, Reveal } from '../motion/reveal';

/**
 * The landing screen.
 *
 * The brand line is farm-first and market-second: the farm is where the food comes from, the
 * market is only where it changes hands. The photograph carries that claim, so the copy sits on
 * top of it rather than beside a second column of marketing text: one idea, one image, and the
 * two calls to action a first-time visitor can actually take. Everything below the fold is live
 * data — the markets, the map, the farms — because the app's whole argument is that this week's
 * stock is knowable.
 */
const MarketMap = lazy(() => import('../components/discovery/MarketMap'));

/** A fix on Lekki Phase 1, so a first-time visitor can see the distance query work at all. */
const LEKKI = { lat: 6.4551, lng: 3.3795 };

const QUICK_LINKS: { label: string; to: string; glyph: GlyphName }[] = [
  { label: 'Open right now', to: '/markets?open=1', glyph: 'clock' },
  { label: 'Saturday markets', to: '/markets?day=sat', glyph: 'stall' },
  { label: 'Near Lekki Phase 1', to: `/markets?lat=${LEKKI.lat}&lng=${LEKKI.lng}&radius=10`, glyph: 'pin' },
  { label: 'All markets', to: '/markets', glyph: 'grid' },
];

/** Each category's mark carries its own tone, so the row reads as produce and not as tags. */
const CATEGORY_TONE: Record<string, string> = {
  vegetables: 'text-accent',
  fruits: 'text-warn',
  dairy: 'text-primary',
  bakery: 'text-warn',
  herbs: 'text-accent',
};

/**
 * The chip recipe, given a sheet to stand on.
 *
 * These chips sit on the photograph, where the recipe's pencil-grey type on nothing is
 * unreadable. They take the same dark glass the search bar uses, so the band reads as one
 * control surface with the photo behind it rather than six stickers on top.
 *
 * Every colour below carries the important marker because the recipe declares the same four
 * properties, and a class sitting later in the list does not beat a rule sitting later in the
 * stylesheet — Tailwind orders the sheet, not your JSX.
 */
const CHIP_ON_PHOTO =
  'border-paper/25! bg-ink/55! text-paper! backdrop-blur hover:border-paper/50! hover:text-paper!';

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
      {/* The photograph is the landing band, cropped at source so the farmer stands right of
          centre and the copy has the left half to itself. This is the one band the black sheet
          does not reach — the hero is the photo, and the type on it is white. The band is much
          wider than he is, so the object position keeps his face and the crate in the slice. */}
      <picture>
        <source srcSet="/img/hero-farmer.webp" type="image/webp" />
        <img
          src="/img/hero-farmer.jpg"
          alt="A farmer at the head of his row, holding a crate of just-picked vegetables"
          width={1200}
          height={728}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[55%_30%]"
        />
      </picture>

      <div className="mx-auto flex w-full max-w-[1680px] flex-col px-6 pb-14 pt-16 md:px-10 md:pb-20 md:pt-24">
        <div className="max-w-2xl lg:max-w-xl">
          <Reveal className="flex flex-col" y={12} stagger={0.07}>
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium uppercase tracking-[0.14em] text-paper [text-shadow:0_1px_1px_rgba(0,0,0,0.9),0_0_14px_rgba(0,0,0,0.6)]">
              Connecting local farms
              <span aria-hidden className="text-accent-lift">
                →
              </span>
              your market
            </p>

            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.12] text-paper md:text-5xl [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_12px_rgba(0,0,0,0.7),0_2px_24px_rgba(0,0,0,0.7)]">
              <span className="block">From the farm</span>
              <span className="mt-1.5 flex items-center gap-3">
                <Glyph name="arrow" size={22} className="shrink-0 text-paper/60" />
                <span>to the market</span>
              </span>
              <span className="mt-1.5 flex items-center gap-3 text-accent-lift">
                <Glyph name="arrow" size={22} className="shrink-0 opacity-70" />
                <span>to you</span>
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-paper md:text-lg [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_10px_rgba(0,0,0,0.8),0_2px_18px_rgba(0,0,0,0.75)]">
              Every listing here is written by the farm that grew it. See what is actually left
              this week, reserve it against a pickup window, and pay the grower at the market.
              Nothing is charged online.
            </p>

            {/* One pill holding the field and its action: in the reference the button is the
                right end of the search bar, not a separate control standing beside it. */}
            <form
              onSubmit={submit}
              className="mt-8 flex w-full max-w-2xl items-center gap-2 rounded-full border border-paper/20 bg-ink/55 p-2 backdrop-blur-md [text-shadow:none] focus-within:border-accent"
            >
              <label htmlFor="hero-search" className="sr-only">
                Search markets, farmers or produce
              </label>
              <input
                id="hero-search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search markets, farmers or produce…"
                className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-base text-paper outline-none placeholder:text-paper/55"
              />
              <button
                type="submit"
                aria-label="Search"
                className={buttonClass('primary', 'md', 'h-11 w-16 shrink-0 p-0!')}
              >
                <Glyph name="search" size={21} />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/markets"
                className={buttonClass('primary', 'md', 'h-11 gap-2.5 px-6 text-base')}
              >
                <Glyph name="leaf" size={18} />
                Explore markets
                <Glyph name="arrow" size={17} />
              </Link>
              <Link
                to="/products"
                className={buttonClass(
                  'ghost',
                  'md',
                  'h-11 gap-2.5 border-paper/35! bg-ink/45! px-6 text-base backdrop-blur hover:border-paper/70!',
                )}
              >
                <Glyph name="basket" size={18} className="text-accent-lift" />
                Browse produce
                <Glyph name="arrow" size={17} />
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Link key={c.slug} to={`/products?category=${c.slug}`} className={chipClass(false, CHIP_ON_PHOTO)}>
                  <Glyph name={c.glyph} size={15} className={CATEGORY_TONE[c.slug] ?? 'text-paper'} />
                  {c.name}
                </Link>
              ))}
              <Link to="/products" className={chipClass(false, CHIP_ON_PHOTO)}>
                <Glyph name="grid" size={15} />
                More
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      <span className="absolute right-5 top-6 hidden -rotate-3 rounded-lg border border-accent-lift/40 bg-ink/80 px-3 py-1.5 font-display text-xs font-semibold text-accent-lift backdrop-blur md:block">
        Local farms. Market pickup.
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
    <section className="mx-auto mt-16 w-full max-w-[1680px] px-6 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-line pt-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Where the farms sell
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold">Markets near you</h2>
          <p className="mt-1 text-sm text-muted">
            <LiveStrip total={nearby.data?.meta.total ?? 0} open={open} />
          </p>
        </div>
        <Link to="/markets" className="text-sm text-accent hover:underline">
          Open the full map
        </Link>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,46%)]">
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

        <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-line lg:min-h-full">
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

          {/* The two colours a pin can hold. The selected pin is amber, but it is the pin you
              just clicked, so it needs no key. */}
          <ul className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg border border-line bg-sheet/85 px-2.5 py-1.5 text-xs text-muted backdrop-blur">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              Open now
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-muted" />
              Shut now
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/** How long one listing holds the band before the next fades in over it. */
const SLIDE_HOLD_MS = 4_500;

/**
 * The produce band, which is one photograph at a time.
 *
 * The header sits above the picture styled exactly like the markets and farmers headers, because the
 * band is a section of the page and not a poster to be captioned. Below it the photograph carries no
 * type at all: nothing has to be read off it, and a picture of produce argues for the farm better
 * than a price printed across its own face. It is framed like the map well rather than run to the
 * edges of the window, so it keeps the page's column and the sections line up.
 *
 * Every few seconds the next picture arrives over the last one, and a pointer resting anywhere in
 * the band stops the rotation so whoever is looking at one can finish looking. Opacity carries the
 * change and nothing else, because a slide or a zoom is the motion that reads as a template.
 *
 * No quantity stepper and no cart button: a basket is assembled on the order screen in phase 10,
 * and a control that pretends to hold stock the shopper cannot yet reserve is worse than a link
 * that says where to go next.
 */
function FreshBand({ products }: { products: ShowcaseProduct[] }) {
  const [step, setStep] = useState(0);
  const [held, setHeld] = useState(false);
  const count = products.length;
  const slide = count === 0 ? 0 : step % count;

  useEffect(() => {
    if (held || count < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % count), SLIDE_HOLD_MS);
    return () => window.clearInterval(timer);
  }, [held, count]);

  if (count === 0) return null;

  return (
    <section className="mx-auto mt-16 w-full max-w-[1680px] px-6 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-line pt-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Straight from the farm
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold">Fresh this week</h2>
          <p className="mt-1 text-sm text-muted">
            Seasonal produce, published by the farm that grew it.
          </p>
        </div>
        <Link to="/products" className="text-sm text-accent hover:underline">
          Browse everything
        </Link>
      </header>

      <div
        className="relative mt-5 min-h-[30rem] overflow-hidden rounded-2xl border border-line md:min-h-[40rem]"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
      >
        {/* Every photograph stays mounted and the band moves them by opacity, so a change is a
            crossfade between two pictures rather than one picture being replaced. They are marked
            decorative: the picture shows what the header has already named. The band is far wider
            than any of these photographs, so each row says which slice of itself to keep. */}
        <div aria-hidden className="absolute inset-0">
          {products.map((product, i) => (
            <div
              key={product.key}
              className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                i === slide ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Thumb
                src={product.photo}
                seed={product.key}
                category={product.category}
                glyph={product.glyph}
                glyphSize={96}
                imgClass={product.focus}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FarmerCard({ farmer }: { farmer: FarmerSummary }) {
  const tradesToday = farmer.operating_days.includes(lagosToday());

  return (
    <li className="w-[272px] shrink-0 snap-start sm:w-[302px]">
      <article className="relative flex h-full snap-start flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent/25">
        <Thumb
          src={farmer.cover_url}
          seed={farmer.id}
          glyph="farm"
          label={farmer.stall_name}
          glyphSize={44}
          className="aspect-[4/3] w-full border-b border-line"
        />
        {tradesToday ? (
          <span className="absolute left-3 top-3 rounded-full bg-sheet/85 px-2 py-0.5 text-[11px] font-medium text-accent backdrop-blur">
            Trades today
          </span>
        ) : null}

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-base font-semibold leading-snug">
            <Link to={`/farmers/${farmer.id}`} className="after:absolute after:inset-0">
              {farmer.stall_name}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-muted">Run by {farmer.contact_person}</p>

          <Stars value={farmer.rating_avg} count={farmer.rating_count} className="mt-2" />

          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
            {farmer.description ?? 'This farm has not written a description yet.'}
          </p>

          <p className="mt-auto flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
            <span aria-hidden className="text-accent/70">
              <Glyph name="clock" size={13} />
            </span>
            {farmer.operating_days.length
              ? `Trades ${dayList(farmer.operating_days)}`
              : 'No published trading days'}
          </p>
        </div>
      </article>
    </li>
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
    <aside className="grid gap-6 rounded-2xl border border-line bg-elevated/50 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-center md:p-6">
      <div>
        <h3 className="font-display text-lg font-bold leading-snug">
          What are you looking for this week?
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted">
          Type a crop, an area or a market. The results open on the map, with each farm&apos;s
          own stock beside it.
        </p>

        <form onSubmit={submit} className="mt-4 flex max-w-md gap-2">
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
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Or start from
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.label}>
              <Link to={link.to} className={chipClass()}>
                <Glyph name={link.glyph} size={15} className="text-accent" />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
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

      <FreshBand products={FRESH_THIS_WEEK} />

      <section className="mx-auto mt-16 w-full max-w-[1680px] px-6 md:px-10">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-line pt-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              The farms
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold">Meet the farmers</h2>
            <p className="mt-1 text-sm text-muted">
              Real farms. Their own words. Rated by the people who buy.
            </p>
          </div>
          <Link to="/farmers" className="text-sm text-accent hover:underline">
            All {farmers.data?.meta.total ?? 'registered'} farms
          </Link>
        </header>

        {farmers.isPending ? (
          <SkeletonRow count={3} className="mt-6 grid gap-4 sm:grid-cols-3" />
        ) : farmers.error ? (
          <div className="mt-6">
            <StateNote
              label="The farm list did not load"
              body="The markets above are unaffected — this request alone failed."
              retry={() => void farmers.refetch()}
            />
          </div>
        ) : (
          <>
            <Reveal
              as="ul"
              className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-6 pb-2 md:scroll-pl-10"
              y={14}
              stagger={0.05}
            >
              {stalls.slice(0, 4).map((farmer) => (
                <FarmerCard key={farmer.id} farmer={farmer} />
              ))}
            </Reveal>

            <p className="mt-2 text-xs text-muted">
              Scroll sideways for the rest of this week&apos;s approved farms.
            </p>
          </>
        )}
      </section>

      <section className="mx-auto mt-14 w-full max-w-[1680px] px-6 md:px-10">
        <AskPanel />
      </section>

      <section className="mx-auto mt-14 w-full max-w-[1680px] px-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-surface p-6 md:p-8">
          <div className="max-w-xl">
            <h2 className="font-display text-xl font-bold">
              Farming within reach of these markets?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Publish what you harvested, set the quantities you are willing to hold, and stop
              selling the same basket to whoever got there first. Listing is free; an admin checks
              the farm before it appears to shoppers.
            </p>
          </div>
          <Link to="/signup" className={buttonClass('primary', 'md', 'shrink-0')}>
            List your farm
          </Link>
        </div>
      </section>
    </div>
  );
}
