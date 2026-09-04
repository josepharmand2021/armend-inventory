-- ARMEND — selling price per menu (for HPP / food-cost %).
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.menu add column if not exists price numeric not null default 0;
