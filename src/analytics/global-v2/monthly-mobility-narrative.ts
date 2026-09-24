import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";

export const MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION = "monthly_mobility_narrative@v1" as const;

export const MOBILITY_ROUTINE_GROUP_POLICY = Object.freeze({
  policyRef: "mobility-routine-group@v1",
  workPatternMinimumMonthlyTrips: 2,
  repeatedDestinationMinimumMonthlyTrips: 2,
  repeatedDestinationMinimumAnnualTrips: 3,
  genericMinimumMonthlyTrips: 3,
  genericMinimumAnnualTrips: 5,
  genericAnnualMinimumMonthlyTrips: 2,
  maximumRoutineGroups: 3,
  exceptionalMaterialityMonthCostShare: "0.25",
  exceptionalMaterialityMedianMultiplier: "2",
});

export const MOBILITY_USAGE_BAND_POLICY = Object.freeze({
  policyRef: "mobility-usage-band-positive-evidence@v1",
  workRule: "POSITIVE_WORK_AUTHORITY_REQUIRED",
  outsideWorkRule: "POSITIVE_NON_WORK_AUTHORITY_AND_NO_WORK_AUTHORITY_REQUIRED",
  fallback: "UNRESOLVED",
});

export type MobilityUsageBand = "AROUND_WORK" | "OUTSIDE_WORK" | "UNRESOLVED";
export type MobilityNarrativeDestination = "ROUTINE_GROUP" | "TRIP_SUMMARY" | "SUPPRESSED";
export type MobilitySemanticFamily =
  | "WORK"
  | "GROCERY"
  | "FAMILY"
  | "FRIEND"
  | "HEALTH"
  | "LEISURE"
  | "TRAVEL"
  | "PERSONAL"
  | "OTHER";
export type MobilityPlaceRole =
  | "HOME"
  | "WORK"
  | "GROCERY"
  | "FAMILY"
  | "FRIEND"
  | "HEALTH"
  | "LEISURE"
  | "TRAVEL"
  | "PERSONAL"
  | "OTHER";
export type MobilityRoutinePattern =
  | "WORK_ONLY"
  | "WORK_GROCERY"
  | "GROCERY_ONLY"
  | "WORKDAY_OUTING"
  | "FAMILY_DESTINATION"
  | "FAMILY_CIRCUIT"
  | "GENERIC";

export type MobilityNarrativeMetricTotals = {
  readonly distanceKm: string;
  readonly estimatedFuelLiters: string;
  readonly estimatedFuelCost: string;
};

export type MonthlyMobilityNarrativeLegInput = {
  readonly mobilityLegId: string;
  readonly sequenceIndex: number;
  readonly travelDate: string;
  readonly originPlaceId: string | null;
  readonly destinationPlaceId: string | null;
  readonly distanceKm: string;
  readonly estimatedFuelLiters: string;
  readonly estimatedFuelCost: string;
};

export type MonthlyMobilityNarrativeTripInput = {
  readonly mobilityTripId: string;
  readonly householdId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly tripShape: "DIRECT" | "ROUND_TRIP" | "MULTI_STOP_CIRCUIT" | "LOCAL_LOOP" | "MULTI_DAY_JOURNEY" | "OPEN_CHAIN";
  readonly boundaryStatus: string;
  readonly knowledgeState: "KNOWN" | "PARTIAL" | "CONFLICT";
  readonly legs: readonly MonthlyMobilityNarrativeLegInput[];
};

export type MonthlyMobilityNarrativeContextInput = {
  readonly mobilityTripContextLinkId: string;
  readonly mobilityTripId: string;
  readonly targetKind: "MOMENT" | "LIFE_EVENT";
  /** Stable semantic target retained for bounded Query V2 navigation. */
  readonly targetRef?: `moment:${string}` | `life-event:${string}`;
  readonly relationType:
    | "PRIMARY_CONTEXT"
    | "ENVELOPING_CONTEXT"
    | "DESTINATION_CONTEXT"
    | "ORIGIN_CONTEXT"
    | "STOP_CONTEXT"
    | "ACCESS_CONTEXT"
    | "ASSOCIATED_CONTEXT";
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: 1 | 2 | 3 | 4;
  readonly validationStatus: "CONFIRMED" | "DERIVED";
  readonly displayLabel: string | null;
  readonly anchorPlaceId: string | null;
  readonly evidenceRefs: readonly string[];
};

export type MonthlyMobilityPlaceAuthority = {
  readonly placeId: string;
  readonly role: MobilityPlaceRole;
  readonly displayLabel: string | null;
  readonly authority: "CONFIRMED" | "EXPLICIT" | "DERIVED";
};

export type MonthlyMobilityPartitionAssignment = {
  readonly mobilityTripId: string;
  readonly destination: MobilityNarrativeDestination;
  readonly destinationRef: string;
  readonly usageBand: MobilityUsageBand;
};

export type MonthlyMobilityRoutineGroup = {
  readonly routineGroupId: string;
  readonly pattern: MobilityRoutinePattern;
  readonly title: string;
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: number;
  readonly usageBand: MobilityUsageBand;
  readonly occurrenceCount: number;
  readonly annualOccurrenceCount: number;
  readonly mobilityTripIds: readonly string[];
  readonly monthContribution: MobilityNarrativeMetricTotals;
  readonly fullTrips: MobilityNarrativeMetricTotals;
};

