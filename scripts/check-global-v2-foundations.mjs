import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const globalV2 = await import("../src/core/global-v2/index.ts");
const scopeV1 = await import("../src/core/scope/index.ts");
const facts = await import("../src/analytics/facts/index.ts");
const context = await import("../src/analytics/context/index.ts");

const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const householdId = uuid(1);
const persons = [uuid(2), uuid(3), uuid(4)];
let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const rejects = (callback, pattern) => check(() => assert.throws(callback, pattern));

const normalizedV1 = scopeV1.normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "global", observationWindow: "last_12_months", asOf: "2026-07" },
});
check(() => assert.equal(
  scopeV1.computeScopeHash(normalizedV1),
  "ced744bf3cfc4da031e55cd3e82166af80b36ac334ad20a35a8c12a9acfd76fc",
));

const scopeContext = { householdTimeZone: "Europe/Paris", authorizedPersonIds: persons };
const globalScope = globalV2.parseGlobalAnalysisScopeV2({
  subject: { kind: "household" },
  time: { kind: "global_v2", asOf: "2026-07-31T22:30:00Z", certifiedThrough: "2026-07-31", liveThrough: "2026-08-01" },
}, scopeContext);
check(() => assert.deepEqual(globalScope.filters, {
  categoryIds: [], activityIds: [], merchantIds: [], placeIds: [], lifeScopeContext: [], dayContext: [],
}));
check(() => assert.equal(globalScope.time.liveThrough, "2026-08-01"));
rejects(() => globalV2.parseGlobalAnalysisScopeV2({
  subject: { kind: "household" },
  time: { kind: "global_v2", asOf: "2026-07-31T22:30:00Z", certifiedThrough: "2026-07-31", liveThrough: undefined },
}, scopeContext), /undefined|Instant|LocalDate/);
rejects(() => globalV2.parseGlobalAnalysisScopeV2({
  subject: { kind: "household" },
  time: { kind: "global_v2", asOf: "2026-07-31T22:30:00Z", certifiedThrough: "2026-07-31", observationWindow: "all_reliable_history" },
}, scopeContext), /clé non autorisée|observationWindow/);
rejects(() => globalV2.parseGlobalAnalysisScopeV2({
  subject: { kind: "household" },
  time: { kind: "global_v2", asOf: "2026-07-31T21:30:00Z", certifiedThrough: "2026-08-01" },
}, scopeContext), /postérieur/);
rejects(() => globalV2.parseGlobalAnalysisScopeV2({
  subject: { kind: "person", personId: uuid(99) },
  time: { kind: "global_v2", asOf: "2026-07-31T21:30:00Z", certifiedThrough: "2026-07-31" },
}, scopeContext), /Household autorisé/);
check(() => assert.equal(globalV2.computeGlobalAnalysisScopeV2Hash(globalScope).length, 64));
rejects(() => globalV2.canonicalSerializeGlobal({ absent: undefined }), /undefined/);

check(() => assert.deepEqual(globalV2.parseHistoricalLookback({ kind: "LAST_ELIGIBLE_UNITS", count: 12 }), { kind: "LAST_ELIGIBLE_UNITS", count: 12 }));
rejects(() => globalV2.parseHistoricalLookback({ kind: "DECLARED_RANGE", start: "2026-03-01", end: "2026-02-01" }), /précéder/);
check(() => assert.equal(globalV2.parseGlobalTimeWindowPolicy({
  policyId: "natural-month-history", policyVersion: "v1", naturalGrain: "MONTH",
  corpus: "CERTIFIED_HISTORY", lookback: { kind: "ALL_RELIABLE" }, gapPolicy: "PRESERVE", comparableIntersection: "NOT_REQUIRED",
}).naturalGrain, "MONTH"));

