import { PLANNED_EXPENSE_SUBTYPES, rootAssetModule, type AssetModule, type PlannedExpenseFamily } from "./planned-assets";
import type { ContextKey, FieldPolicy, LocalPlacePolicy, ModuleAvailability, ModulePath,
  PlaceRole, RootTransportStopAvailability } from "./planned-contract";

export type PlannedModifiers = Readonly<{
  housePartyPlaceMode?: "OWN_HOME" | "OTHER_HOME";
  purchaseMode?: "IN_STORE" | "ONLINE" | "TAKEAWAY" | "DELIVERY";
  visitFormat?: "SIMPLE" | "APERO_PARTY" | "MEAL" | "STAY";
  socialOccasion?: "NONE" | "BIRTHDAY" | "CHRISTMAS" | "CELEBRATION" | "OTHER_SPECIAL";
  occasionLabel?: string;
  deliveryProviderKey?: string;
  workMealPerson?: "ADRIEN" | "MANON";
}>;
export type PlannedField = "participants" | "visitedContact" | "travelCompanions" | "workMealPerson"
  | "host" | "place" | "purchaseMode" | "seller" | "deliveryProvider" | "visitFormat"
  | "socialOccasion";
export type PlacePolicy = Readonly<{ field: FieldPolicy; allowedRoles: readonly PlaceRole[];
  source: "NONE" | "CANONICAL" | "OWN_HOME" | "CONTACT_HOME" | "WORK_MEAL_ANCHOR" | "DYNAMIC_GIFT";
  physicalDestination: boolean; subtypeHint?: RegExp }>;
export type BaselinePolicy = Readonly<{ mode: "NONE" | "ASK"; key: "groceries" | "household-restaurants"
  | "adrien-work-meals" | "manon-work-meals" | null }>;
export type ModuleEdge = Readonly<{ fromRoot: AssetModule; childModule: Exclude<AssetModule, "transport">;
  availability: Exclude<ModuleAvailability, "FORBIDDEN">;
  inherit: readonly ("DATE" | "PARTICIPANTS" | "OCCASION" | "PLACE" | "GIFT_CONTEXT")[];
  localPlacePolicy: LocalPlacePolicy; rootTransportStopAvailability: RootTransportStopAvailability;
  baselineOverride?: null; fundingOverride?: "BANK_ONLY" }>;
export type ResolvedPlannedContext = Readonly<{ key: ContextKey; familyKey: PlannedExpenseFamily;
  subtypeKey: string | null; rootModule: AssetModule; fields: Readonly<Record<PlannedField, FieldPolicy>>;
  place: PlacePolicy; transport: ModuleAvailability; baseline: BaselinePolicy;
  children: readonly ModuleEdge[]; bringItems: ModuleAvailability;
  suggestedFeeAssetKeys: readonly string[] }>;

// Taxonomy and root ownership remain in planned-assets; this registry owns the contextual policies.
export const CONTEXT_REGISTRY: readonly Readonly<{ key: ContextKey; familyKey: PlannedExpenseFamily;
  subtypeKey: string | null; rootModule: AssetModule }>[] =
  (Object.entries(PLANNED_EXPENSE_SUBTYPES) as [PlannedExpenseFamily, readonly string[]][])
    .flatMap(([familyKey, subtypes]) => (subtypes.length ? subtypes : ["default"])
      .map((part) => ({ key: `${familyKey}.${part}` as ContextKey, familyKey,
        subtypeKey: part === "default" ? null : part, rootModule: rootAssetModule(familyKey, part === "default" ? null : part) })));

const edge = (fromRoot: AssetModule, childModule: ModuleEdge["childModule"],
  availability: ModuleEdge["availability"], localPlacePolicy: LocalPlacePolicy = "HIDDEN",
  rootTransportStopAvailability: RootTransportStopAvailability = "NEVER",
  extras: Partial<Pick<ModuleEdge, "inherit" | "baselineOverride" | "fundingOverride">> = {}): ModuleEdge =>
  ({ fromRoot, childModule, availability, localPlacePolicy, rootTransportStopAvailability,
    inherit: extras.inherit ?? ["DATE", "PARTICIPANTS"],
    ...(extras.baselineOverride === null ? { baselineOverride: null } : {}),
    ...(extras.fundingOverride ? { fundingOverride: extras.fundingOverride } : {}) });