export type MonthlyMobilityTripSummary = {
  readonly tripSummaryId: string;
  readonly mobilityTripId: string;
  readonly title: string;
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: number;
  readonly usageBand: MobilityUsageBand;
  readonly multiDay: boolean;
  readonly crossMonth: boolean;
  readonly startDate: string;
  readonly endDate: string;
  readonly targetKind?: MonthlyMobilityNarrativeContextInput["targetKind"];
  readonly targetRef?: `moment:${string}` | `life-event:${string}`;
  readonly monthContribution: MobilityNarrativeMetricTotals;
  readonly fullTrip: MobilityNarrativeMetricTotals;
};

export type MonthlyMobilityContextOnly = {
  readonly contextOnlyId: string;
  readonly mobilityTripId: string;
  readonly title: string;
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: number;
  readonly usageBand: MobilityUsageBand;
  readonly relationType: MonthlyMobilityNarrativeContextInput["relationType"];
  readonly targetKind?: MonthlyMobilityNarrativeContextInput["targetKind"];
  readonly targetRef?: `moment:${string}` | `life-event:${string}`;
};

export type MonthlyMobilityNarrativeDestination = {
  readonly targetKind: MonthlyMobilityNarrativeContextInput["targetKind"];
  readonly targetRef: `moment:${string}` | `life-event:${string}`;
  readonly title: string;
};

export type MonthlyMobilitySuppressedRemainder = {
  readonly tripCount: number;
  readonly mobilityTripIds: readonly string[];
  readonly displayText: string;
  readonly internalReconciliation: MobilityNarrativeMetricTotals;
};

export type MonthlyMobilityUsageBands = {
  readonly aroundWork: MobilityNarrativeMetricTotals;
  readonly outsideWork: MobilityNarrativeMetricTotals;
  readonly unresolved: MobilityNarrativeMetricTotals;
  readonly modeledUsage: MobilityNarrativeMetricTotals;
  readonly classificationCoverage: string;
};

export type MonthlyMobilityNarrative = {
  readonly month: string;
  readonly routineGroups: readonly MonthlyMobilityRoutineGroup[];
  readonly tripSummaries: readonly MonthlyMobilityTripSummary[];
  readonly contextOnly: readonly MonthlyMobilityContextOnly[];
  readonly destinations: readonly MonthlyMobilityNarrativeDestination[];
  readonly suppressedRemainder: MonthlyMobilitySuppressedRemainder;
  readonly partition: readonly MonthlyMobilityPartitionAssignment[];
  readonly usageBands: MonthlyMobilityUsageBands;
  readonly initialSurface: readonly { readonly kind: "ROUTINE_GROUP" | "TRIP_SUMMARY" | "CONTEXT_ONLY"; readonly ref: string }[];
};

export type AnnualMobilityNarrativeCandidate = {
  readonly annualNarrativeCandidateId: string;
  readonly kind: "ROUTINE_GROUP" | "TRIP_SUMMARY";
  readonly title: string;
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: number;
  readonly occurrenceCount: number;
  readonly estimatedFuelCost: string;
};

export type MonthlyMobilityNarrativeResult = {
  readonly methodVersion: typeof MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION;
  readonly routineGroupPolicy: typeof MOBILITY_ROUTINE_GROUP_POLICY;
  readonly usageBandPolicy: typeof MOBILITY_USAGE_BAND_POLICY;
  readonly months: readonly MonthlyMobilityNarrative[];
  readonly annualNarrativeCandidates: readonly AnnualMobilityNarrativeCandidate[];
  readonly annualUsageBands: MonthlyMobilityUsageBands;
  readonly inputHash: string;
  readonly outputHash: string;
};

type TripProfile = {
  readonly trip: MonthlyMobilityNarrativeTripInput;
  readonly contexts: readonly MonthlyMobilityNarrativeContextInput[];
  readonly placeRoles: readonly MobilityPlaceRole[];
  readonly familyPlaceIds: readonly string[];
  readonly routinePattern: MobilityRoutinePattern;
  readonly routineKey: string;
  readonly routineTitle: string;
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: number;
  readonly usageBand: MobilityUsageBand;
  readonly fullTrip: MobilityNarrativeMetricTotals;
  readonly months: readonly string[];
  readonly multiDay: boolean;
  readonly crossMonth: boolean;
  readonly importantContext: boolean;
};

type RankedArtifact = {
  readonly kind: "ROUTINE_GROUP" | "TRIP_SUMMARY" | "CONTEXT_ONLY";
  readonly ref: string;
  readonly semanticFamily: MobilitySemanticFamily;
  readonly semanticTier: number;
  readonly mandatory: boolean;
  readonly multiDayOrCrossMonth: boolean;
  readonly monthCostShare: Big;
  readonly estimatedFuelCost: Big;
  readonly occurrenceCount: number;
  readonly startDate: string;
};

const technicalToken = /(^|[^A-Z0-9])(NAV|JOUR|AUT|MobilityLeg)([^A-Z0-9]|$)/u;
const zeroTotals = (): MobilityNarrativeMetricTotals => ({ distanceKm: "0", estimatedFuelLiters: "0", estimatedFuelCost: "0" });
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const stableId = (prefix: string, value: unknown) => `${prefix}:${digest(value).slice(0, 32)}`;
const unique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));
const monthOf = (date: string) => date.slice(0, 7);

const semanticFamilyByTypeKey: Readonly<Record<string, MobilitySemanticFamily>> = Object.freeze({
  travail_site: "WORK",
  deplacement_pro: "WORK",
  courses_alimentaires: "GROCERY",
  shopping_commerce: "GROCERY",
  visite_famille: "FAMILY",
  funeraire: "FAMILY",
  visite_ami: "FRIEND",
  rdv_medical: "HEALTH",
  pharmacie: "HEALTH",
  activite_loisir: "LEISURE",
  spectacle_culture: "LEISURE",
  repas_restaurant: "LEISURE",
  sortie_soiree: "LEISURE",
  voyage_sejour: "TRAVEL",
  soin_personnel: "PERSONAL",
  demarche_admin: "PERSONAL",
  entretien_voiture: "PERSONAL",
});

