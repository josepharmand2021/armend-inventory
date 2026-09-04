-- ARMEND — wipe the app schema and start clean.
-- Use this when the database is in a half-migrated / inconsistent state.
-- It does NOT touch auth (your login accounts are kept).
--
-- Order: run reset.sql -> schema.sql -> seed.sql -> finish.sql

drop schema public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
