import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type {
  ApiPage,
  FarmerDetail,
  FarmerSummary,
  Market,
  MarketDetail,
  NearbyMarket,
  PlaceCandidate,
  Weekday,
} from './types';

/**
 * Reads for the discovery screens.
 *
 * Query state lives here rather than in component local state because the filters have to
 * survive a link, a browser back, and the map and the list asking the same question at the
 * same time — and a `?nearby` URL a shopper sends to someone else has to open on the same
 * twelve markets.
 */

/** Lagos's centre, roughly. The map opens here until the browser reports a better fix. */
export const LAGOS = { lat: 6.5244, lng: 3.3792 };

/** A day's short code as the API and the seed both spell it. */
export const WEEK: { code: Weekday; label: string; short: string }[] = [
  { code: 'mon', label: 'Monday', short: 'Mon' },
  { code: 'tue', label: 'Tuesday', short: 'Tue' },
  { code: 'wed', label: 'Wednesday', short: 'Wed' },
  { code: 'thu', label: 'Thursday', short: 'Thu' },
  { code: 'fri', label: 'Friday', short: 'Fri' },
  { code: 'sat', label: 'Saturday', short: 'Sat' },
  { code: 'sun', label: 'Sunday', short: 'Sun' },
];

export interface MarketFilters {
  q?: string;
  city?: string;
  day?: Weekday;
  openNow?: boolean;
  limit?: number;
}

export interface NearbyFilters extends MarketFilters {
  lat: number;
  lng: number;
  radiusKm?: number;
}

/**
 * `undefined` and `false` both drop out. Sending `open_now=false` would be correct but turns
 * every shareable URL into noise, and the server's default is the same as the omission.
 */
export function searchParams(fields: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === false || value === '') continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

export interface Origin {
  lat: number;
  lng: number;
  /** Why this point: a granted fix, or the default. Distances are labelled accordingly. */
  precise: boolean;
}

export const discoveryKeys = {
  markets: (filters: MarketFilters) => ['markets', filters] as const,
  nearby: (filters: NearbyFilters) => ['markets', 'nearby', filters] as const,
  market: (id: string) => ['markets', 'detail', id] as const,
  places: (term: string) => ['places', term] as const,
  placesIn: (bbox: string) => ['places', 'box', bbox] as const,
  farmers: (filters: { marketId?: string; category?: string; q?: string }) =>
    ['farmers', filters] as const,
  farmer: (id: string) => ['farmers', 'detail', id] as const,
};

/**
 * Live, without a reload.
 *
 * A market that an admin approves, or a stall that moves, would otherwise sit invisible on a
 * page a shopper left open. Thirty seconds is short enough to look real-time in a demo and long
 * enough that nobody is charged for staring at a list. TanStack still pauses it when the tab is
 * hidden, and `staleTime` stays at the default zero, so a remount refetches immediately.
 */
export const LIST_POLL_MS = 30_000;

export function useMarketList(filters: MarketFilters) {
  const { api } = useAuth();
  const path = `/markets${searchParams({
    q: filters.q,
    city: filters.city,
    day: filters.day,
    open_now: filters.openNow,
    limit: filters.limit,
  })}`;

  return useQuery({
    queryKey: discoveryKeys.markets(filters),
    queryFn: () => api.get<ApiPage<Market>>(path),
    refetchInterval: LIST_POLL_MS,
  });
}

export function useNearbyMarkets(filters: NearbyFilters & { enabled?: boolean }) {
  const { api } = useAuth();
  const { enabled = true, ...query } = filters;
  const path = `/markets/nearby${searchParams({
    lat: query.lat,
    lng: query.lng,
    radius_km: query.radiusKm,
    day: query.day,
    open_now: query.openNow,
  })}`;

  return useQuery({
    queryKey: discoveryKeys.nearby(query),
    queryFn: () => api.get<ApiPage<NearbyMarket>>(path),
    enabled,
    refetchInterval: LIST_POLL_MS,
  });
}

export const PLACES_STALE_MS = 600_000;

/**
 * `south,west,north,east` around a point, as the map data service wants it.
 *
 * In degrees, because the server's cap is in degrees: the half-span is the radius converted at
 * ~111 km per degree, held under 0.25 so the whole box stays inside what the route will accept,
 * and floored so a five kilometre search still covers a city's worth of gates. Rounded to two
 * decimals — the server memoises on the string, and dragging the map fifty metres is not a new
 * question.
 */
export function marketBox(centre: { lat: number; lng: number }, radiusKm?: number): string {
  const half = radiusKm === undefined ? 0.25 : Math.min(0.25, Math.max(0.05, radiusKm / 111));
  const corner = (value: number): string => value.toFixed(2);
  return [
    corner(centre.lat - half),
    corner(centre.lng - half),
    corner(centre.lat + half),
    corner(centre.lng + half),
  ].join(',');
}

