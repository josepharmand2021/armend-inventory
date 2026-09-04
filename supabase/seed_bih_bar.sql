-- ARMEND — seed for BIH · Bar Stock (area 'bih-bar').
-- Run in the Supabase SQL Editor after migrate_multi_outlet.sql.
-- Items/menu use `on conflict (id) do nothing` (safe to re-run).
-- Recipes are wiped + reinserted for this area on each run.
--
-- control_tight follows the "Auto Out?" column: YES -> tight, NO -> loose.
-- All stock starts at 0 — set opening counts via Stock Opname or Stok Harian.

-- ============================== ITEMS ==============================
insert into public.items
  (outlet_id, id, name, category, unit, item_type, stock_tracking, control_tight, stock, needs_order, order_idx)
select 'bih-bar', v.* from (values
  ('bih-bar-hara-blend',                 'Hara Blend',                  'COFFEE & TEA',       'g',     'RAW', true, true,  0, false, 0),
  ('bih-bar-black-oolong',               'Black Oolong',                'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 1),
  ('bih-bar-milky-oolong',               'Milky Oolong',                'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 2),
  ('bih-bar-deep-roast-oolong',          'Deep Roast Oolong',           'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 3),
  ('bih-bar-green-tea',                  'Green Tea',                   'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 4),
  ('bih-bar-black-tea',                  'Black Tea',                   'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 5),
  ('bih-bar-rose-tea',                   'Rose Tea',                    'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 6),
  ('bih-bar-jasmine',                    'Jasmine',                     'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 7),
  ('bih-bar-osmanthus-tea',              'Osmanthus Tea',              'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 8),
  ('bih-bar-peppermint',                 'Peppermint',                  'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 9),
  ('bih-bar-lemongrass',                 'Lemongrass',                  'COFFEE & TEA',       'g',     'RAW', true, false, 0, false, 10),
  ('bih-bar-brown-sugar',               'Brown Sugar',                 'DRY GOODS',          'g',     'RAW', true, true,  0, false, 11),
  ('bih-bar-matcha-powder',             'Matcha Powder',               'DRY GOODS',          'g',     'RAW', true, true,  0, false, 12),
  ('bih-bar-cocoa-powder',              'Cocoa Powder',                'DRY GOODS',          'g',     'RAW', true, true,  0, false, 13),
  ('bih-bar-gula',                       'Gula',                        'DRY GOODS',          'g',     'RAW', true, false, 0, false, 14),
  ('bih-bar-sea-salt',                  'Sea Salt',                    'DRY GOODS',          'g',     'RAW', true, true,  0, false, 15),
  ('bih-bar-crushed-pistachio',         'Crushed Pistachio',           'FRUIT & TOPPING',    'g',     'RAW', true, false, 0, false, 16),
  ('bih-bar-garnish-rose-petals',       'Garnish Rose Petals',         'FRUIT & TOPPING',    'pcs',   'RAW', true, false, 0, false, 17),
  ('bih-bar-daun-mint',                 'Daun Mint',                   'FRUIT & TOPPING',    'g',     'RAW', true, false, 0, false, 18),
  ('bih-bar-lemon',                      'Lemon',                       'FRUIT & TOPPING',    'g',     'RAW', true, false, 0, false, 19),
  ('bih-bar-nutrijell-coffee-jelly',    'Nutrijell Coffee Jelly',      'FRUIT & TOPPING',    'pcs',   'RAW', true, false, 0, false, 20),
  ('bih-bar-lychee-can',                'Lychee Can',                  'FRUIT & TOPPING',    'pcs',   'RAW', true, false, 0, false, 21),
  ('bih-bar-ubi-ungu',                  'Ubi Ungu',                    'FRUIT & TOPPING',    'g',     'RAW', true, false, 0, false, 22),
  ('bih-bar-bunga-telang',              'Bunga Telang',                'FRUIT & TOPPING',    'pack',  'RAW', true, false, 0, false, 23),
  ('bih-bar-vanilla',                    'Vanilla',                     'FRUIT & TOPPING',    'g',     'RAW', true, true,  0, false, 24),
  ('bih-bar-fresh-milk',                'Fresh Milk',                  'MILK & CREAM',       'ml',    'RAW', true, true,  0, false, 25),
  ('bih-bar-oatside-milk-barista-blend','Oatside Milk Barista Blend',  'MILK & CREAM',       'ml',    'RAW', true, true,  0, false, 26),
  ('bih-bar-millac',                     'Millac',                     'MILK & CREAM',       'ml',    'RAW', true, true,  0, false, 27),
  ('bih-bar-uht-milk',                  'UHT Milk',                    'MILK & CREAM',       'ml',    'RAW', true, true,  0, false, 28),
  ('bih-bar-ice-cream-diamond',         'Ice Cream Diamond',           'MILK & CREAM',       'g',     'RAW', true, false, 0, false, 29),
  ('bih-bar-skm',                        'SKM',                         'MILK & CREAM',       'g',     'RAW', true, true,  0, false, 30),
  ('bih-bar-cup-takeaway-iced',         'Cup Takeaway (ICED)',         'PACKAGING',          'pcs',   'RAW', true, false, 0, false, 31),
  ('bih-bar-cup-takeaway-hot',          'Cup Takeaway (HOT)',          'PACKAGING',          'pcs',   'RAW', true, false, 0, false, 32),
  ('bih-bar-straw',                      'Straw',                      'PACKAGING',          'pack',  'RAW', true, false, 0, false, 33),
  ('bih-bar-galon-air',                 'Galon Air',                   'PACKAGING',          'galon', 'RAW', true, false, 0, false, 34),
  ('bih-bar-pistachio-syrup',           'Pistachio Syrup',             'SYRUP & SWEETENER',  'ml',    'RAW', true, true,  0, false, 35),
  ('bih-bar-hazelnut-syrup',            'Hazelnut Syrup',              'SYRUP & SWEETENER',  'ml',    'RAW', true, true,  0, false, 36),
  ('bih-bar-lychee-syrup',              'Lychee Syrup',                'SYRUP & SWEETENER',  'ml',    'RAW', true, true,  0, false, 37),
  ('bih-bar-rose-syrup',                'Rose Syrup',                  'SYRUP & SWEETENER',  'ml',    'RAW', true, true,  0, false, 38),
  ('bih-bar-santen',                     'Santen',                     'SYRUP & SWEETENER',  'pack',  'RAW', true, true,  0, false, 39)
) v (id, name, category, unit, item_type, stock_tracking, control_tight, stock, needs_order, order_idx)
on conflict (id) do nothing;

-- ============================== MENU ==============================
insert into public.menu (outlet_id, id, name, category, active, order_idx)
select 'bih-bar', v.* from (values
  ('bih-bar-signature-latte',      'Signature Latte',        'Coffee',     true, 0),
  ('bih-bar-iced-white',           'Iced White',             'Coffee',     true, 1),
  ('bih-bar-hot-white',            'Hot White',              'Coffee',     true, 2),
  ('bih-bar-iced-black',           'Iced Black',             'Coffee',     true, 3),
  ('bih-bar-hot-black',            'Hot Black',              'Coffee',     true, 4),
  ('bih-bar-pistachio-cold-foam',  'Pistachio Cold Foam',    'Coffee',     true, 5),
  ('bih-bar-nutty-oat-latte',      'Nutty Oat Latte',        'Coffee',     true, 6),
  ('bih-bar-seasalt-silken-latte', 'Seasalt Silken Latte',   'Coffee',     true, 7),
  ('bih-bar-blue-latte',           'Blue Latte',             'Coffee',     true, 8),
  ('bih-bar-oolong-lychee-rose-tea','Oolong Lychee Rose Tea','Non-Coffee', true, 9),
  ('bih-bar-coffee-jelly-float',   'Coffee Jelly Float',     'Non-Coffee', true, 10),
  ('bih-bar-matcha-latte',         'Matcha Latte',           'Non-Coffee', true, 11),
  ('bih-bar-chocolate-latte-iced', 'Chocolate Latte Iced',   'Non-Coffee', true, 12),
  ('bih-bar-signature-lemonade',   'Signature Lemonade',     'Non-Coffee', true, 13),
  ('bih-bar-murasaki-imo-matcha',  'Murasaki Imo Matcha',    'Non-Coffee', true, 14),
  ('bih-bar-artisan-tea-1-flavor', 'Artisan Tea (1 Flavor)', 'Non-Coffee', true, 15),
  ('bih-bar-artisan-tea-2-flavor', 'Artisan Tea (2 Flavor)', 'Non-Coffee', true, 16)
) v (id, name, category, active, order_idx)
on conflict (id) do nothing;

-- ============================== RECIPES ==============================
delete from public.recipe_ingredients where outlet_id = 'bih-bar';

insert into public.recipe_ingredients (outlet_id, menu_id, item_id, qty, unit)
select 'bih-bar', v.* from (values
  ('bih-bar-signature-latte',      'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-signature-latte',      'bih-bar-fresh-milk',                 80,  'ml'),
  ('bih-bar-signature-latte',      'bih-bar-oatside-milk-barista-blend', 60,  'ml'),
  ('bih-bar-signature-latte',      'bih-bar-millac',                     30,  'ml'),
  ('bih-bar-signature-latte',      'bih-bar-brown-sugar',                20,  'g'),
  ('bih-bar-iced-white',           'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-iced-white',           'bih-bar-fresh-milk',                 200, 'ml'),
  ('bih-bar-hot-white',            'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-hot-white',            'bih-bar-fresh-milk',                 180, 'ml'),
  ('bih-bar-iced-black',           'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-hot-black',            'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-pistachio-cold-foam',  'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-pistachio-cold-foam',  'bih-bar-fresh-milk',                 10,  'ml'),
  ('bih-bar-pistachio-cold-foam',  'bih-bar-millac',                     15,  'ml'),
  ('bih-bar-pistachio-cold-foam',  'bih-bar-sea-salt',                   0.6, 'g'),
  ('bih-bar-pistachio-cold-foam',  'bih-bar-skm',                        5,   'g'),
  ('bih-bar-pistachio-cold-foam',  'bih-bar-pistachio-syrup',            15,  'ml'),
  ('bih-bar-nutty-oat-latte',      'bih-bar-oatside-milk-barista-blend', 100, 'ml'),
  ('bih-bar-nutty-oat-latte',      'bih-bar-millac',                     20,  'ml'),
  ('bih-bar-nutty-oat-latte',      'bih-bar-hazelnut-syrup',             20,  'ml'),
  ('bih-bar-nutty-oat-latte',      'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-fresh-milk',                 47,  'ml'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-oatside-milk-barista-blend', 33,  'ml'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-millac',                     20,  'ml'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-fresh-milk',                 10,  'ml'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-millac',                     15,  'ml'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-sea-salt',                   0.6, 'g'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-skm',                        5,   'g'),
  ('bih-bar-seasalt-silken-latte', 'bih-bar-brown-sugar',                20,  'g'),
  ('bih-bar-oolong-lychee-rose-tea','bih-bar-lychee-syrup',              20,  'ml'),
  ('bih-bar-oolong-lychee-rose-tea','bih-bar-rose-syrup',                15,  'ml'),
  ('bih-bar-coffee-jelly-float',   'bih-bar-fresh-milk',                 140, 'ml'),
  ('bih-bar-coffee-jelly-float',   'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-matcha-latte',         'bih-bar-matcha-powder',              4,   'g'),
  ('bih-bar-matcha-latte',         'bih-bar-fresh-milk',                 47,  'ml'),
  ('bih-bar-matcha-latte',         'bih-bar-oatside-milk-barista-blend', 33,  'ml'),
  ('bih-bar-matcha-latte',         'bih-bar-millac',                     20,  'ml'),
  ('bih-bar-chocolate-latte-iced', 'bih-bar-cocoa-powder',               15,  'g'),
  ('bih-bar-chocolate-latte-iced', 'bih-bar-fresh-milk',                 200, 'ml'),
  ('bih-bar-chocolate-latte-iced', 'bih-bar-millac',                     15,  'ml'),
  ('bih-bar-chocolate-latte-iced', 'bih-bar-sea-salt',                   0.6, 'g'),
  ('bih-bar-chocolate-latte-iced', 'bih-bar-skm',                        5,   'g'),
  ('bih-bar-chocolate-latte-iced', 'bih-bar-fresh-milk',                 150, 'ml'),
  ('bih-bar-blue-latte',           'bih-bar-millac',                     20,  'ml'),
  ('bih-bar-blue-latte',           'bih-bar-hara-blend',                 20,  'g'),
  ('bih-bar-blue-latte',           'bih-bar-fresh-milk',                 100, 'ml'),
  ('bih-bar-blue-latte',           'bih-bar-fresh-milk',                 10,  'ml'),
  ('bih-bar-blue-latte',           'bih-bar-millac',                     15,  'ml'),
  ('bih-bar-blue-latte',           'bih-bar-sea-salt',                   0.6, 'g'),
  ('bih-bar-blue-latte',           'bih-bar-skm',                        5,   'g'),
  ('bih-bar-blue-latte',           'bih-bar-vanilla',                    30,  'g'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-matcha-powder',              3.5, 'g'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-fresh-milk',                 10,  'ml'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-millac',                     15,  'ml'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-sea-salt',                   0.1, 'g'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-skm',                        5,   'g'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-sea-salt',                   0.5, 'g'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-fresh-milk',                 33,  'ml'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-oatside-milk-barista-blend', 23,  'ml'),
  ('bih-bar-murasaki-imo-matcha',  'bih-bar-millac',                     14,  'ml')
) v (menu_id, item_id, qty, unit);
