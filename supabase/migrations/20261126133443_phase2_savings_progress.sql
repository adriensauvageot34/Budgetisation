begin;

alter table public.phase2_savings_goals
  add column budget_kind text not null default 'estimate' check (budget_kind in ('estimate', 'exact')),
  add column optional boolean not null default false,
  add column purchased_complete boolean not null default false,
  add column abandoned boolean not null default false,
  add column recipient text check (char_length(btrim(recipient)) between 1 and 80),
  add column season_year integer check (season_year between 2000 and 2099),
  add column series_key uuid not null default gen_random_uuid(),
  add constraint savings_goal_seasonal_project check (season_year is null or project in ('christmas', 'birthday')),
  add constraint savings_goal_season_series unique (household_id, project, season_year, series_key);

update public.phase2_savings_goals
set season_year = coalesce(extract(year from deadline)::integer, 2026),
  recipient = case template_key
    when 'birthday-mathilde' then 'Mathilde'
    when 'birthday-isabelle' then 'Isabelle'
    when 'christmas-adrien' then 'Adrien'
    when 'christmas-manon' then 'Manon'
    else recipient end
where project in ('christmas', 'birthday');

grant update (budget_kind, optional, purchased_complete, recipient, season_year) on public.phase2_savings_goals to authenticated;
grant update (abandoned, revision, allocations) on public.phase2_savings_goals to service_role;

alter table public.phase2_savings_purchase_items
  add column livret_cents integer not null default 0 check (livret_cents between 0 and gross_cents and (goal_id is not null or livret_cents = 0));

create or replace view public.phase2_savings_purchase_lines with (security_invoker = true) as
select household_id, operation_id, line_id, position, goal_id, payment_date, payment_label,
  article, recipient, gross_cents, refunded_cents, gross_cents - refunded_cents as cents, livret_cents
from public.phase2_savings_purchase_items
union all
select p.household_id, p.operation_id, p.goal_id,
  (row_number() over (partition by p.operation_id order by p.goal_id))::integer,
  p.goal_id, p.payment_date, p.payment_label, left(p.payment_label, 120), null::text, p.cents, 0, p.cents, 0
from public.phase2_savings_purchases p
where not exists (select 1 from public.phase2_savings_purchase_items i where i.operation_id = p.operation_id);

create or replace view public.phase2_savings_goal_month_entries with (security_invoker = true) as
select g.household_id, g.goal_id, g.label, g.project, g.deadline,
  a.id, a.month as target_month, a.cents, a.status, a.accounted
from public.phase2_savings_goals g
cross join lateral jsonb_to_recordset(g.allocations) as a(id uuid, month text, cents integer, status text, accounted boolean)
where a.status <> 'planned' or (not g.abandoned and not g.purchased_complete);

create table public.phase2_savings_livret_transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id),
  source_goal_id uuid not null references public.phase2_savings_goals(goal_id),
  destination_goal_id uuid not null references public.phase2_savings_goals(goal_id),
  cents integer not null check (cents between 1 and 99999999),
  created_at timestamptz not null default now(),
  check (source_goal_id <> destination_goal_id)
);
create index phase2_savings_livret_source on public.phase2_savings_livret_transfers (source_goal_id);
create index phase2_savings_livret_destination on public.phase2_savings_livret_transfers (destination_goal_id);
create index phase2_savings_livret_household on public.phase2_savings_livret_transfers (household_id);
alter table public.phase2_savings_livret_transfers enable row level security;
revoke all on public.phase2_savings_livret_transfers from public, anon, authenticated, service_role;
grant select on public.phase2_savings_livret_transfers to authenticated;
grant select, insert on public.phase2_savings_livret_transfers to service_role;
create policy savings_livret_read on public.phase2_savings_livret_transfers for select to authenticated
  using ((select private.user_has_household_access(household_id)));

create view public.phase2_savings_livret_movements with (security_invoker = true) as
select household_id, goal_id, sum(delta)::bigint as delta
from (
  select household_id, source_goal_id as goal_id, -cents as delta from public.phase2_savings_livret_transfers
  union all
  select household_id, destination_goal_id, cents from public.phase2_savings_livret_transfers
) entries group by household_id, goal_id;
revoke all on public.phase2_savings_livret_movements from public, anon, authenticated, service_role;
grant select on public.phase2_savings_livret_movements to authenticated, service_role;

