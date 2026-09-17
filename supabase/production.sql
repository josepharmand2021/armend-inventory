-- ARMEND — Catat Produksi.
--   record_production(item, qty): explodes the item's PREP recipe (yield + components,
--   nested PREP handled same as submit_menu_count) and deducts the raw ingredients —
--   AND credits the produced item's own stock by qty. Lets a finished-goods item (e.g.
--   a bakery product with real yield) build up real, trackable stock: unsold stock left
--   at day's end simply carries over as tomorrow's Stok Awal (no extra step needed) —
--   for items that shouldn't carry over, log the leftover as Waste instead.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- Requires purchase_unit.sql (loss_pct) and hpp_only.sql (hpp_only) to already be applied.

create or replace function public.record_production(
  p_outlet text, p_date date, p_item_id text, p_qty numeric, p_by_name text
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row record; v_pool_row record; v_ratio numeric; v_guard int := 0;
  v_time text := to_char(now(),'HH24:MI');
  v_item_type text; v_item_name text; v_item_unit text; v_yield numeric;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if not public.can_access_outlet(p_outlet) then raise exception 'Tidak punya akses ke outlet ini'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty produksi harus lebih dari 0'; end if;

  select item_type, name, unit into v_item_type, v_item_name, v_item_unit
    from public.items where id = p_item_id and outlet_id = p_outlet;
  if v_item_type is null then raise exception 'Item tidak ditemukan di outlet ini'; end if;
  if v_item_type <> 'PREP' then raise exception 'Catat Produksi cuma untuk item bertipe PREP (yang punya resep)'; end if;

  select yield_qty into v_yield from public.prep_recipes where item_id = p_item_id;
  if v_yield is null or v_yield = 0 then
    raise exception 'Item "%" belum punya resep PREP (isi Yield & komponen di Master Data dulu)', v_item_name;
  end if;

  create temp table tmp_pool (item_id text primary key, amt numeric) on commit drop;

  v_ratio := p_qty / v_yield;
  for v_row in select item_id, qty from public.prep_components where prep_item_id = p_item_id
  loop
    insert into tmp_pool(item_id, amt) values (v_row.item_id, v_row.qty * v_ratio)
    on conflict (item_id) do update set amt = tmp_pool.amt + excluded.amt;
  end loop;

  -- nested PREP components (a base used inside another base) get exploded down to raw too
  loop
    v_guard := v_guard + 1; exit when v_guard > 500;
    select p.item_id, p.amt into v_pool_row
      from tmp_pool p join public.items i on i.id = p.item_id
      where i.item_type = 'PREP' and i.outlet_id = p_outlet limit 1;
    exit when not found;
    delete from tmp_pool where item_id = v_pool_row.item_id;
    select yield_qty into v_ratio from public.prep_recipes where item_id = v_pool_row.item_id;
    if v_ratio is null or v_ratio = 0 then v_ratio := 1; end if;
    v_ratio := v_pool_row.amt / v_ratio;
    for v_row in select item_id, qty from public.prep_components where prep_item_id = v_pool_row.item_id
    loop
      insert into tmp_pool(item_id, amt) values (v_row.item_id, v_row.qty * v_ratio)
      on conflict (item_id) do update set amt = tmp_pool.amt + excluded.amt;
    end loop;
  end loop;

  for v_pool_row in
    select p.item_id, round(p.amt * (1 + coalesce(i.loss_pct,0)/100.0), 4) as amt
    from tmp_pool p join public.items i on i.id = p.item_id
    where abs(p.amt) > 0.000001 and coalesce(i.hpp_only, false) = false
  loop
    update public.items set stock = stock - v_pool_row.amt, updated_at = now() where id = v_pool_row.item_id;
    insert into public.ledger_entries(outlet_id, entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
    select p_outlet, p_date, v_time, 'AUTO_OUT', i.id, i.name, v_pool_row.amt, i.unit,
           'Produksi ' || v_item_name, v_uid, p_by_name
    from public.items i where i.id = v_pool_row.item_id;
  end loop;

  update public.items set stock = stock + p_qty, updated_at = now() where id = p_item_id;
  insert into public.ledger_entries(outlet_id, entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
  values (p_outlet, p_date, v_time, 'IN', p_item_id, v_item_name, p_qty, v_item_unit, 'Hasil produksi', v_uid, p_by_name);
end;
$$;

grant execute on function public.record_production(text, date, text, numeric, text) to authenticated;
