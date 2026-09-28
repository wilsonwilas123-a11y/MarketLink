-- pgTAP checks for the MarketLink schema. Run with:
--   pg_prove -d "$DATABASE_URL" db/tests/*.sql
-- or via `npm run db:test`, which shells the same files through psql in the local
-- Postgres container.

begin;
select plan(31);

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

select col_type_is('products', 'price_minor', 'bigint', 'money stays an integer minor unit, never float');
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

-- ---------------------------------------------------------------- where, and in what money

-- Migration 0010 backfilled these and then made them NOT NULL, so the point of the check is
-- that a market with no country is now a rejected write rather than a row that silently
-- reads as Nigerian.

select col_not_null('markets', 'country', 'a market has to name its country');
select col_not_null('markets', 'currency', 'a market has to name the money its prices are in');
select col_not_null('markets', 'timezone', 'open-now is answered from the market own clock');
select col_not_null('farmers', 'country', 'a stall carries a country');
select col_not_null('farmers', 'currency', 'a stall carries a currency');

select throws_ok(
  $$insert into markets (name, address, city, state, lat, lng, opens_at, closes_at,
                         country, currency, timezone)
     values ('pgTAP Probe', 'x', 'Kumasi', 'Ashanti', 6.7, -1.6, '08:00', '16:00',
             'Ghana', 'gn', 'Africa/Accra')$$,
  '23514', null,
  'a lower-case currency code is rejected, so ng and NGN cannot both end up in the data'
);
select throws_ok(
  $$insert into markets (name, address, city, state, lat, lng, opens_at, closes_at,
                         country, currency, timezone)
     values ('pgTAP Probe', 'x', 'Kumasi', 'Ashanti', 6.7, -1.6, '08:00', '16:00',
             'Ghana', 'GHS', 'GMT')$$,
  '23514', null,
  'a zone abbreviation is rejected where an IANA zone name is required'
);
select lives_ok(
  $$insert into markets (name, address, city, state, lat, lng, opens_at, closes_at,
                         country, currency, timezone)
     values ('pgTAP Probe', 'x', 'Cotonou', 'Ouémé', 6.36, 2.43, '08:00', '16:00',
             'Benin', 'XOF', 'Africa/Porto-Novo')$$,
  'a hyphenated zone name is a real zone, and the shape check has to let it through'
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
