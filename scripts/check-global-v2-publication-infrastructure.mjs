import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const analytics = await import("../src/analytics/global-v2/index.ts");
const core = await import("../src/core/global-v2/index.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");
const materialization = await import("../src/server/analytics/materialization/global-v2.ts");
const { buildIntegratedGlobalV2Candidate } = await import("./lib/global-v2-integrated-candidate.mjs");
const { InMemoryGlobalPublicationCoordinator } = await import("../src/server/analytics/materialization/global-session.ts");
const { GlobalGenerationPin } = await import("../src/server/query/global-generation.ts");
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const checkAsync = async (fn) => { await fn(); checks += 1; };
const rejects = (fn, pattern) => check(() => assert.throws(fn, pattern));
const hash = (c) => c.repeat(64);
const gitSha = "a".repeat(40);

const corePolicy = {
  policyId: "core", sectionClass: "CORE_STRUCTURAL", allowedSurfaces: ["AUTO_GLOBAL", "MODULE_DETAIL"],
  requireCertifiedHistory: true, requireMateriality: false, requireStatistics: false,
  requireTemporalRobustness: false, allowPartialQualifiedDetail: true,
  placeholderPolicy: "CORE_WHEN_RECOVERABLE", methodVersion: "publication@v1",
};
const insightPolicy = { ...corePolicy, policyId: "insight", sectionClass: "OPPORTUNISTIC_INSIGHT", allowedSurfaces: ["AUTO_GLOBAL", "EXPLICIT_EXPLORATION"], requireMateriality: true, requireStatistics: true, requireTemporalRobustness: true, allowPartialQualifiedDetail: false, placeholderPolicy: "NEVER" };
const engine = new analytics.GlobalPublicationEngine();
const gates = { capability: true, applicable: true, semantic: true, knowledge: "KNOWN", certification: true, support: "SUFFICIENT", coverage: 1, materiality: true, statistics: true, temporalRobustness: true, editorialSelection: true };
check(() => assert.equal(engine.decide({ sectionKey: "core", policy: corePolicy, surface: "AUTO_GLOBAL", analyticsRevision: "7", gates }).visibility, "VISIBLE"));
check(() => assert.equal(engine.decide({ sectionKey: "core", policy: corePolicy, surface: "AUTO_GLOBAL", analyticsRevision: "7", gates: { ...gates, certification: false } }).visibility, "PLACEHOLDER"));
check(() => assert.equal(engine.decide({ sectionKey: "core", policy: corePolicy, surface: "MODULE_DETAIL", analyticsRevision: "7", gates: { ...gates, knowledge: "PARTIAL", coverage: 0.7, qualification: "PARTIAL_COVERAGE" } }).qualification, "PARTIAL_COVERAGE"));
check(() => assert.equal(engine.decide({ sectionKey: "insight", policy: insightPolicy, surface: "AUTO_GLOBAL", analyticsRevision: "7", gates: { ...gates, materiality: false } }).reasonCode, "BELOW_MATERIALITY"));
check(() => assert.equal(engine.decide({ sectionKey: "insight", policy: insightPolicy, surface: "EXPLICIT_EXPLORATION", analyticsRevision: "7", gates: { ...gates, statistics: false, explicitNeutralResultAllowed: true } }).visibility, "VISIBLE"));
rejects(() => engine.decide({ sectionKey: "core", policy: corePolicy, surface: "AUTO_GLOBAL", analyticsRevision: "7", gates: { ...gates, coverage: 1.1 } }), /COVERAGE_INVALID/);
check(() => assert.equal(analytics.aggregateGlobalModuleVisibility([
  engine.decide({ sectionKey: "i", policy: insightPolicy, surface: "AUTO_GLOBAL", analyticsRevision: "7", gates: { ...gates, materiality: false } }),
]), "HIDDEN"));

