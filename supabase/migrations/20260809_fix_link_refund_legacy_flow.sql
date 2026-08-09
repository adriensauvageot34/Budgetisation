begin;

create or replace function public.link_refund_operation(
  refund_operation_id uuid,
  expense_operation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_household_id uuid;
  refund_amount numeric;
  refund_flow text;
  refund_resource_type text;
  expense_household_id uuid;
  expense_amount numeric;
  expense_flow text;
  expense_resource_type text;
begin
  if refund_operation_id = expense_operation_id then
    raise exception 'Une opération ne peut pas se rembourser elle-même.';
  end if;

  select operation.household_id, operation.amount, operation.flow, operation.resource_type
  into refund_household_id, refund_amount, refund_flow, refund_resource_type
  from public.operations operation
  where operation.id = refund_operation_id;

  if
    refund_household_id is null
    or not private.is_household_member(refund_household_id)
  then
    raise exception 'Remboursement introuvable ou non autorisé.';
  end if;

  if
    refund_amount <= 0
    or (
      refund_resource_type is distinct from 'Remboursement'
      and refund_flow is distinct from 'Remboursement'
    )
  then
    raise exception 'Le flux sélectionné n’est pas un remboursement entrant.';
  end if;

  select
    operation.household_id,
    operation.amount,
    operation.flow,
    operation.resource_type
  into
    expense_household_id,
    expense_amount,
    expense_flow,
    expense_resource_type
  from public.operations operation
  where operation.id = expense_operation_id;

  if expense_household_id is null or expense_household_id <> refund_household_id then
    raise exception 'Dépense introuvable ou non autorisée.';
  end if;

  if
    expense_flow <> 'Dépense'
    or expense_amount >= 0
    or expense_resource_type in ('Transfert interne', 'Flux technique')
  then
    raise exception 'La cible doit être une dépense de consommation.';
  end if;

  update public.operations operation
  set
    resource_type = 'Remboursement',
    reimburses_operation_id = expense_operation_id
  where operation.id = refund_operation_id;

  return refund_operation_id;
end;
$$;

revoke all on function public.link_refund_operation(uuid, uuid)
  from public, anon;
grant execute on function public.link_refund_operation(uuid, uuid)
  to authenticated;

commit;
