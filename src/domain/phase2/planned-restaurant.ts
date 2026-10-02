import Big from "big.js";
import type { CostItem, PlannedExpenseContext, PlannedExpenseDraft, PlannedRestaurantContext } from "./planned-contract";
import type { PlannedPlaceOption } from "./planned-places";
import { isRootCost, isTransportCost, plannedParticipantCount, transportAssetMatchesMode } from "./planned-product";
import { knownRestaurantSuggestions, validGooglePlaceId } from "./restaurant-places";

export type RestaurantWizardStep = "partySize" | "soloPerson" | "datePrecision" | "dateCalendar" | "participants"
  | "occasion" | "occasionChoice" | "occasionCustom" | "locationScope" | "restaurantAsked" | "restaurantChoice"
  | "restaurantCity" | "restaurantManual" | "transportCostKind" | "transportMode" | "sharedDriver" | "sharesCosts"
  | "transportAddress" | "transportDetails" | "priceKnowledge" | "priceTotal" | "priceDetailed"
  | "priceEstimated" | "baseline" | "review";
export const RESTAURANT_PRICE_POLICY = Object.freeze({ method: "restaurant-range-15-40-per-person@v1", minimum: "15.00", maximum: "40.00", central: "27.50" });
export const RESTAURANT_BILL_ASSETS = ["restaurant:starter", "restaurant:main", "restaurant:dessert", "restaurant:wine_glass",
  "restaurant:wine_bottle", "restaurant:cocktail", "restaurant:soft", "restaurant:water", "restaurant:coffee",
  "restaurant:digestif", "restaurant:menu", "CUSTOM"] as const;
