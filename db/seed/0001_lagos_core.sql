-- Lagos demo data: 4 markets, 5 categories, 9 farmer stalls (8 approved + 1 pending),
-- 4 customers, ~40 products, and stock rows for the current ISO week.
--
-- Every id derives from md5() of its seed key so re-running this file is safe; each
-- insert ends in ON CONFLICT DO NOTHING.

-- Demo accounts need a password hash, so Supabase's normal signup path can log them in.
-- `extensions` is where Supabase already keeps pgcrypto; creating it locally keeps the
-- qualification below identical in both places.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- auth + profiles

-- All demo accounts share this password. It is demo data on a public free tier, not a
-- credential anyone should reuse.
insert into auth.users (id, email, phone, encrypted_password, email_confirmed_at)
select
  md5('marketlink-demo-' || u.key)::uuid,
  u.key || '@marketlink.test',
  u.phone,
  extensions.crypt('marketlink-demo', extensions.gen_salt('bf')),
  now()
from (values
  ('adaeze',    '+2348031120001'),
  ('tunde',     '+2348031120002'),
  ('zainab',    '+2348031120003'),
  ('emeka',     '+2348031120004'),
  ('bola',      '+2348031120101'),
  ('chidinma',  '+2348031120102'),
  ('yahaya',    '+2348031120103'),
  ('grace',     '+2348031120104'),
  ('sunday',    '+2348031120105'),
  ('ifaturo',   '+2348031120106'),
  ('kelechi',   '+2348031120107'),
  ('mariam',    '+2348031120108'),
  ('seun',      '+2348031120109'),
  ('admin',     '+2348031120900')
) as u (key, phone)
on conflict (id) do nothing;

insert into profiles (id, role, full_name, phone, address, is_active)
select md5('marketlink-demo-' || p.key)::uuid, p.role, p.name, p.phone, p.address, true
from (values
  ('adaeze',   'customer', 'Adaeze Obi',      '+2348031120001', 'Allen Avenue, Ikeja'),
  ('tunde',    'customer', 'Tunde Bakare',    '+2348031120002', 'Adekunle Jones, Surulere'),
  ('zainab',   'customer', 'Zainab Yusuf',    '+2348031120003', 'Akin Olugbade, Bolade'),
  ('emeka',    'customer', 'Emeka Nwosu',     '+2348031120004', 'Cementary Road, Yaba'),
  ('bola',     'farmer',   'Bola Adeyemi',    '+2348031120101', 'Mile 12, Ojo'),
  ('chidinma', 'farmer',   'Chidinma Eze',    '+2348031120102', 'Akiode Street, Ojota'),
  ('yahaya',   'farmer',   'Yahaya Sanni',    '+2348031120103', 'Balogun, Isale Eko'),
  ('grace',    'farmer',   'Grace Effiong',   '+2348031120104', 'Ikotun Phase 2'),
  ('sunday',   'farmer',   'Sunday Ochelula', '+2348031120105', 'Owode Onirin'),
  ('ifaturo',  'farmer',   'Ifaturo Ade',     '+2348031120106', 'Eta Beach, Epe Road'),
  ('kelechi',  'farmer',   'Kelechi Anyanwu', '+2348031120107', 'Ketu Bus Stop'),
  ('mariam',   'farmer',   'Mariam Lawal',    '+2348031120108', 'Ojodu Berger'),
  ('seun',     'farmer',   'Seun Oluwale',    '+2348031120109', 'Idimu Road'),
  ('admin',    'admin',    'MarketLink Admin','+2348031120900', 'Lagos Island')
) as p (key, role, name, phone, address)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- markets

insert into markets (id, name, address, city, state, lat, lng, operating_days, opens_at, closes_at, image_url, is_active)
values
  (md5('ml-market-mile12')::uuid, 'Mile 12 Market',
   'Ikorodu Road, Mile 12, Ojo', 'Lagos', 'Lagos', 6.595500, 3.343300,
   array['tue','thu','sat'], time '07:00', time '17:00',
   '/img/markets/mile-12.jpg', true),
  (md5('ml-market-balogun')::uuid, 'Balogun Market',
   'Balogun Square, Isale Eko', 'Lagos', 'Lagos', 6.454100, 3.398500,
   array['mon','wed','fri'], time '08:00', time '16:30',
   '/img/markets/balogun.jpg', true),
  (md5('ml-market-oshodi')::uuid, 'Oshodi Market',
   'Alhaji Masha Way, Oshodi', 'Lagos', 'Lagos', 6.567000, 3.342100,
   array['sat','sun'], time '06:30', time '18:00',
   '/img/markets/oshodi.jpg', true),
  (md5('ml-market-lekki')::uuid, 'Lekki Weekend Farmers Market',
   'Admiralty Way, Lekki Phase 1', 'Lagos', 'Lagos', 6.455100, 3.379500,
   array['sat','sun'], time '09:00', time '15:00',
   '/img/markets/lekki.jpg', true)
on conflict (id) do nothing;

/* The insert above refuses to touch a row that already exists, so a database seeded under the
   earlier title would keep it. Restated here, and only here, to make the rename self-applying. */
update markets set name = 'Mile 12 International Market'
 where id = md5('ml-market-lekki')::uuid;

-- ---------------------------------------------------------------- categories

