import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* next */ }
      }
      throw originalError;
    }
  },
});

const analytics = await import("../src/analytics/global-v2/index.ts");
const identity = await import("../src/core/identity/index.ts");
const core = await import("../src/core/global-v2/index.ts");
const { parseMoney } = await import("../src/core/money/index.ts");
const { parseYearMonth } = await import("../src/core/time/index.ts");

let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };
const rejects = (assertion, pattern) => check(() => assert.throws(assertion, pattern));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const personA = identity.parsePersonId(uuid(1));
const personB = identity.parsePersonId(uuid(2));

const amountDefinition = (overrides = {}) => ({
  metricId: "personal-food",
  family: "FOOD_AND_WORK_MEALS",
  grain: "MONTH",
  comparisonMode: "AMOUNT",
  materialityPolicyId: "PERSONA_MONEY",
  allowedDataNatures: ["OBSERVED", "DECLARED_EXACT", "HYBRID", "ESTIMATED"],
  exceptionalPolicy: "SEPARATE",
  humanRelevance: "CORE",
  redundancyGroup: "food-cost",
  canAppearInTopDifferences: true,
  minimumComparableUnits: 3,
  methodVersion: "persona-food@v1",
  ...overrides,
});
const observation = (personId, unitId, value, overrides = {}) => ({
  metricId: "personal-food",
  personId,
  unitId,
  value: String(value),
  habitualValue: String(value),
  exceptionalValue: "0",
  knowledge: "KNOWN",
  observable: true,
  dataNature: "OBSERVED",
  evidenceRefs: [`evidence:${personId}:${unitId}`],
  ...overrides,
});
const paired = (aValues, bValues, overrides = {}) => [
  ...aValues.map((value, i) => observation(personA, `2026-${String(i + 1).padStart(2, "0")}`, value, overrides.a?.[i])),
  ...bValues.map((value, i) => observation(personB, `2026-${String(i + 1).padStart(2, "0")}`, value, overrides.b?.[i])),
];
const differences = (observations, definition = amountDefinition(), temporalStatus = "STABLE_CURRENT_REGIME") => analytics.buildGlobalPersonaDifferences({
  definitions: [definition], personAId: personA, personBId: personB, observations,
  temporalStatusByMetric: { [definition.metricId]: temporalStatus },
});

// G1: own-support metrics are not forced onto a common or Household window.
const asymmetric = paired([30, 30, 30, 30, 30, 30], [10, 10, 10, 10]);
const metrics = analytics.buildGlobalPersonaMetrics({ definitions: [amountDefinition()], personIds: [personA, personB], observations: asymmetric });
check(() => assert.equal(metrics.length, 2));
check(() => assert.equal(metrics.find(({ personId }) => personId === personA).observedUnitIds.length, 6));
check(() => assert.equal(metrics.find(({ personId }) => personId === personB).observedUnitIds.length, 4));
check(() => assert.equal(metrics.find(({ personId }) => personId === personA).rawValue, "30"));
check(() => assert.equal(metrics.find(({ personId }) => personId === personB).rawValue, "10"));
rejects(() => analytics.buildGlobalPersonaMetrics({ definitions: [amountDefinition()], personIds: [personA, personA], observations: [] }), /P11_PERSON_SCOPE_INVALID/);
rejects(() => analytics.buildGlobalPersonaMetrics({ definitions: [amountDefinition(), amountDefinition()], personIds: [personA, personB], observations: [] }), /P11_DUPLICATE_PERSONA_METRIC/);
rejects(() => analytics.buildGlobalPersonaMetrics({ definitions: [amountDefinition()], personIds: [personA, personB], observations: [observation(personA, "2026-01", 10), observation(personA, "2026-01", 11)] }), /P11_CONTRADICTORY_OBSERVATION/);
const duplicateMetric = analytics.buildGlobalPersonaMetrics({ definitions: [amountDefinition()], personIds: [personA, personB], observations: [observation(personA, "2026-01", 10), observation(personA, "2026-01", 10)] });
check(() => assert.equal(duplicateMetric.find(({ personId }) => personId === personA).observedUnitIds.length, 1));
check(() => assert.equal(analytics.globalPersonaFamilyCatalog.length, 10));
check(() => assert.equal(new Set(analytics.globalPersonaFamilyCatalog).size, 10));

