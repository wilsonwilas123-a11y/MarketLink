import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import { offsetFor } from '../api/schemas.js';
import type {
  FarmerDetail,
  FarmerListQuery,
  FarmerMarket,
  FarmerSummary,
  GeoPin,
  ListedProduct,
  MyStall,
  Page,
  Review,
  UpdateStallInput,
} from '../api/schemas.js';


const FARMER_COLUMNS = `id, stall_name, contact_person, description, logo_url, cover_url,
  lat::float8 as lat, lng::float8 as lng, currency,
  rating_avg::float8 as rating_avg, rating_count, operating_days`;

/** A stall's own view of itself, where `status` does appear. */
const STALL_COLUMNS = `${FARMER_COLUMNS},
  pickup_window_start, pickup_window_end, order_cutoff_minutes, status, currency`;

/**
 * Approved stalls, narrowed by market, product category, or a search term.
 *
 * `category` takes a slug because that is what `/categories` publishes and what a filtered
 * URL stays readable as. It matches any stall with a live product in that category, which is
 * a different question from "grows it" — a bakery selling cassava bread does appear under
 * Bakery, and that is what a shopper expects the filter to do.
 *
 * All three filters are `exists` subqueries rather than joins so a stall at four markets is
 * counted once, which keeps `count(*) over ()` honest without a `group by`.
 */
export async function listFarmers(pool: Pool, query: FarmerListQuery): Promise<Page<FarmerSummary>> {
  const values: unknown[] = [];
  const clauses = [`status = 'approved'`];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.market_id) {
    clauses.push(`exists (select 1 from market_farmers mf
                           where mf.farmer_id = farmers.id and mf.market_id = ${param(query.market_id)})`);
  }
  if (query.category) {
    clauses.push(`exists (select 1 from products p
                           join categories c on c.id = p.category_id
                           where p.farmer_id = farmers.id and p.is_active
                             and c.slug = ${param(query.category)})`);
  }
  if (query.q) {
    const like = param(`%${query.q}%`);
    clauses.push(`(stall_name ilike ${like} or contact_person ilike ${like})`);
  }

  param(query.limit);
  param(offsetFor(query.page, query.limit));

  const { rows } = await pool.query(
    `select ${FARMER_COLUMNS}, count(*) over ()::int as total_count
       from farmers
      where ${clauses.join(' and ')}
      order by rating_avg desc, stall_name
      limit $${values.length - 1} offset $${values.length}`,
    values,
  );

  return {
    data: rows.map(({ total_count, ...farmer }: FarmerSummary & { total_count: number }) => farmer),
    meta: { total: rows[0]?.total_count ?? 0, page: query.page, limit: query.limit },
  };
}

/**
 * Everything a shopper needs to decide whether to buy from a stall.
 *
 * Approved-only, and a `pending` or `suspended` stall answers `404` rather than `403`: a 403
 * would confirm the stall exists and is merely disfavoured, which is the approval queue's
 * business, not the public's.
 *
 * Products are this ISO week. When a new week has no stock row yet, its recurring template is
 * the starting quantity; checkout materializes that row before reserving stock.
 */
export async function farmerDetail(pool: Pool, id: string): Promise<FarmerDetail> {
  const farmer = await pool.query(
    `select ${FARMER_COLUMNS}, cover_url, pickup_window_start, pickup_window_end,
            order_cutoff_minutes
       from farmers where id = $1 and status = 'approved'`,
    [id],
  );

  const found = farmer.rows[0] as Omit<FarmerDetail, 'markets' | 'products' | 'reviews'> | undefined;
  if (!found) throw new ApiError('not_found', 'No such farmer.');

  const [markets, products, reviews] = await Promise.all([
    pool.query(
      `select m.id, m.name, m.address, m.city, mf.stall_ref, mf.days
         from market_farmers mf
         join markets m on m.id = mf.market_id
        where mf.farmer_id = $1 and m.is_active
        order by m.name`,
      [id],
    ),
    pool.query(
      `select p.id, p.name, p.unit, p.price_minor::float8 as price_minor, p.image_urls,
              p.is_organic,
              jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) as category,
              coalesce(ws.quantity_available, p.template_qty)::int as quantity_available,
              coalesce(ws.is_sold_out, p.template_qty = 0) as is_sold_out
         from products p
         join categories c on c.id = p.category_id
         left join weekly_stock ws on ws.product_id = p.id and ws.week = iso_week()
        where p.farmer_id = $1 and p.is_active
        order by p.name`,
      [id],
    ),
    pool.query(
      `select r.id, r.rating, r.title, r.body, r.farmer_reply, pr.full_name as customer_name, r.created_at
         from reviews r
         join profiles pr on pr.id = r.customer_id
        where r.farmer_id = $1 and r.status = 'visible'
        order by r.created_at desc
        limit 10`,
      [id],
    ),
  ]);

  return {
    ...found,
    markets: markets.rows as FarmerMarket[],
    products: products.rows as ListedProduct[],
    reviews: reviews.rows as Review[],
  };
}

