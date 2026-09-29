import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { PlaceCandidate } from '../api/schemas.js';


const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

/** Long enough for a cold gazetteer query; short enough that a route never outlives a proxy timeout. */
const TIMEOUT_MS = 6_000;

/** The tag OpenStreetMap puts on a place where people sell produce at stalls. */
export const MARKETPLACE_KIND = 'amenity/marketplace';

/** Common non-market venues sometimes mislabeled as marketplaces in OSM. */
const NON_MARKET_NAME = /\b(plaza|mall|supermarket|shopping\s+(?:centre|center))\b/i;

function isMarketCandidate(place: PlaceCandidate): boolean {
  return place.kind === MARKETPLACE_KIND && !NON_MARKET_NAME.test(place.name);
}


const OVERFETCH = 4;

/** The ceiling on the upstream's own `limit`, however much was asked for. */
const MAX_UPSTREAM_LIMIT = 50;


function asMarketQuery(query: string): string {
  return /\bmarkets?\b/i.test(query) ? query : `${query} market`;
}

/**
 * Rough boundin  g box around the whole African continent and its island nations, in Photon's
 * own `minLon,minLat,maxLon,maxLat` order.
 *
 * This is sent as a hint to Photon so it does not spend its ranking on candidates the product
 * has no use for, and — because Photon favours matches inside a supplied bbox — it also sharpens
 * precision for an ambiguous name that exists in more than one country. It is deliberately loose
 * (it also covers a sliver of the Middle East and southern Europe); `isInAfrica` below is the
 * actual, exact filter.
 */
const AFRICA_BBOX = '-25.5,-35.5,63.5,38.0';

/**
 * Every recognised African country's English name, in the spellings Photon's OpenStreetMap
 * data tends to use, so a candidate is kept only when it is actually inside Africa. `AFRICA_BBOX`
 * alone would let through, say, Israel or Greece — this is what excludes them.
 */
const AFRICAN_COUNTRIES = new Set([
  'algeria', 'angola', 'benin', 'botswana', 'burkina faso', 'burundi', 'cabo verde', 'cape verde',
  'cameroon', 'central african republic', 'chad', 'comoros', 'congo',
  'democratic republic of the congo', 'republic of the congo', 'djibouti', 'egypt',
  'equatorial guinea', 'eritrea', 'eswatini', 'swaziland', 'ethiopia', 'gabon', 'gambia', 'ghana',
  'guinea', 'guinea-bissau', "côte d'ivoire", 'ivory coast', 'kenya', 'lesotho', 'liberia', 'libya',
  'madagascar', 'malawi', 'mali', 'mauritania', 'mauritius', 'morocco', 'mozambique', 'namibia',
  'niger', 'nigeria', 'rwanda', 'sao tome and principe', 'são tomé and príncipe', 'senegal',
  'seychelles', 'sierra leone', 'somalia', 'south africa', 'south sudan', 'sudan', 'tanzania',
  'togo', 'tunisia', 'uganda', 'zambia', 'zimbabwe',
]);

function isInAfrica(country: string | null): boolean {
  return country !== null && AFRICAN_COUNTRIES.has(country.trim().toLowerCase());
}

/* ---------------------------------------------------------------- the map's own markets

   A gazetteer answers a name. It cannot answer "what is in this corner of the map", which is
   the question a discovery screen asks before anyone has typed anything. That is a database
   query over the OSM replication data, so it goes to Overpass, and Overpass is a third party
   running mirrors on volunteer patience — hence the box cap below and the cache around the
   whole module. */

/**
 * The public Overpass mirrors, tried in order.
 *
 * `overpass-api.de` is the reference instance and the most heavily loaded of the three: on its
 * own it times out or answers 504 often enough that a route built on it alone is not something
 * a visitor can depend on. The other two mirror the same replication data on different
 * hardware, so a query that stalls on one succeeds on another without changing the answer.
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

/**
 * Both the asking and the giving-up, per mirror.
 *
 * A bounded box of named nodes answers in a couple of seconds; eight is the point at which a
 * queued mirror has cost a visitor more than moving on to the next mirror is worth. Three
 * mirrors at 8s worst case is still faster, and usually far faster, than one mirror hanging
 * for twice as long before the route gives up.
 */
const OVERPASS_TIMEOUT_S = 8;

