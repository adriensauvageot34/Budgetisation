begin;

create table private.composer_realized_snapshots (
  household_id uuid not null references public.households(household_id) on delete cascade,
  target_month date not null check (
    extract(day from target_month) = 1
    and target_month between '2025-08-01' and '2026-06-01'
  ),
  kind text not null check (kind in ('board', 'calendar')),
  projection text not null,
  source_stamp text not null,
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload->>'month' = to_char(target_month, 'YYYY-MM')
    and jsonb_typeof(payload->'cards') = 'array'
    and octet_length(payload::text) <= 8388608
  ),
  published_at timestamptz not null default now(),
  primary key (household_id, target_month, kind, projection)
);

alter table private.composer_realized_snapshots enable row level security;
revoke all on private.composer_realized_snapshots from public, anon, authenticated, service_role;

-- Fence canonical commits and presentation corrections, even if published outside Composer.
create function private.composer_realized_source_stamp(p_household uuid, p_month date)
returns text
language sql stable
set search_path = ''
as $$
  select md5(jsonb_build_array(
    r.data_revision, a.source_revision, b.revision, b.schema_epoch,
    coalesce(md5(v.payload::text), '')
  )::text)
  from public.analysis_periods a
  join public.household_revisions r on r.household_id = a.household_id
  cross join private.composer_historical_basis_state b
  left join public.composer_realized_reviews v on v.household_id = a.household_id and v.target_month = a.month
  where a.household_id = p_household and a.month = p_month and a.is_closed
    and a.finance_status = 'complete'
    and b.singleton and b.enabled;
$$;

create function public.read_composer_realized_snapshot_v1(
  p_household uuid, p_month date, p_kind text, p_projection text
)
returns table (source_stamp text, payload jsonb)
language sql stable security definer
set search_path = ''
as $$
  select current_stamp.value, s.payload
  from (select private.composer_realized_source_stamp(p_household, p_month) as value) current_stamp
  left join private.composer_realized_snapshots s
    on s.household_id = p_household and s.target_month = p_month and s.kind = p_kind
    and s.projection = p_projection and s.source_stamp = current_stamp.value
  where p_month between '2025-08-01' and '2026-06-01'
    and p_kind in ('board', 'calendar') and current_stamp.value is not null;
$$;

create function public.publish_composer_realized_snapshot_v1(
  p_household uuid, p_month date, p_kind text, p_projection text, p_stamp text, p_payload jsonb
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  -- A snapshot can become stale after publication, but readers then ignore it.
  if p_stamp is null or p_stamp is distinct from private.composer_realized_source_stamp(p_household, p_month) then
    return false;
  end if;
  insert into private.composer_realized_snapshots as existing
    (household_id, target_month, kind, projection, source_stamp, payload)
  values (p_household, p_month, p_kind, p_projection, p_stamp, p_payload)
  on conflict (household_id, target_month, kind, projection) do update
    set source_stamp = excluded.source_stamp, payload = excluded.payload, published_at = now()
    where existing.source_stamp is distinct from excluded.source_stamp;
  return true;
end;
$$;

revoke all on function private.composer_realized_source_stamp(uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.read_composer_realized_snapshot_v1(uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.publish_composer_realized_snapshot_v1(uuid, date, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.read_composer_realized_snapshot_v1(uuid, date, text, text) to service_role;
grant execute on function public.publish_composer_realized_snapshot_v1(uuid, date, text, text, text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