export const RESTAURANT_OCCASIONS = [
  { key: "BIRTHDAY", label: "Anniversaire", occasion: "BIRTHDAY", scene: "birthday" },
  { key: "VALENTINE", label: "Saint-Valentin", occasion: "OTHER_SPECIAL", scene: "valentine" },
  { key: "SPONTANEOUS", label: "Sortie improvisée", occasion: "NONE", scene: "spontaneous" },
  { key: "PARTY", label: "Fête", occasion: "CELEBRATION", scene: "party" },
  { key: "REUNION", label: "Retrouvailles", occasion: "OTHER_SPECIAL", scene: "reunion" },
  { key: "CELEBRATION", label: "Célébration", occasion: "CELEBRATION", scene: "celebration" },
  { key: "OTHER", label: "Autre occasion", occasion: "OTHER_SPECIAL", scene: "occasion" },
] as const;
const invalid = (): never => { throw new TypeError("PLANNED_RESTAURANT_CONTEXT_INVALID"); };
export function parseRestaurantContext(raw: unknown): PlannedRestaurantContext {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
  const v = raw as Record<string, unknown>;
  if (Object.keys(v).some((key) => !["locationScope", "city", "restaurantName", "cuisine", "address", "googlePlaceId", "plannedTime", "timeBucket", "freeTransportMode", "sharedRide", "priceBasis"].includes(key))) return invalid();
  if (v.googlePlaceId !== undefined && (!validGooglePlaceId(v.googlePlaceId) || v.address !== undefined)) return invalid();
  for (const key of ["city", "restaurantName", "cuisine", "address"] as const)
    if (v[key] !== undefined && (typeof v[key] !== "string" || !v[key].trim() || v[key].length > 120)) return invalid();
  const enumValid = (key: string, allowed: readonly string[]) => v[key] === undefined || typeof v[key] === "string" && allowed.includes(v[key]);
  if (!enumValid("locationScope", ["MONTPELLIER", "ELSEWHERE"])
    || !enumValid("freeTransportMode", ["TRAM", "WALK", "BIKE", "OTHER"])
    || !enumValid("priceBasis", ["KNOWN", "DETAILED", "ESTIMATED"])
    || !enumValid("sharedRide", ["NO_CONTRIBUTION", "CONTRIBUTION"])
    || !enumValid("timeBucket", ["MORNING", "LUNCH", "EVENING"])
    || v.plannedTime != null && (typeof v.plannedTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(v.plannedTime))) return invalid();
  return { ...v, ...Object.fromEntries(["city", "restaurantName", "cuisine", "address"].filter((key) => v[key] !== undefined).map((key) => [key, String(v[key]).trim()])) } as PlannedRestaurantContext;
}
const sameCity = (a: string | null | undefined, b: string) => a?.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");
export function montpellierRestaurantSuggestions(places: readonly PlannedPlaceOption[]) {
  return knownRestaurantSuggestions(places, "Montpellier");
}
/** No email-prefix inference or arbitrary first-person fallback. This is intent, not authorization. */
export function restaurantSoloPerson(persons: readonly { personId: string; displayName: string }[], identity?: { personId?: string; displayName?: string }) {
  const byId = persons.find((person) => person.personId === identity?.personId);
  if (byId) return byId.personId;
  const named = persons.filter((person) => person.displayName === identity?.displayName);
  return named.length === 1 ? named[0]!.personId : persons.length === 1 ? persons[0]!.personId : undefined;
}
export function restaurantPriceRange(context: PlannedExpenseContext) {
  const participants = context.project?.financialScope?.count ?? plannedParticipantCount(context);
  return { participants, minimum: new Big(RESTAURANT_PRICE_POLICY.minimum).times(participants).toFixed(2),
    maximum: new Big(RESTAURANT_PRICE_POLICY.maximum).times(participants).toFixed(2), central: new Big(RESTAURANT_PRICE_POLICY.central).times(participants).toFixed(2) };
}
export function restaurantEstimatedCost(context: PlannedExpenseContext, id: string, baselineKey: CostItem["baselineKey"]): CostItem {
  const range = restaurantPriceRange(context);
  if (!range.participants) throw new TypeError("PLANNED_RESTAURANT_PARTICIPANTS_REQUIRED");
  return { id, assetKey: null, label: "Restaurant · estimation", quantity: String(range.participants), unitAmount: RESTAURANT_PRICE_POLICY.central,
    baselineKey, modulePath: ["restaurant"], priceSource: "SYSTEM_DEFAULT", priceSourceLabel: "15–40 € par personne · hypothèse centrale 27,50 €" };
}
export function assertRestaurantEstimate(draft: PlannedExpenseDraft) {
  if (draft.context.restaurant?.priceBasis !== "ESTIMATED") return;
  const items = draft.costItems.filter(isRootCost), item = items[0];
  const count = draft.context.project?.financialScope?.count ?? plannedParticipantCount(draft.context);
  if (items.length !== 1 || !item || !count || item.assetKey !== null
    || item.quantity !== String(count) || item.unitAmount !== RESTAURANT_PRICE_POLICY.central
    || item.priceSource !== "SYSTEM_DEFAULT" || item.fundingAllocations?.some((part) => part.source !== "BANK"))
    throw new TypeError("PLANNED_RESTAURANT_ESTIMATE_INVALID");
}
export function restaurantNeedsAddress(context: PlannedExpenseContext, places: readonly PlannedPlaceOption[]) {
  const known = context.place?.kind === "KNOWN" ? places.find((place) => place.placeId === (context.place as { placeId: string }).placeId) : undefined;
  return !known?.coordinates && !known?.address && !context.restaurant?.address && !context.restaurant?.googlePlaceId;
}
export function restaurantContextIssues(draft: PlannedExpenseDraft) {
  const info = draft.context.restaurant;
  if (!info) return [];
  const problems: { code: string; message: string; repairTarget: RestaurantWizardStep }[] = [];
  const add = (code: string, message: string, repairTarget: RestaurantWizardStep) => problems.push({ code, message, repairTarget });
  if (draft.context.project?.version === 2) {
    if (!draft.context.participantPersonIds?.length) add("RESTAURANT_PARTICIPANTS_REQUIRED", "Choisissez les personnes concernées.", "partySize");
    if (info.googlePlaceId && (!info.restaurantName || draft.context.place?.kind !== "TEXT")) add("RESTAURANT_DETAILS_REQUIRED", "Choisissez à nouveau le restaurant.", "restaurantChoice");
    if (draft.context.transportMode === "CAR" && !draft.context.route) add("RESTAURANT_ROUTE_REQUIRED", "Calculez le trajet en voiture.", "transportDetails");
    if (!info.priceBasis && !draft.context.project.unpricedComponents?.length) add("RESTAURANT_PRICE_REQUIRED", "Précisez le budget de la note.", "priceKnowledge");
    return problems;
  }
  const count = plannedParticipantCount(draft.context);
  if (!draft.context.companionMode || !draft.context.participantPersonIds?.length || !count)
    add("RESTAURANT_PARTICIPANTS_REQUIRED", "Choisissez qui vient au restaurant.", "partySize");
  if (draft.context.companionMode === "SOLO" && count !== 1 || draft.context.companionMode === "COUPLE" && count !== 2
    || draft.context.companionMode === "GROUP" && count < 3) add("RESTAURANT_PARTY_SIZE_INVALID", "Ajustez les personnes prévues pour cette sortie.", "participants");
  if (!info.locationScope || !info.city || info.locationScope === "MONTPELLIER" && !sameCity(info.city, "Montpellier"))
    add("RESTAURANT_CITY_REQUIRED", "Précisez la ville du restaurant.", "locationScope");
  if (info.googlePlaceId && (!info.restaurantName || draft.context.place?.kind !== "TEXT")) add("RESTAURANT_DETAILS_REQUIRED", "Choisissez à nouveau le restaurant.", "restaurantChoice");
  if ((info.plannedTime || info.timeBucket) && !draft.plannedDate) add("RESTAURANT_DATE_REQUIRED", "Choisissez une date pour cet horaire.", "dateCalendar");
  if (info.plannedTime && info.timeBucket) add("RESTAURANT_TIME_INVALID", "Choisissez une heure ou un créneau.", "dateCalendar");
  if (!draft.context.transportMode) add("RESTAURANT_TRANSPORT_REQUIRED", "Choisissez le trajet de cette sortie.", "transportCostKind");
  if (draft.context.transportMode === "CAR" && draft.context.route?.mode !== "CAR") add("RESTAURANT_ROUTE_REQUIRED", "Calculez le trajet en voiture.", "transportDetails");
  if (info.freeTransportMode && draft.context.transportMode !== "FREE") add("RESTAURANT_FREE_MODE_INVALID", "Confirmez le mode de transport.", "transportMode");
  if (draft.context.transportMode === "FREE" && !info.freeTransportMode) add("RESTAURANT_FREE_MODE_REQUIRED", "Choisissez comment vous vous déplacez.", "transportMode");
  if (info.sharedRide && (draft.context.companionMode !== "GROUP" || info.sharedRide === "NO_CONTRIBUTION" && draft.context.transportMode !== "FREE"
    || info.sharedRide === "CONTRIBUTION" && draft.context.transportMode !== "CARPOOL")) add("RESTAURANT_SHARED_RIDE_INVALID", "Confirmez la prise en charge du trajet.", "sharedDriver");
  if (draft.context.transportMode && !["CAR", "FREE"].includes(draft.context.transportMode)
    && !draft.costItems.some((item) => isTransportCost(item) && transportAssetMatchesMode(item.assetKey ?? "", draft.context.transportMode)))
    add("RESTAURANT_TRANSPORT_COST_REQUIRED", "Indiquez le coût du trajet pour le foyer.", "transportDetails");
  if (!info.priceBasis) add("RESTAURANT_PRICE_REQUIRED", "Précisez le budget de la note.", "priceKnowledge");
  return problems;
}
export function restaurantTitle(draft: PlannedExpenseDraft, fallbackPlace: string) {
  const c = draft.context, r = c.restaurant;
  if (c.occasionLabel === "Saint-Valentin" && c.companionMode === "COUPLE") return "Soirée en amoureux pour la Saint-Valentin";
  if (r?.restaurantName) return `Restaurant · ${r.restaurantName}`;
  if (r?.locationScope === "ELSEWHERE" && r.cuisine && r.city) return `Restaurant ${r.cuisine.toLocaleLowerCase("fr")} à ${r.city}`;
  if (fallbackPlace && !r) return `Restaurant · ${fallbackPlace}`;
  if (c.socialOccasion === "BIRTHDAY") return `Restaurant anniversaire${r?.city ? ` · ${r.city}` : ""}`;
  if (c.occasionLabel) return `Restaurant · ${c.occasionLabel}`;
  return c.companionMode ? ({ SOLO: "Restaurant solo", COUPLE: c.project?.version === 2 ? "Restaurant à deux" : "Restaurant en amoureux", GROUP: "Restaurant à plusieurs" }[c.companionMode]) : "Restaurant";
}
