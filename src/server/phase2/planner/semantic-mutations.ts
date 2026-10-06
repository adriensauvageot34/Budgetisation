import "server-only";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { setContextSlotSelections, reparentContext } from "./context-state";
import { validateContextGraph } from "./context-selections";

/** Stable decision identity across speculative previews; Context identity stays user supplied. */
function decisionId(month: string, slot: string) {
  const h = plannerDigest({ owner: "planner-headless-control", month, slot });
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function mutatePlanSemanticState(raw: PlanSemanticStateV1, mutation: SemanticMutation): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw);
  if (mutation.kind === "PATCH_CONTEXT") return setContextSlotSelections(state, mutation.contextOccurrenceId, mutation.slotKey, mutation.items);
  if (mutation.kind === "REPARENT_CONTEXT") return reparentContext(state, mutation.contextOccurrenceId, mutation.parentContextOccurrenceId, mutation.slotKey, mutation.selectionId);
  if (mutation.kind === "ATTACH_CONTEXT") return reparentContext(parsePlanSemanticState({ ...state,
    contexts: [...state.contexts, { ...mutation.context, parentContextOccurrenceId: null }] }),
    mutation.context.contextOccurrenceId, mutation.parentContextOccurrenceId, mutation.slotKey, mutation.selectionId);
  let next = state;
  if (mutation.kind === "SET_STATE") {
    const prior = state.controls.find(c => c.decisionSlotKey === mutation.targetRef);
    next = { ...state, controls: [...state.controls.filter(c => c !== prior), { decisionId: prior?.decisionId ?? decisionId(state.targetMonth, mutation.targetRef),
      decisionSlotKey: mutation.targetRef, kind: "SET_STATE", value: mutation.value, provenance: "EXPLICIT_USER_DECISION" }] };
  } else if (mutation.kind === "ADD_CONTEXT") {
    next = { ...state, contexts: [...state.contexts, mutation.context] };
  } else if (mutation.kind === "REMOVE_CONTEXT") {
    if (!state.contexts.some(c => c.contextOccurrenceId === mutation.contextOccurrenceId)) throw new TypeError("CONTEXT_REMOVAL_TARGET_UNKNOWN");
    const removed = new Set([mutation.contextOccurrenceId]);
    for (let size = -1; size !== removed.size;) {
      size = removed.size;
      for (const c of state.contexts) if (c.parentContextOccurrenceId && removed.has(c.parentContextOccurrenceId)) removed.add(c.contextOccurrenceId);
    }
    const graph = validateContextGraph(state);
    next = { ...state, contexts: state.contexts.filter(c => !removed.has(c.contextOccurrenceId)).map(c => ({
      ...c, slotSelections: Object.fromEntries([...(graph.selections.get(c.contextOccurrenceId) ?? [])].map(([key, items]) =>
        [key, { items: items.filter(i => i.kind !== "CHILD_CONTEXT" || !removed.has(i.childContextOccurrenceId)) }])) })),
      preferences: { ...state.preferences, anchors: state.preferences.anchors.filter(a => !removed.has(a)),
        flexibility: Object.fromEntries(Object.entries(state.preferences.flexibility).filter(([ref]) => !removed.has(ref))) } };
  } else throw new TypeError("PLANNER_MUTATION_UNSUPPORTED");
  const parsed = parsePlanSemanticState(next); validateContextGraph(parsed); return parsed;
}
