-- Cover the nullable place foreign keys reported by the database advisor.
begin;

create index mobility_trips_start_place_idx
  on public.mobility_trips (start_place_id);
create index mobility_trips_end_place_idx
  on public.mobility_trips (end_place_id);

commit;
