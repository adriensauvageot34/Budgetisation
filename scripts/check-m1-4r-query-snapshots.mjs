import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return next(candidate, context); } catch { /* continue */ }
    }
    throw error;
  }
} });

const analytics = await import("../src/analytics/global-v2/index.ts");
const candidateApi = await import("../src/server/analytics/global-v2-candidate.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const identity = await import("../src/core/identity/index.ts");
const money = await import("../src/core/money/index.ts");
const scope = await import("../src/core/scope/index.ts");
const time = await import("../src/core/time/index.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = identity.parseHouseholdId(uuid(1));
const zone = time.parseHouseholdTimeZone("Europe/Paris");
const asMoney = money.parseMoney;
const month = time.parseYearMonth;
const produced = (metricId, value, targetMonth, availability = "known") => ({
  metricId: identity.parseMetricId(metricId),
  scopeHash: scope.computeScopeHash(scope.normalizeAnalysisScope({ subject: { kind: "household" }, time: { kind: "month", month: targetMonth } })),
  availability, ...(availability === "known" ? { value: asMoney(value) } : {}), unit: "EUR/month", provenance: "derived", methodVersion: `${metricId}@v1`,
});
const monthly = Array.from({ length: 12 }, (_, index) => {
  const targetMonth = month(`2025-${String(index + 1).padStart(2, "0")}`);
  return { month: targetMonth, actual: produced("economic_consumption_net_attributable", String(100 + index * 10), targetMonth), isComplete: true, isComparable: true, isMethodExcluded: false, dependencyRefs: [`actual:${targetMonth}`] };
});
const minimal = (targetMonth, known) => analytics.adaptGlobalMinimal({
  metric: produced("minimal_month_cost", known ? "80" : "0", targetMonth, known ? "known" : "unknown"),
  neutralVariableComponents: known ? [{ canonicalComponentKey: "minimal:variable", amount: asMoney("80"), support: { n: 6, unit: "month", level: "sufficient" }, coverage: { level: "complete" }, provenance: "derived" }] : [],
  mandatoryMonthlyObligationsAndProvisions: [],
});
const history = monthly.map((entry, index) => ({
  month: entry.month, actual: analytics.adaptGlobalActual(entry.actual),
  typical: analytics.buildGlobalTypicalPair({ householdId, householdTimeZone: zone, targetMonth: entry.month, months: monthly.filter(({ month: value }) => value <= entry.month) }),
  minimal: minimal(entry.month, index < 6), dependencyRefs: entry.dependencyRefs,
}));
const dim = (value) => ({ kind: "resolved", value });
const structure = analytics.buildGlobalEconomicStructure([
  { canonicalComponentKey: "component:1", amount: asMoney("1730.27"), necessity: dim("Contrainte"), behavior: dim("Fixe"), lifeScope: dim("Vie courante") },
  { canonicalComponentKey: "component:2", amount: asMoney("322.29"), necessity: dim("Optionnelle"), behavior: dim("Variable"), lifeScope: dim("Hors quotidien") },
  { canonicalComponentKey: "component:3", amount: asMoney("148.30"), necessity: dim("Ajustable"), behavior: dim("Variable"), lifeScope: dim("Vie courante") },
  { canonicalComponentKey: "component:4", amount: asMoney("1572.28"), necessity: dim("Indispensable"), behavior: dim("Fixe"), lifeScope: dim("Vie courante") },
]);
const owner = analytics.buildGlobalM1OwnerV2({
  targetMonth: month("2025-12"), certifiedThrough: "2025-12-31", asOf: "2026-01-01T00:00:00Z", dataRevision: "1", analyticsRevision: "79",
  history, periodMinimal: minimal(month("2025-12"), true), structure, temporal: analytics.buildGlobalM1Temporal({ certifiedThroughMonth: month("2025-12"), months: monthly }),
  recurrenceObservations: [
    { recurrenceId: "facts-only", occurrenceId: "operation:1", economicDate: "2025-11-02", amount: asMoney("25"), evidenceRefs: ["operation:1"] },
    { recurrenceId: "rent", occurrenceId: "operation:2", economicDate: "2025-11-01", amount: asMoney("600"), evidenceRefs: ["operation:2"] },
    { recurrenceId: "rent", occurrenceId: "operation:3", economicDate: "2025-12-01", amount: asMoney("600"), evidenceRefs: ["operation:3"] },
  ],
  recurrenceAuthorities: [{ recurrenceId: "rent", expectedOccurrenceAmount: asMoney("600"), expectedOccurrencesPerYear: 12, lifecycle: "ACTIVE", effectiveFrom: "2025-01-01", declaredAt: "2025-01-01T00:00:00Z", sourceRevision: "1", evidenceRefs: ["authority:rent"] }],
  dependencyDeclaration: analytics.createGlobalM1DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [] }),
  factsDigest: "facts:digest", classificationsDigest: "classifications:digest",
});
const ownerOutputs = query.globalPrimaryModuleCatalog.map(({ moduleKey }, index) => ({
  moduleKey, owner: moduleKey === "ECONOMIC" ? "GlobalM1OwnerOutputV2" : `OwnerM${index + 1}`, output: moduleKey === "ECONOMIC" ? owner : {}, knowledge: "KNOWN", capabilityState: "AVAILABLE", reasonCodes: [], evidenceRefs: [`owner:m${index + 1}`],
}));
const candidate = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  project: "local-r3", householdId: uuid(1), householdTimeZone: "Europe/Paris", personIds: [], asOf: "2026-01-01T00:00:00Z", certifiedThrough: "2025-12-31",
  dataRevision: "1", analyticsRevision: "79", implementationIdentity: "72eefdbb508e4f86461824a8d3a34a53ecf3eb92", ownerOutputs,
  presentationLabels: { recurrences: { "facts-only": "Salle de sport", rent: "Loyer" } },
});
const snapshot = (resource, params = {}) => candidate.snapshots.find((entry) => entry.resource === resource && Object.entries(params).every(([key, value]) => entry.params[key] === value));
const compact = snapshot("analysis_global_economic").payload;
const overview = snapshot("analysis_global_economic_expanded", { sectionKey: "OVERVIEW" }).payload;
const evolution = snapshot("analysis_global_economic_expanded", { sectionKey: "EVOLUTION" }).payload;
const breakdown = snapshot("analysis_global_economic_expanded", { sectionKey: "BREAKDOWN" }).payload;
const patterns = snapshot("analysis_global_economic_expanded", { sectionKey: "PATTERNS" }).payload;
const comparisons = snapshot("analysis_global_economic_expanded", { sectionKey: "COMPARISONS" }).payload;
const recurrenceDetails = candidate.snapshots.filter(({ resource }) => resource === "analysis_global_economic_recurrence_detail");

