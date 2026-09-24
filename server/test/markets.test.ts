import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { fakePool, testDeps } from './helpers/app.js';

const MILE_12 = '3f2b6c1e-0000-4000-8000-000000000012';
const LEKKI = '3f2b6c1e-0000-4000-8000-000000000013';

function marketRow(id: string, name: string, total: number) {
  return {
    id,
    name,
    address: 'Ikorodu Road',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.5955,
    lng: 3.3433,
    operating_days: ['tue', 'thu', 'sat'],
    opens_at: '07:00:00',
    closes_at: '17:00:00',
    image_url: null,
    is_open_now: true,
    total_count: total,
  };
}

const sql = (pool: { calls: { text: string }[] }, index = 0) => pool.calls[index]?.text ?? '';

describe('GET /api/markets', () => {
  it('answers a visitor, and reports the whole matched count', async () => {
    const pool = fakePool([[marketRow(MILE_12, 'Mile 12 Market', 4), marketRow(LEKKI, 'Lekki', 4)]]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/markets');

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 4, page: 1, limit: 24 });
    expect(res.body.data).toHaveLength(2);
    // The window's tally is a paging detail, not a market field.
    expect(res.body.data[0]).not.toHaveProperty('total_count');
    expect(res.body.data[0]).toMatchObject({ name: 'Mile 12 Market', lat: 6.5955, is_open_now: true });
  });

  it('sends every filter as a parameter, never as text in the statement', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get(
      '/api/markets?city=Lagos&day=sat&q=12%25&open_now=true',
    );

    expect(res.status).toBe(200);
    expect(sql(pool)).toContain('city ilike $1');
    expect(sql(pool)).toContain("operating_days @> array[$2]::text[]");
    expect(sql(pool)).toContain('is_active');
    // The search term — here containing a wildcard and a percent — only ever exists in values.
    expect(sql(pool)).not.toContain('12');
    expect(pool.calls[0]?.values).toEqual(['Lagos', 'sat', '%12%%', 24, 0]);
  });

  it('counts one matched row three ways with a single placeholder', async () => {
    const pool = fakePool([[]]);
    await request(createApp(testDeps({ pool }))).get('/api/markets?q=sanni');

    // Three columns, one parameter: `$1` appears three times rather than as $1, $2, $3.
    const where = sql(pool).split('where')[1] ?? '';
    expect((where.match(/\$1/g) ?? []).length).toBe(3);
    expect(where).toContain('name ilike $1 or address ilike $1 or city ilike $1');
  });

  it('refuses a day that is not one of the seven', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/markets?day=funday');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.details).toEqual([{ field: 'day', message: expect.any(String) }]);
    expect(pool.calls).toHaveLength(0);
  });

  it('caps the page size so a limit cannot ask for the whole table', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/markets?limit=5000');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('limit');
  });
});

