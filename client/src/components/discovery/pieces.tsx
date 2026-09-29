import { Glyph } from '../art/glyphs';
import { clock, daysPhrase } from '../../lib/discovery';


export function TradingDays({
  days,
  opensAt,
  closesAt,
  className = '',
}: {
  days: string[];
  opensAt?: string | null;
  closesAt?: string | null;
  className?: string;
}) {
  const hours =
    opensAt && closesAt ? `, ${clock(opensAt)}–${clock(closesAt)}` : '';

  return (
    <p className={`text-sm text-muted ${className}`}>
      Trades {daysPhrase(days)}
      {hours}
    </p>
  );
}

/**
 * Whether the market's own row says it is trading at this moment.
 *
 * The answer comes from the API rather than from the visitor's clock: `is_open_now` is computed
 * against `Africa/Lagos` in SQL, so a shopper in London sees Lagos hours and the list, the map
 * and the landing panel all agree.
 *
 * This is the one fact on a market row worth colour for, so the sign blue is spent here and
 * nowhere else on the card. Shut is deliberately quiet — it is not a warning, just not now.
 */
export function OpenState({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 text-sm font-semibold ${
        open ? 'text-accent' : 'text-muted font-normal'
      } ${className}`}
    >
      {open ? 'Open now' : 'Shut now'}
    </span>
  );
}

/**
 * A rating as a number and a count, in the size the number deserves.
 *
 * The count is spelled out for a screen reader because "4.7" on its own is a number with no
 * unit, and three ratings out of a hundred and fifty-six are not the same claim.
 */
export function Stars({
  value,
  count,
  className = '',
}: {
  value: number;
  count: number;
  className?: string;
}) {
  if (count === 0) {
    return <span className={`text-sm text-current/60 ${className}`}>No ratings yet</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="text-accent">
        <Glyph name="star" size={15} />
      </span>
      <span className="num text-[15px] font-bold">{value.toFixed(1)}</span>
      <span aria-hidden className="h-3.5 w-px bg-line" />
      <span className="num text-[15px] text-muted">{count}</span>
      <span className="sr-only">
        {value.toFixed(1)} out of 5 from {count} {count === 1 ? 'review' : 'reviews'}
      </span>
    </span>
  );
}
