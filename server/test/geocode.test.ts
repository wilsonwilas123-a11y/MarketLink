import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ApiError } from '../src/errors.js';
import { makeCachedGeocoder, makeGeocoder, parseMarketBox } from '../src/services/geocode.js';
import type { GeocodeFetch, GeocodeReply, Geocoder, MarketBox } from '../src/services/geocode.js';
import { fakeGeocode, fakePool, profileRow, testDeps } from './helpers/app.js';
import type { PlaceCandidate } from '../src/api/schemas.js';

/**
 * The one route that leaves the process, tested without leaving the process.
 *
 * Every case below hands the module a reply object instead of a socket, so the assertions are
 * about what the server does with an upstream — including when that upstream is rude, slow or
 * lying about its own shape — and not about whether Komoot is up this morning.
 */

const auth = { Authorization: 'Bearer a-token' };

/** Bodija Market, as Photon actually answered on 2026-09-26. */
const PHOTON_BODIJA = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [3.9157745, 7.4371869] },
      properties: {
        osm_type: 'N',
        osm_id: 2453679849,
        osm_key: 'amenity',
        osm_value: 'marketplace',
        type: 'house',
        name: 'Bodija Market',
        street: 'Major Salawu Street',
        locality: 'Agbowo',
        county: 'Ibadan North',
        state: 'Oyo',
        country: 'Nigeria',
        postcode: '200213',
        countrycode: 'NG',
      },
    },
  ],
};

/**
 * What `market Ibadan` really answered on 2026-09-26, in the order the gazetteer ranked it.
 *
 * Three of the six are marketplaces and the rest are an expressway, a neighbourhood and an
 * electronics shop, which is why `markets()` has to fetch more than it hands back.
 */
const PHOTON_IBADAN_MIX = {
  type: 'FeatureCollection',
  features: [
    feature({ name: 'Mapo Market', osm_id: 1, lat: 7.3775, lng: 3.8874 }),
    feature({
      name: 'Ibadan-Ilorin Expressway',
      osm_id: 2,
      lat: 7.39,
      lng: 3.9,
      osm_key: 'highway',
      osm_value: 'motorway',
    }),
    feature({ name: 'Oja Oba Market', osm_id: 3, lat: 7.3778, lng: 3.8994 }),
    feature({
      name: 'Bodija Market',
      osm_id: 4,
      lat: 7.4372,
      lng: 3.9158,
      osm_key: 'place',
      osm_value: 'neighbourhood',
    }),
    feature({ name: 'Dugbe Market', osm_id: 5, lat: 7.3946, lng: 3.8796 }),
    feature({
      name: 'IFESOLOX IBADAN',
      osm_id: 6,
      lat: 7.38,
      lng: 3.91,
      osm_key: 'shop',
      osm_value: 'electronics',
    }),
  ],
};

/** One marketplace node, unless told otherwise. */
function feature(over: {
  name: string;
  osm_id: number;
  lat: number;
  lng: number;
  osm_key?: string;
  osm_value?: string;
}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [over.lng, over.lat] },
    properties: {
      osm_type: 'N',
      osm_id: over.osm_id,
      osm_key: over.osm_key ?? 'amenity',
      osm_value: over.osm_value ?? 'marketplace',
      name: over.name,
      city: 'Ibadan',
      state: 'Oyo',
      country: 'Nigeria',
    },
  };
}

/**
 * A corner of Lagos, as Overpass answered it on 2026-09-26.
 *
 * Alongside the market that carries an address there is a gate nobody has ever named, a node
 * whose `name` is present and empty, and a building outline mapped as a way — three things a
 * visitor cannot read off a ring, and three things the box path has to leave out.
 */
const OVERPASS_BOX = {
  elements: [
    {
      type: 'node',
      id: 4812830899,
      lat: 6.5234,
      lon: 3.3671,
      tags: {
        amenity: 'marketplace',
        name: 'Obuzu Market',
        'addr:street': 'Obuzu Lane',
        'addr:city': 'Lagos',
        'addr:country': 'NG',
      },
    },
    { type: 'node', id: 10101, lat: 6.53, lon: 3.37, tags: { amenity: 'marketplace' } },
    { type: 'node', id: 10102, lat: 6.531, lon: 3.371, tags: { amenity: 'marketplace', name: '' } },
    { type: 'way', id: 10103, tags: { amenity: 'marketplace', name: 'A mapped outline' } },
  ],
};