// Transport is a root capability, never a child. BringItems is a lens, never a node.
export const MODULE_EDGES: readonly ModuleEdge[] = [
  edge("other", "restaurant", "AVAILABLE", "OPTIONAL", "AVAILABLE"),
  edge("other", "activity", "AVAILABLE", "OPTIONAL", "AVAILABLE"),
  edge("other", "gift", "AVAILABLE"),
  edge("other", "bar", "AVAILABLE", "OPTIONAL", "AVAILABLE"),
  edge("other", "club", "AVAILABLE", "OPTIONAL", "AVAILABLE"),
  edge("other", "beauty", "AVAILABLE"),
  edge("other", "clothing", "AVAILABLE"),
  edge("other", "household", "AVAILABLE"),
  edge("other", "tech", "AVAILABLE"),
  edge("other", "home", "AVAILABLE"),
  edge("groceries", "beauty", "AVAILABLE", "HIDDEN", "NEVER", { inherit: ["DATE", "PLACE"] }),
  edge("groceries", "household", "AVAILABLE", "HIDDEN", "NEVER", { inherit: ["DATE", "PLACE"] }),
  edge("groceries", "house_party", "AVAILABLE", "HIDDEN", "NEVER", { inherit: ["DATE", "PLACE"] }),
  edge("visit_family", "gift", "AVAILABLE", "HIDDEN", "NEVER", { inherit: ["DATE", "OCCASION", "GIFT_CONTEXT"] }),
  edge("visit_family", "restaurant", "AVAILABLE", "OPTIONAL", "SUGGESTED"),
  edge("visit_friend", "gift", "AVAILABLE", "HIDDEN", "NEVER", { inherit: ["DATE", "OCCASION", "GIFT_CONTEXT"] }),
  edge("visit_friend", "restaurant", "AVAILABLE", "OPTIONAL", "SUGGESTED"),
  edge("visit_friend", "bar", "AVAILABLE", "OPTIONAL", "SUGGESTED"),
  edge("visit_friend", "club", "AVAILABLE", "OPTIONAL", "SUGGESTED"),
  edge("trip", "restaurant", "AVAILABLE", "OPTIONAL", "AVAILABLE", { baselineOverride: null }),
  edge("trip", "activity", "AVAILABLE", "OPTIONAL", "AVAILABLE"),
  edge("activity", "restaurant", "AVAILABLE", "OPTIONAL", "AVAILABLE"),
  edge("gift", "restaurant", "AVAILABLE", "OPTIONAL", "NEVER", { inherit: ["DATE", "GIFT_CONTEXT"],
    baselineOverride: null, fundingOverride: "BANK_ONLY" }),
];

export type DeliveryProvider = Readonly<{ key: string; label: string;
  kind: "INTERMEDIARY" | "DIRECT" | "DIRECT_GENERIC" | "UNKNOWN";
  suggestedFeeAssetKeys: readonly string[]; manualFeeAvailable: boolean }>;
export const DELIVERY_PROVIDERS: readonly DeliveryProvider[] = [
  { key: "UBER_EATS", label: "Uber Eats", kind: "INTERMEDIARY",
    suggestedFeeAssetKeys: ["fast_food:delivery_fee", "fast_food:service_fee"], manualFeeAvailable: true },
  { key: "LADY_SUSHI", label: "Lady Sushi", kind: "DIRECT", suggestedFeeAssetKeys: [], manualFeeAvailable: true },
  { key: "DOMINOS", label: "Domino’s", kind: "DIRECT_GENERIC", suggestedFeeAssetKeys: [], manualFeeAvailable: true },
  { key: "OTHER", label: "Autre", kind: "UNKNOWN", suggestedFeeAssetKeys: [], manualFeeAvailable: true },
];
export const deliveryFeeSuggestions = (key: string | undefined): readonly Readonly<{ assetKey: string; amount: null }>[] =>
  (DELIVERY_PROVIDERS.find((provider) => provider.key === key)?.suggestedFeeAssetKeys ?? [])
    .map((assetKey) => ({ assetKey, amount: null }));

