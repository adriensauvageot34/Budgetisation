import { plannerDigest } from "./json";
import type { PlanSemanticStateV1, PlannedContextState } from "./semantic-state";

/** A project's evidence includes its child relations and every linked intention. */
export function contextFingerprints(state: PlanSemanticStateV1): Readonly<Record<string, string>> {
  const children = new Map<string, PlannedContextState[]>();
  for (const item of state.contexts) {
    if (!item.parentContextOccurrenceId) continue;
    const group = children.get(item.parentContextOccurrenceId);
    if (group) group.push(item);
    else children.set(item.parentContextOccurrenceId, [item]);
  }
  const digests: Record<string, string> = {};
  function visit(item: PlannedContextState): string {
    const id = item.contextOccurrenceId;
    return digests[id] ??= plannerDigest({
      item, children: (children.get(id) ?? []).map(visit),
    });
  }
  for (const item of state.contexts) visit(item);
  return digests;
}
