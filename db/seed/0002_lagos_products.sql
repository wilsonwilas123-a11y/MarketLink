-- ~40 listings across the eight approved stalls, plus a stock row for each in the
-- current ISO week. Seun Oluwale is still pending, so their stall deliberately has
-- nothing published — that is what the listing gate in spec 4.3 is for.

insert into products (id, farmer_id, category_id, name, description, unit, price_minor,
                      image_urls, template_qty, is_organic, is_active,
                      rating_avg, rating_count)
select
  md5('ml-product-' || p.key)::uuid,
  md5('marketlink-demo-' || p.stall)::uuid,
  c.id,
  p.name, p.blurb, p.unit, p.price,
  '{}', p.qty, p.organic, true, p.ravg, p.rcount
from (values
  -- Adeyemi Farms — leaf vegetables and tubers
  ('ugu-500',       'bola', 'vegetables', 'Ugu (Pumpkin Leaves)',        'Ten thick ugu leaves, stems trimmed.',                'bunch',  80000,  60, false, 4.70, 22),
  ('efo-shoko',     'bola', 'vegetables', 'Efo Shoko',                   'A dense bundle of wild spinach.',                     'bunch',  60000,  45, false, 4.50, 18),
  ('efo-alako',     'bola', 'vegetables', 'Efo Alako',                   'Fluted dandelion, picked this morning.',              'bunch',  55000,  40, true,  4.30, 11),
  ('gboma',         'bola', 'vegetables', 'Gboma',                       'Gboma leaves for soups and stews.',                   'bunch',  50000,  50, false, 4.20,  9),
  ('waterleaf',     'bola', 'vegetables', 'Waterleaf',                   'Fresh waterleaf bundles, washed.',                    'bunch',  45000,  35, true,  4.10,  7),
  ('yam-tuber',     'bola', 'vegetables', 'Puna Yam Tuber',              'A medium puna tuber, roughly 3kg.',                   'crate', 450000,  24, false, 4.60, 31),
  ('coco-yam',      'bola', 'vegetables', 'Coco Yam',                    'Elephant yam, cut to a cooking size.',                'crate', 380000,  18, false, 4.40, 14),
  ('sweet-potato',  'bola', 'vegetables', 'Sweet Potato',                'Orange-flesh sweet potato, graded medium.',           'kg',    120000,  30, false, 4.35, 12),

  -- Eze Fresh Produce — peppers, tomatoes, onions
  ('tatashe-crate', 'chidinma', 'vegetables', 'Tatashe (Bell Pepper)',   'A crate of firm red tatashe.',                        'crate', 650000,  12, false, 4.40, 26),
  ('shombo-crate',  'chidinma', 'vegetables', 'Shombo (Chilli Pepper)',  'Hot shombo, sorted by size.',                         'crate', 480000,  15, false, 4.60, 33),
  ('rodo-crate',    'chidinma', 'vegetables', 'Rodo (Habanero)',         'Scotch bonnet, harvested at colour.',                 'crate', 520000,  14, false, 4.55, 41),
  ('tomato-crate',  'chidinma', 'vegetables', 'Tomato (Fresh)',          'Roma-type tomatoes, no crush.',                       'crate', 900000,   9, false, 4.10, 20),
  ('onion-net',     'chidinma', 'vegetables', 'Onion',                   'A net of dry onions, about 5kg.',                     'pack',  750000,  20, false, 4.25, 17),
  ('garden-egg',    'chidinma', 'vegetables', 'Garden Egg',              'Purple garden egg, picked young.',                    'bunch',  70000,  28, false, 4.05,  8),

  -- Effiong Veg Baskets — mixed household baskets
  ('basket-soup',   'grace', 'vegetables', 'Soup Basket',                'Ugu, efo, waterleaf and pepper for one pot.',         'basket', 1200000, 16, false, 4.30, 13),
  ('basket-week',   'grace', 'vegetables', 'Household Week Basket',       'Seven days of leaf veg for a family of four.',        'basket', 2400000,  8, false, 4.00,  6),
  ('basket-starter','grace', 'vegetables', 'Starter Basket',              'A small first-week basket for a new kitchen.',        'basket',  900000, 12, true,  3.90,  4),
  ('basket-organic','grace', 'vegetables', 'Organic Leaf Basket',         'Certified-organic leaves, no synthetic spray.',       'basket', 1800000,  6, true,  4.80,  9),

  -- Ochelula Herbs
  ('scent-leaf',    'sunday', 'herbs', 'Scent Leaf (Nchanwu)',           'A hand-tied bunch of nchanwu.',                      'bunch',  70000,  40, true,  4.90, 44),
  ('bitter-leaf',   'sunday', 'herbs', 'Bitter Leaf',                    'Washed bitter leaf, de-bittered on request.',         'bunch',  65000,  36, false, 4.40, 19),
  ('curry-leaf',    'sunday', 'herbs', 'Curry Leaf',                     'Fresh curry leaf sprigs.',                            'bunch',  40000,  55, false, 4.20, 12),
  ('tulasi',        'sunday', 'herbs', 'Tulasi (Holy Basil)',            'Tulasi cut for tea and soups.',                       'bunch',  45000,  30, true,  4.60,  8),
  ('ginger-root',   'sunday', 'herbs', 'Ginger Root',                    'Fat ginger, washed and unpeeled.',                    'kg',    220000,  18, false, 4.35, 15),
  ('garlic-bulb',   'sunday', 'herbs', 'Garlic',                         'Local garlic bulbs, cured.',                          'pack',  180000,  22, false, 4.15, 10),
  ('uda-pods',      'sunday', 'herbs', 'Uda (Negrito Pods)',             'Aromatic uda pods for pepper mixes.',                 'pack',  150000,  25, true,  4.70,  7),

  -- Ade Orchard — fruit
  ('watermelon',    'ifaturo', 'fruits', 'Watermelon',                   'One seeded watermelon, roughly 6kg.',                 'pack',  250000,  40, false, 4.50, 29),
  ('sweet-banana',  'ifaturo', 'fruits', 'Sweet Banana',                 'A hand of ripe sweet banana.',                        'bunch', 120000,  55, false, 4.60, 38),
  ('pineapple',     'ifaturo', 'fruits', 'Sugarloaf Pineapple',          'Gold sugarloaf, cut top left on.',                    'pack',  400000,  26, false, 4.75, 44),
  ('mango',         'ifaturo', 'fruits', 'Mango',                        'Seasonal mango, picked at cheek colour.',             'kg',    150000,  34, false, 4.40, 21),
  ('pawpaw',        'ifaturo', 'fruits', 'Pawpaw',                       'Half a ripe pawpaw, seeds removed.',                  'pack',  180000,  30, false, 4.25, 16),
  ('avocado',       'ifaturo', 'fruits', 'Avocado',                      'Butter avocado, ripened off the tree.',               'kg',    300000,  20, true,  4.80, 18),
  ('orange',        'ifaturo', 'fruits', 'Orange',                       'A crate of pressing oranges.',                        'crate', 850000,  11, false, 4.05,  9),
  ('coconut',       'ifaturo', 'fruits', 'Coconut (Cold)',               'Chilled coconut with the husk trimmed.',              'pack',  150000,  45, false, 4.55, 23),

  -- Anyanwu Bakery
  ('agege-bread',   'kelechi', 'bakery', 'Agege Bread',                  'The daily round loaf, baked overnight.',              'pack',   90000,  70, false, 4.60, 58),
  ('cassava-bread', 'kelechi', 'bakery', 'Cassava Flour Bread',          'Gluten-free loaf in a small tin.',                    'pack',  250000,  25, false, 4.45, 27),
  ('plantain-chips','kelechi', 'bakery', 'Plantain Chips',               'Salted unripe plantain chips, 250g.',                 'pack',  150000,  60, false, 4.70, 49),
  ('coconut-bread', 'kelechi', 'bakery', 'Coconut Bread',                'Soft bread with real coconut through the crumb.',     'pack',  280000,  18, false, 4.30, 14),
  ('chin-chin',     'kelechi', 'bakery', 'Chin Chin',                    'A one-kilo box, crunchy not oily.',                   'pack',  200000,  35, false, 4.50, 31),
  ('meat-pie',      'kelechi', 'bakery', 'Meat Pie',                     'Hand-filled pies, six to a pack.',                    'pack',  350000,  15, false, 4.20, 12),

  -- Lawal Dairy
  ('fresh-milk',    'mariam', 'dairy', 'Fresh Milk',                     'Half a litre of unpasteurised farm milk.',            'l',     200000,  30, false, 4.40, 24),
  ('yoghurt-natural','mariam','dairy', 'Yoghurt (Natural)',              'Set yoghurt, no added sugar, 500ml.',                  'l',     350000,  22, false, 4.65, 33),
  ('waraki',        'mariam', 'dairy', 'Waraki (Soft Cheese)',           'Traditional white cheese, cut to order.',             'pack',  400000,  14, false, 4.55, 16),
  ('butter-250',    'mariam', 'dairy', 'Farm Butter',                    'Cultured butter, 250g block.',                        'pack',  450000,  12, false, 4.35,  9),
  ('noni-juice',    'mariam', 'dairy', 'Fermented Milk (Noni)',          'Turbubo-style fermented milk with noni.',             'l',     300000,  16, false, 4.10,  6),

  -- Sanni Farms — cabbage and leafy greens out of Epe
  ('cabbage-head',  'yahaya', 'vegetables', 'Cabbage (Whole Head)',           'One firm head, outer leaves trimmed off.',                'pack',   350000, 24, false, 4.75, 31),
  ('cabbage-half',  'yahaya', 'vegetables', 'Cabbage (Cut Half)',             'Half a head for a small kitchen.',                        'pack',   180000, 30, false, 4.45, 17),
  ('greens-basket', 'yahaya', 'vegetables', 'Cabbage and Greens Basket',      'Two heads with spring onion and scent leaf tied in.',     'basket', 750000, 10, true,  4.85, 12)
) as p (key, stall, cat_slug, name, blurb, unit, price, qty, organic, ravg, rcount)
join categories c on c.slug = p.cat_slug
on conflict (id) do nothing;

