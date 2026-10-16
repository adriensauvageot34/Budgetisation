import type { MonthComposerReadModel, DropTarget } from "./composer-contract";
import type { PlannerApplyCommand } from "./compiler-contract";
import type { PlanSemanticStateV1 } from "./semantic-state";
import type { PlannerJson } from "./json";
import type { PlanBalanceSuggestions, SemanticMutation } from "./adjustment-contract";
import type { ComponentSelectionV1 } from "./component-contract";
import type { NightOutEdit } from "./night-out-edit";
import type { ShortStayEdit } from "./short-stay-edit";
import type { FamilyVisitEdit } from "./family-visit-edit";
import type { RestaurantEdit } from "./restaurant-edit";
import type { GuidedContextEdit } from "./guided-context-edit";
import type { PlannedPlaceOption } from "../planned-places";
import type { PlannedVehicleEstimate } from "../planned-contract";

export type ComposerMobilitySummary = Readonly<{ contextOccurrenceId: string; journeyId: string; requestDigest: string;
  status: "RESOLVED" | "PARTIAL" | "UNKNOWN"; distanceKm: string | null; economicFuel: string | null;
  toll: string | null; parking: string | null; fare: string | null; cashTransport: string | null;
  routeSource: string | null; fuelSource: string | null; tollSource: string | null; vehicleLabel: string | null;
  methodRef: string | null; timeBasis: string | null; fallbacks: readonly string[] }>;

export type ComposerField = Readonly<{ key: string; label: string; kind: "TEXT" | "DATE" | "AMOUNT" | "CHOICE" | "COUNT" | "PERSON_REF" | "PERSON_REFS" | "PLACE_REF";
  required: boolean; choices?: readonly Readonly<{ value: string; label: string }>[]; initial?: string }>;