const support = {
  naturalGrain: "MONTH", eligibleUnits: 12, observedUnits: 10, includedUnits: 8,
  excludedObservedUnits: 2, minimumRequired: 6, supportStatus: "SUFFICIENT",
  supportStart: "2025-08-01", supportEnd: "2026-07-31", gapCount: 2, policyRef: "support-month@v1",
};
check(() => assert.equal(globalV2.parseGlobalSupport(support).includedUnits, 8));
rejects(() => globalV2.parseGlobalSupport({ ...support, excludedObservedUnits: 1 }), /included <= observed/);
check(() => assert.equal(globalV2.parseGlobalSupport({ ...support, eligibleUnits: 8, observedUnits: 8, includedUnits: 8, excludedObservedUnits: 0 }).eligibleUnits, 8));
check(() => assert.deepEqual(
  { observedUnits: globalV2.parseGlobalSupport({ ...support, eligibleUnits: 20, observedUnits: 20, includedUnits: 20, excludedObservedUnits: 0, occurrenceCount: 100 }).observedUnits,
    occurrenceCount: globalV2.parseGlobalSupport({ ...support, eligibleUnits: 20, observedUnits: 20, includedUnits: 20, excludedObservedUnits: 0, occurrenceCount: 100 }).occurrenceCount },
  { observedUnits: 20, occurrenceCount: 100 },
));
check(() => assert.equal(globalV2.parseGlobalSupport({ ...support, eligibleUnits: 7, observedUnits: 7, includedUnits: 7, excludedObservedUnits: 0, comparableEntityCount: 2 }).includedUnits, 7));
check(() => assert.equal(globalV2.parseGlobalSupport({ ...support, eligibleUnits: 10_000, observedUnits: 10_000, includedUnits: 10_000, excludedObservedUnits: 0, minimumRequired: 2, supportStatus: "INSUFFICIENT", comparableEntityCount: 0 }).supportStatus, "INSUFFICIENT"));
check(() => assert.equal(globalV2.parseGlobalSupport({ ...support, gapCount: 1, largestGapUnits: 3 }).largestGapUnits, 3));

const coverage = {
  dimensions: [
    { dimension: "FINANCIAL_SOURCE", status: "KNOWN", numerator: 9, denominator: 10, ratio: .9, unit: "component", basis: "eligible-components", evidenceRefs: ["b", "a"], policyRef: "coverage-finance@v1" },
    { dimension: "PERSON_ATTRIBUTION", status: "PARTIAL", numerator: 6, denominator: 10, ratio: .6, unit: "component", basis: "eligible-components", evidenceRefs: ["c"], policyRef: "coverage-person@v1" },
  ],
  requiredDimensions: ["FINANCIAL_SOURCE", "PERSON_ATTRIBUTION"], effective: .6, aggregation: "MIN_REQUIRED_DIMENSIONS",
};
check(() => assert.equal(globalV2.parseGlobalCoverageSet(coverage).effective, .6));
rejects(() => globalV2.parseGlobalCoverageSet({ ...coverage, effective: .75 }), /minimum/);
rejects(() => globalV2.parseGlobalCoverageMeasure({ dimension: "PLACE", status: "KNOWN", ratio: 1, unit: "visit", basis: "known", evidenceRefs: [], policyRef: "place@v1" }), /quotient prouvé/);
check(() => assert.equal(globalV2.parseGlobalCoverageMeasure({ dimension: "PLACE", status: "NOT_APPLICABLE", unit: "visit", basis: "empty-eligible-universe", evidenceRefs: [], policyRef: "place@v1" }).status, "NOT_APPLICABLE"));

const provenanceInput = {
  resultNature: "OBSERVED", precision: "EXACT", integrationMode: "INFORMATIONAL_ONLY", monetaryBasis: "AUTHORITATIVE_ECONOMIC",
  sourceRefs: ["source:b", "source:a"], factRefs: ["fact:a"], evidenceRefs: ["evidence:a"], entityRefs: [], upstreamMetricRefs: [],
  policyVersions: { coverage: "v1", support: "v1" }, dataRevision: "1", analyticsRevision: "79",
};
const provenance = globalV2.parseGlobalValueProvenance(provenanceInput);
check(() => assert.deepEqual(provenance.sourceRefs, ["source:a", "source:b"]));
check(() => assert.equal(globalV2.canonicalSerializeGlobal(provenance), globalV2.canonicalSerializeGlobal(globalV2.parseGlobalValueProvenance({ ...provenanceInput, sourceRefs: ["source:a", "source:b"] }))));
rejects(() => globalV2.parseGlobalValueProvenance({ ...provenanceInput, sourceRefs: ["narrative label with spaces"] }), /chaîne non vide canonique|GlobalValueProvenance/);