create function private.savings_livret_available(p_household uuid, p_goal uuid, p_allocations jsonb)
returns bigint language sql stable security invoker set search_path = '' as $$
  select coalesce((select sum(a.cents) from jsonb_to_recordset(p_allocations) as a(status text, cents integer) where a.status = 'saved'), 0)
    + coalesce((select delta from public.phase2_savings_livret_movements m where m.goal_id = p_goal and m.household_id = p_household), 0)
    - coalesce((select sum(least(i.livret_cents, i.gross_cents - i.refunded_cents))
      from public.phase2_savings_purchase_items i where i.goal_id = p_goal and i.household_id = p_household), 0);
$$;
revoke all on function private.savings_livret_available(uuid, uuid, jsonb) from public, anon;
grant execute on function private.savings_livret_available(uuid, uuid, jsonb) to authenticated, service_role;

create function private.check_savings_goal_livret()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if private.savings_livret_available(new.household_id, new.goal_id, new.allocations) < 0 then
    raise exception 'LIVRET_EXCEEDED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_savings_goal_livret() from public, anon;
grant execute on function private.check_savings_goal_livret() to authenticated, service_role;
create trigger check_savings_goal_livret before update of allocations on public.phase2_savings_goals
for each row when (old.allocations is distinct from new.allocations) execute function private.check_savings_goal_livret();

