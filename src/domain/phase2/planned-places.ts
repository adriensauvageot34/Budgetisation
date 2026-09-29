import type { PlannedExpenseFamily } from "./planned-assets";

export type PlannedPlaceOption = Readonly<{ placeId: string; name: string; commune: string | null;
  nature: string | null; usage: string | null; subtype: string | null; privatePlace: boolean;
  relationships: readonly { personName: string; role: string }[] }>;

/** Suggestions use canonical place metadata and demonstrated household relationships. */
export function placesForPlannedContext(places: readonly PlannedPlaceOption[], family: PlannedExpenseFamily,
  subtype: string | null, visitedLabel?: string): PlannedPlaceOption[] {
  if (family === "visit_trip" && subtype === "family_visit") {
    const rule = visitedLabel === "Père de Manon" ? { name: "Manon", role: "FATHER_HOME" }
      : visitedLabel === "Mère de Manon" || visitedLabel === "Grands-parents de Manon"
        ? { name: "Manon", role: "MATERNAL_FAMILY_HOME" } : null;
    return rule ? places.filter((place) => place.relationships.some((relation) => relation.personName === rule.name
      && relation.role === rule.role)) : [];
  }
  if (family === "visit_trip" && subtype === "friend_visit") return [];
  return places.filter((place) => {
    if (place.privatePlace) return false;
    const usage = place.usage ?? "";
    const nature = place.nature ?? "";
    const kind = place.subtype ?? "";
    if (family === "food" && subtype === "groceries") return usage === "Courses";
    if (family === "food" && subtype === "work_meal") return !!visitedLabel && place.relationships.some((relation) =>
      relation.personName === visitedLabel && relation.role === "WORK_MEAL_ANCHOR");
    if (family === "food" && subtype === "fast_food") return /Restaurant/u.test(usage) && /Restauration|emporter|restaurant/iu.test(kind);
    if (family === "food" && subtype === "restaurant") return /Restaurant/u.test(usage) && !/non identifié/iu.test(kind);
    if (family === "outing" && subtype === "bar") return /Bar/u.test(usage) && !/club|boîte de nuit/iu.test(kind);
    if (family === "outing" && subtype === "club_festival") return /club|boîte de nuit|festival|arena/iu.test(kind);
    if (family === "visit_trip") return /Ville|territoire/u.test(nature) || /Séjour|voyage/u.test(usage);
    if (family === "activity") return /Loisir|événement/u.test(usage) || /loisir|événement/iu.test(nature);
    if (family === "purchase") return /Shopping|Soins personnels/u.test(usage);
    return false;
  });
}
