import { afterAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { Pool, type QueryResult } from 'pg';
import { loadEnvFile } from '../src/lib/env.js';
import { farmerDetail, listFarmers, myStall, myStallMarkets, pinStall, updateStall } from '../src/services/farmers.js';
import { listMarkets, marketDetail, nearbyMarkets } from '../src/services/markets.js';

/**
 * Every statement the discovery services generate, given to Postgres to parse and plan.
 *
 * The rest of the suite records queries against a fake pool, which is what lets it run with
 * no database at all — and is also what let `time(now() at time zone 'Africa/Lagos')` pass 86
 * tests and then 500 on the first real request, because a string recorder never learns that
 * `time` is a type name Postgres will not call as a function. Nothing here checks results;
 * the seed data is the database suite's business. This checks only that each generated
 * statement is SQL.
 *
 * `explain` rather than a real run, so a check cannot write: the update in `updateStall` is
 * planned and discarded, and its `returning` list is still validated.
 */
// Relative to this file, not the working directory: `npm test` starts in server/ and
// `vitest --root server` starts at the repository root, and only one of those has the .env.
loadEnvFile(fileURLToPath(new URL('..', import.meta.url)));

async function connect(): Promise<Pool | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query('select 1');
    return pool;
  } catch {
    // No local container is not a failing phase — it is an unchecked one, said out loud.
    await pool.end();
    return null;
  }
}

const real = await connect();
const describeDatabase = real ? describe : describe.skip;

afterAll(async () => {
  await real?.end();
});

/**
 * A pool that plans instead of running.
 *
 * `firstRow` answers only the very first statement, which is what gets a service past its
 * `not_found` guard and generates the queries behind it — the roster and the week-stock join
 * are exactly the ones a caller would otherwise never reach. Later statements come back empty
 * so the arrays the service builds from them stay assertable.
 */
function plannerPool(firstRow?: Record<string, unknown>): Pool {
  if (!real) throw new Error('No database to plan against.');

  let answered = false;
  return {
    async query(text: string, values?: unknown[]): Promise<QueryResult> {
      const planned = await real.query(`explain ${text}`, values);
      const rows = firstRow && !answered ? [firstRow] : [];
      answered = true;
      return { ...planned, rows, rowCount: 0 };
    },
  } as unknown as Pool;
}

const ANY_UUID = '00000000-0000-4000-8000-000000000001';
const page = { page: 1, limit: 24 };

describeDatabase('the generated discovery SQL parses', () => {
  it('lists markets with every filter and the open-now expression at once', async () => {
    await expect(
      listMarkets(plannerPool(), { ...page, city: 'Lagos', day: 'sat', q: '12', open_now: true }),
    ).resolves.toMatchObject({ meta: { total: 0, page: 1, limit: 24 } });
  });

  it('runs the bounding box, the haversine and the radius cut', async () => {
    await expect(
      nearbyMarkets(plannerPool(), {
        ...page,
        lat: 6.5244,
        lng: 3.3792,
        radius_km: 25,
        day: 'thu',
        open_now: true,
      }),
    ).resolves.toMatchObject({ meta: { total: 0 } });
  });

  it('plans the market roster and its per-farmer product count', async () => {
    await expect(marketDetail(plannerPool({}), ANY_UUID)).resolves.toMatchObject({ farmers: [] });
  });

  it('lists farmers with the market, category and text subqueries', async () => {
    await expect(
      listFarmers(plannerPool(), { ...page, market_id: ANY_UUID, category: 'vegetables', q: 'ade' }),
    ).resolves.toMatchObject({ meta: { total: 0 } });
  });

  it('plans the farmer profile and everything fanned out behind it', async () => {
    // The pitch list, this week's stock and the reviews only run once the profile is found,
    // so a blank first row is what gets the week-stock join planned at all.
    await expect(farmerDetail(plannerPool({}), ANY_UUID)).resolves.toMatchObject({
      markets: [],
      products: [],
      reviews: [],
    });
  });

  it('plans the stall patch, including the columns it returns', async () => {
    await expect(
      updateStall(plannerPool({}), ANY_UUID, {
        stall_name: 'Adeyemi Farms',
        operating_days: ['sat'],
        order_cutoff_minutes: 180,
      }),
    ).resolves.toBeTruthy();
  });

  it('plans the pin move on its own', async () => {
    await expect(pinStall(plannerPool({}), ANY_UUID, { lat: 6.4281, lng: 3.4219 })).resolves.toBeTruthy();
  });

  it('plans the stall read behind /farmers/me', async () => {
    await expect(myStall(plannerPool({}), ANY_UUID)).resolves.toBeTruthy();
  });

  it('plans the pitch lookup behind /farmers/me/markets', async () => {
    await expect(myStallMarkets(plannerPool({}), ANY_UUID)).resolves.toEqual([]);
  });
});
