import type { ComponentSelectionV1 } from "./component-contract";
import type { PlannerJson } from "./json";
import { parsePlanSemanticState, type PlanSemanticStateV1 } from "./semantic-state";
import { presetForContext } from "./composer-presets";

export type GuidedContextEdit = Readonly<{ contextOccurrenceId: string; fields?: Readonly<Record<string, PlannerJson>>;
  slots?: Readonly<Partial<Record<"meal" | "main" | "item" | "extras" | "transport", readonly ComponentSelectionV1[]>>> }>;
export const guidedContextShape = (templateKey: string) => ({
  restaurant: { slot: "meal", option: "restaurant", total: "Addition totale", complement: "Complément de repas", envelope: "Restaurants", participants: true, transport: true },
  delivery: { slot: "meal", option: "delivery", total: "Commande livrée", complement: "Frais ou complément non inclus", envelope: "Livraisons", participants: true, transport: false },
  activity: { slot: "main", option: "activity", total: "Budget de la sortie", complement: "Frais ponctuel non inclus", envelope: null, participants: true, transport: true },
  purchase: { slot: "item", option: "item", total: "Achat de vêtements", complement: "Article ou frais non inclus", envelope: "Vêtements", participants: false, transport: true },
} as const)[templateKey as "restaurant" | "delivery" | "activity" | "purchase"];

/** Replaces published sockets atomically. Never adds a financial parent total. */
export function editGuidedContext(raw: PlanSemanticStateV1, edit: GuidedContextEdit): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), context = state.contexts.find(c => c.contextOccurrenceId === edit.contextOccurrenceId);
  if (!context || !presetForContext(context) || !["delivery", "activity", "purchase"].includes(context.templateKey))
    throw new TypeError("COMPOSER_PRESET_CONTEXT_INVALID");
  if (state.preferences.anchors.includes(context.contextOccurrenceId) || state.preferences.flexibility[context.contextOccurrenceId] === "PRESERVE")
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const shape = guidedContextShape(context.templateKey), fields = { ...context.fields }, slots = { ...context.slotSelections };
  const allowedFields = ["label", "plannedDate", "placeRef", ...(shape.participants ? ["participantRefs"] : ["budgetDomain", "productLabel", "merchantLabel"])];
  for (const [key, value] of Object.entries(edit.fields ?? {})) {
    if (!allowedFields.includes(key)) throw new TypeError("COMPOSER_PRESET_FIELD_INVALID");
    if (value === "") delete fields[key]; else fields[key] = value;
  }
  for (const [key, items] of Object.entries(edit.slots ?? {})) {
    if (![shape.slot, "extras", ...(shape.transport ? ["transport"] : [])].includes(key) || !Array.isArray(items)
      || key !== "extras" && items.length > 1
      || items.some(item => key === "transport" ? item.kind !== "MOBILITY_INTENT"
        : item.kind !== "COMPONENT" || item.optionKey !== (key === "extras" ? "extra" : shape.option)))
      throw new TypeError("COMPOSER_PRESET_SLOT_INVALID");
    slots[key] = { ...slots[key], items };
  }
  return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c === context ? { ...c, fields, slotSelections: slots } : c) });
}
