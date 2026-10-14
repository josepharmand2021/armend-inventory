-- ARMEND — POS API: terima hitungan menu terjual dari kasir/POS.
--   * menu.pos_code      : kode/SKU produk di POS, dipakai buat mencocokkan item POS -> menu ARMEND
--   * pos_api_keys       : API key per AREA (yang disimpan cuma hash SHA-256, key aslinya tampil sekali)
--   * pos_import_log     : jejak tiap request dari POS (payload + hasil), buat audit/debug
--   * submit_menu_count_pos(): versi submit_menu_count tanpa login user — HANYA bisa dipanggil
--     service_role (edge function pos-menu-count), tidak bisa dari browser.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- Requires purchase_unit.sql (loss_pct) and hpp_only.sql (hpp_only) already applied.

-- ---------- 1) kode POS di menu ----------
alter table public.menu add column if not exists pos_code text;
create unique index if not exists menu_pos_code_uniq
  on public.menu (outlet_id, lower(pos_code))
  where pos_code is not null and pos_code <> '';

-- ---------- 2) API keys (per area) ----------
create table if not exists public.pos_api_keys (
  id uuid primary key default gen_random_uuid(),
  outlet_id text not null references public.outlets(id) on delete cascade,   -- an AREA id
  label text not null default '',
  key_hash text not null unique,          -- sha256 hex of the raw key
  key_hint text not null default '',      -- last 4 chars, just to tell keys apart in the UI
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.pos_api_keys enable row level security;
drop policy if exists pos_keys_admin on public.pos_api_keys;
create policy pos_keys_admin on public.pos_api_keys for all to authenticated
  using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));

-- ---------- 3) log import ----------
create table if not exists public.pos_import_log (
  id bigserial primary key,
  outlet_id text not null references public.outlets(id) on delete cascade,
  key_id uuid references public.pos_api_keys(id) on delete set null,
  entry_date date,
  mode text,
  status text not null,                   -- ok | partial | rejected | error
  applied integer not null default 0,
  payload jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pos_import_log_outlet_idx on public.pos_import_log (outlet_id, created_at desc);
alter table public.pos_import_log enable row level security;
drop policy if exists pos_log_admin_read on public.pos_import_log;
create policy pos_log_admin_read on public.pos_import_log for select to authenticated
  using (public.is_outlet_admin(outlet_id));
-- (insert hanya lewat service_role di edge function — service_role bypass RLS)

-- ---------- 4) RPC khusus POS ----------
--   p_mode 'set' : p_quantities = TOTAL harian per menu (idempotent, aman di-retry / dikirim berkali-kali)
--   p_mode 'add' : p_quantities = tambahan di atas qty yang sudah tercatat hari itu
create or replace function public.submit_menu_count_pos(
  p_outlet text, p_date date, p_quantities jsonb, p_by_name text, p_mode text default 'set'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := null;
  v_menu_id text; v_qty numeric; v_prev numeric; v_diff numeric;
  v_row record; v_pool_row record; v_ratio numeric; v_guard int := 0;
  v_time text := to_char(now() at time zone 'Asia/Jakarta','HH24:MI');
begin
  if not exists (select 1 from public.outlets where id = p_outlet and kind = 'area') then
    raise exception 'Area tidak ditemukan';
  end if;
  if p_mode not in ('set','add') then raise exception 'mode harus set atau add'; end if;
  if jsonb_typeof(p_quantities) is distinct from 'object' then raise exception 'p_quantities harus object'; end if;

  insert into public.menu_count_days(outlet_id, entry_date, status, updated_by, updated_at)
  values (p_outlet, p_date, 'DRAFT', v_uid, now())
  on conflict (outlet_id, entry_date) do update set updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  create temp table tmp_pool (item_id text primary key, amt numeric) on commit drop;

  for v_menu_id, v_qty in select key, value::numeric from jsonb_each_text(p_quantities)
  loop
    if v_qty < 0 then raise exception 'qty negatif untuk menu %', v_menu_id; end if;
    if not exists (select 1 from public.menu where id = v_menu_id and outlet_id = p_outlet and active) then
      raise exception 'Menu % bukan milik area ini atau nonaktif', v_menu_id;
    end if;

    select coalesce(submitted_qty,0) into v_prev from public.menu_count_lines
      where outlet_id = p_outlet and entry_date = p_date and menu_id = v_menu_id;
    v_prev := coalesce(v_prev,0);
    if p_mode = 'add' then v_qty := v_prev + v_qty; end if;
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
    select p_outlet, p_date, v_time, 'AUTO_OUT', i.id, i.name, v_pool_row.amt, i.unit, 'Auto dari POS (hitung menu terjual)', v_uid, left(coalesce(p_by_name,'POS'), 60)
    from public.items i where i.id = v_pool_row.item_id;
  end loop;

  update public.menu_count_days
    set status = 'SUBMITTED', submitted_by = v_uid, submitted_at = now(), updated_by = v_uid, updated_at = now()
    where outlet_id = p_outlet and entry_date = p_date;
end;
$$;

-- SECURITY: fungsi ini security definer dan melewati cek akses user. Default privilege di project ini
-- otomatis ngasih execute ke authenticated/anon — cabut, sisakan service_role saja.
revoke all on function public.submit_menu_count_pos(text, date, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.submit_menu_count_pos(text, date, jsonb, text, text) to service_role;
