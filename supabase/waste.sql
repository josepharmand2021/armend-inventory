-- ARMEND — waste logging.
-- Run once in Supabase SQL Editor after schema.sql. Safe to re-run.
--
-- Adds a `reason` category to ledger entries and a record_waste RPC used by
-- the "Catat Waste" form in Stok Harian. Waste is a MANUAL_OUT with a reason
-- (Tumpah / Rusak / Kadaluarsa / Staff / Komplain / Lain-lain), so the Waste
-- report can group by cause.

alter table public.ledger_entries add column if not exists reason text;

create or replace function public.record_waste(
  p_date date,
  p_item_id text,
  p_qty numeric,
  p_reason text,
  p_note text,
  p_by_name text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item record;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty harus lebih dari 0'; end if;

  select id, name, unit into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Item tidak ditemukan'; end if;

  update public.items set stock = stock - p_qty, updated_at = now() where id = p_item_id;

  insert into public.ledger_entries(
    entry_date, entry_time, type, item_id, item_name, qty, unit, note, reason, created_by, by_name)
  values (
    p_date, to_char(now(),'HH24:MI'), 'MANUAL_OUT', p_item_id, v_item.name,
    p_qty, v_item.unit, coalesce(p_note,''), nullif(trim(p_reason), ''), v_uid, p_by_name);
end;
$$;