const reply = (body: unknown, status = 200): GeocodeReply => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const rejecting =
  (err: unknown): GeocodeFetch =>
  async () => {
    throw err;
  };

const fetching =
  (body: unknown, status = 200): GeocodeFetch =>
  async () => reply(body, status);

const calls: Array<{ url: string; headers: Record<string, string>; method?: string; body?: string }> = [];
const recording =
  (body: unknown): GeocodeFetch =>
  async (url, init) => {
    calls.push({ url, headers: init.headers, method: init.method, body: init.body });
    return reply(body);
  };

/** The form field Overpass reads its query out of. */
function sentQuery(body?: string): string {
  return new URLSearchParams(body ?? '').get('data') ?? '';
}

describe('makeGeocoder', () => {
  it('reads a gazetteer reply into a candidate pin', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_BODIJA), 'MarketLinkTest/0.1');
    const found = await geocode.search('Bodija Market Ibadan', 5);

    expect(found).toEqual([
      {
        ref: 'n2453679849',
        name: 'Bodija Market',
        lat: 7.4371869,
        lng: 3.9157745,
        address: 'Major Salawu Street, Agbowo, 200213, Oyo, Nigeria',
        city: 'Agbowo',
        state: 'Oyo',
        country: 'Nigeria',
        kind: 'amenity/marketplace',
      },
    ]);
    // The query travels as a parameter to a host the caller cannot choose, and the
    // identification OpenStreetMap asks for is on the wire.
    expect(calls[0]?.url).toContain('https://photon.komoot.io/api/?q=Bodija+Market+Ibadan&limit=5');
    expect(calls[0]?.headers['user-agent']).toBe('MarketLinkTest/0.1');
  });

  it('keeps the features it can read and drops the ones it cannot', async () => {
    const geocode = makeGeocoder(
      fetching({
        features: [
          PHOTON_BODIJA.features[0],
          { properties: { name: 'Nowhere' } },
          {
            geometry: { type: 'Point', coordinates: [3.9, 7.4, 210] },
            properties: { name: 'Somewhere' },
          },
        ],
      }),
      'MarketLinkTest/0.1',
    );

    const found = await geocode.search('anything', 5);
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe('Bodija Market');
  });

  it('turns a throttle into 429 rather than a 500', async () => {
    const geocode = makeGeocoder(fetching({}, 429), 'MarketLinkTest/0.1');
    await expect(geocode.search('somewhere', 5)).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });

  it.each([[500], [503]])('reports an upstream %i as internal', async (status) => {
    const geocode = makeGeocoder(fetching({}, status), 'MarketLinkTest/0.1');
    await expect(geocode.search('somewhere', 5)).rejects.toBeInstanceOf(ApiError);
  });

  it('refuses a body that is not the envelope it documented', async () => {
    const geocode = makeGeocoder(fetching('<html>cache miss</html>'), 'MarketLinkTest/0.1');
    await expect(geocode.search('somewhere', 5)).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('reports a socket that never answers as internal, with the cause', async () => {
    const geocode = makeGeocoder(rejecting(new Error('socket hang up')), 'x/0.1');
    await expect(geocode.search('somewhere', 5)).rejects.toMatchObject({
      code: 'internal',
      message: 'The place lookup did not answer: socket hang up',
    });
  });
});

describe('makeGeocoder().markets', () => {
  it('keeps the marketplaces out of a mixed gazetteer reply', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_IBADAN_MIX), 'MarketLinkTest/0.1');
    const found = await geocode.markets('market Ibadan', 3);

    expect(found.map((place) => place.name)).toEqual(['Mapo Market', 'Oja Oba Market', 'Dugbe Market']);
    // The tag filter is ours, so the ask has to be for more than the answer.
    expect(calls[0]?.url).toContain('q=market+Ibadan&limit=12');
  });

  it('truncates the fetch before it filters, so a small ask costs a small round trip', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_IBADAN_MIX), 'MarketLinkTest/0.1');
    const found = await geocode.markets('market Ibadan', 1);

    expect(found.map((place) => place.name)).toEqual(['Mapo Market']);
    expect(calls[0]?.url).toContain('limit=4');
  });

  it('never asks the gazetteer for more than fifty places, however it was asked', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_IBADAN_MIX), 'MarketLinkTest/0.1');
    await geocode.markets('market Ibadan', 40);

    expect(calls[0]?.url).toContain('limit=50');
  });

  it('asks a bare town name as a market question', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_BODIJA), 'MarketLinkTest/0.1');
    await geocode.markets('Kumasi', 4);

    expect(calls[0]?.url).toContain('q=Kumasi+market&limit=16');
  });

  it('does not ask twice of a term that already says market', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_BODIJA), 'MarketLinkTest/0.1');
    await geocode.markets('Kumasi markets', 4);

    expect(calls[0]?.url).toContain('q=Kumasi+markets&limit=16');
  });

  it('leaves a pin search in the caller’s own words', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(PHOTON_BODIJA), 'MarketLinkTest/0.1');
    await geocode.search('Kumasi', 4);

    expect(calls[0]?.url).toContain('q=Kumasi&limit=4');
  });
});

