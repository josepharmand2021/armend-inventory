-- HARA Bar Control — Supabase schema
-- Run this once in Supabase SQL Editor (Project > SQL Editor > New query) on a fresh project.

-- ============================================================
-- TABLES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'Staff',
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create table public.items (
  id text primary key,
  name text not null,
  category text not null,
  unit text not null,
  item_type text not null default 'RAW' check (item_type in ('RAW','PREP')),
  stock_tracking boolean not null default true,
  stock numeric not null default 0,
  needs_order boolean not null default false,
  order_idx integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.menu (
  id text primary key,
  name text not null,
  category text not null,
  active boolean not null default true,
  order_idx integer not null default 0
);

create table public.recipe_ingredients (
  id bigserial primary key,
  menu_id text not null references public.menu(id) on delete cascade,
  item_id text not null references public.items(id) on delete restrict,
  qty numeric not null,
  unit text not null
);
create index recipe_ingredients_menu_idx on public.recipe_ingredients(menu_id);

create table public.prep_recipes (
  item_id text primary key references public.items(id) on delete cascade,
  yield_qty numeric not null,
  yield_unit text not null
);

create table public.prep_components (
  id bigserial primary key,
  prep_item_id text not null references public.prep_recipes(item_id) on delete cascade,
  item_id text not null references public.items(id) on delete restrict,
  qty numeric not null,
  unit text not null
);
create index prep_components_prep_idx on public.prep_components(prep_item_id);

create table public.ledger_entries (
  id bigserial primary key,
  entry_date date not null,
  entry_time text not null,
  type text not null check (type in ('IN','MANUAL_OUT','AUTO_OUT','ADJUSTMENT')),
  item_id text not null references public.items(id),
  item_name text not null,
  qty numeric not null,
  unit text not null,
  note text default '',
  created_by uuid references public.profiles(id),
  by_name text not null,
  created_at timestamptz not null default now()
);
create index ledger_entries_date_idx on public.ledger_entries(entry_date);

create table public.menu_count_days (
  entry_date date primary key,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz
);

create table public.menu_count_lines (
  entry_date date not null references public.menu_count_days(entry_date) on delete cascade,
  menu_id text not null references public.menu(id),
  qty numeric not null default 0,
  submitted_qty numeric not null default 0,
  primary key (entry_date, menu_id)
);

create table public.month_end_sessions (
  entry_date date primary key,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED')),
  applied_to_stock boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz
);

create table public.month_end_items (
  id bigserial primary key,
  entry_date date not null references public.month_end_sessions(entry_date) on delete cascade,
  item_id text not null references public.items(id),
  item_name text not null,
  category text not null,
  unit text not null,
  system_ending numeric not null,
  physical_ending numeric
);
create index month_end_items_date_idx on public.month_end_items(entry_date);

-- ============================================================
-- NEW USER -> PROFILE TRIGGER
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'staff'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- HELPERS
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Prevent a non-admin app user from granting themselves (or anyone) a new
-- role, even though they may update their own profile row (e.g. to change
-- their name). A null auth.uid() means the query is running outside the app
-- entirely (Supabase SQL Editor / service role) — that's already the
-- project owner's own trusted DB access, so it is intentionally exempt;
-- it's how you promote the very first admin (see SETUP.md).
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah role pengguna';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- Item master fields (name/category/unit/item_type/stock_tracking/order_idx) are
-- admin-only; stock and needs_order stay editable by any staff doing day-to-day ops.
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
       or new.order_idx is distinct from old.order_idx then
      raise exception 'Hanya admin yang boleh mengubah data master item';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_restrict_item_master
  before update on public.items
  for each row execute procedure public.restrict_item_master_fields();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.menu enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.prep_recipes enable row level security;
alter table public.prep_components enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.menu_count_days enable row level security;
alter table public.menu_count_lines enable row level security;
alter table public.month_end_sessions enable row level security;
alter table public.month_end_items enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (true);

-- items
create policy items_select on public.items for select to authenticated using (true);
create policy items_update on public.items for update to authenticated using (true) with check (true);
create policy items_insert_admin on public.items for insert to authenticated with check (public.is_admin());
create policy items_delete_admin on public.items for delete to authenticated using (public.is_admin());

-- menu (master data — admin only writes)
create policy menu_select on public.menu for select to authenticated using (true);
create policy menu_write_admin on public.menu for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- recipes / prep (master data — admin only writes)
create policy recipe_ing_select on public.recipe_ingredients for select to authenticated using (true);
create policy recipe_ing_write_admin on public.recipe_ingredients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy prep_recipes_select on public.prep_recipes for select to authenticated using (true);
create policy prep_recipes_write_admin on public.prep_recipes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy prep_components_select on public.prep_components for select to authenticated using (true);
create policy prep_components_write_admin on public.prep_components for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ledger — an append-only audit trail; only admin may correct/remove entries
create policy ledger_select on public.ledger_entries for select to authenticated using (true);
create policy ledger_insert on public.ledger_entries for insert to authenticated with check (true);
create policy ledger_write_admin on public.ledger_entries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ledger_delete_admin on public.ledger_entries for delete to authenticated
  using (public.is_admin());

-- menu counts — normal daily staff operation
create policy mcd_select on public.menu_count_days for select to authenticated using (true);
create policy mcd_write on public.menu_count_days for insert to authenticated with check (true);
create policy mcd_update on public.menu_count_days for update to authenticated using (true) with check (true);
create policy mcl_select on public.menu_count_lines for select to authenticated using (true);
create policy mcl_write on public.menu_count_lines for insert to authenticated with check (true);
create policy mcl_update on public.menu_count_lines for update to authenticated using (true) with check (true);

-- month end / stock opname — normal staff operation
create policy mes_select on public.month_end_sessions for select to authenticated using (true);
create policy mes_write on public.month_end_sessions for insert to authenticated with check (true);
create policy mes_update on public.month_end_sessions for update to authenticated using (true) with check (true);
create policy mei_select on public.month_end_items for select to authenticated using (true);
create policy mei_write on public.month_end_items for insert to authenticated with check (true);
create policy mei_update on public.month_end_items for update to authenticated using (true) with check (true);

-- ============================================================
-- ATOMIC OPERATIONS (RPC) — run as one DB transaction, no lost updates
-- ============================================================

-- Apply a stock in/out entry and its ledger row atomically.
create or replace function public.apply_stock_move(
  p_date date, p_item_id text, p_type text, p_qty numeric, p_note text, p_by_name text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item record;
  v_delta numeric;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  if p_type not in ('IN','MANUAL_OUT') then raise exception 'Tipe tidak valid'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty harus lebih dari 0'; end if;

  select id, name, unit into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Item tidak ditemukan'; end if;

  v_delta := case when p_type = 'IN' then p_qty else -p_qty end;
  update public.items set stock = stock + v_delta, updated_at = now() where id = p_item_id;

  insert into public.ledger_entries(entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
  values (p_date, to_char(now(), 'HH24:MI'), p_type, p_item_id, v_item.name, p_qty, v_item.unit, coalesce(p_note,''), v_uid, p_by_name);
end;
$$;

-- Submit (or re-submit a correction to) a day's menu count: diffs quantities
-- against the last-submitted snapshot, explodes recipes (incl. nested PREP
-- items) into raw-material consumption, and applies it to stock + ledger —
-- all inside one transaction.
create or replace function public.submit_menu_count(
  p_date date, p_quantities jsonb, p_by_name text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_menu_id text;
  v_qty numeric;
  v_prev numeric;
  v_diff numeric;
  v_row record;
  v_pool_row record;
  v_ratio numeric;
  v_guard int := 0;
  v_time text := to_char(now(), 'HH24:MI');
begin
  if v_uid is null then raise exception 'Harus login'; end if;

  insert into public.menu_count_days(entry_date, status, updated_by, updated_at)
  values (p_date, 'DRAFT', v_uid, now())
  on conflict (entry_date) do update set updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  create temp table tmp_pool (item_id text primary key, amt numeric) on commit drop;

  for v_menu_id, v_qty in select key, value::numeric from jsonb_each_text(p_quantities)
  loop
    select coalesce(submitted_qty, 0) into v_prev
      from public.menu_count_lines where entry_date = p_date and menu_id = v_menu_id;
    v_prev := coalesce(v_prev, 0);
    v_diff := v_qty - v_prev;

    insert into public.menu_count_lines(entry_date, menu_id, qty, submitted_qty)
    values (p_date, v_menu_id, v_qty, v_qty)
    on conflict (entry_date, menu_id) do update set qty = excluded.qty, submitted_qty = excluded.submitted_qty;

    if v_diff <> 0 then
      for v_row in select item_id, qty from public.recipe_ingredients where menu_id = v_menu_id
      loop
        insert into tmp_pool(item_id, amt) values (v_row.item_id, v_row.qty * v_diff)
        on conflict (item_id) do update set amt = tmp_pool.amt + excluded.amt;
      end loop;
    end if;
  end loop;

  -- explode any PREP items in the pool into their raw components (bounded to avoid
  -- an accidental circular prep reference spinning forever)
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 500;

    select p.item_id, p.amt into v_pool_row
      from tmp_pool p join public.items i on i.id = p.item_id
      where i.item_type = 'PREP'
      limit 1;
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

    insert into public.ledger_entries(entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
    select p_date, v_time, 'AUTO_OUT', i.id, i.name, v_pool_row.amt, i.unit, 'Auto dari hitung menu terjual', v_uid, p_by_name
    from public.items i where i.id = v_pool_row.item_id;
  end loop;

  update public.menu_count_days
    set status = 'SUBMITTED', submitted_by = v_uid, submitted_at = now(), updated_by = v_uid, updated_at = now()
    where entry_date = p_date;
end;
$$;

-- Submit a stock-opname session; optionally apply the physical count back to
-- system stock and log the variance as an ADJUSTMENT ledger entry.
create or replace function public.submit_month_end(
  p_date date, p_apply_to_stock boolean, p_by_name text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_variance numeric;
  v_time text := to_char(now(), 'HH24:MI');
begin
  if v_uid is null then raise exception 'Harus login'; end if;

  if p_apply_to_stock then
    for v_row in
      select item_id, item_name, unit, system_ending, physical_ending
      from public.month_end_items
      where entry_date = p_date and physical_ending is not null
    loop
      v_variance := v_row.physical_ending - v_row.system_ending;
      if abs(v_variance) > 0.000001 then
        update public.items set stock = v_row.physical_ending, updated_at = now() where id = v_row.item_id;
        insert into public.ledger_entries(entry_date, entry_time, type, item_id, item_name, qty, unit, note, created_by, by_name)
        values (p_date, v_time, 'ADJUSTMENT', v_row.item_id, v_row.item_name, v_variance, v_row.unit, 'Penyesuaian hasil stock opname', v_uid, p_by_name);
      end if;
    end loop;
  end if;

  update public.month_end_sessions
    set status = 'SUBMITTED', applied_to_stock = p_apply_to_stock, submitted_by = v_uid, submitted_at = now()
    where entry_date = p_date;
end;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table
  public.items, public.menu, public.ledger_entries,
  public.menu_count_days, public.menu_count_lines,
  public.month_end_sessions, public.month_end_items,
  public.profiles;


-- ============================================================
-- DIRECT DAILY INPUT (Stok Harian grid) — see daily_input.sql
-- ============================================================
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


-- ============================================================
-- DASHBOARD COCKPIT (par level + cost) — see cockpit.sql
-- ============================================================
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


-- ============================================================
-- WASTE LOGGING (reason column + record_waste) — see waste.sql
-- ============================================================
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
