-- ARMEND — final setup step. Run after schema.sql + seed.sql.
-- EDIT the email + outlet names below first.

-- 1. give every existing login a profile row (schema.sql's trigger only
--    fires for NEW users, so existing accounts need a backfill)
insert into public.profiles (id, email, name)
select id, email, coalesce(raw_user_meta_data->>'name', split_part(email,'@','1'))
from auth.users
on conflict (id) do nothing;

-- 2. make yourself the owner
update public.profiles set role = 'admin'
where email = 'joseph.armand.2021@gmail.com';   -- <-- your email

-- 3. name the outlet + area the seed data lives in
update public.outlets set name = 'HARA'      where id = 'main';        -- the group
update public.outlets set name = 'Bar Stock' where id = 'main-area';   -- the area

-- 4. (optional) build out the rest of the structure
insert into public.outlets (id, name, kind, order_idx) values
  ('bih', 'BIH', 'group', 1)
on conflict (id) do nothing;
insert into public.outlets (id, name, parent_id, kind, area_type, order_idx) values
  ('main-kitchen', 'Kitchen Stock', 'main', 'area', 'kitchen', 1),
  ('main-service', 'Service Stock', 'main', 'area', 'service', 2),
  ('bih-bakery',   'Bakery Stock',  'bih',  'area', 'bakery',  0),
  ('bih-service',  'Service Stock', 'bih',  'area', 'service', 1),
  ('bih-bar',      'Bar Stock',     'bih',  'area', 'bar',     2)
on conflict (id) do nothing;
