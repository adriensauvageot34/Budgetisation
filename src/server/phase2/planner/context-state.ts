import "server-only";
import { parsePlannerJsonObject, plannerKeys, plannerRecord, plannerString } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1, PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { plannedAsset, type PlannedAssetRef } from "@/domain/phase2/planned-assets";
import { isLegacyContextField, resolveContextTemplate } from "./context-registry";
import { parseContextField, validateContextGraph } from "./context-selections";

const children = (items: readonly ComponentSelectionV1[]): string[] => items.flatMap(item => item.kind === "CHILD_CONTEXT" ? [item.childContextOccurrenceId] : []);
function prune(contexts: readonly PlannedContextState[], removedIds: readonly string[]): PlannedContextState[] {
  const removed = new Set(removedIds);
  for (let size = -1; size !== removed.size;) {
    size = removed.size;
    for (const context of contexts) if (context.parentContextOccurrenceId && removed.has(context.parentContextOccurrenceId)) removed.add(context.contextOccurrenceId);
  }
  return contexts.filter(context => !removed.has(context.contextOccurrenceId));
}
const finish = (state: PlanSemanticStateV1): PlanSemanticStateV1 => {
  const parsed = parsePlanSemanticState(state); validateContextGraph(parsed); return parsed;
};
/** Semantic editor view only: no hover, canvas coordinates, wizard navigation or computed totals. */
export function readContextEditorPayload(raw: PlanSemanticStateV1, contextId: string) {
  const state = finish(raw), context = state.contexts.find(item => item.contextOccurrenceId === contextId);
  if (!context) throw new TypeError("CONTEXT_EDIT_TARGET_UNKNOWN");
  return { contextOccurrenceId: context.contextOccurrenceId, templateKey: context.templateKey,
    parentContextOccurrenceId: context.parentContextOccurrenceId ?? null, fieldSchemaVersion: context.fields.fieldSchemaVersion ?? null,
    provenance: context.provenance, fields: structuredClone(context.fields), slotSelections: structuredClone(context.slotSelections) };
}
/** Explicit partial patch. Omitted keys survive; null remains unknown; an empty UI string clears. */
export function patchContextEditorFields(raw: PlanSemanticStateV1, contextId: string, rawPatch: unknown): PlanSemanticStateV1 {
  const state = finish(raw), context = state.contexts.find(item => item.contextOccurrenceId === contextId);
  if (!context) throw new TypeError("CONTEXT_EDIT_TARGET_UNKNOWN");
  const template = resolveContextTemplate(context.templateKey), patch = plannerRecord(rawPatch);
  plannerKeys(patch, template.fields.filter(field => field.fieldKey !== "fieldSchemaVersion").map(field => field.fieldKey), []);
  const fields = { ...context.fields };
  for (const [key, value] of Object.entries(patch)) {
    const definition = template.fields.find(field => field.fieldKey === key)!;
    if (value === undefined) throw new TypeError("CONTEXT_FIELD_UNDEFINED");
    if (value === "") delete fields[key];
    else if (value === null) fields[key] = null;
    else {
      const parsed = parseContextField(value, definition, state.targetMonth);
      if (key === "objectAssetRef" && parsed !== null) {
        const ref = parsed as PlannedAssetRef;
        const asset = plannedAsset(ref.assetKey);
        if (context.templateKey !== "gift" || asset?.module !== "gift" || asset.label !== ref.labelAtSelection)
          throw new TypeError("CONTEXT_GIFT_ASSET_UNKNOWN");
      }
      fields[key] = parsePlannerJsonObject({ value: parsed }).value;
    }
  }
  const rich = Object.keys(fields).some(key => !isLegacyContextField(context.templateKey, key));
  if (context.fields.fieldSchemaVersion === "context-fields@v3" || Object.hasOwn(fields, "objectAssetRef"))
    fields.fieldSchemaVersion = "context-fields@v3";
  else if (rich) fields.fieldSchemaVersion = "context-fields@v2";
  return finish({ ...state, contexts: state.contexts.map(item => item.contextOccurrenceId === contextId
    ? { ...item, fields } : item) });
}
function withItems(context: PlannedContextState, slotKey: string, items: readonly ComponentSelectionV1[]): PlannedContextState {
  return { ...context, slotSelections: { ...context.slotSelections, [slotKey]: parsePlannerJsonObject({ items }) } };
}
/** A ONE_OF state is replaced, never appended. Replaced child intentions leave with their subtree. */
export function setContextSlotSelections(raw: PlanSemanticStateV1, contextId: string, slotKey: string,
  items: readonly ComponentSelectionV1[]): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), graph = validateContextGraph(state);
  const context = state.contexts.find(c => c.contextOccurrenceId === contextId);
  if (!context || !resolveContextTemplate(context.templateKey).componentSlots.some(s => s.slotKey === slotKey)) throw new TypeError("CONTEXT_SLOT_UNKNOWN");
  const before = graph.selections.get(contextId)!.get(slotKey)!;
  const keep = new Set(children(items)), removed = children(before).filter(id => !keep.has(id));
  const contexts = prune(state.contexts.map(c => c.contextOccurrenceId === contextId ? withItems(c, slotKey, items) : c), removed);
  return finish({ ...state, contexts });
}
export function acceptContextSuggestion(raw: PlanSemanticStateV1, contextId: string, slotKey: string, selectionId: string): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), graph = validateContextGraph(state);
  const items = graph.selections.get(contextId)?.get(slotKey);
  if (!items?.some(item => item.selectionId === selectionId && item.provenance === "PERSONAL_SUGGESTION")) throw new TypeError("CONTEXT_SUGGESTION_MISSING");
  return setContextSlotSelections(state, contextId, slotKey, items.map(item => item.selectionId === selectionId ? { ...item, provenance: "EXPLICIT_USER_DECISION" } : item));
}
export function reparentContext(raw: PlanSemanticStateV1, childId: string, parentId: string, slotKey: string, selectionId: string): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), graph = validateContextGraph(state);
  const child = state.contexts.find(c => c.contextOccurrenceId === childId), parent = state.contexts.find(c => c.contextOccurrenceId === parentId);
  const slot = parent && resolveContextTemplate(parent.templateKey).componentSlots.find(s => s.slotKey === slotKey);
  if (!child || !parent || !slot?.allowedChildTemplates.includes(child.templateKey)) throw new TypeError("CONTEXT_CHILD_CAPABILITY_FORBIDDEN");
  plannerString(selectionId);
  let contexts = state.contexts.map(context => {
    if (context.contextOccurrenceId === childId) return { ...context, parentContextOccurrenceId: parentId };
    let next = context;
    for (const [key, items] of graph.selections.get(context.contextOccurrenceId) ?? []) if (children(items).includes(childId))
      next = withItems(next, key, items.filter(item => item.kind !== "CHILD_CONTEXT" || item.childContextOccurrenceId !== childId));
    return next;
  });
  const prior = graph.selections.get(parentId)!.get(slotKey)!.filter(item => item.kind !== "CHILD_CONTEXT" || item.childContextOccurrenceId !== childId);
  const item: ComponentSelectionV1 = { selectionId, optionKey: child.templateKey, kind: "CHILD_CONTEXT", childContextOccurrenceId: childId, provenance: "EXPLICIT_USER_DECISION" };
  const items = slot.cardinality === "REPEATING" ? [...prior, item] : [item];
  const removed = slot.cardinality === "REPEATING" ? [] : children(prior);
  contexts = prune(contexts.map(c => c.contextOccurrenceId === parentId ? withItems(c, slotKey, items) : c), removed);
  return finish({ ...state, contexts });
}
/** Promotion exchanges the placeholder for a socket reference in one semantic transformation. */
export function promoteComponentToChildContext(raw: PlanSemanticStateV1, parentId: string, slotKey: string,
  selectionId: string, newChild: PlannedContextState): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw), graph = validateContextGraph(state);
  if (state.contexts.some(c => c.contextOccurrenceId === newChild.contextOccurrenceId)) throw new TypeError("CONTEXT_PROMOTION_ID_EXISTS");
  const parent = state.contexts.find(c => c.contextOccurrenceId === parentId), items = graph.selections.get(parentId)?.get(slotKey);
  const slot = parent && resolveContextTemplate(parent.templateKey).componentSlots.find(s => s.slotKey === slotKey);
  if (!slot?.allowedChildTemplates.includes(newChild.templateKey) || !items?.some(item => item.selectionId === selectionId && ["COMPONENT", "UNRESOLVED"].includes(item.kind)))
    throw new TypeError("CONTEXT_PROMOTION_CAPABILITY_FORBIDDEN");
  const replacement: ComponentSelectionV1 = { selectionId, optionKey: newChild.templateKey, kind: "CHILD_CONTEXT",
    childContextOccurrenceId: newChild.contextOccurrenceId, provenance: "EXPLICIT_USER_DECISION" };
  return finish({ ...state, contexts: [...state.contexts.map(c => c.contextOccurrenceId === parentId
    ? withItems(c, slotKey, items.map(item => item.selectionId === selectionId ? replacement : item)) : c), { ...newChild, parentContextOccurrenceId: parentId }] });
}
