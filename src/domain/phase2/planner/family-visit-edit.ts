import { parsePlanSemanticState, type PlanSemanticStateV1 } from "./semantic-state";
import type { PlannerJson } from "./json";
import type { ComponentSelectionV1 } from "./component-contract";

export type FamilyVisitEdit = Readonly<{ contextOccurrenceId: string; fields: Readonly<Record<string, PlannerJson>>;
  /** Omission preserves the complete existing intent; null explicitly removes it. */
  transport?: Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }> | null }>;

/** One admitted semantic mutation shared by local staging and the server; no prices are calculated here. */
export function editFamilyVisit(raw: PlanSemanticStateV1, edit: FamilyVisitEdit): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), context = state.contexts.find(c => c.contextOccurrenceId === edit.contextOccurrenceId);
  if (context?.templateKey !== "family-visit") throw new TypeError("COMPOSER_FAMILY_VISIT_TARGET_INVALID");
  if (state.preferences.anchors.includes(context.contextOccurrenceId) || state.preferences.flexibility[context.contextOccurrenceId] === "PRESERVE")
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const fields = { ...context.fields };
  for (const [key, value] of Object.entries(edit.fields)) {
    if (!["label", "plannedDate", "endDate", "personVisitedRef", "participantRefs", "placeRef", "timingNote"].includes(key))
      throw new TypeError("COMPOSER_FAMILY_VISIT_FIELD_INVALID");
    if (value === "") delete fields[key]; else fields[key] = value;
  }
  fields.fieldSchemaVersion = "context-fields@v4";
  const slots = edit.transport === undefined ? context.slotSelections : { ...context.slotSelections,
    transport: { items: edit.transport === null ? [] : [edit.transport] } };
  return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c.contextOccurrenceId === context.contextOccurrenceId
    ? { ...c, fields, slotSelections: slots } : c) });
}
