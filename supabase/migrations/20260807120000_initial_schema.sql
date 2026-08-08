begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (user_id)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid references public.household_members(id) on delete set null,
  name text not null,
  kind text,
  color text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  imported_by uuid references auth.users(id) on delete set null,
  filename text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'completed_with_warnings', 'failed')),
  row_count integer not null default 0 check (row_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  month_start date,
  month_end date,
  source_metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  slug text not null,
  color text,
  included_in_consumption boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (household_id, slug)
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name),
  unique (category_id, slug)
);

create table if not exists public.precise_types (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (subcategory_id, name),
  unique (subcategory_id, slug)
);

create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  person_member_id uuid references public.household_members(id) on delete set null,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  date date not null,
  import_month date not null check (extract(day from import_month) = 1),
  amount numeric(14, 2) not null,
  debit numeric(14, 2),
  credit numeric(14, 2),
  source_label text not null,
  normalized_merchant text,
  flow text not null
    check (flow in (
      'Dépense',
      'Revenu',
      'Remboursement',
      'Transfert interne',
      'Prêt et avance',
      'Flux technique'
    )),
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  precise_type_id uuid references public.precise_types(id) on delete set null,
  recurrence text check (recurrence is null or recurrence in ('Fixe', 'Variable')),
  importance text check (
    importance is null or importance in (
      'Indispensable',
      'Contrainte',
      'Ajustable',
      'Optionnelle'
    )
  ),
  analytical_status text not null default 'Habituel'
    check (analytical_status in ('Habituel', 'Exceptionnel', 'Hors budget', 'À ventiler')),
  note text,
  event text,
  uncertain boolean not null default false,
  fingerprint text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists household_members_user_id_idx
  on public.household_members(user_id);
create index if not exists accounts_household_id_idx
  on public.accounts(household_id);
create index if not exists import_batches_household_id_idx
  on public.import_batches(household_id, imported_at desc);
create index if not exists categories_household_id_idx
  on public.categories(household_id);
create index if not exists subcategories_household_id_idx
  on public.subcategories(household_id);
create index if not exists precise_types_household_id_idx
  on public.precise_types(household_id);
create index if not exists operations_household_month_idx
  on public.operations(household_id, import_month, date desc);
create index if not exists operations_household_category_idx
  on public.operations(household_id, category_id);
create index if not exists operations_household_fingerprint_idx
  on public.operations(household_id, fingerprint);

create or replace function private.slugify(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      value,
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝŸýÿŒœÆæ',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYYyyOoAa'
    )),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members member
    where member.household_id = target_household_id
      and member.user_id = (select auth.uid())
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.import_batches enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.precise_types enable row level security;
alter table public.operations enable row level security;

drop policy if exists "Members can read their household" on public.households;
drop policy if exists "Members can read household members" on public.household_members;
drop policy if exists "Members can read accounts" on public.accounts;
drop policy if exists "Members can read import batches" on public.import_batches;
drop policy if exists "Members can create import batches" on public.import_batches;
drop policy if exists "Members can update import batches" on public.import_batches;
drop policy if exists "Members can read categories" on public.categories;
drop policy if exists "Members can create categories" on public.categories;
drop policy if exists "Members can read subcategories" on public.subcategories;
drop policy if exists "Members can create subcategories" on public.subcategories;
drop policy if exists "Members can read precise types" on public.precise_types;
drop policy if exists "Members can create precise types" on public.precise_types;
drop policy if exists "Members can read operations" on public.operations;
drop policy if exists "Members can create operations" on public.operations;

create policy "Members can read their household"
  on public.households for select to authenticated
  using (private.is_household_member(id));

create policy "Members can read household members"
  on public.household_members for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can read accounts"
  on public.accounts for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can read import batches"
  on public.import_batches for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can create import batches"
  on public.import_batches for insert to authenticated
  with check (
    private.is_household_member(household_id)
    and imported_by = (select auth.uid())
  );

create policy "Members can update import batches"
  on public.import_batches for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Members can read categories"
  on public.categories for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can create categories"
  on public.categories for insert to authenticated
  with check (private.is_household_member(household_id));

create policy "Members can read subcategories"
  on public.subcategories for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can create subcategories"
  on public.subcategories for insert to authenticated
  with check (private.is_household_member(household_id));

create policy "Members can read precise types"
  on public.precise_types for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can create precise types"
  on public.precise_types for insert to authenticated
  with check (private.is_household_member(household_id));

create policy "Members can read operations"
  on public.operations for select to authenticated
  using (private.is_household_member(household_id));

create policy "Members can create operations"
  on public.operations for insert to authenticated
  with check (private.is_household_member(household_id));

revoke all on public.households from anon;
revoke all on public.household_members from anon;
revoke all on public.accounts from anon;
revoke all on public.import_batches from anon;
revoke all on public.categories from anon;
revoke all on public.subcategories from anon;
revoke all on public.precise_types from anon;
revoke all on public.operations from anon;

grant select on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select on public.accounts to authenticated;
grant select, insert, update on public.import_batches to authenticated;
grant select, insert on public.categories to authenticated;
grant select, insert on public.subcategories to authenticated;
grant select, insert on public.precise_types to authenticated;
grant select, insert on public.operations to authenticated;

create or replace function public.attach_user_to_budgetisation(
  target_user_id uuid,
  target_display_name text default null,
  target_role text default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid;
  attached_member_id uuid;
begin
  if target_role not in ('owner', 'member') then
    raise exception 'Rôle invalide';
  end if;

  select id
  into target_household_id
  from public.households
  where name = 'Budgetisation'
  limit 1;

  if target_household_id is null then
    raise exception 'Le foyer Budgetisation n''existe pas';
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    display_name,
    role
  )
  values (
    target_household_id,
    target_user_id,
    target_display_name,
    target_role
  )
  on conflict (user_id) do update
    set household_id = excluded.household_id,
        display_name = excluded.display_name,
        role = excluded.role
  returning id into attached_member_id;

  return attached_member_id;
end;
$$;

revoke all on function public.attach_user_to_budgetisation(uuid, text, text)
  from public, anon, authenticated;

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
  warning_count integer;
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
  into first_month, last_month, warning_count
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
    warning_count,
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
        when warning_count > 0 then 'completed_with_warnings'
        else 'completed'
      end
  where id = created_batch_id;

  return jsonb_build_object(
    'batch_id', created_batch_id,
    'inserted', imported_count,
    'warnings', warning_count
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
