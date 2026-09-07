import { canonicalSerializeGlobal, parseGlobalSupport, parseGlobalCoverageSet } from "../../core/global-v2";
import type { buildGlobalDailyRelationships } from "./relationships";
import { relationshipCatalogVersion } from "./relationship-catalog";
import { relationshipComparatorPolicies } from "./relationship-comparators";
import type { relationshipAccessPolicy } from "./relationship-access";

type Result = ReturnType<typeof buildGlobalDailyRelationships>;
type Classification = {
  readonly relationshipId: string;
  readonly state: Parameters<typeof relationshipAccessPolicy>[0]["temporalState"];
  readonly access: ReturnType<typeof relationshipAccessPolicy>;
};

/** Master M5 P4284: an Analytics projection, not a Query or a ReadModel.
 * Missing comparisons remain in the execution plan, not as invented effects.
 * Diagnostic p/q stay separate from the downstream AI-eligible evidence.
 */
export function buildRelationshipInsights(input: {
  readonly personId: string;
  readonly current: Result;
  readonly recent: Result;
  readonly classifications: readonly Classification[];
}) {
  const insights = input.classifications.map((classification) => {
    const result = classification.state === "RECENT_ONLY" ? input.recent : input.current;
    const day = result.results.find((entry) => entry.relationshipId === classification.relationshipId);
    const week = result.weeklyResults.find((entry) => entry.definition.id === classification.relationshipId);
    const common = {
      relationshipId: classification.relationshipId,
      relationshipDefinitionVersion: relationshipCatalogVersion,
      scope: "PERSON" as const, subjectRef: input.personId,
      stability: classification.state, access: classification.access,
      causalityMode: "ASSOCIATION_ONLY" as const,
      methodVersion: "global_relationship_insight@v1",
      inputHash: result.inputHash,
      analyticsRevision: result.results[0].scope.analyticsRevision,
      policyVersions: result.policies,
    };
    if (day && "effect" in day && day.effect && "statistic" in day && day.statistic && day.materiality && day.uncertainty) {
      return {
        ...common, grain: "DAY" as const,
        exposure: day.definition.exposure,
        comparator: relationshipComparatorPolicies[day.definition.exposure].comparator,
        outcome: day.definition.outcome,
        sample: day.sample,
        effect: { kind: day.definition.outcomeKind === "BINARY" ? "PROBABILITY_DIFFERENCE" : "PAIRED_MEDIAN_DIFFERENCE", ...day.effect, interval95: day.uncertainty.interval95 },
        evidence: { rawPValue: day.statistic.pValue, adjustedQValue: day.qValue, evidenceStatus: day.evidenceStatus },
        materiality: day.materiality, matchingSummary: day.matching,
        support: parseGlobalSupport(day.support),
        coverage: parseGlobalCoverageSet({ dimensions: [{ dimension: "PERSON_DAY", status: day.coverage.status, numerator: day.coverage.resolvedUnits, denominator: day.coverage.eligibleUnits, ...(day.coverage.ratio === undefined ? {} : { ratio: day.coverage.ratio }), unit: "PERSON_DAY", basis: "OUTCOME_RESOLVED_OVER_SCOPED_PERSON_DAYS", evidenceRefs: result.dependencyClosure.map((entry) => entry.ref), policyRef: "relationship-outcome-coverage@v1" }], requiredDimensions: ["PERSON_DAY"], ...(day.coverage.ratio === undefined ? {} : { effective: day.coverage.ratio }), aggregation: "MIN_REQUIRED_DIMENSIONS" }),
        evidenceRefs: result.dependencyClosure.map((entry) => entry.ref),
      };
    }
    if (week && "effect" in week && week.effect !== undefined && "pValue" in week && week.pValue !== undefined && week.qValue !== undefined && "materiality" in week) {
      return {
        ...common, grain: "WEEK" as const,
        exposure: week.definition.exposure, comparator: "PAIRED_RESIDUAL_RANKS",
        outcome: week.definition.outcome,
        sample: { exposed: week.eligibleWeeks, comparator: week.eligibleWeeks },
        effect: { kind: "SPEARMAN", absoluteEffect: week.effect },
        evidence: { rawPValue: week.pValue, adjustedQValue: week.qValue, evidenceStatus: week.evidenceStatus },
        materiality: week.materiality,
        matchingSummary: { method: "COMPLETE_WEEK_SAME_PERSON_REGIME" },
        support: parseGlobalSupport({ naturalGrain: "WEEK", eligibleUnits: week.eligibleWeeks, observedUnits: week.eligibleWeeks, includedUnits: week.eligibleWeeks, excludedObservedUnits: 0, minimumRequired: week.definition.minimumWeeks, supportStatus: week.eligibleWeeks >= week.definition.minimumWeeks ? "SUFFICIENT" : "INSUFFICIENT", policyRef: "relationship-complete-observed-week-support@v1" }),
        coverage: parseGlobalCoverageSet({ dimensions: [{ dimension: "PERSON_DAY", status: "UNKNOWN", unit: "WEEK", basis: "COMPLETE_OBSERVED_WEEKS_ONLY_CALENDAR_DENOMINATOR_NOT_PROVEN", evidenceRefs: result.weeklyDependencies.map((entry) => entry.ref), policyRef: "relationship-week-observation-coverage@v1" }], requiredDimensions: ["PERSON_DAY"], aggregation: "MIN_REQUIRED_DIMENSIONS" }),
        evidenceRefs: result.weeklyDependencies.map((entry) => entry.ref),
      };
    }
    return null;
  }).filter((entry) => entry !== null);
  canonicalSerializeGlobal(insights);
  return insights;
}

export type GlobalRelationshipInsight = ReturnType<typeof buildRelationshipInsights>[number];
