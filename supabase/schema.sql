-- ARMEND — Supabase schema (multi-outlet).
-- Run once in the Supabase SQL Editor on a fresh project, then run seed.sql.
--
-- Structure: outlets(kind='group') -> areas(kind='area'). Every data row
-- belongs to ONE area (fully separate catalog per area).
--
-- Access model:
--   profiles.role = 'admin'   -> OWNER: full access to everything
--   outlet_members on a GROUP -> access to all areas in that group
--   outlet_members on an AREA -> access to just that area
--   role 'admin' = manage master data + members ; 'staff' = daily ops
--
-- After running this + seed.sql, finish setup (see SETUP.md):
--   1. Authentication -> Users -> add yourself (Auto Confirm)
--   2. update public.profiles set role='admin' where email='you@example.com';
--   3. the seed puts its data in area 'main-area' (group 'main') — rename them:
--      update public.outlets set name='HARA' where id='main';
--      update public.outlets set name='Bar Stock' where id='main-area';

-- ============================================================
-- OUTLETS (groups) + AREAS + MEMBERSHIP
-- ============================================================
create table public.outlets (
  id text primary key,
  name text not null,
  parent_id text references public.outlets(id) on delete cascade,
  kind text not null default 'area' check (kind in ('group','area')),
  area_type text,                     -- bar | kitchen | bakery | service | store | null
  active boolean not null default true,
  order_idx integer not null default 0,
  created_at timestamptz not null default now()
);
insert into public.outlets (id, name, kind, order_idx) values ('main', 'Outlet Utama', 'group', 0);
insert into public.outlets (id, name, parent_id, kind, order_idx) values ('main-area', 'Stok Utama', 'main', 'area', 0);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'Staff',
  role text not null default 'staff' check (role in ('admin','staff')),  -- 'admin' = global owner
  created_at timestamptz not null default now()
);

create table public.outlet_members (
  outlet_id text not null references public.outlets(id) on delete cascade,   -- a group OR an area
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now(),
  primary key (outlet_id, user_id)
);
create index outlet_members_user_idx on public.outlet_members(user_id);

-- ============================================================
-- DATA TABLES (every row belongs to an outlet)
-- ============================================================
create table public.items (
  id text primary key,                       -- app generates '<area>-<slug>'
  outlet_id text not null references public.outlets(id) on delete cascade,  -- an AREA id
  name text not null,
  category text not null,
  unit text not null,
  item_type text not null default 'RAW' check (item_type in ('RAW','PREP')),
  stock_tracking boolean not null default true,
  control_tight boolean not null default true,   -- false = loose (mint, garnish, ice)
  stock numeric not null default 0,
  min_stock numeric not null default 0,          -- par level
  cost_per_unit numeric not null default 0,
  needs_order boolean not null default false,
  order_idx integer not null default 0,
  updated_at timestamptz not null default now()
);
create index items_outlet_idx on public.items(outlet_id);

create table public.menu (
  id text primary key,
  outlet_id text not null references public.outlets(id) on delete cascade,
  name text not null,
  category text not null,
  active boolean not null default true,
  order_idx integer not null default 0
);
create index menu_outlet_idx on public.menu(outlet_id);

create table public.recipe_ingredients (
  id bigserial primary key,
  outlet_id text not null references public.outlets(id) on delete cascade,
  menu_id text not null references public.menu(id) on delete cascade,
  item_id text not null references public.items(id) on delete restrict,
  qty numeric not null,
  unit text not null
);
create index recipe_ingredients_menu_idx on public.recipe_ingredients(menu_id);

create table public.prep_recipes (
  item_id text primary key references public.items(id) on delete cascade,
  outlet_id text not null references public.outlets(id) on delete cascade,
  yield_qty numeric not null,
  yield_unit text not null
);

create table public.prep_components (
  id bigserial primary key,
  outlet_id text not null references public.outlets(id) on delete cascade,
  prep_item_id text not null references public.prep_recipes(item_id) on delete cascade,
  item_id text not null references public.items(id) on delete restrict,
  qty numeric not null,
  unit text not null
);
create index prep_components_prep_idx on public.prep_components(prep_item_id);

create table public.ledger_entries (
  id bigserial primary key,
  outlet_id text not null references public.outlets(id) on delete cascade,
  entry_date date not null,
  entry_time text not null,
  type text not null check (type in ('IN','MANUAL_OUT','AUTO_OUT','ADJUSTMENT')),
  item_id text not null references public.items(id),
  item_name text not null,
  qty numeric not null,
  unit text not null,
  note text default '',
  reason text,                               -- waste category, when type = MANUAL_OUT
  created_by uuid references public.profiles(id),
  by_name text not null,
  created_at timestamptz not null default now()
);
create index ledger_entries_outlet_date_idx on public.ledger_entries(outlet_id, entry_date);

