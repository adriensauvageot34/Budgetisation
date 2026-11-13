import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { componentId, mobilityIntentId } from "@/domain/phase2/planner/identity";

/** Follow exact published references. Global and sibling diagnostics stay outside this intention. */
export function intentDiagnostics(model: ComposerUiModel, contextId: string) {
  const card = model.board.contexts.find(card => card.contextOccurrenceId === contextId);
  if (!card) return [];
  const refs = new Set([contextId]);
  if (model.semanticState.contexts.some(context => context.contextOccurrenceId === contextId)) {
    for (const socket of card.sockets) for (const item of socket.currentItems) {
      refs.add(componentId(contextId, socket.slotKey, item.selectionId));
      if (item.kind === "MOBILITY_INTENT") refs.add(mobilityIntentId(contextId, socket.slotKey));
    }
    for (const summary of model.mobilitySummaries ?? []) if (summary.contextOccurrenceId === contextId) refs.add(summary.journeyId);
  }
  const seen = new Set<string>();
  return model.board.diagnostics.filter(diagnostic => {
    const key = JSON.stringify([diagnostic.code, diagnostic.targetRef, diagnostic.message]);
    if (!diagnostic.targetRef || !refs.has(diagnostic.targetRef) || diagnostic.severity === "INFO" || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