export function resolveMobilityNarrativeSemanticFamily(typeKey: string): MobilitySemanticFamily {
  return semanticFamilyByTypeKey[typeKey] ?? "OTHER";
}

export function resolveMobilityNarrativePlaceRole(input: {
  readonly usagePrincipal: string | null;
  readonly explicitRoles: readonly string[];
}): MobilityPlaceRole {
  if (input.explicitRoles.includes("PRIMARY_WORK") || input.usagePrincipal === "Travail") return "WORK";
  if (input.usagePrincipal === "Domicile") return "HOME";
  if (input.usagePrincipal === "Courses") return "GROCERY";
  if (input.explicitRoles.some((role) => role === "FATHER_HOME" || role === "MATERNAL_FAMILY_HOME") || input.usagePrincipal === "Famille") return "FAMILY";
  if (input.explicitRoles.includes("SOCIAL_ANCHOR") || input.usagePrincipal === "Ami") return "FRIEND";
  if (input.usagePrincipal === "Santé") return "HEALTH";
  if (["Loisir", "Bar / soirée", "Bar / restaurant", "Restauration", "Événement / célébration", "Déplacement / sortie"].includes(input.usagePrincipal ?? "")) return "LEISURE";
  if (["Séjour / voyage", "Transport / voyage"].includes(input.usagePrincipal ?? "")) return "TRAVEL";
  if (input.explicitRoles.includes("PERSONAL_CARE_ANCHOR") || ["Soins personnels", "Administratif / juridique", "Achat / récupération", "Funéraire"].includes(input.usagePrincipal ?? "")) return "PERSONAL";
  if (input.usagePrincipal === "Shopping") return "GROCERY";
  return "OTHER";
}

function safeLabel(value: string | null): string | null {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  if (!normalized || technicalToken.test(normalized)) return null;
  return normalized;
}

function totals(legs: readonly MonthlyMobilityNarrativeLegInput[]): MobilityNarrativeMetricTotals {
  const sum = (pick: (leg: MonthlyMobilityNarrativeLegInput) => string) =>
    legs.reduce((total, leg) => total.plus(pick(leg)), new Big(0)).toString();
  return {
    distanceKm: sum((leg) => leg.distanceKm),
    estimatedFuelLiters: sum((leg) => leg.estimatedFuelLiters),
    estimatedFuelCost: sum((leg) => leg.estimatedFuelCost),
  };
}

function addTotals(values: readonly MobilityNarrativeMetricTotals[]): MobilityNarrativeMetricTotals {
  const sum = (pick: (value: MobilityNarrativeMetricTotals) => string) =>
    values.reduce((total, value) => total.plus(pick(value)), new Big(0)).toString();
  return {
    distanceKm: sum((value) => value.distanceKm),
    estimatedFuelLiters: sum((value) => value.estimatedFuelLiters),
    estimatedFuelCost: sum((value) => value.estimatedFuelCost),
  };
}

function contextLabel(family: MobilitySemanticFamily): string {
  if (family === "WORK") return "Déplacement professionnel";
  if (family === "GROCERY") return "Courses en voiture";
  if (family === "FAMILY") return "Visite famille";
  if (family === "FRIEND") return "Visite à des amis";
  if (family === "HEALTH") return "Déplacement santé";
  if (family === "LEISURE") return "Sortie personnelle";
  if (family === "TRAVEL") return "Séjour ou voyage";
  if (family === "PERSONAL") return "Déplacement personnel";
  return "Déplacement documenté";
}

function familyTitle(prefix: "Visites famille" | "Circuit famille", places: readonly MonthlyMobilityPlaceAuthority[]): string {
  const labels = unique(places.flatMap(({ displayLabel }) => {
    const label = safeLabel(displayLabel);
    return label === null ? [] : [label];
  }));
  return labels.length === 0 ? prefix : `${prefix} — ${labels.join(" et ")}`;
}