create table public.menu_count_days (
  outlet_id text not null references public.outlets(id) on delete cascade,
  entry_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  primary key (outlet_id, entry_date)
);

create table public.menu_count_lines (
  outlet_id text not null,
  entry_date date not null,
  menu_id text not null references public.menu(id),
  qty numeric not null default 0,
  submitted_qty numeric not null default 0,
  primary key (outlet_id, entry_date, menu_id),
  foreign key (outlet_id, entry_date) references public.menu_count_days(outlet_id, entry_date) on delete cascade
);

create table public.month_end_sessions (
  outlet_id text not null references public.outlets(id) on delete cascade,
  entry_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED')),
  applied_to_stock boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  primary key (outlet_id, entry_date)
);

create table public.month_end_items (
  id bigserial primary key,
  outlet_id text not null,
  entry_date date not null,
  item_id text not null references public.items(id),
  item_name text not null,
  category text not null,
  unit text not null,
  system_ending numeric not null,
  physical_ending numeric,
  foreign key (outlet_id, entry_date) references public.month_end_sessions(outlet_id, entry_date) on delete cascade
);
create index month_end_items_outlet_date_idx on public.month_end_items(outlet_id, entry_date);

-- ============================================================
-- NEW USER -> PROFILE TRIGGER (no outlet yet — an admin adds them)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'staff');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- ============================================================
-- ACCESS HELPERS
-- ============================================================
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- an area is reachable via a direct grant OR a grant on its parent group
create or replace function public.outlet_role(p_outlet text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_owner() then 'admin'
    when exists (
      select 1 from public.outlet_members m
      where m.user_id = auth.uid() and m.role = 'admin'
        and (m.outlet_id = p_outlet
             or m.outlet_id = (select parent_id from public.outlets where id = p_outlet))
    ) then 'admin'
    when exists (
      select 1 from public.outlet_members m
      where m.user_id = auth.uid()
        and (m.outlet_id = p_outlet
             or m.outlet_id = (select parent_id from public.outlets where id = p_outlet))
    ) then 'staff'
    else null
  end;
$$;

create or replace function public.can_access_outlet(p_outlet text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.outlet_role(p_outlet) is not null;
$$;

create or replace function public.is_outlet_admin(p_outlet text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.outlet_role(p_outlet) = 'admin';
$$;

-- can this user SEE this outlets row? (own it, own its parent, or own a child)
-- security definer so the inner reads of public.outlets don't re-trigger RLS
create or replace function public.can_see_outlet(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_outlet(p_id)
    or public.can_access_outlet(coalesce((select parent_id from public.outlets where id = p_id), ''))
    or exists (select 1 from public.outlets c where c.parent_id = p_id and public.can_access_outlet(c.id));
$$;

-- ============================================================
-- GUARD TRIGGERS
-- ============================================================
-- only a global owner may set profiles.role (the owner flag)
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_owner() then
    raise exception 'Hanya owner yang boleh mengubah role global';
  end if;
  return new;
end;
$$;
create trigger trg_prevent_role_escalation
  before update on public.profiles for each row execute procedure public.prevent_role_escalation();

-- only an outlet admin (or owner) may change that outlet's membership
create or replace function public.prevent_member_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_owner()
     and not public.is_outlet_admin(coalesce(new.outlet_id, old.outlet_id)) then
    raise exception 'Hanya admin outlet atau owner yang boleh mengubah keanggotaan';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_prevent_member_escalation
  before insert or update or delete on public.outlet_members
  for each row execute procedure public.prevent_member_escalation();

-- item master fields are outlet-admin only; stock / needs_order stay open to staff
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
       or new.outlet_id is distinct from old.outlet_id then
      raise exception 'Hanya admin outlet yang boleh mengubah data master item';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_restrict_item_master
  before update on public.items for each row execute procedure public.restrict_item_master_fields();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.outlets           enable row level security;
alter table public.outlet_members    enable row level security;
alter table public.items             enable row level security;
alter table public.menu              enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.prep_recipes      enable row level security;
alter table public.prep_components   enable row level security;
alter table public.ledger_entries    enable row level security;
alter table public.menu_count_days   enable row level security;
alter table public.menu_count_lines  enable row level security;
alter table public.month_end_sessions enable row level security;
alter table public.month_end_items   enable row level security;

-- profiles: readable by any authenticated user (name/email lookups); self can
-- edit own row; owner can edit anyone
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_owner on public.profiles for update to authenticated
  using (public.is_owner()) with check (true);

-- outlets: see a row if you can reach it, its parent, or any of its children
create policy outlets_select on public.outlets for select to authenticated
  using (public.can_see_outlet(id));
create policy outlets_write_owner on public.outlets for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- outlet_members
create policy om_select on public.outlet_members for select to authenticated
  using (public.is_owner() or user_id = auth.uid() or public.is_outlet_admin(outlet_id));
create policy om_write on public.outlet_members for all to authenticated
  using (public.is_owner() or public.is_outlet_admin(outlet_id))
  with check (public.is_owner() or public.is_outlet_admin(outlet_id));

-- items
create policy items_select on public.items for select to authenticated using (public.can_access_outlet(outlet_id));
create policy items_update on public.items for update to authenticated using (public.can_access_outlet(outlet_id)) with check (public.can_access_outlet(outlet_id));
create policy items_insert on public.items for insert to authenticated with check (public.is_outlet_admin(outlet_id));
create policy items_delete on public.items for delete to authenticated using (public.is_outlet_admin(outlet_id));

-- menu + recipes + prep (master data — outlet admin writes)
create policy menu_select on public.menu for select to authenticated using (public.can_access_outlet(outlet_id));
create policy menu_write  on public.menu for all to authenticated using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));
create policy ri_select on public.recipe_ingredients for select to authenticated using (public.can_access_outlet(outlet_id));
create policy ri_write  on public.recipe_ingredients for all to authenticated using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));
create policy pr_select on public.prep_recipes for select to authenticated using (public.can_access_outlet(outlet_id));
create policy pr_write  on public.prep_recipes for all to authenticated using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));
create policy pc_select on public.prep_components for select to authenticated using (public.can_access_outlet(outlet_id));
create policy pc_write  on public.prep_components for all to authenticated using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));

