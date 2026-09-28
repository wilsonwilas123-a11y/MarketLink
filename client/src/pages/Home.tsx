import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Glyph, type GlyphName } from '../components/art/glyphs';
import { Thumb } from '../components/art/Thumb';
import { MarketCard, MarketCardSkeleton } from '../components/discovery/MarketCard';
import { SkeletonRow, StateNote } from '../components/discovery/StateNote';
import { OpenState, Stars } from '../components/discovery/pieces';
import { buttonClass } from '../components/ui/Button';
import { chipClass } from '../components/ui/Chip';
import { LAGOS, lagosClock, lagosToday, useFarmerList, useNearbyMarkets } from '../lib/discovery';
import { CATEGORIES, FRESH_THIS_WEEK } from '../lib/showcase';
import type { ShowcaseProduct } from '../lib/showcase';
import type { FarmerSummary } from '../lib/types';
import { formatKobo } from '../utils/kobo';
import { prefersReducedMotion, Reveal } from '../motion/reveal';
import { farmerCover } from '../lib/farmerPhoto';

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

/** Each category's mark carries its own tone, so the row reads as produce and not as tags. */
const CATEGORY_TONE: Record<string, string> = {
  vegetables: 'text-accent',
  fruits: 'text-warn',
  dairy: 'text-primary',
  bakery: 'text-warn',
  herbs: 'text-accent',
};

/**
 * The four claims the closing band makes, each with the mark that holds it.
 *
 * Every sub-line is something the app actually does rather than a marketing adjective: the
 * farm publishes its own week, listings only appear once an admin has approved the farm,
 * and nothing is charged here so the price on the card is the farm's price.
 */
const DEAL_POINTS: { title: string; body: string; glyph: GlyphName }[] = [
  { title: 'Fresh produce', body: 'Picked the week you order', glyph: 'leaf' },
  { title: 'Trusted farmers', body: 'Approved before they list', glyph: 'shield' },
  { title: 'Local communities', body: 'Lagos farms, Lagos stalls', glyph: 'pin' },
  { title: 'Fair prices', body: 'No middlemen, no commission', glyph: 'tag' },
];

/**
 * The three listings the band shows, by seed key.
 *
 * They are read out of the same showcase rows the produce band above uses, so the price and
 * the stall on each line are the seeded ones and not figures lifted from a mockup.
 */
