// Certification assertions only. Never a MetricProductionSource or builder input.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Big from "big.js";

export const currentMinimalEvidenceFile = "scripts/certification/history-v2-current-minimal/2026-01.json";
const groups = ["neutralVariableComponents", "mandatoryMonthlyObligationsAndProvisions"];
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
export const evidenceDigest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const ordered = (rows) => rows.map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
const pick = (row, keys) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null]));
const project = (rows, keys) => ordered(rows.map((row) => pick(row, keys)));
const sha256File = (file) => createHash("sha256").update(fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n")).digest("hex");

export function minimalImplementationDigest(root) {
  const walk = (relative) => fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const file = relative + "/" + entry.name;
    return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
  const files = [
    ...["src/analytics", "src/core", "src/server/canonical"].flatMap(walk),
    "src/server/analytics/fact-source-resolver.ts", "src/server/analytics/minimal-source-resolver.ts",
    "package.json", "package-lock.json",
  ].sort();
  return { format: "minimal-source-tree-sha256-lf-v1", digest: evidenceDigest(files.map((file) => ({ file, digest: sha256File(path.join(root, file)) }))) };
}

export function minimalInputDigests(bundle, context, month) {
  const metadata = ["type_precis", "role_budgetaire", "mode_prevision", "recurrence_series_id", "need_id", "annual_event_id", "provision_pool_id"];
  const inputs = {
    scopeAndPeriods: { householdId: context.householdId, dataRevision: context.dataRevision,
      periods: project(context.periods.filter((row) => row.month.slice(0, 7) <= month),
        ["month", "financeStatus", "isClosed"]) },
    economicFacts: project(bundle.economicFacts, ["canonicalComponentKey", "sourceOperation", "category", "subcategory", "economicTiming"]),
    operations: project(bundle.operations, ["operation_id", ...metadata]),
    allocations: project(bundle.allocations, ["allocation_id", ...metadata]),
    items: project(bundle.items, ["item_id", "nom", ...metadata]),
    paymentComponents: project(bundle.paymentComponents, ["payment_component_id", "component_type", ...metadata]),
    cashUses: project(bundle.cashUses, ["cash_use_id", ...metadata]),
    baselineRules: project(bundle.baselineRules, ["baseline_rule_id", "category_id", "subcategory_id", "type_precis", "eligibility", "condition_code", "valid_from", "valid_to", "method_version"]),
    needs: project(bundle.needs, ["need_id", "person_id", "actif"]),
    recurrenceSeries: project(bundle.recurrenceSeries, ["recurrence_series_id", "actif_prevision"]),
    provisionPools: project(bundle.provisionPools, ["provision_pool_id", "methode", "application_auto", "mode_prevision", "need_source_id", "source_prevision_canonique"]),
    annualEvents: project(bundle.annualEvents, ["annual_event_id", "recurrence", "provision_auto", "methode_budget_reference", "source_prevision_canonique"]),
    worksiteActivityTypeIds: ordered(bundle.worksiteActivityTypeIds),
    plannedActivityDays: project(bundle.plannedActivityDays, ["activityId", "startDate"]),
  };
  const dependencies = Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, {
    count: Array.isArray(value) ? value.length : 1, digest: evidenceDigest(value),
  }]));
  return { format: "minimal-canonical-projections-sha256-v1", dependencies, digest: evidenceDigest(dependencies) };
}

export async function observeCurrentMinimal({ repository, source, metric, repositoryRoot }) {
  assert.equal(source.kind, "minimal_month");
  assert.equal(source.availability, "known");
  assert.ok(!("certifiedHistoricalValue" in source), "Canonical recompute must not inject frozen evidence");
  assert.equal(metric.availability, "known");
  const month = "2026-01";
  const require = createRequire(path.join(repositoryRoot, "package.json"));
  const { TYPICAL_MONTH_REQUESTED_PERIOD_COUNT } = require(path.join(repositoryRoot, "src/analytics/references/index.ts"));
  const referencePeriods = repository.context.periods
    .filter(({ month: period, financeStatus, isClosed }) => financeStatus === "complete" && isClosed && period.slice(0, 7) < month)
    .map(({ month: period }) => period.slice(0, 7)).sort().slice(-TYPICAL_MONTH_REQUESTED_PERIOD_COUNT);
  assert.deepEqual(referencePeriods, ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]);
  const bundle = await repository.loadMinimalPlanningBundle({ start: "2025-08-01", endExclusive: "2026-01-01" });
  return {
    month, availability: "known", finalValue: metric.value, MethodVersion: metric.methodVersion,
    referencePeriods, sourceRevision: repository.context.dataRevision,
    implementation: minimalImplementationDigest(repositoryRoot),
    inputs: minimalInputDigests(bundle, repository.context, month),
    ...Object.fromEntries(groups.map((group) => [group, ordered(source[group].map((component) =>
      pick(component, ["canonicalComponentKey", "amount", "support", "coverage", "provenance"])))])),
  };
}

export function assertMinimalEvidence(evidence, observed) {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.authority, "COMPARE_ONLY");
  assert.equal(evidence.certificationId, "hc6-b2a-r2-current-minimal-2026-01-v1");
  assert.match(evidence.implementationSha, /^[0-9a-f]{40}$/);
  assert.ok(Number.isFinite(Date.parse(evidence.certifiedAt)));
  assert.equal(evidence.source, "CanonicalRepository -> FactSourceResolver -> produceMetric(minimal_month_cost); B2A read-only export");
  const expected = Object.fromEntries(Object.keys(observed).map((key) => [key, evidence[key]]));
  assert.deepEqual(observed, expected, "Current Minimal evidence differs from Canonical/implementation inputs");
  const components = groups.flatMap((group) => evidence[group]);
  assert.equal(components.length, 17);
  assert.equal(new Set(components.map((row) => row.canonicalComponentKey)).size, 17);
  assert.equal(components.reduce((sum, row) => sum.plus(row.amount), new Big(0)).toFixed(), evidence.finalValue);
  assert.equal(evidence.finalValue, "1709.194");
  assert.equal(components.find((row) => row.canonicalComponentKey === "minimal:need:ae28d8ba-a1b3-5f6e-9b46-cb39b415e4ea")?.amount, "12");
  // Return proof metadata, never an expected amount or components for a payload.
  return { status: "PASS", certificationId: evidence.certificationId, evidenceHash: evidenceDigest(evidence), componentCount: 17 };
}

export async function assertCurrentMinimalCertification({ month, repository, source, metric, components, repositoryRoot }) {
  if (month !== "2026-01") return null; // Other months retain their existing compare-only oracle.
  const evidence = JSON.parse(fs.readFileSync(path.join(repositoryRoot, currentMinimalEvidenceFile), "utf8"));
  const observed = await observeCurrentMinimal({ repository, source, metric, repositoryRoot });
  assert.deepEqual(ordered(components), ordered(groups.flatMap((group) => observed[group])),
    "History authority components must equal the independently resolved Canonical source");
  return assertMinimalEvidence(evidence, observed);
}
