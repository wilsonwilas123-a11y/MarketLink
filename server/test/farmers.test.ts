import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { demoSubject, fakePool, fakeAuth, testDeps } from './helpers/app.js';

const STALL_ID = '7e7e7e7e-0000-4000-8000-000000000007';
const MARKET_ID = '3f2b6c1e-0000-4000-8000-000000000012';

const auth = { Authorization: 'Bearer a-token' };

const farmerRole = { id: demoSubject.id, role: 'farmer', is_active: true };
const customerRole = { id: demoSubject.id, role: 'customer', is_active: true };

function stallRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STALL_ID,
    stall_name: 'Adeyemi Farms',
    contact_person: 'Bola Adeyemi',
    description: 'Leaf vegetables and tubers.',
    logo_url: null,
    lat: 6.5955,
    lng: 3.3433,
    rating_avg: 4.6,
    rating_count: 38,
    operating_days: ['tue', 'thu', 'sat'],
    cover_url: null,
    pickup_window_start: '08:00:00',
    pickup_window_end: '12:00:00',
    order_cutoff_minutes: 180,
    status: 'pending',
    ...overrides,
  };
}

/**
 * A row shaped like the public select, which never reads `status`. Canned rows have to
 * match the select, or the fake pool hands back a column the real query could not return.
 */
const publicStallRow = (overrides: Record<string, unknown> = {}) =>
  stallRow({ status: undefined, ...overrides });

const sql = (pool: { calls: { text: string }[] }, index = 0) => pool.calls[index]?.text ?? '';
const values = (pool: { calls: { values: unknown[] }[] }, index = 0) => pool.calls[index]?.values;

/** The assignment list alone: `returning` re-reads every column, so it is not evidence of a write. */
const setClause = (pool: { calls: { text: string }[] }, index = 0) => {
  const text = sql(pool, index);
  return text.slice(text.indexOf('set ') + 4, text.indexOf(' where'));
};

describe('GET /api/farmers', () => {
  it('lists approved stalls for a visitor, best rated first', async () => {
    const pool = fakePool([[publicStallRow({ total_count: 8 })]]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers');

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 8, page: 1, limit: 24 });
    expect(sql(pool)).toContain("status = 'approved'");
    expect(sql(pool)).toContain('order by rating_avg desc, stall_name');
    // A stall at four markets is one row, so `total` has to be able to agree with it.
    expect(sql(pool)).not.toContain('join market_farmers');
    expect(res.body.data[0]).not.toHaveProperty('status');
    expect(res.body.data[0]).not.toHaveProperty('total_count');
  });

  it('narrows by market and category with subqueries, not joins', async () => {
    const pool = fakePool([[]]);
    const res = await request(createApp(testDeps({ pool }))).get(
      `/api/farmers?market_id=${MARKET_ID}&category=vegetables`,
    );

    expect(res.status).toBe(200);
    expect(sql(pool)).toContain('exists (select 1 from market_farmers');
    expect(sql(pool)).toContain('exists (select 1 from products');
    expect(values(pool)).toEqual([MARKET_ID, 'vegetables', 24, 0]);
  });

  it('refuses a market id that is not one', async () => {
    const pool = fakePool([]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers?market_id=lekki');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('market_id');
    expect(pool.calls).toHaveLength(0);
  });
});

