import "server-only";
import { parsePlannerJsonObject, plannerString } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1, PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { resolveContextTemplate } from "./context-registry";
import { validateContextGraph } from "./context-selections";

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