-- Stock for the week the seed is applied in, so the "n left" badge is meaningful on a
-- fresh deploy without a scheduler. The reset endpoint in spec 4.7 copies template_qty
-- forward for later weeks.
insert into weekly_stock (product_id, week, quantity_available, is_sold_out)
select id, iso_week(current_date),
       -- Two lines are shown part-sold so the low-stock badge has something to catch.
       case when name in ('Efo Shoko', 'Mango') then greatest(template_qty / 4, 1)
            else template_qty end,
       false
from products
on conflict (product_id, week) do nothing;

-- One sold-out line exercises the manual override the product card reads.
update weekly_stock
   set is_sold_out = true
 where week = iso_week(current_date)
   and product_id = md5('ml-product-basket-organic')::uuid;

-- ---------------------------------------------------------------- corrections
-- The insert above is `do nothing`, so a database seeded while this stall was still selling dairy
-- keeps those rows next to the new ones. Retire them; weekly_stock cascades away with each product.

delete from products
 where id in (
   md5('ml-product-eggs-tray')::uuid,
   md5('ml-product-eggs-half')::uuid,
   md5('ml-product-cream-line')::uuid
 );

-- Only assign a photo where the local asset visibly matches the listing. Leave the rest empty
-- so the client can use its category artwork instead of showing a misleading picture.
update products
   set image_urls = case id
     -- No close-up ugu image is available; the client uses its matching leaf glyph.
     when md5('ml-product-ugu-500')::uuid then '{}'::text[]
     -- No close-up tatashe image is bundled; never use a mixed basket as a pepper photo.
     when md5('ml-product-tatashe-crate')::uuid then '{}'::text[]
     when md5('ml-product-yam-tuber')::uuid then array['/img/products/tatashe.jpg']::text[]
   end
 where id in (
   md5('ml-product-ugu-500')::uuid,
   md5('ml-product-tatashe-crate')::uuid,
   md5('ml-product-yam-tuber')::uuid
 )
   and (cardinality(image_urls) = 0 or id = md5('ml-product-tatashe-crate')::uuid
        and image_urls @> array['/img/products/ugu.jpg']::text[]);
