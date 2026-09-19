-- ARMEND — archive items (hide from daily ops without deleting history).
--   items.active = false -> hidden from Stok Harian, dashboard alerts, opname
--   snapshots, and the recipe-item picker. Still exists for ledger/recipe history.
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.items add column if not exists active boolean not null default true;

-- keep it admin-only alongside the rest of the item master
create or replace function public.restrict_item_master_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_outlet_admin(new.outlet_id) then
    if new.name is distinct from old.name
       or new.category is distinct from old.category
       or new.unit is distinct from old.unit
       or new.item_type is distinct from old.item_type
       or new.stock_tracking is distinct from old.stock_tracking
       or new.order_idx is distinct from old.order_idx
       or new.min_stock is distinct from old.min_stock
       or new.cost_per_unit is distinct from old.cost_per_unit
       or new.control_tight is distinct from old.control_tight
       or new.outlet_id is distinct from old.outlet_id
       or new.purchase_unit is distinct from old.purchase_unit
       or new.pack_size is distinct from old.pack_size
       or new.purchase_cost is distinct from old.purchase_cost
       or new.loss_pct is distinct from old.loss_pct
       or new.hpp_only is distinct from old.hpp_only
       or new.active is distinct from old.active then
      raise exception 'Hanya admin outlet yang boleh mengubah data master item';
    end if;
  end if;
  return new;
end;
$$;
