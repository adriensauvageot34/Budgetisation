create function public.composer_merchant_suggestions()
returns table (
  merchant_id uuid,
  label text,
  activity_key text,
  activity text,
  badge_policy text,
  visual_brand_merchant_id uuid,
  generic_badge_category text,
  purchase_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with purchases as (
    select o.merchant_id, count(*) as purchase_count, max(o.date_bancaire) as last_purchase
    from public.operations o
    where o.merchant_id is not null
      and o.flux = 'Dépense'
      and o.statut is distinct from 'Hors budget'
    group by o.merchant_id
  )
  select m.merchant_id,
    coalesce(nullif(btrim(m.commercial_display_name), ''), m.nom_canonique) as label,
    m.activity_key,
    coalesce(a.label, 'Commerce') as activity,
    m.badge_policy,
    brand.merchant_id,
    coalesce(m.generic_badge_category, a.badge_category),
    coalesce(p.purchase_count, 0)
  from public.merchants m
  left join public.merchant_activities a on a.activity_key = m.activity_key
  left join public.merchants brand on brand.merchant_id = m.visual_brand_merchant_id
    and brand.identity_kind = 'commercial' and brand.badge_policy = 'normal' and brand.visual_brand_merchant_id is null
  left join purchases p on p.merchant_id = m.merchant_id
  where m.identity_kind = 'commercial' and m.badge_policy <> 'none' and not m.activity_review_required
  order by p.purchase_count desc nulls last, p.last_purchase desc nulls last, label, m.merchant_id
$$;

revoke all on function public.composer_merchant_suggestions() from public, anon, authenticated;
grant execute on function public.composer_merchant_suggestions() to service_role;
notify pgrst, 'reload schema';