/**
 * The largest corner of the map one request may cover, in degrees.
 *
 * ~66 km north-to-south, which is more than a visitor can see at one time at the zoom the map
 * opens at. The cap is the reason this route can be public: an unbounded box is an invitation to
 * make a volunteer mirror read the continent on our behalf, and the tenth time it runs a
 * whole-Africa query is the tenth mirror that stops answering us.
 */
const MAX_BOX_SPAN = 0.6;

/** A corner of the map, in the order Overpass wants it: `south,west,north,east`. */
export interface MarketBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * `6.4,3.2,6.7,3.6` from a query string, or a rejection that says which part was wrong.
 *
 * Parsed here rather than in the route because the shape is the upstream's dialect while the
 * rules — inside the world, north above south, small enough to ask — are ours.
 */
export function parseMarketBox(raw: string): MarketBox {
  // Plain decimals only. An empty part would read as `0`, which is a point in the Gulf of
  // Guinea rather than a mistake, and these four numbers are the only thing that reaches the
  // upstream query.
  const parts = raw.split(',').map((part) => part.trim());

  if (parts.length !== 4 || parts.some((part) => !/^-?\d+(\.\d{1,6})?$/.test(part))) {
    throw new ApiError(
      'validation_failed',
      'bbox has to be four numbers: south,west,north,east.',
    );
  }

  const [south, west, north, east] = parts.map(Number) as [number, number, number, number];

  if (Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) {
    throw new ApiError('validation_failed', 'bbox is outside the world as we know it.');
  }

  if (north <= south || east <= west) {
    throw new ApiError('validation_failed', 'bbox has to run north and east from its corner.');
  }

  // `+ 1e-9` because the corners arrive by subtraction and floating point is what it is: a box
  // asked for as `6.4,3.1,6.8,3.7` measures 0.6000000000000001 across, and refusing a visitor's
  // honest viewport at the exact limit is not what the cap is for.
  if (north - south > MAX_BOX_SPAN + 1e-9 || east - west > MAX_BOX_SPAN + 1e-9) {
    throw new ApiError(
      'validation_failed',
      `bbox covers more than ${MAX_BOX_SPAN}° across. Ask for the corner a visitor can see.`,
    );
  }

  return { south, west, north, east };
}

/**
 * Nodes only, not ways.
 *
 * A marketplace mapped as a building outline would be missed, and that is accepted: ways make
 * the reply larger and slower for every query, and the node set already carries the gates
 * somebody cared enough to name.
 */
function boxQuery(box: MarketBox, wanted: number): string {
  const { south, west, north, east } = box;
  return (
    `[out:json][timeout:${OVERPASS_TIMEOUT_S}];` +
    `node["amenity"="marketplace"](${south},${west},${north},${east});` +
    `out ${wanted};`
  );
}

/** The two fields of a `fetch` reply this module reads, so a test can hand over an object. */
export interface GeocodeReply {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface GeocodeRequest {
  headers: Record<string, string>;
  signal: AbortSignal;
  /** Overpass takes the query in the body; a GET needs no method at all. */
  method?: string;
  body?: string;
}

export type GeocodeFetch = (url: string, init: GeocodeRequest) => Promise<GeocodeReply>;

/** The whole surface the routes use. */
export interface Geocoder {
  search(query: string, limit: number): Promise<PlaceCandidate[]>;
  /**
   * Places the map tags as a marketplace.
   *
   * Ranked by the gazetteer's own text match, not by distance or by how much is stocked there,
   * and capped at what was asked for after the tag filter runs. The term reaches the upstream as
   * a market question, so what is on the wire is not always what the caller passed.
   */
  markets(query: string, limit: number): Promise<PlaceCandidate[]>;
  /**
   * Marketplaces inside one corner of the map, for a screen nobody has typed into yet.
   *
   * A different upstream answers this one, and it answers with whatever is there rather than
   * with what matches a name, so the order carries no ranking and nodes whose `name` tag is empty
   * are dropped: an unnamed ring on a map tells a visitor nothing they can act on.
   */
  inBox(box: MarketBox, limit: number): Promise<PlaceCandidate[]>;
}

/**
 * Photon's `properties`, as far as we rely on it.
 *
 * Everything is optional because the gazetteer fills in what it has: a marketplace node often
 * carries a name and nothing else, while a street address carries both.
 */
const PhotonFeatureSchema = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    osm_type: z.string().optional(),
    osm_id: z.number().int().optional(),
    osm_key: z.string().optional(),
    osm_value: z.string().optional(),
    name: z.string().min(1).optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    locality: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
  }),
});

