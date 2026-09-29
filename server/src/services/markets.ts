import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import { offsetFor } from '../api/schemas.js';
import type {
  Market,
  MarketDetail,
  MarketListQuery,
  NearbyMarket,
  NearbyQuery,
  Page,
  RosterFarmer,
} from '../api/schemas.js';
import { HAVERSINE_KM, boundingBox, isOpenNow } from './geo.js';


const MARKET_COLUMNS = `id, name, address, city, state,
  currency,
  lat::float8 as lat, lng::float8 as lng,
  operating_days, opens_at, closes_at, image_url`;

/** A row as the paged queries return it: the shape asked for, plus the window's tally. */
type Counted<T> = T & { total_count: number };


function envelope<T>(rows: Counted<T>[], query: { page: number; limit: number }): Page<T> {
  return {
    data: rows.map(({ total_count, ...rest }) => rest as T),
    meta: { total: rows[0]?.total_count ?? 0, page: query.page, limit: query.limit },
  };
}


export async function listMarkets(pool: Pool, query: MarketListQuery): Promise<Page<Market>> {
  const values: unknown[] = [];
  const clauses = ['is_active'];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.city) clauses.push(`city ilike ${param(query.city)}`);
  if (query.day) clauses.push(`operating_days @> array[${param(query.day)}]::text[]`);
  if (query.q) {
    // One placeholder, three columns: the same term against name, address and city.
    const like = param(`%${query.q}%`);
    clauses.push(`(name ilike ${like} or address ilike ${like} or city ilike ${like})`);
  }
  if (query.open_now) clauses.push(isOpenNow('markets'));

  param(query.limit);
  param(offsetFor(query.page, query.limit));

  const { rows } = await pool.query(
    `select ${MARKET_COLUMNS}, ${isOpenNow('markets')} as is_open_now,
            count(*) over ()::int as total_count
       from markets
      where ${clauses.join(' and ')}
      order by name
      limit $${values.length - 1} offset $${values.length}`,
    values,
  );

  return envelope(rows as Counted<Market>[], query);
}

/**
 * Markets within `radius_km` of a point, nearest first.
 *
 * Two stages, in the order spec 10 asks for. The `with` narrows to a bounding box — a plain
 * range on each axis, so it can use the `(lat, lng)` index — and the outer query then
 * measures the survivors with haversine and keeps those genuinely inside the circle. The
 * box's corners reach past the circle, so skipping the second stage would list markets
 * outside the radius as if they were nearby.
 */
export async function nearbyMarkets(
  pool: Pool,
  query: NearbyQuery,
): Promise<Page<NearbyMarket>> {
  const box = boundingBox(query.lat, query.lng, query.radius_km);

  // The first six are fixed by `HAVERSINE_KM` ($1/$2) and the box ($3–$6); anything later is
  // appended, so the filter placeholders are numbered from the length rather than by hand.
  const values: unknown[] = [query.lat, query.lng, box.minLat, box.maxLat, box.minLng, box.maxLng];
  const clauses = ['is_active', 'lat between $3 and $4', 'lng between $5 and $6'];

  if (query.day) {
    values.push(query.day);
    clauses.push(`operating_days @> array[$${values.length}]::text[]`);
  }
  if (query.open_now) clauses.push(isOpenNow('markets'));

  values.push(query.radius_km, query.limit, offsetFor(query.page, query.limit));
  const radiusRef = `$${values.length - 2}`;
  const limitRef = `$${values.length - 1}`;
  const offsetRef = `$${values.length}`;

  const { rows } = await pool.query(
    `with boxed as (
       select ${MARKET_COLUMNS}, ${isOpenNow('markets')} as is_open_now,
              (${HAVERSINE_KM})::float8 as exact_km
         from markets
        where ${clauses.join(' and ')}
     ),
     inside as (
       select id, name, address, city, state, currency, lat, lng,
              operating_days, opens_at, closes_at, image_url, is_open_now,
              round(exact_km::numeric, 2)::float8 as distance_km
         from boxed
        where exact_km <= ${radiusRef}
        order by exact_km
        limit ${limitRef} offset ${offsetRef}
     )
     select *, count(*) over ()::int as total_count from inside`,
    values,
  );

  return envelope(rows as Counted<NearbyMarket>[], query);
}

/**
 * One market, who trades there, and how much of it is on the tables.
 *
 * The roster carries each stall's own pitch reference and the days it attends, which can be
 * narrower than the market's own week — a trader who only comes on Saturdays is listed under
 * Saturdays, not under everything the market does.
 *
 * `product_count` adds up the per-farmer counts rather than asking the database a third
 * question, because a product belongs to exactly one farmer and only approved roster farmers
 * appear here, so the two are the same number by construction.
 */
export async function marketDetail(pool: Pool, id: string): Promise<MarketDetail> {
  const market = await pool.query(
    `select ${MARKET_COLUMNS}, ${isOpenNow('markets')} as is_open_now
       from markets where id = $1 and is_active`,
    [id],
  );

  const found = market.rows[0] as Market | undefined;
  if (!found) throw new ApiError('not_found', 'No such market.');

  const roster = await pool.query(
    `select f.id, f.stall_name, f.contact_person, f.logo_url,
            f.rating_avg::float8 as rating_avg, f.rating_count,
            mf.stall_ref, mf.days,
            (select count(*) from products p
              where p.farmer_id = f.id and p.is_active)::int as product_count
       from market_farmers mf
       join farmers f on f.id = mf.farmer_id
      where mf.market_id = $1 and f.status = 'approved'
      order by f.stall_name`,
    [id],
  );

  const farmers: RosterFarmer[] = [];
  let productCount = 0;

  type RosterRow = Counted<RosterFarmer & { product_count: number }>;
  for (const { product_count, ...farmer } of roster.rows as RosterRow[]) {
    farmers.push(farmer);
    productCount += Number(product_count);
  }

  return { ...found, farmers, product_count: productCount };
}
