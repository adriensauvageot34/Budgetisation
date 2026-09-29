-- C2: constrain prospective modulePath to ROOT or ROOT -> CHILD. No historical table is touched.
-- Preflight: phase2_planned_expenses has zero live rows; this replaces only its JSONB guard.
create or replace function private.phase2_valid_cost_items(items jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  item jsonb;
  allocation jsonb;
  seen_ids text[] := '{}';
  seen_sources text[];
  item_id text;
  quantity_text text;
  unit_text text;
  allocation_text text;
  allocation_sum numeric;
  line_gross numeric;
begin
  if jsonb_typeof(items) is distinct from 'array' then return false; end if;
  if jsonb_array_length(items) not between 1 and 50 then return false; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if not (item ?& array['id','assetKey','label','quantity','unitAmount','baselineKey'])
      or exists (select 1 from jsonb_object_keys(item) as k(key) where key not in
        ('id','assetKey','label','variantLabel','quantity','unitAmount','baselineKey',
         'fundingAllocations','priceSource','priceSourceLabel','modulePath')) then
      return false;
    end if;
    item_id := item->>'id';
    if jsonb_typeof(item->'id') is distinct from 'string'
      or item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item_id = any(seen_ids) then return false; end if;
    seen_ids := array_append(seen_ids, item_id);
    if jsonb_typeof(item->'assetKey') not in ('null','string')
      or (jsonb_typeof(item->'assetKey') = 'string' and item->>'assetKey' !~ '^[a-z_]+:[a-z_]+$')
      or jsonb_typeof(item->'label') is distinct from 'string'
      or char_length(btrim(item->>'label')) not between 1 and 120 then return false; end if;
    if item ? 'variantLabel' and jsonb_typeof(item->'variantLabel') not in ('null','string') then return false; end if;
    if jsonb_typeof(item->'variantLabel') = 'string'
      and char_length(btrim(item->>'variantLabel')) not between 1 and 120 then return false; end if;
    quantity_text := item->>'quantity';
    unit_text := item->>'unitAmount';
    if jsonb_typeof(item->'quantity') is distinct from 'string'
      or quantity_text !~ '^(0|[1-9][0-9]{0,3})([.][0-9]{1,3})?$'
      or jsonb_typeof(item->'unitAmount') is distinct from 'string'
      or unit_text !~ '^(0|[1-9][0-9]{0,8})([.][0-9]{1,2})?$' then return false; end if;
    if quantity_text::numeric <= 0 or unit_text::numeric <= 0 then return false; end if;
    line_gross := round(quantity_text::numeric * unit_text::numeric, 2);
    if line_gross < 0.01 or line_gross > 999999999.99 then return false; end if;
    if jsonb_typeof(item->'baselineKey') not in ('null','string')
      or (jsonb_typeof(item->'baselineKey') = 'string' and item->>'baselineKey' not in
        ('groceries','household-restaurants','adrien-work-meals','manon-work-meals')) then return false; end if;
    if item ? 'priceSource' and item->>'priceSource' not in ('MANUAL','SYSTEM_DEFAULT','LAST_KNOWN','CALCULATED') then return false; end if;
    if item ? 'priceSourceLabel' and jsonb_typeof(item->'priceSourceLabel') not in ('null','string') then return false; end if;
    if jsonb_typeof(item->'priceSourceLabel') = 'string'
      and char_length(btrim(item->>'priceSourceLabel')) not between 1 and 160 then return false; end if;
    if item ? 'modulePath' then
      if jsonb_typeof(item->'modulePath') is distinct from 'array' or jsonb_array_length(item->'modulePath') not between 1 and 2
        or exists (select 1 from jsonb_array_elements(item->'modulePath') as m(value)
          where jsonb_typeof(value) <> 'string' or value #>> '{}' !~ '^[a-z_]+$') then return false; end if;
    end if;
    if item ? 'fundingAllocations' then
      if jsonb_typeof(item->'fundingAllocations') is distinct from 'array'
        or jsonb_array_length(item->'fundingAllocations') not between 1 and 3 then return false; end if;
      allocation_sum := 0;
      seen_sources := '{}';
      for allocation in select value from jsonb_array_elements(item->'fundingAllocations') loop
        if jsonb_typeof(allocation) is distinct from 'object'
          or not (allocation ?& array['source','amount'])
          or (select count(*) from jsonb_object_keys(allocation)) <> 2
          or allocation->>'source' not in ('BANK','SWILE','EDENRED')
          or allocation->>'source' = any(seen_sources) then return false; end if;
        allocation_text := allocation->>'amount';
        if jsonb_typeof(allocation->'amount') is distinct from 'string'
          or allocation_text !~ '^(0|[1-9][0-9]{0,8})([.][0-9]{1,2})?$' then return false; end if;
        if allocation_text::numeric <= 0 then return false; end if;
        seen_sources := array_append(seen_sources, allocation->>'source');
        allocation_sum := allocation_sum + allocation_text::numeric;
      end loop;
      if allocation_sum <> line_gross then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;
