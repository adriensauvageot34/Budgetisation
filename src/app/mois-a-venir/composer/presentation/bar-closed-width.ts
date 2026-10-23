import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { componentPresentationGroups } from "@/domain/phase2/planner/component-group-presentation";
import { nightOutDirectSelectionId } from "@/domain/phase2/planner/night-out-consumption";
import { barBefore } from "../bar-before";

/** Preferred envelope of the EXISTING closed rail, not another layout engine.
 * Match its 132px tiles, 7px gaps, 34px counter, 10px moment gaps and 24px
 * outer padding/borders. A single moment scrolls; metadata never sets width.
 * The Board packer still owns track rounding and the available-width clamp. */
export function barClosedWidth(card: ComposerContextCardView, model: ComposerUiModel) {
  const semantic = model.semanticState.contexts.find(c => c.contextOccurrenceId === card.contextOccurrenceId);
  const before = semantic && barBefore(model.semanticState, semantic);
  const direct = semantic && nightOutDirectSelectionId(semantic);
  const counts = [
    ...(before ? [componentPresentationGroups([before.bottle, ...before.extras]).length] : []),
    ...["extras", "food", "main", "before"].flatMap(slot => {
      if (slot === "before" && before) return [];
      const items = card.sockets.find(s => s.slotKey === slot)?.currentItems.filter(i =>
        (i.kind === "COMPONENT" || i.kind === "CHILD_CONTEXT") && i.selectionId !== direct) ?? [];
      return items.length ? [componentPresentationGroups(items).length] : [];
    }),
  ];
  const rail = counts.length > 1 ? counts.reduce((sum, count) =>
    sum + Math.min(2, count) * 132 + Math.max(0, Math.min(2, count) - 1) * 7 + (count > 2 ? 41 : 0), 0)
    + (counts.length - 1) * 10 + 24 : 350;
  const routes = card.sockets.filter(s => ["outbound", "return"].includes(s.slotKey)
    && s.currentItems.some(i => i.kind === "MOBILITY_INTENT")).length;
  // Closed cards round to the nearest Board track (rather than up). Reserve
  // half a track, bounded at 45px for shelves wide enough to fit this rail,
  // so that rounding down cannot hide the last tile. Narrow shelves scroll.
  return Math.max(350, rail + (counts.length > 1 ? 45 : 0), routes > 1 ? 580 : 0);
}
