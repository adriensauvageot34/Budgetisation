import { parseGlobalMaterialityCandidate } from "../../core/global-v2";
import type { YearMonth } from "../../core/time";
import { adaptGlobalActual, type OfficialMonthlyEconomicInput } from "./economic-function";
import { globalMaterialityPolicies } from "./materiality";
import { buildGlobalTemporalAnalysis } from "./temporal-analysis";
import { normalizeGlobalTemporalPoints } from "./temporal-descriptive";

/** Official monthly Actual only; neither History ReadModels nor certificates are inputs. */
export function buildGlobalM1Temporal(input: {
  readonly certifiedThroughMonth: YearMonth;
  readonly months: readonly OfficialMonthlyEconomicInput[];
}) {
  const months = input.months.filter((m) => m.month <= input.certifiedThroughMonth);
  const points = normalizeGlobalTemporalPoints({
    certifiedThroughMonth: input.certifiedThroughMonth,
    points: months.map((m) => {
      const authority = adaptGlobalActual(m.actual);
      const value = authority.value;
      return {
        month: m.month, corpus: "CERTIFIED_HISTORY" as const,
        status: value.status,
        ...("value" in value ? { value: value.value } : {}),
        eligible: m.isComparable && !m.isMethodExcluded,
        complete: m.isComplete,
        dependencyRefs: [...m.dependencyRefs, `actual-method:${m.actual.methodVersion}`, `actual-input:${authority.inputHash}`],
      };
    }),
  });
  const eligible = points.filter((p) => p.eligible && p.complete).slice(-12);
  const known = eligible.filter((p) => p.status === "KNOWN");
  // This is the coverage of certified monthly financial sources, not the
  // percentage of euros or person attribution. Missing producer coverage stays unknown.
  const complete = eligible.filter((p) => months.some((m) => m.month === p.month && m.actual.coverage?.level === "complete"));
  const hasDenominator = eligible.length > 0;
  const ratio = hasDenominator ? complete.length / eligible.length : undefined;
  const evidenceRefs = [...new Set(points.flatMap((p) => p.dependencyRefs))].sort();
  const candidate = parseGlobalMaterialityCandidate({
    candidateId: "m1:temporal", phenomenonId: "household:actual", metricRef: "economic_consumption_net_attributable",
    effect: { absolute: "0" }, knowledgeState: known.length > 0 ? "KNOWN" : "UNKNOWN",
    support: {
      naturalGrain: "MONTH", eligibleUnits: eligible.length, observedUnits: eligible.length,
      includedUnits: known.length, excludedObservedUnits: eligible.length - known.length,
      minimumRequired: 6, supportStatus: known.length >= 12 ? "STRONG" : known.length >= 6 ? "SUFFICIENT" : "INSUFFICIENT",
      policyRef: "global-temporal-descriptive@v1",
    },
    coverage: {
      dimensions: [{ dimension: "FINANCIAL_SOURCE", status: !hasDenominator || complete.length === 0 ? "UNKNOWN" : complete.length === eligible.length ? "KNOWN" : "PARTIAL",
        ...(hasDenominator && complete.length > 0 ? { numerator: complete.length, denominator: eligible.length, ratio } : {}),
        unit: "certified-month", basis: "official-actual-coverage-complete", evidenceRefs, policyRef: "global-temporal-financial-coverage@v1" }],
      requiredDimensions: ["FINANCIAL_SOURCE"],
      ...(hasDenominator && complete.length > 0 ? { effective: ratio } : {}),
      aggregation: "MIN_REQUIRED_DIMENSIONS",
    },
    evidenceRefs, entityRefs: [], methodVersion: "global_economic_temporal@v1",
    materialityPolicy: globalMaterialityPolicies.HOUSEHOLD_TOTAL.ref,
  });
  const { candidateId: _id, effect: _effect, ...evidence } = candidate;
  const result = buildGlobalTemporalAnalysis({ certifiedThroughMonth: input.certifiedThroughMonth, points, evidence, policyId: "HOUSEHOLD_TOTAL" });
  return { ...result, stability: result.dispersion };
}
