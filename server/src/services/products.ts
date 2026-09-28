import type { Pool } from 'pg';
import { offsetFor } from '../api/schemas.js';
import { ApiError } from '../errors.js';
import type { FarmerProductInput, Page, ProductCard, ProductListQuery } from '../api/schemas.js';

/**
 * Public catalogue. Only active listings from approved stalls are visible; the current week's
 * row overrides the recurring template, and an unmaterialized new week starts at that template.
 */
async function queryProducts(
  pool: Pool,
  query: ProductListQuery,
  productId?: string,
): Promise<Page<ProductCard>> {
  const values: unknown[] = [];
  const clauses = ["p.is_active", "f.status = 'approved'", 'mkt.active_market'];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (productId) clauses.push(`p.id = ${param(productId)}`);
  if (query.q) {
    const like = param(`%${query.q}%`);
    clauses.push(`(p.name ilike ${like} or coalesce(p.description, '') ilike ${like}
      or f.stall_name ilike ${like})`);
  }
  if (query.category) clauses.push(`c.slug = ${param(query.category)}`);
  if (query.currency) clauses.push(`f.currency = ${param(query.currency)}`);
  if (query.market_id) clauses.push(`exists (
    select 1 from market_farmers fm
    where fm.farmer_id = f.id and fm.market_id = ${param(query.market_id)}` +
    ` and exists (select 1 from markets mx where mx.id = fm.market_id and mx.is_active))`);
  if (query.day) {
    const sameMarket = query.market_id ? `and mf.market_id = ${param(query.market_id)}` : '';
    clauses.push(`exists (
      select 1 from market_farmers mf join markets md on md.id = mf.market_id
      where mf.farmer_id = f.id and md.is_active ${sameMarket}
        and mf.days @> array[${param(query.day)}]::text[])`);
  }
  if (query.farmer_id) clauses.push(`f.id = ${param(query.farmer_id)}`);
  if (query.min_price_minor !== undefined) clauses.push(`p.price_minor >= ${param(query.min_price_minor)}`);
  if (query.max_price_minor !== undefined) clauses.push(`p.price_minor <= ${param(query.max_price_minor)}`);
  if (query.in_stock_only) clauses.push('coalesce(ws.quantity_available, p.template_qty) > 0 and not coalesce(ws.is_sold_out, p.template_qty = 0)');

  const orderBy = {
    popular: 'p.rating_avg desc, p.rating_count desc, p.name',
    price_low: 'p.price_minor asc, p.name',
    price_high: 'p.price_minor desc, p.name',
    newest: 'p.created_at desc, p.name',
  }[query.sort];
  const limit = param(query.limit);
  const offset = param(offsetFor(query.page, query.limit));

  const { rows } = await pool.query(
    `select p.id, p.name, p.description, p.unit,
            p.price_minor::float8 as price_minor, p.image_urls, p.is_organic,
            jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) as category,
            coalesce(ws.quantity_available, p.template_qty)::int as quantity_available,
            coalesce(ws.is_sold_out, p.template_qty = 0) as is_sold_out,
            jsonb_build_object(
              'id', f.id,
              'stall_name', f.stall_name,
              'rating_avg', f.rating_avg::float8,
              'rating_count', f.rating_count,
              'currency', f.currency,
              'operating_days', f.operating_days,
              'pickup_window_start', f.pickup_window_start,
              'pickup_window_end', f.pickup_window_end,
              'order_cutoff_minutes', f.order_cutoff_minutes
            ) as farmer,
            coalesce(mkt.markets, '[]'::jsonb) as markets,
            count(*) over ()::int as total_count
       from products p
       join categories c on c.id = p.category_id
       join farmers f on f.id = p.farmer_id
       left join weekly_stock ws on ws.product_id = p.id and ws.week = iso_week()
       join lateral (
         select bool_or(m.is_active) as active_market,
                jsonb_agg(distinct jsonb_build_object(
                  'id', m.id, 'name', m.name, 'city', m.city, 'timezone', m.timezone,
                  'days', mf.days, 'opens_at', m.opens_at, 'closes_at', m.closes_at
                ))
                  filter (where m.is_active) as markets
           from market_farmers mf
           join markets m on m.id = mf.market_id
          where mf.farmer_id = f.id
       ) mkt on true
      where ${clauses.join(' and ')}
      order by ${orderBy}
      limit ${limit} offset ${offset}`,
    values,
  );

  return {
    data: rows.map(({ total_count: _total, ...product }) => product as ProductCard),
    meta: { total: rows[0]?.total_count ?? 0, page: query.page, limit: query.limit },
  };
}

