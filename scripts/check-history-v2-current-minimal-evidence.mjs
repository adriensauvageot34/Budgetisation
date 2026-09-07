import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";
import { assertMinimalEvidence, assertCurrentMinimalCertification, observeCurrentMinimal,
  minimalInputDigests, currentMinimalEvidenceFile, currentMinimalEvidenceMonths } from "./lib/history-v2-current-minimal-evidence.mjs";

const root = process.cwd(), fixturePath = process.argv[2];
assert.ok(fixturePath, "Provide the private read-only B2A Canonical fixture");
const require = createRequire(import.meta.url), resolve = Module._resolveFilename, load = Module._load;
Module._load = function (request, parent, isMain) {
  return request === "server-only" ? {} : load.call(this, request, parent, isMain);
};
Module._resolveFilename = function (request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.join(root, "src", request.slice(2)) : request;
  try { return resolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const file of [target + ".ts", target + ".tsx", path.join(target, "index.ts")]) {
      try { return resolve.call(this, file, parent, isMain, options); } catch { /* next extension */ }
    }
    throw error;
  }
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, file) =>
  module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
  }).outputText, file);

const { CanonicalRepository } = require(path.join(root, "src/server/canonical/repository.ts"));
const { FactSourceResolver } = require(path.join(root, "src/server/analytics/fact-source-resolver.ts"));
const { produceMetric } = require(path.join(root, "src/analytics/production/index.ts"));
const { certifiedHistoricalMinimalSource } = require(path.join(root, "src/server/analytics/materialization/certified-historical-minimal.ts"));
const tables = loadFixtureTables(fixturePath), household = tables.get("households")[0];
const revision = tables.get("household_revisions").find((row) => row.household_id === household.household_id);
const persons = tables.get("persons").filter((row) => row.household_id === household.household_id).map((row) => ({
  personId: row.person_id, householdId: row.household_id, displayName: row.display_name, status: row.status,
})).sort((a, b) => a.personId.localeCompare(b.personId));
const context = {
  userId: "history-v2-read-only-certification", householdId: household.household_id,
  persons, personIds: persons.map((row) => row.personId), timezone: household.timezone,
  periods: tables.get("analysis_periods").filter((row) => row.household_id === household.household_id).map((row) => ({
    analysisPeriodId: row.analysis_period_id, householdId: row.household_id, month: row.month,
    financeStatus: row.finance_status, lifeStatus: row.life_status, locationStatus: row.location_status,
    calendarStatus: row.calendar_status, isClosed: row.is_closed, sourceRevision: String(row.source_revision),
  })), dataRevision: String(revision.data_revision), analyticsRevision: String(revision.analytics_revision),
  contractVersion: "v1", asOf: "2026-08-31T12:00:00Z",
};
const repository = new CanonicalRepository(createFixtureSupabaseClient(fixturePath), context);
const resolver = new FactSourceResolver(repository);
const expected = [
  ["2026-01", "1709.194", "1713.194", 17, "12"],
  ["2026-02", "1737.76166666666666666668", "1741.095", 17, "10"],
  ["2026-03", "1710.52714285714285714286", "1733.67", 17, "8.57142857142857142857"],
  ["2026-04", "1676.3225", "1699.0725", 17, "7.5"],
  ["2026-05", "1649.79222222222222222221", "1669.8233333333333333333333333333333333333333333332", 18, "8.88888888888888888889"],
  ["2026-06", "1623.097", "1631.587", 18, "10"],
  ["2026-07", "1636.76636363636363636364", "1636.62727272727272727273", 18, "9.09090909090909090909"],
];
const legacySha256 = "301615f3f3228eff44cc7f698927165c509fa48f40483e07c399ffd74ffe4f9d";
const legacyFile = fs.readFileSync(path.join(root, "src/server/analytics/materialization/certified-historical-minimal.json"));
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
check(() => assert.equal(createHash("sha256").update(legacyFile).digest("hex"), legacySha256,
  "All twelve legacy values/components remain byte-for-byte frozen"));
check(() => assert.equal(createHash("sha256").update(fs.readFileSync(path.join(root, currentMinimalEvidenceFile("2026-01")))).digest("hex"),
  "127f3a7fe46eda83794ae663bd29c56d5df96b525a65ef59e81d6a40c41a5393", "January current evidence stays untouched"));
