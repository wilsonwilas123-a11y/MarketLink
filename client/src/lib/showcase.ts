import type { GlyphName } from '../components/art/glyphs';

/**
 * The landing screen's produce rail.
 *
 * Phase 6 owns `/api/products`; until it exists this is the only list on the site that is not
 * read from the server, and it is written straight from `db/seed/0002_lagos_products.sql` —
 * same names, same minor-unit prices, same week quantities — so the rail shows what the API
 * will show and deleting this file is a swap rather than a rewrite.
 */
export interface ShowcaseProduct {
  key: string;
  name: string;
  stall: string;
  category: string;
  unit: string;
  price_minor: number;
  quantity: number;
  rating_avg: number;
  rating_count: number;
  market: string;
  days: string;
  window: string;
  photo: string | null;
  /**
   * Which slice of this photograph the landing band keeps. The band is much wider than any of
   * these pictures, so `object-cover` discards most of their height and each one has to say for
   * itself whether the loss should fall on the sky or on the produce.
   */
  focus: string;
  glyph: GlyphName;
  /** Creator/source credit required by openly licensed product photography. */
  photoCredit?: { author: string; href: string };
}

export const FRESH_THIS_WEEK: ShowcaseProduct[] = [
  {
    key: 'ugu-500',
    name: 'Ugu (Pumpkin Leaves)',
    stall: 'Adeyemi Farms',
    category: 'vegetables',
    unit: 'bunch',
    price_minor: 80000,
    quantity: 60,
    rating_avg: 4.7,
    rating_count: 22,
    market: 'Mile 12',
    days: 'Tue, Thu, Sat',
    window: '8am–12pm',
    // Ugu leaves sold at a Nigerian market (Wikimedia Commons, CC BY-SA 4.0).
    photo: '/img/products/ugu-market.jpg',
    focus: 'object-bottom',
    glyph: 'leaf',
    photoCredit: {
      author: 'Dorcas Atule · Wikimedia Commons · CC BY-SA 4.0',
      href: 'https://commons.wikimedia.org/wiki/File:Ugu_leaf_at_monday_market_01.jpg',
    },
  },
  {
    key: 'tatashe-crate',
    name: 'Tatashe (Bell Pepper)',
    stall: 'Eze Fresh Produce',
    category: 'vegetables',
    unit: 'crate',
    price_minor: 650000,
    quantity: 12,
    rating_avg: 4.4,
    rating_count: 26,
    market: 'Oshodi',
    days: 'Sat, Sun',
    window: '9am–1pm',
    // The mixed produce photo clearly includes red and green bell peppers.
    photo: '/img/products/ugu.jpg',
    focus: 'object-center',
    glyph: 'pepper',
  },
  {
    key: 'yam-tuber',
    name: 'Puna Yam Tuber',
    stall: 'Adeyemi Farms',
    category: 'vegetables',
    unit: 'crate',
    price_minor: 450000,
    quantity: 24,
    rating_avg: 4.6,
    rating_count: 31,
    market: 'Mile 12',
    days: 'Tue, Thu, Sat',
    window: '8am–12pm',
    // This image shows yams in sacks; eggs.jpg was an unrelated product photo.
    photo: '/img/products/tatashe.jpg',
    focus: 'object-top',
    glyph: 'tuber',
  },
  {
    key: 'tomato-crate',
    name: 'Tomato (Fresh)',
    stall: 'Eze Fresh Produce',
    category: 'vegetables',
    unit: 'crate',
    price_minor: 900000,
    quantity: 9,
    rating_avg: 4.1,
    rating_count: 20,
    market: 'Oshodi',
    days: 'Sat, Sun',
    window: '9am–1pm',
    // Nigerian tomatoes photographed at a market (Wikimedia Commons, CC BY-SA 4.0).
    photo: '/img/products/nigerian-tomatoes.jpg',
    focus: 'object-center',
    glyph: 'tomato',
    photoCredit: {
      author: 'Blossom Ozurumba · Wikimedia Commons · CC BY-SA 4.0',
      href: 'https://commons.wikimedia.org/wiki/File:Nigerian_Tomato.jpg',
    },
  },
];

/** How much of a listing is left this week, and the words the badge shows for it. */
export interface StockLine {
  tone: 'ok' | 'low' | 'out';
  label: string;
}

/**
 * Stock state, and the words that go with it.
 *
 * The threshold is the same one the farmer-facing dashboard uses in spec 6: below ten units of
 * a crate-sized listing is genuinely running short, and a badge that only fires at zero is a
 * badge nobody can act on.
 */
export function stockState(quantity: number): StockLine {
  if (quantity <= 0) return { tone: 'out', label: 'Sold out' };
  if (quantity < 10) return { tone: 'low', label: 'Low stock' };
  return { tone: 'ok', label: 'In stock' };
}

/** The five seeded `categories` rows, in `sort_order`. Phase 6 serves these from `/categories`. */
export const CATEGORIES: { name: string; slug: string; glyph: GlyphName }[] = [
  { name: 'Vegetables', slug: 'vegetables', glyph: 'leaf' },
  { name: 'Fruits', slug: 'fruits', glyph: 'apple' },
  { name: 'Dairy', slug: 'dairy', glyph: 'milk' },
  { name: 'Bakery', slug: 'bakery', glyph: 'bread' },
  { name: 'Herbs', slug: 'herbs', glyph: 'sprout' },
];