const DEAL_KEYS = ['tomato-crate', 'ugu-500', 'tatashe-crate'];

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
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      {/* This local farm photograph anchors the landing band. It is mirrored so the farmer
          sits opposite the copy, matching the reference layout while keeping the source image. */}
      <img
        src="/img/farmers/yahaya.jpg"
        alt="A Nigerian farmer tending leafy greens in a field"
        width={1000}
        height={667}
        className="absolute inset-0 -z-10 h-full w-full -scale-x-100 object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-veil/90 via-veil/55 to-veil/10" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-veil/50 to-transparent" />

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
                  'h-11 gap-2.5 border-paper/35! bg-ink/55! px-6 text-base text-paper! backdrop-blur hover:border-paper/70!',
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
const SLIDE_HOLD_MS = 5_600;

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
        <div className="absolute inset-0">
          {products.map((product, i) => (
            <div
              key={product.key}
              className={`absolute inset-0 transition-opacity duration-600 ease-out motion-reduce:transition-none ${
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
    <li className="w-[300px] min-w-0 shrink-0 snap-start sm:w-auto sm:shrink sm:snap-auto">
      <article className="relative flex h-full min-h-[40rem] snap-start flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent/25">
        <Thumb
          src={farmerCover(farmer)}
          seed={farmer.id}
          glyph="farm"
          label={farmer.stall_name}
          glyphSize={72}
          className="h-[260px] w-full shrink-0 border-b border-line sm:h-[280px] xl:h-[300px]"
        />
        {tradesToday ? (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-sheet/90 px-3 py-1.5 text-[13px] font-semibold text-accent backdrop-blur">
            <span aria-hidden>
              <Glyph name="leaf" size={13} />
            </span>
            Trades today
          </span>
        ) : null}

        <div className="flex flex-1 flex-col px-6 py-7 text-primary">
          <h3 className="font-display text-[26px] font-bold leading-[1.15] tracking-tight">
            <Link
              to={`/farmers/${farmer.id}`}
              className="after:absolute after:inset-0 focus-visible:outline-accent"
            >
              {farmer.stall_name}
            </Link>
          </h3>
          <p className="mt-2 text-[15px] text-muted">
            Run by <span className="font-semibold text-accent">{farmer.contact_person}</span>
          </p>

          <Stars value={farmer.rating_avg} count={farmer.rating_count} className="mt-5" />

          <p className="mt-5 min-h-[6.5rem] text-[15px] leading-relaxed text-body">
            {farmer.description ?? 'This farm has not written a description yet.'}
          </p>

          <div aria-hidden className="mt-auto border-t border-line pt-4" />
        </div>
      </article>
    </li>
  );
}

/**
 * The closing band: the week's offers beside the four reasons to order from a farm at all.
 *
 * The three listings are read out of the same showcase rows the produce band above uses, so
 * every price, stall and unit on the right is a seeded one. The farm photograph is a separate
 * feature image from the landing hero, and the overlay sits on the open side of its composition.
 */
function DealsBand({ products }: { products: ShowcaseProduct[] }) {
  const deals = DEAL_KEYS.flatMap((key) => products.filter((p) => p.key === key));

  return (
    <div className="grid gap-8 rounded-2xl border border-line bg-surface p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
      <div className="relative">
        <p aria-hidden className="pointer-events-none absolute right-0 top-0 hidden -rotate-3 text-right font-display text-lg italic leading-snug text-accent lg:block">
          Support local
          <br />
          Grow together
          <span className="ml-auto mt-1.5 block h-px w-28 bg-accent/40" />
        </p>

        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          <span aria-hidden className="h-px w-8 bg-accent" />
          Top picks this week
        </p>
        <h2 className="mt-4 max-w-[18ch] font-display text-[32px] font-bold leading-[1.08] tracking-tight md:text-[40px]">
          Best deals from <span className="text-accent">local farmers</span>
        </h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-body">
          Fresh produce, fair prices, and a farm you can look up. These are the listings Lagos
          stalls have published for this week.
        </p>

        <ul className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DEAL_POINTS.map((point) => (
            <li
              key={point.title}
              className="flex items-start gap-3 rounded-xl border border-line bg-elevated/50 p-4"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
              >
                <Glyph name={point.glyph} size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight">{point.title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-muted">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="relative mt-4 min-h-[19rem] overflow-hidden rounded-2xl border border-line bg-block sm:min-h-[21rem]">
          <Thumb
            src="/img/farmers/harvest-feature.webp"
            seed="deals-banner"
            glyph="farm"
            label="A farmer harvesting leafy greens on a farm"
            imgClass="object-center"
            className="absolute inset-0"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end p-6 text-white md:p-8">
            <div className="max-w-md text-right">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-ink/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] backdrop-blur-sm">
                <Glyph name="sprout" size={14} />
                From farm to market
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Real farmers. Real food.</h3>
              <p className="mt-2 ml-auto max-w-[42ch] text-sm leading-relaxed text-white/85">
                Meet the people growing your food, then find their fresh listings nearby.
              </p>
              <Link
                to="/farmers"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink shadow-lg transition hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Meet our farmers
                <Glyph name="arrow" size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="deals-offers"
        className="flex flex-col rounded-2xl border border-line bg-elevated/40 p-4 md:p-5"
      >
        <header className="flex items-center justify-between gap-4">
          <h3 id="deals-offers" className="flex items-center gap-2 text-[15px] font-semibold">
            <span aria-hidden className="text-accent">
              <Glyph name="basket" size={18} />
            </span>
            This week’s offers
          </h3>
          <Link
            to="/products"
            className="flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
          >
            View all
            <span aria-hidden>
              <Glyph name="arrow" size={14} />
            </span>
          </Link>
        </header>

        <ul className="mt-3 border-t border-line">
          {deals.map((product) => (
            <li key={product.key} className="border-b border-line last:border-b-0">
              <Link
                to="/products"
                className="group flex items-center gap-3 rounded-xl border-b border-line px-2 py-3.5 transition-colors last:border-b-0 hover:bg-surface focus-visible:outline-accent"
              >
                <Thumb
                  src={product.photo}
                  seed={product.key}
                  category={product.category}
                  glyph={product.glyph}
                  glyphSize={26}
                  imgClass={product.focus}
                  className="h-16 w-16 shrink-0 rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">
                    {product.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {product.stall} · {product.market}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-[15px] font-bold text-accent">
                    {formatKobo(product.price_minor)}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">/ {product.unit}</span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  <Glyph name="arrow" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl bg-block p-5 text-on-block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-block/65">Shop close to home</p>
          <p className="mt-2 font-display text-lg font-semibold">Fresh picks, local pickup.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-on-block/75">Explore produce from Mile 12 and Oshodi market sellers.</p>
          <Link
            to="/markets"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-on-block underline decoration-on-block/35 underline-offset-4 transition hover:decoration-on-block focus-visible:outline-accent"
          >
            Find a market
            <Glyph name="arrow" size={15} />
          </Link>
        </div>

        <figure className="relative mt-4 min-h-[15rem] flex-1 overflow-hidden rounded-xl border border-line bg-elevated">
          <img
            src="/img/markets/oshodi.jpg"
            alt="Traders and shoppers among fresh produce stalls at Oshodi market"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent px-5 pb-4 pt-16 text-white">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">The market community</span>
            <span className="mt-1 block font-display text-xl font-semibold">Oshodi, Lagos</span>
          </figcaption>
        </figure>
      </section>
    </div>
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
              Local Farmers, Local Produce
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold">Meet the farmers</h2>
            <p className="mt-1 text-sm text-muted">Discover trusted farms in your community.</p>
          </div>
        </header>

        {farmers.isPending ? (
          <SkeletonRow
            count={3}
            className="mt-6 flex gap-4 overflow-hidden max-sm:pr-6 sm:grid sm:grid-cols-3 sm:gap-6"
            itemClass="h-[40rem] w-[300px] shrink-0 rounded-2xl border border-line bg-surface/50 sm:w-auto sm:shrink"
          />
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
              className="mt-6 flex snap-x gap-4 overflow-x-auto scroll-pl-6 pb-2 max-sm:pr-6 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-x-visible sm:pb-0 md:scroll-pl-10"
              y={14}
              stagger={0.05}
            >
              {stalls.slice(0, 3).map((farmer) => (
                <FarmerCard key={farmer.id} farmer={farmer} />
              ))}
            </Reveal>
          </>
        )}
      </section>

      <section className="mx-auto mt-14 w-full max-w-[1680px] px-6 md:px-10">
        <DealsBand products={FRESH_THIS_WEEK} />
      </section>
    </div>
  );
}
