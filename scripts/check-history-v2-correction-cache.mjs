import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHc5Postgres } from "./lib/hc5-postgres.mjs";
import { produceHc5SyntheticMonth } from "./lib/hc5-synthetic-history.mjs";

// Existing gate supplies the TS loader and runs unchanged HC3/HC4 regressions.
const originalInfo = console.info;
console.info = () => {}; // Suppress per-row synthetic storage logs, not assertions.
await import("./check-history-v2-snapshot-materialization.mjs");
const require = createRequire(import.meta.url);
const use = (file) => require(path.resolve(file));
const { buildHistoryMonth, finalizeHistoryPublication } = use("src/server/analytics/materialization/history-rebuild.ts");
const { recordAnalyticsMutation } = use("src/server/analytics/materialization/mutation.ts");
const { SupabaseAnalyticsMaterializationStore } = use("src/server/analytics/materialization/store.ts");
const { SupabaseHistoryManifestStore } = use("src/server/analytics/materialization/history-manifest-store.ts");
const { readHistoryGenerationSignal } = use("src/server/query/history-generation.ts");
const { HistoryGenerationCache } = use("src/components/runtime/history-generation-cache.ts");
const { executeQuery } = use("src/query-api/server/execute-query.ts");
const { historyGenerationSignalSchema, parseHistoryGenerationRequest } = use("src/query-api/history-v2/generation-signal.ts");
const householdId = "00000000-0000-4000-8000-000000000001";
const month = "2026-05";
const sqlModule = process.env.HC5_PGLITE_MODULE ?? process.env.HC4_PGLITE_MODULE;
let checks = 0, dynamicCalls = 0, navigationWrites = 0, builds = 0;
const check = (fn) => { fn(); checks += 1; };
const reject = async (fn, pattern) => { await assert.rejects(fn, pattern); checks += 1; };
const monthDate = month + "-01";
const counters = { metadata: 0, payload: 0 };
const reports = [];
let exampleResponse;
check(() => assert.throws(() => parseHistoryGenerationRequest({ month, householdId })));
check(() => assert.throws(() => historyGenerationSignalSchema.parse({ householdId, month })));
check(() => assert.throws(() => historyGenerationSignalSchema.parse({ householdId, month, publicationId: undefined })));

async function environment() {
  const env = await createHc5Postgres(sqlModule, householdId, month);
  const { client, raw } = env;
  const context = async () => {
    const [revision] = await raw("select data_revision::text,analytics_revision::text from household_revisions");
    const [period] = await raw("select source_revision::text from analysis_periods");
    return {
      userId: "hc5-synthetic", householdId, persons: [], personIds: [], timezone: "Europe/Paris",
      dataRevision: revision.data_revision, analyticsRevision: revision.analytics_revision,
      contractVersion: "v1", asOf: "2026-09-04T12:00:00Z",
      periods: ["2026-04", month, "2026-06"].map((m) => ({
        analysisPeriodId: householdId, householdId, month: m + "-01", financeStatus: "complete",
        lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete", isClosed: true, sourceRevision: period.source_revision,
      })),
    };
  };
  const build = async () => {
    builds += 1;
    const captured = await context();
    const generation = await buildHistoryMonth({ client, context: captured, month, sourceRevision: captured.dataRevision,
      produce: () => produceHc5SyntheticMonth({ require, client, context: captured, month }) });
    return { generation, captured };
  };
  const finalize = (built) => finalizeHistoryPublication({ client, context: built.captured, generation: built.generation });
  const active = async (freshOnly = true) => raw(`select distinct publication_id from (
    select publication_id from analytics_query_snapshots where is_active ${freshOnly ? "and invalidated_at is null" : ""}
    union all select publication_id from analytics_artifacts where is_active ${freshOnly ? "and invalidated_at is null" : ""}
  ) x order by publication_id`);
  const truth = async (id) => (await raw(`select 'p' kind,to_jsonb(p) content from analytics_publications p where publication_id=$1
    union all select 'a',to_jsonb(a)-array['is_active','invalidated_at','invalidation_revision'] from analytics_artifacts a where publication_id=$1
    union all select 'q',to_jsonb(q)-array['is_active','invalidated_at','invalidation_revision'] from analytics_query_snapshots q where publication_id=$1`, [id]))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const read = async (request) => {
    const c = await context();
    const store = new SupabaseAnalyticsMaterializationStore(client, c);
    const transportRequest = { resource: request.resource, scope: request.scope, params: request.params };
    return executeQuery({ requestId: "hc5-query", request: transportRequest }, {
      resolveContext: () => ({ actor: { actorId: c.userId }, household: { householdId },
        revisions: { dataRevision: c.dataRevision, analyticsRevision: c.analyticsRevision, dependencies: [] }, contractVersion: "v2", now: c.asOf }),
      authorize: () => ({ granted: true }),
      sources: new Proxy({}, { get() { return () => { dynamicCalls += 1; throw new Error("Dynamic History forbidden"); }; } }),
      materialization: { readQuery: (request) => store.readQuery(request),
        writeQuery() { navigationWrites += 1; throw new Error("Navigation write forbidden"); },
        queryCachePolicy: (request, source) => store.queryCachePolicy(request, source) },
    });
  };
  const signal = async () => readHistoryGenerationSignal(client, await context(), month);
  const rollback = async (current, target) => {
    const c = await context();
    return raw("select * from restore_history_v2_publication($1,$2,$3,$4,$5)", [current, target, householdId, monthDate, c.analyticsRevision]);
  };
  return { ...env, context, build, finalize, active, truth, read, signal, rollback };
}

