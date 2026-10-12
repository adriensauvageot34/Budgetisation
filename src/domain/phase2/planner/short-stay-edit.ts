import { parsePlanSemanticState, type PlanSemanticStateV1, type PlannedContextState } from "./semantic-state";
import { plannerDigest, type PlannerJson } from "./json";
import type { ComponentSelectionV1 } from "./component-contract";

export type ShortStayEdit = Readonly<{ contextOccurrenceId: string; fields: Readonly<Record<string, PlannerJson>>;
  slots?: Readonly<Partial<Record<"lodging" | "groceries" | "restaurants" | "activities" | "purchases" | "extras", readonly ComponentSelectionV1[]>>>;
  children?: readonly PlannedContextState[];
  transport?: Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }> | null }>;

/** One partial semantic edit. Children keep their identities and may only belong to this stay. */
export function editShortStay(raw: PlanSemanticStateV1, edit: ShortStayEdit): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), parent = state.contexts.find(c => c.contextOccurrenceId === edit.contextOccurrenceId);
  if (parent?.templateKey !== "short-stay") throw new TypeError("COMPOSER_SHORT_STAY_TARGET_INVALID");
  const protectedContext = (id: string) => state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE";
  if (protectedContext(parent.contextOccurrenceId)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const fields = { ...parent.fields };
  for (const [key, value] of Object.entries(edit.fields)) {
    if (!["label", "plannedDate", "endDate", "participantRefs", "destinationRef", "nightCount", "lodgingKind", "timingNote"].includes(key))
      throw new TypeError("COMPOSER_SHORT_STAY_FIELD_INVALID");
    if (value === "") delete fields[key]; else fields[key] = value;
  }
  fields.fieldSchemaVersion = "context-fields@v5";
  const slots = { ...parent.slotSelections };
  for (const [key, items] of Object.entries(edit.slots ?? {})) {
    if (!["lodging", "groceries", "restaurants", "activities", "purchases", "extras"].includes(key) || !Array.isArray(items))
      throw new TypeError("COMPOSER_SHORT_STAY_SLOT_INVALID");
    slots[key] = { items };
  }
  if (edit.transport !== undefined) slots.transport = { items: edit.transport ? [edit.transport] : [] };
  const childIds = (value: PlannedContextState["slotSelections"]) => Object.values(value).flatMap(s => Array.isArray(s.items)
    ? s.items.flatMap(i => i && typeof i === "object" && !Array.isArray(i) && i.kind === "CHILD_CONTEXT" ? [String(i.childContextOccurrenceId)] : []) : []);
  const remaining = new Set(childIds(slots));
  const removed = new Set(childIds(parent.slotSelections).filter(id => !remaining.has(id)));
  for (let size = -1; size !== removed.size;) {
    size = removed.size;
    for (const c of state.contexts) if (c.parentContextOccurrenceId && removed.has(c.parentContextOccurrenceId)) removed.add(c.contextOccurrenceId);
  }
  if ([...removed].some(protectedContext)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const children = edit.children ?? [];
  if (new Set(children.map(c => c.contextOccurrenceId)).size !== children.length) throw new TypeError("COMPOSER_SHORT_STAY_CHILD_INVALID");
  for (const child of children) {
    const old = state.contexts.find(c => c.contextOccurrenceId === child.contextOccurrenceId);
    if (!remaining.has(child.contextOccurrenceId) || child.parentContextOccurrenceId !== parent.contextOccurrenceId
      || old && (old.parentContextOccurrenceId !== parent.contextOccurrenceId || old.templateKey !== child.templateKey))
      throw new TypeError("COMPOSER_SHORT_STAY_CHILD_INVALID");
    if (old && protectedContext(old.contextOccurrenceId) && plannerDigest(child) !== plannerDigest(old)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  }
  const contexts = state.contexts.filter(c => !removed.has(c.contextOccurrenceId)).map(c => c.contextOccurrenceId === parent.contextOccurrenceId
    ? { ...c, fields, slotSelections: slots } : children.find(child => child.contextOccurrenceId === c.contextOccurrenceId) ?? c);
  contexts.push(...children.filter(c => !state.contexts.some(old => old.contextOccurrenceId === c.contextOccurrenceId)));
  return parsePlanSemanticState({ ...state, contexts });
}
