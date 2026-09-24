import { Link } from 'react-router-dom';
import { Thumb } from '../art/Thumb';
import { clock } from '../../lib/discovery';
import type { Market, NearbyMarket } from '../../lib/types';
import { formatDistance } from '../../utils/distance';
import { OpenState, WeekStrip } from './pieces';

/**
 * One market, as a row in the list or a card in the rail.
 *
 * The whole card is a link, laid over the content with an absolutely positioned anchor rather
 * than by wrapping the card in an `<a>`: that keeps the address, the week strip and the hours
 * as real text nodes for a screen reader, with one named destination. Anything inside it that
 * is itself a control has to be positioned, or that overlay paints over it and takes the click.
 */
export function MarketCard({
  market,
  selected = false,
  onFocus,
}: {
  market: Market | NearbyMarket;
  selected?: boolean;
  /** Present on the map screen, where pointing at a pin is a different act than opening it. */
  onFocus?: () => void;
}) {
  const distance = 'distance_km' in market ? market.distance_km : null;

  return (
    <article
      aria-current={selected || undefined}
      className={`group relative flex gap-4 rounded-2xl border p-3 transition-colors sm:p-4 ${
        selected
          ? 'border-accent/45 bg-accent-soft/40'
          : 'border-line bg-surface hover:border-accent/25 hover:bg-elevated/60'
      }`}
    >
      <Thumb
        src={market.image_url}
        seed={market.id}
        glyph="stall"
        label={market.name}
        glyphSize={28}
        className="h-[76px] w-[76px] shrink-0 rounded-xl border border-line sm:h-20 sm:w-20"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold leading-snug">
              <Link to={`/markets/${market.id}`} className="after:absolute after:inset-0">
                {market.name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted">
              {market.address}
              <span className="text-muted/50"> · {market.city}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <OpenState open={market.is_open_now} />
            {distance !== null ? (
              <span className="num text-xs text-accent">{formatDistance(distance)}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <WeekStrip days={market.operating_days} />
          <div className="flex items-center gap-3">
            <span className="num text-xs text-muted">
              {clock(market.opens_at)}–{clock(market.closes_at)}
            </span>
            {onFocus ? (
              <button
                type="button"
                onClick={onFocus}
                className="relative rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                Show on map
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/** A card that is still waiting for its row, holding the rail's height so nothing jumps. */
export function MarketCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4" aria-hidden>
      <div className="h-4 w-2/5 rounded bg-elevated" />
      <div className="mt-2 h-3 w-3/5 rounded bg-elevated/70" />
      <div className="mt-4 h-5 w-32 rounded bg-elevated/50" />
    </div>
  );
}
