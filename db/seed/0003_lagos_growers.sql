-- Twenty more stalls across the three Lagos markets, so the directory reads as a market rather
-- than a shortlist. Each carries two listings and a stock row for the week this file runs in.
--
-- Same rule as the files above it: every id derives from md5() of its seed key, every insert ends
-- in ON CONFLICT DO NOTHING, so re-running this is safe.
--
-- Stall coordinates are not written here. They come from the market the stall is rostered to, so
-- a market that moves its pin moves its growers with it.

-- ---------------------------------------------------------------- auth + profiles

insert into auth.users (id, email, phone, encrypted_password, email_confirmed_at)
select
  md5('marketlink-demo-' || u.key)::uuid,
  u.key || '@marketlink.test',
  u.phone,
  extensions.crypt('marketlink-demo', extensions.gen_salt('bf')),
  now()
from (values
  ('funmilayo', '+2348031120111'),
  ('chidera',   '+2348031120112'),
  ('olumide',   '+2348031120113'),
  ('blessing',  '+2348031120114'),
  ('peter',     '+2348031120115'),
  ('nneka',     '+2348031120116'),
  ('tolu',      '+2348031120117'),
  ('halima',    '+2348031120118'),
  ('kingsley',  '+2348031120119'),
  ('amaka',     '+2348031120120'),
  ('yinka',     '+2348031120121'),
  ('fatima',    '+2348031120122'),
  ('musa',      '+2348031120123'),
  ('hauwa',     '+2348031120124'),
  ('dele',      '+2348031120125'),
  ('uche',      '+2348031120126'),
  ('kolade',    '+2348031120127'),
  ('rabiu',     '+2348031120128'),
  ('tosin',     '+2348031120129'),
  ('ireni',     '+2348031120130')
) as u (key, phone)
on conflict (id) do nothing;

insert into profiles (id, role, full_name, phone, address, is_active)
select md5('marketlink-demo-' || p.key)::uuid, 'farmer', p.name, p.phone, p.address, true
from (values
  ('funmilayo', 'Funmilayo Balogun',  '+2348031120111', 'Epe Road, Ikorodu'),
  ('chidera',   'Chidera Nwachukwu',  '+2348031120112', 'Bode Thomas, Surulere'),
  ('olumide',   'Olumide Ogunsanya',  '+2348031120113', 'Ago Palace Way, Okota'),
  ('blessing',  'Blessing Aluko',     '+2348031120114', 'Ojodu Berger'),
  ('peter',     'Peter Okonkwu',      '+2348031120115', 'Iyana Ilogbo, Ojo'),
  ('nneka',     'Nneka Mbadiwe',      '+2348031120116', 'Ormoto, Yaba'),
  ('tolu',      'Tolu Adebayo',       '+2348031120117', 'Festac Town'),
  ('halima',    'Halima Sadiq',       '+2348031120118', 'Isale Eko, Lagos Island'),
  ('kingsley',  'Kingsley Onyeka',    '+2348031120119', 'Ikotun Phase 1'),
  ('amaka',     'Amaka Udeh',         '+2348031120120', 'Maryland'),
  ('yinka',     'Yinka Oyelaran',     '+2348031120121', 'Oregun, Ikeja'),
  ('fatima',    'Fatima Bature',      '+2348031120122', 'Badagry Road'),
  ('musa',      'Musa Abubakar',      '+2348031120123', 'Owode Onirin'),
  ('hauwa',     'Hauwa Garba',        '+2348031120124', 'Ketu Bus Stop'),
  ('dele',      'Dele Ogunlana',      '+2348031120125', 'Eleko Beach Road'),
  ('uche',      'Uche Nnamdi',        '+2348031120126', 'Sabo, Igbobi'),
  ('kolade',    'Kolade Shonibare',   '+2348031120127', 'Odogbolu Road'),
  ('rabiu',     'Rabiu Momoh',        '+2348031120128', 'Iddo Gate'),
  ('tosin',     'Tosin Ajayi',        '+2348031120129', 'Egbeda'),
  ('ireni',     'Ireni Okafor',       '+2348031120130', 'Ifako Agege')
) as p (key, name, phone, address)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- stalls
-- mkt is a market seed key, not a name: the row below joins it to markets for the pin.

