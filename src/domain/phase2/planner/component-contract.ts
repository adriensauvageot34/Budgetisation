import type { PlannerJsonObject } from "./json";
import type { PlannerConfidence, PlannerKnowledge, PlannerProvenance } from "./diagnostics";

export type ComponentSlotDefinition = Readonly<{ slotKey: string; role: string;
  cardinality: "REQUIRED_ONE" | "OPTIONAL_ONE" | "REPEATING";
  optionSource: "STATIC" | "CAPABILITY_PROVIDER" | "CHILD_CONTEXT"; mobilityRole?: string }>;
export type ContextTemplateV1 = Readonly<{ templateKey: string;
  family: "FOOD" | "SOCIAL" | "ACTIVITY" | "VISIT" | "PURCHASE" | "TRAVEL" | "HOME" | "BEAUTY" | "OTHER";
  version: string; fields: readonly PlannerJsonObject[]; componentSlots: readonly ComponentSlotDefinition[];
  capabilities: readonly PlannerJsonObject[]; structuralDefaults: PlannerJsonObject }>;
export type CostEvaluation = Readonly<{ economicAmount: string | null; knowledge: PlannerKnowledge;
  confidence: PlannerConfidence; range: PlannerJsonObject | null; rangeSemantics: string | null;
  basis: PlannerJsonObject; support: readonly string[]; provenance: readonly PlannerProvenance[];
  assumptions: readonly string[]; freshness: string | null; modelVersion: string }>;
export type ContextualEffect = Readonly<{ componentId: string; baselinePlanSlotId: string | null;
  slotRelation: "CONSUMES_SLOT" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT" | "UNRESOLVED";
  economicRelation: "DISPLACEMENT" | "INCREMENTAL" | "MIXED" | "UNKNOWN";
  grossAmount: string | null; displacedAmount: string | null; incrementalAmount: string | null;
  knowledge: PlannerKnowledge; evidenceRefs: readonly string[] }>;
