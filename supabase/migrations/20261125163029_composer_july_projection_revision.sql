begin;

-- Version the presentation sources beyond the transactional Composer basis.
create function public.composer_july_projection_revision_v1(p_household uuid)
returns text
language sql stable security invoker
set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(
    r.data_revision,
    r.analytics_revision,
    v.payload,
    (select jsonb_agg(to_jsonb(p) order by p.place_id) from public.referentiel_lieu p),
    (select jsonb_agg(to_jsonb(a) order by a.activity_key) from public.merchant_activities a),
    (select jsonb_agg(to_jsonb(a) order by a.merchant_place_alias_id) from public.merchant_place_aliases a),
    (select jsonb_agg(to_jsonb(l) order by l.moment_id, l.life_event_id) from public.moment_life_events l)
  )::text, 'UTF8')), 'hex')
  from public.household_revisions r
  left join public.composer_realized_reviews v on v.household_id = r.household_id
    and v.target_month = '2026-07-01'
  where r.household_id = p_household
    and exists (
      select 1 from public.canonical_household_scope_control scope
      where scope.household_id = r.household_id and scope.household_count = 1 and scope.status = 'READY'
    );
$$;

revoke all on function public.composer_july_projection_revision_v1(uuid) from public, anon, authenticated;
grant execute on function public.composer_july_projection_revision_v1(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
