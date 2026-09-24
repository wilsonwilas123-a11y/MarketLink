-- The guarded stock update in spec 6.1 is the only thing standing between two customers
-- and one last basket. Frozen here so a later refactor cannot quietly drop the guard.

begin;
select plan(7);

select set_config('role', 'service_role', true);

-- Two real products from the seed: one to sell down, one to use for the insert probes.
-- The sold-out line is skipped deliberately — if it were chosen, the guard would match
-- nothing for the wrong reason and the test below would pass without proving anything.
create temp table line  as
  select id, template_qty from products
   where id not in (select product_id from weekly_stock where is_sold_out)
     and template_qty > 0
   order by id limit 1;
create temp table other as select id from products order by id offset 1 limit 1;

create temp table placed as (
  with r as (
    insert into orders (customer_id, farmer_id, market_id, subtotal_kobo,
                        pickup_date, pickup_slot_start, pickup_slot_end, cutoff_at)
    select (select id from profiles where role = 'customer' limit 1),
           (select id from farmers  where status = 'approved' limit 1),
           (select id from markets limit 1),
           100,
           current_date + 3, time '09:00', time '10:00',
           (current_date + 3) + time '09:00' - interval '180 minutes'
    returning id
  )
  select id from r
);

-- A fresh order gets a short display reference rather than exposing its own uuid.
select ok((select reference ~ '^ML-[0-9]+$' from orders where id = (select id from placed limit 1)),
  'orders are given an ML-nnnn reference by default');

-- Sell the whole week down to zero through the guard, the way checkout does.
update weekly_stock
   set quantity_available = 0
 where product_id = (select id from line)
   and week = iso_week(current_date)
   and is_sold_out = false
   and quantity_available >= (select template_qty from line);

-- Without this, a missing stock row would make the next check read zero for the wrong
-- reason; this one confirms the guarded update really landed.
select is((select quantity_available from weekly_stock
            where product_id = (select id from line)
              and week = iso_week(current_date)), 0,
  'the guarded sell-down took the whole week without going negative');

-- The next customer's guarded update must now match nothing. Zero rows is the signal the
-- service turns into a 409; a guard that dropped the comparison would sell into negative.
select is((select count(*) from weekly_stock
            where product_id = (select id from line)
              and week = iso_week(current_date)
              and is_sold_out = false
              and quantity_available >= 1), 0::bigint,
  'a sold-down product satisfies no further quantity');

select throws_ok(
  $$update weekly_stock set quantity_available = -1
     where product_id = (select id from line) and week = iso_week(current_date)$$,
  '23514', null, 'quantity_available cannot go negative');

select throws_ok(
  $$insert into order_items (order_id, product_id, product_name_snapshot, unit_snapshot,
                             price_kobo_snapshot, quantity)
    values ((select id from placed limit 1), (select id from other),
            'probe', 'kg', 100, 0)$$,
  '23514', null, 'an order line cannot have a zero quantity');

select throws_ok(
  $$insert into order_items (order_id, product_id, product_name_snapshot, unit_snapshot,
                             price_kobo_snapshot, quantity)
    values ((select id from placed limit 1), (select id from other),
            'probe', 'kg', 100, 1),
           ((select id from placed limit 1), (select id from other),
            'probe', 'kg', 100, 2)$$,
  '23505', null, 'the same product cannot appear twice on one order');

select ok((select cutoff_at > now() from orders where id = (select id from placed limit 1)),
  'the probe order is placed inside its own cutoff window');

select * from finish();
rollback;