insert into categories (id, name, slug, icon_key, sort_order)
values
  (md5('ml-cat-vegetables')::uuid, 'Vegetables', 'vegetables', 'leaf',       1),
  (md5('ml-cat-fruits')::uuid,     'Fruits',     'fruits',     'apple',      2),
  (md5('ml-cat-dairy')::uuid,      'Dairy',      'dairy',      'milk',       3),
  (md5('ml-cat-bakery')::uuid,     'Bakery',     'bakery',     'bread',      4),
  (md5('ml-cat-herbs')::uuid,      'Herbs',      'herbs',      'sprout',     5)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- farmer stalls

-- Eight approved and one pending, so the admin approval queue has something in it.
insert into farmers (id, profile_id, stall_name, contact_person, description, lat, lng,
                     operating_days, pickup_window_start, pickup_window_end,
                     order_cutoff_minutes, status, rating_avg, rating_count, cover_url)
select
  md5('marketlink-demo-' || f.key)::uuid,
  md5('marketlink-demo-' || f.key)::uuid,
  f.stall, f.name, f.blurb, f.lat, f.lng,
  f.days, f.win_start, f.win_end, f.cutoff, f.status, f.ravg, f.rcount,
  '/img/farmers/' || f.key || '.jpg'
from (values
  ('bola',     'Adeyemi Farms',        'Bola Adeyemi',    'Leaf vegetables and tubers grown at Epe, harvested two days before pickup.', 6.595500, 3.343300, array['tue','thu','sat'], time '08:00', time '12:00', 180, 'approved', 4.60, 38),
  ('chidinma', 'Eze Fresh Produce',    'Chidinma Eze',    'Peppers, tomatoes and onions sold by the crate.',                             6.567000, 3.342100, array['sat','sun'],      time '09:00', time '13:00', 120, 'approved', 4.30, 51),
  ('yahaya',   'Sanni Dairy & Eggs',   'Yahaya Sanni',    'Farm milk, yoghurt and eggs, cold-chained from the Epe herd.',                6.455100, 3.379500, array['sat','sun'],      time '10:00', time '14:00', 240, 'approved', 4.80, 27),
  ('grace',    'Effiong Veg Baskets',  'Grace Effiong',   'Mixed vegetable baskets sized for a household week.',                         6.595500, 3.343300, array['tue','thu'],      time '07:30', time '11:30', 120, 'approved', 4.10, 19),
  ('sunday',   'Ochelula Herbs',       'Sunday Ochelula', 'Scent leaf, bitter leaf and curry leaf, cut and tied by hand.',                6.454100, 3.398500, array['mon','wed','fri'], time '08:00', time '12:00', 300, 'approved', 4.40, 44),
  ('ifaturo',  'Ade Orchard',          'Ifaturo Ade',     'Seasonal fruit from Epe orchards, picked to order.',                          6.455100, 3.379500, array['sat','sun'],      time '09:30', time '13:30', 120, 'approved', 4.70, 33),
  ('kelechi',  'Anyanwu Bakery',       'Kelechi Anyanwu', 'Cassava bread, plantain chips and agege bread baked nightly.',                6.567000, 3.342100, array['sat','sun'],      time '07:00', time '11:00',  60, 'approved', 4.50, 62),
  ('mariam',   'Lawal Dairy',          'Mariam Lawal',    'Yoghurt, waraki and fresh milk kept cold from farm to stall.',                6.595500, 3.343300, array['tue','thu','sat'], time '07:00', time '10:00', 180, 'approved', 4.20, 15),
  ('seun',     'Oluwale Herb Stand',   'Seun Oluwale',    'Scent leaf, curry leaf and bitter tomato, potted or cut.',                    6.454100, 3.398500, array['mon','wed','fri'], time '08:30', time '12:30', 120, 'pending',  0.00,  0)
) as f (key, stall, name, blurb, lat, lng, days, win_start, win_end, cutoff, status, ravg, rcount)
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------- roster

insert into market_farmers (market_id, farmer_id, stall_ref, days)
values
  (md5('ml-market-mile12')::uuid, md5('marketlink-demo-bola')::uuid,     'A12', array['tue','thu']),
  (md5('ml-market-oshodi')::uuid, md5('marketlink-demo-chidinma')::uuid, 'B04', array['sat','sun']),
  (md5('ml-market-lekki')::uuid,  md5('marketlink-demo-yahaya')::uuid,   'F01', array['sat']),
  (md5('ml-market-mile12')::uuid, md5('marketlink-demo-grace')::uuid,    'A18', array['tue','thu']),
  (md5('ml-market-balogun')::uuid,md5('marketlink-demo-sunday')::uuid,   'C22', array['mon','wed']),
  (md5('ml-market-lekki')::uuid,  md5('marketlink-demo-ifaturo')::uuid,  'F07', array['sat','sun']),
  (md5('ml-market-oshodi')::uuid, md5('marketlink-demo-kelechi')::uuid,  'B11', array['sat','sun']),
  (md5('ml-market-mile12')::uuid, md5('marketlink-demo-mariam')::uuid,   'D03', array['tue','thu','sat']),
  (md5('ml-market-balogun')::uuid,md5('marketlink-demo-seun')::uuid,     'C30', array['fri'])
on conflict (market_id, farmer_id) do nothing;