-- ledger: append-only audit trail; corrections/deletes by outlet admin
create policy ledger_select on public.ledger_entries for select to authenticated using (public.can_access_outlet(outlet_id));
create policy ledger_insert on public.ledger_entries for insert to authenticated with check (public.can_access_outlet(outlet_id));
create policy ledger_update on public.ledger_entries for update to authenticated using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));
create policy ledger_delete on public.ledger_entries for delete to authenticated using (public.is_outlet_admin(outlet_id));

-- counts + opname: full CRUD by any member of the outlet
create policy mcd_all on public.menu_count_days    for all to authenticated using (public.can_access_outlet(outlet_id)) with check (public.can_access_outlet(outlet_id));
create policy mcl_all on public.menu_count_lines   for all to authenticated using (public.can_access_outlet(outlet_id)) with check (public.can_access_outlet(outlet_id));
create policy mes_all on public.month_end_sessions for all to authenticated using (public.can_access_outlet(outlet_id)) with check (public.can_access_outlet(outlet_id));
create policy mei_all on public.month_end_items    for all to authenticated using (public.can_access_outlet(outlet_id)) with check (public.can_access_outlet(outlet_id));

-- ============================================================
-- ATOMIC OPERATIONS (RPC) — every one is scoped to p_outlet
-- ============================================================
create or replace function public.apply_stock_move(
  p_outlet text, p_date date, p_item_id text, p_type text, p_qty numeric, p_note text, p_by_name text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_item record; v_delta numeric;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if not public.can_access_outlet(p_outlet) then raise exception 'Tidak punya akses ke outlet ini'; end if;
  if p_type not in ('IN','MANUAL_OUT') then raise exception 'Tipe tidak valid'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty harus lebih dari 0'; end if;

  select id, name, unit into v_item from public.items where id = p_item_id and outlet_id = p_outlet for update;
  if not found then raise exception 'Item tidak ditemukan'; end if;

  v_delta := case when p_type = 'IN' then p_qty else -p_qty end;
  update public.items set stock = stock + v_delta, updated_at = now() where id = p_item_id;

  insert into public.ledger_entries(outlet_id, entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
  values (p_outlet, p_date, to_char(now(),'HH24:MI'), p_type, p_item_id, v_item.name, p_qty, v_item.unit, coalesce(p_note,''), v_uid, p_by_name);
end;
$$;

-- makes the "Masuk"/"Manual Out" cell in Stok Harian authoritative for the day
create or replace function public.set_daily_move(
  p_outlet text, p_date date, p_item_id text, p_type text, p_qty numeric, p_note text, p_by_name text
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_item record; v_old numeric := 0; v_delta numeric;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if not public.can_access_outlet(p_outlet) then raise exception 'Tidak punya akses ke outlet ini'; end if;
  if p_type not in ('IN','MANUAL_OUT') then raise exception 'Tipe harus IN atau MANUAL_OUT'; end if;
  if p_qty is null or p_qty < 0 then raise exception 'Qty tidak boleh negatif'; end if;

  select id, name, unit into v_item from public.items where id = p_item_id and outlet_id = p_outlet for update;
  if not found then raise exception 'Item tidak ditemukan'; end if;

  select coalesce(sum(qty),0) into v_old from public.ledger_entries
    where outlet_id = p_outlet and entry_date = p_date and item_id = p_item_id and type = p_type;
  delete from public.ledger_entries
    where outlet_id = p_outlet and entry_date = p_date and item_id = p_item_id and type = p_type;

  if p_qty > 0 then
    insert into public.ledger_entries(outlet_id, entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
    values (p_outlet, p_date, to_char(now(),'HH24:MI'), p_type, p_item_id, v_item.name, p_qty, v_item.unit, coalesce(p_note,''), v_uid, p_by_name);
  end if;

  v_delta := case when p_type = 'IN' then (p_qty - v_old) else (v_old - p_qty) end;
  update public.items set stock = stock + v_delta, updated_at = now() where id = p_item_id;
end;
$$;
revoke all on function public.set_daily_move(text,date,text,text,numeric,text,text) from anon;
grant execute on function public.set_daily_move(text,date,text,text,numeric,text,text) to authenticated;

-- waste = MANUAL_OUT with a reason category
create or replace function public.record_waste(
  p_outlet text, p_date date, p_item_id text, p_qty numeric, p_reason text, p_note text, p_by_name text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_item record;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if not public.can_access_outlet(p_outlet) then raise exception 'Tidak punya akses ke outlet ini'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty harus lebih dari 0'; end if;

  select id, name, unit into v_item from public.items where id = p_item_id and outlet_id = p_outlet for update;
  if not found then raise exception 'Item tidak ditemukan'; end if;

  update public.items set stock = stock - p_qty, updated_at = now() where id = p_item_id;
  insert into public.ledger_entries(outlet_id, entry_date, entry_time, type, item_id, item_name, qty, unit, note, reason, created_by, by_name)
  values (p_outlet, p_date, to_char(now(),'HH24:MI'), 'MANUAL_OUT', p_item_id, v_item.name, p_qty, v_item.unit, coalesce(p_note,''), nullif(trim(p_reason),''), v_uid, p_by_name);
end;
$$;

-- submit (or re-submit a correction to) a day's menu count for one outlet
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

  for v_pool_row in select item_id, amt from tmp_pool where abs(amt) > 0.000001
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

-- submit a stock-opname session for one outlet
create or replace function public.submit_month_end(
  p_outlet text, p_date date, p_apply_to_stock boolean, p_by_name text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row record; v_variance numeric; v_time text := to_char(now(),'HH24:MI');
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if not public.can_access_outlet(p_outlet) then raise exception 'Tidak punya akses ke outlet ini'; end if;

  if p_apply_to_stock then
    for v_row in
      select item_id, item_name, unit, system_ending, physical_ending
      from public.month_end_items
      where outlet_id = p_outlet and entry_date = p_date and physical_ending is not null
    loop
      v_variance := v_row.physical_ending - v_row.system_ending;
      if abs(v_variance) > 0.000001 then
        update public.items set stock = v_row.physical_ending, updated_at = now() where id = v_row.item_id;
        insert into public.ledger_entries(outlet_id, entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
        values (p_outlet, p_date, v_time, 'ADJUSTMENT', v_row.item_id, v_row.item_name, v_variance, v_row.unit, 'Penyesuaian hasil stock opname', v_uid, p_by_name);
      end if;
    end loop;
  end if;

  update public.month_end_sessions
    set status = 'SUBMITTED', applied_to_stock = p_apply_to_stock, submitted_by = v_uid, submitted_at = now()
    where outlet_id = p_outlet and entry_date = p_date;
end;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table
  public.outlets, public.outlet_members, public.profiles,
  public.items, public.menu, public.ledger_entries,
  public.menu_count_days, public.menu_count_lines,
  public.month_end_sessions, public.month_end_items;

-- ============================================================
-- ROLE GRANTS (needed if the public schema was reset — Supabase's
-- default-privilege setup is dropped by `drop schema public cascade`)
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
