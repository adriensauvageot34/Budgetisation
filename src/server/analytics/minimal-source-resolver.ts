import "server-only";

import {
  resolveHistoricalMinimalState,
  type HistoricalMinimalComponentState,
  type MinimalMonthComponent,
} from "@/analytics/baseline";
import type { YearMonth } from "@/core/time";
import type { CanonicalMinimalPlanningBundle } from "@/server/canonical/repository";

export type MinimalSourceHealthStatus = "AVAILABLE" | "PARTIAL" | "MISSING_SOURCE";

export type MinimalSourceHealth = {
  readonly neutralVariable: MinimalSourceHealthStatus;
  readonly obligationsAndProvisions: MinimalSourceHealthStatus;
  readonly unresolvedNeutralSourceCount: number;
  readonly unresolvedObligationSourceCount: number;
};

export type MinimalPlanningResolution = {
  readonly availability: "known" | "unknown";
  readonly neutralVariableComponents: readonly MinimalMonthComponent[];
  readonly mandatoryMonthlyObligationsAndProvisions: readonly MinimalMonthComponent[];
  readonly health: MinimalSourceHealth;
};

const missingResolution = (): MinimalPlanningResolution => ({
  availability: "unknown",
  neutralVariableComponents: [],
  mandatoryMonthlyObligationsAndProvisions: [],
  health: {
    neutralVariable: "MISSING_SOURCE",
    obligationsAndProvisions: "MISSING_SOURCE",
    unresolvedNeutralSourceCount: 0,
    unresolvedObligationSourceCount: 0,
  },
});

function bucketHealth(
  states: readonly HistoricalMinimalComponentState[],
  bucket: "NEUTRAL_VARIABLE" | "OBLIGATION_OR_PROVISION",
): { readonly status: MinimalSourceHealthStatus; readonly unresolved: number } {
  const selected = states.filter((state) => state.bucket === bucket);
  const unknown = selected.filter((state) => state.status === "UNKNOWN").length;
  const known = selected.length - unknown;
  return {
    status: unknown === 0 ? "AVAILABLE" : known === 0 ? "MISSING_SOURCE" : "PARTIAL",
    unresolved: unknown,
  };
}

/**
 * Canonical Minimal fails closed until the approved bitemporal authority is
 * supplied. Current `actif_prevision`, missing-month zero fill and the legacy
 * `minimal_month_cost@v1` certificate are intentionally not inputs here.
 */
export function resolveMinimalPlanningSource(input: {
  readonly bundle: CanonicalMinimalPlanningBundle;
  readonly targetMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
}): MinimalPlanningResolution {
  const authority = input.bundle.historicalMinimalAuthority;
  if (authority === undefined) return missingResolution();

  const state = resolveHistoricalMinimalState({ targetMonth: input.targetMonth, authority });
  const neutralVariableComponents = state.componentStates.flatMap((componentState) =>
    componentState.status === "KNOWN" && componentState.bucket === "NEUTRAL_VARIABLE"
      ? [componentState.component]
      : []);
  const mandatoryMonthlyObligationsAndProvisions = state.componentStates.flatMap((componentState) =>
    componentState.status === "KNOWN" && componentState.bucket === "OBLIGATION_OR_PROVISION"
      ? [componentState.component]
      : []);
  const neutral = bucketHealth(state.componentStates, "NEUTRAL_VARIABLE");
  const obligations = bucketHealth(state.componentStates, "OBLIGATION_OR_PROVISION");
  return {
    availability: state.status === "KNOWN" ? "known" : "unknown",
    neutralVariableComponents,
    mandatoryMonthlyObligationsAndProvisions,
    health: {
      neutralVariable: neutral.status,
      obligationsAndProvisions: obligations.status,
      unresolvedNeutralSourceCount: neutral.unresolved,
      unresolvedObligationSourceCount: obligations.unresolved,
    },
  };
}