const PhotonResponseSchema = z.object({ features: z.array(z.unknown()) });

type PhotonFeature = z.infer<typeof PhotonFeatureSchema>;

/** One line, most specific first, with whatever the place did not supply left out. */
function addressOf(p: PhotonFeature['properties']): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const town = p.city ?? p.district ?? p.locality ?? p.county;
  return [street, town, p.postcode, p.state, p.country].filter(Boolean).join(', ');
}

/**
 * `w2453679849` — the element reference OpenStreetMap itself uses in a URL.
 *
 * Kept whole rather than split into type and id, because its only jobs are to deduplicate a
 * result set and to let a human open the source and check it.
 */
function refOf(p: PhotonFeature['properties']): string {
  if (p.osm_id === undefined) return 'unnamed';
  return `${(p.osm_type ?? 'N').toLowerCase()}${p.osm_id}`;
}

function candidateOf(feature: PhotonFeature): PlaceCandidate {
  const { properties: p, geometry } = feature;
  const [lng, lat] = geometry.coordinates;
  const city = p.city ?? p.district ?? p.locality ?? p.county ?? null;
  const address = addressOf(p);

  return {
    ref: refOf(p),
    name: marketName(p.name, city, address),
    lat,
    lng,
    address,
    city,
    state: p.state ?? null,
    country: p.country ?? null,
    kind: p.osm_key && p.osm_value ? `${p.osm_key}/${p.osm_value}` : (p.osm_key ?? 'place'),
    image_url: null,
    image_credit: null,
    image_link: null,
    image_kind: null,
    image_region: null,
  };
}

/** OSM often labels unnamed neighbourhood stalls simply "Market"; make that label useful. */
function marketName(name: string | undefined, area: string | null, address: string): string {
  if (name && significantWords(name).length > 0) return name;
  const place = area || address.split(',')[0]?.trim();
  return place ? `Market in ${place}` : (name || 'Unnamed market');
}

/**
 * One Overpass element.
 *
 * `name` is required where Photon's is optional: an untagged node in a box is a marketplace
 * nobody has ever labelled, and a ring with no name behind it is not a choice a visitor can make.
 */
const OverpassElementSchema = z.object({
  type: z.literal('node'),
  id: z.number().int(),
  lat: z.number(),
  lon: z.number(),
  tags: z.object({ name: z.string().min(1) }).catchall(z.unknown()),
});

const OverpassResponseSchema = z.object({ elements: z.array(z.unknown()) });

type OverpassElement = z.infer<typeof OverpassElementSchema>;

/**
 * The same `PlaceCandidate` shape, assembled from raw tags.
 *
 * Overpass resolves nothing: Photon hands back a formatted address and this has to build one out
 * of whichever `addr:*` keys the mapper happened to fill in, which for most market gates in
 * Nigeria is none of them. An empty `address` is the honest answer, not a failure.
 */
function boxCandidateOf(el: OverpassElement): PlaceCandidate {
  const tags = el.tags;
  const text = (key: string): string | null => {
    const value = tags[key];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  };

  const city = text('addr:city') ?? text('addr:town') ?? text('addr:village') ?? text('addr:suburb');

  return {
    ref: `n${el.id}`,
    name: marketName(tags.name, city, [text('addr:street'), city].filter(Boolean).join(', ')),
    lat: el.lat,
    lng: el.lon,
    address: [text('addr:street'), city, text('addr:postcode'), text('addr:state'), text('addr:country')]
      .filter(Boolean)
      .join(', '),
    city,
    state: text('addr:state'),
    country: text('addr:country'),
    kind: MARKETPLACE_KIND,
    image_url: null,
    image_credit: null,
    image_link: null,
    image_kind: null,
    image_region: null,
  };
}

/* ---------------------------------------------------------------- real photos, best-effort

   OpenStreetMap carries no photos. Wikimedia Commons has an unauthenticated API and openly
   licensed images, including real photos of some African markets. Search with the mapped name
   and locality, then require the title or caption to identify both the market and a distinctive
   part of its name. If it cannot prove a match, the frontend keeps its neutral fallback. */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const PHOTO_TIMEOUT_MS = 3_500;
const PHOTO_MISS_RETRY_MS = 2 * 60_000;
const regionalPhotoCache = new Map<string, Promise<PlacePhoto[]>>();

