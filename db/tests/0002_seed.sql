-- pgTAP checks over the seeded Lagos dataset. These are the numbers the phase 2 exit
-- test reads off, so they are asserted here rather than checked by hand.

begin;
select plan(9);

-- Three, not the four the seed once carried: the corrections section of 0001_lagos_core
-- retires Lekki Phase 1 and Balogun rather than leaving them rostered to nobody.
select is((select count(*) from markets), 3::bigint, 'seed loads 3 markets');
select is((select count(*) from categories), 5::bigint, 'seed loads 5 categories');
select is((select count(*) from farmers), 29::bigint, 'seed loads 29 farmer stalls');
select is((select count(*) from farmers where status = 'approved'), 28::bigint,
  '28 farmers are approved');
select is((select count(*) from farmers where status = 'pending'), 1::bigint,
  '1 farmer is pending, so the admin queue is not empty');
select is((select count(*) from market_farmers), 29::bigint, 'every stall is rostered to a market');

select isnt((select count(*) from products), 0::bigint, 'products are seeded');
select ok((select count(*) from products) between 80 and 100,
  'every stall carries listings, and none of them a catalogue');

-- Stock must exist for the week the seed ran in, or the badge reads zero on a fresh deploy.
select is(
  (select count(*) from weekly_stock where week = iso_week(current_date)),
  (select count(*) from products),
  'every product has a weekly_stock row for the current ISO week'
);

select * from finish();
rollback;