// G2: differences use the exact observable intersection and its own coverage.
const asymDifference = differences(asymmetric)[0];
check(() => assert.equal(asymDifference.comparableUnitIds.length, 4));
check(() => assert.equal(asymDifference.rawDifference, "20"));
check(() => assert.equal(asymDifference.habitualDifference, "20"));
check(() => assert.equal(asymDifference.coverage.effective, 4 / 6));
check(() => assert.equal(asymDifference.headlineEligible, false));
check(() => assert.ok(asymDifference.reasonCodes.includes("DETAIL_ONLY_PARTIAL_COVERAGE")));

const fullDifference = differences(paired([30, 30, 30, 30, 30, 30], [10, 10, 10, 10, 10, 10]))[0];
check(() => assert.equal(fullDifference.materialityStatus, "MATERIAL"));
check(() => assert.equal(fullDifference.headlineEligible, true));
check(() => assert.ok(fullDifference.score > 0));
check(() => assert.equal(fullDifference.dataNature, "OBSERVED"));

const equal = differences(paired([10, 10, 10], [10, 10, 10]))[0];
check(() => assert.equal(equal.materialityStatus, "NOT_MATERIAL"));
check(() => assert.equal(equal.headlineEligible, false));

// Exceptional raw differences remain visible but never become habitual by local invention.
const exceptionalRows = paired([110, 110, 110], [10, 10, 10], {
  a: [0, 1, 2].map(() => ({ habitualValue: "10", exceptionalValue: "100" })),
});
const exceptional = differences(exceptionalRows)[0];
check(() => assert.equal(exceptional.rawDifference, "100"));
check(() => assert.equal(exceptional.habitualDifference, "0"));
check(() => assert.equal(exceptional.exceptionalContributionShare, "1"));
check(() => assert.equal(exceptional.headlineEligible, false));
check(() => assert.ok(exceptional.reasonCodes.includes("DOMINANT_EXCEPTIONAL_WITHOUT_HABITUAL_MATERIALITY")));

// Missing/partial observations cannot be converted into a known zero or absence conclusion.
const unknownOther = differences(paired([3, 3, 3], [0, 0, 0], { b: [{ knowledge: "UNKNOWN" }, { knowledge: "UNKNOWN" }, { knowledge: "UNKNOWN" }] }), amountDefinition({ comparisonMode: "FREQUENCY", materialityPolicyId: "PERSONA_FREQUENCY" }))[0];
check(() => assert.equal(unknownOther.comparableUnitIds.length, 0));
check(() => assert.equal(unknownOther.materialityStatus, "INELIGIBLE"));
check(() => assert.equal(unknownOther.headlineEligible, false));
const knownZero = differences(paired([3, 3, 3], [0, 0, 0]), amountDefinition({ comparisonMode: "FREQUENCY", materialityPolicyId: "PERSONA_FREQUENCY" }))[0];
check(() => assert.equal(knownZero.materialityStatus, "MATERIAL"));
check(() => assert.equal(knownZero.headlineEligible, true));
const partial = differences(paired([30, 30, 30], [10, 10, 10], { b: [undefined, { knowledge: "PARTIAL" }, undefined] }))[0];
check(() => assert.equal(partial.comparableUnitIds.length, 2));
check(() => assert.equal(partial.headlineEligible, false));

// Temporal policy: historical/changed/insufficient never headline; only one recent card.
for (const state of ["HISTORICAL_ONLY", "CHANGED_DIFFERENCE", "INSUFFICIENT_TEMPORAL_SUPPORT"]) {
  check(() => assert.equal(differences(paired([30, 30, 30], [10, 10, 10]), amountDefinition(), state)[0].headlineEligible, false));
}
check(() => assert.equal(differences(paired([30, 30, 30], [10, 10, 10]), amountDefinition(), "RECENT_ONLY")[0].headlineEligible, true));

