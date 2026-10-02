import { PLANNED_EXPENSE_SUBTYPES, type PlannedAsset } from "./planned-assets";
import type { PlannedPlaceOption } from "./planned-places";
import { ACTIVITY_PLACE_HINTS } from "./planned-rules";
import type { PlannedExpenseDraft } from "./planned-contract";
/** Only an existing explicit prospective event supplies dates. A place name never does. */
export function projectEventCandidates(projects: readonly { id: string; draft: PlannedExpenseDraft; status: string }[], query: string, editedId?: string | null) {
  return projects.filter(p => p.id !== editedId && p.status === "PLANNED" && p.draft.plannedDate
    && (p.draft.context.project?.entity?.kind === "EVENT" || p.draft.context.outingKind === "EVENT")
    && (p.draft.context.project?.entity?.label ?? p.draft.context.eventName ?? p.draft.title).toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
}
/** Explicit provider taxonomy / canonical subtype, never a fuzzy name match. */
export function inferredActivitySubtype(place: Pick<PlannedPlaceOption, "subtype" | "nature"> | { types: readonly string[] }): string | undefined {
  if ("types" in place) return place.types.map(t => ({ movie_theater: "cinema", bowling_alley: "bowling", spa: "spa",
    amusement_park: "theme_park", stadium: "match", performing_arts_theater: "show" } as Record<string, string>)[t]).find(Boolean);
  if (PLANNED_EXPENSE_SUBTYPES.activity.includes(place.subtype as typeof PLANNED_EXPENSE_SUBTYPES.activity[number])) return place.subtype!;
  return Object.entries(ACTIVITY_PLACE_HINTS).find(([, hint]) => hint.test(`${place.subtype ?? ""} ${place.nature ?? ""}`))?.[0];
}
export function purchaseSubtypeForAsset(asset: PlannedAsset): string | undefined {
  return ({ beauty: "beauty", clothing: "clothing", home: "home_equipment", gift: "gift", tech: "tech", automotive: "automotive", other: "other_purchase" } as Record<string, string>)[asset.module];
}