insert into farmers (id, profile_id, stall_name, contact_person, description, lat, lng,
                     operating_days, pickup_window_start, pickup_window_end,
                     order_cutoff_minutes, status, rating_avg, rating_count, cover_url,
                     country, currency)
select
  md5('marketlink-demo-' || f.key)::uuid,
  md5('marketlink-demo-' || f.key)::uuid,
  f.stall, f.name, f.blurb, m.lat, m.lng,
  f.days, f.win_start, f.win_end, f.cutoff, 'approved', f.ravg, f.rcount, null,
  m.country, m.currency
from (values
  ('funmilayo', 'Balogun Leaf Co-op',      'Funmilayo Balogun',
   'A co-op of six growers cutting ugu and waterleaf on the Epe road.',
   'mile12',  array['tue','thu','sat'],            time '07:00', time '11:00', 180, 4.40, 26),
  ('chidera',   'Nwachukwu Yam Barn',      'Chidera Nwachukwu',
   'Drum yam and puna yam, cured three weeks before they leave the barn.',
   'mile12',  array['sat','sun'],                  time '08:00', time '13:00', 240, 4.60, 41),
  ('olumide',   'Ogunsanya Cassava Works', 'Olumide Ogunsanya',
   'Garri, fufu flour and cassava loaves, milled and baked on one site.',
   'oshodi',  array['sat','sun'],                  time '07:00', time '11:00', 120, 4.30, 33),
  ('blessing',  'Aluko Chip Kitchen',      'Blessing Aluko',
   'Plantain chips and chin-chin fried at dawn and sold the same morning.',
   'oshodi',  array['sat'],                        time '06:30', time '10:30',  60, 4.70, 58),
  ('peter',     'Okonkwu Orchard',         'Peter Okonkwu',
   'Citrus and guava driven down from an orchard at Abi.',
   'oshodi',  array['sun'],                        time '08:00', time '12:00', 180, 4.10, 12),
  ('nneka',     'Mbadiwe Plantain Bunch',  'Nneka Mbadiwe',
   'Plantain sold green by the bunch and the hand, sorted by size.',
   'mile12',  array['tue','thu','sat'],            time '07:30', time '11:30', 120, 4.50, 47),
  ('tolu',      'Adebayo Cold Room',       'Tolu Adebayo',
   'Tomatoes and tatashe held cold from the farm gate to the stall.',
   'oshodi',  array['sat','sun'],                  time '06:00', time '10:00', 240, 4.20, 22),
  ('halima',    'Sadiq Herb Grindery',     'Halima Sadiq',
   'Ginger, garlic and uda dried, cleaned and ground to order.',
   'oyingbo', array['mon','wed'],                  time '08:00', time '12:00', 180, 4.50, 29),
  ('kingsley',  'Onyeka Green House',      'Kingsley Onyeka',
   'Lettuce, cucumber and spring onion grown under net at Ikorodu.',
   'mile12',  array['tue','thu'],                  time '07:00', time '10:00', 120, 4.40, 18),
  ('amaka',     'Udeh Tray Garden',        'Amaka Udeh',
   'Scent leaf, basil and mint raised in trays, sold cut or potted.',
   'mile12',  array['sat','sun'],                  time '09:00', time '13:00',  60, 4.80, 36),
  ('yinka',     'Oyelaran Maize Mill',     'Yinka Oyelaran',
   'Corn flour, roasted maize and agbelima, milled once a week.',
   'oshodi',  array['sat'],                        time '10:00', time '14:00', 240, 4.00, 14),
  ('fatima',    'Bature Milk Round',       'Fatima Bature',
   'Milk, nonnu and waraki from a herding co-op out at Badagry.',
   'oshodi',  array['sun'],                        time '07:00', time '10:00', 120, 4.60, 21),
  ('musa',      'Abubakar Tomato Lines',   'Musa Abubakar',
   'Roma tomatoes picked at colour and crated the same day.',
   'oyingbo', array['mon','wed','fri'],            time '06:30', time '10:30', 300, 4.30, 44),
  ('hauwa',     'Garba Pepper Runs',       'Hauwa Garba',
   'Rodo and shombo picked twice a week on runs up from Jos.',
   'oshodi',  array['sat','sun'],                  time '07:00', time '11:00', 180, 4.40, 31),
  ('dele',      'Ogunlana Coconut Stand',  'Dele Ogunlana',
   'Coconut husked to order, water bottled from the same nut.',
   'oyingbo', array['fri'],                        time '08:00', time '12:00', 120, 4.20, 16),
  ('uche',      'Nnamdi Avocado Row',      'Uche Nnamdi',
   'Butter avocado ripened off the tree along the Ikorodu road.',
   'mile12',  array['thu','sat'],                  time '09:00', time '13:00', 120, 4.70, 25),
  ('kolade',    'Shonibare Leaf House',    'Kolade Shonibare',
   'Efo shoko, efo alako and gboma, washed before they are tied.',
   'oshodi',  array['sat','sun'],                  time '06:30', time '10:30', 120, 4.10, 19),
  ('rabiu',     'Momoh Root Cellar',       'Rabiu Momoh',
   'Coco yam, sweet potato and ginger kept in one cellar at Badagry.',
   'oyingbo', array['wed','fri'],                  time '08:00', time '12:00', 240, 4.50, 23),
  ('tosin',     'Ajayi Bread Oven',        'Tosin Ajayi',
   'Agege bread and cassava loaves baked through the night.',
   'mile12',  array['tue','thu','sat','sun'],      time '06:00', time '10:00',  60, 4.60, 63),
  ('ireni',     'Okafor Yoghurt Kitchen',  'Ireni Okafor',
   'Set yoghurt and farm cheese churned in a back kitchen at Ketu.',
   'oshodi',  array['sat'],                        time '08:00', time '11:00', 180, 4.40, 17)
) as f (key, stall, name, blurb, mkt, days, win_start, win_end, cutoff, ravg, rcount)
join markets m on m.id = md5('ml-market-' || f.mkt)::uuid
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------- roster
-- Days are read back off the stall rather than restated here, so the two cannot drift apart.