export type ContactPlaceLink = Readonly<{ placeId?: string; textPlace?: string;
  relation: "HOME" | "USUAL_PLACE" | "OTHER";
  provenance: "CANONICAL_PLACE" | "USER_VALIDATED_HISTORY" | "USER_DECLARED_PROSPECTIVE";
  confidence: "HIGH" | "DECLARED" }>;
export type ProspectiveContact = Readonly<{ key: string; label: string; kind: "FAMILY" | "FRIEND" | "OTHER";
  relatedTo?: "ADRIEN" | "MANON" | "HOUSEHOLD"; places: readonly ContactPlaceLink[] }>;
const home = (placeId: string): readonly ContactPlaceLink[] =>
  [{ placeId, relation: "HOME", provenance: "CANONICAL_PLACE", confidence: "HIGH" }];
const declaredHome = (textPlace: string): readonly ContactPlaceLink[] =>
  [{ textPlace, relation: "HOME", provenance: "USER_DECLARED_PROSPECTIVE", confidence: "DECLARED" }];
export const SOCIAL_CONTACTS_V1: readonly ProspectiveContact[] = [
  { key: "amandine", label: "Amandine", kind: "FRIEND", places: home("ef2f70bc-c459-5735-ade9-36d01a07c5ef") },
  { key: "cedric", label: "Cédric", kind: "FRIEND", places: home("c0c2d528-2dc5-5b4b-869f-7a8f86c66698") },
  { key: "lucas", label: "Lucas", kind: "FRIEND", places: home("64b973fd-67e3-55e7-9e8b-11fc03cbe27c") },
  { key: "florentine", label: "Florentine", kind: "FRIEND", places: home("c3801645-aa65-5e3e-85cf-076cc01bec08") },
  { key: "juliette", label: "Juliette", kind: "FRIEND", places: home("5d952dac-8c0b-503c-831b-e1307bd72601") },
  { key: "elsa", label: "Elsa", kind: "FRIEND", places: home("6c435cf6-7fa8-50a1-9b86-a2a5e0cf000c") },
  { key: "greg", label: "Greg", kind: "FRIEND", places: declaredHome("Saint-Jean-de-Védas") },
  { key: "manon_father", label: "Père de Manon", kind: "FAMILY", relatedTo: "MANON", places: home("9c6b6a7a-3301-5a8c-ad5c-64446f6cbb12") },
  { key: "manon_mother", label: "Mère de Manon", kind: "FAMILY", relatedTo: "MANON", places: home("45b9c4a9-4da2-5768-9aa0-4f8d32549fbb") },
  { key: "manon_grandparents", label: "Grands-parents de Manon", kind: "FAMILY", relatedTo: "MANON", places: home("45b9c4a9-4da2-5768-9aa0-4f8d32549fbb") },
  { key: "manon_stepfather", label: "Chris", kind: "FAMILY", relatedTo: "MANON", places: home("b965e05a-a35f-54f6-8113-9ff4597cb8bf") },
  { key: "adrien_father", label: "Père d’Adrien", kind: "FAMILY", relatedTo: "ADRIEN", places: declaredHome("Servian") },
  { key: "adrien_mother", label: "Mère d’Adrien", kind: "FAMILY", relatedTo: "ADRIEN", places: declaredHome("Dax") },
  { key: "adrien_grandmother", label: "Grand-mère d’Adrien", kind: "FAMILY", relatedTo: "ADRIEN", places: declaredHome("Servian") },
];

