import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalCoverageSet, parseGlobalMaterialityCandidate, type GlobalCoverageSet } from "../../core/global-v2";
import { parseInstant, parseLocalDate, instantToLocalDate, parseHouseholdTimeZone } from "../../core/time";
import { GlobalMaterialityEngine, globalMaterialityPolicies } from "./materiality";
import { dailyRelationshipCatalog, relationshipCatalogVersion, deferredRelationshipExaminations } from "./relationship-catalog";
import { matchRelationshipDays, normalizeRelationshipDays, relationshipComparatorPolicies, type RelationshipDayUnit } from "./relationship-comparators";
import { relationshipMcNemar, relationshipMedian, relationshipPairedBootstrap, relationshipSignPermutation, relationshipStatisticsPolicy } from "./relationship-statistics";
import { closeRelationshipFdrUniverse } from "./relationship-evidence";
import { prepareWeeklyRelationship, normalizeRelationshipWeeklyMaterialityProof, weeklyRelationshipCatalog, relationshipWeeklyPolicy, type RelationshipWeek, type RelationshipWeeklyMaterialityProof } from "./relationship-weekly";

export type RelationshipDailyOutcome = {
  readonly dayId: string;
  readonly outcome: string;
  readonly value: number;
  readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT" | "NOT_APPLICABLE";
  readonly authority: "ACTIVITY_OCCURRENCE" | "PERSON_DAILY_ECONOMIC_CONSUMPTION";
  readonly coverage: GlobalCoverageSet;
  readonly evidenceRefs: readonly string[];
  readonly dependencyRefs: readonly string[];
};

export const relationshipPipeline = Object.freeze(["ELIGIBILITY_COVERAGE", "MATCHING", "POST_MATCH_SUPPORT", "EFFECT", "STATISTICS", "MATERIALITY", "FDR", "TEMPORAL_ROBUSTNESS", "CLASSIFICATION"]);
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const seedOf = (value: unknown) => parseInt(digest(value).slice(0, 8), 16);