export function listProducts(pool: Pool, query: ProductListQuery): Promise<Page<ProductCard>> {
  return queryProducts(pool, query);
}

export async function productDetail(pool: Pool, id: string): Promise<ProductCard> {
  const found = await queryProducts(pool, {
    page: 1,
    limit: 1,
    sort: 'popular',
    in_stock_only: false,
  }, id);
  const product = found.data[0];
  if (!product) throw new ApiError('not_found', 'No such product.');
  return product;
}

export async function listProductCategories(pool: Pool) {
  const { rows } = await pool.query('select id, name, slug from categories order by sort_order, name');
  return rows;
}

export async function farmerProducts(pool: Pool, profileId: string) {
  const { rows } = await pool.query(
    `select p.id,p.name,p.description,p.category_id,c.name as category_name,c.slug as category_slug,
            p.unit,p.price_minor::float8 as price_minor,p.image_urls,p.is_organic,p.is_active,p.template_qty::int as template_qty,
            coalesce(ws.quantity_available,p.template_qty)::int as quantity_available,
            coalesce(ws.is_sold_out,p.template_qty=0) as is_sold_out
       from products p join farmers f on f.id=p.farmer_id
       join categories c on c.id=p.category_id
       left join weekly_stock ws on ws.product_id=p.id and ws.week=iso_week()
      where f.profile_id=$1 order by p.updated_at desc`, [profileId]);
  return rows;
}

export async function saveFarmerProduct(
  pool: Pool, profileId: string, input: FarmerProductInput, productId?: string,
) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const owner = await client.query('select id from farmers where profile_id=$1 for update', [profileId]);
    const farmerId = owner.rows[0]?.id as string | undefined;
    if (!farmerId) throw new ApiError('not_found', 'Your farmer stall could not be found.');
    let id = productId;
    if (productId) {
      const updated = await client.query(
        `update products p set category_id=$3,name=$4,description=$5,unit=$6,price_minor=$7,
                image_urls=$8,is_organic=$9,template_qty=$10,updated_at=now()
          where p.id=$1 and p.farmer_id=$2 returning p.id`,
        [productId, farmerId, input.category_id, input.name, input.description ?? null, input.unit,
          input.price_minor, input.image_urls, input.is_organic, input.template_qty ?? input.quantity_available],
      );
      if (!updated.rowCount) throw new ApiError('not_found', 'That listing is not on your stall.');
      id = updated.rows[0]?.id as string;
    } else {
      const created = await client.query(
        `insert into products(farmer_id,category_id,name,description,unit,price_minor,image_urls,is_organic,template_qty)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [farmerId, input.category_id, input.name, input.description ?? null, input.unit,
          input.price_minor, input.image_urls, input.is_organic, input.template_qty ?? input.quantity_available],
      );
      id = created.rows[0]?.id as string;
    }
    const previousStock = await client.query(
      `select quantity_available,is_sold_out from weekly_stock
        where product_id=$1 and week=iso_week() for update`, [id]);
    const wasUnavailable = !previousStock.rows[0]
      ? (input.template_qty ?? input.quantity_available) === 0
      : previousStock.rows[0].is_sold_out || previousStock.rows[0].quantity_available === 0;
    const isAvailable = input.quantity_available > 0 && !input.is_sold_out;
    await client.query(
      `insert into weekly_stock(product_id,week,quantity_available,is_sold_out)
       values($1,iso_week(),$2,$3)
       on conflict(product_id,week) do update set quantity_available=excluded.quantity_available,
         is_sold_out=excluded.is_sold_out,updated_at=now()`,
      [id, input.quantity_available, input.is_sold_out || input.quantity_available === 0],
    );
    if (productId && wasUnavailable && isAvailable) {
      await client.query(
        `insert into notifications(profile_id,kind,title,body,link)
         select fav.profile_id,'restock','A saved product is back in stock',
                p.name || ' is available again at ' || f.stall_name || '.',
                '/products/' || p.id::text
           from favorites fav
           join products p on p.id=fav.target_id and fav.target_type='product'
           join farmers f on f.id=p.farmer_id
          where p.id=$1`, [id]);
    }
    await client.query('commit');
    const { rows } = await client.query(
      `select p.id,p.name,p.description,p.category_id,c.name as category_name,c.slug as category_slug,
              p.unit,p.price_minor::float8 as price_minor,p.image_urls,p.is_organic,p.is_active,p.template_qty::int as template_qty,
              ws.quantity_available::int as quantity_available,ws.is_sold_out
         from products p join categories c on c.id=p.category_id
         join weekly_stock ws on ws.product_id=p.id and ws.week=iso_week() where p.id=$1`, [id]);
    return rows[0];
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally { client.release(); }
}
