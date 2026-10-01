import type { AssetModule, PlannedExpenseFamily } from "./planned-assets";

export type PlannedBaselineKey = "groceries" | "household-restaurants" | "adrien-work-meals" | "manon-work-meals";
export type FundingSource = "BANK" | "SWILE" | "EDENRED";
export type FundingAllocation = Readonly<{ source: FundingSource; amount: string }>;
export type PriceSource = "MANUAL" | "SYSTEM_DEFAULT" | "LAST_KNOWN" | "CALCULATED";
export type ContextKey = `${PlannedExpenseFamily}.${string}`;
export type FieldPolicy = "HIDDEN" | "OPTIONAL" | "REQUIRED";
export type ModuleAvailability = "SUGGESTED" | "AVAILABLE" | "FORBIDDEN";
export type ModulePath = readonly [AssetModule] | readonly [AssetModule, AssetModule];
export type LocalPlacePolicy = FieldPolicy;
export type RootTransportStopAvailability = "NEVER" | "AVAILABLE" | "SUGGESTED";
export type RouteEndpointSource = "ROOT_PLACE" | "CHILD_LOCAL_PLACE" | "DIRECT_PLACE";
export const PLACE_ROLES_V1 = ["GROCERY", "RESTAURANT", "FAST_FOOD", "BAR", "NIGHT_OUT",
  "BEAUTY_RETAIL", "PHARMACY", "HAIRDRESSER", "HOUSEHOLD_RETAIL", "HOME_EQUIPMENT",
  "CLOTHING_RETAIL", "TECH_RETAIL", "AUTO_RETAIL_SERVICE", "ACTIVITY", "OWN_HOME",
  "FAMILY_PLACE", "FRIEND_HOME", "SHOPPING_AREA", "TRAVEL_DESTINATION", "TRANSPORT_HUB"] as const;
export type PlaceRole = typeof PLACE_ROLES_V1[number];
export type ProspectivePersonRef = Readonly<{ kind: "HOUSEHOLD_PERSON"; personId: string }
  | { kind: "CONTACT"; contactKey: string } | { kind: "TEXT"; label: string }>;
export type CostItem = Readonly<{ id: string; assetKey: string | null; label: string; variantLabel?: string | null;
  quantity: string; unitAmount: string; baselineKey: PlannedBaselineKey | null;
  fundingAllocations?: readonly FundingAllocation[]; priceSource?: PriceSource; priceSourceLabel?: string | null;
  modulePath?: ModulePath }>;
export type ProspectivePlaceRef = Readonly<{ kind: "KNOWN"; placeId: string }
  | { kind: "TEXT"; label: string; provenance?: "USER_DECLARED_PROSPECTIVE" }>;
export type PlannedExpensePlace = ProspectivePlaceRef;
export type RouteEvidence = Readonly<{ method: string; observationCount: number; minimumKm: string;
  maximumKm: string; firstDate: string; lastDate: string }>;
export type PlannedRouteStop = Readonly<{ label: string; placeId?: string; distanceToNextKm?: string | null;
  endpointSource?: RouteEndpointSource; childModule?: AssetModule;
  coordinates?: import("./planned-car").RouteCoordinates;
  distanceSource?: "MANUAL" | "HISTORICAL_ROUTE" | "TOMTOM"; estimatedFuelLiters?: string; evidence?: RouteEvidence }>;
export type PlannedFuelEstimate = Readonly<{ vehicleLabel: string; consumptionL100Km: string; fuelPricePerLiter: string;
  fuelPriceSource: string; fuelPriceObservedAt?: string; fuelPriceQuality?: string;
  distanceKm: string; liters: string; cost: string }>;