export function buildGlobalDailyRelationships(input: {
  readonly householdId: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly householdTimeZone: string;
  readonly asOf: string;
  readonly certifiedThrough: string;
  readonly analyticsRevision: number;
  readonly sourceRevision: number;
  readonly days: readonly RelationshipDayUnit[];
  readonly outcomes: readonly RelationshipDailyOutcome[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
  readonly windowRole?: "CURRENT" | "RECENT_6" | "PREVIOUS_6";
  readonly definitionMonths?: Readonly<Record<string, readonly string[]>>;
  readonly weeklyInputs?: readonly {
    readonly definitionId: string;
    readonly weeks: readonly RelationshipWeek[];
    readonly materialityProof?: RelationshipWeeklyMaterialityProof;
    readonly windowMaterialityProofs?: {
      readonly RECENT_6?: RelationshipWeeklyMaterialityProof;
      readonly PREVIOUS_6?: RelationshipWeeklyMaterialityProof;
    };
  }[];
}) {
  canonicalSerializeGlobal(input);
  const through = parseLocalDate(input.certifiedThrough);
  if (through > instantToLocalDate(parseInstant(input.asOf), parseHouseholdTimeZone(input.householdTimeZone))) throw new TypeError("M5_LOOKAHEAD_BOUNDARY");
  if (![input.analyticsRevision, input.sourceRevision].every((n) => Number.isSafeInteger(n) && n >= 0)) throw new TypeError("M5_REVISION_REQUIRED");
  const days = normalizeRelationshipDays(input.days).filter((day) => day.date <= through && day.householdId === input.householdId && day.personId === input.personId && day.regimeId === input.regimeId);
  const dayIds = new Set(days.map((day) => day.id));
  const definitionMonths = Object.fromEntries(Object.entries(input.definitionMonths ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, months]) => {
    if (!dailyRelationshipCatalog.some((entry) => entry.id === id) || months.some((month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new TypeError("M5_INVALID_DEFINITION_WINDOW");
    return [id, [...new Set(months)].sort()];
  }));
  const relevantOutcomes = new Set(dailyRelationshipCatalog.map((definition) => definition.outcome));
  const outcomes = new Map<string, RelationshipDailyOutcome>();
  const consumed = new Set<string>();
  for (const raw of input.outcomes) {
    if (!dayIds.has(raw.dayId) || !relevantOutcomes.has(raw.outcome)) continue;
    if (!Number.isFinite(raw.value) || !["KNOWN", "PARTIAL", "UNKNOWN", "CONFLICT", "NOT_APPLICABLE"].includes(raw.status)) throw new TypeError("M5_INVALID_OUTCOME");
    const value = { ...raw, coverage: parseGlobalCoverageSet(raw.coverage), evidenceRefs: [...new Set(raw.evidenceRefs)].sort(), dependencyRefs: [...new Set(raw.dependencyRefs)].sort() };
    if (!value.evidenceRefs.length || !value.dependencyRefs.length) throw new TypeError("M5_OUTCOME_PROVENANCE_REQUIRED");
    for (const ref of value.dependencyRefs) {
      if (!input.dependencyDigests[ref]) throw new TypeError(`M5_DEPENDENCY_CLOSURE_MISSING:${ref}`);
      consumed.add(ref);
    }
    const key = `${value.dayId}:${value.outcome}`;
    const previous = outcomes.get(key);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(value)) throw new TypeError("M5_CONTRADICTORY_OUTCOME");
    outcomes.set(key, value);
  }
  // Day/context/calendar/regime authorities are consumed even for rejected tests.
  for (const day of days) for (const ref of [...day.evidenceRefs, ...day.contextEvidenceRefs, ...day.calendarEvidenceRefs, day.regimeId, ...(day.seasonalStratum === undefined ? [] : [day.seasonalStratum.authorityRef])]) {
    if (!input.dependencyDigests[ref]) throw new TypeError(`M5_DEPENDENCY_CLOSURE_MISSING:${ref}`);
    consumed.add(ref);
  }
  const scope = { householdId: input.householdId, personId: input.personId, regimeId: input.regimeId, analyticsRevision: input.analyticsRevision, sourceRevision: input.sourceRevision, asOf: input.asOf, certifiedThrough: through, ...(input.windowRole === undefined ? {} : { windowRole: input.windowRole }) };
  const policies = { catalog: relationshipCatalogVersion, weeklyCatalog: weeklyRelationshipCatalog, weeklyStatistics: relationshipWeeklyPolicy, comparators: relationshipComparatorPolicies, statistics: relationshipStatisticsPolicy, fdr: "relationship-bh-full-person-regime-revision@v1", temporal: "relationship-lomo-80-percent-no-material-inversion@v1", materiality: [globalMaterialityPolicies.RELATIONSHIP_PROBABILITY, globalMaterialityPolicies.COST_PER_OCCURRENCE, globalMaterialityPolicies.ACTIVITY_FREQUENCY] };
  const dependencyClosure = [...consumed].sort().map((ref) => ({ ref, digest: input.dependencyDigests[ref] }));
  const inputHash = digest({ scope, policies, days, outcomes: [...outcomes.values()].sort((a, b) => `${a.dayId}:${a.outcome}`.localeCompare(`${b.dayId}:${b.outcome}`)), dependencyClosure, definitionMonths });
  const engine = new GlobalMaterialityEngine();
  const scopedDays = days;
  const prepared = dailyRelationshipCatalog.map((definition) => {
    const selectedMonths = definitionMonths[definition.id];
    const days = selectedMonths === undefined ? scopedDays : scopedDays.filter((day) => selectedMonths.includes(day.date.slice(0, 7)));
    const eligible = days.filter((day) => {
      const outcome = outcomes.get(`${day.id}:${definition.outcome}`);
      if (!outcome || outcome.status !== "KNOWN" || outcome.authority !== definition.authority) return false;
      if (definition.outcomeKind === "BINARY" && outcome.value !== 0 && outcome.value !== 1) throw new TypeError("M5_BINARY_OUTCOME_REQUIRED");
      return outcome.coverage.effective === 1 && outcome.coverage.requiredDimensions.length > 0 && outcome.coverage.requiredDimensions.every((dimension) => outcome.coverage.dimensions.find((measure) => measure.dimension === dimension)?.status === "KNOWN");
    });
    const matching = matchRelationshipDays({ exposure: definition.exposure, householdId: input.householdId, personId: input.personId, regimeId: input.regimeId, through, days: eligible });
    const pairs = matching.pairs.map((pair) => ({ ...pair, a: outcomes.get(`${pair.exposed.id}:${definition.outcome}`)!.value, b: outcomes.get(`${pair.control.id}:${definition.outcome}`)!.value }));
    const sample = { exposed: matching.exposedCount, comparator: matching.controlCount, matchedPairs: pairs.length };
    const support = { naturalGrain: "PERSON_DAY" as const, eligibleUnits: days.length, observedUnits: eligible.length, includedUnits: pairs.length * 2, excludedObservedUnits: eligible.length - pairs.length * 2, minimumRequired: definition.minimumPairs, matchedSetCount: pairs.length, supportStatus: pairs.length >= definition.minimumPairs ? "SUFFICIENT" as const : "INSUFFICIENT" as const, policyRef: "relationship-day-post-match-15@v1" };
    const base = { relationshipId: definition.id, definition, causalityMode: "ASSOCIATION_ONLY" as const, scope, sample, support, matching, coverage: { eligibleUnits: days.length, resolvedUnits: eligible.length, ...(days.length ? { ratio: eligible.length / days.length } : {}), status: !days.length ? "UNKNOWN" : eligible.length === days.length ? "KNOWN" : "PARTIAL" }, excludedOutcomeDayIds: days.filter((day) => !eligible.includes(day)).map((day) => day.id) };
    const authorityReasons = [
      ...(definition.exposure !== "WEEKEND" && !days.some((day) => day.context !== "UNKNOWN" && day.contextEvidenceRefs.length > 0) ? ["AUTHORITY_GATED_DAY_CONTEXT"] : []),
      ...(!days.some((day) => day.calendarClass !== "UNKNOWN" && day.calendarEvidenceRefs.length > 0) ? ["AUTHORITY_GATED_CALENDAR"] : []),
      ...(!days.some((day) => outcomes.has(`${day.id}:${definition.outcome}`)) ? ["DATA_GATED_OUTCOME_PROVIDER"] : []),
    ];
    if (pairs.length < definition.minimumPairs) return { ...base, test: null, reasonCodes: [...authorityReasons, "INSUFFICIENT_POST_MATCH_SUPPORT"], pairs };
    const describe = (values: typeof pairs) => {
      const a = values.map((pair) => pair.a), b = values.map((pair) => pair.b);
      const difference = definition.outcomeKind === "BINARY" ? mean(a.map((value, i) => value - b[i])) : relationshipMedian(a.map((value, i) => value - b[i]));
      const baseline = definition.outcomeKind === "BINARY" ? mean(b) : relationshipMedian(b);
      return { absoluteEffect: difference, exposedLevel: definition.outcomeKind === "BINARY" ? mean(a) : relationshipMedian(a), comparatorLevel: baseline, ...(baseline !== 0 ? { relativeEffect: difference / Math.abs(baseline), ...(definition.outcomeKind === "BINARY" ? { riskRatio: mean(a) / baseline } : {}) } : {}) };
    };
    const effect = describe(pairs);
    const policyId = definition.outcomeKind === "BINARY" ? "RELATIONSHIP_PROBABILITY" as const : "COST_PER_OCCURRENCE" as const;
    const materialityOf = (values: typeof pairs) => {
      const effect = describe(values);
      const resolvedRatio = eligible.length / days.length;
      const coverageEvidence = [...new Set(values.flatMap((pair) => [
        ...pair.exposed.evidenceRefs, ...pair.control.evidenceRefs,
      ]))].sort();
      const candidate = parseGlobalMaterialityCandidate({
        candidateId: definition.id,
        phenomenonId: definition.id,
        metricRef: definition.outcome,
        effect: {
          absolute: String(effect.absoluteEffect),
          ...(effect.relativeEffect === undefined ? {} : { relative: String(effect.relativeEffect) }),
        },
        knowledgeState: base.coverage.status === "KNOWN" ? "KNOWN" : "PARTIAL",
        support: {
          ...support,
          includedUnits: values.length * 2,
          excludedObservedUnits: eligible.length - values.length * 2,
          supportStatus: values.length >= definition.minimumPairs ? "SUFFICIENT" : "INSUFFICIENT",
        },
        coverage: {
          dimensions: [{
            dimension: "PERSON_DAY",
            status: base.coverage.status,
            numerator: eligible.length,
            denominator: days.length,
            ratio: resolvedRatio,
            unit: "PERSON_DAY",
            basis: "OUTCOME_RESOLVED_OVER_SCOPED_PERSON_DAYS",
            evidenceRefs: coverageEvidence,
            policyRef: "relationship-outcome-coverage@v1",
          }],
          requiredDimensions: ["PERSON_DAY"],
          effective: resolvedRatio,
          aggregation: "MIN_REQUIRED_DIMENSIONS",
        },
        evidenceRefs: dependencyClosure.map((dependency) => dependency.ref),
        entityRefs: [],
        methodVersion: "global_relationship_daily@v1",
        materialityPolicy: globalMaterialityPolicies[policyId].ref,
      });
      return engine.evaluate({ policyId, candidate });
    };
    const seed = seedOf({ scope, relationshipId: definition.id, statistics: relationshipStatisticsPolicy });
    const differences = pairs.map((pair) => pair.a - pair.b);
    const statistic = definition.outcomeKind === "BINARY"
      ? { method: "MCNEMAR_EXACT", pValue: relationshipMcNemar(pairs.filter((pair) => pair.a === 1 && pair.b === 0).length, pairs.filter((pair) => pair.a === 0 && pair.b === 1).length) }
      : { method: "SIGN_PERMUTATION", ...relationshipSignPermutation(differences, seed) };
    const uncertainty = relationshipPairedBootstrap(differences, seed, definition.outcomeKind === "BINARY" ? "MEAN" : "MEDIAN");
    const materiality = materialityOf(pairs);
    // Calculated after the full-universe FDR pass below, never used for preselection.
    const temporal = () => {
      const months = [...new Set(pairs.flatMap((pair) => [pair.exposed.date.slice(0, 7), pair.control.date.slice(0, 7)]))].sort();
      const trials = months.map((month) => {
        // Rebuild the matching after withdrawal; do not merely retain the old
        // pairs, because an unused admissible control can now become nearest.
        const rematched = matchRelationshipDays({ exposure: definition.exposure, householdId: input.householdId, personId: input.personId, regimeId: input.regimeId, through, days: eligible.filter((day) => !day.date.startsWith(month)) });
        const remaining = rematched.pairs.map((pair) => ({ ...pair, a: outcomes.get(`${pair.exposed.id}:${definition.outcome}`)!.value, b: outcomes.get(`${pair.control.id}:${definition.outcome}`)!.value }));
        if (remaining.length < definition.minimumPairs) return { month, remainingPairs: remaining.length, reason: "INSUFFICIENT_REMAINING_SUPPORT", sameDirection: false, materialOpposition: false };
        const reEffect = describe(remaining), reMateriality = materialityOf(remaining);
        const opposite = Math.sign(reEffect.absoluteEffect) !== Math.sign(effect.absoluteEffect) && reEffect.absoluteEffect !== 0;
        return { month, remainingPairs: remaining.length, effect: reEffect, sameDirection: Math.sign(reEffect.absoluteEffect) === Math.sign(effect.absoluteEffect), materialOpposition: opposite && reMateriality.status === "MATERIAL", reason: "RECALCULATED" };
      });
      const sameDirectionCount = trials.filter((trial) => trial.sameDirection).length;
      const sufficient = trials.length >= 2 && trials.every((trial) => trial.remainingPairs >= definition.minimumPairs);
      const dominantMonth = trials.some((trial) => "effect" in trial && trial.effect?.absoluteEffect === 0 && effect.absoluteEffect !== 0);
      return { trials, sameDirectionCount, trialCount: trials.length, sufficient, dominantMonth, robust: sufficient && !dominantMonth && sameDirectionCount / trials.length >= 0.8 && !trials.some((trial) => trial.materialOpposition) };
    };
    return { ...base, pairs, test: { effect, statistic, uncertainty, materiality, temporal }, reasonCodes: [] as string[] };
  });
  const weeklyIds = new Set<string>();
  for (const value of input.weeklyInputs ?? []) {
    if (weeklyIds.has(value.definitionId)) throw new TypeError("M5_DUPLICATE_WEEKLY_INPUT");
    if (!weeklyRelationshipCatalog.some((definition) => definition.id === value.definitionId)) throw new TypeError("M5_UNCATALOGUED_WEEKLY_RELATION");
    weeklyIds.add(value.definitionId);
    if (value.materialityProof) for (const candidate of [value.materialityProof.current, ...value.materialityProof.withdrawals.map((entry) => entry.candidate)]) for (const ref of candidate.evidenceRefs) {
      if (!input.dependencyDigests[ref]) throw new TypeError(`M5_DEPENDENCY_CLOSURE_MISSING:${ref}`);
    }
    for (const week of value.weeks.filter((week) => week.end <= through)) for (const ref of week.evidenceRefs) {
      if (!input.dependencyDigests[ref]) throw new TypeError(`M5_DEPENDENCY_CLOSURE_MISSING:${ref}`);
    }
  }
  const weeklyResults = weeklyRelationshipCatalog.map((definition) => {
    const supplied = input.weeklyInputs?.find((value) => value.definitionId === definition.id);
    if (!supplied) return { definition, status: "UNKNOWN" as const, reasonCode: "PROVIDER_NOT_SUPPLIED" };
    if (definition.provider !== "BC_CORE") throw new TypeError("M5_P08_PROVIDER_NOT_YET_CERTIFIED");
    return prepareWeeklyRelationship({ definitionId: definition.id, personId: input.personId, regimeId: input.regimeId, through, seed: seedOf({ scope, definition: definition.id }), weeks: supplied.weeks, ...(supplied.materialityProof === undefined ? {} : { materialityProof: supplied.materialityProof }) });
  });
  const excludedDefinitions = deferredRelationshipExaminations();
  const fdr = closeRelationshipFdrUniverse({
    scopeRevisionIdentity: digest({ scope, definitionMonths }),
    expectedDefinitionIds: [...dailyRelationshipCatalog.map((definition) => definition.id), ...weeklyRelationshipCatalog.map((definition) => definition.id), ...excludedDefinitions.map((definition) => definition.id)],
    tests: [
      ...excludedDefinitions.map(({ id, eligible, exclusionReason }) => ({ id, eligible, exclusionReason })),
      ...prepared.map((result) => result.test ? { id: result.relationshipId, eligible: true, pValue: result.test.statistic.pValue } : { id: result.relationshipId, eligible: false, exclusionReason: result.reasonCodes.join("|") }),
      ...weeklyResults.map((result) => "pValue" in result && result.pValue !== undefined ? { id: result.definition.id, eligible: true, pValue: result.pValue } : { id: result.definition.id, eligible: false, exclusionReason: "reasonCode" in result ? result.reasonCode! : "UNKNOWN_WEEKLY_TEST" }),
    ],
  });
  const corrected = fdr.tests;
  const weeklyQualified = weeklyResults.map((prepared) => {
    const result = "evaluateTemporal" in prepared ? (() => { const { evaluateTemporal, ...value } = prepared; return { ...value, temporal: evaluateTemporal() }; })() : prepared;
    const qValue = corrected.find((test) => test.id === result.definition.id)?.qValue;
    const reasonCodes = [
      ...(qValue === undefined ? ["WEEKLY_TEST_INELIGIBLE"] : qValue > .05 ? ["FDR_PUBLICATION_THRESHOLD_NOT_PASSED"] : []),
      ...(!("materiality" in result) || result.materiality.status !== "MATERIAL" ? ["WEEKLY_MATERIALITY_NOT_PASSED"] : []),
      ...(!("temporal" in result) || !result.temporal.robust ? ["WEEKLY_ROBUSTNESS_NOT_PASSED"] : []),
    ];
    return { ...result, ...(qValue === undefined ? {} : { qValue }), reasonCodes, evidenceStatus: reasonCodes.length === 0 ? "PUBLISHED" as const : qValue !== undefined && qValue > .05 && qValue <= .1 ? "SUGGESTIVE_INTERNAL" as const : "REJECTED" as const };
  });
  const results = prepared.map(({ pairs: _pairs, test, ...base }) => {
    if (!test) return { ...base, evidenceStatus: "REJECTED" as const };
    const qValue = corrected.find((result) => result.id === base.relationshipId)!.qValue;
    const temporal = test.temporal();
    const reasonCodes = [...(test.materiality.status !== "MATERIAL" ? ["MATERIALITY_NOT_PASSED"] : []), ...(!temporal.robust ? ["TEMPORAL_ROBUSTNESS_NOT_PASSED"] : []), ...(qValue > 0.05 ? ["FDR_PUBLICATION_THRESHOLD_NOT_PASSED"] : [])];
    return { ...base, effect: test.effect, uncertainty: test.uncertainty, statistic: test.statistic, qValue, materiality: test.materiality, temporal, evidenceStatus: reasonCodes.length === 0 ? "PUBLISHED" as const : qValue <= 0.1 && qValue > 0.05 ? "SUGGESTIVE_INTERNAL" as const : "REJECTED" as const, reasonCodes };
  });
  const weeklyEvidence = (input.weeklyInputs ?? []).map((entry) => ({ definitionId: entry.definitionId, ...(entry.materialityProof === undefined ? {} : { materialityProof: normalizeRelationshipWeeklyMaterialityProof(entry.materialityProof) }), weeks: entry.weeks.filter((week) => week.end <= through && week.personId === input.personId && week.regimeId === input.regimeId).map((week) => ({ ...week, evidenceRefs: [...new Set(week.evidenceRefs)].sort() })).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)) })).sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  const weeklyDependencies = [...new Set(weeklyEvidence.flatMap((entry) => [...entry.weeks.flatMap((week) => week.evidenceRefs), ...(entry.materialityProof ? [entry.materialityProof.current, ...entry.materialityProof.withdrawals.map((row) => row.candidate)].flatMap((candidate) => candidate.evidenceRefs) : [])]))].sort().map((ref) => ({ ref, digest: input.dependencyDigests[ref] }));
  const executionPlan = [
    ...results.map((entry) => ({ id: entry.relationshipId, status: entry.reasonCodes.some((reason) => reason.startsWith("AUTHORITY_GATED") || reason.startsWith("DATA_GATED")) ? "EXCLUDED_WITH_REASON" as const : "ACTIVE" as const, reasonCodes: entry.reasonCodes, grain: entry.definition.grain, exposure: entry.definition.exposure, outcome: entry.definition.outcome, owner: "P06" })),
    ...weeklyQualified.map((entry) => ({ id: entry.definition.id, status: entry.definition.provider === "P08_MOBILITY" ? "DEFERRED_P08_P10" as const : "pValue" in entry ? "ACTIVE" as const : "EXCLUDED_WITH_REASON" as const, reasonCodes: [...entry.reasonCodes, ...("reasonCode" in entry ? [entry.reasonCode] : [])], grain: "WEEK", exposure: entry.definition.exposure, outcome: entry.definition.outcome, owner: entry.definition.provider === "P08_MOBILITY" ? "P08" : "P06" })),
    ...excludedDefinitions.map((entry) => ({ id: entry.id, status: entry.status, reasonCodes: [entry.reason], grain: entry.grain, owner: entry.owner })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  return { methodVersion: "global_relationship_daily@v1", certificationStatus: "PARTIAL_DAILY_CORE" as const, publicationEligible: false as const, pipeline: relationshipPipeline, inputHash: digest({ daily: inputHash, weeklyEvidence, weeklyDependencies, excludedDefinitions }), dependencyClosure, weeklyDependencies, policies, fdr, results, weeklyResults: weeklyQualified, excludedDefinitions, executionPlan, limitations: ["ASSOCIATION_NOT_CAUSATION", "UNOBSERVED_CONFOUNDERS", "DAILY_CORE_ONLY", "PAIRED_BOOTSTRAP_NOT_BLOCK_BOOTSTRAP"], liveWrites: "NONE" };
}