const version = (key, family, n) => ({ key, family, contractVersion: "v2", methodSignature: hash(String(n)), policyVersions: { [`policy-${n}`]: `v${n}` }, resourceInputHash: hash(String(n + 4)) });
const closure = (outputKey, n) => {
  const dependencies = [{ authority: "FACT", family: `fact-${n}`, identity: `fact:${n}`, digest: hash(String(n + 3)), required: true }];
  return {
    outputKey,
    declarationDigest: materialization.globalV2ClosureDeclarationDigest(dependencies),
    inputDigest: materialization.globalV2ClosureInputDigest(dependencies),
    dependencies,
  };
};
const manifestInputBase = {
  formatVersion: materialization.globalV2ManifestFormatVersion,
  profileId: materialization.globalV2PublicationProfileId,
  householdId: "00000000-0000-4000-8000-000000000001",
  asOf: "2026-09-06T12:00:00Z", certifiedThrough: "2026-07-31", sourceRevision: "1", baseAnalyticsRevision: "79",
  resourceFamilies: [...materialization.globalV2ResourceFamilies], requiredArtifactKeys: ["artifact:overview"], requiredQueryKeys: ["query:overview"],
  closures: [closure("artifact:overview", 1), closure("query:overview", 2)], externalDependencyRefs: [],
  artifactVersions: [version("artifact:overview", "global_v2_overview_artifact", 1)], queryVersions: [version("query:overview", "global_overview", 2)],
  implementation: { status: "KNOWN", digest: hash("e"), gitSha },
};
const manifestInput = {
  ...manifestInputBase,
  publicationFactsHash: materialization.globalV2PublicationFactsHash(manifestInputBase),
};
const manifest = materialization.buildGlobalV2PublicationManifest(manifestInput);
const reversed = materialization.buildGlobalV2PublicationManifest({ ...manifestInput, closures: [...manifestInput.closures].reverse(), resourceFamilies: [...manifestInput.resourceFamilies].reverse() });
check(() => assert.equal(manifest.manifestHash, reversed.manifestHash));
check(() => assert.deepEqual(materialization.parseGlobalV2PublicationManifest(manifest), manifest));
rejects(() => materialization.parseGlobalV2PublicationManifest({ ...manifest, manifestHash: hash("0") }), /HASH_MISMATCH/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, requiredQueryKeys: [] }), /EMPTY_GENERATION/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, requiredQueryKeys: ["query:overview", "query:overview"] }), /duplicate/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, closures: manifestInput.closures.slice(0, 1) }), /CLOSURE_INCOMPLETE/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, resourceFamilies: manifestInput.resourceFamilies.slice(0, 4) }), /RESOURCE_FAMILIES_INCOMPLETE/);
rejects(() => materialization.parseGlobalV2PublicationManifest({ ...manifest, invented: true }), /UNKNOWN_OR_MISSING_FIELD/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, closures: [{ ...manifestInput.closures[0], invented: true }, manifestInput.closures[1]] }), /unknown or missing field/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, closures: [{ ...manifestInput.closures[0], declarationDigest: hash("0") }, manifestInput.closures[1]] }), /CLOSURE_DIGEST_MISMATCH/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, publicationFactsHash: hash("0") }), /PUBLICATION_FACTS_HASH_MISMATCH/);
rejects(() => materialization.buildGlobalV2PublicationManifest({ ...manifestInput, closures: [{ ...manifestInput.closures[0], dependencies: [{ ...manifestInput.closures[0].dependencies[0], authority: "FAKE" }] }, manifestInput.closures[1]] }), /DEPENDENCY_INVALID/);

const makeRows = (publicationId) => materialization.stageGlobalV2GenerationInMemory({
  manifest, publicationId, revision: 80, generatedAt: "2026-09-06T12:01:00Z",
  artifacts: [{ ...manifest.artifactVersions[0], payload: { kind: "artifact" } }],
  queries: [{ ...manifest.queryVersions[0], payload: { kind: "query" } }],
});
const pub1 = "00000000-0000-4000-8000-000000000101", pub2 = "00000000-0000-4000-8000-000000000102";
const coordinator = new InMemoryGlobalPublicationCoordinator();
coordinator.seedRevisions(manifest.householdId, "1", 79);
coordinator.begin({ publicationId: pub1, householdId: manifest.householdId, sourceRevision: "1", baseAnalyticsRevision: 79 });
const rows1 = makeRows(pub1);
coordinator.stage(pub1, rows1[0]);
rejects(() => coordinator.attachManifest(pub1, manifest), /INCOMPLETE_OR_EXTRA/);
coordinator.stage(pub1, rows1[1]);
coordinator.stage(pub1, rows1[1]);
rejects(() => coordinator.stage(pub1, { ...rows1[1], payload: { changed: true } }), /RETRY_CHANGED_CONTENT/);
check(() => assert.equal(coordinator.attachManifest(pub1, manifest).manifestHash, manifest.manifestHash));
rejects(() => coordinator.mutate(pub1, rows1[0].key, rows1[0]), /IMMUTABLE/);
rejects(() => coordinator.finalize(pub1, 78), /CONCURRENT/);
check(() => assert.deepEqual(coordinator.finalize(pub1, 79), { analyticsRevision: 80, publicationId: pub1 }));
check(() => assert.deepEqual(coordinator.finalize(pub1, 79), { analyticsRevision: 80, publicationId: pub1 }));
check(() => assert.deepEqual(coordinator.active({ householdId: manifest.householdId }).keys, ["artifact:overview", "query:overview"]));

