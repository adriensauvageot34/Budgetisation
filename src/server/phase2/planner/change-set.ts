import "server-only";
import { plannerDigest, type PlannerJsonObject } from "@/domain/phase2/planner/json";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { jsonEnvelope } from "./compiler";

/** Revision state is normalized. Cancellation is history, never an inactive Context fact. */
export function revisionChangeSet(previous: PlanSemanticStateV1, next: PlanSemanticStateV1): PlannerJsonObject[] {
  const changes: PlannerJsonObject[] = [];
  for (const old of previous.contexts) if (!next.contexts.some(c => c.contextOccurrenceId === old.contextOccurrenceId))
    changes.push({ kind: "CANCEL_CONTEXT", contextOccurrenceId: old.contextOccurrenceId });
  for (const context of next.contexts) {
    const old = previous.contexts.find(c => c.contextOccurrenceId === context.contextOccurrenceId);
    if (!old || plannerDigest(old) !== plannerDigest(context)) changes.push(jsonEnvelope({
      kind: old ? "PATCH_CONTEXT" : "ADD_CONTEXT", contextOccurrenceId: context.contextOccurrenceId, context }));
  }
  for (const control of next.controls) if (plannerDigest(control) !== plannerDigest(previous.controls.find(c => c.decisionSlotKey === control.decisionSlotKey) ?? null))
    changes.push(jsonEnvelope(control));
  for (const control of previous.controls) if (!next.controls.some(c => c.decisionSlotKey === control.decisionSlotKey))
    changes.push({ kind: "RESET_STATE", decisionSlotKey: control.decisionSlotKey });
  if (plannerDigest(previous.preferences) !== plannerDigest(next.preferences)) changes.push(jsonEnvelope({ kind: "SET_PREFERENCES", preferences: next.preferences }));
  // C0 caps the outer log at 500 entries. Batch a large normalized revision
  // without truncating its controls or cancellation history.
  if (changes.length <= 500) return changes;
  return Array.from({ length: Math.ceil(changes.length / 500) }, (_, index) =>
    ({ kind: "SEMANTIC_CHANGE_BATCH", changes: changes.slice(index * 500, (index + 1) * 500) }));
}