function routineProfile(
  trip: MonthlyMobilityNarrativeTripInput,
  contexts: readonly MonthlyMobilityNarrativeContextInput[],
  places: ReadonlyMap<string, MonthlyMobilityPlaceAuthority>,
) {
  const orderedLegs = [...trip.legs].sort((left, right) => left.sequenceIndex - right.sequenceIndex || left.mobilityLegId.localeCompare(right.mobilityLegId));
  const endpointIds = orderedLegs.flatMap(({ originPlaceId, destinationPlaceId }) => [originPlaceId, destinationPlaceId]).filter((value): value is string => value !== null);
  const endpointAuthorities = endpointIds.flatMap((placeId) => {
    const place = places.get(placeId);
    return place === undefined || place.authority === "DERIVED" ? [] : [place];
  });
  const roles = endpointAuthorities.map(({ role }) => role);
  const strongContexts = contexts.filter(({ validationStatus, semanticFamily }) =>
    validationStatus === "CONFIRMED" && semanticFamily !== "OTHER");
  const families = strongContexts.map(({ semanticFamily }) => semanticFamily);
  const has = (role: MobilityPlaceRole, family: MobilitySemanticFamily) => roles.includes(role) || families.includes(family);
  const hasHome = roles.includes("HOME");
  const hasWork = has("WORK", "WORK");
  const hasGrocery = has("GROCERY", "GROCERY");
  const familyPlaces = unique(endpointAuthorities.filter(({ role }) => role === "FAMILY").map(({ placeId }) => placeId));
  const nonWorkPersonal = roles.some((role) => ["FAMILY", "FRIEND", "HEALTH", "LEISURE", "PERSONAL"].includes(role))
    || families.some((family) => ["FAMILY", "FRIEND", "HEALTH", "LEISURE", "PERSONAL"].includes(family));
  const closed = trip.boundaryStatus === "CLOSED_HOME" || trip.boundaryStatus === "CLOSED_SAME_ANCHOR";
  let pattern: MobilityRoutinePattern = "GENERIC";
  let key = `generic:${unique(roles).join("+") || "unknown"}`;
  let title = "Déplacements récurrents";
  let family: MobilitySemanticFamily = "OTHER";
  let tier = 4;
  if (hasWork && hasGrocery && closed) {
    pattern = "WORK_GROCERY"; key = "work-grocery"; title = "Travail + courses"; family = "WORK"; tier = 2;
  } else if (hasWork && nonWorkPersonal && closed) {
    pattern = "WORKDAY_OUTING"; key = "workday-outing"; title = "Déplacements pendant la journée de travail"; family = "WORK"; tier = 2;
  } else if (hasWork && hasHome && closed) {
    pattern = "WORK_ONLY"; key = "work-only"; title = "Trajets travail"; family = "WORK"; tier = 2;
  } else if (hasGrocery && hasHome && closed) {
    pattern = "GROCERY_ONLY"; key = "grocery-only"; title = "Courses en voiture"; family = "GROCERY"; tier = 3;
  } else if (familyPlaces.length > 1 && closed) {
    pattern = "FAMILY_CIRCUIT"; key = `family-circuit:${familyPlaces.join("+")}`;
    title = familyTitle("Circuit famille", familyPlaces.map((id) => places.get(id)!).filter(Boolean)); family = "FAMILY"; tier = 2;
  } else if (familyPlaces.length === 1 && closed) {
    pattern = "FAMILY_DESTINATION"; key = `family-destination:${familyPlaces[0]}`;
    title = familyTitle("Visites famille", [places.get(familyPlaces[0])!].filter(Boolean)); family = "FAMILY"; tier = 2;
  }
  return { pattern, key, title, family, tier, roles: unique(roles), familyPlaces, hasWork, hasEstablishedNonWork: hasGrocery || nonWorkPersonal || families.includes("TRAVEL") };
}

function usageBand(profile: ReturnType<typeof routineProfile>): MobilityUsageBand {
  if (profile.hasWork) return "AROUND_WORK";
  if (profile.hasEstablishedNonWork) return "OUTSIDE_WORK";
  return "UNRESOLVED";
}

function strongestContext(contexts: readonly MonthlyMobilityNarrativeContextInput[]) {
  return [...contexts].sort((left, right) => left.semanticTier - right.semanticTier
    || Number(right.relationType === "PRIMARY_CONTEXT" || right.relationType === "ENVELOPING_CONTEXT")
      - Number(left.relationType === "PRIMARY_CONTEXT" || left.relationType === "ENVELOPING_CONTEXT")
    || left.mobilityTripContextLinkId.localeCompare(right.mobilityTripContextLinkId))[0];
}

function profileTrips(input: {
  readonly trips: readonly MonthlyMobilityNarrativeTripInput[];
  readonly contexts: readonly MonthlyMobilityNarrativeContextInput[];
  readonly places: readonly MonthlyMobilityPlaceAuthority[];
}): readonly TripProfile[] {
  const places = new Map(input.places.map((place) => [place.placeId, place]));
  const contextsByTrip = new Map<string, MonthlyMobilityNarrativeContextInput[]>();
  for (const context of input.contexts) {
    const values = contextsByTrip.get(context.mobilityTripId) ?? [];
    values.push(context);
    contextsByTrip.set(context.mobilityTripId, values);
  }
  return [...input.trips].sort((left, right) => left.mobilityTripId.localeCompare(right.mobilityTripId)).map((trip) => {
    if (trip.legs.length === 0) throw new TypeError(`MONTHLY_MOBILITY_EMPTY_TRIP:${trip.mobilityTripId}`);
    const contexts = (contextsByTrip.get(trip.mobilityTripId) ?? []).sort((left, right) => left.mobilityTripContextLinkId.localeCompare(right.mobilityTripContextLinkId));
    const routine = routineProfile(trip, contexts, places);
    const months = unique(trip.legs.map(({ travelDate }) => monthOf(travelDate)));
    const strongest = strongestContext(contexts);
    return {
      trip,
      contexts,
      placeRoles: routine.roles,
      familyPlaceIds: routine.familyPlaces,
      routinePattern: routine.pattern,
      routineKey: routine.key,
      routineTitle: routine.title,
      semanticFamily: strongest?.semanticFamily ?? routine.family,
      semanticTier: Math.min(strongest?.semanticTier ?? 4, routine.tier),
      usageBand: usageBand(routine),
      fullTrip: totals(trip.legs),
      months,
      multiDay: trip.tripShape === "MULTI_DAY_JOURNEY" || trip.startDate !== trip.endDate,
      crossMonth: months.length > 1,
      importantContext: contexts.some(({ relationType, semanticFamily, semanticTier }) =>
        relationType === "PRIMARY_CONTEXT" || relationType === "ENVELOPING_CONTEXT"
        || semanticFamily === "TRAVEL" || semanticTier === 1),
    };
  });
}