/**
 * The markets in the corner of the map the visitor is looking at.
 *
 * This is what fills the screen before anyone has typed: a gazetteer ranks names, so `Lagos`
 * answers with the city and whatever it happens to have labelled — the probe on 2026-09-26
 * returned six nodes all literally called "Market". Asking for an area is the only way to get
 * the gates that have real names.
 */
export function useMarketsInBox(bbox: string, enabled = true) {
  const { api } = useAuth();

  return useQuery({
    queryKey: discoveryKeys.placesIn(bbox),
    queryFn: () =>
      api.get<PlaceCandidate[]>(`/places/markets/box${searchParams({ bbox, limit: 50 })}`),
    enabled,
    staleTime: PLACES_STALE_MS,
    // Photo matches may have been added since an older cached place list was first loaded.
    // Revalidate when this screen mounts while keeping the server-side upstream cache intact.
    refetchOnMount: 'always',
  });
}

/**
 * Markets the map knows about that this list has not got yet.
 *
 * `q` and `city` are both worth feeding in — a visitor who typed `Ibadan` into the city box is
 * asking the same question as one who typed it into the search box. Below three characters the
 * server answers 400, so the query stays disabled rather than firing on every keystroke.
 *
 * Not polled: the gazetteer changes on the scale of a mapper's week, and the server memoises
 * each term for fifteen minutes, so refetching on a timer would spend neither our patience nor
 * OpenStreetMap's goodwill on an identical answer.
 */
export function useMarketPlaces(term: string | undefined) {
  const { api } = useAuth();
  const query = (term ?? '').trim();

  return useQuery({
    queryKey: discoveryKeys.places(query),
    queryFn: () =>
      api.get<PlaceCandidate[]>(`/places/markets${searchParams({ q: query, limit: 50 })}`),
    enabled: query.length >= 3,
    staleTime: PLACES_STALE_MS,
    refetchOnMount: 'always',
  });
}

export function useMarket(id: string | undefined) {
  const { api } = useAuth();
  return useQuery({
    queryKey: discoveryKeys.market(id ?? ''),
    queryFn: () => api.get<MarketDetail>(`/markets/${id}`),
    enabled: Boolean(id),
  });
}

export function useFarmerList(filters: { marketId?: string; category?: string; q?: string }) {
  const { api } = useAuth();
  const path = `/farmers${searchParams({
    market_id: filters.marketId,
    category: filters.category,
    q: filters.q,
    // The server answers 24 by default and this screen has no pager, so past that the extra
    // stalls simply never appear. 100 is the most the route will hand back.
    limit: 100,
  })}`;

  return useQuery({
    queryKey: discoveryKeys.farmers(filters),
    queryFn: () => api.get<ApiPage<FarmerSummary>>(path),
  });
}

export function useFarmer(id: string | undefined) {
  const { api } = useAuth();
  return useQuery({
    queryKey: discoveryKeys.farmer(id ?? ''),
    queryFn: () => api.get<FarmerDetail>(`/farmers/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * `08:00:00` from Postgres to `8am` for a person.
 *
 * Deliberately not `toLocaleTimeString`: that renders differently on every visitor's device,
 * so two people comparing market hours would see two different answers.
 */
export function clock(time: string): string {
  const [hour, minute] = time.split(':');
  const h = Number(hour);
  const m = Number(minute ?? '0');
  const suffix = h >= 12 ? 'pm' : 'am';
  const face = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${face}${suffix}` : `${face}:${String(m).padStart(2, '0')}${suffix}`;
}

/** `14:36` in Lagos, whatever zone the visitor's device is set to. */
export function lagosClock(): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Lagos',
  }).format(new Date());
}

/**
 * Today in Lagos, as the API spells a weekday.
 *
 * The zone matters: a visitor in Toronto at 20:00 on Friday is asking about a Lagos Saturday,
 * and a stall that trades Saturday would be marked shut.
 */
export function lagosToday(): Weekday {
  const short = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date());
  return WEEK.find((d) => d.short === short)?.code ?? 'mon';
}

/** `sat` and `sun` to `Sat, Sun`, keeping the order the market itself published. */
export function dayList(days: string[]): string {
  return days.map((d) => WEEK.find((w) => w.code === d)?.short ?? d).join(', ');
}

/**
 * The same week as a sentence: `Sat & Sun`, `Tue, Thu & Sat`.
 *
 * A strip of seven cells asks the reader to decode which ones are lit. The market trades two
 * days a week; the sentence is shorter, and it is the size of the fact.
 */
export function daysPhrase(days: string[]): string {
  const named = days.map((d) => WEEK.find((w) => w.code === d)?.short ?? d);
  if (named.length === 0) return 'No published trading days';
  if (named.length === 1) return named[0] ?? '';
  return `${named.slice(0, -1).join(', ')} & ${named.at(-1) ?? ''}`;
}