/** The caller's own stall, `pending` and all. `404` if the account has none. */
export async function myStall(pool: Pool, profileId: string): Promise<MyStall> {
  const { rows } = await pool.query(
    `select ${STALL_COLUMNS} from farmers where profile_id = $1`,
    [profileId],
  );

  const stall = rows[0] as MyStall | undefined;
  if (!stall) throw new ApiError('not_found', 'This account has no stall.');
  return stall;
}

/**
 * Edits the caller's stall, and nothing about its standing.
 *
 * `status` is not in the schema's field set, so it cannot reach this builder: an unapproved
 * stall stays unapproved however its owner fills in the form. Partial for the same reason
 * `PATCH /me` is — an absent field is left alone, an explicit `null` clears it.
 */
export async function updateStall(
  pool: Pool,
  profileId: string,
  input: UpdateStallInput,
): Promise<MyStall> {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(input)) {
    // `key` reaches the SQL as text, which the no-interpolation rule would normally forbid.
    // It is safe because UpdateStallSchema is `.strict()`, so the only names that can arrive
    // here are the nine columns it declares. Values stay parameterised.
    columns.push(`${key} = $${values.length + 1}`);
    values.push(value);
  }

  values.push(profileId);
  const { rows } = await pool.query(
    `update farmers set ${columns.join(', ')} where profile_id = $${values.length}
     returning ${STALL_COLUMNS}`,
    values,
  );

  const stall = rows[0] as MyStall | undefined;
  if (!stall) throw new ApiError('not_found', 'This account has no stall.');
  return stall;
}

/**
 * Moves the stall's pin.
 *
 * Separate from the stall patch because it is a different gesture — a drag on the map, not a
 * form submit — and it should not have to resend fields the farmer never touched in order to
 * shift a marker a hundred metres.
 */
export async function pinStall(pool: Pool, profileId: string, pin: GeoPin): Promise<MyStall> {
  const { rows } = await pool.query(
    `update farmers set lat = $2, lng = $3 where profile_id = $1
     returning ${STALL_COLUMNS}`,
    [profileId, pin.lat, pin.lng],
  );

  const stall = rows[0] as MyStall | undefined;
  if (!stall) throw new ApiError('not_found', 'This account has no stall.');
  return stall;
}

/** Which markets the caller's stall attends, and which pitch it holds at each. */
export async function myStallMarkets(pool: Pool, profileId: string): Promise<FarmerMarket[]> {
  const stall = await pool.query(`select id from farmers where profile_id = $1`, [profileId]);
  const farmer = stall.rows[0] as { id: string } | undefined;
  if (!farmer) throw new ApiError('not_found', 'This account has no stall.');

  const { rows } = await pool.query(
    `select m.id, m.name, m.address, m.city, mf.stall_ref, mf.days
       from market_farmers mf
       join markets m on m.id = mf.market_id
      where mf.farmer_id = $1 and m.is_active
      order by m.name`,
    [farmer.id],
  );

  return rows as FarmerMarket[];
}

/** Replace a farmer's own market roster, checking the stall's currency and both sets of days. */
export async function saveMyStallMarkets(
  pool: Pool,
  profileId: string,
  input: { markets: { market_id: string; stall_ref: string | null; days: string[] }[] },
): Promise<FarmerMarket[]> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows: owners } = await client.query(
      'select id,currency,operating_days from farmers where profile_id=$1 for update', [profileId]);
    const owner = owners[0] as { id: string; currency: string; operating_days: string[] } | undefined;
    if (!owner) throw new ApiError('not_found', 'This account has no stall.');

    const ids = input.markets.map((market) => market.market_id);
    const { rows: available } = ids.length
      ? await client.query('select id,currency,operating_days from markets where id=any($1::uuid[]) and is_active', [ids])
      : { rows: [] as { id: string; currency: string; operating_days: string[] }[] };
    if (available.length !== ids.length) throw new ApiError('not_found', 'A selected market is no longer available.');
    const byId = new Map(available.map((market) => [market.id, market]));
    for (const assignment of input.markets) {
      const market = byId.get(assignment.market_id)!;
      if (market.currency !== owner.currency) throw new ApiError('validation_failed', 'Your stall and each pickup market must use the same currency.');
      if (assignment.days.some((day) => !owner.operating_days.includes(day) || !market.operating_days.includes(day))) {
        throw new ApiError('validation_failed', 'Trading days must fit both your stall schedule and the market schedule.');
      }
    }

    if (ids.length) {
      await client.query('delete from market_farmers where farmer_id=$1 and not (market_id=any($2::uuid[]))', [owner.id, ids]);
    } else {
      await client.query('delete from market_farmers where farmer_id=$1', [owner.id]);
    }
    for (const assignment of input.markets) {
      await client.query(
        `insert into market_farmers(market_id,farmer_id,stall_ref,days) values($1,$2,$3,$4)
         on conflict(market_id,farmer_id) do update set stall_ref=excluded.stall_ref,days=excluded.days`,
        [assignment.market_id, owner.id, assignment.stall_ref, assignment.days]);
    }
    const { rows } = await client.query(
      `select m.id,m.name,m.address,m.city,mf.stall_ref,mf.days
         from market_farmers mf join markets m on m.id=mf.market_id
        where mf.farmer_id=$1 and m.is_active order by m.name`, [owner.id]);
    await client.query('commit');
    return rows as FarmerMarket[];
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
