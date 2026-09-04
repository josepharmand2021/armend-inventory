-- ARMEND — "HPP saja" items.
--   items.hpp_only = true  → dihitung ke HPP menu (lewat resep), TAPI stok tidak
--   dipotong otomatis saat hitung menu (tidak ada AUTO_OUT). Cocok untuk es batu,
--   gula, dsb. yang susah ditakar — stoknya dikelola manual / lewat opname.
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.items add column if not exists hpp_only boolean not null default false;

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
       or new.hpp_only is distinct from old.hpp_only then
      raise exception 'Hanya admin outlet yang boleh mengubah data master item';
    end if;
  end if;
  return new;
end;
$$;

-- submit (or re-submit a correction to) a day's menu count for one outlet
--   final deduction loop now skips hpp_only items: no stock change, no ledger row
create or replace function public.submit_menu_count(
  p_outlet text, p_date date, p_quantities jsonb, p_by_name text
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_menu_id text; v_qty numeric; v_prev numeric; v_diff numeric;
  v_row record; v_pool_row record; v_ratio numeric; v_guard int := 0;
  v_time text := to_char(now(),'HH24:MI');
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if not public.can_access_outlet(p_outlet) then raise exception 'Tidak punya akses ke outlet ini'; end if;

  insert into public.menu_count_days(outlet_id, entry_date, status, updated_by, updated_at)
  values (p_outlet, p_date, 'DRAFT', v_uid, now())
  on conflict (outlet_id, entry_date) do update set updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  create temp table tmp_pool (item_id text primary key, amt numeric) on commit drop;

  for v_menu_id, v_qty in select key, value::numeric from jsonb_each_text(p_quantities)
  loop
    select coalesce(submitted_qty,0) into v_prev from public.menu_count_lines
      where outlet_id = p_outlet and entry_date = p_date and menu_id = v_menu_id;
    v_prev := coalesce(v_prev,0);
    v_diff := v_qty - v_prev;

    insert into public.menu_count_lines(outlet_id, entry_date, menu_id, qty, submitted_qty)
    values (p_outlet, p_date, v_menu_id, v_qty, v_qty)
    on conflict (outlet_id, entry_date, menu_id) do update set qty = excluded.qty, submitted_qty = excluded.submitted_qty;

    if v_diff <> 0 then
      for v_row in select item_id, qty from public.recipe_ingredients where menu_id = v_menu_id and outlet_id = p_outlet
      loop
        insert into tmp_pool(item_id, amt) values (v_row.item_id, v_row.qty * v_diff)
        on conflict (item_id) do update set amt = tmp_pool.amt + excluded.amt;
      end loop;
    end if;
  end loop;

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
    select p_outlet, p_date, v_time, 'AUTO_OUT', i.id, i.name, v_pool_row.amt, i.unit, 'Auto dari hitung menu terjual', v_uid, p_by_name
    from public.items i where i.id = v_pool_row.item_id;
  end loop;

  update public.menu_count_days
    set status = 'SUBMITTED', submitted_by = v_uid, submitted_at = now(), updated_by = v_uid, updated_at = now()
    where outlet_id = p_outlet and entry_date = p_date;
end;
$$;
