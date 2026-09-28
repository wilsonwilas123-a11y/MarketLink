import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketCard, PlaceCard } from '../components/discovery/MarketCard';
import { StateNote } from '../components/discovery/StateNote';
import type { MarketMapHandle } from '../components/discovery/MarketMap';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import {
  LAGOS,
  WEEK,
  marketBox,
  useMarketList,
  useMarketPlaces,
  useMarketsInBox,
  useNearbyMarkets,
  type MarketFilters,
} from '../lib/discovery';
import type { Market, NearbyMarket, PlaceCandidate, Weekday } from '../lib/types';
import { Reveal } from '../motion/reveal';

/**
 * Market discovery: the list and the map, over one set of filters.
 *
 * The filters live in the URL rather than in component state. That is what makes a link to
 * `?day=sat` mean the same thing to the person it was sent to, what makes the back button
 * undo a filter rather than leave the screen, and what forces the list and the map to read
 * the same answer instead of each keeping its own copy of the question.
 *
 * Leaflet is loaded on demand. It is the heaviest thing on this page, a visitor who only
 * scrolls the list never needs it, and the map shows nothing useful without tiles from the
 * network anyway — so there is no first paint worth blocking for it.
 */
const MarketMap = lazy(() => import('../components/discovery/MarketMap'));

const RADII = [5, 10, 25, 50];

function asDay(value: string | null): Weekday | undefined {
  return WEEK.find((d) => d.code === value)?.code;
}

function asNumber(value: string | null): number | undefined {
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Whether the map's place is one of ours under another name.
 *
 * An OSM node called `Bodija Market` and a row called `Bodija` are the same gate, and listing
 * both reads as a market we have not got round to approving. Names are stripped to lowercase
 * alphanumerics with the word `market` dropped, which is the whole of the matching: two
 * genuinely different gates that reduce to the same string are rare enough that showing the
 * duplicate is the cheaper mistake.
 */
function listedAlready(place: PlaceCandidate, markets: (Market | NearbyMarket)[]): boolean {
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/market$/, '');
  const mine = key(place.name);
  return markets.some((m) => key(m.name) === mine);
}

