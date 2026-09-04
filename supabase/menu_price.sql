-- ARMEND — selling price per menu (for HPP / food-cost %).
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.menu add column if not exists price numeric not null default 0;

-- optional manual HPP override; NULL = compute from the recipe
alter table public.menu add column if not exists hpp_manual numeric;