create function public.abandon_phase2_savings_goal(p_household uuid, p_goal uuid, p_revision integer, p_destination uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  source public.phase2_savings_goals%rowtype;
  balance bigint;
begin
  if p_destination = p_goal then raise exception 'DESTINATION_UNAVAILABLE' using errcode = '22023'; end if;
  perform 1 from public.phase2_savings_goals g where g.household_id = p_household
    and (g.goal_id = p_goal or g.goal_id = p_destination) order by g.goal_id for update;
  select g.* into source from public.phase2_savings_goals g
  where g.household_id = p_household and g.goal_id = p_goal and g.revision = p_revision;
  if not found then raise exception 'SCHEDULE_CHANGED' using errcode = '40001'; end if;
  if p_destination is not null then
    if not exists (select 1 from public.phase2_savings_goals g where g.household_id = p_household
      and g.goal_id = p_destination and not g.abandoned and not g.purchased_complete) then
      raise exception 'DESTINATION_UNAVAILABLE' using errcode = '22023';
    end if;
    balance := private.savings_livret_available(p_household, p_goal, source.allocations);
    if balance <= 0 then raise exception 'LIVRET_EMPTY' using errcode = '23514'; end if;
    while balance > 0 loop
      insert into public.phase2_savings_livret_transfers (household_id, source_goal_id, destination_goal_id, cents)
      values (p_household, p_goal, p_destination, least(balance, 99999999));
      balance := balance - 99999999;
    end loop;
    update public.phase2_savings_goals set revision = revision + 1 where goal_id = p_destination and household_id = p_household;
  end if;
  update public.phase2_savings_goals
  set abandoned = true, revision = revision + 1,
    allocations = coalesce((select jsonb_agg(a.value order by a.ordinality) from jsonb_array_elements(source.allocations) with ordinality a
      where a.value->>'status' <> 'planned'), '[]'::jsonb)
  where goal_id = p_goal and household_id = p_household;
end;
$$;
revoke all on function public.abandon_phase2_savings_goal(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.abandon_phase2_savings_goal(uuid, uuid, integer, uuid) to service_role;

create or replace function public.set_phase2_savings_purchase_items(
  p_household uuid, p_operation uuid, p_expected jsonb, p_items jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  payment_cents bigint;
  bank_date date;
  bank_label text;
  existing jsonb;
  affected uuid[];
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_typeof(p_expected) is distinct from 'array' then
    raise exception 'INVALID_LINES' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 or jsonb_array_length(p_expected) > 100 then
    raise exception 'INVALID_LINES' using errcode = '22023';
  end if;

  -- Accept old requests that omit the new field, unless they would overwrite a livret-funded line.
  select coalesce(jsonb_agg(value || jsonb_build_object('livretCents', coalesce(value->'livretCents', '0'::jsonb)) order by ordinality), '[]'::jsonb)
  into p_items from jsonb_array_elements(p_items) with ordinality;
  select coalesce(jsonb_agg(value || jsonb_build_object('livretCents', coalesce(value->'livretCents', '0'::jsonb)) order by ordinality), '[]'::jsonb)
  into p_expected from jsonb_array_elements(p_expected) with ordinality;

  -- Share the lock with the former single-allocation endpoint.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation::text, 2826));
  select round(-o.montant * 100)::bigint, o.date_bancaire,
    left(coalesce(nullif(btrim(o.marchand), ''), nullif(btrim(o.libelle_bancaire), ''), 'Achat'), 160)
  into payment_cents, bank_date, bank_label
  from public.operations o
  left join public.import_batches b on b.import_batch_id = o.import_batch_id
  where o.operation_id = p_operation and o.flux = 'Dépense' and o.montant < 0
    and (b.household_id = p_household or (o.import_batch_id is null and exists (
      select 1 from public.canonical_household_scope_control s
      where s.status = 'READY' and s.household_id = p_household
    )));
  if bank_date is null then
    raise exception 'PURCHASE_UNAVAILABLE' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', line_id, 'goalId', goal_id, 'article', article,
    'recipient', recipient, 'grossCents', gross_cents, 'refundedCents', refunded_cents, 'livretCents', livret_cents) order by position), '[]'::jsonb)
  into existing from public.phase2_savings_purchase_lines
  where operation_id = p_operation and household_id = p_household;
  if p_items = existing then return; end if;
  if p_expected <> existing then
    raise exception 'PURCHASE_CHANGED' using errcode = '40001';
  end if;
  select array_agg(id) into affected from (
    select goal_id as id from public.phase2_savings_purchase_lines where operation_id = p_operation and household_id = p_household
    union select (value->>'goalId')::uuid from jsonb_array_elements(p_items)
  ) goals where id is not null;
  perform 1 from public.phase2_savings_goals g where g.household_id = p_household and g.goal_id = any(affected)
    order by g.goal_id for update;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(id uuid, "goalId" uuid, article text, recipient text,
      "grossCents" integer, "refundedCents" integer)
    left join public.phase2_savings_goals g on g.goal_id = i."goalId" and g.household_id = p_household
    where i."goalId" is not null and (g.goal_id is null or g.abandoned and not exists (
      select 1 from public.phase2_savings_purchase_lines previous
      where previous.operation_id = p_operation and previous.goal_id = g.goal_id
    ))
  ) then
    raise exception 'GOAL_UNAVAILABLE' using errcode = '22023';
  end if;
  if (select coalesce(sum(i."grossCents"), 0)
      from jsonb_to_recordset(p_items) as i("grossCents" integer)) > payment_cents then
    raise exception 'PAYMENT_EXCEEDED' using errcode = '23514';
  end if;

  delete from public.phase2_savings_purchase_items where operation_id = p_operation and household_id = p_household;
  delete from public.phase2_savings_purchases where operation_id = p_operation and household_id = p_household;
  insert into public.phase2_savings_purchase_items (household_id, operation_id, line_id, position, goal_id,
    payment_date, payment_label, article, recipient, gross_cents, refunded_cents, livret_cents)
  select p_household, p_operation, (value->>'id')::uuid, ordinality, (value->>'goalId')::uuid, bank_date, bank_label,
    value->>'article', value->>'recipient', (value->>'grossCents')::integer, (value->>'refundedCents')::integer, (value->>'livretCents')::integer
  from jsonb_array_elements(p_items) with ordinality;

  if exists (select 1 from public.phase2_savings_goals g where g.household_id = p_household and g.goal_id = any(affected)
    and private.savings_livret_available(g.household_id, g.goal_id, g.allocations) < 0) then
    raise exception 'LIVRET_EXCEEDED' using errcode = '23514';
  end if;
  update public.phase2_savings_goals set revision = revision + 1 where household_id = p_household and goal_id = any(affected);
end;
$$;

notify pgrst, 'reload schema';
commit;