export type ComposerEditor = Readonly<{ assetKey: string; fields: readonly ComposerField[] }>;
export type ComposerObjectPresentation = Readonly<{
  iconKey: string;
  variant: "SIMPLE" | "HABIT" | "COMPOSITE" | "SAVINGS";
  baselineAmount: string | null;
  baselineCount: string | null;
  protectedSavings: boolean;
  reservationGauge: Readonly<{ percent: number | null; referenceAmount: string | null }> | null;
  choiceGauge: Readonly<{ percent: number | null; referenceAmount: string | null }> | null;
  occurrenceStack: Readonly<{ bubbles: readonly ("AVAILABLE" | "LINKED")[]; overflow: string | null; links: readonly Readonly<{ componentId: string; count: string | null; contextOccurrenceId: string | null; selectionId: string | null; label: string }>[] }> | null;
}>;
export type ComposerSatellitePresentation = Readonly<{
  selectionId: string; label: string; iconKey: string;
  state: "CHOSEN" | "SUGGESTED" | "DERIVED" | "UNRESOLVED";
  economicAmount: string | null; costCaption: string | null; details: readonly string[];
  editableAssetKey: string | null; canRemove: boolean; canAccept: boolean;
  childContextOccurrenceId: string | null;
}>;
export type ComposerSocketPresentation = Readonly<{
  orbit: "NORTH" | "WEST" | "EAST" | "SOUTH";
  canAdd: boolean;
  satellites: readonly ComposerSatellitePresentation[];
  options: readonly Readonly<{ assetKey: string; state: "AVAILABLE" | "EQUIPPED" | "SUGGESTED" | "ALTERNATIVE" }>[];
}>;
/** Display metadata only. Counts describe top-level objects; no financial authority. */
export type ComposerPresentation = Readonly<{
  elementCount: number; unresolvedCount: number;
  goalMargin: string | null;
  objects: Readonly<Record<string, ComposerObjectPresentation>>;
  sockets: Readonly<Record<string, ComposerSocketPresentation>>;
  unresolvedRefs: readonly string[];
  dragSources: Readonly<Record<string, ComposerDragSource>>;
  availableReservationRefs: readonly string[];
}>;
/** Presentation of an existing capability, not a new semantic mutation owner. */
export type ComposerDragSource = Readonly<{
  sourceKey: string; assetKey: string; label: string; iconKey: string; economicAmount: string | null;
  selection?: ComponentSelectionV1;
  sourceSocket?: Readonly<{ contextOccurrenceId: string; slotKey: string; selectionId: string }>;
  removeOperation?: ComposerOperation; protected: boolean;
  editorTargetRef?: string; editorDropTarget?: DropTarget;
  pack?: readonly Readonly<{ label: string; iconKey: string; provenance: string }>[];
}>;
/** Excludes Baseline snapshots, canonical evidence and financial adapter entries. */
export type ComposerUiModel = Omit<MonthComposerReadModel, "preview"> & Readonly<{
  householdPersons: readonly Readonly<{ personId: string; displayName: string }>[];
  mobilityOptions?: Readonly<{ places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null }>;
  mobilitySummaries?: readonly ComposerMobilitySummary[];
  /** Display subtotal of already evaluated Compiler components and owned journeys; never an Apply input. */
  nightOutSummaries?: readonly Readonly<{contextOccurrenceId: string; semanticStateDigest: string; knownAmount: string | null; incomplete: boolean}>[];
  proof: Omit<PlannerApplyCommand, "applyRequestId">;
  appliedContextIds: readonly string[];
  editors: readonly ComposerEditor[];
  controlEditors: readonly Readonly<{ targetRef: string; fields: readonly ComposerField[] }>[];
  sectionLabels: Readonly<Record<string, string>>;
  presentation: ComposerPresentation;
}>;
/** A committed revision is evidence of Apply even when the subsequent World read fails. */
export type ComposerApplyReceipt = Readonly<{
  applyRequestId: string; planRevisionId: string; revisionNumber: number; parentRevisionId: string | null;
  semanticStateDigest: string; baselineDigest: string; previewDigest: string;
  outcome: "APPLIED" | "REPLAYED";
  headStatus: "ACTIVE" | "SUPERSEDED" | "UNAVAILABLE";
  activeRevisionId: string | null; activeRevisionNumber: number | null;
}>;
export type ComposerRequest = Readonly<{ sequence: number; targetMonth: string; draft?: PlanSemanticStateV1 }> & (
  | Readonly<{ kind: "READ" }>
  | Readonly<{ kind: "MUTATE"; mutation: SemanticMutation }>
  | Readonly<{ kind: "DROP"; assetKey: string; target: DropTarget; values: Readonly<Record<string, string>>; identity: string; selectionId: string; presetKey?: string; sourceSocket?: Readonly<{ contextOccurrenceId: string; slotKey: string; selectionId: string }> }>
  | Readonly<{ kind: "CLEAR_SOCKET"; contextOccurrenceId: string; slotKey: string; selectionId: string }>
  | Readonly<{ kind: "EDIT_CONTEXT"; contextOccurrenceId: string; values: Readonly<Record<string, PlannerJson>> }>
  | Readonly<{ kind: "EDIT_RESTAURANT"; edit: RestaurantEdit }>
  | Readonly<{ kind: "EDIT_PRESET_CONTEXT"; edit: GuidedContextEdit }>
  | Readonly<{ kind: "EDIT_GIFT"; contextOccurrenceId: string; values: Readonly<Record<string, PlannerJson>>; item: ComponentSelectionV1 }>
  | Readonly<{ kind: "EDIT_NIGHT_OUT"; edit: NightOutEdit }>
  | Readonly<{ kind: "EDIT_FAMILY_VISIT"; edit: FamilyVisitEdit }>
  | Readonly<{ kind: "EDIT_SHORT_STAY"; edit: ShortStayEdit }>
  | Readonly<{ kind: "PRESERVE"; targetRef: string; preserve: boolean }>
  | Readonly<{ kind: "SUGGESTIONS" }>
  | Readonly<{ kind: "ACCEPT"; candidateSetDigest: string; candidateId: string }>
  | Readonly<{ kind: "APPLY"; command: PlannerApplyCommand }>
  | Readonly<{ kind: "CHECK_APPLY"; command: PlannerApplyCommand }>
);
export type ComposerResponse = Readonly<{ sequence: number }> & (
  | Readonly<{ ok: true; model: ComposerUiModel; suggestions?: PlanBalanceSuggestions; applied?: boolean; applyReceipt?: ComposerApplyReceipt; mutationKind?: string; interactionImpact?: string | null }>
  | Readonly<{ ok: false; code: string; message: string; applied?: boolean; applyReceipt?: ComposerApplyReceipt; revisionNumber?: number }>
);
export type ComposerTransport = (request: ComposerRequest) => Promise<ComposerResponse>;
export type ComposerOperation = ComposerRequest extends infer Request ? Request extends ComposerRequest ? Omit<Request, "sequence" | "targetMonth" | "draft"> : never : never;
