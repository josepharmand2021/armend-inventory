-- HARA Bar Control — direct daily input for the "Stok Harian" grid.
-- Run once in Supabase SQL Editor after schema.sql. Safe to re-run (create or replace).
--
-- set_daily_move makes the "Masuk" / "Manual Out" cell authoritative: p_qty
-- becomes the TOTAL of that type for that date+item. Any existing same-type
-- manual entries for that day are collapsed into a single row, and items.stock
-- is adjusted by the net change — all in one transaction.
-- AUTO_OUT (from menu counts) and ADJUSTMENT (from opname) are never touched.

create or replace function public.set_daily_move(
  p_date date,
  p_item_id text,
  p_type text,
  p_qty numeric,
  p_note text,
  p_by_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item record;
  v_old numeric := 0;
  v_delta numeric;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if p_type not in ('IN','MANUAL_OUT') then raise exception 'Tipe harus IN atau MANUAL_OUT'; end if;
  if p_qty is null or p_qty < 0 then raise exception 'Qty tidak boleh negatif'; end if;

  select id, name, unit into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Item tidak ditemukan'; end if;

  select coalesce(sum(qty), 0) into v_old
    from public.ledger_entries
    where entry_date = p_date and item_id = p_item_id and type = p_type;

  delete from public.ledger_entries
    where entry_date = p_date and item_id = p_item_id and type = p_type;

  if p_qty > 0 then
    insert into public.ledger_entries(
      entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
    values (
      p_date, to_char(now(),'HH24:MI'), p_type, p_item_id, v_item.name,
      p_qty, v_item.unit, coalesce(p_note,''), v_uid, p_by_name);
  end if;

  v_delta := case when p_type = 'IN' then (p_qty - v_old) else (v_old - p_qty) end;
  update public.items set stock = stock + v_delta, updated_at = now() where id = p_item_id;
end;
$$;

revoke all on function public.set_daily_move(date,text,text,numeric,text,text) from anon;
grant execute on function public.set_daily_move(date,text,text,numeric,text,text) to authenticated;
