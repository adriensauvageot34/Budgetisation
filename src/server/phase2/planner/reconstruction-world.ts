import "server-only";
import { buildGlobalM7PersonalMobilityAuthority } from "@/analytics/global-v2/personal-mobility";
import type { PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import { planningBaselineDigest } from "./baseline";
import { sumReferenceComponents } from "../month-reference";
import { defaultMonthInputs } from "../month-scenario";

/** The historical workshop uses native compilation without inventing a published forecast. */
export function reconstructionWorld(householdId: string, targetMonth: string): PlanningWorldFacts {
  const asOfDate = `${targetMonth}-01`, knowledgeCutoff = `${asOfDate}T00:00:00Z`;
  const version = "composer-reconstruction@v1";
  const baseline = {
    version: "planning-baseline@v1" as const, householdId, targetMonth, knowledgeCutoff, sourceRefs: [],
    structuralFacts: { resources: [], obligations: [], savingsReservations: [], externalKnownContexts: [] },
    slots: [], unresolvedReserves: [], modelVersions: { reconstruction: version }, diagnostics: [],
  };
  const unknown = { low: null, central: null, high: null };
  const referenceTotal = sumReferenceComponents([]);
  const scopeDigest = planningBaselineDigest(baseline);
  return {
    reconstruction: true,
    baseline: { ...baseline, digest: scopeDigest },
    forecast: {
      meta: { targetMonth, sourcePublicationId: version, sourceRevision: 0, analyticsRevision: 0, computedAt: knowledgeCutoff, certificationStatus: "PROVISIONAL" },
      publicationMeta: { publicationId: version, revision: 0, factsHash: scopeDigest, manifestHash: scopeDigest },
      resourceMeta: { contractVersion: version, methodSignature: scopeDigest, policyVersions: {}, resourceInputHash: scopeDigest },
      components: [], income: { ...unknown, components: [], knowledgeState: "UNKNOWN" },
      obligations: unknown, economicCost: { ...unknown, coverage: "KNOWN_BASELINE_ONLY" },
      cash: { grossBeforeUnconfirmedFunding: unknown, afterPotentialBenefit: unknown, confirmedBenefit: null, knowledgeState: "CONDITIONAL_UNKNOWN" },
      funding: { benefitHistoricalRange: unknown, currentBalance: null, knowledgeState: "UNKNOWN" },
      events: { planned: [], eventDelta: null, knowledgeState: "UNKNOWN" },
      reserve: { amount: "0", source: "POLICY" },
      freeToSpend: { ...unknown, knowledgeState: "UNKNOWN", coverage: "KNOWN_BASELINE_ONLY" },
      availableNow: { status: "UNAVAILABLE", value: null, missingInputs: ["OPENING_BALANCE"] },
      limitations: ["RECONSTRUCTION_ONLY"],
      referencePlan: { targetMonth, necessary: [], flexible: [], necessaryTotal: referenceTotal, flexibleTotal: referenceTotal,
        restaurantCorpus: [], excludedRestaurantSubcategories: [], estimatedDays: {} },
    },
    monthInputs: defaultMonthInputs(), externalIntents: [], asOfDate, costQuotes: {},
    mobilityFacts: {
      places: [], vehicle: null, history: [], evidenceRefs: [],
      personalAuthority: buildGlobalM7PersonalMobilityAuthority({ mobilityLegs: [], contextLinks: [], presenceResolutions: [] }),
    },
    modelVersions: { financialOwner: "deriveMonthScenario@v2", reconstruction: version },
  };
}
