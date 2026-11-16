-- Presentation metadata only. Existing IDs and financial facts remain authoritative.
alter table public.merchants
  add column identity_kind text not null default 'unknown',
  add column identity_classified_at timestamptz,
  add column identity_source text,
  add column visual_brand_merchant_id uuid references public.merchants (merchant_id),
  add constraint merchants_identity_kind_check
    check (identity_kind in ('commercial', 'private_person', 'personal_transfer_label', 'unknown')),
  add constraint merchants_identity_confirmation_check check (
    (
      identity_kind = 'unknown'
      and identity_classified_at is null
      and identity_source is null
    ) or (
      identity_kind <> 'unknown'
      and identity_classified_at is not null
      and identity_source is not null
      and identity_source in ('owner_confirmed', 'merchant_review')
    )
  ),
  add constraint merchants_visual_brand_merchant_check check (
    visual_brand_merchant_id is null
    or (identity_kind = 'commercial' and visual_brand_merchant_id <> merchant_id)
  );

comment on column public.merchants.identity_kind is
  'Type de contrepartie affiché. commercial couvre les enseignes et organismes du référentiel. Sans incidence sur les flux.';
comment on column public.merchants.identity_source is
  'Origine de validation de la classification. Les identités à examiner restent unknown.';
comment on column public.merchants.visual_brand_merchant_id is
  'Référence explicite au badge commun. Ne remplace ni le marchand canonique ni le lieu du paiement.';

notify pgrst, 'reload schema';