describe('GET /api/markets/nearby', () => {
  it('is a route, not a malformed market id', async () => {
    // `/markets/:id` validates a uuid, so a request that reaches that route first gets a 400
    // for a word that was never meant to be an id.
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get(
      '/api/markets/nearby?lat=6.5&lng=3.3',
    );

    expect(res.status).toBe(200);
    expect(sql(pool)).toContain('from markets');
    expect(sql(pool)).not.toContain('where id = $1');
  });

  it('bounds a box, then measures inside it', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get(
      '/api/markets/nearby?lat=6.5955&lng=3.3433',
    );

    expect(res.status).toBe(200);
    const text = sql(pool);
    const values = pool.calls[0]?.values ?? [];

    expect(values.slice(0, 2)).toEqual([6.5955, 3.3433]);
    // The origin comes first because the haversine fragment refers to it as $1 and $2.
    expect(text).toContain('asin(sqrt(');
    expect(text).toContain('lat between $3 and $4');
    expect(text).toContain('lng between $5 and $6');
    // Box then radius: the box is the index-friendly narrowing, the radius the exact cut.
    expect(text.indexOf('between $3 and $4')).toBeLessThan(text.indexOf('exact_km <= $7'));
    expect(text).toContain('order by exact_km');
    // Defaults: a 10 km radius, 24 per page, starting at the first.
    expect(values.slice(6)).toEqual([10, 24, 0]);
  });

  it('keeps the box wider east-west than north-south', async () => {
    const pool = fakePool([[]]);
    await request(createApp(testDeps({ pool }))).get('/api/markets/nearby?lat=6.5&lng=3.3&radius_km=10');

    // Positionally fixed: $3-$6 are the box, in that order, by construction of the query.
    const [minLat, maxLat, minLng, maxLng] = pool.calls[0]?.values.slice(2, 6) as [
      number,
      number,
      number,
      number,
    ];
    expect(maxLng - minLng).toBeGreaterThan(maxLat - minLat);
  });

  it('rounds a distance to something a map label can print', async () => {
    const pool = fakePool([[{ ...marketRow(MILE_12, 'Mile 12', 1), distance_km: 4.82 }]]);
    const res = await request(createApp(testDeps({ pool }))).get(
      '/api/markets/nearby?lat=6.5&lng=3.3',
    );

    // Through `numeric`, because the two-argument round() does not exist for float8. Back to
    // float8 afterwards so the driver hands the map a number rather than a numeric string.
    expect(sql(pool)).toContain('round(exact_km::numeric, 2)::float8 as distance_km');
    expect(res.body.data[0].distance_km).toBe(4.82);
  });

  it('asks for a point', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/markets/nearby?lat=6.5');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'lng', message: expect.any(String) }]);
  });

  it('refuses a latitude the box maths cannot divide by', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get(
      '/api/markets/nearby?lat=90&lng=3.3',
    );

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('lat');
    expect(pool.calls).toHaveLength(0);
  });
});

describe('GET /api/markets/:id', () => {
  const rosterRow = {
    id: '9a8b7c6d-0000-4000-8000-000000000001',
    stall_name: 'Adeyemi Farms',
    contact_person: 'Bola Adeyemi',
    logo_url: null,
    rating_avg: 4.6,
    rating_count: 38,
    stall_ref: 'A12',
    days: ['tue', 'thu'],
    product_count: 6,
  };

  it('returns the market with its roster and a summed product count', async () => {
    const pool = fakePool([
      marketRow(MILE_12, 'Mile 12 Market', 1),
      [{ ...rosterRow }, { ...rosterRow, id: LEKKI, stall_name: 'Lawal Dairy', product_count: 3 }],
    ]);
    const res = await request(createApp(testDeps({ pool }))).get(`/api/markets/${MILE_12}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mile 12 Market');
    expect(res.body.product_count).toBe(9);
    expect(res.body.farmers).toHaveLength(2);
    expect(res.body.farmers[0]).not.toHaveProperty('product_count');
    expect(res.body.farmers[0]).toMatchObject({ stall_ref: 'A12', days: ['tue', 'thu'] });
  });

  it('lists only approved stalls at the market', async () => {
    const pool = fakePool([marketRow(MILE_12, 'Mile 12', 1), []]);
    await request(createApp(testDeps({ pool }))).get(`/api/markets/${MILE_12}`);

    expect(sql(pool, 1)).toContain("f.status = 'approved'");
    expect(pool.calls[1]?.values).toEqual([MILE_12]);
  });

  it('says not found rather than empty for a market that is not there', async () => {
    const pool = fakePool([null]);
    const res = await request(createApp(testDeps({ pool }))).get(`/api/markets/${MILE_12}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    // No roster query after a market that does not exist.
    expect(pool.calls).toHaveLength(1);
  });

  it('refuses an id that is not an id', async () => {
    const pool = fakePool([]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/markets/mile-12');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('id');
    expect(pool.calls).toHaveLength(0);
  });
});
