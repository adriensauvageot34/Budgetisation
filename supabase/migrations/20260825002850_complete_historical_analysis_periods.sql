update public.analysis_periods
set
  finance_status = 'complete',
  life_status = 'complete',
  location_status = 'complete',
  calendar_status = 'complete',
  is_closed = true
where month >= date '2025-08-01'
  and month <= date '2026-07-01'
  and (
    finance_status is distinct from 'complete'
    or life_status is distinct from 'complete'
    or location_status is distinct from 'complete'
    or calendar_status is distinct from 'complete'
    or is_closed is distinct from true
  );
