begin;

create table public.phase2_savings_purchase_items (
  household_id uuid not null references public.households(household_id),
  operation_id uuid not null references public.operations(operation_id) on delete cascade,
  line_id uuid not null,
  position integer not null check (position between 1 and 50),
  goal_id uuid references public.phase2_savings_goals(goal_id),
  payment_date date not null,
  payment_label text not null check (char_length(payment_label) between 1 and 160),
  article text not null check (char_length(btrim(article)) between 1 and 120),
  recipient text check (char_length(btrim(recipient)) between 1 and 80),
  gross_cents integer not null check (gross_cents between 1 and 99999999),
  refunded_cents integer not null check (refunded_cents between 0 and gross_cents),
  primary key (operation_id, line_id),
  unique (operation_id, position)
);
create index phase2_savings_purchase_items_household_date
  on public.phase2_savings_purchase_items (household_id, payment_date);
create index phase2_savings_purchase_items_goal
  on public.phase2_savings_purchase_items (goal_id) where goal_id is not null;

alter table public.phase2_savings_purchase_items enable row level security;
revoke all on public.phase2_savings_purchase_items from public, anon, authenticated, service_role;
grant select on public.phase2_savings_purchase_items to authenticated;
grant select, insert, delete on public.phase2_savings_purchase_items to service_role;
create policy savings_purchase_items_read on public.phase2_savings_purchase_items
  for select to authenticated using ((select private.user_has_household_access(household_id)));

create view public.phase2_savings_purchase_lines with (security_invoker = true) as
select household_id, operation_id, line_id, position, goal_id, payment_date, payment_label,
  article, recipient, gross_cents, refunded_cents, gross_cents - refunded_cents as cents
from public.phase2_savings_purchase_items
union all
select p.household_id, p.operation_id, p.goal_id,
  (row_number() over (partition by p.operation_id order by p.goal_id))::integer,
  p.goal_id, p.payment_date, p.payment_label, left(p.payment_label, 120), null::text, p.cents, 0, p.cents
from public.phase2_savings_purchases p
where not exists (select 1 from public.phase2_savings_purchase_items i where i.operation_id = p.operation_id);

revoke all on public.phase2_savings_purchase_lines from public, anon, authenticated, service_role;
grant select on public.phase2_savings_purchase_lines to authenticated, service_role;

create function public.set_phase2_savings_purchase_items(
  p_household uuid, p_operation uuid, p_expected jsonb, p_items jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  payment_cents bigint;
  bank_date date;
  bank_label text;
  existing jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_typeof(p_expected) is distinct from 'array' then
    raise exception 'INVALID_LINES' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 or jsonb_array_length(p_expected) > 100 then
    raise exception 'INVALID_LINES' using errcode = '22023';
  end if;

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
    'recipient', recipient, 'grossCents', gross_cents, 'refundedCents', refunded_cents) order by position), '[]'::jsonb)
  into existing from public.phase2_savings_purchase_lines
  where operation_id = p_operation and household_id = p_household;
  if p_items = existing then return; end if;
  if p_expected <> existing then
    raise exception 'PURCHASE_CHANGED' using errcode = '40001';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(id uuid, "goalId" uuid, article text, recipient text,
      "grossCents" integer, "refundedCents" integer)
    left join public.phase2_savings_goals g on g.goal_id = i."goalId" and g.household_id = p_household
    where i."goalId" is not null and g.goal_id is null
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
    payment_date, payment_label, article, recipient, gross_cents, refunded_cents)
  select p_household, p_operation, (value->>'id')::uuid, ordinality, (value->>'goalId')::uuid, bank_date, bank_label,
    value->>'article', value->>'recipient', (value->>'grossCents')::integer, (value->>'refundedCents')::integer
  from jsonb_array_elements(p_items) with ordinality;
end;
$$;

revoke all on function public.set_phase2_savings_purchase_items(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.set_phase2_savings_purchase_items(uuid, uuid, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
