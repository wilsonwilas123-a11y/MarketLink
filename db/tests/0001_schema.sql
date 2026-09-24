-- pgTAP checks for the MarketLink schema. Run with:
--   pg_prove -d "$DATABASE_URL" db/tests/*.sql
-- or via `npm run db:test`, which shells the same files through psql in the local
-- Postgres container.

begin;
select plan(23);

-- ---------------------------------------------------------------- shape

select has_table('profiles');
select has_table('markets');
select has_table('farmers');
select has_table('market_farmers');
select has_table('categories');
select has_table('products');
select has_table('weekly_stock');
select has_table('orders');
select has_table('order_items');
select has_table('reviews');
select has_table('favorites');
select has_table('notifications');

-- ---------------------------------------------------------------- money and weeks

select col_type_is('products', 'price_kobo', 'bigint', 'money stays integer kobo, never float');
select col_type_is('orders', 'subtotal_kobo', 'bigint', 'order totals stay integer kobo');
select col_type_is('order_items', 'price_kobo_snapshot', 'bigint', 'price snapshots stay integer kobo');
select has_column('weekly_stock', 'week', 'stock is keyed by ISO week');
select lives_ok(
  $$insert into categories (name, slug, icon_key) values ('pgTAP Probe', 'pgtap-probe', 'probe')$$,
  'a well-formed slug is accepted'
);
select throws_ok(
  $$insert into categories (name, slug, icon_key) values ('Bad', 'Not A Slug', 'x')$$,
  '23514',
  null,
  'an upper-case or spaced slug is rejected'
);
select is(
  iso_week(date '2026-01-01'),
  '2026-W01',
  'iso_week labels a new-year week by ISO rules, not by the calendar year'
);

-- ---------------------------------------------------------------- RLS actually denies

-- A flag being set is not the same as access being refused, so probe it for real:
-- switch role, try to read, and report whether it went through. The whole file runs
-- inside a transaction that is rolled back, and the helper resets the role on both
-- paths so a later assertion is not still running as `anon`.
create or replace function pg_temp.can_read_as(who text, tbl regclass)
returns boolean
language plpgsql
as $$
begin
  perform set_config('role', who, true);
  execute 'select * from ' || tbl || ' limit 1';
  perform set_config('role', 'none', true);
  return true;
exception when insufficient_privilege then
  perform set_config('role', 'none', true);
  return false;
end
$$;

select is(pg_temp.can_read_as('anon', 'products'), false,
  'anon cannot read products, so a leaked publishable key cannot bulk the catalogue');
select is(pg_temp.can_read_as('anon', 'orders'), false, 'anon cannot read orders');
select is(pg_temp.can_read_as('authenticated', 'profiles'), false,
  'a logged-in customer cannot read another profile through PostgREST');
select is(pg_temp.can_read_as('service_role', 'products'), true,
  'service_role still reads, which is the path Node uses');

select * from finish();
rollback;