const CommonsPhotoResponseSchema = z.object({
  query: z.object({
    pages: z.record(z.object({
      title: z.string(),
      imageinfo: z.array(z.object({
        thumburl: z.string().url().optional(),
        descriptionurl: z.string().url().optional(),
        extmetadata: z.object({
          ImageDescription: z.object({ value: z.string() }).optional(),
          Artist: z.object({ value: z.string() }).optional(),
          LicenseShortName: z.object({ value: z.string() }).optional(),
        }).optional(),
      })).optional(),
    })).optional(),
  }).optional(),
});

const GENERIC_NAME_WORDS = new Set([
  'market', 'markets', 'plaza', 'the', 'main', 'central', 'new', 'old', 'community', 'public',
]);

function significantWords(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !GENERIC_NAME_WORDS.has(word));
}

/** Score only specific market-name matches; exact place words in the file title rank highest. */
function commonsMatchScore(title: string, description: string, placeName: string): number {
  const words = significantWords(placeName);
  if (words.length === 0) return 0;
  const titleText = title.toLowerCase();
  const descriptionText = description.toLowerCase().replace(/<[^>]*>/g, ' ');
  const text = `${titleText} ${descriptionText}`;
  if (!/\bmarkets?\b/.test(text)) return 0;
  const titleMatches = words.filter((word) => titleText.includes(word));
  const matches = new Set([...titleMatches, ...words.filter((word) => descriptionText.includes(word))]).size;
  return matches >= Math.min(2, words.length) ? titleMatches.length * 3 + matches : 0;
}

interface PlacePhoto { url: string; credit: string; link: string; kind: 'exact' | 'regional'; region?: string }

interface RegionalBounds { name: string; south: number; west: number; north: number; east: number }

/** Approximate boxes are used only when OSM omitted its country tag, to search for a regional photo. */
const REGIONAL_BOUNDS: RegionalBounds[] = [
  { name: 'Nigeria', south: 3.5, west: 2.5, north: 14.0, east: 14.8 },
  { name: 'Ghana', south: 4.5, west: -3.3, north: 11.3, east: 1.3 },
  { name: 'Senegal', south: 12.0, west: -17.8, north: 17.8, east: -11.3 },
  { name: "Côte d'Ivoire", south: 4.2, west: -8.7, north: 10.8, east: -2.4 },
  { name: 'Cameroon', south: 1.5, west: 8.0, north: 13.2, east: 16.3 },
  { name: 'Kenya', south: -4.8, west: 33.8, north: 5.3, east: 42.0 },
  { name: 'Uganda', south: -1.6, west: 29.5, north: 4.3, east: 35.1 },
  { name: 'Tanzania', south: -11.9, west: 29.2, north: -0.8, east: 40.7 },
  { name: 'Rwanda', south: -2.9, west: 28.8, north: -1.0, east: 30.9 },
  { name: 'Ethiopia', south: 3.3, west: 33.0, north: 15.2, east: 48.0 },
  { name: 'Egypt', south: 21.7, west: 24.5, north: 31.8, east: 36.9 },
  { name: 'Morocco', south: 21.0, west: -13.3, north: 36.0, east: -1.0 },
  { name: 'South Africa', south: -35.2, west: 16.4, north: -22.0, east: 33.1 },
  { name: 'Botswana', south: -27.0, west: 19.8, north: -17.7, east: 29.5 },
  { name: 'Zambia', south: -18.1, west: 21.9, north: -8.2, east: 34.0 },
  { name: 'Mozambique', south: -26.9, west: 30.2, north: -10.3, east: 41.6 },
];

const COUNTRY_CODES: Record<string, string> = {
  NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa', SN: 'Senegal',
  CI: "Côte d'Ivoire", CM: 'Cameroon', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda',
  ET: 'Ethiopia', EG: 'Egypt', MA: 'Morocco', BW: 'Botswana', ZM: 'Zambia', MZ: 'Mozambique',
};

function regionalCountry(candidate: PlaceCandidate): string | null {
  const tagged = candidate.country?.trim();
  if (tagged) return COUNTRY_CODES[tagged.toUpperCase()] ?? tagged;
  const match = REGIONAL_BOUNDS.find(({ south, west, north, east }) =>
    candidate.lat >= south && candidate.lat <= north && candidate.lng >= west && candidate.lng <= east,
  );
  return match?.name ?? null;
}

