-- ARMEND - seed BIH Service Stock: area + 17 item Packaging (stok fisik 16/09/2026)
-- Jalankan sekali di Supabase SQL Editor.

insert into public.outlets (id, name, parent_id, kind, area_type, order_idx)
select 'bih-service', 'Service Stock', o.id, 'area', 'service', 1
from public.outlets o where o.name = 'BIH' and o.kind = 'group'
on conflict (id) do nothing;

insert into public.items (id, outlet_id, name, category, unit, item_type, stock, stock_tracking, order_idx) values
  ('bih-service-sticker', 'bih-service', 'Sticker', 'PACKAGING', 'lembar', 'RAW', 170, true, 1),
  ('bih-service-reheat-card', 'bih-service', 'Reheat Card', 'PACKAGING', 'pack', 'RAW', 1, true, 2),
  ('bih-service-paperbag-putih', 'bih-service', 'PaperBag Putih', 'PACKAGING', 'pack', 'RAW', 3, true, 3),
  ('bih-service-paperbag-1pcs', 'bih-service', 'PaperBag 1pcs', 'PACKAGING', 'pack', 'RAW', 7, true, 4),
  ('bih-service-kertas-roti-1pcs', 'bih-service', 'Kertas Roti 1pcs', 'PACKAGING', 'pack', 'RAW', 3, true, 5),
  ('bih-service-paper-dine-in-besar', 'bih-service', 'Paper Dine In Besar', 'PACKAGING', 'pack', 'RAW', 3, true, 6),
  ('bih-service-paper-dine-in-kecil', 'bih-service', 'Paper Dine In Kecil', 'PACKAGING', 'pack', 'RAW', 3, true, 7),
  ('bih-service-kantong-plastik-30', 'bih-service', 'Kantong Plastik 30', 'PACKAGING', 'pack', 'RAW', 30, true, 8),
  ('bih-service-kantong-plastik-24', 'bih-service', 'Kantong Plastik 24', 'PACKAGING', 'pack', 'RAW', 31, true, 9),
  ('bih-service-thermal-bca', 'bih-service', 'Thermal BCA', 'PACKAGING', 'roll', 'RAW', 52, true, 10),
  ('bih-service-thermal-kasir', 'bih-service', 'Thermal Kasir', 'PACKAGING', 'roll', 'RAW', 10, true, 11),
  ('bih-service-tissue-basah', 'bih-service', 'Tissue Basah', 'PACKAGING', 'pack', 'RAW', 7, true, 12),
  ('bih-service-napkin-cocktail', 'bih-service', 'Napkin Cocktail', 'PACKAGING', 'pack', 'RAW', 27, true, 13),
  ('bih-service-cable-ties', 'bih-service', 'Cable Ties', 'PACKAGING', 'pack', 'RAW', 4, true, 14),
  ('bih-service-box-bih', 'bih-service', 'Box BIH', 'PACKAGING', 'pack', 'RAW', 6, true, 15),
  ('bih-service-box-dubai-pistachio', 'bih-service', 'Box Dubai Pistachio', 'PACKAGING', 'pcs', 'RAW', 105, true, 16),
  ('bih-service-paperbag-bih', 'bih-service', 'Paperbag BIH', 'PACKAGING', 'pcs', 'RAW', 276, true, 17)
on conflict (id) do update set stock = excluded.stock, updated_at = now();