export type PlannedTripTiming = Readonly<{
  outbound: Readonly<{ date: string | null; time: string | null }>;
  return: Readonly<{ required: true; date: string | null; time: string | null }>;
}>;
/** Restaurant intent/provenance only. Wizard navigation and calculated ranges are not persisted. */
export type PlannedRestaurantContext = Readonly<{
  locationScope?: "MONTPELLIER" | "ELSEWHERE"; city?: string; restaurantName?: string; cuisine?: string; address?: string;
  /** Only the external ID is durable; display/address/photos/Google coordinates stay transient. */
  googlePlaceId?: string;
  plannedTime?: string | null; timeBucket?: "MORNING" | "LUNCH" | "EVENING"; freeTransportMode?: "TRAM" | "WALK" | "BIKE" | "OTHER";
  sharedRide?: "NO_CONTRIBUTION" | "CONTRIBUTION";
  priceBasis?: "KNOWN" | "DETAILED" | "ESTIMATED";
}>;
export type PlannedExpenseContext = Readonly<{ participantPersonIds?: readonly string[]; travellingParticipantPersonIds?: readonly string[];
  restaurant?: PlannedRestaurantContext;
  visitTiming?: PlannedTripTiming;
  companionMode?: "SOLO" | "COUPLE" | "GROUP";
  groceriesNature?: "USUAL" | "TOP_UP" | "OCCASION";
  workMealMode?: "BOUGHT" | "DELIVERED" | "FROM_HOME";
  outingKind?: "CLUB" | "EVENT";
  eventName?: string; endDate?: string; noExpense?: boolean; purchaseDescription?: string;
  participantRefs?: readonly ProspectivePersonRef[]; host?: ProspectivePersonRef;
  hostParticipates?: boolean; visitedPersonParticipates?: boolean;
  transportMode?: "CAR" | "TRAIN" | "BUS" | "TAXI" | "CARPOOL" | "FREE" | "OTHER" | "PLANE";
  additionalGuestCount?: number; personVisited?: ProspectivePersonRef;
  place?: PlannedExpensePlace; purchaseMode?: "IN_STORE" | "ONLINE" | "TAKEAWAY" | "DELIVERY";
  housePartyPlaceMode?: "OWN_HOME" | "OTHER_HOME"; visitFormat?: "SIMPLE" | "APERO_PARTY" | "MEAL" | "STAY";
  socialOccasion?: "NONE" | "BIRTHDAY" | "CHRISTMAS" | "CELEBRATION" | "OTHER_SPECIAL";
  occasionLabel?: string; deliveryProviderKey?: string; deliveryProvider?: string;
  seller?: string; gift?: Readonly<{ recipient: string; occasion: string }>;
  childLocalPlaceRefs?: Readonly<Partial<Record<AssetModule, ProspectivePlaceRef>>>;
  route?: Readonly<{ mode: "CAR" | "TRAIN" | "BUS" | "TAXI";
    stops: readonly PlannedRouteStop[];
    fuelEstimate?: PlannedFuelEstimate;
    plannedTime?: string | null; timeKind?: "DEPARTURE" | "ARRIVAL"; preference?: import("./planned-car").RoutePreference; manualFuelPrice?: string; tollFreeConfirmed?: boolean;
    liveEstimate?: import("./planned-car").PlannedCarSnapshot }> }>;
export type PlannedExpenseDraft = Readonly<{ familyKey: PlannedExpenseFamily; subtypeKey: string | null;
  title: string; plannedDate: string | null; costItems: readonly CostItem[]; context: PlannedExpenseContext }>;
export type PlannedVehicleEstimate = Readonly<{ vehicleId?: string; fuelType?: string; label: string; consumptionL100Km: string;
  fuelPricePerLiter: string; fuelPriceSource: string; fuelPriceObservedAt?: string; fuelPriceQuality?: string }>;
export type PlannedPriceSuggestion = Readonly<{ assetKey: string; unitAmount: string; sourceLabel: string }>;
export type PlannedWalletOption = Readonly<{ source: "SWILE" | "EDENRED"; ownerPersonId: string | null }>;
