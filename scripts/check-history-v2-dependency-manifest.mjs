import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Invoked by the materialization gate, sharing its 15-resource synthetic generation.
// No private fixture, Supabase connection, staging or Finalize.
export async function checkHistoryDependencyManifest({ materialization, historyAnalytics, preflight, runtimeContext, artifactInputs, require }) {
  let checks = 0;
  const check = (fn) => { fn(); checks += 1; };
  const root = process.cwd();
  const source = fs.readFileSync(path.join(root, "scripts/check-history-v2-certification-12-months.mjs"), "utf8");
  const ast = ts.createSourceFile("producer.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "historyQueryDependencies");
  assert.ok(declaration, "Exercise the production dependency extractor, not a test copy.");
  const productionExtractor = declaration.getText(ast);
  check(() => assert.ok(source.indexOf("const implementation =") > source.indexOf("const stableJson =")));
  check(() => assert.deepEqual(Object.keys(historyAnalytics.historyV2ResourceDependencyGroups).sort(), [...materialization.historyV2QueryResources].sort()));

  function fixture() {
    const current = {
      month: "2026-05",
      analyticsAuthority: { typical: { metric: { value: "100", support: { n: 8 } } }, minimal: { metric: { value: "70" }, components: [{ id: "m", amount: "70" }] }, categoryTypicals: [{ categoryId: "food", metric: { value: "40" } }] },
      facts: [{ componentKey: "one", categoryId: "food", amount: "50", placeId: "place" }, { componentKey: "two", categoryId: "food", amount: "20" }],
      classifications: [{ componentKey: "one", necessity: "OPTIONAL" }],
      operations: [{ operation_id: "op", date_bancaire: "2026-05-01", montant_bancaire_depense: "70", flux: "expense" }],
      occurrences: [{ lifeEventId: "event", type: "sport" }], activityCosts: [{ lifeEventId: "event", amount: "10" }],
      causalLinks: [{ eventId: "event", componentKey: "one" }], momentRelations: [{ momentId: "moment", componentKey: "one", relation: "CAUSAL" }],
      visits: [{ placeId: "place", localDate: "2026-05-01" }], primaryPlaces: [{ componentKey: "one", placeId: "place" }],
      expenseDescriptors: [{ expenseEventId: "expense:2026-05", label: "Local descriptor" }],
      canonicalMomentIds: ["moment"],
    };
    const prior = { month: "2026-04", facts: [{ categoryId: "food", subcategoryId: "groceries", amount: "30" }] };
    const ledgers = ["2026-04", "2026-05", "2026-06"].map((month) => ({ month, actualMonthAmount: "70", expenseEvents: [{ expenseEventId: `expense:${month}`, amount: "70" }] }));
    return { current, prior, ledgers, calendar: ledgers.map(({ month }) => ({ month, items: [] })), persons: [{ personId: "person", label: "Synthetic" }], expenses: ledgers.map(({ month }) => ({ expenseEventId: `expense:${month}`, title: "Synthetic expense" })), labels: [["food", "Food"]] };
  }

  async function generation(f) {
    const env = {
      historyAnalytics, householdId: runtimeContext.householdId,
      stableJson: (value) => JSON.stringify(historyAnalytics.historyDependencyValue(value)),
      dailyArtifacts: f.ledgers, calendarArtifacts: f.calendar, personDirectory: f.persons, allExpenseDescriptors: f.expenses,
      months: ["2026-04", "2026-05"], dailyByMonth: new Map(f.ledgers.map((row) => [row.month, row])),
      monthData: new Map([[f.prior.month, f.prior], [f.current.month, f.current]]),
      categoryLabels: new Map(f.labels), subcategoryLabels: new Map(), merchantLabels: new Map(), placeLabels: new Map(),
      categoryState: () => ({ typicalRows: new Map([["food", { availability: "known", pivotMonthIds: ["2026-04"] }]]) }),
      pivotMonthIds: (row) => row.pivotMonthIds, categoryOf: (row) => row.categoryId,
      journalSupplement: () => ({ bankInflows: "0" }), overviewSupplement: () => ({ bankOutflows: "70" }),
    };
    const extract = new Function(...Object.keys(env), `${productionExtractor}; return historyQueryDependencies;`)(...Object.values(env));
    const byRequest = new Map(preflight.queries.map(({ request, data }) => [JSON.stringify([request.resource, request.params]), data]));
    return materialization.buildHistoryV2Preflight({
      context: runtimeContext, month: "2026-05", artifacts: artifactInputs,
      implementation: { status: "KNOWN", gitSha: "a".repeat(40), digest: "b".repeat(64) },
      buildQuery(request) {
        const data = byRequest.get(JSON.stringify([request.resource, request.params]));
        assert.ok(data);
        return { data, ...extract(f.current, request, data) };
      },
    });
  }
  const baseline = await generation(fixture());
  check(() => assert.ok(baseline.manifest.factDependencies.some(({ facts }) => facts.some(({ factType, identity }) =>
    factType === "history_input:category_history" && JSON.parse(identity).sourceMonths.includes("2026-04")))));
  const sensitivities = [
    ["Typical", "history_month_balance_summary", (f) => { f.current.analyticsAuthority.typical.metric.value = "101"; }],
    ["Minimal", "history_minimal_preview", (f) => { f.current.analyticsAuthority.minimal.components[0].amount = "71"; }],
    ["Category Typical", "history_month_categories", (f) => { f.current.analyticsAuthority.categoryTypicals[0].metric.value = "41"; }],
    ["Category historical pivot", "history_category_detail", (f) => { f.prior.facts[0].amount = "31"; }],
    ["M3 classification", "history_month_spending_nature", (f) => { f.current.classifications[0].necessity = "CONSTRAINED"; }],
    ["Moment causal relation", "history_moment_detail", (f) => { f.current.momentRelations[0].relation = "ASSOCIATED"; }],
    ["Activity cost", "history_activity_detail", (f) => { f.current.activityCosts[0].amount = "11"; }],
    ["Place visit", "history_place_detail", (f) => { f.current.visits[0].localDate = "2026-05-02"; }],
    ["Localized finance", "history_place_detail", (f) => { f.current.facts[0].placeId = "other"; }],
    ["Actual history", "history_month_balance_summary", (f) => { f.ledgers[0].actualMonthAmount = "71"; }],
    ["Descriptor", "history_month_calendar", (f) => { f.expenses[1].title = "Changed expense"; }],
    ["Local detail descriptor", "history_moment_detail", (f) => { f.current.expenseDescriptors[0].label = "Changed local description"; }],
    ["Journal operation semantics", "history_day_journal", (f) => { f.current.operations[0].flux = "income"; }],
  ];
  const hash = (result, resource) => result.queries.find(({ request }) => request.resource === resource).data.resourceInputHash;
  for (const [name, resource, mutate] of sensitivities) {
    const f = fixture(); mutate(f);
    const changed = await generation(f);
    check(() => assert.notEqual(hash(changed, resource), hash(baseline, resource), name));
    check(() => assert.notEqual(changed.manifest.publicationFactsHash, baseline.manifest.publicationFactsHash, name));
    check(() => assert.notEqual(changed.manifest.manifestHash, baseline.manifest.manifestHash, name));
    check(() => assert.equal(materialization.historyV2ManifestFactsHash(JSON.parse(JSON.stringify(changed.manifest))), changed.manifest.publicationFactsHash));
  }
  const irrelevant = fixture();
  irrelevant.current.oracle = { typical: "9999" }; irrelevant.current.unusedCache = true;
  irrelevant.current.operations[0].unusedColumn = "not consumed";
  irrelevant.current.facts.reverse();
  irrelevant.current.facts = irrelevant.current.facts.map((row) => Object.fromEntries(Object.entries(row).reverse()));
  irrelevant.current.facts.push({ ...irrelevant.current.facts[0] });
  const structural = await generation(irrelevant);
  check(() => assert.equal(structural.manifest.publicationFactsHash, baseline.manifest.publicationFactsHash, "Order, identical duplicates, oracle/cache and unused columns are not business changes"));
  check(() => assert.equal(structural.manifest.manifestHash, baseline.manifest.manifestHash));
  check(() => assert.throws(() => historyAnalytics.historyResourceDependencyClosure({ resource: "history_minimal_preview", groups: {} }), /Missing History dependency/));

  const manifest = baseline.manifest;
  check(() => assert.deepEqual(materialization.historyV2DependencyManifestSchema.parse(JSON.parse(JSON.stringify(manifest))), manifest));
  check(() => assert.ok(Buffer.byteLength(JSON.stringify(manifest)) < 2_000_000));
  const resign = (m) => { const { manifestHash, ...body } = m; return { ...body, manifestHash: materialization.historyV2ManifestDigest(body) }; };
  for (const mutate of [
    (m) => { m.factDependencies[0].facts[0].factHash = "c".repeat(64); },
    (m) => { m.requiredQueryKeys.pop(); },
    (m) => { m.factDependencies.pop(); },
    (m) => { m.queryVersions[0].contractVersion = "v1"; },
    (m) => { m.formatVersion = "unknown"; },
    (m) => { m.implementation = { status: "UNKNOWN", digest: "a".repeat(64) }; },
    (m) => { m.queryVersions[0].extra = true; },
  ]) {
    const invalid = structuredClone(manifest); mutate(invalid);
    check(() => assert.throws(() => materialization.historyV2DependencyManifestSchema.parse(resign(invalid))));
  }
  const changedImplementation = resign({ ...manifest, implementation: { ...manifest.implementation, digest: "c".repeat(64) } });
  check(() => assert.notEqual(changedImplementation.manifestHash, manifest.manifestHash));
  check(() => assert.equal(changedImplementation.publicationFactsHash, manifest.publicationFactsHash, "Implementation identity is not invented business truth"));
  const stagedAgain = materialization.stageHistoryV2GenerationInMemory({ preflight: baseline, publicationId: "test", revision: 100, generatedAt: "2026-09-04T12:00:00Z" });
  check(() => assert.equal(stagedAgain.factsHash, manifest.publicationFactsHash, "Publication metadata does not affect truth hash"));
  check(() => assert.equal(stagedAgain.manifest.manifestHash, manifest.manifestHash));
  const changedPayload = structuredClone(baseline);
  changedPayload.queries[0].data.sourceRefs = [];
  check(() => assert.throws(() => materialization.stageHistoryV2GenerationInMemory({ preflight: changedPayload, publicationId: "test", revision: 100, generatedAt: "2026-09-04T12:00:00Z" }), /content does not match/));

  const { SupabaseHistoryManifestStore } = require(path.join(root, "src/server/analytics/materialization/history-manifest-store.ts"));
  let persisted = null;
  let readError = null;
  let missing = false;
  const calls = [];
  const fakeClient = {
    from(table) {
      assert.equal(table, "analytics_publications");
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { error: readError, data: missing ? null : { household_id: runtimeContext.householdId, period_month: "2026-05-01", dependency_manifest: persisted } }; } };
    },
    async rpc(name, args) { calls.push({ name, args }); persisted = JSON.parse(JSON.stringify(args.p_manifest)); return { error: null }; },
  };
  const store = new SupabaseHistoryManifestStore(fakeClient);
  check(() => assert.equal(calls.length, 0));
  assert.equal((await store.read(runtimeContext.householdId, "pub")).status, "LEGACY_UNKNOWN"); checks += 1;
  await store.attach("pub", manifest);
  const reread = await new SupabaseHistoryManifestStore(fakeClient).read(runtimeContext.householdId, "pub");
  check(() => assert.deepEqual(reread, { status: "KNOWN", manifest }));
  check(() => assert.equal(calls[0].name, "attach_history_v2_dependency_manifest"));
  persisted = { ...persisted, manifestHash: "0".repeat(64) };
  await assert.rejects(() => store.read(runtimeContext.householdId, "pub")); checks += 1;
  missing = true;
  assert.equal((await store.read(runtimeContext.householdId, "pub")).status, "NOT_FOUND"); checks += 1;
  readError = { code: "42703", message: "column dependency_manifest does not exist" };
  assert.equal((await store.read(runtimeContext.householdId, "pub")).status, "SCHEMA_NOT_READY"); checks += 1;
  readError = { code: "42501", message: "permission denied" };
  await assert.rejects(() => store.read(runtimeContext.householdId, "pub")); checks += 1;
  await assert.rejects(() => store.attach("pub", resign({ ...manifest, implementation: { status: "UNKNOWN" } }))); checks += 1;

  const sql = fs.readFileSync(path.join(root, "supabase/migrations/20260904110151_history_v2_dependency_manifest.sql"), "utf8");
  for (const fragment of ["add column dependency_manifest jsonb", "History dependency manifest is immutable", "Cannot retrofit evidence", "History Finalize requires a dependency manifest", "checksum mismatch", "History staged payload/manifest mismatch", "before insert or update", "for update", "from public, anon, authenticated", "to service_role", "security definer set search_path = ''", "publicationMeta,factsHash", "publicationMeta,revision", "methodSignature", "contractVersion", "policyVersions", "2000000"]) {
    check(() => assert.ok(sql.includes(fragment), `SQL contract: ${fragment}`));
  }
  check(() => assert.doesNotMatch(sql, /create(?: or replace)? function public\.(?:publish_analytics_materialization|restore_history_v2_publication)|set\s+payload\s*=|set\s+is_active\s*=|delete\s+from|truncate|disable\s+row\s+level/iu));
  const prepare = fs.readFileSync(path.join(root, "scripts/prepare-history-v2-live-publication.mjs"), "utf8");
  check(() => assert.ok(prepare.includes("attach_history_v2_dependency_manifest") && prepare.includes("historyV2DependencyManifestSchema.parse")));
  return { checks, sensitivityCases: sensitivities.length, manifestBytes: Buffer.byteLength(JSON.stringify(manifest)), sqlVerification: "CONTRACTUAL_ONLY_NOT_APPLIED" };
}
