import "server-only";

import { buildGlobalActivityCostProfile } from "@/analytics/global-v2";
import type { GlobalM2MonthlyComponent } from "@/analytics/global-v2";
import { projectPurchaseAwareGroceryCausalCosts } from "@/analytics/global-v2/purchase-aware-grocery-cost";
import type { ActivityOccurrenceCostFact, ActivityOccurrenceFact } from "@/analytics/facts";
import { addMonths, parseLocalDate, type YearMonth } from "@/core/time";
import type { CanonicalMinimalPlanningBundle, CanonicalRepository } from "@/server/canonical/repository";
import type { CanonicalRecord } from "@/server/canonical/record";
import { resolveGlobalBackgroundRhythmsProduction, projectGlobalFoodEconomicComponents } from "./global-v2-background-rhythms-production";
import { resolveGlobalGroceryCandidateAdapter } from "./global-v2-candidate-adapters";

/** Explicit C4 pilot boundary. The DEFAULT Global orchestrator never calls this function. */
export async function resolveGlobalFoodGroceryPurchaseAwarePilot(input: {
  readonly repository: CanonicalRepository;
  readonly months: readonly YearMonth[];
  readonly minimalBundle: CanonicalMinimalPlanningBundle;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly activityCosts: readonly ActivityOccurrenceCostFact[];
  readonly m2MonthlyComponents: readonly GlobalM2MonthlyComponent[];
  readonly subcategoryRows: readonly CanonicalRecord[];
}) {
  if (input.months.length !== 12) throw new TypeError("FOOD_PILOT_PERIOD_MONTH_COUNT");
  const first = input.months[0]!;
  const last = input.months.at(-1)!;
  const canonical = await input.repository.loadPurchaseAwareCanonical({
    start: parseLocalDate(`${first}-01`), endExclusive: parseLocalDate(`${addMonths(last, 1)}-01`),
  }, "PURCHASE_AWARE_PILOT");
  const economicComponents = projectGlobalFoodEconomicComponents({ canonical, bundle: input.minimalBundle,
    subcategoryRows: input.subcategoryRows });
  const correctedCosts = projectPurchaseAwareGroceryCausalCosts({
    costs: input.activityCosts,
    purchaseFacts: canonical.facts.filter((fact) => fact.fact === "fct_purchase_aware_economic_component"),
  });
  const activityCostProfiles = [...new Set(input.occurrences.map(({ activityId }) => String(activityId)))].sort()
    .map((activityId) => buildGlobalActivityCostProfile({ activityId, occurrences: input.occurrences, activityCosts: correctedCosts }));
  const grocery = resolveGlobalGroceryCandidateAdapter({
    months: input.months, occurrences: input.occurrences, activityCostProfiles,
    m2MonthlyComponents: input.m2MonthlyComponents, subcategoryRows: input.subcategoryRows,
    foodEconomicComponents: economicComponents,
  });
  const background = await resolveGlobalBackgroundRhythmsProduction({
    client: input.repository.client, repository: input.repository, months: input.months, grocery,
    subcategoryRows: input.subcategoryRows, minimalBundle: input.minimalBundle,
    occurrences: input.occurrences, activityCosts: correctedCosts,
    foodEconomicComponents: economicComponents,
  });
  return { canonical, economicComponents, correctedCosts, grocery, ...background };
}
