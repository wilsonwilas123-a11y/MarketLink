import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../errors.js';
import { offsetFor } from '../api/schemas.js';
import type { CreateOrderInput, ModifyOrderItemsInput, Order, OrderListQuery, Role } from '../api/schemas.js';

const ORDER_SELECT = `
  select o.id, o.reference, o.status,
         o.subtotal_kobo::float8 as subtotal_minor,
         o.delivery_fee_kobo::float8 as delivery_fee_minor,
         m.currency,
         o.pickup_date::text as pickup_date,
         o.pickup_slot_start, o.pickup_slot_end, o.cutoff_at::text,
         o.placed_at::text, o.accepted_at::text, o.ready_at::text,
         o.completed_at::text, o.cancelled_at::text,
         jsonb_build_object('id', f.id, 'stall_name', f.stall_name) as farmer,
         jsonb_build_object('id', m.id, 'name', m.name, 'address', m.address, 'city', m.city,
                            'lat', m.lat::float8, 'lng', m.lng::float8) as market,
         coalesce((select jsonb_agg(jsonb_build_object(
           'product_id', oi.product_id,
           'name', oi.product_name_snapshot,
           'unit', oi.unit_snapshot,
           'price_minor', oi.price_kobo_snapshot::float8,
           'quantity', oi.quantity,
           'reviewed', exists(select 1 from reviews rv where rv.order_id=o.id and rv.product_id=oi.product_id and rv.customer_id=o.customer_id)
         ) order by oi.product_name_snapshot)
           from order_items oi where oi.order_id = o.id), '[]'::jsonb) as items`;

