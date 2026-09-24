import { Link } from 'react-router-dom';
import { Thumb } from '../art/Thumb';
import type { Market, NearbyMarket } from '../../lib/types';
import { formatDistance } from '../../utils/distance';
import { OpenState, TradingDays } from './pieces';

/**
 * One market, as a row on the board.
 *
 * The whole row is a link, laid over the content with an absolutely positioned anchor rather
 * than by wrapping the row in an `<a>`: that keeps the address and the trading line as real text
 * nodes for a screen reader, with one named destination. Anything inside it that is itself a
 * control has to be positioned, or that overlay paints over it and takes the click.
 *
 * `prominent` is how the landing page gives its nearest market weight without inventing a second
 * component: the same row, set larger.
 */
export function MarketCard({
  market,
  selected = false,
  prominent = false,
  onFocus,
}: {
  market: Market | NearbyMarket;
  selected?: boolean;
  prominent?: boolean;
  /** Present on the map screen, where pointing at a pin is a different act than opening it. */
  onFocus?: () => void;
}) {
  const distance = 'distance_km' in market ? market.distance_km : null;

  return (
    <article
      aria-current={selected || undefined}
      className={`group relative border-t border-line transition-colors ${
        selected ? 'bg-accent-soft/50' : 'hover:bg-elevated/45'
      }`}
    >
      <div
        className={`flex items-start gap-4 sm:gap-5 ${prominent ? 'py-5 sm:py-6' : 'py-4'}`}
      >
        <Thumb
          src={market.image_url}
          seed={market.id}
          glyph="farm"
          label={market.name}
          glyphSize={prominent ? 32 : 26}
          className={`shrink-0 rounded-[2px] ${
            prominent ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-16 w-16 sm:h-[72px] sm:w-[72px]'
          }`}
        />

        <div className="min-w-0 flex-1">
          <h3
            className={`font-display leading-tight ${
              prominent
                ? 'text-xl font-semibold sm:text-2xl'
                : 'text-base font-semibold sm:text-[1.0625rem]'
            }`}
          >
            <Link to={`/markets/${market.id}`} className="after:absolute after:inset-0">
              {market.name}
            </Link>
          </h3>

          <p className="mt-1 truncate text-sm text-muted">
            {market.address} · {market.city}
          </p>

          <TradingDays
            days={market.operating_days}
            opensAt={market.opens_at}
            closesAt={market.closes_at}
            className={`text-muted ${prominent ? 'mt-2.5' : 'mt-1.5'}`}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {distance !== null ? (
            <span
              className={`num text-lg font-semibold leading-none text-primary ${
                prominent ? 'text-2xl' : ''
              }`}
            >
              {formatDistance(distance)}
            </span>
          ) : null}

          <OpenState open={market.is_open_now} />

          {onFocus ? (
            <button
              type="button"
              onClick={onFocus}
              className="relative mt-1 text-xs text-muted underline decoration-line underline-offset-2 transition-colors hover:text-primary hover:decoration-accent"
            >
              Show on map
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A row that is still waiting for its data, holding the list's height so nothing jumps. */
export function MarketCardSkeleton() {
  return (
    <div className="flex items-start gap-4 border-t border-line py-4" aria-hidden>
      <div className="h-16 w-16 shrink-0 rounded-[2px] bg-elevated sm:h-[72px] sm:w-[72px]" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-2/5 rounded-[2px] bg-elevated" />
        <div className="mt-2 h-3 w-3/5 rounded-[2px] bg-elevated/70" />
        <div className="mt-3 h-3 w-28 rounded-[2px] bg-elevated/70" />
      </div>
    </div>
  );
}
