import type { ReactNode } from 'react';

/**
 * Line art for produce and places.
 *
 * The mockups are photographic, and the seed leaves `image_url` null, so every tile this app
 * shows before a farmer uploads a photo needs to look deliberate rather than missing. Hand-drawn
 * outlines in the accent colour do that, cost nothing to ship, and stay legible on a 2G
 * connection — which is the same reason the map is tiles and not a rendered basemap.
 *
 * `icon_key` in the `categories` table names these, so a category's art is data, not a lookup
 * that can drift from the row.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export type GlyphName =
  | 'leaf'
  | 'sprout'
  | 'apple'
  | 'milk'
  | 'bread'
  | 'tomato'
  | 'pepper'
  | 'carrot'
  | 'tuber'
  | 'mango'
  | 'banana'
  | 'pineapple'
  | 'avocado'
  | 'coconut'
  | 'orange'
  | 'eggplant'
  | 'corn'
  | 'onion'
  | 'egg'
  | 'fish'
  | 'grain'
  | 'basket'
  | 'grid'
  | 'stall'
  | 'farm'
  | 'star'
  | 'search'
  | 'pin'
  | 'shield'
  | 'tag'
  | 'clock'
  | 'arrow'
  | 'send'
  | 'truck'
  | 'bell';

const paths: Record<GlyphName, ReactNode> = {
  leaf: (
    <>
      <path {...stroke} d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14Z" />
      <path {...stroke} d="M6.5 17.5 17 7" />
    </>
  ),
  sprout: (
    <>
      <path {...stroke} d="M12 20v-7.5" />
      <path {...stroke} d="M12 12.5C12 9.5 9.8 7.5 6.5 7.5c0 3 2.2 5 5.5 5Z" />
      <path {...stroke} d="M12 12.5c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5Z" />
    </>
  ),
  apple: (
    <>
      <path
        {...stroke}
        d="M12 7.5c3.8 0 5.8 2.9 5.8 6.4 0 3.2-1.7 5.6-3.1 5.6-1.1 0-1.5-.6-2.7-.6s-1.6.6-2.7.6c-1.4 0-3.1-2.4-3.1-5.6 0-3.5 2-6.4 5.8-6.4Z"
      />
      <path {...stroke} d="M12 7.5V4.2" />
      <path {...stroke} d="M12.2 5.4c1.6-1.9 3.8-1.6 3.8-1.6s-.6 2.4-3.4 2.6" />
    </>
  ),
  milk: (
    <>
      <path {...stroke} d="M8 9h8v11H8Z" />
      <path {...stroke} d="m8 9 1.6-4.5h4.8L16 9" />
      <path {...stroke} d="M9.6 13.5h4.8" />
    </>
  ),
  bread: (
    <>
      <path {...stroke} d="M5 13c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5v5.5H5Z" />
      <path {...stroke} d="m9.5 11.5-1.2 2.6M13 11.5l-1.2 2.6M16.4 11.5l-1.2 2.6" />
    </>
  ),
  tomato: (
    <>
      <path {...stroke} d="M12 7.2c3.8 0 6.8 3 6.8 6.8s-3 6.8-6.8 6.8-6.8-3-6.8-6.8 3-6.8 6.8-6.8Z" />
      <path {...stroke} d="m12 7-2.4-2.6M12 7l2.4-2.6M12 7V3.6" />
    </>
  ),
  pepper: (
    <>
      <path
        {...stroke}
        d="M12 7.6c-1-1.6-3.2-2.2-4.7-1.1C5.7 7.7 6 10 6.6 12.7c.8 3.4 2.3 6.8 5.4 6.8s4.6-3.4 5.4-6.8c.6-2.7.9-5-.7-6.2-1.5-1.1-3.7-.5-4.7 1.1Z"
      />
      <path {...stroke} d="M12 7.6V4M12 4c1.6-.4 2.8.3 2.8.3" />
    </>
  ),
  carrot: (
    <>
      <path
        {...stroke}
        d="M14.6 8.6 7 17.6c-.8 1 .4 2.3 1.4 1.5l9-7.6c-.6-1.5-1.6-2.5-2.8-2.9Z"
      />
      <path {...stroke} d="m14.6 8.6 3.2-4M14.6 8.6l4.4-.6M14.6 8.6l.6-4.2" />
    </>
  ),
  tuber: (
    <>
      <path
        {...stroke}
        d="M8.4 8.8c2.2-2.8 7.6-2.6 9.4.6 1.7 3.1-.4 7.6-3.4 8.6-3.4 1.1-7.4.2-8.4-2.6-.6-1.7-.2-4.4 2.4-6.6Z"
      />
      <path {...stroke} d="M11 11.5h.01M14.5 13h.01M12 15.5h.01" strokeWidth={2.2} />
    </>
  ),
  mango: (
    <>
      <path
        {...stroke}
        d="M16.6 6.4c2.6 2.4 2.3 7-.8 9.4-3.1 2.5-8 2.6-9.7-.2-1.7-2.8.3-6.6 3.4-8.4 2.4-1.4 5.5-1.4 7.1-.8Z"
      />
      <path {...stroke} d="M16.6 6.4c.6-1.4 2.2-1.8 2.2-1.8s.2 1.8-1.2 2.6" />
    </>
  ),
  banana: (
    <>
      <path {...stroke} d="M4 14.2c4.2 3.3 10.6 1.8 16.2-8l1.1 2.3c-4.5 9.6-11 13.1-18.2 9.1-1.2-.7-1.3-2.2.9-3.4Z" />
      <path {...stroke} d="m19.9 6.2 1.7-.6M3.5 17.1l-1.2.6" />
    </>
  ),
  pineapple: (
    <>
      <path {...stroke} d="m12 8 3.2-4.5M12 8 9 3.5M12 8V3" />
      <path {...stroke} d="M8.2 8.2c-2.1 2.7-2.3 8.4.2 11.4h7.2c2.5-3 2.3-8.7.2-11.4Z" />
      <path {...stroke} d="m8 11 8 2m-8 2 8 2m-6-7-.6 7m3-7 .6 7" />
    </>
  ),
  avocado: (
    <>
      <path {...stroke} d="M12 3.8c3.2 0 7 7.1 7 11.1a7 7 0 0 1-14 0c0-4 3.8-11.1 7-11.1Z" />
      <circle {...stroke} cx="12" cy="15" r="2.6" />
    </>
  ),
  coconut: (
    <>
      <path {...stroke} d="M12 4.3c4.7 0 8 3.6 8 8.1a8 8 0 0 1-16 0c0-4.5 3.3-8.1 8-8.1Z" />
      <path {...stroke} d="M8.2 8.4c1.4-.9 2.6-1.2 3.8-1.2m3.5 12.1 2.3 1.2" />
      <circle {...stroke} cx="9" cy="12" r=".7" />
      <circle {...stroke} cx="15" cy="12" r=".7" />
    </>
  ),
  orange: (
    <>
      <circle {...stroke} cx="12" cy="13" r="7" />
      <path {...stroke} d="M12 6V4m0 2c1.8-2.2 4.4-1.8 4.4-1.8S15.8 7 12 7" />
    </>
  ),
  eggplant: (
    <>
      <path {...stroke} d="M9 7.2c2.7-2.2 7.2-1.8 9.2 1.2 2.2 3.2.7 8.1-2.6 10.1-3.7 2.3-8.8 1.6-10.4-1.5-1.6-3 .1-7.3 3.8-9.8Z" />
      <path {...stroke} d="m8.7 7.8-3.9-2m3.9 2-1.1-3m1.1 3 2.7-2.4" />
    </>
  ),
  corn: (
    <>
      <path {...stroke} d="M12 3.8c2.8 0 4.8 3.4 4.8 7.6S14.8 20 12 20s-4.8-4.4-4.8-8.6S9.2 3.8 12 3.8Z" />
      <path {...stroke} d="m8.4 8.4 7.2 2.4M8.4 12.4l7.2 2.4M8.4 16.2l7.2-2.2M15.6 8.4 8.4 10.8M15.6 12.4 8.4 14.8" />
    </>
  ),
  onion: (
    <>
      <path {...stroke} d="M12 8.4c3.8 0 6 2.8 6 5.8s-2.4 5.8-6 5.8-6-2.8-6-5.8 2.2-5.8 6-5.8Z" />
      <path {...stroke} d="M12 8.4c-1.2-2-2.8-2.4-2.8-2.4s1.8-.8 2.8 1.2c1-2 2.8-1.2 2.8-1.2s-1.6.4-2.8 2.4Z" />
    </>
  ),
  egg: (
    <>
      <path {...stroke} d="M12 3.8c3.3 0 6 4.4 6 8.8S15.3 20.2 12 20.2 6 17 6 12.6s2.7-8.8 6-8.8Z" />
    </>
  ),
  fish: (
    <>
      <path {...stroke} d="M4.5 12.2c2.8-3.6 8-4.8 11.6-3.4 2 .8 3.2 2.2 3.2 3.4s-1.2 2.6-3.2 3.4c-3.6 1.4-8.8.2-11.6-3.4Z" />
      <path {...stroke} d="M4.5 12.2 2 8.8v7l2.5-3.6ZM17.6 11.4h.01" strokeWidth={2} />
    </>
  ),
  grain: (
    <>
      <path {...stroke} d="M12 20.5V7" />
      <path {...stroke} d="M12 10c0-2 1.4-3.4 3.4-3.6 0 2-1.4 3.4-3.4 3.6ZM12 10c0-2-1.4-3.4-3.4-3.6 0 2 1.4 3.4 3.4 3.6ZM12 15c0-2 1.4-3.4 3.4-3.6 0 2-1.4 3.4-3.4 3.6ZM12 15c0-2-1.4-3.4-3.4-3.6 0 2 1.4 3.4 3.4 3.6Z" />
    </>
  ),
  basket: (
    <>
      <path {...stroke} d="M4 10.5h16l-1.6 8.5H5.6Z" />
      <path {...stroke} d="M8 10.5c0-4 8-4 8 0" />
      <path {...stroke} d="M6.6 14.5h10.8" />
    </>
  ),
  grid: (
    <>
      <rect {...stroke} x="4.5" y="4.5" width="6" height="6" rx="1.6" />
      <rect {...stroke} x="13.5" y="4.5" width="6" height="6" rx="1.6" />
      <rect {...stroke} x="4.5" y="13.5" width="6" height="6" rx="1.6" />
      <rect {...stroke} x="13.5" y="13.5" width="6" height="6" rx="1.6" />
    </>
  ),
  stall: (
    <>
      <path {...stroke} d="M3.5 8.5h17L18.5 4h-13Z" />
      <path {...stroke} d="M5.5 8.5V20h13V8.5M5.5 14.5h13" />
    </>
  ),
  farm: (
    <>
      <path {...stroke} d="M4.5 10.8 12 4.6l7.5 6.2V20h-15Z" />
      <path {...stroke} d="M12 9.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z" />
      <path {...stroke} d="M9.5 20v-4.4h5V20" />
      <path {...stroke} d="M2.5 20h19" />
    </>
  ),
  star: (
    <path
      d="m12 3.6 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8Z"
      fill="currentColor"
    />
  ),
  search: (
    <>
      <path {...stroke} d="M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z" />
      <path {...stroke} d="m15.8 15.8 3.7 3.7" />
    </>
  ),
  bell: (
    <>
      <path {...stroke} d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path {...stroke} d="M10 21h4" />
    </>
  ),
  pin: (
    <>
      <path {...stroke} d="M12 3.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.6 6.5 10.5 6.5 10.5s6.5-5.9 6.5-10.5c0-3.6-2.9-6.5-6.5-6.5Z" />
      <path {...stroke} d="M12 8.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" />
    </>
  ),
  shield: (
    <>
      <path {...stroke} d="M12 3.5 5 6v6.2c0 3.9 2.9 7.2 7 8.3 4.1-1.1 7-4.4 7-8.3V6Z" />
      <path {...stroke} d="m9 12 2.2 2.2L15.2 10" />
    </>
  ),
  tag: (
    <>
      <path {...stroke} d="M11 3.5H20.5V13l-8.3 8.3a1.6 1.6 0 0 1-2.3 0L3.5 14.6a1.6 1.6 0 0 1 0-2.3Z" />
      <path {...stroke} d="M16.4 6.5a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
    </>
  ),
  clock: (
    <>
      <path {...stroke} d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z" />
      <path {...stroke} d="M12 7.8V12l3 1.8" />
    </>
  ),
  arrow: <path {...stroke} d="M4.5 12h14m-5.5-5.5L18.5 12 13 17.5" />,
  send: (
    <>
      <path {...stroke} d="M20 4 3.5 10.6l6.4 2.2L12 20l8-16Z" />
      <path {...stroke} d="m9.9 12.8 3.3-3.4" />
    </>
  ),
  truck: (
    <>
      <path {...stroke} d="M3 6.5h11v10H3Zm11 3h4l3 3v4h-7Z" />
      <path {...stroke} d="M7 19.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Zm10 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
    </>
  ),
};

export function Glyph({
  name,
  size = 24,
  className = '',
}: {
  name: GlyphName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

/** Produce art per category slug, so a tile without a photo still says what is in it. */
const BY_CATEGORY: Record<string, GlyphName[]> = {
  vegetables: ['leaf', 'tomato', 'pepper', 'carrot', 'onion'],
  fruits: ['mango', 'apple'],
  dairy: ['milk'],
  bakery: ['bread', 'grain'],
  herbs: ['sprout', 'leaf'],
  fish: ['fish'],
  poultry: ['egg'],
  grains: ['grain'],
  tubers: ['tuber'],
};

const FALLBACK: GlyphName[] = ['basket', 'leaf', 'tuber'];

/**
 * Which art a row gets when it has no photo.
 *
 * Derived from the row's own id, so the same stall keeps the same tile across the rail, the
 * list and the map popup instead of reshuffling on every render.
 */
export function glyphFor(seed: string, category?: string | null): GlyphName {
  const set = (category && BY_CATEGORY[category]) || FALLBACK;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return set[Math.abs(h) % set.length] ?? 'basket';
}
