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

/** The activity's main slot is technical ownership, not a privileged bottle.
 * Promote the next real component atomically through the existing edit owner.
 * The caller confirms removal of the entire child when no component remains. */
export function barBeforeRemove(state: PlanSemanticStateV1, parent: PlannedContextState, selectionId: string): ComposerOperation {
  const before = barBefore(state, parent);
  if (!before) throw Error("Ce Before n’est plus disponible. Relisez la carte.");
  if (before.bottle.selectionId !== selectionId) {
    if (!before.extras.some(item => item.selectionId === selectionId)) throw Error("Ce poste n’existe plus.");
    return barBeforePatch(state, parent, before.bottle, before.extras.filter(item => item.selectionId !== selectionId));
  }
  const next = before.extras.find(item => item.kind === "COMPONENT");
  if (!next) throw Error("Confirmez le retrait du Before entier pour conserver la protection de ses liens.");
  return barBeforePatch(state, parent, { ...next, optionKey: "activity" }, before.extras.filter(item => item.selectionId !== next.selectionId));
}
