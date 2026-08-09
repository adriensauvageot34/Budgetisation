begin;

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  slug text not null,
  name text not null,
  type text not null,
  start_date date,
  end_date date,
  note text,
  created_at timestamptz not null default now(),
  constraint moments_household_slug_key unique (household_id, slug),
  constraint moments_dates_check check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

alter table public.operations
  add column if not exists life_context text,
  add column if not exists moment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_life_context_check'
  ) then
    alter table public.operations
      add constraint operations_life_context_check
      check (life_context is null or life_context in ('Vie courante', 'Hors quotidien'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_moment_id_fkey'
  ) then
    alter table public.operations
      add constraint operations_moment_id_fkey
      foreign key (moment_id) references public.moments(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operations'::regclass
      and conname = 'operations_moment_life_context_check'
  ) then
    alter table public.operations
      add constraint operations_moment_life_context_check
      check (moment_id is null or life_context is distinct from 'Vie courante');
  end if;
end
$$;

create table if not exists public.operation_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  life_context text check (
    life_context is null or life_context in ('Vie courante', 'Hors quotidien')
  ),
  moment_id uuid references public.moments(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  precise_type_id uuid references public.precise_types(id) on delete set null,
  importance text check (
    importance is null or importance in ('Indispensable', 'Contrainte', 'Ajustable', 'Optionnelle')
  ),
  recurrence text check (recurrence is null or recurrence in ('Fixe', 'Variable')),
  analytical_status text check (
    analytical_status is null or analytical_status in ('Habituel', 'Exceptionnel', 'Hors budget', 'À ventiler')
  ),
  note text,
  created_at timestamptz not null default now(),
  constraint operation_allocations_moment_life_context_check
    check (moment_id is null or life_context is distinct from 'Vie courante')
);

create index if not exists moments_household_id_idx
  on public.moments(household_id);
create index if not exists moments_household_start_date_idx
  on public.moments(household_id, start_date);
create index if not exists operation_allocations_household_id_idx
  on public.operation_allocations(household_id);
create index if not exists operation_allocations_operation_id_idx
  on public.operation_allocations(operation_id);
create index if not exists operation_allocations_moment_id_idx
  on public.operation_allocations(moment_id);
create index if not exists operations_moment_id_idx
  on public.operations(moment_id);

alter table public.moments enable row level security;
alter table public.operation_allocations enable row level security;

drop policy if exists "Members can read moments" on public.moments;
drop policy if exists "Members can create moments" on public.moments;
drop policy if exists "Members can update moments" on public.moments;
drop policy if exists "Members can delete moments" on public.moments;
drop policy if exists "Members can read operation allocations" on public.operation_allocations;
drop policy if exists "Members can create operation allocations" on public.operation_allocations;
drop policy if exists "Members can update operation allocations" on public.operation_allocations;
drop policy if exists "Members can delete operation allocations" on public.operation_allocations;

create policy "Members can read moments"
  on public.moments for select to authenticated
  using (private.is_household_member(household_id));
create policy "Members can create moments"
  on public.moments for insert to authenticated
  with check (private.is_household_member(household_id));
create policy "Members can update moments"
  on public.moments for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create policy "Members can delete moments"
  on public.moments for delete to authenticated
  using (private.is_household_member(household_id));

create policy "Members can read operation allocations"
  on public.operation_allocations for select to authenticated
  using (private.is_household_member(household_id));
create policy "Members can create operation allocations"
  on public.operation_allocations for insert to authenticated
  with check (private.is_household_member(household_id));
create policy "Members can update operation allocations"
  on public.operation_allocations for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create policy "Members can delete operation allocations"
  on public.operation_allocations for delete to authenticated
  using (private.is_household_member(household_id));

revoke all on public.moments from anon;
revoke all on public.operation_allocations from anon;
grant select, insert, update, delete on public.moments to authenticated;
grant select, insert, update, delete on public.operation_allocations to authenticated;

commit;