const manifest2InputBase = { ...manifestInputBase, baseAnalyticsRevision: "80" };
const manifest2 = materialization.buildGlobalV2PublicationManifest({ ...manifest2InputBase, publicationFactsHash: materialization.globalV2PublicationFactsHash(manifest2InputBase) });
const rows2 = materialization.stageGlobalV2GenerationInMemory({ manifest: manifest2, publicationId: pub2, revision: 81, generatedAt: "2026-09-06T13:00:00Z", artifacts: [{ ...manifest2.artifactVersions[0], payload: {} }], queries: [{ ...manifest2.queryVersions[0], payload: {} }] });
coordinator.begin({ publicationId: pub2, householdId: manifest.householdId, sourceRevision: "1", baseAnalyticsRevision: 80 });
rows2.forEach((row) => coordinator.stage(pub2, row)); coordinator.attachManifest(pub2, manifest2);
check(() => assert.equal(coordinator.finalize(pub2, 80).analyticsRevision, 81));
rejects(() => coordinator.finalize(pub1, 79), /REACTIVATE|SEALED/);
check(() => assert.deepEqual(coordinator.rollback({ householdId: manifest.householdId, currentPublicationId: pub2, targetPublicationId: pub1, expectedAnalyticsRevision: 81 }), { analyticsRevision: 82, publicationId: pub1 }));

const invalid = new InMemoryGlobalPublicationCoordinator(); invalid.seedRevisions(manifest.householdId, "1", 79); invalid.begin({ publicationId: pub1, householdId: manifest.householdId, sourceRevision: "1", baseAnalyticsRevision: 79 }); rows1.forEach((r) => invalid.stage(pub1, r)); invalid.attachManifest(pub1, manifest); invalid.finalize(pub1, 79); invalid.invalidate(pub1);
rejects(() => invalid.rollback({ householdId: manifest.householdId, currentPublicationId: pub1, targetPublicationId: pub1, expectedAnalyticsRevision: 80 }), /INELIGIBLE/);
const stale = new InMemoryGlobalPublicationCoordinator(); stale.seedRevisions(manifest.householdId, "2", 79); stale.begin({ publicationId: pub1, householdId: manifest.householdId, sourceRevision: "1", baseAnalyticsRevision: 79 }); rows1.forEach((r) => stale.stage(pub1, r)); stale.attachManifest(pub1, manifest);
rejects(() => stale.finalize(pub1, 79), /SOURCE_REVISION_SUPERSEDED/);

const pin = new GlobalGenerationPin();
const hit = { publicationId: pub1, analyticsRevision: 80, factsHash: manifest.publicationFactsHash, manifestHash: manifest.manifestHash, active: true, invalidated: false, manifestComplete: true, signatureCompatible: true, data: { ok: true } };
check(() => assert.equal(pin.read(undefined).status, "SNAPSHOT_MISS"));
check(() => assert.equal(pin.read({ ...hit, invalidated: true }).status, "INVALIDATED"));
check(() => assert.equal(pin.read({ ...hit, manifestComplete: false }).status, "MANIFEST_INCOMPLETE"));
check(() => assert.equal(pin.read({ ...hit, signatureCompatible: false }).status, "SIGNATURE_INCOMPATIBLE"));
check(() => assert.equal(pin.read(hit).status, "READY"));
check(() => assert.equal(pin.read({ ...hit, factsHash: hash("0") }).status, "GENERATION_MISMATCH"));
check(() => assert.equal(pin.read({ ...hit, publicationId: pub2, analyticsRevision: 81 }).status, "GENERATION_MISMATCH"));
pin.reset(); check(() => assert.equal(pin.read({ ...hit, publicationId: pub2, analyticsRevision: 81 }).status, "READY"));

