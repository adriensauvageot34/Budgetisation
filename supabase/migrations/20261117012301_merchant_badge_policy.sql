alter table public.merchants
  add column badge_policy text not null default 'normal',
  add constraint merchants_badge_policy_check check (badge_policy in ('normal', 'reuse_only', 'none'));

comment on column public.merchants.badge_policy is
  'Visual policy only: normal allows specific visuals, reuse_only allows shared or generic visuals, none suppresses all illustrations.';

notify pgrst, 'reload schema';
