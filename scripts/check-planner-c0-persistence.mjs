import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { plannerModule } from "./lib/planner-fixture-modules.mjs";
import { householdId, otherHouseholdId, userId, otherUserId, state, evidence, semanticStateDigest } from "./fixtures/planner-c0.mjs";

// Actual PostgreSQL executing the unmodified migration; no Supabase stack, network, env or personal data.
const db = new PGlite(), passed = [];
const migration = fs.readFileSync("supabase/migrations/20261005202346_phase2_month_plan_foundation.sql", "utf8");
const test = async (id, run) => { await run(); passed.push(id); };
const jsonArg = value => value === null ? null : JSON.stringify(value);
const request = (patch = {}) => ({ household_id: householdId, target_month: "2026-11-01", expected_active_revision_id: null,
  expected_active_revision_number: 0, apply_request_id: randomUUID(), ...structuredClone(evidence), ...patch });
const columns = ["household_id", "target_month", "expected_active_revision_id", "expected_active_revision_number", "apply_request_id",
  "baseline_digest", "baseline_snapshot", "semantic_state", "semantic_state_digest", "change_set", "compiled_manifest",
  "compiled_manifest_digest", "projection_evidence", "preview_digest", "compiler_version", "model_versions"];
const jsonColumns = new Set(["baseline_snapshot", "semantic_state", "change_set", "compiled_manifest", "projection_evidence", "model_versions"]);
const call = async value => (await db.query(`select public.apply_phase2_month_plan_v1(${columns.map((_, i) => `$${i + 1}`).join(",")}) as result`,
  columns.map(column => jsonColumns.has(column) ? jsonArg(value[column]) : value[column]))).rows[0].result;
const counts = async () => (await db.query(`select (select count(*)::int from public.phase2_month_plans) plans,
  (select count(*)::int from public.phase2_month_plan_revisions) revisions`)).rows[0];
