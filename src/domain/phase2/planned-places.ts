import type { AssetModule } from "./planned-assets";
import type { PlaceRole } from "./planned-contract";
import { derivePlannedPlaceRoles } from "./planned-place-rules";
import { childPlaceRoles, SOCIAL_CONTACTS_V1, type ProspectiveContact,
  type ResolvedPlannedContext } from "./planned-rules";

export type PlannedPlaceOption = Readonly<{ placeId: string; name: string; commune: string | null;
  nature: string | null; usage: string | null; subtype: string | null; privatePlace: boolean;
  relationships: readonly { personName: string; role: string }[] }>;
export type RankedPlannedPlace = Readonly<{ place: PlannedPlaceOption; roles: readonly PlaceRole[];
  rankingTier: "PRIMARY" | "SECONDARY"; reason: "CONTACT_HOME" | "WORK_MEAL_ANCHOR" | "PLACE_ROLE" }>;

const contactByKey = (key: string | undefined): ProspectiveContact | undefined =>
  SOCIAL_CONTACTS_V1.find((contact) => contact.key === key);
export function placesForChildModule(places: readonly PlannedPlaceOption[], child: AssetModule): readonly PlannedPlaceOption[] {
  return places.filter((place) => !place.privatePlace && childPlaceRoles(child)
    .some((role) => derivePlannedPlaceRoles(place).includes(role))).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
const isContactHome = (candidate: PlannedPlaceOption, contact: ProspectiveContact | undefined): boolean => {
  if (!contact) return false;
  if (contact.places.some((link) => link.placeId === candidate.placeId)) return true;
  // Existing household relationship metadata is a proof only for this named contact.
  const familyRole = contact.key === "manon_father" ? "FATHER_HOME"
    : contact.key === "manon_mother" || contact.key === "manon_grandparents" ? "MATERNAL_FAMILY_HOME" : null;
  return !!familyRole && candidate.relationships.some((relation) => relation.personName === "Manon"
    && relation.role === familyRole);
};

export function rankPlacesForPlannedContext(places: readonly PlannedPlaceOption[],
  resolved: ResolvedPlannedContext, options: Readonly<{ contactKey?: string; workMealPersonName?: string;
    giftAssetKey?: string; assetKeys?: readonly string[] }> = {}): readonly RankedPlannedPlace[] {
  const contact = contactByKey(options.contactKey);
  const giftRoles: readonly PlaceRole[] = resolved.place.source !== "DYNAMIC_GIFT" ? []
    : options.giftAssetKey === "gift:chocolate" ? ["GROCERY"]
      : options.giftAssetKey === "gift:clothes" || options.giftAssetKey === "gift:jewelry"
        ? ["CLOTHING_RETAIL", "SHOPPING_AREA"]
        : options.giftAssetKey === "gift:flowers" ? ["GROCERY"] : [];
  const selectedBeauty = options.assetKeys?.filter((key) => key.startsWith("beauty:")) ?? [];
  const beautyRoles: readonly PlaceRole[] = selectedBeauty.length === 0 ? ["BEAUTY_RETAIL", "PHARMACY", "HAIRDRESSER", "GROCERY"]
    : selectedBeauty.includes("beauty:hairdresser") && selectedBeauty.length === 1 ? ["HAIRDRESSER"]
      : ["BEAUTY_RETAIL", "PHARMACY", "GROCERY", ...(selectedBeauty.includes("beauty:hairdresser") ? ["HAIRDRESSER" as const] : [])];
  const allowed = resolved.place.source === "DYNAMIC_GIFT" ? giftRoles
    : resolved.subtypeKey === "beauty" ? beautyRoles : resolved.place.allowedRoles;
  const ranked: RankedPlannedPlace[] = [];
  for (const candidate of places) {
    const roles = derivePlannedPlaceRoles(candidate);
    const exactContact = isContactHome(candidate, contact);
    const anchor = resolved.place.source === "WORK_MEAL_ANCHOR" && !!options.workMealPersonName
      && candidate.relationships.some((relation) => relation.personName === options.workMealPersonName
        && relation.role === "WORK_MEAL_ANCHOR");
    const roleCompatible = allowed.some((role) => roles.includes(role));
    if (resolved.place.subtypeHint && !resolved.place.subtypeHint.test(
      `${candidate.subtype ?? ""} ${candidate.usage ?? ""} ${candidate.nature ?? ""}`)) continue;
    if (resolved.place.source === "CONTACT_HOME" && !exactContact) continue;
    if (!roleCompatible && !exactContact && !anchor) continue;
    if (candidate.privatePlace && !exactContact && !roles.includes("OWN_HOME")) continue;
    if (candidate.privatePlace && resolved.place.source !== "CONTACT_HOME"
      && resolved.place.source !== "OWN_HOME") continue;
    ranked.push({ place: candidate, roles, rankingTier: exactContact || anchor ? "PRIMARY" : "SECONDARY",
      reason: exactContact ? "CONTACT_HOME" : anchor ? "WORK_MEAL_ANCHOR" : "PLACE_ROLE" });
  }
  return ranked.sort((a, b) => (a.rankingTier === b.rankingTier ? a.place.name.localeCompare(b.place.name, "fr")
    : a.rankingTier === "PRIMARY" ? -1 : 1));
}