/** Validate the farmer's pickup slot, reserve current-week stock and write a single-farmer order atomically. */
export async function placeOrder(
  pool: Pool,
  customerId: string,
  input: CreateOrderInput,
): Promise<Order> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('begin');
    transactionOpen = true;

    const productIds = input.items.map((item) => item.product_id);
    await client.query(
      `insert into weekly_stock(product_id,week,quantity_available,is_sold_out)
       select p.id,iso_week(),p.template_qty,p.template_qty=0 from products p
        where p.id=any($1::uuid[]) on conflict(product_id,week) do nothing`,
      [productIds],
    );
    const { rows: products } = await client.query(
      `select p.id, p.name, p.unit, p.price_minor::text as price_minor, p.is_active,
              p.farmer_id, f.profile_id, f.status as farmer_status, f.operating_days,
              f.pickup_window_start, f.pickup_window_end, f.order_cutoff_minutes,
              f.currency as farmer_currency,
              ws.quantity_available, coalesce(ws.is_sold_out, false) as is_sold_out
         from products p
         join farmers f on f.id = p.farmer_id
         left join weekly_stock ws on ws.product_id = p.id and ws.week = iso_week()
        where p.id = any($1::uuid[])
        for update of p, f`,
      [productIds],
    );

    if (products.length !== input.items.length) {
      throw new ApiError('not_found', 'One or more products are no longer listed. Refresh your cart.');
    }
    const farmerId = products[0]?.farmer_id as string | undefined;
    if (!farmerId || products.some((product) => product.farmer_id !== farmerId)) {
      throw new ApiError('validation_failed', 'Place one order per farmer.');
    }
    const farmer = products[0];
    if (farmer?.farmer_status !== 'approved') {
      throw new ApiError('farmer_not_approved', 'This farmer cannot accept orders right now.');
    }
    if (products.some((product) => !product.is_active)) {
      throw new ApiError('not_found', 'One or more products are no longer listed.');
    }

    const marketResult = await client.query(
      `select m.id, m.currency, m.timezone, m.operating_days, m.opens_at, m.closes_at,
              mf.days as farmer_market_days
         from markets m
         join market_farmers mf on mf.market_id = m.id and mf.farmer_id = $2
        where m.id = $1 and m.is_active
        for share of m, mf`,
      [input.market_id, farmerId],
    );
    const market = marketResult.rows[0];
    if (!market) throw new ApiError('validation_failed', 'Choose a market where this farmer trades.');
    if (market.currency !== farmer?.farmer_currency) {
      throw new ApiError('validation_failed', 'The market and farmer currencies do not match.');
    }

    const pickupWeek = await client.query(
      `select iso_week($1::date) = iso_week((now() at time zone $2)::date) as same_week,
              $1::date >= (now() at time zone $2)::date as not_in_past`,
      [input.pickup_date, market.timezone],
    );
    if (!pickupWeek.rows[0]?.same_week || !pickupWeek.rows[0]?.not_in_past) {
      throw new ApiError('validation_failed', 'Choose a pickup date from the current trading week and not in the past.');
    }

    const weekday = new Date(`${input.pickup_date}T12:00:00Z`).getUTCDay();
    const dayCodes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const day = dayCodes[weekday];
    const activeDays: string[] = [
      ...(farmer?.operating_days as string[] ?? []),
    ];
    const marketDays = market.operating_days as string[];
    const farmerMarketDays = market.farmer_market_days as string[];
    if (!day || !activeDays.includes(day) || !marketDays.includes(day) || !farmerMarketDays.includes(day)) {
      throw new ApiError('validation_failed', 'The farmer is not available at this market on that day.');
    }

    const start = input.pickup_slot_start;
    const end = input.pickup_slot_end;
    const farmerStart = String(farmer?.pickup_window_start ?? '').slice(0, 5);
    const farmerEnd = String(farmer?.pickup_window_end ?? '').slice(0, 5);
    const marketStart = String(market.opens_at).slice(0, 5);
    const marketEnd = String(market.closes_at).slice(0, 5);
    if (!farmerStart || !farmerEnd || start < farmerStart || end > farmerEnd || start < marketStart || end > marketEnd) {
      throw new ApiError('validation_failed', 'Choose a pickup slot inside both the farmer and market hours.');
    }

    const { rows: cutoffRows } = await client.query(
      `select (($1::date + $2::time) - ($3::int * interval '1 minute'))
                at time zone $4 as cutoff_at,
              now() as server_now`,
      [input.pickup_date, start, farmer?.order_cutoff_minutes, market.timezone],
    );
    const cutoff = cutoffRows[0]?.cutoff_at as Date | undefined;
    const serverNow = cutoffRows[0]?.server_now as Date | undefined;
    if (!cutoff || !serverNow || cutoff <= serverNow) {
      throw new ApiError('cutoff_passed', 'The ordering cutoff for this pickup slot has passed.');
    }

    let subtotal = 0n;
    const snapshots: { product_id: string; name: string; unit: string; price: string; quantity: number }[] = [];
    for (const request of input.items) {
      const product = products.find((row) => row.id === request.product_id);
      const available = Number(product?.quantity_available ?? 0);
      if (!product || product.is_sold_out || available < request.quantity) {
        throw new ApiError('stock_unavailable', `Only ${available} available for ${product?.name ?? 'this item'}.`, {
          product_id: request.product_id,
          requested: request.quantity,
          available,
        });
      }

      const reserved = await client.query(
        `update weekly_stock
            set quantity_available = quantity_available - $3
          where product_id = $1 and week = iso_week()
            and is_sold_out = false and quantity_available >= $2
          returning quantity_available`,
        [request.product_id, request.quantity],
      );
      if (reserved.rowCount !== 1) {
        const current = await client.query(
          `select quantity_available from weekly_stock where product_id = $1 and week = iso_week()`,
          [request.product_id],
        );
        const currentQty = Number(current.rows[0]?.quantity_available ?? 0);
        throw new ApiError('stock_unavailable', `Only ${currentQty} available for ${product.name}.`, {
          product_id: request.product_id,
          requested: request.quantity,
          available: currentQty,
        });
      }
      const price = String(product.price_minor);
      subtotal += BigInt(price) * BigInt(request.quantity);
      snapshots.push({
        product_id: request.product_id,
        name: product.name,
        unit: product.unit,
        price,
        quantity: request.quantity,
      });
    }

    const orderResult = await client.query(
      `insert into orders (
         customer_id, farmer_id, market_id, subtotal_kobo,
         pickup_date, pickup_slot_start, pickup_slot_end, cutoff_at
       ) values ($1, $2, $3, $4, $5::date, $6::time, $7::time, $8)
       returning id`,
      [customerId, farmerId, input.market_id, subtotal.toString(), input.pickup_date, start, end, cutoff],
    );
    const orderId = orderResult.rows[0]?.id as string;
    for (const line of snapshots) {
      await client.query(
        `insert into order_items (
           order_id, product_id, product_name_snapshot, unit_snapshot,
           price_kobo_snapshot, quantity
         ) values ($1, $2, $3, $4, $5, $6)`,
        [orderId, line.product_id, line.name, line.unit, line.price, line.quantity],
      );
    }
    const placed = await orderById(client, orderId);
    await client.query(
      `insert into notifications (profile_id, kind, title, body, link)
       values ($1, 'order_placed', 'New pickup order', $2, $3),
              ($4, 'order_placed', 'Pickup reservation received', $5, $6)`,
      [farmer?.profile_id, `A customer placed order ${placed.reference}.`, '/farmers/dashboard',
        customerId, `Your pickup order ${placed.reference} was received.`, `/orders/${placed.reference}`],
    );
    await client.query('commit');
    transactionOpen = false;
    return placed;
  } catch (err) {
    if (transactionOpen) await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

async function orderById(client: PoolClient, id: string, access?: { userId: string; role: Role }): Promise<Order> {
  const conditions = ['o.id = $1'];
  const values: unknown[] = [id];
  if (access?.role === 'customer') {
    values.push(access.userId);
    conditions.push(`o.customer_id = $${values.length}`);
  } else if (access?.role === 'farmer') {
    values.push(access.userId);
    conditions.push(`f.profile_id = $${values.length}`);
  }
  const { rows } = await client.query(
    `${ORDER_SELECT}
       from orders o
       join farmers f on f.id = o.farmer_id
       join markets m on m.id = o.market_id
      where ${conditions.join(' and ')}`,
    values,
  );
  const order = rows[0] as Order | undefined;
  if (!order) throw new ApiError('not_found', 'No such order.');
  return order;
}

export async function getOrder(
  pool: Pool,
  reference: string,
  userId: string,
  role: Role,
): Promise<Order> {
  const client = await pool.connect();
  try {
    const conditions = ['o.reference = $1'];
    const values: unknown[] = [reference];
    if (role === 'customer') {
      values.push(userId);
      conditions.push(`o.customer_id = $${values.length}`);
    } else if (role === 'farmer') {
      values.push(userId);
      conditions.push(`f.profile_id = $${values.length}`);
    }
    const { rows } = await client.query(
      `${ORDER_SELECT}
         from orders o
         join farmers f on f.id = o.farmer_id
         join markets m on m.id = o.market_id
        where ${conditions.join(' and ')}`,
      values,
    );
    const order = rows[0] as Order | undefined;
    if (!order) throw new ApiError('not_found', 'No such order.');
    return order;
  } finally {
    client.release();
  }
}

export async function listOrders(
  pool: Pool,
  userId: string,
  role: Role,
  query: OrderListQuery,
): Promise<{ data: Order[]; meta: { total: number; page: number; limit: number } }> {
  const values: unknown[] = [];
  const clauses: string[] = [];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (role === 'customer') clauses.push(`o.customer_id = ${param(userId)}`);
  else if (role === 'farmer') clauses.push(`f.profile_id = ${param(userId)}`);
  if (query.status) clauses.push(`o.status = ${param(query.status)}`);
  if (query.scope === 'today') clauses.push(`o.pickup_date = (now() at time zone m.timezone)::date`);
  const limit = param(query.limit);
  const offset = param(offsetFor(query.page, query.limit));
  const { rows } = await pool.query(
    `${ORDER_SELECT}, count(*) over ()::int as total_count
       from orders o
       join farmers f on f.id = o.farmer_id
       join markets m on m.id = o.market_id
      where ${clauses.join(' and ')}
      order by o.placed_at desc
      limit ${limit} offset ${offset}`,
    values,
  );
  return {
    data: rows.map(({ total_count: _total, ...order }) => order as Order),
    meta: { total: rows[0]?.total_count ?? 0, page: query.page, limit: query.limit },
  };
}

export async function cancelOrder(pool: Pool, id: string, customerId: string): Promise<Order> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('begin');
    transactionOpen = true;
    const { rows } = await client.query(
      `select id, status, cutoff_at from orders where id = $1 and customer_id = $2 for update`,
      [id, customerId],
    );
    const order = rows[0];
    if (!order) throw new ApiError('not_found', 'No such order.');
    if (!['placed', 'accepted'].includes(order.status)) {
      throw new ApiError('invalid_transition', 'This order can no longer be cancelled.');
    }
    if (new Date(order.cutoff_at).valueOf() <= Date.now()) {
      throw new ApiError('cutoff_passed', 'The cancellation cutoff for this pickup has passed.');
    }
    await client.query(
      `update weekly_stock ws
          set quantity_available = ws.quantity_available + oi.quantity
         from order_items oi
        where oi.order_id = $1 and ws.product_id = oi.product_id and ws.week = iso_week()`,
      [id],
    );
    await client.query(`update orders set status = 'cancelled', cancelled_at = now() where id = $1`, [id]);
    const customer = await client.query(`select farmer_id from orders where id = $1`, [id]);
    const farmer = await client.query(`select profile_id from farmers where id = $1`, [customer.rows[0]?.farmer_id]);
    await client.query(
      `insert into notifications (profile_id, kind, title, body, link)
       values ($1, 'order_cancelled', 'Order cancelled', $2, $3)`,
      [farmer.rows[0]?.profile_id, `Order ${id} was cancelled by the customer.`, '/farmers/dashboard'],
    );
    const result = await orderById(client, id, { userId: customerId, role: 'customer' });
    await client.query('commit');
    transactionOpen = false;
    return result;
  } catch (err) {
    if (transactionOpen) await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/** Replace the items on an unpaid order before cutoff, adjusting stock atomically. */
export async function modifyOrderItems(
  pool: Pool,
  id: string,
  customerId: string,
  input: ModifyOrderItemsInput,
): Promise<Order> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('begin');
    transactionOpen = true;
    const { rows: orderRows } = await client.query(
      `select id, reference, status, farmer_id, market_id, cutoff_at
         from orders where id=$1 and customer_id=$2 for update`,
      [id, customerId],
    );
    const order = orderRows[0];
    if (!order) throw new ApiError('not_found', 'No such order.');
    if (!['placed', 'accepted'].includes(order.status)) {
      throw new ApiError('invalid_transition', 'Only a placed or accepted order can be changed.');
    }
    if (new Date(order.cutoff_at).valueOf() <= Date.now()) {
      throw new ApiError('cutoff_passed', 'The change cutoff for this pickup has passed.');
    }

    const { rows: previous } = await client.query(
      `select product_id, product_name_snapshot as name, unit_snapshot as unit,
              price_kobo_snapshot::text as price, quantity
         from order_items where order_id=$1`, [id],
    );
    const oldById = new Map(previous.map((row) => [row.product_id as string, row]));
    const productIds = input.items.map((item) => item.product_id);
    await client.query(
      `insert into weekly_stock(product_id,week,quantity_available,is_sold_out)
       select p.id,iso_week(),p.template_qty,p.template_qty=0 from products p
        where p.id=any($1::uuid[]) on conflict(product_id,week) do nothing`,
      [productIds],
    );
    const { rows: products } = await client.query(
      `select p.id,p.name,p.unit,p.price_minor::text as price_minor,p.is_active,
              ws.quantity_available,coalesce(ws.is_sold_out,false) as is_sold_out
         from products p left join weekly_stock ws on ws.product_id=p.id and ws.week=iso_week()
        where p.id=any($1::uuid[]) and p.farmer_id=$2 for update of p`,
      [productIds, order.farmer_id],
    );
    if (products.length !== productIds.length) {
      throw new ApiError('validation_failed', 'Every item must be available from the same farmer as this order.');
    }
    const stockRows = await client.query(
      `select product_id from weekly_stock where product_id=any($1::uuid[]) and week=iso_week() for update`,
      [productIds],
    );
    const stockedIds = new Set(stockRows.rows.map((row) => row.product_id as string));
    const productById = new Map(products.map((row) => [row.id as string, row]));

    for (const item of input.items) {
      const product = productById.get(item.product_id)!;
      const old = oldById.get(item.product_id);
      if (!stockedIds.has(item.product_id)) throw new ApiError('stock_unavailable', `${product.name} has no stock record for this trading week.`);
      if (!old && (!product.is_active || product.is_sold_out)) {
        throw new ApiError('stock_unavailable', `${product.name} is not available to add to this order.`);
      }
      const delta = item.quantity - Number(old?.quantity ?? 0);
      if (delta > 0 && (!product.is_active || product.is_sold_out || Number(product.quantity_available ?? 0) < delta)) {
        throw new ApiError('stock_unavailable', `Only ${Number(product.quantity_available ?? 0)} more ${product.name} available.`, {
          product_id: item.product_id, requested: delta, available: Number(product.quantity_available ?? 0),
        });
      }
    }

    const requested = new Map(input.items.map((item) => [item.product_id, item.quantity]));
    const allIds = new Set([...oldById.keys(), ...requested.keys()]);
    for (const productId of allIds) {
      const delta = (requested.get(productId) ?? 0) - Number(oldById.get(productId)?.quantity ?? 0);
      if (!delta) continue;
      const stock = await client.query(
        delta > 0
          ? `update weekly_stock set quantity_available=quantity_available-$2 where product_id=$1 and week=iso_week() and is_sold_out=false and quantity_available >= $2 returning product_id`
          : `update weekly_stock set quantity_available=quantity_available+$2 where product_id=$1 and week=iso_week() returning product_id`,
        [productId, Math.abs(delta)],
      );
      if (stock.rowCount !== 1) throw new ApiError('stock_unavailable', 'Stock changed while you were editing. Please refresh and try again.');
    }

    for (const old of previous) {
      if (!requested.has(old.product_id as string)) {
        await client.query('delete from order_items where order_id=$1 and product_id=$2', [id, old.product_id]);
      }
    }
    for (const item of input.items) {
      const old = oldById.get(item.product_id);
      if (old) {
        await client.query('update order_items set quantity=$3 where order_id=$1 and product_id=$2', [id, item.product_id, item.quantity]);
      } else {
        const product = productById.get(item.product_id)!;
        await client.query(
          `insert into order_items(order_id,product_id,product_name_snapshot,unit_snapshot,price_kobo_snapshot,quantity)
           values($1,$2,$3,$4,$5,$6)`,
          [id, item.product_id, product.name, product.unit, product.price_minor, item.quantity],
        );
      }
    }
    await client.query(
      `update orders set subtotal_kobo=(select coalesce(sum(price_kobo_snapshot*quantity),0) from order_items where order_id=$1),
                          status=case when status='accepted' then 'placed' else status end,
                          accepted_at=case when status='accepted' then null else accepted_at end,
                          updated_at=now()
        where id=$1`, [id],
    );
    const farmer = await client.query('select profile_id from farmers where id=$1', [order.farmer_id]);
    await client.query(
      `insert into notifications(profile_id,kind,title,body,link) values($1,'order_placed','Pickup order updated',$2,$3)`,
      [farmer.rows[0]?.profile_id, `Customer updated order ${order.reference}. Please review the new item list.`, '/farmers/dashboard'],
    );
    await client.query(
      `insert into notifications(profile_id,kind,title,body,link) values($1,'order_placed','Pickup reservation updated',$2,$3)`,
      [customerId, `Your pickup order ${order.reference} was updated.`, `/orders/${order.reference}`],
    );
    const result = await orderById(client, id, { userId: customerId, role: 'customer' });
    await client.query('commit');
    transactionOpen = false;
    return result;
  } catch (err) {
    if (transactionOpen) await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(
  pool: Pool,
  id: string,
  farmerProfileId: string,
  next: Exclude<Order['status'], 'placed'>,
): Promise<Order> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('begin');
    transactionOpen = true;
    const { rows } = await client.query(
      `select o.id, o.reference, o.status, o.customer_id
         from orders o join farmers f on f.id = o.farmer_id
        where o.id = $1 and f.profile_id = $2 for update of o`,
      [id, farmerProfileId],
    );
    const order = rows[0];
    if (!order) throw new ApiError('not_found', 'No such order.');
    const transitions: Record<string, string[]> = {
      placed: ['accepted', 'cancelled'],
      accepted: ['preparing'],
      preparing: ['ready_for_pickup'],
      ready_for_pickup: ['completed'],
      completed: [],
      cancelled: [],
    };
    if (!transitions[order.status]?.includes(next)) {
      throw new ApiError('invalid_transition', `Order cannot move from ${order.status} to ${next}.`);
    }
    if (next === 'cancelled') {
      await client.query(
        `update weekly_stock ws
            set quantity_available = ws.quantity_available + oi.quantity
           from order_items oi
          where oi.order_id = $1 and ws.product_id = oi.product_id and ws.week = iso_week()`,
        [id],
      );
    }
    const stamp = {
      accepted: 'accepted_at',
      preparing: null,
      ready_for_pickup: 'ready_at',
      completed: 'completed_at',
      cancelled: 'cancelled_at',
    }[next];
    await client.query(`update orders set status = $2${stamp ? `, ${stamp} = now()` : ''} where id = $1`, [id, next]);
    const notification = next === 'accepted' ? ['order_accepted', 'Order accepted'] :
      next === 'ready_for_pickup' ? ['order_ready', 'Ready for pickup'] :
      next === 'cancelled' ? ['order_cancelled', 'Order declined'] : null;
    if (notification) {
      await client.query(
        `insert into notifications (profile_id, kind, title, body, link)
         values ($1, $2, $3, $4, $5)`,
        [order.customer_id, notification[0], notification[1], `Order ${order.reference} is now ${next.replaceAll('_', ' ')}.`, `/orders/${order.reference}`],
      );
    }
    const result = await orderById(client, id, { userId: farmerProfileId, role: 'farmer' });
    await client.query('commit');
    transactionOpen = false;
    return result;
  } catch (err) {
    if (transactionOpen) await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