// Ranking: max 6, max 2/family, one redundancy group, max one RECENT_ONLY and deterministic ties.
const candidate = (id, family, score, overrides = {}) => ({
  ...fullDifference,
  differenceId: id,
  metricId: id,
  family,
  score,
  redundancyGroup: `group:${id}`,
  ...overrides,
});
const candidateSet = [
  candidate("a", "FOOD_AND_WORK_MEALS", 0.9, { redundancyGroup: "same" }),
  candidate("b", "FOOD_AND_WORK_MEALS", 0.89, { redundancyGroup: "same" }),
  candidate("c", "FOOD_AND_WORK_MEALS", 0.88),
  candidate("d", "MOBILITY", 0.87, { temporalStatus: "RECENT_ONLY" }),
  candidate("e", "MOBILITY", 0.86, { temporalStatus: "RECENT_ONLY" }),
  candidate("f", "PERSONAL_CARE", 0.85),
  candidate("g", "LEISURE_AND_ACTIVITIES", 0.84),
  candidate("h", "PLACES", 0.83),
];
const selected = analytics.selectGlobalPersonaTopDifferences({ candidates: candidateSet });
check(() => assert.equal(selected.length, 6));
check(() => assert.equal(selected.filter(({ family }) => family === "FOOD_AND_WORK_MEALS").length, 2));
check(() => assert.equal(selected.filter(({ temporalStatus }) => temporalStatus === "RECENT_ONLY").length, 1));
check(() => assert.equal(selected.filter(({ redundancyGroup }) => redundancyGroup === "same").length, 1));
check(() => assert.deepEqual(analytics.selectGlobalPersonaTopDifferences({ candidates: [...candidateSet].reverse() }).map(({ differenceId }) => differenceId), selected.map(({ differenceId }) => differenceId)));
rejects(() => analytics.selectGlobalPersonaTopDifferences({ candidates: [candidate("same-id", "MOBILITY", 0.8), candidate("same-id", "PLACES", 0.8)] }), /P11_CONTRADICTORY_CANDIDATE/);
const three = analytics.selectGlobalPersonaTopDifferences({ candidates: candidateSet.slice(5) });
check(() => assert.equal(three.length, 3));
const natureCandidates = [
  candidate("observed-1", "MOBILITY", 0.9, { dataNature: "OBSERVED" }),
  candidate("observed-2", "PLACES", 0.89, { dataNature: "OBSERVED" }),
  candidate("observed-3", "SOCIAL_AND_FAMILY", 0.88, { dataNature: "OBSERVED" }),
  candidate("observed-4", "PERSONAL_CARE", 0.87, { dataNature: "OBSERVED" }),
  candidate("estimated-1", "PERSONAL_PURCHASES", 0.99, { dataNature: "ESTIMATED" }),
  candidate("estimated-2", "RECURRING_PERSONAL_COSTS", 0.98, { dataNature: "HYBRID" }),
  candidate("estimated-3", "LEISURE_AND_ACTIVITIES", 0.97, { dataNature: "DECLARED_EXACT" }),
];
const natureSelection = analytics.selectGlobalPersonaTopDifferences({ candidates: natureCandidates });
check(() => assert.equal(natureSelection.filter(({ dataNature }) => dataNature !== "OBSERVED").length, 2));

// Hysteresis keeps a still-eligible incumbent unless the challenger clears +10%.
const incumbent = candidate("incumbent", "MOBILITY", 0.5);
const slightlyBetter = candidate("challenger", "PLACES", 0.54);
const hysteretic = analytics.selectGlobalPersonaTopDifferences({ candidates: [slightlyBetter, incumbent], previousSelection: { incumbent: 0.5 } });
check(() => assert.equal(hysteretic[0].differenceId, "incumbent"));
const clearlyBetter = analytics.selectGlobalPersonaTopDifferences({ candidates: [candidate("challenger2", "PLACES", 0.56), incumbent] });
check(() => assert.equal(clearlyBetter[0].differenceId, "challenger2"));
const hysteresisReleased = analytics.selectGlobalPersonaTopDifferences({ candidates: [candidate("challenger2", "PLACES", 0.56), incumbent], previousSelection: { incumbent: 0.5 } });
check(() => assert.equal(hysteresisReleased[0].differenceId, "challenger2"));