const hiddenFields: Record<PlannedField, FieldPolicy> = { participants: "HIDDEN", visitedContact: "HIDDEN",
  travelCompanions: "HIDDEN", workMealPerson: "HIDDEN", host: "HIDDEN", place: "HIDDEN",
  purchaseMode: "HIDDEN", seller: "HIDDEN", deliveryProvider: "HIDDEN", visitFormat: "HIDDEN",
  socialOccasion: "HIDDEN" };
const place = (field: FieldPolicy, allowedRoles: readonly PlaceRole[], source: PlacePolicy["source"] = "CANONICAL",
  physicalDestination = true, subtypeHint?: RegExp): PlacePolicy =>
  ({ field, allowedRoles, source, physicalDestination, ...(subtypeHint ? { subtypeHint } : {}) });
const noPlace = place("HIDDEN", [], "NONE", false);
const noBaseline: BaselinePolicy = { mode: "NONE", key: null };
const askBaseline = (key: NonNullable<BaselinePolicy["key"]>): BaselinePolicy => ({ mode: "ASK", key });
const giftOccasion = (occasion: PlannedModifiers["socialOccasion"]) =>
  occasion === "BIRTHDAY" || occasion === "CHRISTMAS" || occasion === "CELEBRATION";
export const ACTIVITY_PLACE_HINTS: Readonly<Record<string, RegExp>> = {
  cinema: /cinéma|cinema/iu, bowling: /bowling/iu, karting: /karting/iu,
  mini_golf: /mini.golf/iu, billiards: /billard/iu, escape_game: /escape.game/iu,
  canoe_kayak: /canoë|kayak/iu, pool: /piscine/iu, spa: /spa|thermal/iu,
  theme_park: /parc.d.attraction/iu, show: /spectacle|théâtre|concert/iu,
  match: /stade|match|arena/iu, sport: /sport|gymnase/iu, fishing: /pêche|étang|lac/iu,
  creative_workshop: /atelier|créatif/iu, photo_outing: /photo|parc|jardin/iu,
};

