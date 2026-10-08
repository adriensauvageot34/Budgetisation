import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";

export type ContextDisplayPhase = "REST" | "SELECTED" | "DRAGGING";

// Presentation priority only. The published socket/options catalogue is never filtered.
const preferred: Readonly<Record<string, readonly string[]>> = {
  "night-out": ["food", "return", "extras", "before", "main", "outbound"],
  "short-stay": ["purchases", "restaurants", "activities", "transport", "groceries", "lodging"],
};

export function visibleEmptySocketKeys(card: ComposerContextCardView, model: ComposerUiModel,
  phase: ContextDisplayPhase, draggedAssetKey: string | null = null): ReadonlySet<string> {
  if (phase === "REST") return new Set();
  if (phase === "DRAGGING") return new Set(card.sockets.filter(socket => model.dropCapabilities.some(capability =>
    capability.sourceAssetKey === draggedAssetKey && capability.target.kind === "CONTEXT_SOCKET"
    && capability.target.contextOccurrenceId === card.contextOccurrenceId && capability.target.slotKey === socket.slotKey
    && capability.resolution !== "BLOCKED")).map(socket => socket.slotKey));
  const order = preferred[card.templateKey] ?? [];
  const candidates = card.sockets.filter(socket => {
    const view = model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`];
    return view?.canAdd && (socket.cardinality === "REPEATING" || view.satellites.length === 0);
  });
  candidates.sort((a, b) => {
    const aPriority = order.indexOf(a.slotKey), bPriority = order.indexOf(b.slotKey);
    return (aPriority < 0 ? 100 : aPriority) - (bPriority < 0 ? 100 : bPriority) || a.slotKey.localeCompare(b.slotKey);
  });
  return new Set(candidates.slice(0, 2).map(socket => socket.slotKey));
}