describe('parseMarketBox', () => {
  it('reads four corners, spaces and all', () => {
    expect(parseMarketBox('6.4, 3.2, 6.7, 3.6')).toEqual({
      south: 6.4,
      west: 3.2,
      north: 6.7,
      east: 3.6,
    });
  });

  it.each([
    ['three numbers', '6.4,3.2,6.7'],
    ['an empty part', '6.4,,6.7,3.6'],
    ['a word where a coordinate belongs', '6.4,market,6.7,3.6'],
  ])('refuses %s', (_what, raw) => {
    expect(() => parseMarketBox(raw)).toThrowError(/four numbers/);
  });

  it('refuses a corner off the planet', () => {
    expect(() => parseMarketBox('91,3.2,91.5,3.6')).toThrowError(/outside the world/);
  });

  it('refuses a box that runs south', () => {
    expect(() => parseMarketBox('6.7,3.2,6.4,3.6')).toThrowError(/north and east/);
  });

  it('accepts a box exactly at the limit, which is not 0.6 in binary', () => {
    expect(parseMarketBox('6.4,3.1,6.8,3.7')).toMatchObject({ south: 6.4, east: 3.7 });
  });

  it('refuses a box bigger than a visitor can see at once', () => {
    expect(() => parseMarketBox('6.4,3.2,7.4,3.6')).toThrowError(/more than 0.6/);
  });
});