const env = await environment();
try {
  const { db, client, raw } = env;
  const p1 = await env.build();
  const p1id = p1.generation.stage.publicationId;
  check(() => assert.equal(p1.generation.status, "STAGED_INACTIVE"));
  check(() => assert.equal(p1.generation.stage.finalizeRequested, false));
  assert.deepEqual(await env.active(), []); checks += 1;
  await env.finalize(p1);
  const before = await env.truth(p1id);
  const request = (resource) => p1.generation.stage.queries.find((q) => q.request.resource === resource).request;
  const calendarRequest = request("history_month_calendar");
  const detailRequest = request("history_activity_detail");
  const summaryRequest = request("history_month_balance_summary");
  const cache = new HistoryGenerationCache(async () => { counters.metadata += 1; return env.signal(); });
  const cachedRead = (req) => cache.read(month, JSON.stringify(req), async () => {
    counters.payload += 1;
    const response = await env.read(req);
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.response;
  });
  const first = await cachedRead(calendarRequest);
  exampleResponse = first;
  const detail = await cachedRead(detailRequest);
  await cachedRead(summaryRequest);
  check(() => assert.equal(first.meta.publication.publicationId, p1id));
  check(() => assert.equal(detail.data.activity.occurrences, 1));
  const fetchedBefore = counters.payload;
  for (let i = 0; i < 3; i++) await Promise.all([cachedRead(calendarRequest), cachedRead(summaryRequest)]);
  check(() => assert.equal(counters.payload, fetchedBefore, "same generation retains payload cache"));
  check(() => assert.equal(builds, 1));
  const p1Context = await env.context();
  check(() => assert.equal(p1Context.analyticsRevision, "12"));
  // A failed synthetic correction rolls back source, revision, log and invalidation.
  await db.exec("begin");
  await client.rpc("hc5_correct_event", { h: householdId, e: "00000000-0000-4000-8000-000000000501", s: "À valider" });
  await recordAnalyticsMutation({ client, householdId, entityKind: "life_event",
    entityId: "00000000-0000-4000-8000-000000000501",
    impact: { kind: "month", month, reason: "canonical_data_changed" } });
  await db.exec("rollback");
  assert.deepEqual(await env.truth(p1id), before); checks += 1;
  assert.equal((await env.context()).dataRevision, "7"); checks += 1;
  assert.equal((await raw("select count(*)::int n from analytics_change_log"))[0].n, 0); checks += 1;
  assert.equal((await raw("select validation_status from life_events"))[0].validation_status, "Confirmé"); checks += 1;

  await db.exec("begin");
  const corrected = await client.rpc("hc5_correct_event", { h: householdId, e: "00000000-0000-4000-8000-000000000501", s: "À valider" });
  assert.equal(corrected.error, null);
  const correction = await recordAnalyticsMutation({ client, householdId, entityKind: "life_event",
    entityId: "00000000-0000-4000-8000-000000000501",
    impact: { kind: "month", month, reason: "canonical_data_changed" } });
  await db.exec("commit");
  check(() => assert.equal(correction.dataRevision, "8"));
  check(() => assert.equal(correction.invalidatedArtifactCount, 2));
  check(() => assert.equal(correction.invalidatedQueryCount, p1.generation.stage.queries.length));
  const log = await raw("select entity_kind,entity_id,affected_month::text,data_revision::text,impact_scope,processed_at from analytics_change_log");
  check(() => assert.deepEqual(log, [{ entity_kind: "life_event", entity_id: "00000000-0000-4000-8000-000000000501",
    affected_month: monthDate, data_revision: "8", impact_scope: "month", processed_at: null }]));
  assert.deepEqual(await env.truth(p1id), before); checks += 1;
  await reject(() => env.rollback(null, p1id), /Incomplete History V2 rollback target/);
  assert.deepEqual(await env.active(), []); checks += 1;
  for (const req of [calendarRequest, summaryRequest, detailRequest]) {
    const result = await env.read(req);
    check(() => assert.equal(result.ok, false));
    check(() => assert.equal(result.error.code, "TEMPORARY_UNAVAILABLE"));
  }
  await reject(() => cachedRead(calendarRequest), /Aucune génération History fraîche/);
  const p2 = await env.build();
  const p2id = p2.generation.stage.publicationId;
  check(() => assert.notEqual(p1id, p2id));
  check(() => assert.notEqual(p1.generation.preflight.manifest.publicationFactsHash, p2.generation.preflight.manifest.publicationFactsHash));
  check(() => assert.notEqual(p1.generation.preflight.manifest.manifestHash, p2.generation.preflight.manifest.manifestHash));
  const resourceHash = (built, resource) => built.generation.stage.queries.find((q) => q.request.resource === resource).data.resourceInputHash;
  check(() => assert.notEqual(resourceHash(p1, "history_month_calendar"), resourceHash(p2, "history_month_calendar")));
  check(() => assert.equal(resourceHash(p1, "history_month_spending_nature"), resourceHash(p2, "history_month_spending_nature")));
  check(() => assert.ok(!p2.generation.stage.queries.some((q) => q.request.resource === "history_activity_detail")));
  assert.deepEqual(await env.active(), []); checks += 1;
  assert.deepEqual(await env.truth(p1id), before); checks += 1;
  // Fail late, after the SQL active switches, proving transaction rollback.
  await db.exec(`reset role; create function hc5_fail_finalize() returns trigger language plpgsql as $$
    begin if new.status='published' then raise exception 'HC5 injected finalize failure'; end if; return new; end $$;
    create trigger zz_hc5_fail before update on analytics_publications for each row execute function hc5_fail_finalize(); set role service_role;`);
  await reject(() => env.finalize(p2), /HC5 injected/);
  assert.deepEqual(await env.active(false), [{ publication_id: p1id }]); checks += 1;
  assert.equal((await env.context()).analyticsRevision, "12"); checks += 1;
  assert.equal((await env.signal()).publicationId, null); checks += 1;
  await db.exec("reset role; drop trigger zz_hc5_fail on analytics_publications; drop function hc5_fail_finalize(); set role service_role");
  await env.finalize(p2);
  assert.deepEqual(await env.active(false), [{ publication_id: p2id }]); checks += 1;
  assert.equal((await env.context()).analyticsRevision, "13"); checks += 1;
  assert.deepEqual(await env.truth(p1id), before); checks += 1;
  const manifest = await new SupabaseHistoryManifestStore(client).read(householdId, p2id);
  check(() => assert.equal(manifest.manifest.manifestHash, p2.generation.preflight.manifest.manifestHash));
  const fresh = await cachedRead(calendarRequest);
  check(() => assert.equal(fresh.meta.publication.publicationId, p2id));
  check(() => assert.notDeepEqual(fresh.data, first.data));
  const fetchedAfter = counters.payload;
  await cachedRead(calendarRequest); await cachedRead(calendarRequest);
  check(() => assert.equal(counters.payload, fetchedAfter));
  const dropped = await env.read(detailRequest);
  check(() => assert.equal(dropped.ok, false));
  check(() => assert.equal(dropped.error.code, "TEMPORARY_UNAVAILABLE"));
  for (const { request } of p2.generation.stage.queries) {
    const read = await env.read(request);
    check(() => assert.equal(read.ok, true, JSON.stringify(read)));
    check(() => assert.equal(read.response.meta.publication.publicationId, p2id));
  }
  const p2truth = await env.truth(p2id);
  await reject(() => env.rollback(p2id, p1id), /Incomplete History V2 rollback target/);
  assert.deepEqual(await env.active(), [{ publication_id: p2id }]); checks += 1;
  assert.deepEqual(await env.truth(p1id), before); checks += 1;
  assert.deepEqual(await env.truth(p2id), p2truth); checks += 1;
  const invalidP1 = await raw("select count(*)::int n from analytics_query_snapshots where publication_id=$1 and not is_active and invalidated_at is not null", [p1id]);
  check(() => assert.equal(invalidP1[0].n, p1.generation.stage.queries.length));
  check(() => assert.equal(dynamicCalls, 0));
  check(() => assert.equal(navigationWrites, 0));
  check(() => assert.equal(builds, 2));
  reports.push({ scenario: "A_CORRECTION", status: "PASS", p1: p1id, p2: p2id, dataRevision: "7 -> 8",
    analyticsRevision: "11 -> 12 -> 12 -> 13", queryCounts: [p1.generation.stage.queries.length, p2.generation.stage.queries.length],
    manifestHashes: [p1.generation.preflight.manifest.manifestHash, p2.generation.preflight.manifest.manifestHash],
    factsHashes: [p1.generation.preflight.manifest.publicationFactsHash, p2.generation.preflight.manifest.publicationFactsHash], counters });
} finally { await env.db.close(); }

