-- ARMEND — dashboard cockpit fields.
-- Run once in Supabase SQL Editor after schema.sql. Safe to re-run.
--
-- Adds per-item par level (reorder threshold) and cost, used by the Overview
-- KPIs (Inventory Value, Below Par, Variance) and the "Needs Attention" list.
-- Both are admin-only to edit (enforced by the updated master-fields trigger).

alter table public.items add column if not exists min_stock numeric not null default 0;
alter table public.items add column if not exists cost_per_unit numeric not null default 0;

create or replace function public.restrict_item_master_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.name is distinct from old.name
       or new.category is distinct from old.category
       or new.unit is distinct from old.unit
       or new.item_type is distinct from old.item_type
       or new.stock_tracking is distinct from old.stock_tracking
       or new.order_idx is distinct from old.order_idx
       or new.min_stock is distinct from old.min_stock
       or new.cost_per_unit is distinct from old.cost_per_unit then
      raise exception 'Hanya admin yang boleh mengubah data master item';
    end if;
  end if;
  return new;
end;
$$;
