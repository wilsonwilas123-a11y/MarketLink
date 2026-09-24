import { Glyph } from '../art/glyphs';
import { WEEK } from '../../lib/discovery';

/**
 * A market's week as a seven-cell strip.
 *
 * A row of day chips reads as a list of tags and takes a line each; the strip answers "is it
 * trading Saturday?" by shape, in the width of a name. Two letters rather than one because
 * `T` and `S` between them stand for five days.
 */
export function WeekStrip({ days, className = '' }: { days: string[]; className?: string }) {
  const on = WEEK.filter((d) => days.includes(d.code));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden className="flex overflow-hidden rounded-md border border-line">
        {WEEK.map((d) => {
          const trades = days.includes(d.code);
          return (
            <span
              key={d.code}
              className={`px-1 py-0.5 text-[10px] font-medium leading-none tracking-tight ${
                trades ? 'bg-accent-soft text-accent' : 'bg-elevated/40 text-muted/40'
              }`}
            >
              {d.short.slice(0, 2)}
            </span>
          );
        })}
      </span>
      <span className="sr-only">
        {on.length === 0
          ? 'No published trading days'
          : `Trades ${on.map((d) => d.label).join(', ')}`}
      </span>
    </div>
  );
}

/**
 * Whether the market's own row says it is trading at this moment.
 *
 * The answer comes from the API rather than from the visitor's clock: `is_open_now` is computed
 * against `Africa/Lagos` in SQL, so a shopper in London sees Lagos hours and the list, the map
 * and the landing panel all agree.
 */
export function OpenState({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${className}`}>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          open ? 'bg-accent motion-safe:animate-pulse' : 'bg-muted/40'
        }`}
      />
      <span className={open ? 'text-accent' : 'text-muted'}>{open ? 'Open now' : 'Shut now'}</span>
    </span>
  );
}

/**
 * A rating as the mockups draw it: star, average, count.
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
    return <span className={`text-xs text-muted ${className}`}>No ratings yet</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span aria-hidden className="text-warn">
        <Glyph name="star" size={13} />
      </span>
      <span className="num text-xs font-medium text-primary">{value.toFixed(1)}</span>
      <span className="num text-xs text-muted">({count})</span>
      <span className="sr-only">
        {value.toFixed(1)} out of 5 from {count} {count === 1 ? 'review' : 'reviews'}
      </span>
    </span>
  );
}