insert into market_farmers (market_id, farmer_id, stall_ref, days)
select m.id, f.id, r.stall_ref, f.operating_days
from (values
  ('funmilayo', 'mile12',  'G04'),
  ('chidera',   'mile12',  'G11'),
  ('olumide',   'oshodi',  'C07'),
  ('blessing',  'oshodi',  'C12'),
  ('peter',     'oshodi',  'C19'),
  ('nneka',     'mile12',  'A24'),
  ('tolu',      'oshodi',  'D02'),
  ('halima',    'oyingbo', 'C35'),
  ('kingsley',  'mile12',  'F12'),
  ('amaka',     'mile12',  'F15'),
  ('yinka',     'oshodi',  'B18'),
  ('fatima',    'oshodi',  'D09'),
  ('musa',      'oyingbo', 'C41'),
  ('hauwa',     'oshodi',  'B22'),
  ('dele',      'oyingbo', 'C44'),
  ('uche',      'mile12',  'A29'),
  ('kolade',    'oshodi',  'C26'),
  ('rabiu',     'oyingbo', 'C47'),
  ('tosin',     'mile12',  'A33'),
  ('ireni',     'oshodi',  'D14')
) as r (key, mkt, stall_ref)
join farmers f on f.id = md5('marketlink-demo-' || r.key)::uuid
join markets m on m.id = md5('ml-market-' || r.mkt)::uuid
on conflict (market_id, farmer_id) do nothing;

-- ---------------------------------------------------------------- listings
-- Two per stall: enough that the Shop harvest tab on a profile is not an empty box.

insert into products (id, farmer_id, category_id, name, description, unit, price_minor,
                      image_urls, template_qty, is_organic, is_active,
                      rating_avg, rating_count)
select
  md5('ml-grower-product-' || p.key)::uuid,
  md5('marketlink-demo-' || p.stall)::uuid,
  c.id,
  p.name, p.blurb, p.unit, p.price,
  '{}', p.qty, p.organic, true, p.ravg, p.rcount