export function resolvePlannedContext(input: Readonly<{ familyKey: PlannedExpenseFamily; subtypeKey: string | null;
  modifiers?: PlannedModifiers }>): ResolvedPlannedContext {
  const entry = CONTEXT_REGISTRY.find((item) => item.familyKey === input.familyKey && item.subtypeKey === input.subtypeKey);
  if (!entry) throw new TypeError("PLANNED_CONTEXT_UNKNOWN");
  const m = input.modifiers ?? {};
  const fields = { ...hiddenFields };
  let selectedPlace: PlacePolicy = noPlace;
  let transport: ModuleAvailability = "FORBIDDEN";
  let baseline = noBaseline;
  let bringItems: ModuleAvailability = "FORBIDDEN";
  const { familyKey, subtypeKey } = entry;
  if (familyKey === "outing") {
    fields.participants = "OPTIONAL";
    if (subtypeKey === "bar") { selectedPlace = place("OPTIONAL", ["BAR"]); transport = "SUGGESTED"; }
    else if (subtypeKey === "club_festival") { selectedPlace = place("OPTIONAL", ["NIGHT_OUT"]); transport = "SUGGESTED"; }
    else if (subtypeKey === "house_party") {
      fields.host = m.housePartyPlaceMode === "OTHER_HOME" ? "REQUIRED" : "HIDDEN";
      selectedPlace = m.housePartyPlaceMode === "OTHER_HOME"
        ? place("REQUIRED", ["FRIEND_HOME", "FAMILY_PLACE"], "CONTACT_HOME")
        : place("REQUIRED", ["OWN_HOME"], "OWN_HOME");
      transport = m.housePartyPlaceMode === "OTHER_HOME" ? "SUGGESTED" : "FORBIDDEN";
    } else { selectedPlace = place("OPTIONAL", ["BAR", "NIGHT_OUT", "ACTIVITY"]); transport = "AVAILABLE"; }
  } else if (familyKey === "food") {
    if (subtypeKey === "groceries") { selectedPlace = place("OPTIONAL", ["GROCERY"]); baseline = askBaseline("groceries"); transport = "AVAILABLE"; }
    if (subtypeKey === "restaurant") { fields.participants = "OPTIONAL";
      selectedPlace = place("OPTIONAL", ["RESTAURANT"]); transport = "AVAILABLE";
      baseline = askBaseline("household-restaurants"); }
    if (subtypeKey === "fast_food") { fields.purchaseMode = "REQUIRED";
      fields.participants = "OPTIONAL"; baseline = askBaseline("household-restaurants");
      if (m.purchaseMode === "DELIVERY") { fields.deliveryProvider = "REQUIRED";
        fields.seller = "OPTIONAL";
        selectedPlace = noPlace; transport = "FORBIDDEN"; }
      else { selectedPlace = place("OPTIONAL", ["FAST_FOOD"]); transport = "AVAILABLE"; }
    }
    if (subtypeKey === "work_meal") { fields.workMealPerson = "REQUIRED";
      selectedPlace = place("OPTIONAL", ["FAST_FOOD", "GROCERY"], "WORK_MEAL_ANCHOR");
      baseline = { mode: "ASK", key: m.workMealPerson === "ADRIEN" ? "adrien-work-meals"
        : m.workMealPerson === "MANON" ? "manon-work-meals" : null }; }
  } else if (familyKey === "visit_trip") {
    if (subtypeKey === "family_visit" || subtypeKey === "friend_visit") {
      fields.visitedContact = "REQUIRED"; fields.travelCompanions = "OPTIONAL";
      fields.socialOccasion = "OPTIONAL"; fields.visitFormat = "OPTIONAL";
      selectedPlace = place("OPTIONAL", subtypeKey === "family_visit" ? ["FAMILY_PLACE"] : ["FRIEND_HOME"], "CONTACT_HOME");
      transport = "SUGGESTED";
      bringItems = m.visitFormat === "APERO_PARTY" || m.visitFormat === "MEAL" ? "SUGGESTED" : "AVAILABLE";
    } else if (subtypeKey === "trip_stay") { fields.travelCompanions = "OPTIONAL";
      selectedPlace = place("OPTIONAL", ["TRAVEL_DESTINATION"]); transport = "SUGGESTED"; }
    else { selectedPlace = place("OPTIONAL", ["TRAVEL_DESTINATION", "TRANSPORT_HUB"]); transport = "AVAILABLE"; }
  } else if (familyKey === "activity") { fields.participants = "OPTIONAL";
    selectedPlace = place("OPTIONAL", ["ACTIVITY"], "CANONICAL", true,
      ACTIVITY_PLACE_HINTS[subtypeKey ?? ""]); transport = "SUGGESTED";
  } else if (familyKey === "purchase") {
    transport = m.purchaseMode === "ONLINE" ? "FORBIDDEN" : "AVAILABLE";
    if (subtypeKey === "gift") { selectedPlace = place("OPTIONAL", [], "DYNAMIC_GIFT");
      fields.socialOccasion = "OPTIONAL"; }
    else {
      const roles: Partial<Record<string, readonly PlaceRole[]>> = { beauty: ["BEAUTY_RETAIL", "PHARMACY", "HAIRDRESSER"],
        clothing: ["CLOTHING_RETAIL", "SHOPPING_AREA"], household: ["HOUSEHOLD_RETAIL", "GROCERY"],
        home_equipment: ["HOME_EQUIPMENT", "SHOPPING_AREA"], tech: ["TECH_RETAIL", "SHOPPING_AREA"],
        automotive: ["AUTO_RETAIL_SERVICE"] };
      selectedPlace = place("OPTIONAL", roles[subtypeKey ?? ""] ?? [], roles[subtypeKey ?? ""] ? "CANONICAL" : "NONE");
    }
    if (subtypeKey === "clothing" || subtypeKey === "tech" || subtypeKey === "home_equipment") {
      fields.purchaseMode = "OPTIONAL";
      if (m.purchaseMode === "ONLINE") { fields.seller = "OPTIONAL"; selectedPlace = noPlace; }
    }
  } else { selectedPlace = place("OPTIONAL", [], "NONE"); }
  fields.place = selectedPlace.field;
  const children = MODULE_EDGES.filter((item) => item.fromRoot === entry.rootModule
    && (entry.rootModule !== "other" || subtypeKey === "other_outing" && ["restaurant", "activity", "bar", "club", "gift"].includes(item.childModule)
      || subtypeKey === "other_purchase" && ["beauty", "clothing", "household", "tech", "home", "gift"].includes(item.childModule))).map((item) =>
    item.childModule === "gift" && giftOccasion(m.socialOccasion)
      ? { ...item, availability: "SUGGESTED" as const } : item);
  const provider = m.purchaseMode === "DELIVERY"
    ? DELIVERY_PROVIDERS.find((item) => item.key === m.deliveryProviderKey) : undefined;
  return { ...entry, fields, place: selectedPlace, transport, baseline, children, bringItems,
    suggestedFeeAssetKeys: provider?.suggestedFeeAssetKeys ?? [] };
}

