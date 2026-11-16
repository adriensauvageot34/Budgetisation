-- Explicit private choices. Never a Draft, purchase, reservation or financial writer.
create table public.composer_private_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_key text not null check (length(subject_key)<=140 and subject_key ~ '^(v22-art:[a-z0-9:-]+|preset:[a-z0-9-]+)$'),
  scope_key text not null default 'GLOBAL' check (scope_key='GLOBAL' or scope_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  label text not null check (length(btrim(label)) between 1 and 120),
  scope_label text not null check (length(btrim(scope_label)) between 1 and 120),
  stance text not null check (stance in ('LIKE','DISMISS')),
  review_on date check (review_on between date '2000-01-01' and date '2099-12-31'),
  version integer not null default 1 check (version>0),
  updated_at timestamptz not null default now(),
  primary key (user_id,subject_key,scope_key)
);
alter table public.composer_private_preferences enable row level security;
revoke all on public.composer_private_preferences from public, anon, authenticated;
grant select,insert,update,delete on public.composer_private_preferences to authenticated;
create policy composer_preference_owner on public.composer_private_preferences to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