export default function Markets() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mapRef = useRef<MarketMapHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  /** Which half of the small-screen pair is showing: a view preference, not shareable state. */
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [where, setWhere] = useState<string | null>(null);
  const [visiblePlaceCount, setVisiblePlaceCount] = useState(16);

  const q = params.get('q') ?? '';
  const city = params.get('city') ?? '';
  const day = asDay(params.get('day'));
  const openNow = params.get('open') === '1';
  const radius = asNumber(params.get('radius')) ?? 10;
  const lat = asNumber(params.get('lat'));
  const lng = asNumber(params.get('lng'));
  const nearby = lat !== undefined && lng !== undefined;

  // Typed text is held locally and only written to the URL on submit. Patching the URL on
  // every keystroke would push a query per character and put a page in the history for each
  // one, so the back button would undo a letter at a time.
  const [qDraft, setQDraft] = useState(q);
  const [cityDraft, setCityDraft] = useState(city);
  useEffect(() => setQDraft(q), [q]);
  useEffect(() => setCityDraft(city), [city]);

  const filters: MarketFilters = { q: q || undefined, city: city || undefined, day, openNow };

  const list = useMarketList(filters);
  const near = useNearbyMarkets({
    lat: lat ?? LAGOS.lat,
    lng: lng ?? LAGOS.lng,
    radiusKm: radius,
    day,
    openNow,
    enabled: nearby,
  });

  const active = nearby ? near : list;
  const markets: (Market | NearbyMarket)[] = active.data?.data ?? [];

  // The gazetteer is asked with whatever word the visitor typed, in either box: `Lagos` in the
  // city field is the same question as `Lagos` in the search field. Before there is a word to
  // ask with, the question is asked by area instead — the corner of the map being looked at —
  // because a gazetteer ranks a city and answers with the wrong six nodes.
  const typed = [q, city].filter(Boolean).join(' ').trim();
  const byName = typed.length >= 3;
  const centre = nearby ? { lat: lat ?? LAGOS.lat, lng: lng ?? LAGOS.lng } : LAGOS;
  const searched = useMarketPlaces(typed);
  const boxed = useMarketsInBox(marketBox(centre, nearby ? radius : undefined), !byName);
  const places = byName ? searched : boxed;
  const allUnlisted = useMemo(
    () => (places.data ?? []).filter((p) => !listedAlready(p, markets)),
    [places.data, markets],
  );
  const unlisted = useMemo(() => allUnlisted.slice(0, visiblePlaceCount), [allUnlisted, visiblePlaceCount]);

  useEffect(() => setVisiblePlaceCount(16), [q, city, lat, lng, radius]);

  function patch(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    setParams(merged, { replace: true });
  }

  function submitText(event: FormEvent) {
    event.preventDefault();
    patch({ q: qDraft.trim() || undefined, city: cityDraft.trim() || undefined });
  }

  function clearAll() {
    setParams(new URLSearchParams(), { replace: true });
    setSelected(null);
    setWhere(null);
  }

  /**
   * Ask the browser for a position, then move the whole query to it.
   *
   * The coordinates go into the URL rather than into state so the map, the list and the
   * distance labels all answer the same question — and so "markets near me" survives a
   * refresh, which a fix held in a component would not.
   */
  function findMe() {
    setWhere(null);
    if (!navigator.geolocation) {
      setWhere('This browser cannot share a location. Filter by area and day instead.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        patch({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
          radius: String(radius),
        });
      },
      () => {
        setWhere('No location was shared. The list is still filtered by area and day.');
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  function focus(id: string) {
    setSelected(id);
    setMobileView('map');
    mapRef.current?.focus(id);
  }

  const total = active.data?.meta.total ?? 0;
  const hasFilters = Boolean(q || city || day) || openNow;
  const dayLabel = WEEK.find((d) => d.code === day)?.label;

  return (
    <div className="pb-20">
      <header className="mx-auto max-w-7xl px-4 pt-12">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Markets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Every market MarketLink tracks, the days it runs, and the farms trading there.
          Opening state is computed against Lagos time, not your device’s.
        </p>
      </header>

      <section aria-label="Filters" className="mx-auto mt-6 max-w-7xl px-4">
        <form onSubmit={submitText} className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <Input
            label="Search"
            name="q"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Market, area or landmark"
          />
          <Input
            label="City or state"
            name="city"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            placeholder="Lagos"
          />
          <Button type="submit" size="sm" className="sm:col-span-2 sm:justify-self-start">
            Search markets
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Day of the week">
            {WEEK.map((d) => (
              <Chip
                key={d.code}
                active={day === d.code}
                onClick={() => patch({ day: day === d.code ? undefined : d.code })}
              >
                {d.short}
              </Chip>
            ))}
          </div>

          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />

          <Chip active={openNow} onClick={() => patch({ open: openNow ? undefined : '1' })}>
            Open now
          </Chip>

          {nearby ? (
            <span className="flex items-center gap-2 text-sm text-muted">
              within
              <select
                aria-label="Search radius in kilometres"
                value={radius}
                onChange={(e) => patch({ radius: e.target.value })}
                className="h-8 rounded-lg border border-line bg-elevated px-2 text-sm text-primary"
              >
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </select>
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={findMe}>
              {nearby ? 'Update my location' : 'Markets near me'}
            </Button>
            {hasFilters || nearby ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-sm text-muted underline-offset-4 hover:text-primary hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {where ? (
          <p role="status" className="mt-3 text-sm text-warn">
            {where}
          </p>
        ) : null}
      </section>

      <section className="mx-auto mt-6 max-w-7xl px-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="num text-sm text-muted" aria-live="polite">
            {active.isPending
              ? 'Loading markets…'
              : `${total} ${total === 1 ? 'market' : 'markets'}`}
            {!active.isPending && nearby ? ` within ${radius} km` : ''}
            {!active.isPending && dayLabel ? ` on ${dayLabel}` : ''}
          </p>

          <div className="flex overflow-hidden rounded-full border border-line lg:hidden">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMobileView(v)}
                aria-pressed={mobileView === v}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${
                  mobileView === v ? 'bg-accent-soft text-accent' : 'text-muted'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,40%)]">
          <div className={mobileView === 'map' ? 'hidden lg:block' : ''}>
            {active.error ? (
              <StateNote
                label="Markets did not load"
                body="Your filters are unchanged, so retrying is worth a try."
                retry={() => void active.refetch()}
              />
            ) : markets.length === 0 && !active.isPending ? (
              <StateNote
                label="No market matches all of that"
                body={
                  nearby
                    ? 'Nothing trades at that day or hour inside the circle. Widen the radius, or drop the day.'
                    : 'Try a wider term, or clear the day and the open-now filter.'
                }
              />
            ) : (
              <Reveal
                className="flex flex-col gap-3"
                y={10}
                stagger={0.035}
                revealKey={`${q}|${city}|${day ?? ''}|${openNow}|${nearby ? `${lat},${lng},${radius}` : ''}`}
              >
                {markets.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    linkToMarket={false}
                    selected={selected === market.id}
                    onFocus={() => focus(market.id)}
                  />
                ))}
              </Reveal>
            )}

            {unlisted.length > 0 ? (
              <section aria-label="Additional mapped market places" className="mt-10">
                <div>
                  {unlisted.map((place) => (
                    <PlaceCard key={place.ref} place={place} onFocus={() => focus(place.ref)} />
                  ))}
                </div>

                {visiblePlaceCount < allUnlisted.length ? (
                  <div className="mt-4 flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => setVisiblePlaceCount((count) => count + 16)}>
                      Load more places
                    </Button>
                    <span className="text-xs text-muted">Showing {unlisted.length} of {allUnlisted.length}</span>
                  </div>
                ) : null}

                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Names and positions from{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    OpenStreetMap contributors
                  </a>
                  , available under the Open Data Commons ODbL licence.
                </p>
              </section>
            ) : null}
          </div>

          <div
            className={`min-h-[420px] overflow-hidden rounded-2xl border border-line lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] ${
              mobileView === 'list' ? 'hidden lg:block' : ''
            }`}
          >
            <Suspense
              fallback={
                <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
                  Loading the map…
                </div>
              }
            >
              <MarketMap
                ref={mapRef}
                markets={markets}
                places={unlisted}
                origin={nearby ? centre : null}
                selectedId={selected}
                onSelect={setSelected}
                onOpen={(id) => navigate(`/markets/${id}`)}
              />
            </Suspense>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted">
          Looking for a particular stall?{' '}
          <Link to="/farmers" className="text-accent hover:underline">
            Browse the farmers
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