function routineThreshold(pattern: MobilityRoutinePattern, monthly: number, annual: number): boolean {
  if (["WORK_ONLY", "WORK_GROCERY", "GROCERY_ONLY", "WORKDAY_OUTING"].includes(pattern)) {
    return monthly >= MOBILITY_ROUTINE_GROUP_POLICY.workPatternMinimumMonthlyTrips;
  }
  if (["FAMILY_DESTINATION", "FAMILY_CIRCUIT"].includes(pattern)) {
    return monthly >= MOBILITY_ROUTINE_GROUP_POLICY.repeatedDestinationMinimumMonthlyTrips
      && annual >= MOBILITY_ROUTINE_GROUP_POLICY.repeatedDestinationMinimumAnnualTrips;
  }
  return monthly >= MOBILITY_ROUTINE_GROUP_POLICY.genericMinimumMonthlyTrips
    || (annual >= MOBILITY_ROUTINE_GROUP_POLICY.genericMinimumAnnualTrips
      && monthly >= MOBILITY_ROUTINE_GROUP_POLICY.genericAnnualMinimumMonthlyTrips);
}

function contribution(profile: TripProfile, month: string): MobilityNarrativeMetricTotals {
  return totals(profile.trip.legs.filter(({ travelDate }) => monthOf(travelDate) === month));
}

function artifactComparator(left: RankedArtifact, right: RankedArtifact): number {
  return left.semanticTier - right.semanticTier
    || Number(right.mandatory) - Number(left.mandatory)
    || Number(right.multiDayOrCrossMonth) - Number(left.multiDayOrCrossMonth)
    || right.monthCostShare.cmp(left.monthCostShare)
    || right.estimatedFuelCost.cmp(left.estimatedFuelCost)
    || right.occurrenceCount - left.occurrenceCount
    || left.startDate.localeCompare(right.startDate)
    || left.ref.localeCompare(right.ref);
}

function tripTitle(profile: TripProfile): string {
  const context = strongestContext(profile.contexts);
  const supplied = safeLabel(context?.displayLabel ?? null);
  if (supplied !== null && (context?.relationType === "PRIMARY_CONTEXT" || context?.relationType === "ENVELOPING_CONTEXT")) return supplied;
  if (profile.routinePattern !== "GENERIC") return profile.routineTitle;
  if (profile.multiDay) return profile.semanticFamily === "TRAVEL" ? "Séjour ou voyage" : "Déplacement sur plusieurs jours";
  return contextLabel(profile.semanticFamily);
}

function assertPartition(month: string, profiles: readonly TripProfile[], partition: readonly MonthlyMobilityPartitionAssignment[]) {
  const expected = unique(profiles.map(({ trip }) => trip.mobilityTripId));
  const actual = partition.map(({ mobilityTripId }) => mobilityTripId).sort((left, right) => left.localeCompare(right));
  if (new Set(actual).size !== actual.length || JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new TypeError(`MONTHLY_MOBILITY_PARTITION_INVALID:${month}`);
  }
}

function buildInitialSurface(artifacts: readonly RankedArtifact[]) {
  const ordered = [...artifacts].sort(artifactComparator);
  const mandatory = ordered.filter(({ mandatory }) => mandatory);
  const selected: RankedArtifact[] = mandatory.slice(0, 5);
  const add = (candidate: RankedArtifact | undefined) => {
    if (candidate !== undefined && selected.length < 5 && !selected.some(({ ref }) => ref === candidate.ref)) selected.push(candidate);
  };
  if (selected.length < 5) add(ordered.find(({ kind }) => kind === "ROUTINE_GROUP"));
  const target = Math.min(4, ordered.length);
  for (const candidate of ordered) {
    if (selected.length >= target) break;
    if (!selected.some(({ semanticFamily }) => semanticFamily === candidate.semanticFamily)) add(candidate);
  }
  for (const candidate of ordered) {
    if (selected.length >= target) break;
    add(candidate);
  }
  return selected.sort(artifactComparator).map(({ kind, ref }) => ({ kind, ref }));
}

function buildUsageBands(profiles: readonly TripProfile[], month: string): MonthlyMobilityUsageBands {
  const bucket = (band: MobilityUsageBand) => addTotals(profiles.filter(({ usageBand }) => usageBand === band).map((profile) => contribution(profile, month)));
  const aroundWork = bucket("AROUND_WORK");
  const outsideWork = bucket("OUTSIDE_WORK");
  const unresolved = bucket("UNRESOLVED");
  const modeledUsage = addTotals([aroundWork, outsideWork, unresolved]);
  const totalCost = new Big(modeledUsage.estimatedFuelCost);
  const coverage = totalCost.eq(0) ? new Big(1) : totalCost.minus(unresolved.estimatedFuelCost).div(totalCost);
  return { aroundWork, outsideWork, unresolved, modeledUsage, classificationCoverage: coverage.toFixed(6) };
}

