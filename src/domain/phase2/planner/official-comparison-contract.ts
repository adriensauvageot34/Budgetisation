import type { ContextualEffect } from "./component-contract";
import type { CompiledPlanSlot, CompiledComponent } from "./compiler-contract";
import type { PlannerJsonObject } from "./json";
import type { PlanProjectionV1 } from "./projection-contract";

export type ActivePlanPointer = Readonly<{ planId: string; activeRevisionId: string | null; activeRevisionNumber: number }>;
export type OfficialDecisionImpact = Readonly<{
  decisionId: string; kind: "CONTROL" | "CONTEXT"; targetRef: string;
  parentContextOccurrenceId: string | null; componentIds: readonly string[]; planSlotIds: readonly string[];
  marginalImpactOnMonthEnd: string | null; rationaleCode: string;
  comparisonSemanticStateDigest: string | null;
  attribution: "CONDITIONAL_MARGINAL_NOT_ADDITIVE" | "UNRESOLVED";
  interactingDecisionIds: readonly string[];
}>;
/** Read-only interpretation of existing Compiler/V2 outputs. Never persisted as revision evidence.
 * Marginals remove one decision from the entire Plan; they must not be added together.
 * Component gross/displacement are another explanatory lens, already included in projection. */
export type OfficialPlanComparisonV1 = Readonly<{
  version: "official-plan-comparison@v1"; householdId: string; targetMonth: string;
  revision: Readonly<{ planId: string; planRevisionId: string; revisionNumber: number; semanticStateDigest: string;
    storedBaselineDigest: string; storedCompiledManifestDigest: string; storedProjectionDigest: string }>;
  freshness: Readonly<{ activeRevision: "CURRENT_AT_CHECK" | "SUPERSEDED" | "UNAVAILABLE";
    checkedPointer: ActivePlanPointer | null; authorities: "EXACT" | "CHANGED_AUTHORITIES" }>;
  authorities: Readonly<{ baselineDigest: string; compiledManifestDigest: string; projectionDigest: string;
    knowledgeCutoff: string; asOfDate: string; modelVersions: PlannerJsonObject;
    forecastPublicationId: string; forecastRevision: number; forecastResourceInputHash: string }>;
  projection: PlanProjectionV1;
  decomposition: "NON_ADDITIVE_MARGINALS_AND_COMPONENT_LENSES";
  decisions: readonly OfficialDecisionImpact[];
  slots: readonly Readonly<{ planSlotId: string; slotIdentityKey: string; decisionId: string | null;
    role: CompiledPlanSlot["role"]; baselineValue: CompiledPlanSlot["baseline"]["baselineValue"];
    effectiveAmount: string | null; effectiveCount: string | null; effectiveUnitAmount: string | null;
    remainingEconomicAmount: string | null; referenceKeys: readonly string[]; sourceRefs: readonly string[] }>[];
  components: readonly Readonly<{ effect: ContextualEffect; contextOccurrenceId: string | null;
    externalEntryId: string | null; physicalJourneyRequirementId: string | null;
    plannedDate: string | null; costBasis: PlannerJsonObject; fundingAllocations: CompiledComponent["fundingAllocations"] }>[];
}>;