const COUNTRY_DEMONYMS: Record<string, string[]> = {
  Nigeria: ['nigeria', 'nigerian'], Ghana: ['ghana', 'ghanaian'], Kenya: ['kenya', 'kenyan'],
  'South Africa': ['south africa', 'south african'], Senegal: ['senegal', 'senegalese'],
  "Côte d'Ivoire": ["côte d'ivoire", 'ivory coast', 'ivorian'], Cameroon: ['cameroon', 'cameroonian'],
  Uganda: ['uganda', 'ugandan'], Tanzania: ['tanzania', 'tanzanian'], Rwanda: ['rwanda', 'rwandan'],
  Ethiopia: ['ethiopia', 'ethiopian'], Egypt: ['egypt', 'egyptian'], Morocco: ['morocco', 'moroccan'],
  Botswana: ['botswana', 'botswanan'], Zambia: ['zambia', 'zambian'], Mozambique: ['mozambique', 'mozambican'],
};

function regionalMatchScore(title: string, description: string, city: string | null, country: string): number {
  const titleText = title.toLowerCase();
  const descriptionText = description.toLowerCase().replace(/<[^>]*>/g, ' ');
  const text = `${titleText} ${descriptionText}`;
  if (!/\bmarkets?\b/.test(text)) return 0;
  const cities = significantWords(city ?? '');
  const cityMatch = cities.some((word) => text.includes(word));
  const countryMatch = (COUNTRY_DEMONYMS[country] ?? [country.toLowerCase()]).some((name) => text.includes(name.toLowerCase()));
  if (!cityMatch && !countryMatch) return 0;
  return (titleText.includes('market') ? 3 : 0) + (cityMatch ? 4 : 0) + (countryMatch ? 2 : 0);
}

