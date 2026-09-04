import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Called from the materialization gate, sharing its real 15-resource synthetic fixture.
// Optional SQL engine is installed OUTSIDE the repository; never a Supabase instance.
export async function checkHistoryFrozenPublication({ materialization, preflight, runtimeContext, require }) {
  let checks = 0;
  const check = (fn) => { fn(); checks += 1; };
  const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); checks += 1; };
  const rebuild = require(path.resolve("src/server/analytics/materialization/history-rebuild.ts"));
  const { SupabaseAnalyticsMaterializationStore } = require(path.resolve("src/server/analytics/materialization/store.ts"));
  const manifestBody = { ...preflight.manifest, implementation: { status: "KNOWN", gitSha: "a".repeat(40), digest: "b".repeat(64) } };
  delete manifestBody.manifestHash;
  const certifiedPreflight = { ...preflight, manifest: { ...manifestBody, manifestHash: materialization.historyV2ManifestDigest(manifestBody) } };
  // Workflow tests use the materialization gate's synthetic, already schema-checked
  // data. This receipt is test-only, not a claim of historical/live certification.
  const receipt = { mode: "READ_ONLY", gate: "PASS", householdId: runtimeContext.householdId,
    sourceRevision: runtimeContext.dataRevision, month: preflight.manifest.month,
    manifestHash: certifiedPreflight.manifest.manifestHash,
    checks: ["F01_ACTUAL_COMMON", "F02_DAILY_RECONCILIATION", "F03_DAYS_PLUS_UNASSIGNED",
      "X_MANIFEST_15_RESOURCES", "X_RUNTIME_SCHEMAS", "X_HASHES", "D01_DETERMINISM", "X_PUBLICATION_META"].map((id) => ({ id, status: "PASS" })) };
  const result = { preflight: certifiedPreflight, certification: receipt };
  check(() => rebuild.validateHistoryMonthBuild(runtimeContext, receipt.month, result));
  for (const patch of [{ mode: "READ_ONLY_REPUBLICATION_PREFLIGHT" }, { sourceRevision: "999" },
    { manifestHash: "f".repeat(64) }, { checks: [] }, { checks: [{ id: "x", status: "FAIL" }] }]) {
    check(() => assert.throws(() => rebuild.validateHistoryMonthBuild(runtimeContext, receipt.month, {
      ...result, certification: { ...receipt, ...patch },
    })));
  }
  const frozenClient = { from() { return { select() { return this; }, eq() { return this; },
    async single() { return { data: { status: "published", published_at: runtimeContext.asOf }, error: null }; },
    upsert() { throw new Error("Must fail BEFORE upsert"); } }; } };
  const store = new SupabaseAnalyticsMaterializationStore(frozenClient, runtimeContext);
  const testStage = materialization.stageHistoryV2GenerationInMemory({ preflight: certifiedPreflight,
    publicationId: "frozen", revision: 12, generatedAt: runtimeContext.asOf });
  await rejects(() => store.writeHistoryV2Artifact(testStage.artifacts[0], "frozen"), /never-published/);
  await rejects(() => store.writeQuery(testStage.queries[0].request, testStage.queries[0].data, "frozen"), /never-published/);
  await rejects(() => store.writeQuery(testStage.queries[0].request, testStage.queries[0].data), /without a draft/);

  const sql = fs.readFileSync("supabase/migrations/20260904180000_history_v2_frozen_publications.sql", "utf8");
  for (const fragment of ["security invoker", "for update", "v_new - v_technical", "published_at is not null",
    "unsealed, never-published", "revoke truncate", "History retry changed", "create trigger"]) {
    check(() => assert.ok(sql.includes(fragment), fragment));
  }
  check(() => assert.doesNotMatch(sql, /create or replace function public\.(?:publish|restore)|disable trigger|set\s+payload\s*=|delete\s+from/iu));
  const producer = fs.readFileSync("scripts/check-history-v2-certification-12-months.mjs", "utf8");
  check(() => assert.ok(producer.includes('selectedMonth === undefined ? months : [selectedMonth]')));
  check(() => assert.ok(producer.includes('Single-month rebuild requires full invariant certification')));
  if (process.env.HC4_PGLITE_MODULE === undefined) return { checks, sql: "NOT_RUN: set HC4_PGLITE_MODULE for transactional PostgreSQL tests" };

  const { PGlite } = await import(pathToFileURL(process.env.HC4_PGLITE_MODULE).href);
  const db = new PGlite();
  const read = (name) => fs.readFileSync(path.join("supabase/migrations", name), "utf8");
  const raw = async (sqlText, values = []) => (await db.query(sqlText, values)).rows;
  try {
    // Only prerequisite tables/auth stub are synthetic. Materialization tables,
    // indexes, grants, triggers, invalidation, Finalize and rollback are actual SQL.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema private;
      create function private.user_has_household_access(uuid) returns boolean language sql as 'select false';
      create table public.households(household_id uuid primary key);
      create table public.persons(person_id uuid primary key);
      create table public.household_revisions(household_id uuid primary key, data_revision bigint, analytics_revision bigint, updated_at timestamptz default now());
      create table public.analysis_periods(household_id uuid, month date, source_revision bigint, updated_at timestamptz);
      create table public.analytics_change_log(household_id uuid, affected_month date, data_revision bigint, impact_scope text, processed_at timestamptz);
      grant select on public.household_revisions to service_role;
    `);
    const initial = read("20260825105100_analytics_materialization.sql");
    await db.exec(initial.slice(0, initial.indexOf("create or replace function public.record_analytics_mutation")) + "commit;");
    await db.exec(read("20260831150000_history_v2_publication_rollback.sql"));
    await db.exec(read("20260902105811_enforce_single_active_analytics_generation.sql"));
    await raw("insert into households values ($1)", [runtimeContext.householdId]);
    await raw("insert into household_revisions(household_id,data_revision,analytics_revision) values ($1,$2,$3)",
      [runtimeContext.householdId, runtimeContext.dataRevision, runtimeContext.analyticsRevision]);
    await raw("insert into analysis_periods(household_id,month,source_revision) values ($1,$2,$3)",
      [runtimeContext.householdId, `${receipt.month}-01`, runtimeContext.dataRevision]);
    // Historical publication without HC3 evidence, with a detail absent from P1.
    // Intentionally storage-level fixture, not a claim about legacy RuntimeSchema.
    const legacyId = "00000000-0000-4000-8000-000000008888";
    await raw(`insert into analytics_publications(publication_id,household_id,scope_kind,period_month,
      source_revision,base_analytics_revision,published_analytics_revision,status,published_at,required_query_keys)
      values ($1,$2,'month',$3,7,9,10,'published',now(),array['retired-detail'])`,
      [legacyId,runtimeContext.householdId,`${receipt.month}-01`]);
    await raw(`insert into analytics_query_snapshots(query_key,generation_key,household_id,resource,scope_hash,normalized_param_signature,
      subject_kind,period_kind,period_month,source_revision,analytics_revision,contract_version,method_signature,payload,computed_at,publication_id,is_active)
      values ('retired-detail',$1::uuid::text,$2,'history_moment_detail',$4,$4,'household','month',$3,7,9,'v2',$4,'{"legacy":true}',now(),$1::uuid,true)`,
      [legacyId,runtimeContext.householdId,`${receipt.month}-01`,"a".repeat(64)]);
    await db.exec(read("20260904120000_history_v2_dependency_manifest.sql"));
    await db.exec(sql);
    await db.exec("set role service_role;");
    const client = postgresClient(raw);
    const grants = await raw(`select
      has_table_privilege('anon','analytics_query_snapshots','INSERT') as anon_write,
      has_table_privilege('authenticated','analytics_artifacts','UPDATE') as browser_write,
      has_table_privilege('service_role','analytics_query_snapshots','INSERT') as stage_write,
      has_table_privilege('service_role','analytics_publications','TRUNCATE') as truncate,
      has_table_privilege('service_role','analytics_query_snapshots','TRIGGER') as install_trigger,
      has_function_privilege('authenticated','public.history_v2_frozen_publication_contract()','EXECUTE') as browser_rpc`);
    check(() => assert.deepEqual(grants[0], { anon_write: false, browser_write: false, stage_write: true, truncate: false, install_trigger: false, browser_rpc: false }));
    await db.exec("reset role; alter table analytics_artifacts disable trigger history_v2_frozen_artifact_guard; set role service_role;");
    await rejects(() => raw("select * from history_v2_frozen_publication_contract()"), /not installed/);
    await db.exec("reset role; alter table analytics_artifacts enable trigger history_v2_frozen_artifact_guard; set role service_role;");
    const generation = async (context = runtimeContext, produced = result) => rebuild.buildHistoryMonth({
      client, context, month: receipt.month, sourceRevision: context.dataRevision, produce: async () => produced,
    });
    const active = async () => raw(`select publication_id,count(*)::int as n from (
      select publication_id from analytics_artifacts where is_active and invalidated_at is null
      union all select publication_id from analytics_query_snapshots where is_active and invalidated_at is null
    ) x group by publication_id order by publication_id`);
    const snapshot = async (id) => (await raw(`select 'p' as kind,to_jsonb(p) as content from analytics_publications p where publication_id=$1
      union all select 'a',to_jsonb(a)-array['is_active','invalidated_at','invalidation_revision'] from analytics_artifacts a where publication_id=$1
      union all select 'q',to_jsonb(q)-array['is_active','invalidated_at','invalidation_revision'] from analytics_query_snapshots q where publication_id=$1`, [id]))
      .sort((a, b) => `${a.kind}:${a.content.query_key ?? a.content.artifact_key ?? a.content.publication_id}`
        .localeCompare(`${b.kind}:${b.content.query_key ?? b.content.artifact_key ?? b.content.publication_id}`));
    const finalize = (gen, context = runtimeContext) => rebuild.finalizeHistoryPublication({ client, context, generation: gen });
    const p1 = await generation();
    check(() => assert.equal(p1.stage.finalizeRequested, false));
    check(() => assert.equal(p1.status, "STAGED_INACTIVE"));
    assert.deepEqual(await active(), [{ publication_id: legacyId, n: 1 }]); checks += 1;
    await finalize(p1); checks += 1;
    const p1id = p1.stage.publicationId;
    const p1truth = await snapshot(p1id);
    const legacyTruth = await snapshot(legacyId);
    const count = p1.stage.queries.length + 2;
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    await finalize(p1); checks += 1; // idempotent publish RPC, no revision increase

    for (const table of ["analytics_artifacts", "analytics_query_snapshots"]) {
      for (const assignment of ["payload='{}'::jsonb", "generation_key='other'", "contract_version='v3'",
        "payload=jsonb_set(payload,'{publicationMeta,factsHash}','\"changed\"')",
        "source_revision=999", "household_id=gen_random_uuid()", "is_active=false",
        "invalidated_at=now(),invalidation_revision=999"]) {
        await rejects(() => raw(`update ${table} set ${assignment} where publication_id=$1`, [p1id]), /immutable|authorized/);
      }
      await rejects(() => raw(`delete from ${table} where publication_id=$1`, [p1id]), /cannot be deleted/);
    }
    for (const assignment of ["status='draft'", "publication_id=gen_random_uuid()", "source_revision=999",
      "published_at=null", "dependency_manifest=jsonb_set(dependency_manifest,'{publicationFactsHash}','\"changed\"')"]) {
      await rejects(() => raw(`update analytics_publications set ${assignment} where publication_id=$1`, [p1id]), /immutable|checksum/);
    }
    await rejects(() => raw("truncate analytics_query_snapshots"), /permission denied/);
    const actualStore = new SupabaseAnalyticsMaterializationStore(client, runtimeContext);
    await rejects(() => actualStore.writeHistoryV2Artifact(p1.stage.artifacts[0], p1id), /never-published/);
    await rejects(() => actualStore.writeQuery(p1.stage.queries[0].request, p1.stage.queries[0].data, p1id), /never-published/);
    // Direct INSERT/UPSERT also rejects ever-published IDs, not only the TS guard.
    const qrow = (await raw("select to_jsonb(q)-'query_snapshot_id' as row from analytics_query_snapshots q where publication_id=$1 limit 1", [p1id]))[0].row;
    const directRetry = await client.from("analytics_query_snapshots").upsert(qrow, { onConflict: "query_key,source_revision,contract_version,method_signature,generation_key" });
    check(() => assert.match(directRetry.error?.message ?? "", /never-published/));

    const context2 = { ...runtimeContext, analyticsRevision: String(Number(runtimeContext.analyticsRevision) + 1) };
    const p2 = await generation(context2);
    check(() => assert.notEqual(p2.stage.publicationId, p1id));
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    // A revision conflict never alters the active set.
    await rejects(() => raw("select * from publish_analytics_materialization($1,$2)", [p2.stage.publicationId, "999"]), /Concurrent/);
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;

    const incompleteId = await new SupabaseAnalyticsMaterializationStore(client, context2).beginMonthPublicationProfile({
      month: receipt.month, requiredArtifactKeys: p2.stage.manifest.requiredArtifactKeys,
      requiredRequests: p2.stage.queries.map((q) => q.request),
    });
    const incomplete = materialization.stageHistoryV2GenerationInMemory({ preflight: certifiedPreflight,
      publicationId: incompleteId, revision: p2.stage.revision, generatedAt: context2.asOf });
    const stageStore = new SupabaseAnalyticsMaterializationStore(client, context2);
    await stageStore.writeHistoryV2Artifact(incomplete.artifacts[0], incompleteId);
    await stageStore.writeHistoryV2Artifact(incomplete.artifacts[0], incompleteId); // identical unsealed retry
    const partialCount = await raw("select count(*)::int as n from analytics_artifacts where publication_id=$1", [incompleteId]);
    check(() => assert.equal(partialCount[0].n, 1));
    const changed = structuredClone(incomplete.artifacts[0]); changed.payload.artifactInputHash = "e".repeat(64); changed.artifactInputHash = "e".repeat(64);
    await rejects(() => stageStore.writeHistoryV2Artifact(changed, incompleteId), /changed|immutable/);
    await rejects(() => raw("select * from publish_analytics_materialization($1,$2)", [incompleteId, context2.analyticsRevision]), /incomplete/);
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;

    // Failure injected AFTER active switches at the last publication-row update:
    // PostgreSQL must roll back flags, period metadata and revision together.
    await db.exec(`reset role; create function public.hc4_test_fail_finalize() returns trigger language plpgsql as $$
      begin if new.status='published' then raise exception 'HC4 injected late failure'; end if; return new; end $$;
      create trigger zz_hc4_test_fail before update on analytics_publications for each row execute function public.hc4_test_fail_finalize(); set role service_role;`);
    await rejects(() => finalize(p2, context2), /injected late failure/);
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    assert.deepEqual(await snapshot(p1id), p1truth); checks += 1;
    await db.exec("reset role; drop trigger zz_hc4_test_fail on analytics_publications; drop function public.hc4_test_fail_finalize(); set role service_role;");
    await finalize(p2, context2);
    assert.deepEqual(await active(), [{ publication_id: p2.stage.publicationId, n: count }]); checks += 1;
    assert.deepEqual(await snapshot(p1id), p1truth); checks += 1;
    const p2truth = await snapshot(p2.stage.publicationId);
    const rollbackRevision = String(Number(context2.analyticsRevision) + 1);
    await raw("select * from restore_history_v2_publication($1,$2,$3,$4,$5)",
      [p2.stage.publicationId, p1id, runtimeContext.householdId, `${receipt.month}-01`, rollbackRevision]);
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    assert.deepEqual(await snapshot(p1id), p1truth); checks += 1;
    assert.deepEqual(await snapshot(p2.stage.publicationId), p2truth); checks += 1;
    await finalize(p2, context2); // published retry must NOT silently reactivate P2 after rollback
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    await raw("select * from restore_history_v2_publication($1,$2,$3,$4,$5)",
      [p1id, legacyId, runtimeContext.householdId, `${receipt.month}-01`, String(Number(rollbackRevision) + 1)]);
    assert.deepEqual(await active(), [{ publication_id: legacyId, n: 1 }]); checks += 1;
    assert.deepEqual(await snapshot(legacyId), legacyTruth); checks += 1;
    await raw("select * from restore_history_v2_publication($1,$2,$3,$4,$5)",
      [legacyId, p1id, runtimeContext.householdId, `${receipt.month}-01`, String(Number(rollbackRevision) + 2)]);
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    // New data revision: a new UUID/generation, never a mutation of P1/P2.
    await db.exec("reset role;");
    await raw("update household_revisions set data_revision=8 where household_id=$1", [runtimeContext.householdId]);
    await db.exec("set role service_role;");
    const context3 = { ...runtimeContext, dataRevision: "8", analyticsRevision: String(Number(rollbackRevision) + 3) };
    const p3 = await generation(context3, { ...result, certification: { ...receipt, sourceRevision: "8" } });
    check(() => assert.ok(![p1id, p2.stage.publicationId].includes(p3.stage.publicationId)));
    assert.deepEqual(await snapshot(p1id), p1truth); checks += 1;
    assert.deepEqual(await active(), [{ publication_id: p1id, n: count }]); checks += 1;
    // Authorized invalidation changes technical state only.
    await db.exec("reset role;");
    await raw("select * from private.invalidate_analytics_materialization($1,8,$2,'month',$3)",
      [runtimeContext.householdId, `${receipt.month}-01`, materialization.historyV2QueryResources]);
    assert.deepEqual(await snapshot(p1id), p1truth); checks += 1;
    const invalidated = await raw("select count(*)::int as n from analytics_query_snapshots where publication_id=$1 and invalidated_at is not null", [p1id]);
    check(() => assert.equal(invalidated[0].n, p1.stage.queries.length));
    await db.exec("set role service_role;");
    const v1row = { ...qrow, query_key: "v1-cache", generation_key: "read_through", resource: "analysis_month_initial",
      contract_version: "v1", publication_id: null, payload: { syntheticCache: true }, is_active: true };
    const v1 = await client.from("analytics_query_snapshots").insert(v1row);
    check(() => assert.equal(v1.error, null));
    await raw("update analytics_query_snapshots set payload='{}' where query_key='v1-cache'"); checks += 1;
    await raw("delete from analytics_query_snapshots where query_key='v1-cache'"); checks += 1;
    return { checks, sql: "PASS: PostgreSQL/PGlite, real migrations/roles/transactions, synthetic data only", live: "NOT_TOUCHED" };
  } finally { await db.close(); }
}

// Small transport adapter, not an in-memory simulation of SQL semantics.
function postgresClient(query) {
  return {
    from(table) {
      const state = { filters: [], values: [], mode: "select", columns: "*" };
      const builder = {
        select(columns = "*") { state.columns = columns; return this; },
        eq(key, value) { state.values.push(value); state.filters.push(`${key}=$${state.values.length}`); return this; },
        order(key) { state.order = key; return this; },
        range(start, end) { state.range = [start, end]; return this; },
        insert(row) { state.mode = "insert"; state.row = row; return this; },
        upsert(row, options) { state.mode = "upsert"; state.row = row; state.conflict = options.onConflict; return this; },
        single() { state.single = true; return this; },
        maybeSingle() { state.single = true; return this; },
        async then(resolve, reject) {
          try {
            let sql;
            if (state.mode === "select") {
              sql = `select ${state.columns} from public.${table}`;
              if (state.filters.length) sql += ` where ${state.filters.join(" and ")}`;
              if (state.order) sql += ` order by ${state.order}`;
              if (state.range) sql += ` limit ${state.range[1] - state.range[0] + 1} offset ${state.range[0]}`;
            } else {
              const columns = Object.keys(state.row);
              state.values = columns.map((key) => key === "payload" ? JSON.stringify(state.row[key]) : state.row[key]);
              sql = `insert into public.${table} (${columns.join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")})`;
              if (state.mode === "upsert") sql += ` on conflict (${state.conflict}) do update set ${columns.map((c) => `${c}=excluded.${c}`).join(",")}`;
              sql += ` returning ${state.columns}`;
            }
            // PostgREST serializes PostgreSQL timestamps to ISO strings.
            const data = JSON.parse(JSON.stringify(await query(sql, state.values)));
            return resolve({ data: state.single ? data[0] ?? null : data, error: null });
          } catch (error) { return resolve({ data: null, error }); }
        },
      };
      return builder;
    },
    async rpc(name, params = {}) {
      try {
        const entries = Object.entries(params);
        const data = await query(`select * from public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")})`,
          entries.map(([key, value]) => key === "p_manifest" ? JSON.stringify(value) : value));
        return { data, error: null };
      } catch (error) { return { data: null, error }; }
    },
  };
}
