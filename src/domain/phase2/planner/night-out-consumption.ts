import type { ComponentSelectionV1 } from "./component-contract";
import type { PlannedContextState } from "./semantic-state";
import { parsePlannerJsonObject, plannerKeys, plannerRecord, plannerString, plannerDigest, type PlannerJsonObject } from "./json";
import { parseComponentEconomicScope } from "./component-economic-scope";
import { decisionAmount } from "../month-decision-contract";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
/** Only the inactive Au bar choices are stored here. Active facts remain in extras.
 * Before, main contributions, meals and journeys are never part of this switch. */
export type NightOutConsumption = Readonly<{
  version: "night-out-consumption@v1";
  mode: "DIRECT" | "DETAILED";
  directSelectionId: string | null;
  inactive: readonly Component[];
}>;
export function parseNightOutConsumption(raw: unknown): NightOutConsumption {
  const v = plannerRecord(raw);
  plannerKeys(v, ["version", "mode", "directSelectionId", "inactive"]);
  if (v.version !== "night-out-consumption@v1" || !["DIRECT", "DETAILED"].includes(String(v.mode))
    || !Array.isArray(v.inactive) || v.inactive.length > 500) throw new TypeError("NIGHT_OUT_CONSUMPTION_INVALID");
  const id = v.directSelectionId === null ? null : plannerString(v.directSelectionId);
  const inactive = v.inactive.map(rawItem => {
    const item = parsePlannerJsonObject(rawItem);
    if (item.kind !== "COMPONENT" || item.optionKey !== "extra" || item.provenance !== "EXPLICIT_USER_DECISION")
      throw new TypeError("NIGHT_OUT_CONSUMPTION_COMPONENT_INVALID");
    plannerString(item.selectionId); plannerString(item.label); decisionAmount(item.quantity);
    const cost = plannerRecord(item.cost);
    if (cost.kind === "MANUAL") decisionAmount(cost.unitAmount);
    if (!["MANUAL", "UNKNOWN", "QUOTE"].includes(String(cost.kind))) throw new TypeError("NIGHT_OUT_CONSUMPTION_COST_INVALID");
    return item as unknown as Component;
  });
  if (new Set(inactive.map(i => i.selectionId)).size !== inactive.length
    || v.mode === "DIRECT" && !id
    || v.mode === "DETAILED" && (inactive.length > 1 || (id === null) !== (inactive.length === 0)
      || inactive.length === 1 && inactive[0].selectionId !== id)) throw new TypeError("NIGHT_OUT_CONSUMPTION_INVALID");
  return { version: "night-out-consumption@v1", mode: v.mode as NightOutConsumption["mode"], directSelectionId: id, inactive };
}
export const nightOutConsumption = (context: PlannedContextState): NightOutConsumption | null =>
  context.fields.nightOutConsumption === undefined ? null : parseNightOutConsumption(context.fields.nightOutConsumption);
export const nightOutExtras = (context: PlannedContextState): readonly ComponentSelectionV1[] =>
  (context.slotSelections.extras?.items ?? []) as unknown as readonly ComponentSelectionV1[];

/** Validate references as well as the version, even when saving an incomplete Draft. */
export function validateNightOutConsumption(context: PlannedContextState): void {
  const mode = nightOutConsumption(context); if (!mode) return;
  if (context.templateKey !== "night-out") throw new TypeError("NIGHT_OUT_CONSUMPTION_OWNER_INVALID");
  const extras = nightOutExtras(context);
  const all = Object.values(context.slotSelections).flatMap(s => Array.isArray(s.items) ? s.items : []);
  if (mode.inactive.some(i => all.some(a => a && typeof a === "object" && !Array.isArray(a) && a.selectionId === i.selectionId)))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_ACTIVE_INACTIVE_OVERLAP");
  const direct = mode.mode === "DIRECT" ? extras.find(i => i.selectionId === mode.directSelectionId) : mode.inactive[0];
  if (mode.mode === "DIRECT" && extras.some(i => i.selectionId !== mode.directSelectionId
    && !(i.kind === "COMPONENT" && i.economicScope?.kind === "ADDITIVE_CONTRIBUTION")))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_ACTIVE_SCOPE_CONFLICT");
  if (mode.directSelectionId && (!direct || direct.kind !== "COMPONENT" || direct.optionKey !== "extra"
    || direct.quantity !== "1" && direct.quantity !== "1.00" || direct.unitBasis !== "SHARED"
    || !direct.economicScope || parseComponentEconomicScope(direct.economicScope, direct.selectionId).kind !== "AGGREGATED_SUBSTITUTIVE_ESTIMATE"))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_DIRECT_INVALID");
}