const certifiedSlice = { authority: "CERTIFIED_HISTORY", start: "2025-08-01", end: "2026-07-31", support, provenance, dependencyRefs: ["history:manifest"] };
const liveSlice = { authority: "LIVE_TAIL", start: "2026-08-01", end: "2026-08-01", support: { ...support, eligibleUnits: 1, observedUnits: 1, includedUnits: 1, excludedObservedUnits: 0 }, provenance, dependencyRefs: ["canonical:live-tail"] };
check(() => assert.equal(globalV2.parseGlobalResolvedNaturalWindow({ naturalGrain: "MONTH", certified: certifiedSlice, liveTail: liveSlice, gapDates: ["2026-04-01"] }).liveTail.authority, "LIVE_TAIL"));
rejects(() => globalV2.parseGlobalResolvedNaturalWindow({ naturalGrain: "MONTH", certified: certifiedSlice, liveTail: { ...liveSlice, start: "2026-07-31" }, gapDates: [] }), /disjoint/);

for (const status of ["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]) {
  const value = status === "KNOWN" ? { status, value: 0 }
    : status === "PARTIAL" ? { status, value: 1, partialMeaning: "OBSERVED_ONLY", partialReasons: ["OBSERVED_SUBSET"] }
      : { status };
  check(() => assert.equal(globalV2.parseGlobalKnowledgeValue(value, Number).status, status));
}
rejects(() => globalV2.parseGlobalKnowledgeValue({ status: "PARTIAL", value: 1, partialMeaning: "OBSERVED_ONLY", partialReasons: [] }, Number), /non vide/);

const engineIdentity = globalV2.parseGlobalEngineIdentity({
  engineId: "global-foundation-test", methodVersion: "global_foundation_test@v1", naturalGrain: "MONTH",
  timeWindowPolicy: { id: "time", version: "v1" }, supportPolicy: { id: "support", version: "v1" }, coveragePolicy: { id: "coverage", version: "v1" },
});
const signature = globalV2.computeGlobalEngineSignature(engineIdentity, "v1");
check(() => assert.notEqual(signature, globalV2.computeGlobalEngineSignature({ ...engineIdentity, supportPolicy: { id: "support", version: "v2" } }, "v1")));
check(() => assert.equal(signature, globalV2.computeGlobalEngineSignature({ ...engineIdentity }, "v1")));

const dependency = globalV2.parseGlobalDependencyDeclaration({
  declarationVersion: "global-dependency-declaration@v1", resourceId: "global-test",
  factDependencies: [{ kind: "FACT", id: "EconomicComponentFact", requirement: "REQUIRED", scopeRelation: "same-household", corpusAuthority: "CERTIFIED_HISTORY" }],
  entityDependencies: [], upstreamAnalytics: [], otherModuleDependencies: [], naturalGrain: "MONTH",
  timeWindowPolicy: { id: "time", version: "v1" }, historicalLookback: { kind: "ALL_RELIABLE" },
  personScope: { kind: "HOUSEHOLD" }, entityScope: { kind: "NONE" },
  supportPolicy: { id: "support", version: "v1" }, coveragePolicy: { id: "coverage", version: "v1" },
  methodVersion: "global_test@v1", policyVersions: { time: "v1", support: "v1", coverage: "v1" },
  publicationOutputs: [], invalidationScope: { kind: "RESOURCE", resourceId: "global-test" }, capabilityRequirements: [],
}, { authorizedPersonIds: persons });
check(() => globalV2.assertGlobalDependencyClosure(dependency, {
  factDependencyIds: ["EconomicComponentFact"], entityDependencyIds: [], upstreamAnalyticsIds: [], otherModuleDependencyIds: [], policyIds: ["time", "support", "coverage"],
}));
rejects(() => globalV2.assertGlobalDependencyClosure(dependency, {
  factDependencyIds: ["PersonDayFact"], entityDependencyIds: [], upstreamAnalyticsIds: [], otherModuleDependencyIds: [], policyIds: [],
}), /missing consumed/);
rejects(() => globalV2.assertNoLiveTailStructuralDependencies({ ...dependency, factDependencies: [{ ...dependency.factDependencies[0], corpusAuthority: "LIVE_TAIL" }] }, "STRUCTURAL"), /LIVE_TAIL_AUTHORITY_LEAK/);
check(() => globalV2.assertNoLiveTailStructuralDependencies({ ...dependency, factDependencies: [{ ...dependency.factDependencies[0], corpusAuthority: "LIVE_TAIL" }] }, "DESCRIPTIVE"));

check(() => assert.equal(Object.keys(globalV2.globalAuthorityGates).length, 31));
for (const gate of Object.values(globalV2.globalAuthorityGates)) check(() => assert.equal(gate.state, "UNAVAILABLE"));
check(() => assert.equal(globalV2.assertCapabilityRespectsAuthorityGates({
  capabilityId: "authority-gated", state: "UNAVAILABLE", authorityGateIds: ["AG001"], reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0"], supportedPersonScopes: [], supportedEntityScopes: [], evidenceRefs: ["ga0"], policyRef: "authority@v1",
}).state, "UNAVAILABLE"));
rejects(() => globalV2.assertCapabilityRespectsAuthorityGates({
  capabilityId: "authority-gated", state: "AVAILABLE", authorityGateIds: ["AG001"], reasonCodes: [], supportedPersonScopes: [], supportedEntityScopes: [], evidenceRefs: [], policyRef: "authority@v1",
}), /authority gate fermée/);
check(() => assert.deepEqual(globalV2.parseGlobalPersonScopePolicy({ kind: "COMPARABLE_PERSONS", personIds: [persons[1], persons[0]], intersectionPolicy: { id: "common-units", version: "v1" } }, { authorizedPersonIds: persons }).personIds, [persons[0], persons[1]]));
rejects(() => globalV2.parseGlobalPersonScopePolicy({ kind: "EXPLICIT_SHARED", personIds: [persons[0], uuid(99)], evidencePolicy: { id: "shared", version: "v1" } }, { authorizedPersonIds: persons }), /hors Household/);
check(() => assert.deepEqual(globalV2.parseGlobalEntityScopePolicy({ kind: "ENTITY_SET", entityType: "category", entityIds: ["b", "a"] }).entityIds, ["a", "b"]));
check(() => assert.equal(globalV2.parseGlobalMaterialityCandidate({
  candidateId: "candidate:a", phenomenonId: "phenomenon:a", metricRef: "metric:a", effect: { absolute: "12.5" }, knowledgeState: "KNOWN",
  support, coverage, evidenceRefs: ["evidence:a"], entityRefs: ["category:a"], methodVersion: "materiality_candidate@v1", materialityPolicy: { id: "materiality", version: "v1" },
}).candidateId, "candidate:a"));

const link = (personId, relationType, share = null, sourceKind = "Operation", sourceId = uuid(10)) => ({
  source_kind: sourceKind,
  operation_id: sourceKind === "Operation" ? sourceId : null,
  allocation_id: sourceKind === "Allocation" ? sourceId : null,
  item_id: sourceKind === "Item" ? sourceId : null,
  cash_use_id: sourceKind === "Cash_use" ? sourceId : null,
  person_id: personId, relation_type: relationType, share_exact: share,
});
const resolvePerson = (personLinks, sourceKind = "Operation", sourceId = uuid(10)) => facts.resolveEconomicPersonAttribution({ sourceKind, sourceId, personLinks, authorizedPersonIds: persons });
check(() => assert.equal(resolvePerson([link(persons[0], "payer")]).kind, "unknown"));
check(() => assert.deepEqual(resolvePerson([link(persons[0], "beneficiary")]), {
  kind: "resolved", id: persons[0], attribution: "explicit_beneficiary",
  evidenceRefs: [`financial_source_person_link:Operation:${uuid(10)}:${persons[0]}:beneficiary`], payerEvidenceRefs: [],
}));
check(() => assert.equal(resolvePerson([link(persons[0], "beneficiary"), link(persons[1], "beneficiary")]).kind, "conflict"));
check(() => assert.equal(resolvePerson([link(persons[0], "beneficiary_share", "0.25"), link(persons[1], "beneficiary_share", "0.75")]).kind, "shared"));
check(() => assert.deepEqual(resolvePerson([link(persons[0], "beneficiary_share", "0.25")]).unattributedShare, "0.75"));
check(() => assert.equal(resolvePerson([link(persons[0], "beneficiary_share", "0.75"), link(persons[1], "beneficiary_share", "0.75")]).kind, "conflict"));
check(() => assert.equal(resolvePerson([link(persons[0], "beneficiary"), link(persons[1], "beneficiary_share", "0.5")]).kind, "conflict"));
check(() => assert.equal(resolvePerson([link(uuid(99), "beneficiary")]).kind, "conflict"));
check(() => assert.equal(resolvePerson([], "Payment_component", uuid(10)).kind, "unknown"));
rejects(() => resolvePerson([link(persons[0], "beneficiary", null, "Allocation", uuid(11))]), /grain exact/);

const component = (id, net, person) => ({
  fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris",
  canonicalComponentKey: `operation:${uuid(id)}`, sourceOperation: { kind: "resolved", id: uuid(id) },
  gross: net, refundApplied: "0", net, bankDate: { kind: "known", date: "2026-07-01" },
  economicTiming: { kind: "unknown" }, person, category: { kind: "undetermined" },
  subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: { kind: "unknown" }, moment: { kind: "unknown" },
  canonicalPlace: { kind: "unknown" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
});
const coverageSelection = context.resolveEconomicComponentPersonCoverage([
  component(20, "100", { kind: "resolved", id: persons[0] }),
  component(21, "80", { kind: "shared", shares: [{ personId: persons[0], share: "0.25", evidenceRefs: ["a"] }, { personId: persons[1], share: "0.75", evidenceRefs: ["b"] }], evidenceRefs: ["a", "b"], payerEvidenceRefs: [] }),
  component(22, "40", { kind: "partial", shares: [{ personId: persons[0], share: "0.5", evidenceRefs: ["c"] }], unattributedShare: "0.5", evidenceRefs: ["c"], payerEvidenceRefs: [] }),
  component(23, "20", { kind: "unknown" }),
]);
check(() => assert.equal(coverageSelection.eligibleAbsoluteAmount, "240"));
check(() => assert.equal(coverageSelection.attributableNet, "200"));
check(() => assert.equal(coverageSelection.unattributableNet, "40"));
check(() => assert.equal(coverageSelection.fullyAttributedComponentCount, 2));
check(() => assert.equal(context.selectEconomicComponentsForPersonWithCoverage([
  component(20, "100", { kind: "resolved", id: persons[0] }),
  component(21, "80", { kind: "shared", shares: [{ personId: persons[0], share: "0.25", evidenceRefs: ["a"] }, { personId: persons[1], share: "0.75", evidenceRefs: ["b"] }], evidenceRefs: ["a", "b"], payerEvidenceRefs: [] }),
], persons[0]).selectedNet, "120"));
check(() => assert.equal(context.sumEconomicNetForSubject([
  component(20, "100", { kind: "resolved", id: persons[0] }), component(23, "20", { kind: "unknown" }),
], { kind: "household" }), "120"));

const repositorySource = fs.readFileSync(new URL("../src/server/canonical/repository.ts", import.meta.url), "utf8");
check(() => assert.match(repositorySource, /financial_source_person_links/));
check(() => assert.match(repositorySource, /loadPersonLinkRowsForComponents/));
check(() => assert.match(repositorySource, /authorizedPersonIds: this\.context\.personIds/));
check(() => assert.doesNotMatch(repositorySource, /beneficiary[^\n]{0,80}(?:0\.5|50\/50)/i));
const productionGlobalSources = fs.readdirSync(new URL("../src/core/global-v2/", import.meta.url)).filter((name) => name.endsWith(".ts"));
for (const source of productionGlobalSources) {
  const text = fs.readFileSync(new URL(`../src/core/global-v2/${source}`, import.meta.url), "utf8");
  check(() => assert.doesNotMatch(text, /certified-historical-minimal|oracle/i));
}

const index = JSON.parse(fs.readFileSync(new URL("../docs/global-v2/GLOBAL_MASTER_INDEX.json", import.meta.url), "utf8"));
check(() => assert.deepEqual(index.counts, { requirements: 2047, capabilities: 364, tests: 2302 }));
check(() => assert.equal(new Set(index.requirements.map(({ id }) => id)).size, 2047));
check(() => assert.equal(new Set(index.capabilities.map(({ id }) => id)).size, 364));
check(() => assert.equal(new Set(index.tests.map(({ id }) => id)).size, 2302));

console.log(`GLOBAL V2 FOUNDATIONS: ${checks}/${checks} PASS`);
