import { Link } from 'react-router-dom';
import { Thumb } from '../art/Thumb';
import type { Market, NearbyMarket, PlaceCandidate } from '../../lib/types';
import { formatDistance } from '../../utils/distance';
import { TradingDays } from './pieces';
import { mapboxSatellitePreview } from '../../lib/mapboxImagery';


export function MarketCard({
  market,
  selected = false,
  prominent = false,
  linkToMarket = true,
  onFocus,
  onShowMap,
}: {
  market: Market | NearbyMarket;
  selected?: boolean;
  prominent?: boolean;
  linkToMarket?: boolean;
  /** Move the adjacent map when this row is hovered or keyboard-focused. */
  onFocus?: () => void;
  /** Show this market in the map view, primarily for the phone list. */
  onShowMap?: () => void;
}) {
  const distance = 'distance_km' in market ? market.distance_km : null;
  const satellitePreview = market.image_url ? null : mapboxSatellitePreview(market.lng, market.lat);

  return (
    <article
      aria-current={selected || undefined}
      tabIndex={onFocus ? 0 : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onFocus?.();
      }}
      onFocus={onFocus}
      className={`market-card motion-card group relative w-full min-w-0 rounded-2xl border p-1.5 transition-[background,border-color,box-shadow] duration-200 sm:p-3.5 ${
        selected ? 'border-accent/45 bg-accent-soft/45 shadow-[0_8px_24px_rgba(21,39,29,0.08)]' : 'border-line bg-surface'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 sm:gap-5 ${prominent ? 'py-0.5 sm:py-1.5' : 'py-0.5 sm:py-1'}`}
      >
        <div className="shrink-0">
          <Thumb
            src={market.image_url ?? satellitePreview}
            seed={market.id}
            glyph="farm"
            label={satellitePreview && !market.image_url ? `Satellite view of ${market.name}` : market.name}
            glyphSize={prominent ? 48 : 36}
            className={`rounded-xl ${prominent ? 'h-14 w-16 sm:h-28 sm:w-44' : 'h-14 w-16 sm:h-28 sm:w-44'}`}
          />
          {satellitePreview ? <p className="mt-1 max-w-36 truncate text-[10px] text-muted">Satellite view · Mapbox</p> : null}
        </div>

        <div className="min-w-0 flex-1 py-1">
          <h3
            className={`font-display leading-tight ${
              prominent
                ? 'text-xl font-semibold sm:text-2xl'
                : 'text-base font-semibold sm:text-[1.0625rem]'
            }`}
          >
            {linkToMarket ? (
              <Link to={`/markets/${market.id}`} className="after:absolute after:inset-0">
                {market.name}
              </Link>
            ) : market.name}
          </h3>

          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-[11px] text-muted sm:mt-1 sm:text-sm">{market.address} · {market.city}</p>
            {onShowMap ? <button type="button" onClick={onShowMap} className="relative z-10 min-h-7 shrink-0 rounded-full border border-line px-2 text-[10px] font-semibold text-accent transition hover:bg-accent-soft sm:hidden">Map</button> : null}
          </div>

          <TradingDays
            days={market.operating_days}
            opensAt={market.opens_at}
            closesAt={market.closes_at}
            className={`hidden text-muted sm:block ${prominent ? 'mt-2.5' : 'mt-1.5'}`}
          />
        </div>

        {distance !== null ? (
          <div className="relative z-10 hidden shrink-0 sm:block">
            <span
              className={`num text-lg font-semibold leading-none text-primary ${
                prominent ? 'text-2xl' : ''
              }`}
            >
              {formatDistance(distance)}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Where a mapped place says it is, when it says anything at all. */
function placeLine(place: PlaceCandidate): string {
  return place.address || [place.city, place.state, place.country].filter(Boolean).join(', ');
}

/**
 * A marketplace the map knows and this database does not, set in the same row as ours.
 *
 * Same plate, same title scale, same right-hand column — the difference is what the row declines
 * to claim. OpenStreetMap itself carries no photos, no opening hours and no address tags for most
 * of these nodes, so the trading line is still replaced by the reason there isn't one. The photo
 * slot can show a confidently name-matched Wikimedia Commons photo, then a clearly labeled
 * regional market photo. A missing photo stays an honest map-pin placeholder.
 *
 * No link over the row either: there is no page here to open, and a market name that answers a
 * click with a 404 is worse than one that answers nothing.
 */
export function PlaceCard({
  place,
  onFocus,
  onShowMap,
}: {
  place: PlaceCandidate;
  /** Present on the map screen, where a ring is the only thing this place has. */
  onFocus?: () => void;
  onShowMap?: () => void;
}) {
  const where = placeLine(place);
  return (
    <article
      className="w-full min-w-0 rounded-2xl border border-line bg-surface p-1.5 sm:p-3.5"
      tabIndex={onFocus ? 0 : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onFocus?.();
      }}
      onFocus={onFocus}
    >
      <div className="flex items-center gap-2 sm:gap-5">
        <div className="w-16 shrink-0 sm:w-44">
          <Thumb
            src={place.image_url}
            seed={place.ref}
            glyph="pin"
            label={place.image_kind === 'regional'
              ? `${place.image_region ?? 'Regional'} market photo; ${place.name} is marked nearby`
              : place.name}
            glyphSize={36}
            className="h-14 w-16 rounded-xl sm:h-28 sm:w-44"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold leading-tight sm:text-[1.0625rem]">
            {place.name}
          </h3>

          {where !== '' ? <p className="mt-1 truncate text-sm text-muted">{where}</p> : null}

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-muted sm:text-sm">On the map, not on MarketLink yet</p>
            {onShowMap ? <button type="button" onClick={onShowMap} className="relative z-10 min-h-7 shrink-0 rounded-full border border-line px-2 text-[10px] font-semibold text-accent transition hover:bg-accent-soft">Map</button> : null}
          </div>
        </div>

      </div>
    </article>
  );
}

/** A row that is still waiting for its data, holding the list's height so nothing jumps. */
export function MarketCardSkeleton() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5 sm:gap-5 sm:p-3.5" aria-hidden>
      <div className="h-14 w-16 shrink-0 rounded-xl bg-elevated sm:h-28 sm:w-44" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-2/5 rounded-[2px] bg-elevated" />
        <div className="mt-2 h-3 w-3/5 rounded-[2px] bg-elevated/70" />
        <div className="mt-3 h-3 w-28 rounded-[2px] bg-elevated/70" />
      </div>
    </div>
  );
}