const invalidationRegistry = [{ consumerKey: "m2", outputFamily: "global_categories", methodVersion: "m2@v1", propagationPolicy: "field-aware", consumes: [{ authority: "FACT", family: "EconomicComponentFact", dimensions: ["categoryId", "amount"] }] }];
const event = { invalidationId: "i1", cause: "DATA_CHANGE", sourceType: "EconomicComponentFact", changedFields: ["categoryId"], newRevision: "2", createdAt: "2026-09-06T12:00:00Z" };
check(() => assert.equal(analytics.planGlobalInvalidation(event, invalidationRegistry).affectedOutputs[0].action, "RECOMPUTE"));
check(() => assert.equal(analytics.planGlobalInvalidation({ ...event, changedFields: ["technicalOrder"] }, invalidationRegistry).affectedOutputs.length, 0));
check(() => assert.equal(analytics.planGlobalInvalidation({ ...event, cause: "POLICY_CHANGE" }, invalidationRegistry).affectedOutputs[0].action, "RECOMPUTE"));
const transitivePlan = analytics.planGlobalInvalidation(event, [
  ...invalidationRegistry,
  { consumerKey: "global-rm", outputFamily: "global_read_model", methodVersion: "rm@v1", propagationPolicy: "transitive", consumes: [{ authority: "METRIC", family: "global_categories" }] },
  { consumerKey: "global-query", outputFamily: "analysis_global_categories", methodVersion: "query@v1", propagationPolicy: "transitive", consumes: [{ authority: "ARTIFACT", family: "global_read_model" }] },
]);
check(() => assert.deepEqual(transitivePlan.affectedOutputs.map(({ outputFamily }) => outputFamily), ["analysis_global_categories", "global_categories", "global_read_model"]));
check(() => assert.equal(analytics.planGlobalInvalidation({ ...event, cause: "UI_ONLY_CHANGE" }, invalidationRegistry).affectedOutputs.length, 0));

const sql = fs.readFileSync(path.join(root, "supabase/migrations/20260906120000_global_v2_publication_infrastructure.sql"), "utf8");
check(() => assert.match(sql, /add column global_manifest jsonb/));
check(() => assert.match(sql, /FULL RESTAGE|set is_active=false/iu));
check(() => assert.match(sql, /source revision|source_revision/is));
check(() => assert.match(sql, /residual active key/i));
check(() => assert.match(sql, /Published retry cannot reactivate/i));
check(() => assert.match(sql, /Invalidated Global V2 rollback target/i));
check(() => assert.match(sql, /revoke all on function public\.publish_global_v2_materialization[\s\S]+from public,anon,authenticated/iu));
check(() => assert.match(sql, /grant execute on function public\.publish_global_v2_materialization[\s\S]+to service_role/iu));
check(() => assert.match(sql, /revoke truncate,trigger on public\.analytics_publications/iu));
check(() => assert.doesNotMatch(sql, /update public\.analytics_publications set global_manifest[^\n]+where global_manifest is null/iu));
check(() => assert.equal(materialization.globalV2MaterializationProfile.restagePolicy, "FULL_RESTAGE"));
check(() => assert.equal(materialization.globalV2MaterializationProfile.intergenerationReferences, "FORBIDDEN"));

