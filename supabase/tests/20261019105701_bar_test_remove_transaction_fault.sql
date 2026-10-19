-- Applied only to wlndjknwbceaqrqcwbqw after its transaction-rollback test.
-- No production migration; no retained favourite, request or identity is deleted.
begin;
set local lock_timeout='5s';
drop trigger bar_test_fault on private.personal_google_place_requests;
drop function private.bar_test_reject_journal();
commit;
