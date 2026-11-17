alter table public.composer_badge_visuals
  add column bundled_asset_key text check (
    bundled_asset_key ~ '^(merchants|categories):[a-z0-9-]+$'
  );

comment on column public.composer_badge_visuals.bundled_asset_key is
  'Private selection from the shipped Clay catalog. Existing owner policies and optimistic version checks apply.';

notify pgrst, 'reload schema';