describe('GET /api/farmers/me', () => {
  it('resolves before the detail route, which cannot read the word me as an id', async () => {
    const pool = fakePool([farmerRole, stallRow()]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me').set(auth);

    expect(res.status).toBe(200);
    // The detail route would have failed validation on `me` before ever reaching a query.
    expect(pool.calls).toHaveLength(2);
    expect(sql(pool, 1)).toContain('from farmers where profile_id = $1');
  });

  it('shows a pending stall to its owner, which is the whole point of the screen', async () => {
    const pool = fakePool([farmerRole, stallRow({ status: 'pending' })]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me').set(auth);

    expect(res.body).toMatchObject({ stall_name: 'Adeyemi Farms', status: 'pending' });
  });

  it('needs a token', async () => {
    const pool = fakePool([]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('is not the customer dashboard wearing a different url', async () => {
    const pool = fakePool([customerRole]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me').set(auth);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    // The role gate answered before any stall query ran.
    expect(pool.calls).toHaveLength(1);
  });

  it('says so when a farmer account has no stall behind it', async () => {
    const pool = fakePool([farmerRole, null]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me').set(auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('PATCH /api/farmers/me', () => {
  it('writes only the fields that arrived', async () => {
    const pool = fakePool([farmerRole, stallRow({ stall_name: 'Adeyemi Farms and Sons' })]);
    const res = await request(createApp(testDeps({ pool })))
      .patch('/api/farmers/me')
      .set(auth)
      .send({ stall_name: 'Adeyemi Farms and Sons', operating_days: ['sat', 'sun'] });

    expect(res.status).toBe(200);
    expect(setClause(pool, 1)).toBe('stall_name = $1, operating_days = $2');
    expect(sql(pool, 1)).toContain('where profile_id = $3');
    expect(values(pool, 1)).toEqual(['Adeyemi Farms and Sons', ['sat', 'sun'], demoSubject.id]);
  });

  it('cannot be told that the stall is approved', async () => {
    const pool = fakePool([farmerRole, stallRow()]);
    const res = await request(createApp(testDeps({ pool })))
      .patch('/api/farmers/me')
      .set(auth)
      .send({ stall_name: 'Anywhere Farms', status: 'approved' });

    expect(res.status).toBe(400);
    // The strict schema rejects `status` before anything is written. The detail list also
    // carries the empty-patch refinement, so assert on membership rather than one item.
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('status');
    expect(pool.calls).toHaveLength(1);
  });

  it('rejects a pickup window that closes before it opens', async () => {
    const pool = fakePool([farmerRole, stallRow()]);
    const res = await request(createApp(testDeps({ pool })))
      .patch('/api/farmers/me')
      .set(auth)
      .send({ pickup_window_start: '14:00:00', pickup_window_end: '09:00:00' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('pickup_window_end');
    expect(pool.calls).toHaveLength(1);
  });

  it('refuses to write an empty update', async () => {
    const pool = fakePool([farmerRole, stallRow()]);
    const res = await request(createApp(testDeps({ pool })))
      .patch('/api/farmers/me')
      .set(auth)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('(root)');
  });
});

describe('POST /api/farmers/me/geo', () => {
  it('moves the pin and nothing else', async () => {
    const pool = fakePool([farmerRole, stallRow({ lat: 6.4281, lng: 3.4219 })]);
    const res = await request(createApp(testDeps({ pool })))
      .post('/api/farmers/me/geo')
      .set(auth)
      .send({ lat: 6.4281, lng: 3.4219 });

    expect(res.status).toBe(200);
    expect(sql(pool, 1)).toContain('set lat = $2, lng = $3 where profile_id = $1');
    expect(values(pool, 1)).toEqual([demoSubject.id, 6.4281, 3.4219]);
  });

  it('wants both halves of a coordinate', async () => {
    const pool = fakePool([farmerRole]);
    const res = await request(createApp(testDeps({ pool })))
      .post('/api/farmers/me/geo')
      .set(auth)
      .send({ lat: 6.4 });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('lng');
    expect(pool.calls).toHaveLength(1);
  });
});

describe('GET /api/farmers/me/markets', () => {
  it('finds the stall first, then its pitches', async () => {
    const pool = fakePool([
      farmerRole,
      { id: STALL_ID },
      { id: MARKET_ID, name: 'Mile 12 Market', address: 'Ikorodu Road', city: 'Lagos', stall_ref: 'A12', days: ['tue'] },
    ]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me/markets').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: MARKET_ID, name: 'Mile 12 Market', address: 'Ikorodu Road', city: 'Lagos', stall_ref: 'A12', days: ['tue'] },
    ]);
    expect(sql(pool, 1)).toContain('select id from farmers where profile_id = $1');
    expect(values(pool, 2)).toEqual([STALL_ID]);
  });
});

describe('GET /api/farmers/:id', () => {
  const profile = publicStallRow();

  it('assembles the stall, its markets, this week and its reviews', async () => {
    const pool = fakePool([
      profile,
      [{ id: MARKET_ID, name: 'Mile 12 Market', address: 'Ikorodu Road', city: 'Lagos', stall_ref: 'A12', days: ['tue'] }],
      [],
      [],
    ]);
    const res = await request(createApp(testDeps({ pool }))).get(`/api/farmers/${STALL_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      stall_name: 'Adeyemi Farms',
      markets: [{ stall_ref: 'A12' }],
      products: [],
      reviews: [],
    });
    expect(res.body).not.toHaveProperty('status');
    // After the profile comes the markets, products and reviews fan-out. The stock join is
    // the point: week stock is looked up by the same string the API computes, not a date range.
    const productsQuery = [1, 2, 3].map((n) => sql(pool, n)).find((text) => text.includes('weekly_stock'));
    expect(productsQuery).toContain('ws.week = iso_week()');
    expect(productsQuery).toContain('left join weekly_stock');
  });

  it('answers not found for a stall that is not approved, without saying why', async () => {
    // A 403 here would tell a shopper that the stall exists and was rejected. The approval
    // queue is not public information, so the two failures are the same answer.
    const pool = fakePool([null]);
    const res = await request(createApp(testDeps({ pool }))).get(`/api/farmers/${STALL_ID}`);

    expect(res.status).toBe(404);
    expect(sql(pool)).toContain("status = 'approved'");
    expect(pool.calls).toHaveLength(1);
  });
});

describe('the farmer routes do not trust the token alone', () => {
  it('reads the role from the database on every call', async () => {
    // Suspended mid-session: the profile row is what decides, so the next request is refused
    // even though the access token still verifies perfectly well.
    const pool = fakePool([{ id: demoSubject.id, role: 'farmer', is_active: false }]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/farmers/me').set(auth);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_disabled');
  });

  it('refuses a token the identity provider does not recognise', async () => {
    const pool = fakePool([farmerRole, stallRow()]);
    const app = createApp({ pool, auth: fakeAuth(null) });
    const res = await request(app).get('/api/farmers/me').set(auth);

    expect(res.status).toBe(401);
    expect(pool.calls).toHaveLength(0);
  });
});