function buildMonth(month: string, allProfiles: readonly TripProfile[]): MonthlyMobilityNarrative {
  const profiles = allProfiles.filter(({ months }) => months.includes(month));
  const usageBands = buildUsageBands(profiles, month);
  const monthCost = new Big(usageBands.modeledUsage.estimatedFuelCost);
  const orderedTripCosts = profiles.map((profile) => new Big(contribution(profile, month).estimatedFuelCost))
    .sort((left, right) => left.cmp(right));
  const medianTripCost = orderedTripCosts.length === 0 ? new Big(0) : orderedTripCosts[Math.floor((orderedTripCosts.length - 1) / 2)];
  const exceptionallyMaterial = (profile: TripProfile) => {
    const cost = new Big(contribution(profile, month).estimatedFuelCost);
    const share = monthCost.eq(0) ? new Big(0) : cost.div(monthCost);
    return cost.gt(0)
      && share.gte(MOBILITY_ROUTINE_GROUP_POLICY.exceptionalMaterialityMonthCostShare)
      && (medianTripCost.eq(0) || cost.gte(medianTripCost.times(MOBILITY_ROUTINE_GROUP_POLICY.exceptionalMaterialityMedianMultiplier)));
  };
  const annualCounts = new Map<string, number>();
  for (const profile of allProfiles) annualCounts.set(profile.routineKey, (annualCounts.get(profile.routineKey) ?? 0) + 1);
  const eligible = profiles.filter((profile) => {
    return !profile.multiDay && !profile.crossMonth && !profile.importantContext
      && profile.trip.knowledgeState === "KNOWN"
      && !profile.trip.boundaryStatus.startsWith("OPEN_")
      && !profile.trip.boundaryStatus.startsWith("WINDOW_TRUNCATED_")
      && !exceptionallyMaterial(profile);
  });
  const byRoutine = new Map<string, TripProfile[]>();
  for (const profile of eligible) byRoutine.set(profile.routineKey, [...(byRoutine.get(profile.routineKey) ?? []), profile]);
  const routineCandidates = [...byRoutine].flatMap(([key, members]) => {
    const annual = annualCounts.get(key) ?? members.length;
    if (!routineThreshold(members[0].routinePattern, members.length, annual)) return [];
    const monthContribution = addTotals(members.map((profile) => contribution(profile, month)));
    return [{
      routineGroupId: stableId("mobility-routine", [month, key]),
      pattern: members[0].routinePattern,
      title: members[0].routineTitle,
      semanticFamily: members[0].semanticFamily,
      semanticTier: members[0].semanticTier,
      usageBand: members[0].usageBand,
      occurrenceCount: members.length,
      annualOccurrenceCount: annual,
      mobilityTripIds: members.map(({ trip }) => trip.mobilityTripId).sort((left, right) => left.localeCompare(right)),
      monthContribution,
      fullTrips: addTotals(members.map(({ fullTrip }) => fullTrip)),
      startDate: members.map(({ trip }) => trip.startDate).sort()[0]!,
    }];
  }).sort((left, right) => left.semanticTier - right.semanticTier
    || new Big(right.monthContribution.estimatedFuelCost).cmp(left.monthContribution.estimatedFuelCost)
    || right.occurrenceCount - left.occurrenceCount
    || left.routineGroupId.localeCompare(right.routineGroupId))
    .slice(0, MOBILITY_ROUTINE_GROUP_POLICY.maximumRoutineGroups);
  const routineByTrip = new Map(routineCandidates.flatMap((group) => group.mobilityTripIds.map((tripId) => [tripId, group] as const)));
  const pending = profiles.filter(({ trip }) => !routineByTrip.has(trip.mobilityTripId));
  const rankedPending = pending.map((profile) => {
    const metric = contribution(profile, month);
    const share = monthCost.eq(0) ? new Big(0) : new Big(metric.estimatedFuelCost).div(monthCost);
    const mandatory = profile.importantContext || profile.multiDay || profile.crossMonth || exceptionallyMaterial(profile);
    return { profile, metric, share, mandatory };
  }).sort((left, right) => artifactComparator({
    kind: "TRIP_SUMMARY", ref: left.profile.trip.mobilityTripId, semanticFamily: left.profile.semanticFamily,
    semanticTier: left.profile.semanticTier, mandatory: left.mandatory, multiDayOrCrossMonth: left.profile.multiDay || left.profile.crossMonth,
    monthCostShare: left.share, estimatedFuelCost: new Big(left.metric.estimatedFuelCost), occurrenceCount: 1, startDate: left.profile.trip.startDate,
  }, {
    kind: "TRIP_SUMMARY", ref: right.profile.trip.mobilityTripId, semanticFamily: right.profile.semanticFamily,
    semanticTier: right.profile.semanticTier, mandatory: right.mandatory, multiDayOrCrossMonth: right.profile.multiDay || right.profile.crossMonth,
    monthCostShare: right.share, estimatedFuelCost: new Big(right.metric.estimatedFuelCost), occurrenceCount: 1, startDate: right.profile.trip.startDate,
  }));
  const summaryCandidates = rankedPending.filter(({ profile, mandatory }) => mandatory || profile.usageBand !== "UNRESOLVED").slice(0, 12);
  const summaryTripIds = new Set(summaryCandidates.map(({ profile }) => profile.trip.mobilityTripId));
  const tripSummaries: MonthlyMobilityTripSummary[] = summaryCandidates.map(({ profile, metric }) => {
    const target = strongestContext(profile.contexts);
    return {
      tripSummaryId: stableId("mobility-trip-summary", [month, profile.trip.mobilityTripId]),
      mobilityTripId: profile.trip.mobilityTripId,
      title: tripTitle(profile),
      semanticFamily: profile.semanticFamily,
      semanticTier: profile.semanticTier,
      usageBand: profile.usageBand,
      multiDay: profile.multiDay,
      crossMonth: profile.crossMonth,
      startDate: profile.trip.startDate,
      endDate: profile.trip.endDate,
      ...(target?.targetRef === undefined ? {} : { targetKind: target.targetKind, targetRef: target.targetRef }),
      monthContribution: metric,
      fullTrip: profile.fullTrip,
    };
  });
  const suppressed = pending.filter(({ trip }) => !summaryTripIds.has(trip.mobilityTripId));
  const contextCandidates = profiles.flatMap((profile) => profile.contexts.map((context) => ({ profile, context })))
    .filter(({ profile, context }) => !summaryTripIds.has(profile.trip.mobilityTripId) && context.semanticTier <= 2)
    .sort((left, right) => left.context.semanticTier - right.context.semanticTier
      || left.context.mobilityTripContextLinkId.localeCompare(right.context.mobilityTripContextLinkId));
  const seenContext = new Set<string>();
  const contextOnly: MonthlyMobilityContextOnly[] = [];
  for (const { profile, context } of contextCandidates) {
    const title = safeLabel(context.displayLabel) ?? contextLabel(context.semanticFamily);
    const identity = `${profile.trip.mobilityTripId}|${context.semanticFamily}|${title}`;
    if (seenContext.has(identity)) continue;
    seenContext.add(identity);
    contextOnly.push({
      contextOnlyId: stableId("mobility-context-only", [month, context.mobilityTripContextLinkId]),
      mobilityTripId: profile.trip.mobilityTripId,
      title,
      semanticFamily: context.semanticFamily,
      semanticTier: context.semanticTier,
      usageBand: profile.usageBand,
      relationType: context.relationType,
      ...(context.targetRef === undefined ? {} : { targetKind: context.targetKind, targetRef: context.targetRef }),
    });
    if (contextOnly.length === 4) break;
  }
  const partition = profiles.map((profile): MonthlyMobilityPartitionAssignment => {
    const group = routineByTrip.get(profile.trip.mobilityTripId);
    if (group !== undefined) return { mobilityTripId: profile.trip.mobilityTripId, destination: "ROUTINE_GROUP", destinationRef: group.routineGroupId, usageBand: profile.usageBand };
    const summary = tripSummaries.find(({ mobilityTripId }) => mobilityTripId === profile.trip.mobilityTripId);
    if (summary !== undefined) return { mobilityTripId: profile.trip.mobilityTripId, destination: "TRIP_SUMMARY", destinationRef: summary.tripSummaryId, usageBand: profile.usageBand };
    return { mobilityTripId: profile.trip.mobilityTripId, destination: "SUPPRESSED", destinationRef: `suppressed:${month}`, usageBand: profile.usageBand };
  }).sort((left, right) => left.mobilityTripId.localeCompare(right.mobilityTripId));
  assertPartition(month, profiles, partition);
  const artifacts: RankedArtifact[] = [
    ...routineCandidates.map((group) => ({
      kind: "ROUTINE_GROUP" as const, ref: group.routineGroupId, semanticFamily: group.semanticFamily, semanticTier: group.semanticTier,
      mandatory: false, multiDayOrCrossMonth: false,
      monthCostShare: monthCost.eq(0) ? new Big(0) : new Big(group.monthContribution.estimatedFuelCost).div(monthCost),
      estimatedFuelCost: new Big(group.monthContribution.estimatedFuelCost), occurrenceCount: group.occurrenceCount, startDate: group.startDate,
    })),
    ...tripSummaries.map((summary) => ({
      kind: "TRIP_SUMMARY" as const, ref: summary.tripSummaryId, semanticFamily: summary.semanticFamily, semanticTier: summary.semanticTier,
      mandatory: summary.multiDay || summary.crossMonth || profiles.find(({ trip }) => trip.mobilityTripId === summary.mobilityTripId)!.importantContext,
      multiDayOrCrossMonth: summary.multiDay || summary.crossMonth,
      monthCostShare: monthCost.eq(0) ? new Big(0) : new Big(summary.monthContribution.estimatedFuelCost).div(monthCost),
      estimatedFuelCost: new Big(summary.monthContribution.estimatedFuelCost), occurrenceCount: 1, startDate: summary.startDate,
    })),
    ...contextOnly.map((context) => ({
      kind: "CONTEXT_ONLY" as const, ref: context.contextOnlyId, semanticFamily: context.semanticFamily, semanticTier: context.semanticTier,
      mandatory: false, multiDayOrCrossMonth: false, monthCostShare: new Big(0), estimatedFuelCost: new Big(0), occurrenceCount: 1,
      startDate: profiles.find(({ trip }) => trip.mobilityTripId === context.mobilityTripId)!.trip.startDate,
    })),
  ];
  const destinations = [...new Map(profiles.flatMap(({ contexts }) => contexts.flatMap((context) => context.targetRef === undefined ? [] : [[context.targetRef, {
    targetKind: context.targetKind,
    targetRef: context.targetRef,
    title: safeLabel(context.displayLabel) ?? contextLabel(context.semanticFamily),
  }] as const]))).values()].sort((left, right) => left.targetRef.localeCompare(right.targetRef)).slice(0, 16);
  const result: MonthlyMobilityNarrative = {
    month,
    routineGroups: routineCandidates.map(({ startDate: _startDate, ...group }) => group),
    tripSummaries,
    contextOnly,
    destinations,
    suppressedRemainder: {
      tripCount: suppressed.length,
      mobilityTripIds: suppressed.map(({ trip }) => trip.mobilityTripId).sort((left, right) => left.localeCompare(right)),
      displayText: `+ ${suppressed.length} autres déplacements inclus dans le total mensuel`,
      internalReconciliation: addTotals(suppressed.map((profile) => contribution(profile, month))),
    },
    partition,
    usageBands,
    initialSurface: buildInitialSurface(artifacts),
  };
  if (result.routineGroups.length > 3 || result.tripSummaries.length > 12 || result.contextOnly.length > 4 || result.initialSurface.length > 5) {
    throw new TypeError(`MONTHLY_MOBILITY_NARRATIVE_LIMIT_FAILED:${month}`);
  }
  if (technicalToken.test(canonicalSerializeGlobal({
    routineGroups: result.routineGroups.map(({ title }) => title),
    tripSummaries: result.tripSummaries.map(({ title }) => title),
    contextOnly: result.contextOnly.map(({ title }) => title),
    suppressed: result.suppressedRemainder.displayText,
  }))) throw new TypeError(`MONTHLY_MOBILITY_TECHNICAL_LABEL_LEAK:${month}`);
  return result;
}