check(() => assert.deepEqual(currentMinimalEvidenceMonths, expected.map(([month]) => month)));
const results = [];
for (const [month, value, legacyValue, componentCount, needAmount] of expected) {
  const scope = { subject: { kind: "household" }, time: { kind: "month", month } };
  const source = await resolver.resolve("minimal_month_cost", scope);
  const metric = produceMetric({ metricId: "minimal_month_cost", scope, source });
  const observed = await observeCurrentMinimal({ month, repository, source, metric, repositoryRoot: root });
  const evidence = JSON.parse(fs.readFileSync(path.join(root, currentMinimalEvidenceFile(month)), "utf8"));
  check(() => assert.equal(metric.value, value, month + " Canonical recompute"));
  check(() => assert.equal(evidence.finalValue, value, month + " compare-only expectation"));
  check(() => assert.equal(assertMinimalEvidence(evidence, observed).status, "PASS"));
  check(() => assert.equal(evidence.legacyEvidenceSha256, legacySha256));
  check(() => assert.equal(evidence.sourceRevision, "1"));
  const legacySource = certifiedHistoricalMinimalSource.resolve({ month, scopeHash: source.scopeHash });
  check(() => assert.equal(produceMetric({ metricId: "minimal_month_cost", scope, source: legacySource }).value,
    legacyValue, month + " historical compatibility stays frozen"));
  const components = [...source.neutralVariableComponents, ...source.mandatoryMonthlyObligationsAndProvisions];
  const component = (key) => components.find((row) => row.canonicalComponentKey === key);
  check(() => assert.equal(components.length, componentCount));
  check(() => assert.equal(component("minimal:need:ae28d8ba-a1b3-5f6e-9b46-cb39b415e4ea")?.amount, needAmount));
  const recurrenceAmount = {
    "2026-05": "0.19111111111111111111", "2026-06": "0.344", "2026-07": "0.46909090909090909091",
  }[month];
  check(() => assert.equal(component("minimal:recurrence:16f9e5e2-28e8-59e6-8f59-55c25f1564a9")?.amount, recurrenceAmount));
  if (month === "2026-06" || month === "2026-07") {
    check(() => assert.equal(component("minimal:structural-rule:1668d247-38dd-529a-ba7f-e5c8c33b5b63:category")?.amount,
      month === "2026-06" ? "2.613" : "2.37545454545454545455"));
  }
  if (month === "2026-07") {
    check(() => assert.equal(component("minimal:structural-rule:12caff0a-8f3f-5a05-81c5-4a2d9169e9d1:category")?.amount,
      "92.99090909090909090909"));
  }
  check(() => assert.ok(!("certifiedHistoricalValue" in source)));
  const canonicalBefore = JSON.stringify(source);
  const mutations = [
    (row) => { row.finalValue = "0"; },
    (row) => { row.neutralVariableComponents[0].amount = "0"; },
    (row) => { row.neutralVariableComponents[0].canonicalComponentKey = "fabricated-residual"; },
    (row) => { row.inputs.digest = "0".repeat(64); },
    (row) => { row.inputs.dependencies.economicFacts.digest = "0".repeat(64); },
    (row) => { row.implementation.digest = "0".repeat(64); },
    (row) => { row.implementationSha = "invalid"; },
    (row) => { row.authority = "PRODUCTION"; },
    (row) => { row.sourceRevision = "2"; },
    (row) => { row.referencePeriods.pop(); },
  ];
  for (const mutate of mutations) {
    const tampered = structuredClone(evidence);
    mutate(tampered);
    check(() => assert.throws(() => assertMinimalEvidence(tampered, observed)));
  }
  check(() => assert.equal(JSON.stringify(source), canonicalBefore, "Compare-only assertions cannot mutate production inputs"));
  check(() => assert.equal(produceMetric({ metricId: "minimal_month_cost", scope, source }).value, value));
  const proof = await assertCurrentMinimalCertification({ month, repository, source, metric, components, repositoryRoot: root });
  check(() => assert.deepEqual(Object.keys(proof).sort(), ["certificationId", "componentCount", "evidenceHash", "status"],
    "Proof exposes no value or components to builders"));
  check(() => assert.equal(proof.componentCount, componentCount));
  check(() => assert.equal(proof.status, "PASS"));
  check(() => assert.throws(() => produceMetric({ metricId: "minimal_month_cost", scope, source: evidence }),
    "A compare-only evidence object is not a MetricProductionSource"));
  check(() => assert.throws(() => produceMetric({ metricId: "minimal_month_cost", scope, source: proof }),
    "An assertion result is not a MetricProductionSource"));
  const bundle = await repository.loadMinimalPlanningBundle({
    start: observed.referencePeriods[0] + "-01", endExclusive: month + "-01",
  });
  const changed = structuredClone(bundle);
  changed.baselineRules[0].eligibility = changed.baselineRules[0].eligibility === "Eligible" ? "Excluded" : "Eligible";
  check(() => assert.notEqual(minimalInputDigests(changed, context, month).digest, observed.inputs.digest));
  const reordered = Object.fromEntries(Object.entries(bundle).map(([key, rows]) => [key, [...rows].reverse()]));
  check(() => assert.deepEqual(minimalInputDigests(reordered, context, month), observed.inputs));
  results.push({ month, canonical: metric.value, legacy: legacyValue, componentCount, proof });
}
for (const month of ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-08", "../../invalid"]) {
  check(() => assert.equal(currentMinimalEvidenceFile(month), null));
  assert.equal(await assertCurrentMinimalCertification({ month }), null);
  checks += 1;
}
await assert.rejects(() => assertCurrentMinimalCertification({ month: "2026-02", repositoryRoot: path.join(root, "scripts") }),
  /ENOENT/, "Registered evidence cannot silently fall back to legacy when absent");
checks += 1;

// Structural boundary: the actual producer may call evidence only in its assertion phase.
const script = fs.readFileSync(path.join(root, "scripts/check-history-v2-certification-12-months.mjs"), "utf8");
const ast = ts.createSourceFile("certification.mjs", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const calls = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "assertCurrentMinimalCertification") {
    let ancestor = node.parent;
    while (ancestor && !ts.isFunctionDeclaration(ancestor)) ancestor = ancestor.parent;
    calls.push(ancestor?.name?.text);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
check(() => assert.deepEqual(calls, ["assertMonthInvariants"]));
check(() => assert.match(script, /const factResolver = new FactSourceResolver\(repository\);/));
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(file) ? [file] : [];
});
check(() => assert.ok(walk(path.join(root, "src")).every((file) =>
  !/history-v2-current-minimal|assertMinimalEvidence|observeCurrentMinimal|assertCurrentMinimalCertification/.test(fs.readFileSync(file, "utf8"))),
  "No production source imports the compare-only evidence path"));
console.log(JSON.stringify({ gate: "PASS", checks, months: results, legacyEvidence: "PRESERVED",
  productionAuthority: "CANONICAL", oracle: "COMPARE_ONLY", liveWrites: "NONE" }, null, 2));
