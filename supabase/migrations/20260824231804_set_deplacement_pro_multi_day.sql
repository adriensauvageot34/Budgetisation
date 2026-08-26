update public.life_event_types
set can_span_days = true
where type_key = 'deplacement_pro'
  and can_span_days is false;