describe('makeGeocoder().inBox', () => {
  const box: MarketBox = { south: 6.4, west: 3.2, north: 6.7, east: 3.6 };

  it('asks the map data service for the box, in a form body, identified', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(OVERPASS_BOX), 'MarketLinkTest/0.1');
    await geocode.inBox(box, 3);

    expect(calls[0]?.url).toBe('https://overpass-api.de/api/interpreter');
    expect(calls[0]?.method).toBe('POST');
    expect(sentQuery(calls[0]?.body)).toBe(
      '[out:json][timeout:12];node["amenity"="marketplace"](6.4,3.2,6.7,3.6);out 12;',
    );
    expect(calls[0]?.headers['user-agent']).toBe('MarketLinkTest/0.1');
    expect(calls[0]?.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  it('keeps the nodes a visitor can read and drops the ones nobody named', async () => {
    const geocode = makeGeocoder(fetching(OVERPASS_BOX), 'MarketLinkTest/0.1');
    const found = await geocode.inBox(box, 6);

    // The untagged gate, the empty name and the building mapped as a way all go; the address is
    // whatever `addr:*` the mapper happened to fill in, which is rarely much.
    expect(found).toEqual([
      {
        ref: 'n4812830899',
        name: 'Obuzu Market',
        lat: 6.5234,
        lng: 3.3671,
        address: 'Obuzu Lane, Lagos, NG',
        city: 'Lagos',
        state: null,
        country: 'NG',
        kind: 'amenity/marketplace',
      },
    ]);
  });

  it('never asks the mirror for more than fifty nodes', async () => {
    calls.length = 0;
    const geocode = makeGeocoder(recording(OVERPASS_BOX), 'MarketLinkTest/0.1');
    const found = await geocode.inBox(box, 40);

    expect(sentQuery(calls[0]?.body)).toContain('out 50;');
    expect(found).toHaveLength(1);
  });
});

/** A geocoder that counts its own calls, so a cache hit is visible. */
function counting(inner: Geocoder) {
  const counts = { search: 0, markets: 0, inBox: 0 };
  return {
    counts,
    geocoder: {
      async search(query: string, limit: number) {
        counts.search += 1;
        return inner.search(query, limit);
      },
      async markets(query: string, limit: number) {
        counts.markets += 1;
        return inner.markets(query, limit);
      },
      async inBox(box: MarketBox, limit: number) {
        counts.inBox += 1;
        return inner.inBox(box, limit);
      },
    } satisfies Geocoder,
  };
}

const oneMarket = [candidate()];
const nullGeocoder: Geocoder = {
  search: async () => oneMarket,
  markets: async () => oneMarket,
  inBox: async () => oneMarket,
};

describe('makeCachedGeocoder', () => {
  it('asks the upstream once for two searches of the same words', async () => {
    const { counts, geocoder } = counting(nullGeocoder);
    const cached = makeCachedGeocoder(geocoder, 60_000);

    const [a, b] = await Promise.all([
      cached.markets(' Dawanau ', 5),
      cached.markets('dawanau', 5),
    ]);

    expect(counts.markets).toBe(1);
    // Same promise, not a copy: concurrent callers shared the one round trip.
    expect(a).toBe(b);
  });

  it('keeps a pin search apart from a market search of the same words', async () => {
    const { counts, geocoder } = counting(nullGeocoder);
    const cached = makeCachedGeocoder(geocoder, 60_000);

    await cached.search('Bodija', 5);
    await cached.markets('Bodija', 5);

    expect(counts).toEqual({ search: 1, markets: 1, inBox: 0 });
  });

  it('does not remember a failure, so an outage outlives nothing', async () => {
    let attempts = 0;
    const cached = makeCachedGeocoder(
      {
        search: async () => oneMarket,
        async markets() {
          attempts += 1;
          if (attempts === 1) throw new ApiError('internal', 'The place lookup answered 503.');
          return oneMarket;
        },
        inBox: async () => oneMarket,
      },
      60_000,
    );

    await expect(cached.markets('Bodija', 5)).rejects.toBeInstanceOf(ApiError);
    await expect(cached.markets('Bodija', 5)).resolves.toEqual(oneMarket);
    expect(attempts).toBe(2);
  });

  it('forgets an answer once it is older than the ttl', async () => {
    vi.useFakeTimers();
    try {
      const { counts, geocoder } = counting(nullGeocoder);
      const cached = makeCachedGeocoder(geocoder, 60_000);

      await cached.markets('Bodija', 5);
      vi.advanceTimersByTime(59_000);
      await cached.markets('Bodija', 5);
      expect(counts.markets).toBe(1);

      vi.advanceTimersByTime(2_000);
      await cached.markets('Bodija', 5);
      expect(counts.markets).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the least recently used entry rather than growing', async () => {
    const { counts, geocoder } = counting(nullGeocoder);
    const cached = makeCachedGeocoder(geocoder, 60_000, 2);

    await cached.markets('a', 5);
    await cached.markets('b', 5);
    // `a` is read again, so it is now the newer of the pair.
    await cached.markets('a', 5);
    expect(counts.markets).toBe(2);

    await cached.markets('c', 5);
    expect(counts.markets).toBe(3);

    await cached.markets('a', 5);
    expect(counts.markets).toBe(3);
    // `b` was the one that went.
    await cached.markets('b', 5);
    expect(counts.markets).toBe(4);
  });

  it('treats a small pan as the same question', async () => {
    const { counts, geocoder } = counting(nullGeocoder);
    const cached = makeCachedGeocoder(geocoder, 60_000);
    const here: MarketBox = { south: 6.41, west: 3.2, north: 6.71, east: 3.6 };

    await cached.inBox(here, 6);
    // The map moved by a few hundred metres, which is not a new question.
    await cached.inBox({ south: 6.412, west: 3.201, north: 6.712, east: 3.601 }, 6);
    expect(counts.inBox).toBe(1);

    await cached.inBox({ south: 6.6, west: 3.2, north: 6.9, east: 3.6 }, 6);
    expect(counts.inBox).toBe(2);
  });
});

function candidate(over: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    ref: 'n1',
    name: 'Dawanau International Market',
    lat: 12.05,
    lng: 8.55,
    address: 'Bichi Road, Kano',
    city: 'Kano',
    state: 'Kano',
    country: 'Nigeria',
    kind: 'amenity/marketplace',
    ...over,
  };
}

describe('GET /api/geo/search', () => {
  it('refuses a visitor, because the route spends a third party goodwill', async () => {
    const res = await request(createApp(testDeps())).get('/api/geo/search?q=Bodija');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('hands the geographer exactly what was asked for and answers with its list', async () => {
    const geocode = fakeGeocode([candidate()]);
    const pool = fakePool([profileRow]);
    const res = await request(createApp(testDeps({ pool, geocode }))).get(
      '/api/geo/search?q=Dawanau&limit=3',
    ).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([candidate()]);
    expect(geocode.calls).toEqual([{ query: 'Dawanau', limit: 3 }]);
  });

  it('defaults to five candidates when the caller does not say', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode })))
      .get('/api/geo/search?q=Bodija')
      .set(auth);

    expect(res.status).toBe(200);
    expect(geocode.calls).toEqual([{ query: 'Bodija', limit: 5 }]);
  });

  it('rejects a query too short to disambiguate anything', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode })))
      .get('/api/geo/search?q=ka')
      .set(auth);

    expect(res.status).toBe(400);
    expect(geocode.calls).toEqual([]);
  });

  it('carries a throttle through as 429, not as our own failure', async () => {
    const geocode = fakeGeocode([], new ApiError('rate_limited', 'The place lookup is throttling us.'));
    const res = await request(createApp(testDeps({ geocode })))
      .get('/api/geo/search?q=Bodija')
      .set(auth);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('rate_limited');
  });
});