// ObservedPersonalTypicalCost: median, 12-month cap, 6-month support and two distinct coverages.
const month = (n, amount, overrides = {}) => ({ month: parseYearMonth(`2025-${String(n).padStart(2, "0")}`), amount: parseMoney(String(amount)), financialSourceCoverage: 1, personalAttributionCoverage: 0.9, knowledge: "KNOWN", evidenceRefs: [`month:${n}`], ...overrides });
const observed = analytics.buildObservedPersonalTypicalCost([1, 2, 3, 4, 5, 6].map((n) => month(n, n * 10)));
check(() => assert.equal(observed.status, "HEADLINE_READY"));
check(() => assert.equal(observed.value, "35"));
check(() => assert.equal(observed.supportMonths, 6));
const lowAttribution = analytics.buildObservedPersonalTypicalCost([1, 2, 3, 4, 5, 6].map((n) => month(n, n * 10, { personalAttributionCoverage: 0.72 })));
check(() => assert.equal(lowAttribution.status, "QUALIFIED_DETAIL"));
const tooLow = analytics.buildObservedPersonalTypicalCost([1, 2, 3, 4, 5, 6].map((n) => month(n, n * 10, { personalAttributionCoverage: 0.59 })));
check(() => assert.equal(tooLow.status, "UNAVAILABLE"));
check(() => assert.equal(tooLow.value, null));
const incompleteFinance = analytics.buildObservedPersonalTypicalCost([1, 2, 3, 4, 5, 6].map((n) => month(n, n * 10, { financialSourceCoverage: 0.99 })));
check(() => assert.equal(incompleteFinance.status, "QUALIFIED_DETAIL"));
const short = analytics.buildObservedPersonalTypicalCost([1, 2, 3, 4, 5].map((n) => month(n, n * 10)));
check(() => assert.equal(short.status, "UNAVAILABLE"));
const adapted = analytics.adaptObservedPersonalMonthsFromP01([{
  month: parseYearMonth("2026-01"),
  selection: { value: { status: "PARTIAL", value: parseMoney("42"), partialMeaning: "OBSERVED_ONLY", partialReasons: ["PARTIAL_SOURCE"] }, attributableAmount: parseMoney("42"), unattributableAmount: parseMoney("8"), eligibleComponentCount: 2, fullyAttributedComponentCount: 1, amountCoverage: 0.84, conflictComponentKeys: [], inputHash: "p01-hash" },
  financialSourceCoverage: 1,
  evidenceRefs: ["canonical:financial-source-person-links"],
}]);
check(() => assert.equal(adapted[0].amount, "42"));
check(() => assert.equal(adapted[0].personalAttributionCoverage, 0.84));
check(() => assert.equal(adapted[0].knowledge, "PARTIAL"));
check(() => assert.ok(adapted[0].evidenceRefs.includes("p01-selection:p01-hash")));

// PersonalReferenceCost: AG022 fail-closed, no duplicate identities, provenance nature retained.
const contribution = (contributionId, amount, nature, integrationMode, identities, overrides = {}) => ({ contributionId, amount: parseMoney(String(amount)), nature, integrationMode, economicIdentityRefs: identities, structurallyApplicable: false, evidenceRefs: [`evidence:${contributionId}`], ...overrides });
const contributions = [
  contribution("observed", 80, "OBSERVED", "OBSERVED", ["economic:1"]),
  contribution("declared", 10, "DECLARED_EXACT", "SUPPLEMENT_UNOBSERVED", ["economic:2"], { structurallyApplicable: true }),
  contribution("estimated", 10, "ESTIMATED", "SUPPLEMENT_UNOBSERVED", ["economic:3"]),
  contribution("duplicate-derived", 80, "ESTIMATED", "SUPPLEMENT_UNOBSERVED", ["economic:1"]),
];
const gated = analytics.buildGlobalPersonalReferenceCost({ authority: "AG022_CLOSED", personalAttributionCoverage: 1, supportMonths: 12, contributions });
check(() => assert.equal(gated.status, "AUTHORITY_GATED"));
check(() => assert.equal(gated.value, null));
check(() => assert.ok(gated.reasonCodes.includes("AG022_PERSONAL_REFERENCE_AUTHORITY_ABSENT")));
const reference = analytics.buildGlobalPersonalReferenceCost({ authority: "EXPLICIT_ENRICHMENT_AUTHORITY", personalAttributionCoverage: 0.9, supportMonths: 6, contributions });
check(() => assert.equal(reference.status, "HEADLINE_READY"));
check(() => assert.equal(reference.value, "100"));
check(() => assert.equal(reference.groundedShare, 0.9));
check(() => assert.equal(reference.estimatedShare, 0.1));
check(() => assert.ok(reference.excludedContributionIds.includes("duplicate-derived")));
check(() => assert.ok(reference.reasonCodes.includes("OVERLAP_OR_INFORMATIONAL_EXCLUDED")));
const mostlyEstimated = analytics.buildGlobalPersonalReferenceCost({ authority: "EXPLICIT_ENRICHMENT_AUTHORITY", personalAttributionCoverage: 1, supportMonths: 6, contributions: [contribution("observed", 40, "OBSERVED", "OBSERVED", ["a"]), contribution("estimate", 60, "ESTIMATED", "SUPPLEMENT_UNOBSERVED", ["b"])] });
check(() => assert.equal(mostlyEstimated.status, "COMPONENTS_ONLY"));
check(() => assert.equal(mostlyEstimated.value, null));
check(() => assert.ok(mostlyEstimated.reasonCodes.includes("ESTIMATED_SHARE_ABOVE_HEADLINE")));
const largeDeclaredStructural = analytics.buildGlobalPersonalReferenceCost({ authority: "EXPLICIT_ENRICHMENT_AUTHORITY", personalAttributionCoverage: 1, supportMonths: 6, contributions: [contribution("observed", 60, "OBSERVED", "OBSERVED", ["a"]), contribution("declared", 40, "DECLARED_EXACT", "SUPPLEMENT_UNOBSERVED", ["b"], { structurallyApplicable: true })] });
check(() => assert.equal(largeDeclaredStructural.status, "HEADLINE_READY"));
rejects(() => analytics.buildGlobalPersonalReferenceCost({ authority: "EXPLICIT_ENRICHMENT_AUTHORITY", personalAttributionCoverage: 1, supportMonths: 6, contributions: [contribution("negative", -1, "OBSERVED", "OBSERVED", ["a"])] }), /P11_NEGATIVE_PERSONAL_REFERENCE_COST/);