from (values
  ('funmilayo-ugu',      'funmilayo', 'vegetables', 'Ugu (Pumpkin Leaves)',  'Co-op ugu, stems trimmed at the farm.',            'bunch',   75000, 55, false, 4.60, 14),
  ('funmilayo-waterleaf','funmilayo', 'vegetables', 'Waterleaf',             'Washed waterleaf, tied the same morning.',         'bunch',   48000, 40, true,  4.20,  6),
  ('chidera-puna',       'chidera',   'vegetables', 'Puna Yam (Cured)',      'A cured puna tuber, roughly 3kg.',                 'crate',  430000, 22, false, 4.50, 18),
  ('chidera-drum',       'chidera',   'vegetables', 'Drum Yam',              'The long drum yam, cut to a cooking size.',        'crate',  680000, 14, false, 4.70,  9),
  ('olumide-fufu',       'olumide',   'bakery',     'Fufu Flour (Cassava)',  'Sieved cassava flour, packed to 2kg.',             'pack',   350000, 20, false, 4.40, 12),
  ('olumide-loaf',       'olumide',   'bakery',     'Cassava Flour Loaf',    'The day’s cassava loaf, out of the tin at seven.', 'pack',   240000, 25, false, 4.30,  8),
  ('blessing-chips',     'blessing',  'bakery',     'Plantain Chips',        'Fried at dawn, salted light.',                     'pack',   150000, 60, false, 4.70, 24),
  ('blessing-chinching', 'blessing',  'bakery',     'Chin-Chin',             'A jar of chin-chin, fried to pale gold.',          'pack',   180000, 40, false, 4.60, 17),
  ('peter-guava',        'peter',     'fruits',     'Guava',                 'Tree guava, picked at firm ripe.',                 'kg',     220000, 30, false, 4.20,  7),
  ('peter-orange',       'peter',     'fruits',     'Pressing Orange',       'A crate of oranges pressed at the stall.',         'crate',  820000, 12, false, 4.00,  5),
  ('nneka-bunch',        'nneka',     'fruits',     'Plantain (Bunch)',      'A full bunch, still green.',                       'bunch',  350000, 45, false, 4.50, 21),
  ('nneka-hand',         'nneka',     'fruits',     'Plantain (Hand)',       'One hand for a household week.',                   'pack',    90000, 70, false, 4.40, 19),
  ('tolu-tomato',        'tolu',      'vegetables', 'Tomato (Cold Room)',    'Crate tomatoes held cold since the farm gate.',    'crate',  880000, 14, false, 4.30,  9),
  ('tolu-tatashe',       'tolu',      'vegetables', 'Tatashe (Bell Pepper)', 'Firm red tatashe, no sunken shoulders.',           'basket', 620000, 16, false, 4.10,  6),
  ('halima-ginger',      'halima',    'herbs',      'Ground Ginger',         'Ginger dried, then ground to order.',              'pack',   200000, 28, false, 4.60, 11),
  ('halima-uda',         'halima',    'herbs',      'Uda (Negrito Pods)',    'Uda pods for a pepper mix.',                       'pack',   160000, 24, true,  4.40,  7),
  ('kingsley-lettuce',   'kingsley',  'vegetables', 'Lettuce (Head)',        'One net-house lettuce head.',                      'pack',   120000, 35, false, 4.40,  8),
  ('kingsley-cucumber',  'kingsley',  'vegetables', 'Cucumber',              'Cucumber cut the same hour.',                      'kg',     180000, 26, false, 4.20,  5),
  ('amaka-nchanwu',      'amaka',     'herbs',      'Scent Leaf (Nchanwu)',  'A hand-tied bunch off the tray.',                  'bunch',   68000, 44, true,  4.90, 16),
  ('amaka-mint',         'amaka',     'herbs',      'Potted Mint',           'Mint in a pot, so it lasts the week.',             'pack',   250000, 12, true,  4.60,  4),
  ('yinka-cornflour',    'yinka',     'bakery',     'Corn Flour',            'Milled corn flour, packed to 1kg.',                'pack',   300000, 22, false, 4.10,  6),
  ('yinka-roasted',      'yinka',     'bakery',     'Roasted Maize',         'Maize roasted on the drum that morning.',          'pack',   120000, 40, false, 4.00,  8),
  ('fatima-milk',        'fatima',    'dairy',      'Fresh Milk',            'Unboiled milk from the co-op round.',              'pack',   180000, 30, false, 4.50,  9),
  ('fatima-waraki',      'fatima',    'dairy',      'Waraki (Fresh)',        'Waraki still soft, cut at the stall.',             'pack',   220000, 18, false, 4.70, 12),
  ('musa-roma',          'musa',      'vegetables', 'Tomato (Roma)',         'Roma tomato, picked at colour.',                   'crate',  920000, 12, false, 4.40, 17),
  ('musa-shombo',        'musa',      'vegetables', 'Shombo (Chilli Pepper)', 'Long green shombo, sorted by length.',            'crate',  500000, 15, false, 4.50, 13),
  ('hauwa-rodo',         'hauwa',     'vegetables', 'Rodo (Habanero)',       'Scotch bonnet from the second run of the week.',   'crate',  540000, 16, false, 4.50, 14),
  ('hauwa-onion',        'hauwa',     'vegetables', 'Onion (5kg Net)',       'A net of dry onion, skin still tight.',            'pack',   760000, 20, false, 4.20,  8),
  ('dele-coconut',       'dele',      'fruits',     'Coconut (Husked)',      'Husked to order, meat still firm.',                'pack',   160000, 40, false, 4.30,  7),
  ('dele-water',         'dele',      'fruits',     'Coconut Water',         'Bottled from the nut opened in front of you.',     'pack',   120000, 25, true,  4.10,  5),
  ('uche-avocado',       'uche',      'fruits',     'Butter Avocado',        'Ripened off the tree, graded by hand.',            'kg',     320000, 18, true,  4.80, 11),
  ('uche-pawpaw',        'uche',      'fruits',     'Pawpaw (Half)',         'Half a pawpaw, seeds out.',                        'pack',   190000, 26, false, 4.30,  6),
  ('kolade-alako',       'kolade',    'vegetables', 'Efo Alako',             'Fluted dandelion, washed before tying.',           'bunch',   56000, 42, false, 4.20,  7),
  ('kolade-gboma',       'kolade',    'vegetables', 'Gboma',                 'Gboma for soup, cut long.',                        'bunch',   50000, 48, false, 4.00,  5),
  ('rabiu-cocoyam',      'rabiu',     'vegetables', 'Coco Yam',              'Elephant yam from the cellar, cut to size.',       'crate',  400000, 16, false, 4.50,  9),
  ('rabiu-sweetpotato',  'rabiu',     'vegetables', 'Sweet Potato',          'Orange-flesh sweet potato, medium grade.',         'kg',     130000, 28, false, 4.30,  6),
  ('tosin-agege',        'tosin',     'bakery',     'Agege Bread',           'The round loaf, out of the oven at five.',         'pack',    95000, 70, false, 4.60, 29),
  ('tosin-coconut',      'tosin',     'bakery',     'Coconut Bread',         'Coconut bread, shredded thick.',                   'pack',   130000, 45, false, 4.70, 18),
  ('ireni-yoghurt',      'ireni',     'dairy',      'Plain Yoghurt',         'Set yoghurt, no milk powder in it.',               'pack',   150000, 32, false, 4.40, 10),
  ('ireni-cheese',       'ireni',     'dairy',      'Farm Cheese',           'Cheddar-style cheese, pressed in the back room.',  'pack',   260000, 14, false, 4.60,  6)
) as p (key, stall, cat_slug, name, blurb, unit, price, qty, organic, ravg, rcount)
join categories c on c.slug = p.cat_slug
on conflict (id) do nothing;

-- Stock for the week this runs in. Scoped to whatever has no row yet, so it fills the stalls
-- added above without touching the week 0002 already wrote.
insert into weekly_stock (product_id, week, quantity_available, is_sold_out)
select p.id, iso_week(current_date), p.template_qty, false
from products p
where not exists (
  select 1 from weekly_stock s
   where s.product_id = p.id and s.week = iso_week(current_date)
)
on conflict (product_id, week) do nothing;
