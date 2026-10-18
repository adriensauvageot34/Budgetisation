import type { PlannerJsonObject } from "./json";
import type { PlannerConfidence, PlannerKnowledge, PlannerProvenance } from "./diagnostics";
import type { KernelCost } from "./compiler-contract";
import type { FundingAllocation, ProspectivePlaceRef } from "../planned-contract";
import type { JourneyDeclaration, MobilityPricingDecision, ProspectiveRouteDecision } from "./mobility-contract";
import type { PlannedAssetRef } from "../planned-assets";
import type {VenueEndpoints} from "./night-out-venue";
import type {ComponentEconomicScope} from "./component-economic-scope";

export type ComponentDefaultProvenance = "STRUCTURAL_DEFAULT" | "PERSONAL_SUGGESTION" | "EXPLICIT_USER_DECISION";
export type ContextBindingDecision = Readonly<{ mode: "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT" }>;
type SelectionIdentity = Readonly<{ selectionId: string; optionKey: string; provenance: ComponentDefaultProvenance }>;
export type ComponentSelectionV1 = SelectionIdentity & (
  | Readonly<{ kind: "COMPONENT"; label: string; quantity: string; cost: KernelCost;
      binding?: ContextBindingDecision; fundingAllocations?: readonly FundingAllocation[]; needOccurrenceId?: string;
      unitBasis?: "ITEM" | "PERSON" | "SHARED";
      /** Optional P09 quantity evidence. `quantity` remains the exact economic total used by the Compiler. */
      quantityEvidenceVersion?: "component-quantity@v1"; quantityPerPerson?: string; pricedParticipantCount?: number;
      productAssetRef?: PlannedAssetRef;
      economicScope?:ComponentEconomicScope;
      lodgingPricing?: Readonly<{ version: "lodging-pricing@v1"; basis: "TOTAL" | "PER_NIGHT"; nightCount: number | null }> }>
  | Readonly<{ kind: "CHILD_CONTEXT"; childContextOccurrenceId: string }>
  | Readonly<{ kind: "MOBILITY_INTENT"; origin?: ProspectivePlaceRef | null; destination?: ProspectivePlaceRef | null; returnRequired?: boolean;
      journey?: JourneyDeclaration; pricing?: MobilityPricingDecision; plannedTime?: string | null; returnTime?: string | null;
      route?: ProspectiveRouteDecision; venueEndpoints?:VenueEndpoints }>
  | Readonly<{ kind: "UNRESOLVED" }>);
export type ComponentSlotSelectionV1 = Readonly<{ items: readonly ComponentSelectionV1[] }>;
export type ComponentOptionDefinition = Readonly<{ optionKey: string; label: string; kind: "COMPONENT" | "MOBILITY_INTENT";
  baselineDomain: string | null; bindingPolicy: "CERTAIN_DOMAIN" | "REQUIRES_CONFIRMATION" | "NONE";
  mobilityMode?: "CAR" | "TRAIN" | "BUS" | "TAXI" | "FREE" | "OTHER" | "UNKNOWN" }>;

export type ComponentSlotDefinition = Readonly<{ slotKey: string; role: string;
  cardinality: "REQUIRED_ONE" | "OPTIONAL_ONE" | "REPEATING";
  optionSource: "STATIC" | "CAPABILITY_PROVIDER" | "CHILD_CONTEXT";
  options: readonly ComponentOptionDefinition[]; allowedChildTemplates: readonly string[];
  mobilityRole?: "PRIMARY" | "ACCESS" | "LOCAL_STOP" | "RETURN"; acceptsNeedOccurrence?: boolean }>;
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
