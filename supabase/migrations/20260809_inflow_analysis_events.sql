begin;

alter table public.operations
  add column if not exists resource_type text,
  add column if not exists resource_context text,
  add column if not exists analysis_month_override date,
  add column if not exists event_detail text,
  add column if not exists reimburses_operation_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_resource_type_check'
  ) then
    alter table public.operations
      add constraint operations_resource_type_check
      check (
        resource_type is null or resource_type in (
          'Revenu',
          'Entrée d''argent',
          'Remboursement',
          'Transfert interne',
          'Flux technique',
          'À qualifier'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_analysis_month_override_check'
  ) then
    alter table public.operations
      add constraint operations_analysis_month_override_check
      check (
        analysis_month_override is null
        or (
          amount > 0
          and extract(day from analysis_month_override) = 1
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_reimbursement_link_check'
  ) then
    alter table public.operations
      add constraint operations_reimbursement_link_check
      check (
        reimburses_operation_id is null
        or (resource_type = 'Remboursement' and amount > 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_reimburses_operation_id_fkey'
  ) then
    alter table public.operations
      add constraint operations_reimburses_operation_id_fkey
      foreign key (reimburses_operation_id)
      references public.operations(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists operations_household_resource_type_idx
  on public.operations(household_id, resource_type);
create index if not exists operations_reimburses_operation_id_idx
  on public.operations(reimburses_operation_id)
  where reimburses_operation_id is not null;

create or replace function public.import_operations(
  source_filename text,
  source_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_household_id uuid;
  created_batch_id uuid;
  imported_count integer;
  calculated_warning_count integer;
  first_month date;
  last_month date;
begin
  select household_id
  into current_household_id
  from public.household_members
  where user_id = (select auth.uid())
  limit 1;

  if current_household_id is null then
    raise exception 'Utilisateur non rattaché à un foyer';
  end if;

  if source_filename is null or btrim(source_filename) = '' then
    raise exception 'Nom de fichier manquant';
  end if;

  if source_rows is null
    or jsonb_typeof(source_rows) <> 'array'
    or jsonb_array_length(source_rows) = 0
  then
    raise exception 'Aucune ligne à importer';
  end if;

  select
    min((row_data ->> 'import_month')::date),
    max((row_data ->> 'import_month')::date),
    count(*) filter (
      where coalesce((row_data ->> 'uncertain')::boolean, false)
        or nullif(row_data ->> 'category', '') is null
        or nullif(row_data ->> 'source_label', '') is null
    )
  into first_month, last_month, calculated_warning_count
  from jsonb_array_elements(source_rows) as rows(row_data);

  insert into public.import_batches (
    household_id,
    imported_by,
    filename,
    status,
    row_count,
    warning_count,
    month_start,
    month_end,
    source_metadata
  )
  values (
    current_household_id,
    (select auth.uid()),
    source_filename,
    'processing',
    0,
    calculated_warning_count,
    first_month,
    last_month,
    jsonb_build_object('source', 'application_import')
  )
  returning id into created_batch_id;

  insert into public.categories (
    household_id,
    name,
    slug,
    included_in_consumption
  )
  select
    current_household_id,
    row_data ->> 'category',
    private.slugify(row_data ->> 'category'),
    bool_or(row_data ->> 'flow' = 'Dépense')
  from jsonb_array_elements(source_rows) as rows(row_data)
  where nullif(row_data ->> 'category', '') is not null
  group by row_data ->> 'category'
  on conflict (household_id, name) do nothing;

  insert into public.subcategories (
    household_id,
    category_id,
    name,
    slug
  )
  select distinct
    current_household_id,
    category.id,
    row_data ->> 'subcategory',
    private.slugify(row_data ->> 'subcategory')
  from jsonb_array_elements(source_rows) as rows(row_data)
  join public.categories category
    on category.household_id = current_household_id
   and category.name = row_data ->> 'category'
  where nullif(row_data ->> 'subcategory', '') is not null
  on conflict (category_id, name) do nothing;

  insert into public.precise_types (
    household_id,
    subcategory_id,
    name,
    slug
  )
  select distinct
    current_household_id,
    subcategory.id,
    row_data ->> 'precise_type',
    private.slugify(row_data ->> 'precise_type')
  from jsonb_array_elements(source_rows) as rows(row_data)
  join public.categories category
    on category.household_id = current_household_id
   and category.name = row_data ->> 'category'
  join public.subcategories subcategory
    on subcategory.category_id = category.id
   and subcategory.name = row_data ->> 'subcategory'
  where nullif(row_data ->> 'precise_type', '') is not null
  on conflict (subcategory_id, name) do nothing;

  insert into public.operations (
    household_id,
    account_id,
    person_member_id,
    import_batch_id,
    date,
    import_month,
    amount,
    debit,
    credit,
    source_label,
    normalized_merchant,
    flow,
    category_id,
    subcategory_id,
    precise_type_id,
    recurrence,
    importance,
    analytical_status,
    note,
    event,
    event_detail,
    resource_type,
    resource_context,
    analysis_month_override,
    reimburses_operation_id,
    uncertain,
    fingerprint,
    source_metadata
  )
  select
    current_household_id,
    account.id,
    person.id,
    created_batch_id,
    (row_data ->> 'date')::date,
    (row_data ->> 'import_month')::date,
    (row_data ->> 'amount')::numeric(14, 2),
    nullif(row_data ->> 'debit', '')::numeric(14, 2),
    nullif(row_data ->> 'credit', '')::numeric(14, 2),
    row_data ->> 'source_label',
    nullif(row_data ->> 'normalized_merchant', ''),
    row_data ->> 'flow',
    category.id,
    subcategory.id,
    precise_type.id,
    nullif(row_data ->> 'recurrence', ''),
    nullif(row_data ->> 'importance', ''),
    coalesce(nullif(row_data ->> 'analytical_status', ''), 'Habituel'),
    nullif(row_data ->> 'note', ''),
    nullif(row_data ->> 'event', ''),
    nullif(row_data ->> 'event_detail', ''),
    nullif(row_data ->> 'resource_type', ''),
    nullif(row_data ->> 'resource_context', ''),
    case
      when (row_data ->> 'amount')::numeric > 0
      then nullif(row_data ->> 'analysis_month_override', '')::date
      else null
    end,
    null,
    coalesce((row_data ->> 'uncertain')::boolean, false),
    coalesce(
      nullif(row_data ->> 'fingerprint', ''),
      md5(
        concat_ws(
          '|',
          row_data ->> 'date',
          row_data ->> 'source_label',
          row_data ->> 'amount',
          row_data ->> 'normalized_merchant'
        )
      )
    ),
    coalesce(row_data -> 'source_metadata', '{}'::jsonb)
  from jsonb_array_elements(source_rows) as rows(row_data)
  left join public.accounts account
    on account.household_id = current_household_id
   and account.id = nullif(row_data ->> 'account_id', '')::uuid
  left join public.household_members person
    on person.household_id = current_household_id
   and person.id = nullif(row_data ->> 'person_member_id', '')::uuid
  left join public.categories category
    on category.household_id = current_household_id
   and category.name = row_data ->> 'category'
  left join public.subcategories subcategory
    on subcategory.category_id = category.id
   and subcategory.name = row_data ->> 'subcategory'
  left join public.precise_types precise_type
    on precise_type.subcategory_id = subcategory.id
   and precise_type.name = row_data ->> 'precise_type';

  get diagnostics imported_count = row_count;

  update public.import_batches
  set row_count = imported_count,
      status = case
        when calculated_warning_count > 0 then 'completed_with_warnings'
        else 'completed'
      end
  where id = created_batch_id;

  return jsonb_build_object(
    'batch_id', created_batch_id,
    'inserted', imported_count,
    'warnings', calculated_warning_count
  );
exception
  when others then
    if created_batch_id is not null then
      update public.import_batches
      set status = 'failed',
          source_metadata = source_metadata || jsonb_build_object('error', sqlerrm)
      where id = created_batch_id;
    end if;
    raise;
end;
$$;

revoke all on function public.import_operations(text, jsonb)
  from public, anon;
grant execute on function public.import_operations(text, jsonb)
  to authenticated;

commit;
