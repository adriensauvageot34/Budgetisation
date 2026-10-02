import type { PlannedExpenseDraft, PlannedProjectContext } from "./planned-contract";

/** A place identity, never a disposable media URL. Restaurant is the first supported consumer. */
export function projectVisualPlaceId(draft: Pick<PlannedExpenseDraft, "familyKey" | "subtypeKey" | "context">): string | undefined {
  return draft.familyKey === "food" && draft.subtypeKey === "restaurant"
    ? draft.context.restaurant?.googlePlaceId ?? draft.context.project?.entity?.googlePlaceId : undefined;
}
export function compatibleProjectVisual(draft: Pick<PlannedExpenseDraft, "familyKey" | "subtypeKey" | "context">): PlannedProjectContext["visual"] {
  const visual = draft.context.project?.visual;
  return visual?.placeId === projectVisualPlaceId(draft) ? visual : undefined;
}
/** Changing/removing the venue cannot carry its previous image into the new project. Undo keeps the previous draft. */
export function invalidateProjectVisual(draft: PlannedExpenseDraft): PlannedExpenseDraft {
  if (!draft.context.project?.visual || compatibleProjectVisual(draft)) return draft;
  return { ...draft, context: { ...draft.context, project: { ...draft.context.project, visual: undefined } } };
}