const asUser = async (id, role = "authenticated") => {
  await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  await db.exec(`set role ${role}`);
};
const owner = () => db.exec("reset role");
const reject = (run, code, message) => assert.rejects(run, error => error.code === code && (!message || error.message.includes(message)));

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create table public.households(household_id uuid primary key);
    create table private.household_memberships(user_id uuid not null,household_id uuid not null,primary key(user_id,household_id));
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function private.user_has_household_access(p_household_id uuid) returns boolean
      language sql stable security definer set search_path = '' as $$
        select exists(select 1 from private.household_memberships hm where hm.user_id=(select auth.uid()) and hm.household_id=p_household_id) $$;
    grant usage on schema public,auth,private to authenticated,anon,service_role;
    grant execute on function private.user_has_household_access(uuid) to authenticated;`);
  await db.query("insert into auth.users values ($1),($2)", [userId, otherUserId]);
  await db.query("insert into public.households values ($1),($2)", [householdId, otherHouseholdId]);
  await db.query("insert into private.household_memberships values ($1,$2),($3,$4)", [userId, householdId, otherUserId, otherHouseholdId]);
  // Canary tables abort any accidental write by the privileged RPC, including truncate.
  for (const table of ["operations", "purchase_events", "mobility_fixture", "analytics_fixture", "phase2_month_inputs", "phase2_planned_expenses", "benefit_wallet_fixture", "household_revisions"]) {
    await db.exec(`create table public.${table}(fixture_id integer primary key); insert into public.${table} values(1);
      create function private.deny_${table}_write() returns trigger language plpgsql as $$begin raise exception 'HISTORICAL_WRITE_FORBIDDEN'; end;$$;
      create trigger deny_write before insert or update or delete on public.${table} for each row execute function private.deny_${table}_write();
      create trigger deny_truncate before truncate on public.${table} for each statement execute function private.deny_${table}_write();`);
  }
  await db.exec(migration);
  await asUser(userId);
  const firstRequest = request(), first = await call(firstRequest);
  assert.equal(first.replayed, false);
  const parsedFirst = plannerModule("plan-contract").parsePlanRevisionRow(first.revision);
  assert.equal(parsedFirst.revisionNumber, 1);

  await test("PLN-001", async () => {
    assert.equal((await counts()).plans, 1);
    assert.equal((await db.query("select count(*)::int n from public.phase2_month_plans where household_id=$1 and target_month=$2", [householdId, "2026-11-01"])).rows[0].n, 1);
    await owner();
    await reject(() => db.query("insert into public.phase2_month_plans(household_id,target_month,created_by,updated_by) values($1,$2,$3,$3)", [householdId, "2026-11-01", userId]), "23505");
    await asUser(userId);
  });
  await test("PLN-002", async () => {
    for (const sql of ["update public.phase2_month_plan_revisions set compiler_version='tampered'", "delete from public.phase2_month_plan_revisions", "truncate public.phase2_month_plan_revisions cascade"]) {
      await owner(); await reject(() => db.exec(sql), "55000", "IMMUTABLE"); await asUser(userId);
      await reject(() => db.exec(sql), "42501");
    }
    for (const table of ["phase2_month_plans", "phase2_month_plan_revisions"]) {
      await reject(() => db.exec(`insert into public.${table} default values`), "42501");
    }
  });
  await test("PLN-003", async () => {
    const before = await counts();
    await reject(() => call(request()), "40001", "ACTIVE_REVISION_STALE");
    await reject(() => call(request({ expected_active_revision_id: first.revision.plan_revision_id, expected_active_revision_number: 2 })), "40001");
    assert.deepEqual(await counts(), before);
  });
  await test("PLN-004", async () => {
    const replay = await call(firstRequest);
    assert.equal(replay.replayed, true); assert.deepEqual(replay.revision, first.revision);
    assert.deepEqual(replay.plan, first.plan);
    const before = await counts();
    await reject(() => call({ ...firstRequest, compiler_version: "different@v1" }), "22023", "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(await counts(), before);
  });
  await test("PLN-005", async () => {
    const before = await counts();
    // Failure after creating a new aggregate must roll it back too.
    await reject(() => call(request({ target_month: "2026-12-01", semantic_state: { ...state, targetMonth: "2026-12" }, baseline_digest: null })), "23502");
    assert.deepEqual(await counts(), before);
    await reject(() => call(request({ target_month: "2026-12-01", semantic_state: { ...state, targetMonth: "2026-12" },
      expected_active_revision_id: randomUUID(), expected_active_revision_number: 1 })), "40001");
    assert.deepEqual(await counts(), before);
    await owner();
    await db.exec(`create function private.fixture_fail_pointer_update() returns trigger language plpgsql as $$begin raise exception 'FIXTURE_AFTER_REVISION_FAILURE';end;$$;
      create trigger fixture_fail_pointer before update on public.phase2_month_plans for each row execute function private.fixture_fail_pointer_update();`);
    await asUser(userId);
    await reject(() => call(request({ expected_active_revision_id: first.revision.plan_revision_id, expected_active_revision_number: 1 })), "P0001", "FIXTURE_AFTER_REVISION_FAILURE");
    assert.deepEqual(await counts(), before);
    assert.deepEqual((await db.query("select to_jsonb(p) as row from public.phase2_month_plans p")).rows[0].row, first.plan);
    await owner(); await db.exec("drop trigger fixture_fail_pointer on public.phase2_month_plans"); await asUser(userId);
  });
  let second, third;
  await test("PLN-006", async () => {
    const differentState = { ...state, controls: [], contexts: [] };
    second = await call(request({ expected_active_revision_id: first.revision.plan_revision_id, expected_active_revision_number: 1,
      semantic_state: differentState, semantic_state_digest: semanticStateDigest(differentState) }));
    third = await call(request({ expected_active_revision_id: second.revision.plan_revision_id, expected_active_revision_number: 2 }));
    assert.equal(third.revision.revision_number, 3);
    assert.equal(third.revision.parent_revision_id, second.revision.plan_revision_id);
    assert.equal(third.revision.semantic_state_digest, first.revision.semantic_state_digest);
    assert.notEqual(third.revision.plan_revision_id, first.revision.plan_revision_id);
    assert.deepEqual((await db.query("select to_jsonb(r) as row from public.phase2_month_plan_revisions r where plan_revision_id=$1", [first.revision.plan_revision_id])).rows[0].row, first.revision);
    const lateReplay = await call(firstRequest);
    assert.deepEqual(lateReplay.revision, first.revision); assert.equal(lateReplay.plan.active_revision_number, 3);
  });
  await test("C0-RLS-001", async () => {
    await asUser(otherUserId);
    assert.equal((await db.query("select * from public.phase2_month_plans")).rows.length, 0);
    assert.equal((await db.query("select * from public.phase2_month_plan_revisions")).rows.length, 0);
    await reject(() => call(firstRequest), "42501", "ACCESS_DENIED");
    const foreign = await call(request({ household_id: otherHouseholdId }));
    assert.notEqual(foreign.plan.plan_id, first.plan.plan_id);
    await asUser(userId);
    assert.equal((await db.query("select * from public.phase2_month_plans")).rows.length, 1);
    await reject(() => call(request({ household_id: otherHouseholdId })), "42501");
    for (const role of ["anon", "service_role"]) {
      await asUser(userId, role);
      await reject(() => call(firstRequest), "42501");
      await reject(() => db.exec("select * from public.phase2_month_plans"), "42501");
    }
    await asUser(null);
    await reject(() => call(firstRequest), "42501", "ACCESS_DENIED");
    await asUser(userId);
  });
  await test("C0-SQL-PARSE", async () => {
    const before = await counts();
    const base = { expected_active_revision_id: third.revision.plan_revision_id, expected_active_revision_number: 3 };
    for (const semantic of [null, {}, { ...state, version: "month-plan-state@v2" }, { ...state, layout: {} },
      { ...state, contexts: [state.contexts[0], state.contexts[0]] },
      { ...state, contexts: [{ ...state.contexts[0], parentContextOccurrenceId: state.contexts[0].contextOccurrenceId }] },
      { ...state, controls: [{ ...state.controls[0], value: null }] },
      { ...state, controls: [{ ...state.controls[0], provenance: "PERSONAL_SUGGESTION" }] }]) {
      await reject(() => call(request({ ...base, semantic_state: semantic })), "22023", "PAYLOAD_INVALID");
    }
    for (const patch of [{ change_set: [null] }, { model_versions: { fixture: null } }, { target_month: "2026-11-02" }])
      await reject(() => call(request({ ...base, ...patch })), "22023");
    assert.deepEqual(await counts(), before);
  });
  await test("PLN-007", async () => {
    await owner();
    const mutations = [...migration.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+(public\.[a-z_][a-z_0-9]*)/giu)].map(match => match[1]);
    assert(mutations.length >= 3);
    assert(mutations.every(table => ["public.phase2_month_plans", "public.phase2_month_plan_revisions"].includes(table)));
    assert.equal((migration.match(/create table /gu) ?? []).length, 2);
    for (const table of ["operations", "purchase_events", "mobility_fixture", "analytics_fixture", "phase2_month_inputs", "phase2_planned_expenses", "benefit_wallet_fixture", "household_revisions"])
      assert.deepEqual((await db.query(`select * from public.${table}`)).rows, [{ fixture_id: 1 }]);
    const publicRpc = (await db.query("select prosecdef from pg_proc where oid='public.apply_phase2_month_plan_v1(uuid,date,uuid,integer,uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,text,text,jsonb)'::regprocedure")).rows[0];
    assert.equal(publicRpc.prosecdef, false);
  });
  console.log(JSON.stringify({ suite: "planner-c0-persistence", engine: "PostgreSQL 18.3 / PGlite 0.5.8", passed,
    migrationAppliedTo: "in-memory synthetic fixture only", zeroLiveWrites: true, multiConnectionContention: "not tested by single-connection PGlite" }));
} finally { await db.close(); }