describe('GET /api/places/markets', () => {
  it('answers a visitor, because a discovery screen has no token to spend', async () => {
    const geocode = fakeGeocode([candidate()]);
    const res = await request(createApp(testDeps({ geocode }))).get('/api/places/markets?q=Ibadan');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([candidate()]);
    expect(geocode.marketCalls).toEqual([{ query: 'Ibadan', limit: 5 }]);
    expect(geocode.calls).toEqual([]);
  });

  it('passes the limit straight through', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode }))).get('/api/places/markets?q=Kano&limit=8');

    expect(res.status).toBe(200);
    expect(geocode.marketCalls).toEqual([{ query: 'Kano', limit: 8 }]);
  });

  it('refuses a query too short to disambiguate anything, without dialling out', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode }))).get('/api/places/markets?q=ka');

    expect(res.status).toBe(400);
    expect(geocode.marketCalls).toEqual([]);
  });

  it('carries an upstream throttle through as 429', async () => {
    const geocode = fakeGeocode([], new ApiError('rate_limited', 'The place lookup is throttling us.'));
    const res = await request(createApp(testDeps({ geocode }))).get('/api/places/markets?q=Ibadan');

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('rate_limited');
  });
});

describe('GET /api/places/markets/box', () => {
  it('answers a visitor with the markets in the corner they are looking at', async () => {
    const geocode = fakeGeocode([candidate()]);
    const res = await request(createApp(testDeps({ geocode }))).get(
      '/api/places/markets/box?bbox=6.4,3.2,6.7,3.6',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([candidate()]);
    // Six, not five: the box is a wider question than a name, and it is asked once per view.
    expect(geocode.boxCalls).toEqual([
      { box: { south: 6.4, west: 3.2, north: 6.7, east: 3.6 }, limit: 6 },
    ]);
    expect(geocode.marketCalls).toEqual([]);
  });

  it('passes an explicit limit straight through', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode }))).get(
      '/api/places/markets/box?bbox=6.4,3.2,6.7,3.6&limit=11',
    );

    expect(res.status).toBe(200);
    expect(geocode.boxCalls).toEqual([
      { box: { south: 6.4, west: 3.2, north: 6.7, east: 3.6 }, limit: 11 },
    ]);
  });

  it('refuses a box the size of a country, without dialling out', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode }))).get(
      '/api/places/markets/box?bbox=4.0,2.0,14.0,15.0',
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(geocode.boxCalls).toEqual([]);
  });

  it('refuses a bbox that is not four numbers, without dialling out', async () => {
    const geocode = fakeGeocode([]);
    const res = await request(createApp(testDeps({ geocode }))).get(
      '/api/places/markets/box?bbox=6.4,3.2,6.7',
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(geocode.boxCalls).toEqual([]);
  });
});
