-- ARMEND - DUMMY DATA: BIH Bakery Stock (Original Salt Bread)
-- Buat nyoba fitur Catat Produksi end-to-end. Harga & stok di bawah cuma contoh,
-- ganti sesuai kondisi asli kapan pun lewat Master Data.
-- Jalankan setelah production.sql (butuh purchase_unit.sql + hpp_only.sql juga).

-- 1) area Bakery Stock di bawah grup BIH
insert into public.outlets (id, name, parent_id, kind, area_type, order_idx)
select 'bih-bakery', 'Bakery Stock', o.id, 'area', 'bakery', 0
from public.outlets o where o.name = 'BIH' and o.kind = 'group'
on conflict (id) do nothing;

-- 2) bahan mentah (RAW), stok awal cukup buat ~3 batch
insert into public.items (id, outlet_id, name, category, unit, item_type, stock, stock_tracking, purchase_unit, pack_size, purchase_cost, cost_per_unit) values
  ('bih-bakery-tepung-terigu-protein-tinggi', 'bih-bakery', 'Tepung Terigu Protein Tinggi', 'BAKERY - BAHAN', 'gr', 'RAW', 3000, true, 'kg', 1000, 14000, 14.0),
  ('bih-bakery-gula-pasir', 'bih-bakery', 'Gula Pasir', 'BAKERY - BAHAN', 'gr', 'RAW', 500, true, 'kg', 1000, 16000, 16.0),
  ('bih-bakery-garam-halus', 'bih-bakery', 'Garam Halus', 'BAKERY - BAHAN', 'gr', 'RAW', 200, true, 'kg', 1000, 8000, 8.0),
  ('bih-bakery-ragi-instan', 'bih-bakery', 'Ragi Instan', 'BAKERY - BAHAN', 'gr', 'RAW', 100, true, 'pack', 500, 65000, 130.0),
  ('bih-bakery-susu-cair', 'bih-bakery', 'Susu Cair', 'BAKERY - BAHAN', 'ml', 'RAW', 2000, true, 'ltr', 1000, 22000, 22.0),
  ('bih-bakery-mentega', 'bih-bakery', 'Mentega', 'BAKERY - BAHAN', 'gr', 'RAW', 1000, true, 'kg', 1000, 85000, 85.0),
  ('bih-bakery-telur', 'bih-bakery', 'Telur', 'BAKERY - BAHAN', 'gr', 'RAW', 500, true, 'kg', 1000, 32000, 32.0),
  ('bih-bakery-gula-halus', 'bih-bakery', 'Gula Halus', 'BAKERY - BAHAN', 'gr', 'RAW', 300, true, 'kg', 1000, 20000, 20.0),
  ('bih-bakery-susu-bubuk', 'bih-bakery', 'Susu Bubuk', 'BAKERY - BAHAN', 'gr', 'RAW', 200, true, 'kg', 1000, 120000, 120.0),
  ('bih-bakery-garam-kristal-topping', 'bih-bakery', 'Garam Kristal (Topping)', 'BAKERY - BAHAN', 'gr', 'RAW', 200, true, 'kg', 1000, 25000, 25.0)
on conflict (id) do nothing;

-- 3) PREP antara: Butter Filling (dipakai di dalam Salt Bread, nggak pernah punya stok sendiri)
insert into public.items (id, outlet_id, name, category, unit, item_type, stock, stock_tracking) values
  ('bih-bakery-butter-filling-salt-bread', 'bih-bakery', 'Butter Filling Salt Bread', 'BAKERY - PREP', 'gr', 'PREP', 0, true)
on conflict (id) do nothing;

insert into public.prep_recipes (item_id, outlet_id, yield_qty, yield_unit) values
  ('bih-bakery-butter-filling-salt-bread', 'bih-bakery', 300, 'gr')
on conflict (item_id) do update set yield_qty = excluded.yield_qty, yield_unit = excluded.yield_unit;

delete from public.prep_components where prep_item_id = 'bih-bakery-butter-filling-salt-bread';
insert into public.prep_components (outlet_id, prep_item_id, item_id, qty, unit) values
  ('bih-bakery', 'bih-bakery-butter-filling-salt-bread', 'bih-bakery-mentega', 200, 'gr'),
  ('bih-bakery', 'bih-bakery-butter-filling-salt-bread', 'bih-bakery-gula-halus', 60, 'gr'),
  ('bih-bakery', 'bih-bakery-butter-filling-salt-bread', 'bih-bakery-susu-bubuk', 40, 'gr');

-- 4) produk jadi: Original Salt Bread — PREP dengan yield asli, 1 batch = 20 pcs
insert into public.items (id, outlet_id, name, category, unit, item_type, stock, stock_tracking) values
  ('bih-bakery-original-salt-bread', 'bih-bakery', 'Original Salt Bread', 'BAKERY', 'pcs', 'PREP', 0, true)
on conflict (id) do nothing;

insert into public.prep_recipes (item_id, outlet_id, yield_qty, yield_unit) values
  ('bih-bakery-original-salt-bread', 'bih-bakery', 20, 'pcs')
on conflict (item_id) do update set yield_qty = excluded.yield_qty, yield_unit = excluded.yield_unit;

delete from public.prep_components where prep_item_id = 'bih-bakery-original-salt-bread';
insert into public.prep_components (outlet_id, prep_item_id, item_id, qty, unit) values
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-tepung-terigu-protein-tinggi', 1000, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-gula-pasir', 100, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-garam-halus', 15, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-ragi-instan', 12, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-susu-cair', 600, 'ml'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-mentega', 80, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-telur', 100, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-butter-filling-salt-bread', 300, 'gr'),
  ('bih-bakery', 'bih-bakery-original-salt-bread', 'bih-bakery-garam-kristal-topping', 40, 'gr');

-- 5) menu untuk tampilan HPP / harga jual saja (dimatikan dari Hitung Menu Terjual --
--    stok Salt Bread dikelola lewat Catat Produksi, bukan hitung jual)
insert into public.menu (id, outlet_id, name, category, price, active, order_idx) values
  ('bih-bakery-original-salt-bread-menu', 'bih-bakery', 'Original Salt Bread', 'BAKERY', 25000, false, 0)
on conflict (id) do nothing;

delete from public.recipe_ingredients where menu_id = 'bih-bakery-original-salt-bread-menu';
insert into public.recipe_ingredients (outlet_id, menu_id, item_id, qty, unit) values
  ('bih-bakery', 'bih-bakery-original-salt-bread-menu', 'bih-bakery-original-salt-bread', 1, 'pcs');