const operational = await environment();
try {
  const p1 = await operational.build(); await operational.finalize(p1);
  const p1id = p1.generation.stage.publicationId;
  const before = await operational.truth(p1id);
  const p2 = await operational.build(); await operational.finalize(p2);
  const p2id = p2.generation.stage.publicationId;
  const p2truth = await operational.truth(p2id);
  await operational.rollback(p2id, p1id);
  assert.deepEqual(await operational.active(), [{ publication_id: p1id }]); checks += 1;
  assert.deepEqual(await operational.truth(p1id), before); checks += 1;
  assert.deepEqual(await operational.truth(p2id), p2truth); checks += 1;
  assert.equal((await operational.signal()).publicationId, p1id); checks += 1;
  assert.equal((await operational.context()).analyticsRevision, "14"); checks += 1;
  assert.equal((await operational.context()).dataRevision, "7"); checks += 1;
  reports.push({ scenario: "B_OPERATIONAL_ROLLBACK", status: "PASS", p1: p1id, p2: p2id,
    dataRevision: "7 unchanged", analyticsRevision: "11 -> 12 -> 13 -> 14" });
} finally { await operational.db.close(); }

// Discriminating transport/cache races using the same production cache class.
const id1 = "00000000-0000-4000-8000-000000001001";
const id2 = "00000000-0000-4000-8000-000000001002";
const idApril = "00000000-0000-4000-8000-000000001003";
const responseFor = (id) => ({ ...exampleResponse, meta: {
  ...exampleResponse.meta, publication: { ...exampleResponse.meta.publication, publicationId: id },
} });
let liveId = id1, probes = 0, fetches = 0, offline = false;
const session = new HistoryGenerationCache(async (requestedMonth) => {
  probes += 1;
  if (offline) throw new Error("Offline metadata");
  return { householdId, month: requestedMonth, publicationId: requestedMonth === month ? liveId : idApril };
});
const fetchLive = async () => { fetches += 1; return responseFor(liveId); };
await session.read(month, "calendar", fetchLive);
await session.read("2026-04", "april", async () => { fetches += 1; return responseFor(idApril); });
const payloadCount = fetches;
const probeCount = probes;
await Promise.all([session.read(month, "calendar", fetchLive), session.read(month, "calendar", fetchLive)]);
check(() => assert.equal(fetches, payloadCount));
check(() => assert.equal(probes, probeCount + 1, "concurrent same-month checks coalesced"));
liveId = id2;
const next = await session.read(month, "calendar", fetchLive, responseFor(id1));
check(() => assert.equal(next.meta.publication.publicationId, id2, "old RSC cannot seed P1 after P2"));
await session.read("2026-04", "april", async () => { throw new Error("unaffected month was evicted"); });
checks += 1;
offline = true;
await reject(() => session.read(month, "calendar", fetchLive), /Offline metadata/);
check(() => assert.equal(session.matches(month, next), false, "metadata failure revokes P1/P2 current eligibility"));
offline = false;
liveId = id1;
let deliverLate;
const pending = session.read(month, "late", () => new Promise((resolve) => { deliverLate = resolve; }));
while (!deliverLate) await new Promise((resolve) => setImmediate(resolve));
const lateRefused = reject(() => pending, /génération History a changé/);
liveId = id2;
await session.check(month);
deliverLate(responseFor(id1));
await lateRefused;
const lateNext = await session.read(month, "late", fetchLive);
check(() => assert.equal(lateNext.meta.publication.publicationId, id2));
const badMonth = new HistoryGenerationCache(async () => ({ householdId, month: "2026-04", publicationId: id1 }));
await reject(() => badMonth.check(month), /month mismatch/);
const noMeta = new HistoryGenerationCache(async () => ({ householdId, month, publicationId: id1 }));
await reject(() => noMeta.read(month, "bad-meta", async () => ({ ...exampleResponse, meta: { ...exampleResponse.meta, publication: undefined } })), /génération History a changé/);
reports.push({ scenario: "CACHE_RACES", status: "PASS", probes, fetches, unchangedPayloadRefetch: 0,
  cases: ["coalescing", "old RSC", "targeted month", "offline fail-closed", "late P1 rejected", "missing PublicationMeta", "wrong month"] });

const result = { gate: "PASS", checks, reports, dynamicCalls, navigationWrites,
  live: "NOT_TOUCHED", migration: "TEST_DATABASE_ONLY", limitation: "Synthetic Canonical mutation/bump prerequisites; not live schema certification." };
if (process.env.HC5_REPORT_FILE) fs.writeFileSync(process.env.HC5_REPORT_FILE, JSON.stringify(result, null, 2) + "\n");
console.log("HC5_RESULT " + JSON.stringify(result));
console.info = originalInfo;