function annualCandidates(months: readonly MonthlyMobilityNarrative[]): readonly AnnualMobilityNarrativeCandidate[] {
  const grouped = new Map<string, AnnualMobilityNarrativeCandidate>();
  for (const month of months) {
    for (const group of month.routineGroups) {
      const key = `routine:${group.pattern}:${group.title}`;
      const previous = grouped.get(key);
      grouped.set(key, {
        annualNarrativeCandidateId: stableId("annual-mobility", key),
        kind: "ROUTINE_GROUP",
        title: group.title,
        semanticFamily: group.semanticFamily,
        semanticTier: group.semanticTier,
        occurrenceCount: (previous?.occurrenceCount ?? 0) + group.occurrenceCount,
        estimatedFuelCost: new Big(previous?.estimatedFuelCost ?? 0).plus(group.monthContribution.estimatedFuelCost).toString(),
      });
    }
    for (const summary of month.tripSummaries.filter(({ multiDay, crossMonth, semanticTier }) => multiDay || crossMonth || semanticTier <= 2)) {
      const key = `trip:${summary.mobilityTripId}`;
      const previous = grouped.get(key);
      grouped.set(key, {
        annualNarrativeCandidateId: stableId("annual-mobility", key),
        kind: "TRIP_SUMMARY",
        title: summary.title,
        semanticFamily: summary.semanticFamily,
        semanticTier: summary.semanticTier,
        occurrenceCount: 1,
        estimatedFuelCost: new Big(previous?.estimatedFuelCost ?? 0).plus(summary.monthContribution.estimatedFuelCost).toString(),
      });
    }
  }
  return [...grouped.values()].sort((left, right) => left.semanticTier - right.semanticTier
    || new Big(right.estimatedFuelCost).cmp(left.estimatedFuelCost)
    || right.occurrenceCount - left.occurrenceCount
    || left.annualNarrativeCandidateId.localeCompare(right.annualNarrativeCandidateId)).slice(0, 5);
}