check(() => assert.equal(query.parseGlobalTypedMeasure({ kind: "MONEY", value: "210", unit: "EUR/month" }).value, "210"));
check(() => assert.equal(query.parseGlobalTypedMeasure({ kind: "DECIMAL", value: "-0.01542579595451261247", unit: "ratio/month" }).value, "-0.01542579595451261247"));
check(() => assert.throws(() => query.parseGlobalTypedMeasure({ kind: "RATIO", value: "2", unit: "ratio" })));
check(() => assert.throws(() => query.parseGlobalTypedMeasure({ kind: "COUNT", value: "01", unit: "occurrence" })));
check(() => assert.equal(compact.kpis.length, 3));
check(() => assert.deepEqual(compact.kpis.map(({ phenomenonRef }) => phenomenonRef), ["global-m1:actual", "global-m1:minimal-state", "global-m1:typical-state"]));
check(() => assert.equal(compact.kpis.every(({ phenomenonQuality }) => phenomenonQuality !== undefined), true));
check(() => assert.equal(compact.kpis.find(({ kpiId }) => kpiId.endsWith("minimal-state")).phenomenonQuality.knowledgeState, "KNOWN"));
check(() => assert.equal(compact.primaryInsight.statementKey.includes("60"), true));
check(() => assert.ok(overview.metrics.some(({ metricId }) => metricId === "typical-state")));
check(() => assert.ok(overview.metrics.some(({ metricId }) => metricId === "actual-reference-delta")));
check(() => assert.equal(evolution.series.length, 3));
check(() => assert.equal(evolution.series.reduce((sum, entry) => sum + entry.points.length, 0), 36));
check(() => assert.equal(evolution.series.find(({ seriesId }) => seriesId.endsWith("actual")).points.every(({ typedMeasure }) => typedMeasure !== undefined), true));
check(() => assert.equal(evolution.series.find(({ seriesId }) => seriesId.endsWith("minimal-state")).points.filter(({ knowledgeState }) => knowledgeState === "UNKNOWN").every((point) => point.typedMeasure === undefined && point.displayValue === undefined), true));
check(() => assert.deepEqual(["recent-delta", "trend-slope", "trend-relative-slope", "dispersion-median", "dispersion-q1", "dispersion-q3", "dispersion-iqr", "dispersion-mad", "dispersion-min", "dispersion-max", "dispersion-amplitude"].filter((id) => !evolution.metrics.some(({ metricId }) => metricId === id)), []));
check(() => assert.ok(breakdown.rows.some(({ labelKey, displayValue }) => labelKey === "Nécessité · Contraint" && displayValue.includes("1 730,27") && /\d+ %/u.test(displayValue))));
check(() => assert.ok(breakdown.rows.some(({ labelKey }) => labelKey === "Nécessité · Optionnel")));
check(() => assert.ok(breakdown.rows.some(({ labelKey, displayValue }) => labelKey === "Nécessité · Dépenses ajustables" && displayValue.includes("148,3"))));
check(() => assert.ok(breakdown.rows.some(({ labelKey }) => labelKey === "Périmètre de vie · Vie courante")));
check(() => assert.ok(breakdown.rows.some(({ labelKey }) => labelKey === "Périmètre de vie · Hors quotidien")));
check(() => assert.equal(breakdown.rows.some(({ labelKey }) => /CURRENT|NON_CURRENT|Évolution|Non classé|Classification en conflit/u.test(labelKey)), false));
check(() => assert.ok(patterns.metrics.some(({ metricId }) => metricId === "recurrence-structural")));
check(() => assert.equal(patterns.rows.length <= 50, true));
check(() => assert.ok(patterns.rows.some(({ labelKey, displayValue, knowledgeState }) => labelKey === "Salle de sport" && displayValue.includes("≈ 25 € / paiement") && displayValue.includes("1 paiement observé") && displayValue.includes("novembre 2025") && !/Cadence|Cycle de vie/u.test(displayValue) && knowledgeState === "KNOWN")));
check(() => assert.equal(comparisons.rows.length, 0));
check(() => assert.equal(recurrenceDetails.length, 2));
check(() => assert.equal(recurrenceDetails.every(({ params, payload }) => typeof params.entityRef === "string" && payload.kind === "global_expanded"), true));
check(() => assert.equal(recurrenceDetails.every(({ payload }) => payload.metrics.length === 3 && payload.rows.length === 5), true));
check(() => assert.ok(snapshot("analysis_global_methodology", { moduleKey: "ECONOMIC", methodRef: "method:global-economic@v1" }).payload.rows.some(({ labelKey }) => labelKey === "Données certifiées jusqu’au")));
check(() => assert.equal(snapshot("analysis_global_methodology", { moduleKey: "ECONOMIC" }).params.methodRef, "method:global-economic@v1"));
check(() => assert.equal(candidate.requiredKeys.queries.some((key) => recurrenceDetails.some((detail) => detail.key === key)), true));
check(() => assert.equal(candidate.manifest.closures.length, candidate.requiredKeys.queries.length + candidate.requiredKeys.artifacts.length));
check(() => assert.equal(new Set(candidate.requiredKeys.queries).size, candidate.requiredKeys.queries.length));
check(() => assert.equal(candidate.snapshots.every(({ payload }) => payload.publicationMeta.publicationId === candidate.candidateId && payload.publicationMeta.manifestHash === candidate.manifestHash), true));
check(() => assert.equal(JSON.stringify(evolution).includes('"value":"0"'), false));
check(() => assert.doesNotMatch(fs.readFileSync("src/server/analytics/global-v2-candidate.ts", "utf8"), /numberOf\([^\n]*displayValue/u));

console.log(`M1 4R Query/snapshots: ${checks}/${checks} PASS; snapshots=${candidate.requiredSnapshotCount}; recurrenceDetails=${recurrenceDetails.length}`);