export function validateModulePath(path: readonly AssetModule[], resolved: ResolvedPlannedContext): asserts path is ModulePath {
  if (path.length < 1 || path.length > 2 || path[0] !== resolved.rootModule)
    throw new TypeError("PLANNED_MODULE_PATH_INVALID");
  if (path.length === 2 && (path[1] === "transport"
    || !resolved.children.some((edge) => edge.childModule === path[1])))
    throw new TypeError("PLANNED_MODULE_EDGE_INVALID");
}

export function moduleAvailability(resolved: ResolvedPlannedContext, module: AssetModule): ModuleAvailability {
  if (module === "transport") return resolved.transport;
  return resolved.children.find((edge) => edge.childModule === module)?.availability ?? "FORBIDDEN";
}

export function childPlaceRoles(module: AssetModule): readonly PlaceRole[] {
  const representative: Partial<Record<AssetModule, readonly [PlannedExpenseFamily, string]>> = {
    restaurant: ["food", "restaurant"], bar: ["outing", "bar"], club: ["outing", "club_festival"],
    activity: ["activity", "other_activity"],
  };
  const key = representative[module];
  return key ? resolvePlannedContext({ familyKey: key[0], subtypeKey: key[1] }).place.allowedRoles : [];
}

/** One domain lookup for the baseline question shown by the Builder. */
export function baselineKeyForModule(module: AssetModule, workMealPerson?: "ADRIEN" | "MANON"):
  BaselinePolicy["key"] {
  const representative: Partial<Record<AssetModule, readonly [PlannedExpenseFamily, string]>> = {
    groceries: ["food", "groceries"], restaurant: ["food", "restaurant"],
    fast_food: ["food", "fast_food"], work_meal: ["food", "work_meal"],
  };
  const context = representative[module];
  return context ? resolvePlannedContext({ familyKey: context[0], subtypeKey: context[1],
    modifiers: { workMealPerson } }).baseline.key : null;
}

export const BRING_ITEMS_LENS = {
  SIMPLE: ["gift:flowers", "visit_friend:brought_drink", "visit_friend:brought_food"],
  APERO_PARTY: ["house_party:beer", "house_party:wine", "house_party:vodka", "house_party:rum",
    "house_party:mixer", "groceries:drinks", "house_party:chips", "house_party:snack"],
  MEAL: ["groceries:dessert", "house_party:wine", "groceries:drinks", "groceries:special_meal", "groceries:food"],
  STAY: ["groceries:food", "groceries:drinks"],
} as const;

// Fishing keeps Activity as its sole root; bait is a subtype asset in this lens.
export const FISHING_ASSET_LENS = ["fishing:bait"] as const;
