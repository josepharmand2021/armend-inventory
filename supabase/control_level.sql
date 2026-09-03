-- ARMEND — per-item control level.
-- Run once in Supabase SQL Editor after schema.sql. Safe to re-run.
--
-- control_tight = false marks an item as "loose control" — cheap, hard-to-
-- portion things (mint, garnish, rims, ice). Loose items are kept out of the
-- dashboard "Perlu Perhatian" list and the "Di Bawah Par" count, because their
-- system number is expected to be soft (managed by periodic physical count,
-- not by recipe depletion).

alter table public.items add column if not exists control_tight boolean not null default true;

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
       or new.cost_per_unit is distinct from old.cost_per_unit
       or new.control_tight is distinct from old.control_tight then
      raise exception 'Hanya admin yang boleh mengubah data master item';
    end if;
  end if;
  return new;
end;
$$;
