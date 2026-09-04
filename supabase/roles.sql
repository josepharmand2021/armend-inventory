-- ARMEND — add Manajer (global) and Supervisor (per-outlet) roles.
-- Run once in the Supabase SQL Editor after migrate_multi_outlet.sql.
--
-- Tiers:
--   Owner        profiles.role = 'admin'      — everything incl. create/delete
--                                                outlet, delete accounts
--   Manajer      profiles.role = 'manager'    — full access to ALL outlets
--                                                (master data, stock, opname,
--                                                members); cannot create/delete
--                                                outlets or delete accounts
--   Admin Outlet outlet_members.role='admin'  — configure + manage one outlet
--   Supervisor   outlet_members.role='supervisor' — view all + stock/opname/
--                                                counts/history; no master-data
--                                                or member edits
--   Staff        outlet_members.role='staff'  — daily input in one area

alter table public.outlet_members drop constraint if exists outlet_members_role_check;
alter table public.outlet_members add  constraint outlet_members_role_check
  check (role in ('admin','supervisor','staff'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add  constraint profiles_role_check
  check (role in ('admin','manager','staff'));

-- owner OR manager
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'));
$$;

-- effective role for an area: manager => admin; otherwise highest grant on the
-- area or its parent group
create or replace function public.outlet_role(p_outlet text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_manager() then 'admin'
    when exists (
      select 1 from public.outlet_members m
      where m.user_id = auth.uid() and m.role = 'admin'
        and (m.outlet_id = p_outlet or m.outlet_id = (select parent_id from public.outlets where id = p_outlet))
    ) then 'admin'
    when exists (
      select 1 from public.outlet_members m
      where m.user_id = auth.uid() and m.role = 'supervisor'
        and (m.outlet_id = p_outlet or m.outlet_id = (select parent_id from public.outlets where id = p_outlet))
    ) then 'supervisor'
    when exists (
      select 1 from public.outlet_members m
      where m.user_id = auth.uid()
        and (m.outlet_id = p_outlet or m.outlet_id = (select parent_id from public.outlets where id = p_outlet))
    ) then 'staff'
    else null
  end;
$$;

-- is_owner / can_access_outlet / is_outlet_admin / can_see_outlet are unchanged
-- in shape; is_outlet_admin now returns true for a manager automatically.