let sqlRuntime = "NOT_RUN";
if (process.env.GLOBAL_PGLITE_MODULE !== undefined) {
  const { PGlite } = await import(pathToFileURL(process.env.GLOBAL_PGLITE_MODULE).href);
  const db = new PGlite();
  const readMigration = (name) => fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8");
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema private;
      create function private.user_has_household_access(uuid) returns boolean language sql as 'select false';
      create table public.households(household_id uuid primary key);
      create table public.persons(person_id uuid primary key);
      create table public.household_revisions(household_id uuid primary key,data_revision bigint,analytics_revision bigint,updated_at timestamptz default now());
      create table public.analysis_periods(household_id uuid,month date,source_revision bigint,updated_at timestamptz);
      create table public.analytics_change_log(household_id uuid,affected_month date,data_revision bigint,impact_scope text,processed_at timestamptz);
      grant select on public.household_revisions to service_role;
    `);
    const initial = readMigration("20260825105100_analytics_materialization.sql");
    await db.exec(initial.slice(0, initial.indexOf("create or replace function public.record_analytics_mutation")) + "commit;");
    await db.exec(readMigration("20260831150000_history_v2_publication_rollback.sql"));
    await db.exec(readMigration("20260902105811_enforce_single_active_analytics_generation.sql"));
    await db.exec(readMigration("20260904110151_history_v2_dependency_manifest.sql"));
    await db.exec(readMigration("20260904110402_history_v2_frozen_publications.sql"));
    await db.exec(sql);
    const schema = (await db.query(`select
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='analytics_publications' and column_name='global_manifest' and data_type='jsonb') as manifest_column,
      (select count(*)::int from pg_trigger where not tgisinternal and tgenabled='O' and tgname like 'global_v2_%') as enabled_guards,
      has_function_privilege('authenticated','public.publish_global_v2_materialization(uuid,bigint)','EXECUTE') as browser_finalize,
      has_function_privilege('service_role','public.publish_global_v2_materialization(uuid,bigint)','EXECUTE') as service_finalize,
      has_table_privilege('service_role','public.analytics_publications','TRUNCATE') as service_truncate,
      has_table_privilege('service_role','public.analytics_query_snapshots','TRIGGER') as service_trigger`)).rows[0];
    check(() => assert.deepEqual(schema, { manifest_column: true, enabled_guards: 4, browser_finalize: false, service_finalize: true, service_truncate: false, service_trigger: false }));
    await db.exec("set role service_role");
    const handshake = (await db.query("select * from public.global_v2_publication_contract()" )).rows;
    check(() => assert.deepEqual(handshake, [{ boundary_version: "global-v2-publication@v1" }]));

    const first = await buildIntegratedGlobalV2Candidate({ core, query, planApi, materialization, analytics });
    const second = await buildIntegratedGlobalV2Candidate(
      { core, query, planApi, materialization, analytics },
      { publicationId: "00000000-0000-4000-8000-000000000171", revision: 81, baseAnalyticsRevision: 80, outputDelta: 1 },
    );
    const otherHouseholdId = "00000000-0000-4000-8000-000000000002";
    await db.exec("reset role");
    await db.query("insert into public.households(household_id) values ($1),($2)", [first.householdId, otherHouseholdId]);
    await db.query("insert into public.household_revisions(household_id,data_revision,analytics_revision) values ($1,1,79),($2,1,5)", [first.householdId, otherHouseholdId]);
    await db.exec("set role service_role");

    const insertGeneration = async (candidate) => {
      await db.query(`insert into public.analytics_publications(
        publication_id,household_id,scope_kind,as_of_month,source_revision,base_analytics_revision,
        required_artifact_keys,required_query_keys,status
      ) values ($1,$2,'global',$3::date,1,$4,
        (select array_agg(value order by value) from jsonb_array_elements_text($5::jsonb)),
        (select array_agg(value order by value) from jsonb_array_elements_text($6::jsonb)),'draft')`, [
        candidate.publicationId, candidate.householdId, `${candidate.rawScope.time.asOf.slice(0, 7)}-01`, candidate.revision - 1,
        JSON.stringify(candidate.manifest.requiredArtifactKeys), JSON.stringify(candidate.manifest.requiredQueryKeys),
      ]);
      const artifact = candidate.artifactVersion;
      await db.query(`insert into public.analytics_artifacts(
        artifact_key,generation_key,household_id,subject_kind,period_kind,as_of_month,artifact_family,metric_id,
        scope_hash,filter_signature,method_version,contract_version,source_revision,analytics_revision,payload,computed_at,publication_id,is_active
      ) values ($1,$2::text,$3,'household','global',$4::date,$5,$1,$6,$7,$8,$9,1,$10,$11::jsonb,$12::timestamptz,$2::uuid,false)`, [
        artifact.key, candidate.publicationId, candidate.householdId, `${candidate.rawScope.time.asOf.slice(0, 7)}-01`, artifact.family,
        candidate.scopeHash, hash("8"), artifact.methodSignature, artifact.contractVersion, candidate.revision - 1, JSON.stringify(candidate.artifactPayload), candidate.generatedAt,
      ]);
      for (const instance of candidate.plan.instances) {
        const contract = query.globalV2QueryRegistry[instance.resource];
        await db.query(`insert into public.analytics_query_snapshots(
          query_key,generation_key,household_id,resource,scope_hash,normalized_param_signature,subject_kind,period_kind,as_of_month,
          source_revision,analytics_revision,contract_version,method_signature,payload,computed_at,publication_id,is_active
        ) values ($1,$2::text,$3,$4,$5,$6,'household','global',$7::date,1,$8,$9,$10,$11::jsonb,$12::timestamptz,$2::uuid,false)`, [
          instance.key, candidate.publicationId, candidate.householdId, instance.resource, instance.scopeHash,
          instance.resourceInputHash, `${candidate.rawScope.time.asOf.slice(0, 7)}-01`,
          candidate.revision - 1, contract.contractVersion, instance.methodSignature, JSON.stringify(instance.payload), candidate.generatedAt,
        ]);
      }
      await db.query(`insert into public.analytics_query_snapshots(
        query_key,generation_key,household_id,resource,scope_hash,normalized_param_signature,subject_kind,period_kind,as_of_month,
        source_revision,analytics_revision,contract_version,method_signature,payload,computed_at,publication_id,is_active
      ) select query_key,generation_key,household_id,resource,scope_hash,normalized_param_signature,subject_kind,period_kind,as_of_month,
        source_revision,analytics_revision,contract_version,method_signature,payload,computed_at,publication_id,is_active
        from public.analytics_query_snapshots where publication_id=$1 limit 1 on conflict do nothing`, [candidate.publicationId]);
      await db.query("select public.attach_global_v2_manifest($1,$2,$3::jsonb)", [candidate.publicationId, candidate.householdId, JSON.stringify(candidate.manifest)]);
    };

    await insertGeneration(first);
    const firstFinalize = (await db.query("select * from public.publish_global_v2_materialization($1,79)", [first.publicationId])).rows[0];
    check(() => assert.equal(Number(firstFinalize.analytics_revision), 80));
    const firstCounts = (await db.query("select (select count(*)::int from public.analytics_query_snapshots where publication_id=$1 and is_active) as queries,(select count(*)::int from public.analytics_artifacts where publication_id=$1 and is_active) as artifacts", [first.publicationId])).rows[0];
    check(() => assert.deepEqual(firstCounts, { queries: 32, artifacts: 1 }));
    await checkAsync(async () => assert.rejects(() => db.query("update public.analytics_query_snapshots set payload=payload || '{\"mutated\":true}'::jsonb where publication_id=$1", [first.publicationId]), /immutable/i));

    await insertGeneration(second);
    const secondFinalize = (await db.query("select * from public.publish_global_v2_materialization($1,80)", [second.publicationId])).rows[0];
    check(() => assert.equal(Number(secondFinalize.analytics_revision), 81));
    const activeSecond = (await db.query("select count(*)::int as n from public.analytics_query_snapshots where household_id=$1 and is_active and publication_id=$2", [first.householdId, second.publicationId])).rows[0].n;
    check(() => assert.equal(activeSecond, 32));
    const residual = (await db.query("select count(*)::int as n from public.analytics_query_snapshots where household_id=$1 and is_active and publication_id<>$2", [first.householdId, second.publicationId])).rows[0].n;
    check(() => assert.equal(residual, 0));
    const rollback = (await db.query("select * from public.restore_global_v2_publication($1,$2,$3,81)", [second.publicationId, first.publicationId, first.householdId])).rows[0];
    check(() => assert.equal(Number(rollback.analytics_revision), 82));
    check(() => assert.equal(rollback.publication_id, first.publicationId));
    const isolatedRevision = (await db.query("select analytics_revision from public.household_revisions where household_id=$1", [otherHouseholdId])).rows[0].analytics_revision;
    check(() => assert.equal(Number(isolatedRevision), 5));
    const finalActive = (await db.query("select count(*)::int as n from public.analytics_query_snapshots where household_id=$1 and is_active and publication_id=$2", [first.householdId, first.publicationId])).rows[0].n;
    check(() => assert.equal(finalActive, 32));
    sqlRuntime = "PASS";
  } finally { await db.close(); }
}

console.log(`Global V2 publication infrastructure: ${checks}/${checks} PASS (SQL=${sqlRuntime})`);
