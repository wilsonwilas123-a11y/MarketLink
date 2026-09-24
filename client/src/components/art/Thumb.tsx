import { useState } from 'react';
import { glyphFor, Glyph, type GlyphName } from './glyphs';

/**
 * A photo slot that is never empty.
 *
 * `image_url` is null for most seeded rows and a farmer's upload can 404 between a deploy and
 * a cache clear, so every slot here resolves in the same order: the real photo if it loads,
 * line art derived from the row's own id if it does not. The `<img>` is dropped rather than
 * hidden, because a broken image icon inside a card is worse than a card without one.
 */
/**
 * Sources this page has already failed to load.
 *
 * A slot that remounts — the produce carousel re-keys its rows on every slide — would otherwise
 * retry a dead URL and flash a broken image each time it arrives.
 */
const broken = new Set<string>();

export function Thumb({
  src,
  seed,
  category,
  glyph,
  label,
  className = '',
  glyphSize = 34,
}: {
  /** The photo, if the row has one. */
  src?: string | null;
  /** The row's id, so the fallback art is stable for that row. */
  seed: string;
  category?: string | null;
  /** Overrides the category-derived art, for a slot that knows what it depicts. */
  glyph?: GlyphName;
  /** Names the tile to a screen reader when there is no adjacent text doing it. */
  label?: string;
  className?: string;
  glyphSize?: number;
}) {
  const [failed, setFailed] = useState(() => (src ? broken.has(src) : false));
  const show = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden bg-elevated ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {show ? (
        <img
          src={src ?? ''}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            if (src) broken.add(src);
            setFailed(true);
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <span className="ml-plate absolute inset-0" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="ml-plate-mark -rotate-2">
              <Glyph name={glyph ?? glyphFor(seed, category)} size={glyphSize} />
            </span>
          </span>
        </>
      )}
    </div>
  );
}
