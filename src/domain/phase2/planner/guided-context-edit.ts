import type { ComponentSelectionV1 } from "./component-contract";
import { plannerDigest, type PlannerJson } from "./json";
import { parsePlanSemanticState, type PlanSemanticStateV1 } from "./semantic-state";
import { isServiceContext, presetForContext } from "./composer-presets";
import { isPurchaseBasket } from "./purchase-basket";
import { parseOutingTime } from "./outing-time";
import { componentId } from "./identity";

export const SERVICE_FIELDS = ["providerLabel", "appointmentIntent"] as const;

export type GuidedContextEdit = Readonly<{ contextOccurrenceId: string; fields?: Readonly<Record<string, PlannerJson>>;
  slots?: Readonly<Partial<Record<"meal" | "main" | "item" | "extras" | "transport", readonly ComponentSelectionV1[]>>> }>;
export const guidedContextShape = (templateKey: string) => ({
  restaurant: { slot: "meal", option: "restaurant", total: "Addition totale", complement: "Complément de repas", envelope: "Restaurants", participants: true, transport: true },
  "fast-food": { slot: "meal", option: "fast-food", total: "Repas rapide", complement: "Complément non inclus", envelope: "Fast-food", participants: true, transport: true },
  delivery: { slot: "meal", option: "delivery", total: "Commande livrée", complement: "Frais ou complément non inclus", envelope: "Livraisons", participants: true, transport: false },
  activity: { slot: "main", option: "activity", total: "Budget de la sortie", complement: "Frais ponctuel non inclus", envelope: null, participants: true, transport: true },
  purchase: { slot: "item", option: "item", total: "Montant de l’achat", complement: "Article ou frais non inclus", envelope: null, participants: false, transport: true },
} as const)[templateKey as "restaurant" | "fast-food" | "delivery" | "activity" | "purchase"];

/** Replaces published sockets atomically. Never adds a financial parent total. */
export function editGuidedContext(raw: PlanSemanticStateV1, edit: GuidedContextEdit): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), context = state.contexts.find(c => c.contextOccurrenceId === edit.contextOccurrenceId);
  if (!context || (context.templateKey !== "purchase" && !presetForContext(context)) || !["fast-food", "delivery", "activity", "purchase"].includes(context.templateKey))
    throw new TypeError("COMPOSER_PRESET_CONTEXT_INVALID");
  if (isPurchaseBasket(context)) throw new TypeError("PURCHASE_BASKET_OWNER_REQUIRED");
  if (state.preferences.anchors.includes(context.contextOccurrenceId) || state.preferences.flexibility[context.contextOccurrenceId] === "PRESERVE")
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const shape = guidedContextShape(context.templateKey), fields = { ...context.fields }, slots = { ...context.slotSelections };
  const service = isServiceContext(context);
  const allowedFields = ["label", "plannedDate", "placeRef", ...(context.templateKey === "activity" ? ["plannedTime"] : []),
    ...(service ? SERVICE_FIELDS : []),
    ...(shape.participants ? ["participantRefs"] : ["budgetDomain", "productLabel", "merchantLabel"])];
  for (const [key, value] of Object.entries(edit.fields ?? {})) {
    if (!allowedFields.includes(key)) throw new TypeError("COMPOSER_PRESET_FIELD_INVALID");
    if (key === "appointmentIntent" && value !== "" && value !== null && value !== "CONSIDERING")
      throw new TypeError("COMPOSER_SERVICE_APPOINTMENT_INVALID");
    const next = key === "plannedTime" ? parseOutingTime(value) : value;
    if (next === "" || next === null && (key === "plannedTime" || SERVICE_FIELDS.some(field => field === key))) delete fields[key]; else fields[key] = next;
  }
  for (const [key, items] of Object.entries(edit.slots ?? {})) {
    if (![shape.slot, "extras", ...(shape.transport ? ["transport"] : [])].includes(key) || !Array.isArray(items)
      || key !== "extras" && items.length > 1
      || items.some(item => key === "transport" ? item.kind !== "MOBILITY_INTENT"
        : item.kind !== "COMPONENT" || item.optionKey !== (key === "extras" ? "extra" : shape.option)))
      throw new TypeError("COMPOSER_PRESET_SLOT_INVALID");
    if (service && key === "main") {
      const before = (slots.main?.items ?? []) as readonly ComponentSelectionV1[];
      const prior = before.find(item => item.kind === "COMPONENT");
      if (prior && items[0]?.selectionId !== prior.selectionId) throw new TypeError("COMPOSER_SERVICE_POST_CHANGED");
      if (prior) {
        const ref = componentId(context.contextOccurrenceId, key, prior.selectionId);
        if ((state.preferences.anchors.includes(ref) || state.preferences.flexibility[ref] === "PRESERVE")
          && plannerDigest(prior) !== plannerDigest(items[0])) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      }
    }
    slots[key] = { ...slots[key], items };
  }
  return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c === context ? { ...c, fields, slotSelections: slots } : c) });
}
