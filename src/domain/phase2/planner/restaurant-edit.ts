import { parsePlanSemanticState, type PlanSemanticStateV1 } from "./semantic-state";
import type { PlannerJson } from "./json";
import type { ComponentSelectionV1 } from "./component-contract";

export type RestaurantEdit = Readonly<{ contextOccurrenceId: string; fields?: Readonly<Record<string, PlannerJson>>;
  slots?: Readonly<Partial<Record<"meal" | "extras" | "transport", readonly ComponentSelectionV1[]>>> }>;

/** Atomic replacement of the existing Restaurant sockets, not a new economic representation. */
export function editRestaurant(raw: PlanSemanticStateV1, edit: RestaurantEdit): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), context = state.contexts.find(c => c.contextOccurrenceId === edit.contextOccurrenceId);
  if (context?.templateKey !== "restaurant") throw new TypeError("COMPOSER_RESTAURANT_TARGET_INVALID");
  if (state.preferences.anchors.includes(context.contextOccurrenceId) || state.preferences.flexibility[context.contextOccurrenceId] === "PRESERVE")
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const fields = { ...context.fields }, slots = { ...context.slotSelections };
  for (const [key, value] of Object.entries(edit.fields ?? {})) {
    if (!["label", "plannedDate", "participantRefs", "placeRef"].includes(key)) throw new TypeError("COMPOSER_RESTAURANT_FIELD_INVALID");
    if (value === "") delete fields[key]; else fields[key] = value;
  }
  // Existing JSON/C0 version; no change to historical manifests or registry.
  fields.fieldSchemaVersion ??= "context-fields@v2";
  for (const [key, items] of Object.entries(edit.slots ?? {})) {
    if (!["meal", "extras", "transport"].includes(key) || !Array.isArray(items)
      || key !== "extras" && items.length > 1
      || items.some(item => key === "transport" ? item.kind !== "MOBILITY_INTENT"
        : item.kind !== "COMPONENT" || item.optionKey !== (key === "meal" ? "restaurant" : "extra")))
      throw new TypeError("COMPOSER_RESTAURANT_SLOT_INVALID");
    slots[key] = { ...slots[key], items };
  }
  return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c === context ? { ...c, fields, slotSelections: slots } : c) });
}
