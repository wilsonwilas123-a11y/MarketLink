-- MarketLink is not a Lagos-only catalogue, and three things every query so far was allowed
-- to assume are now data: which country a market is in, what its money is called, and which
-- clock it trades on.
--
-- The columns are added nullable, backfilled, then made NOT NULL, rather than created with a
-- `default 'Nigeria'`. A default stays in the schema forever and files a Kumasi market under
-- Nigeria the first time a form omits the field; the constraint below makes that same
-- omission a rejected write instead of a plausible-looking wrong row.

alter table markets add column country text;
alter table markets add column currency text;
alter table markets add column timezone text;

alter table farmers add column country text;
alter table farmers add column currency text;

update markets
  set country = 'Nigeria', currency = 'NGN', timezone = 'Africa/Lagos';

-- A stall's country and money come from the market it trades at, so existing rows are
-- derived here instead of typed a second time. Anyone not yet on a roster falls back to the
-- same values the backfill above just gave every market, which is all the seed contains.
update farmers f
  set country = m.country, currency = m.currency
  from market_farmers mf
  join markets m on m.id = mf.market_id
  where mf.farmer_id = f.id;

update farmers
  set country = 'Nigeria', currency = 'NGN'
  where country is null;

alter table markets alter column country set not null;
alter table markets alter column currency set not null;
alter table markets alter column timezone set not null;
alter table farmers alter column country set not null;
alter table farmers alter column currency set not null;

alter table markets add constraint markets_country_named check (length(btrim(country)) > 0);
alter table markets add constraint markets_currency_iso check (currency ~ '^[A-Z]{3}$');
alter table markets add constraint markets_timezone_iana check (timezone ~ '^[A-Za-z]+/[A-Za-z_-]+$');
alter table farmers add constraint farmers_country_named check (length(btrim(country)) > 0);
alter table farmers add constraint farmers_currency_iso check (currency ~ '^[A-Z]{3}$');

-- `timezone` is checked for shape, not against `pg_timezone_names`, because a check cannot
-- run a subquery. That is the cheaper half of the guarantee: 'GMT' and 'lagos' are refused
-- at the door, and a well-formed name that turns out not to exist still fails loudly at the
-- first query that reads the row rather than quietly answering "closed".

-- The discovery screen filters by country the same way it already filters by city.
create index markets_country_idx on markets (country);

-- 'kobo' names one country's subunit, and every other country on the continent has a
-- different one with a different count per unit. 'minor' is the neutral word for "the
-- smallest whole number this money comes in", which is the only thing the column ever
-- stored; which minor unit it is now travels with the row's currency instead of with the
-- column name.
alter table products rename column price_kobo to price_minor;
alter table products rename constraint products_price_kobo_check to products_price_minor_check;

-- `orders.subtotal_kobo` and `order_items.price_kobo_snapshot` keep their names: no order
-- can be written through the API yet, so renaming them now would be a guess at a shape that
-- has no caller. They take the same treatment when the order flow opens.