export type NightOutConsumptionCommand = Readonly<{
  expectedContextDigest: string;
  mode: "DIRECT" | "DETAILED";
  /** Only for the explicit amount action. Never calculated from the total. */
  amount?: string;
  selectionId?: string;
  acceptLegacy?: boolean;
}>;
export function transitionNightOutConsumption(context: PlannedContextState, command: NightOutConsumptionCommand): PlannedContextState {
  if (plannerDigest(context) !== command.expectedContextDigest) throw new TypeError("NIGHT_OUT_CONSUMPTION_STALE");
  if (context.templateKey !== "night-out") throw new TypeError("NIGHT_OUT_CONSUMPTION_OWNER_INVALID");
  if (!["DIRECT", "DETAILED"].includes(command.mode)) throw new TypeError("NIGHT_OUT_CONSUMPTION_INVALID");
  const prior = nightOutConsumption(context), extras = nightOutExtras(context);
  const main = (context.slotSelections.main?.items ?? []) as unknown as readonly ComponentSelectionV1[];
  if (main.some(i => i.kind === "COMPONENT" && i.economicScope?.kind !== "ADDITIVE_CONTRIBUTION"))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_LEGACY_MAIN_NEEDS_CHOICE");
  if (prior?.mode === command.mode && command.amount === undefined) return context;
  // Never implicitly reinterpret a historical aggregate or a financed selection.
  const candidates = extras.filter(i => i.selectionId !== prior?.directSelectionId && !(i.kind === "COMPONENT" && i.economicScope?.kind === "ADDITIVE_CONTRIBUTION"));
  if (!prior && candidates.length && !command.acceptLegacy) throw new TypeError("NIGHT_OUT_CONSUMPTION_LEGACY_NEEDS_CHOICE");
  if (candidates.some(i => i.kind !== "COMPONENT" || i.provenance !== "EXPLICIT_USER_DECISION"
    || i.economicScope || i.fundingAllocations?.length)) throw new TypeError("NIGHT_OUT_CONSUMPTION_SCOPE_NEEDS_CHOICE");
  let next: NightOutConsumption, items: readonly ComponentSelectionV1[];
  if (command.mode === "DETAILED") {
    const direct = prior?.mode === "DIRECT" ? extras.find(i => i.selectionId === prior.directSelectionId) : null;
    if (direct && (direct.kind !== "COMPONENT" || direct.fundingAllocations?.length)) throw new TypeError("NIGHT_OUT_CONSUMPTION_FUNDING_NEEDS_CHOICE");
    next = { version: "night-out-consumption@v1", mode: "DETAILED", directSelectionId: direct?.selectionId ?? null, inactive: direct ? [direct as Component] : [] };
    items = prior?.mode === "DIRECT" ? [...extras.filter(i => i !== direct), ...prior.inactive] : extras;
  } else {
    const original = prior?.mode === "DETAILED" ? prior.inactive[0] : prior?.mode === "DIRECT" ? extras.find(i => i.selectionId === prior.directSelectionId) : null;
    if (original && (original.kind !== "COMPONENT" || original.fundingAllocations?.length)) throw new TypeError("NIGHT_OUT_CONSUMPTION_FUNDING_NEEDS_CHOICE");
    if (!original && command.amount === undefined) throw new TypeError("NIGHT_OUT_CONSUMPTION_DIRECT_AMOUNT_REQUIRED");
    const selectionId = original?.selectionId ?? plannerString(command.selectionId);
    const direct: Component = original?.kind === "COMPONENT" ? { ...original,
      ...(command.amount === undefined ? {} : { cost: { kind: "MANUAL", unitAmount: decisionAmount(command.amount) } }) } : {
      selectionId, optionKey: "extra", kind: "COMPONENT", provenance: "EXPLICIT_USER_DECISION", label: "Consommations", quantity: "1", unitBasis: "SHARED",
      cost: { kind: "MANUAL", unitAmount: decisionAmount(command.amount) },
      economicScope: { version: "component-economic-scope@v1", kind: "AGGREGATED_SUBSTITUTIVE_ESTIMATE", coveredSelectionIds: [selectionId] }
    };
    const archived = prior?.mode === "DIRECT" ? prior.inactive : candidates as readonly Component[];
    next = { version: "night-out-consumption@v1", mode: "DIRECT", directSelectionId: selectionId, inactive: archived };
    const removed = new Set([...archived.map(i => i.selectionId), selectionId]);
    items = [...extras.filter(i => !removed.has(i.selectionId)), direct];
  }
  const result = { ...context, fields: { ...context.fields, nightOutConsumption: next as unknown as PlannerJsonObject },
    slotSelections: { ...context.slotSelections, extras: { items: items as unknown as readonly PlannerJsonObject[] } } };
  validateNightOutConsumption(result); return result;
}
