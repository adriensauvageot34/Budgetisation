-- C7: allow moving the SAME prospective root to another projection month.
-- Existing household RLS and the date/month constraint still apply.
-- No new table, trigger, function, historical write or ownership grant.
grant update (target_month) on public.phase2_planned_expenses to authenticated;
