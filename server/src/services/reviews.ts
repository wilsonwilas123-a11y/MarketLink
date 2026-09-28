import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import type { CreateReviewInput } from '../api/schemas.js';

export async function createReview(pool: Pool, customerId: string, orderId: string, input: CreateReviewInput) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const order = await client.query(
      `select farmer_id from orders where id=$1 and customer_id=$2 and status='completed' for update`,
      [orderId, customerId],
    );
    const farmerId = order.rows[0]?.farmer_id as string | undefined;
    if (!farmerId) throw new ApiError('validation_failed', 'You can review a product after its pickup order is completed.');
    const purchased = await client.query('select 1 from order_items where order_id=$1 and product_id=$2', [orderId, input.product_id]);
    if (!purchased.rowCount) throw new ApiError('validation_failed', 'This product was not part of that order.');
    const inserted = await client.query(
      `insert into reviews(order_id,product_id,farmer_id,customer_id,rating,title,body)
       values($1,$2,$3,$4,$5,$6,$7) on conflict(order_id,product_id) do nothing returning id`,
      [orderId, input.product_id, farmerId, customerId, input.rating, input.title ?? null, input.body ?? null],
    );
    if (!inserted.rowCount) throw new ApiError('already_reviewed', 'You have already reviewed this product for that order.');
    await client.query(
      `update products p set rating_avg=r.avg,rating_count=r.count from (
         select product_id,avg(rating)::numeric(3,2) as avg,count(*)::int as count
           from reviews where product_id=$1 and status='visible' group by product_id
       ) r where p.id=r.product_id`, [input.product_id]);
    await client.query(
      `update farmers f set rating_avg=r.avg,rating_count=r.count from (
         select farmer_id,avg(rating)::numeric(3,2) as avg,count(*)::int as count
           from reviews where farmer_id=$1 and status='visible' group by farmer_id
       ) r where f.id=r.farmer_id`, [farmerId]);
    await client.query('commit');
    return { id: inserted.rows[0]?.id, order_id: orderId, product_id: input.product_id, farmer_id: farmerId, rating: input.rating };
  } catch (err) { await client.query('rollback').catch(() => undefined); throw err; }
  finally { client.release(); }
}

export async function replyToReview(pool: Pool, profileId: string, reviewId: string, body: string) {
  const { rows } = await pool.query(
    `update reviews r set farmer_reply=$3,replied_at=now()
       from farmers f where r.id=$1 and r.farmer_id=f.id and f.profile_id=$2 and r.status='visible'
       returning r.id,r.farmer_reply,r.replied_at::text`, [reviewId, profileId, body]);
  if (!rows[0]) throw new ApiError('not_found', 'No visible review for your stall was found.');
  return rows[0];
}

export async function listFarmerReviews(pool: Pool, profileId: string) {
  const { rows } = await pool.query(
    `select r.id,r.rating,r.title,r.body,r.farmer_reply,r.created_at::text,
            p.full_name as customer_name,pr.name as product_name
       from reviews r join farmers f on f.id=r.farmer_id
       join profiles p on p.id=r.customer_id join products pr on pr.id=r.product_id
      where f.profile_id=$1 and r.status='visible' order by r.created_at desc limit 100`, [profileId]);
  return rows;
}

export async function moderateReview(pool: Pool, reviewId: string, status: 'visible' | 'removed') {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`update reviews set status=$2 where id=$1 returning id,product_id,farmer_id`, [reviewId, status]);
    const row = rows[0]; if (!row) throw new ApiError('not_found', 'No such review.');
    for (const [table, key, id] of [['products','id',row.product_id],['farmers','id',row.farmer_id]] as const) {
      await client.query(
        `update ${table} target set rating_avg=coalesce(agg.avg,0),rating_count=coalesce(agg.count,0)
           from (select avg(rating)::numeric(3,2) as avg,count(*)::int as count from reviews
                  where ${table === 'products' ? 'product_id' : 'farmer_id'}=$1 and status='visible') agg
          where target.${key}=$1`, [id]);
    }
    await client.query('commit'); return { id: row.id, status };
  } catch (err) { await client.query('rollback').catch(() => undefined); throw err; }
  finally { client.release(); }
}