export function buildMonthlyMobilityNarrative(input: {
  readonly trips: readonly MonthlyMobilityNarrativeTripInput[];
  readonly contexts: readonly MonthlyMobilityNarrativeContextInput[];
  readonly places: readonly MonthlyMobilityPlaceAuthority[];
}): MonthlyMobilityNarrativeResult {
  const tripIds = input.trips.map(({ mobilityTripId }) => mobilityTripId);
  if (new Set(tripIds).size !== tripIds.length) throw new TypeError("MONTHLY_MOBILITY_DUPLICATE_TRIP");
  const membershipIds = input.trips.flatMap(({ legs }) => legs.map(({ mobilityLegId }) => mobilityLegId));
  if (new Set(membershipIds).size !== membershipIds.length) throw new TypeError("MONTHLY_MOBILITY_DUPLICATE_MEMBERSHIP");
  if (input.contexts.some(({ mobilityTripId }) => !tripIds.includes(mobilityTripId))) throw new TypeError("MONTHLY_MOBILITY_ORPHAN_CONTEXT");
  const profiles = profileTrips(input);
  const months = unique(profiles.flatMap(({ months: values }) => values)).map((month) => buildMonth(month, profiles));
  const annualAroundWork = addTotals(months.map(({ usageBands }) => usageBands.aroundWork));
  const annualOutsideWork = addTotals(months.map(({ usageBands }) => usageBands.outsideWork));
  const annualUnresolved = addTotals(months.map(({ usageBands }) => usageBands.unresolved));
  const annualModeledUsage = addTotals(months.map(({ usageBands }) => usageBands.modeledUsage));
  const annualTotal = new Big(annualModeledUsage.estimatedFuelCost);
  const annualUsageBands: MonthlyMobilityUsageBands = {
    aroundWork: annualAroundWork,
    outsideWork: annualOutsideWork,
    unresolved: annualUnresolved,
    modeledUsage: annualModeledUsage,
    classificationCoverage: annualTotal.eq(0)
    ? "1.000000"
    : annualTotal.minus(annualUnresolved.estimatedFuelCost).div(annualTotal).toFixed(6),
  };
  const inputHash = digest({
    trips: [...input.trips].sort((left, right) => left.mobilityTripId.localeCompare(right.mobilityTripId)).map((trip) => ({
      ...trip,
      legs: [...trip.legs].sort((left, right) => left.sequenceIndex - right.sequenceIndex || left.mobilityLegId.localeCompare(right.mobilityLegId)),
    })),
    contexts: [...input.contexts].sort((left, right) => left.mobilityTripContextLinkId.localeCompare(right.mobilityTripContextLinkId)),
    places: [...input.places].sort((left, right) => left.placeId.localeCompare(right.placeId)),
  });
  const output = {
    methodVersion: MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION,
    routineGroupPolicy: MOBILITY_ROUTINE_GROUP_POLICY,
    usageBandPolicy: MOBILITY_USAGE_BAND_POLICY,
    months,
    annualNarrativeCandidates: annualCandidates(months),
    annualUsageBands,
  };
  return { ...output, inputHash, outputHash: digest(output) };
}
