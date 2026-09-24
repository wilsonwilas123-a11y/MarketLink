import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type {
  ApiPage,
  FarmerDetail,
  FarmerSummary,
  Market,
  MarketDetail,
  NearbyMarket,
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
