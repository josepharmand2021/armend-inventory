-- ARMEND — per-area feature settings.
--   outlets.settings jsonb holds feature flags; a flag is ON unless explicitly false.
--   Keys used by the app: "recipes", "costing".
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.outlets add column if not exists settings jsonb not null default '{}'::jsonb;

-- outlet admins (and owner/manager) can change their area's settings without
-- opening up write access to the rest of the outlets row.
create or replace function public.set_outlet_settings(p_outlet text, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;
  if not public.is_outlet_admin(p_outlet) then
    raise exception 'Hanya admin outlet yang boleh mengubah pengaturan';
  end if;
  update public.outlets set settings = coalesce(p_settings, '{}'::jsonb) where id = p_outlet;
end;
$$;

grant execute on function public.set_outlet_settings(text, jsonb) to authenticated;
