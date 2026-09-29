import { useEffect, useState } from 'react';
import { glyphFor, Glyph, type GlyphName } from './glyphs';



const broken = new Set<string>();

export function Thumb({
  src,
  fallbackSrc,
  seed,
  category,
  glyph,
  label,
  className = '',
  glyphSize = 34,
  imgClass = '',
}: {
  /** The photo, if the row has one. */
  src?: string | null;
  /** A known-good local/category photo to try if the primary image cannot load. */
  fallbackSrc?: string | null;
  /** The row's id, so the fallback art is stable for that row. */
  seed: string;
  category?: string | null;
  /** Overrides the category-derived art, for a slot that knows what it depicts. */
  glyph?: GlyphName;
  /** Names the tile to a screen reader when there is no adjacent text doing it. */
  label?: string;
  className?: string;
  glyphSize?: number;
  /** For the `<img>` alone, so a wide slot can choose which edge of the photo it keeps. */
  imgClass?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => {
    setFailedSrc(null);
  }, [src, fallbackSrc]);

  // Never let an earlier failed request hide a local public asset. This can happen
  // during Vite HMR when an image is added after the page has already rendered.
  const isUsable = (candidate: string) => candidate.startsWith('/') || !broken.has(candidate);
  const imageSrc = src && src !== failedSrc && isUsable(src)
    ? src
    : fallbackSrc && fallbackSrc !== src && fallbackSrc !== failedSrc && isUsable(fallbackSrc)
      ? fallbackSrc
      : null;
  const suppliesObjectFit = imgClass.split(/\s+/).some((token) =>
    /(?:^|:)object-(?:cover|contain|fill|none|scale-down)(?:!|$)/.test(token),
  );

  return (
    <div
      className={`relative overflow-hidden bg-elevated ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {imageSrc ? (
        <img
          src={imageSrc ?? ''}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            // Local public assets can appear while Vite is running; don't poison their path
            // for the rest of the session if an earlier request happened before the file existed.
            if (!imageSrc.startsWith('/')) broken.add(imageSrc);
            setFailedSrc(imageSrc);
          }}
          className={`h-full w-full ${suppliesObjectFit ? '' : 'object-cover'} ${imgClass}`}
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
