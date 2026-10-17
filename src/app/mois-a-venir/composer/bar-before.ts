import type { PlanSemanticStateV1, PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { barItems } from "./bar-living-operations";

/** View of the existing NightOutBeforeEdit owner, without flattening its child. */
export function barBefore(state: PlanSemanticStateV1, parent: PlannedContextState) {
  const link = barItems(parent, "before")[0];
  if (link?.kind !== "CHILD_CONTEXT") return null;
  const child = state.contexts.find(c => c.contextOccurrenceId === link.childContextOccurrenceId);
  const main = child && barItems(child, "main");
  if (child?.templateKey !== "activity" || child.parentContextOccurrenceId !== parent.contextOccurrenceId
    || main?.length !== 1 || main[0]?.kind !== "COMPONENT") return null;
  return { link, child, bottle: main[0], extras: barItems(child, "extras") };
}
export function barBeforePatch(state: PlanSemanticStateV1, parent: PlannedContextState,
  bottle: ComponentSelectionV1, extras: readonly ComponentSelectionV1[]): ComposerOperation {
  const before = barBefore(state, parent);
  if (!before && barItems(parent, "before").length) throw Error("Ce Before utilise un ancien format. Ses choix restent conservés dans l’éditeur détaillé.");
  return { kind: "EDIT_NIGHT_OUT", edit: { contextOccurrenceId: parent.contextOccurrenceId, fields: {}, before: {
    childContextOccurrenceId: before?.child.contextOccurrenceId ?? crypto.randomUUID(),
    selectionId: before?.link.selectionId ?? crypto.randomUUID(), bottle, extras } } };
}