async function commonsPhotos(
  fetchImpl: GeocodeFetch,
  headers: Record<string, string>,
  query: string,
  scoreMatch: (title: string, description: string) => number,
  kind: 'exact' | 'regional',
  region?: string,
): Promise<PlacePhoto[]> {
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '8',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640', format: 'json',
  })}`;
  try {
    const reply = await fetchImpl(url, { headers, signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
    if (!reply.ok) return [];
    const parsed = CommonsPhotoResponseSchema.safeParse(await reply.json());
    const pages = parsed.success ? parsed.data.query?.pages : undefined;
    if (!pages) return [];
    const ranked = Object.values(pages).flatMap((page) => {
      const image = page.imageinfo?.[0];
      const metadata = image?.extmetadata;
      if (!image?.thumburl || !image.descriptionurl || !metadata) return [];
      const score = scoreMatch(page.title, metadata.ImageDescription?.value ?? '');
      const license = metadata.LicenseShortName?.value?.replace(/<[^>]*>/g, '').trim();
      if (!score || !license) return [];
      const artist = (metadata.Artist?.value ?? 'Wikimedia Commons contributor')
        .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#0*39;|&apos;/g, "'")
        .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
      return [{ score, photo: {
        url: image.thumburl, credit: `${artist} · ${license}`, link: image.descriptionurl, kind, region,
      } }];
    }).sort((a, b) => b.score - a.score);
    return ranked.map((result) => result.photo);
  } catch {
    // A dead Commons lookup must never take a market listing down with it.
    return [];
  }
}

async function photoFor(
  fetchImpl: GeocodeFetch,
  headers: Record<string, string>,
  name: string,
  city: string | null,
  country: string | null,
): Promise<PlacePhoto | null> {
  const query = [name, city, country].filter(Boolean).join(' ');
  const photos = await commonsPhotos(fetchImpl, headers, query,
    (title, description) => commonsMatchScore(title, description, name), 'exact');
  return photos[0] ?? null;
}

async function bestPhotoFor(
  fetchImpl: GeocodeFetch,
  headers: Record<string, string>,
  candidate: PlaceCandidate,
  regionalCache: Map<string, Promise<PlacePhoto[]>>,
): Promise<PlacePhoto | null> {
  const areaLabel = candidate.name.match(/^Market in (.+)$/)?.[1] ?? null;
  const city = candidate.city ?? areaLabel;
  const country = regionalCountry(candidate);
  // Synthesized names such as "Market in Bariga" identify an area, not an exact market.
  const exact = areaLabel
    ? null
    : await photoFor(fetchImpl, headers, candidate.name, city, country);
  if (exact || !country) return exact;
  let photos = regionalCache.get(country);
  if (!photos) {
    const queries = [
      `${country} market`,
      `${country} street market`,
      `${country} food market`,
      `${country} produce market`,
      `${country} fruit market`,
      `African market ${country}`,
    ];
    if (country === 'Nigeria') {
      queries.push('Lagos market Nigeria', 'traditional market Nigeria', 'Nigerian farmers market', 'local market Nigeria');
    }
    photos = Promise.all(queries.map((query) => commonsPhotos(
      fetchImpl,
      headers,
      query,
      (title, description) => regionalMatchScore(title, description, null, country),
      'regional',
      country,
    ))).then((groups) => {
      const unique = new Map<string, PlacePhoto>();
      for (const photo of groups.flat()) {
        // Commons often publishes a numbered burst as separate files (for example `_01`,
        // `_02`, `_03`). They are near-identical frames, so keep just one in the regional pool.
        const family = photo.link.replace(/_(?:0?[1-9]|[1-9]\d)(?=\.(?:jpe?g|png|webp)(?:[?#]|$))/i, '');
        if (!unique.has(family)) unique.set(family, photo);
      }
      return [...unique.values()];
    }).then((matches) => {
        // Keep successful licensed photo sets for later map boxes. Do not cache an upstream
        // miss, which could otherwise leave every place in a country without images for 15 min.
        if (matches.length === 0) regionalCache.delete(country);
        return matches;
      });
    regionalCache.set(country, photos);
  }
  const matches = await photos;
  if (matches.length === 0) return null;
  // `withPhotos` rotates the complete regional pool through candidates, so nearby cards get
  // different Commons files before the set needs to repeat.
  return matches[0] ?? null;
}

async function withPhotos(
  fetchImpl: GeocodeFetch,
  headers: Record<string, string>,
  candidates: PlaceCandidate[],
): Promise<PlaceCandidate[]> {
  const regionalCache = regionalPhotoCache;
  const results = await Promise.allSettled(candidates.map((candidate) => bestPhotoFor(fetchImpl, headers, candidate, regionalCache)));

  const pools = new Map<string, PlacePhoto[]>();
  for (const candidate of candidates) {
    const country = regionalCountry(candidate);
    const photos = country ? regionalCache.get(country) : undefined;
    if (country && photos && !pools.has(country)) pools.set(country, await photos);
  }
  const regionalCursor = new Map<string, number>();
  return candidates.map((candidate, index) => {
    const result = results[index];
    let photo = result?.status === 'fulfilled' ? result.value : null;
    if (photo?.kind === 'regional') {
      const country = photo.region ?? regionalCountry(candidate);
      const pool = country ? pools.get(country) : undefined;
      if (country && pool?.length) {
        const cursor = regionalCursor.get(country) ?? 0;
        photo = pool[cursor % pool.length] ?? photo;
        regionalCursor.set(country, cursor + 1);
      }
    }
    return {
      ...candidate, image_url: photo?.url ?? null,
      image_credit: photo?.credit ?? null, image_link: photo?.link ?? null,
      image_kind: photo?.kind ?? null, image_region: photo?.region ?? null,
    };
  });
}
/**
 * A geocoder that reads Photon over the given fetch.
 *
 * The user agent is not decoration: OpenStreetMap's usage policy asks every client to say
 * what it is, and the default one identifies this as an anonymous Node process, which is the
 * quickest way to be rate-limited without anyone explaining why.
 *
 * Only confidently matched publication imagery is returned; nearby street imagery is not a
 * market photo and is intentionally excluded.
 */
export function makeGeocoder(
  fetchImpl: GeocodeFetch,
  userAgent: string,
): Geocoder {
  const headers = { 'user-agent': userAgent, accept: 'application/json' };

  /**
   * One round trip, with the failure vocabulary of this module rather than of the upstream.
   *
   * Both services are treated as unreliable witnesses: a socket that never answers, a throttle,
   * a 500 and a body that is not JSON are four different things out there and one of three codes
   * in here, so a client branches on the spec 9.1 code and never on a stranger's status number.
   */
  async function dial(url: string, init: GeocodeRequest): Promise<unknown> {
    let reply: GeocodeReply;
    try {
      reply = await fetchImpl(url, init);
    } catch (err) {
      throw new ApiError(
        'internal',
        `The place lookup did not answer: ${(err as Error).message}`,
      );
    }

    if (!reply.ok) {
      if (reply.status === 429) {
        throw new ApiError(
          'rate_limited',
          'The place lookup is throttling us. Try the search again in a moment.',
        );
      }
      throw new ApiError('internal', `The place lookup answered ${reply.status}.`);
    }

    return reply.json().catch(() => {
      throw new ApiError('internal', 'The place lookup replied with something that was not JSON.');
    });
  }

  /** Photon, already narrowed by zod, with unusable features dropped. */
  async function ask(query: string, limit: number): Promise<PlaceCandidate[]> {
    const url = `${PHOTON_ENDPOINT}?${new URLSearchParams({
      q: query,
      limit: String(limit),
      bbox: AFRICA_BBOX,
    })}`;
    const body = await dial(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const envelope = PhotonResponseSchema.safeParse(body);
    if (!envelope.success) {
      throw new ApiError('internal', 'The place lookup returned a response this server does not understand.');
    }

    // A feature that fails the shape is dropped rather than failing the search: one
    // malformed result in a list of five should not cost the caller the other four. The
    // Africa filter runs before the slice, not after, so a caller asking for `limit` results
    // still gets up to `limit` — not `limit` minus however many fell outside the continent.
    return envelope.data.features
      .map((feature) => PhotonFeatureSchema.safeParse(feature))
      .filter((r) => r.success)
      .map((r) => candidateOf(r.data))
      .filter((place) => isInAfrica(place.country))
      .slice(0, limit);
  }

  /**
   * Overpass, which takes the query in a form body rather than in a parameter — tried against
 * each mirror in turn.
 *
 * A mirror that times out, 504s, or throttles us is not the same failure as all mirrors being
 * down, so only the last mirror's error is the one a caller ever sees. Anything that is *not*
 * an upstream-flakiness code — a validation bug in our own query, say — is thrown immediately
 * instead of being retried for no reason. On a transient mirror failure we also ask Photon for
 * named marketplaces inside the same box. Photon supports a bounding-box filter and returns
 * the same OSM marketplace tags; this keeps map discovery and its place-photo lookups moving
 * when the volunteer Overpass mirrors are slow.
 */
  async function askPhotonBox(box: MarketBox, wanted: number): Promise<PlaceCandidate[]> {
    const bbox = [box.west, box.south, box.east, box.north].join(',');
    const url = `${PHOTON_ENDPOINT}?${new URLSearchParams({
      q: 'market',
      limit: String(MAX_UPSTREAM_LIMIT),
      bbox,
    })}`;
    const raw = await dial(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const envelope = PhotonResponseSchema.safeParse(raw);
    if (!envelope.success) throw new ApiError('internal', 'The place lookup returned a response this server does not understand.');
    return envelope.data.features
      .map((feature) => PhotonFeatureSchema.safeParse(feature))
      .filter((result) => result.success)
      .map((result) => candidateOf(result.data))
      .filter((place) => isMarketCandidate(place) && place.name !== 'Unnamed place')
      .slice(0, wanted);
  }

  async function askBox(box: MarketBox, wanted: number): Promise<PlaceCandidate[]> {
    const body = new URLSearchParams({ data: boxQuery(box, wanted) }).toString();
    let lastErr: unknown;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const raw = await dial(endpoint, {
          headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
          method: 'POST',
          body,
          signal: AbortSignal.timeout(OVERPASS_TIMEOUT_S * 1000),
        });

        const envelope = OverpassResponseSchema.safeParse(raw);
        if (!envelope.success) {
          throw new ApiError('internal', 'The place lookup returned a response this server does not understand.');
        }

        return envelope.data.elements
          .map((element) => OverpassElementSchema.safeParse(element))
          .filter((r) => r.success)
          .map((r) => boxCandidateOf(r.data))
          .slice(0, wanted);
      } catch (err) {
        lastErr = err;
        // Only an upstream-flakiness error is worth trying the next mirror for. A shape error
        // on our own zod schema would fail on every mirror the same way, so it is not one.
        const retryable = err instanceof ApiError && (err.code === 'internal' || err.code === 'rate_limited');
        if (!retryable) throw err;
        try {
          const fallback = await askPhotonBox(box, wanted);
          if (fallback.length > 0) return fallback;
        } catch {
          // Keep trying the other Overpass mirrors if Photon is also unavailable.
        }
      }
    }

    throw lastErr;
  }

  return {
    search: (query, limit) => ask(query, Math.min(limit, MAX_UPSTREAM_LIMIT)),

    // The tag filter happens here because the gazetteer cannot do it. Over-fetching is the
    // only way to hand back `limit` markets rather than `limit` results of which two are.
    // Photos are looked up last and only for the final `limit` rows — never for the discarded
    // over-fetch — since a Commons miss costs nothing but is still a wasted call otherwise.
    async markets(query, limit) {
      const fetched = await ask(asMarketQuery(query), Math.min(limit * OVERFETCH, MAX_UPSTREAM_LIMIT));
      const kept = fetched.filter(isMarketCandidate).slice(0, limit);
      return withPhotos(fetchImpl, headers, kept);
    },

    // The same over-fetch for the same reason: the nodes that carry no `name` are dropped here,
    // so asking for exactly `limit` would answer with fewer whenever a box holds unnamed gates.
    async inBox(box, limit) {
      const fetched = await askBox(box, Math.min(limit * OVERFETCH, MAX_UPSTREAM_LIMIT));
      const kept = fetched.filter(isMarketCandidate).slice(0, limit);
      return withPhotos(fetchImpl, headers, kept);
    },
  };
}

/**
 * A cache key for a corner of the map, rounded to two decimals.
 *
 * Keying on the exact corners means a visitor who drags the map a hundred metres asks a new
 * question of a volunteer mirror. At this granularity the worst answer is a ring that sits half a
 * kilometre off where the visitor happened to be looking, which the section already says it is.
 */
function boxKey(box: MarketBox): string {
  const round = (value: number): string => value.toFixed(2);
  return [box.south, box.west, box.north, box.east].map(round).join(',');
}

/**
 * A bounded, short-lived memo in front of a geocoder.
 *
 * This is what lets `/places/markets` answer without a token. An anonymous route onto someone
 * else's gazetteer is a way to spend their goodwill on our visitors' behalf, and the cheapest
 * answer is to ask the question once: a hundred people searching `Lagos` is one upstream call
 * per fifteen minutes, not a hundred. The `q` minimum length and the capped `limit` do the rest.
 *
 * The *promise* is cached rather than its result, so two searches for the same city that arrive
 * together share one round trip instead of each starting their own. A rejection is dropped,
 * since remembering an outage would keep serving a dead lookup after the upstream recovered.
 *
 * The size cap is the point of it being bounded: an unbounded cache on a public endpoint is a
 * memory leak with a search box in front of it. Two hundred entries of ten places each is a few
 * hundred kilobytes however the traffic looks, and the oldest goes when the list is full.
 */
export function makeCachedGeocoder(
  inner: Geocoder,
  ttlMs: number,
  maxEntries = 200,
): Geocoder {
  const entries = new Map<string, { at: number; value: Promise<PlaceCandidate[]> }>();

  function remember(
    method: 'search' | 'markets' | 'inBox',
    query: string,
    limit: number,
    run: () => Promise<PlaceCandidate[]>,
  ): Promise<PlaceCandidate[]> {
    const key = `${method}:${query.trim().toLowerCase()}:${limit}`;
    const now = Date.now();
    const hit = entries.get(key);

    if (hit && now - hit.at < ttlMs) {
      // Re-inserting makes the Map's own order the least-recently-used order.
      entries.delete(key);
      entries.set(key, hit);
      return hit.value.then((result) => {
        const hasPhotoMiss = (method === 'markets' || method === 'inBox') && result.some((place) => !place.image_url);
        if (hasPhotoMiss && Date.now() - hit.at >= PHOTO_MISS_RETRY_MS) {
          // A transient Commons outage should not turn into a fifteen-minute run of empty photos.
          if (entries.get(key) === hit) entries.delete(key);
          return remember(method, query, limit, run);
        }
        return result;
      });
    }

    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }

    const value = run().catch((err: unknown) => {
      entries.delete(key);
      throw err;
    });
    entries.set(key, { at: now, value });
    return value;
  }

  return {
    search: (query, limit) =>
      remember('search', query, limit, () => inner.search(query, limit)),
    markets: (query, limit) =>
      remember('markets', query, limit, () => inner.markets(query, limit)),
    inBox: (box, limit) =>
      remember('inBox', boxKey(box), limit, () => inner.inBox(box, limit)),
  };
}

/**
 * The real one, on the platform's own fetch. `index.ts` supplies the validated user agent.
 */
export function makeNetworkGeocoder(userAgent: string): Geocoder {
  return makeGeocoder(
    (url, init) => fetch(url, init) as unknown as Promise<GeocodeReply>,
    userAgent,
  );
}
