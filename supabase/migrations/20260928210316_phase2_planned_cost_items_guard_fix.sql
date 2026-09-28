-- Repair the first guard: accept valid CostItems while keeping direct writes constrained.
-- No historical or analytics dependency is introduced.
create or replace function private.phase2_valid_cost_items(items jsonb)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select jsonb_typeof(items) = 'array' and coalesce((
    select count(*) between 1 and 50
      and count(*) = count(distinct item->>'id')
      and coalesce(bool_and(
        case when jsonb_typeof(item) = 'object' then
          item ?& array['id', 'label', 'amount', 'baselineKey']
          and (select count(*) from jsonb_object_keys(item)) = 4
          and jsonb_typeof(item->'id') = 'string'
          and item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and jsonb_typeof(item->'label') = 'string'
          and char_length(btrim(item->>'label')) between 1 and 120
          and jsonb_typeof(item->'amount') = 'string'
          and case when item->>'amount' ~ '^(0|[1-9][0-9]{0,8})([.][0-9]{1,2})?$'
            then (item->>'amount')::numeric > 0 else false end
          and (jsonb_typeof(item->'baselineKey') = 'null'
            or (jsonb_typeof(item->'baselineKey') = 'string'
              and item->>'baselineKey' in
                ('groceries', 'household-restaurants', 'adrien-work-meals', 'manon-work-meals')))
        else false end
      ), false)
    from jsonb_array_elements(case when jsonb_typeof(items) = 'array'
      then items else '[]'::jsonb end) as expense_item(item)
  ), false);
$$;
