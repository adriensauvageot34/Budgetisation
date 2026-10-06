import "server-only";
import type { MonthForecast } from "../month-forecast";
import type { MonthInputs } from "../month-scenario";
import type { MonthPredictionEvidence } from "../remaining-month-forecast";
import type { PlannedExpense } from "../planned-expenses";
import type { BootstrapAnalysisPeriod } from "@/server/bootstrap/types";
import type { GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2/background-rhythms";
import type { GlobalPersonaProductObservation } from "@/server/analytics/global-v2-persona-signals";
import type { GlobalM7PersonalMobilityAuthority } from "@/analytics/global-v2/personal-mobility";
import type { MobilityLegFact, ActivityOccurrenceFact, ActivityCausalFinancialLink } from "@/analytics/facts";
import type { PurchaseAwareEconomicFact } from "@/analytics/facts/purchase-aware";
import type { MobilityContextResolution } from "@/analytics/global-v2/mobility-context";

/** Owner outputs only. No Plan, revision, controls or semantic state accepted here. */
export type PlanningBaselineSources = Readonly<{
  householdId: string; targetMonth: string; knowledgeCutoff: string; timezone: string;
  forecast: MonthForecast; monthInputs: MonthInputs;
  periods: readonly BootstrapAnalysisPeriod[]; evidence: MonthPredictionEvidence;
  food: GlobalBackgroundRhythmsReadModel["food"];
  purchaseFacts: readonly PurchaseAwareEconomicFact[];
  habitAssertions: readonly PersonHabitAssertion[];
  productObservations: readonly GlobalPersonaProductObservation[];
  needSubjects: Readonly<Record<string, Readonly<{ needKey: string; personId: string | null }>>>;
  personalMobility: GlobalM7PersonalMobilityAuthority;
  mobilityLegs: readonly MobilityLegFact[];
  mobilityContexts: readonly MobilityContextResolution[];
  plannedExpenses: readonly PlannedExpense[];
  /** Canonical semantic events and confirmed causal links, never payment counts. */
  simpleOccurrences?: Readonly<{ occurrences: readonly ActivityOccurrenceFact[]; links: readonly ActivityCausalFinancialLink[] }>;
}>;

/** Mirrors the existing Canonical assertion table, not decision.assumptions. */
export type PersonHabitAssertion = Readonly<{ assertionId: string; personId: string; habitKey: string;
  monthlyVisitEstimate: string; typicalVisitPrice: string; priceBasis: "INDICATIVE_PRICE_NOT_PAYMENT";
  authority: "USER_VALIDATED"; validatedAt: string }>;
