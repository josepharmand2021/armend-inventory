-- ARMEND — reset BIH Bakery Stock (area + master data), keep the area itself.
-- IRREVERSIBLE: deletes every item, menu, recipe, prep, ledger entry, menu-count
-- history and opname history under this area. Run only when you actually want a
-- blank slate to re-enter real data into.

-- deleting the outlets row cascades to everything scoped to it (outlet_id fk on
-- items / menu / recipe_ingredients / prep_recipes / prep_components /
-- ledger_entries / menu_count_days+lines / month_end_sessions+items / outlet_members)
delete from public.outlets where id = 'bih-bakery';

-- recreate the empty area under BIH, ready for fresh data
insert into public.outlets (id, name, parent_id, kind, area_type, order_idx)
select 'bih-bakery', 'Bakery Stock', o.id, 'area', 'bakery', 0
from public.outlets o where o.name = 'BIH' and o.kind = 'group';