// Dependency closure and hashing retain the official P01/B-F ownership without cycles.
const declaration = analytics.createGlobalM9DependencyDeclaration([personA, personB]);
check(() => assert.equal(declaration.resourceId, "global-v2:m9-persona"));
check(() => assert.equal(declaration.personScope.kind, "COMPARABLE_PERSONS"));
check(() => assert.equal(declaration.factDependencies.find(({ id }) => id === "fct_economic_component").scopeRelation, "person-attribution-proved-only"));
check(() => assert.ok(declaration.upstreamAnalytics.some(({ id }) => id === "global-v2:m3-transformations")));
check(() => assert.ok(declaration.upstreamAnalytics.every(({ id }) => id !== "global-v2:m9-persona")));
check(() => assert.doesNotThrow(() => core.assertGlobalDependencyClosure(declaration, {
  factDependencyIds: declaration.factDependencies.map(({ id }) => id),
  entityDependencyIds: declaration.entityDependencies.map(({ id }) => id),
  upstreamAnalyticsIds: declaration.upstreamAnalytics.map(({ id }) => id),
  otherModuleDependencyIds: declaration.otherModuleDependencies.map(({ id }) => id),
  policyIds: ["global-persona-natural-windows", "global-persona-support", "global-persona-comparable-coverage", "global-materiality-persona", "comparison", "support", "coverage", "exceptional", "ranking", "hysteresis", "observedCost", "enrichedReference"],
})));
const hash = analytics.computeGlobalPersonaInputHash({ observations: paired([30, 30, 30], [10, 10, 10]), policy: analytics.globalPersonaPolicies });
const changedHash = analytics.computeGlobalPersonaInputHash({ observations: paired([31, 30, 30], [10, 10, 10]), policy: analytics.globalPersonaPolicies });
check(() => assert.notEqual(hash, changedHash));
check(() => assert.equal(analytics.GLOBAL_M9_METHOD_VERSION, "global_persona@v1"));
check(() => assert.equal(analytics.globalPersonaPolicies.hysteresis, "global-persona-hysteresis@v1"));

console.log(`P11 persona profiles: ${checks}/${checks} PASS`);
console.log("P11_PERSON_METRIC=PASS");
console.log("P11_PERSONA_DIFFERENCE=PASS");
console.log("P11_SELECTION=PASS");
console.log("P11_PERSONAL_COSTS=PASS");
console.log("P11_AG022_FAIL_CLOSED=PASS");
