import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";
import { assertMinimalEvidence, assertCurrentMinimalCertification, observeCurrentMinimal,
  minimalInputDigests, currentMinimalEvidenceFile } from "./lib/history-v2-current-minimal-evidence.mjs";

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
const scope = { subject: { kind: "household" }, time: { kind: "month", month: "2026-01" } };
const source = await new FactSourceResolver(repository).resolve("minimal_month_cost", scope);
const metric = produceMetric({ metricId: "minimal_month_cost", scope, source });
const observed = await observeCurrentMinimal({ repository, source, metric, repositoryRoot: root });
const evidence = JSON.parse(fs.readFileSync(path.join(root, currentMinimalEvidenceFile), "utf8"));
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
check(() => assert.equal(metric.value, "1709.194", "Canonical engine recompute"));
check(() => assert.equal(evidence.finalValue, "1709.194", "Current compare-only expectation"));
check(() => assert.equal(assertMinimalEvidence(evidence, observed).status, "PASS"));
const legacySource = certifiedHistoricalMinimalSource.resolve({ month: scope.time.month, scopeHash: source.scopeHash });
check(() => assert.equal(produceMetric({ metricId: "minimal_month_cost", scope, source: legacySource }).value,
  "1713.194", "Legacy January compatibility stays frozen"));
const legacyFile = fs.readFileSync(path.join(root, "src/server/analytics/materialization/certified-historical-minimal.json"));
check(() => assert.equal(createHash("sha256").update(legacyFile).digest("hex"), evidence.legacyEvidenceSha256));
check(() => assert.ok(!("certifiedHistoricalValue" in source)));
const canonicalBefore = JSON.stringify(source);
const wrongEvidence = structuredClone(evidence);
wrongEvidence.finalValue = "1713.194";
check(() => assert.throws(() => assertMinimalEvidence(wrongEvidence, observed)));
const wrongComponent = structuredClone(evidence);
wrongComponent.neutralVariableComponents.find((row) => row.canonicalComponentKey.startsWith("minimal:need:ae28")).amount = "16";
check(() => assert.throws(() => assertMinimalEvidence(wrongComponent, observed)));
check(() => assert.equal(JSON.stringify(source), canonicalBefore, "Evidence checks cannot mutate production inputs"));
check(() => assert.equal(produceMetric({ metricId: "minimal_month_cost", scope, source }).value, "1709.194"));
const proof = await assertCurrentMinimalCertification({ month: "2026-01", repository, source, metric,
  components: [...source.neutralVariableComponents, ...source.mandatoryMonthlyObligationsAndProvisions], repositoryRoot: root });
check(() => assert.deepEqual(Object.keys(proof).sort(), ["certificationId", "componentCount", "evidenceHash", "status"],
  "Proof exposes no value or components to builders"));
check(() => assert.equal(proof.status, "PASS"));
const bundle = await repository.loadMinimalPlanningBundle({ start: "2025-08-01", endExclusive: "2026-01-01" });
const changed = structuredClone(bundle);
changed.baselineRules[0].eligibility = changed.baselineRules[0].eligibility === "Eligible" ? "Excluded" : "Eligible";
check(() => assert.notEqual(minimalInputDigests(changed, context, "2026-01").digest, observed.inputs.digest));
const reordered = Object.fromEntries(Object.entries(bundle).map(([key, rows]) => [key, [...rows].reverse()]));
check(() => assert.deepEqual(minimalInputDigests(reordered, context, "2026-01"), observed.inputs));
const badDigest = structuredClone(evidence);
badDigest.inputs.digest = "0".repeat(64);
check(() => assert.throws(() => assertMinimalEvidence(badDigest, observed)));
const badImplementation = structuredClone(evidence);
badImplementation.implementation.digest = "0".repeat(64);
check(() => assert.throws(() => assertMinimalEvidence(badImplementation, observed)));
assert.equal(await assertCurrentMinimalCertification({ month: "2026-02" }), null);
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
console.log(JSON.stringify({ gate: "PASS", checks, month: "2026-01", canonical: metric.value,
  legacy: "1713.194", currentCompareOnly: evidence.finalValue, proof, liveWrites: "NONE" }, null, 2));
