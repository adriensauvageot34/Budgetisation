begin;

alter table public.phase2_savings_goals add column travel_topic text
  check (travel_topic in ('flights', 'bags', 'equipment', 'documents', 'other'));

grant update (travel_topic) on public.phase2_savings_goals to authenticated;

update public.phase2_savings_goals
set travel_topic = case
    when template_key in ('flight-adrien', 'flight-manon') then 'flights'
    when template_key in ('bag-adrien', 'bag-manon') then 'bags'
    when template_key = 'travel-equipment' then 'equipment'
    when template_key = 'passport-adrien' then 'documents'
  end,
  revision = revision + 1
where project = 'travel'
  and template_key in ('flight-adrien', 'flight-manon', 'bag-adrien', 'bag-manon', 'travel-equipment', 'passport-adrien');

notify pgrst, 'reload schema';
commit;
