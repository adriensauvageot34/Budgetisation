import type { PlaceRole } from "./planned-contract";

export type PlannedPlaceFacts = Readonly<{ nature: string | null; usage: string | null;
  subtype: string | null; privatePlace: boolean;
  relationships?: readonly { personName: string; role: string }[] }>;
type Rule = Readonly<{ field: "nature" | "usage" | "subtype"; pattern: RegExp; add: readonly PlaceRole[] }>;

// Derive prospective roles from canonical metadata; this is not a new historical place ontology.
export const PLACE_ROLE_RULES: readonly Rule[] = [
  { field: "usage", pattern: /^Courses$/iu, add: ["GROCERY"] },
  { field: "usage", pattern: /Restaurant/iu, add: ["RESTAURANT"] },
  { field: "subtype", pattern: /Restauration rapide|fast.food|à emporter|snack/iu, add: ["FAST_FOOD"] },
  { field: "usage", pattern: /Bar/iu, add: ["BAR"] },
  { field: "subtype", pattern: /club|boîte de nuit|festival|arena/iu, add: ["NIGHT_OUT"] },
  { field: "usage", pattern: /Soins personnels|Beauté/iu, add: ["BEAUTY_RETAIL"] },
  { field: "subtype", pattern: /Parfumerie|Cosmétique|maquillage/iu, add: ["BEAUTY_RETAIL"] },
  { field: "subtype", pattern: /Pharmacie/iu, add: ["PHARMACY"] },
  { field: "subtype", pattern: /Coiffeur|Salon de coiffure/iu, add: ["HAIRDRESSER"] },
  { field: "subtype", pattern: /Droguerie|Produits ménagers/iu, add: ["HOUSEHOLD_RETAIL"] },
  { field: "subtype", pattern: /Bricolage|Ameublement|Équipement maison/iu, add: ["HOME_EQUIPMENT"] },
  { field: "subtype", pattern: /Vêtement|Habillement|Prêt-à-porter/iu, add: ["CLOTHING_RETAIL"] },
  { field: "subtype", pattern: /Électronique|Informatique|Téléphonie/iu, add: ["TECH_RETAIL"] },
  { field: "subtype", pattern: /Garage|Automobile|Pièces auto/iu, add: ["AUTO_RETAIL_SERVICE"] },
  { field: "usage", pattern: /Loisir|événement|Activité/iu, add: ["ACTIVITY"] },
  { field: "nature", pattern: /Loisir|événement/iu, add: ["ACTIVITY"] },
  { field: "usage", pattern: /^Ami$/iu, add: ["FRIEND_HOME"] },
  { field: "usage", pattern: /^Famille$/iu, add: ["FAMILY_PLACE"] },
  { field: "nature", pattern: /Centre commercial|Zone commerciale/iu, add: ["SHOPPING_AREA"] },
  { field: "nature", pattern: /Ville|territoire|destination/iu, add: ["TRAVEL_DESTINATION"] },
  { field: "usage", pattern: /Séjour|voyage/iu, add: ["TRAVEL_DESTINATION"] },
  { field: "nature", pattern: /Gare|Aéroport|Station de bus/iu, add: ["TRANSPORT_HUB"] },
];

export function derivePlannedPlaceRoles(place: PlannedPlaceFacts): readonly PlaceRole[] {
  const roles = new Set<PlaceRole>();
  for (const rule of PLACE_ROLE_RULES) if (rule.pattern.test(place[rule.field] ?? ""))
    for (const role of rule.add) roles.add(role);
  if (place.relationships?.some((relation) => relation.role === "PRIMARY_HOME" || relation.role === "HOUSEHOLD_HOME"))
    roles.add("OWN_HOME");
  if (place.privatePlace) for (const role of [...roles])
    if (role !== "OWN_HOME" && role !== "FAMILY_PLACE" && role !== "FRIEND_HOME") roles.delete(role);
  return [...roles];
}
