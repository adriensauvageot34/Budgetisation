-- Keep direct authenticated writes subject to the same CostItem contract as the service.
-- Prospective table only; no history or analytics hooks.
create or replace function private.phase2_valid_cost_items(items jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  item jsonb;
  seen_ids text[] := '{}';
  item_id text;
  item_amount text;
  item_baseline jsonb;
begin
  if jsonb_typeof(items) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(items) not between 1 and 50 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;
    if not (item ?& array['id', 'label', 'amount', 'baselineKey'])
      or (select count(*) from jsonb_object_keys(item)) <> 4 then
      return false;
    end if;

    item_id := item->>'id';
    if jsonb_typeof(item->'id') <> 'string'
      or item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$'
      or item_id = any(seen_ids) then
      return false;
    end if;
    seen_ids := array_append(seen_ids, item_id);

    if jsonb_typeof(item->'label') <> 'string'
      or char_length(btrim(item->>'label')) not between 1 and 120 then
      return false;
    end if;

    item_amount := item->>'amount';
    if jsonb_typeof(item->'amount') <> 'string'
      or item_amount !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$' then
      return false;
    end if;
    if item_amount::numeric <= 0 then
      return false;
    end if;

    item_baseline := item->'baselineKey';
    if item_baseline <> 'null'::jsonb
      and (jsonb_typeof(item_baseline) <> 'string'
        or item_baseline #>> '{}' not in
          ('groceries', 'household-restaurants', 'adrien-work-meals', 'manon-work-meals')) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.phase2_planned_expenses
  drop constraint phase2_planned_expenses_cost_items;

alter table public.phase2_planned_expenses
  add constraint phase2_planned_expenses_cost_items
  check (private.phase2_valid_cost_items(cost_items));
