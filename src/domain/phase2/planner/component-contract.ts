import type { PlannerJsonObject } from "./json";
import type { PlannerConfidence, PlannerKnowledge, PlannerProvenance } from "./diagnostics";
import type { KernelCost } from "./compiler-contract";
import type { FundingAllocation, ProspectivePlaceRef } from "../planned-contract";
import type { JourneyDeclaration, MobilityPricingDecision } from "./mobility-contract";

export type ComponentDefaultProvenance = "STRUCTURAL_DEFAULT" | "PERSONAL_SUGGESTION" | "EXPLICIT_USER_DECISION";
export type ContextBindingDecision = Readonly<{ mode: "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT" }>;
type SelectionIdentity = Readonly<{ selectionId: string; optionKey: string; provenance: ComponentDefaultProvenance }>;
export type ComponentSelectionV1 = SelectionIdentity & (
  | Readonly<{ kind: "COMPONENT"; label: string; quantity: string; cost: KernelCost;
      binding?: ContextBindingDecision; fundingAllocations?: readonly FundingAllocation[] }>
  | Readonly<{ kind: "CHILD_CONTEXT"; childContextOccurrenceId: string }>
  | Readonly<{ kind: "MOBILITY_INTENT"; origin?: ProspectivePlaceRef | null; destination?: ProspectivePlaceRef | null; returnRequired?: boolean;
      journey?: JourneyDeclaration; pricing?: MobilityPricingDecision; plannedTime?: string | null; returnTime?: string | null }>
  | Readonly<{ kind: "UNRESOLVED" }>);
export type ComponentSlotSelectionV1 = Readonly<{ items: readonly ComponentSelectionV1[] }>;
export type ComponentOptionDefinition = Readonly<{ optionKey: string; label: string; kind: "COMPONENT" | "MOBILITY_INTENT";
  baselineDomain: string | null; bindingPolicy: "CERTAIN_DOMAIN" | "REQUIRES_CONFIRMATION" | "NONE";
  mobilityMode?: "CAR" | "TRAIN" | "BUS" | "TAXI" | "FREE" | "OTHER" | "UNKNOWN" }>;

export type ComponentSlotDefinition = Readonly<{ slotKey: string; role: string;
  cardinality: "REQUIRED_ONE" | "OPTIONAL_ONE" | "REPEATING";
  optionSource: "STATIC" | "CAPABILITY_PROVIDER" | "CHILD_CONTEXT";
  options: readonly ComponentOptionDefinition[]; allowedChildTemplates: readonly string[];
  mobilityRole?: "PRIMARY" | "ACCESS" | "LOCAL_STOP" | "RETURN" }>;
export type { ContextTemplateV1 } from "./context-contract";
export type CompiledComponentSlot = Readonly<{ contextOccurrenceId: string; slotKey: string; role: string;
  cardinality: ComponentSlotDefinition["cardinality"]; state: "EMPTY" | "UNRESOLVED" | "SUGGESTED" | "RESOLVED";
  selections: readonly ComponentSelectionV1[]; componentIds: readonly string[]; childContextIds: readonly string[];
  mobilityIntentIds: readonly string[]; contributes: boolean }>;
export type CostEvaluation = Readonly<{ economicAmount: string | null; knowledge: PlannerKnowledge;
  confidence: PlannerConfidence; range: PlannerJsonObject | null; rangeSemantics: string | null;
  basis: PlannerJsonObject; support: readonly string[]; provenance: readonly PlannerProvenance[];
  assumptions: readonly string[]; freshness: string | null; modelVersion: string }>;
export type ContextualEffect = Readonly<{ componentId: string; baselinePlanSlotId: string | null;
  slotRelation: "CONSUMES_SLOT" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT" | "UNRESOLVED";
  economicRelation: "DISPLACEMENT" | "INCREMENTAL" | "MIXED" | "UNKNOWN";
  grossAmount: string | null; displacedAmount: string | null; incrementalAmount: string | null;
  knowledge: PlannerKnowledge; evidenceRefs: readonly string[] }>;
