import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { ActivityOccurrenceFact } from "../facts";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { addMoney, compareMoney, parseMoney, type Money } from "../../core/money";
import { parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "../../core/time";
import type { GlobalM2MonthlyComponent } from "./category-needs";

export const GLOBAL_TIMELINE_CANDIDATE_ADAPTER_VERSION = "global-life-timeline-candidate-adapter@v1" as const;
export const GLOBAL_GROCERY_ADAPTER_VERSION = "global-grocery-household-month-adapter@v1" as const;
export const GLOBAL_GROCERY_PURCHASE_AWARE_ADAPTER_VERSION = "global-grocery-household-month-adapter@v2-purchase-aware" as const;
export const GLOBAL_GROCERY_BASKET_POLICY_VERSION = "global-grocery-basket-structure@v1" as const;

export const globalGroceryBasketPolicy = Object.freeze({
  policyVersion: GLOBAL_GROCERY_BASKET_POLICY_VERSION,
  quantileMethod: "TUKEY_HINGES_EXCLUSIVE_MEDIAN",
  monthlyCoverageMinimum: 0.7,
  historicalEligibleMonthMinimum: 8,
} as const);

const zero = parseMoney("0");
const digest = (value: unknown): string => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const uniqueSorted = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();

export type GlobalTimelineAdapterQuality = {
  readonly knowledgeState: "KNOWN" | "PARTIAL" | "UNKNOWN";
  readonly limitationCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalTimelineAdapterPlace = {
  readonly placeRef: string;
  readonly label?: string;
  readonly subtypeLabel?: string;
  readonly authority: "LIFE_EVENT_PRIMARY_PLACE" | "LIFE_EVENT_LOCALIZATION";
  readonly evidenceRefs: readonly string[];
};

type TimelineCausalCost =
  | { readonly status: "KNOWN" | "PARTIAL"; readonly value: Money }
  | { readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" };

export type GlobalTimelineMomentAdapterInput = {
  readonly momentId: string;
  readonly canonicalName: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly typeKey: string;
  readonly typeLabel: string;
  readonly familyKey: string;
  readonly momentStructure?: string;
  readonly participantRefs: readonly string[];
  readonly places: readonly GlobalTimelineAdapterPlace[];
  readonly primaryPlaceRef?: string;
  readonly causalCost: TimelineCausalCost;
  readonly seriesRef?: string;
  readonly comparisonSummary?: {
    readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
    readonly comparisonTier?: "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY";
    readonly peerCount: number;
  };
  readonly componentCount: number;
  readonly linkedLifeEventRefs: readonly string[];
  readonly quality: GlobalTimelineAdapterQuality;
};

export type GlobalTimelineLifeEventAdapterInput = {
  readonly lifeEventId: string;
  readonly canonicalTitle?: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly typeKey: string;
  readonly typeLabel: string;
  readonly familyKey: string;
  readonly participantRefs: readonly string[];
  readonly places: readonly GlobalTimelineAdapterPlace[];
  readonly primaryPlaceRef?: string;
  readonly parentLifeEventRef?: string;
  readonly seriesRef?: string;
  readonly role: "Dominant" | "Secondaire" | "Contextuel";
  readonly closed: boolean;
  readonly template: boolean;
  readonly ownedByCertifiedMoment: boolean;
  readonly quality: GlobalTimelineAdapterQuality;
};

export type GlobalTimelineCandidateEvent =
  | (Omit<GlobalTimelineMomentAdapterInput, "momentId"> & {
      readonly eventRef: string;
      readonly sourceKind: "MOMENT";
      readonly familySource: "M6";
    })
  | (Omit<GlobalTimelineLifeEventAdapterInput, "lifeEventId" | "canonicalTitle" | "role" | "closed" | "template" | "ownedByCertifiedMoment" | "parentLifeEventRef" | "seriesRef"> & {
      readonly eventRef: string;
      readonly sourceKind: "LIFE_EVENT";
      readonly canonicalName: string;
      readonly familySource: "LIFE_EVENT";
      readonly causalCost: { readonly status: "UNKNOWN" };
    });

export type GlobalTimelineCandidateBundle = {
  readonly adapterVersion: typeof GLOBAL_TIMELINE_CANDIDATE_ADAPTER_VERSION;
  readonly precedence: "CERTIFIED_MOMENT > AUTONOMOUS_DOMINANT_TITLED_LIFE_EVENT > DEFER";
  readonly sortContract: "startDate ASC, eventRef ASC";
  readonly events: readonly GlobalTimelineCandidateEvent[];
  readonly deferred: readonly { readonly eventRef: string; readonly reason: "GENERIC_TITLE" | "NOT_CLOSED" }[];
  readonly excluded: readonly { readonly eventRef: string; readonly reason: "OWNED_BY_CERTIFIED_MOMENT" | "CHILD" | "SERIES" | "TEMPLATE" | "NON_DOMINANT" }[];
  readonly dependencyClosure: readonly { readonly ref: string; readonly digest: string }[];
  readonly inputHash: string;
};

function assertIdentity(value: string, label: string): void {
  if (!value.trim()) throw new TypeError(`${label}_REQUIRED`);
}

function normalizePlace(place: GlobalTimelineAdapterPlace): GlobalTimelineAdapterPlace {
  assertIdentity(place.placeRef, "TIMELINE_PLACE_REF");
  if (place.evidenceRefs.length === 0) throw new TypeError("TIMELINE_PLACE_AUTHORITY_REQUIRED");
  return { ...place, evidenceRefs: uniqueSorted(place.evidenceRefs) };
}

function normalizeQuality(quality: GlobalTimelineAdapterQuality): GlobalTimelineAdapterQuality {
  return {
    ...quality,
    limitationCodes: uniqueSorted(quality.limitationCodes),
    evidenceRefs: uniqueSorted(quality.evidenceRefs),
  };
}

function interval(startDate: LocalDate, endDate: LocalDate): void {
  parseLocalDate(startDate);
  parseLocalDate(endDate);
  if (endDate < startDate) throw new TypeError("TIMELINE_EVENT_INTERVAL_INVALID");
}

export function buildGlobalTimelineCandidateBundle(input: {
  readonly moments: readonly GlobalTimelineMomentAdapterInput[];
  readonly lifeEvents: readonly GlobalTimelineLifeEventAdapterInput[];
}): GlobalTimelineCandidateBundle {
  const seenMomentIds = new Set<string>();
  const moments: GlobalTimelineCandidateEvent[] = input.moments.map((moment) => {
    assertIdentity(moment.momentId, "TIMELINE_MOMENT_ID");
    assertIdentity(moment.canonicalName, "TIMELINE_MOMENT_NAME");
    interval(moment.startDate, moment.endDate);
    if (seenMomentIds.has(moment.momentId)) throw new TypeError(`TIMELINE_DUPLICATE_MOMENT:${moment.momentId}`);
    seenMomentIds.add(moment.momentId);
    const places = moment.places.map(normalizePlace);
    if (new Set(places.map(({ placeRef }) => placeRef)).size !== places.length) throw new TypeError(`TIMELINE_DUPLICATE_PLACE:${moment.momentId}`);
    if (moment.primaryPlaceRef !== undefined && !places.some(({ placeRef }) => placeRef === moment.primaryPlaceRef)) {
      throw new TypeError(`TIMELINE_PRIMARY_PLACE_NOT_INCLUDED:${moment.momentId}`);
    }
    const { momentId, ...rest } = moment;
    return {
      ...rest,
      eventRef: `moment:${momentId}`,
      sourceKind: "MOMENT" as const,
      familySource: "M6" as const,
      participantRefs: uniqueSorted(moment.participantRefs),
      places,
      linkedLifeEventRefs: uniqueSorted(moment.linkedLifeEventRefs),
      quality: normalizeQuality(moment.quality),
    };
  });

  const deferred: GlobalTimelineCandidateBundle["deferred"][number][] = [];
  const excluded: GlobalTimelineCandidateBundle["excluded"][number][] = [];
  const autonomous: GlobalTimelineCandidateEvent[] = [];
  const seenLifeEventIds = new Set<string>();
  for (const event of input.lifeEvents) {
    assertIdentity(event.lifeEventId, "TIMELINE_LIFE_EVENT_ID");
    interval(event.startDate, event.endDate);
    if (seenLifeEventIds.has(event.lifeEventId)) throw new TypeError(`TIMELINE_DUPLICATE_LIFE_EVENT:${event.lifeEventId}`);
    seenLifeEventIds.add(event.lifeEventId);
    const eventRef = `life-event:${event.lifeEventId}`;
    if (event.ownedByCertifiedMoment) { excluded.push({ eventRef, reason: "OWNED_BY_CERTIFIED_MOMENT" }); continue; }
    if (event.parentLifeEventRef !== undefined) { excluded.push({ eventRef, reason: "CHILD" }); continue; }
    if (event.seriesRef !== undefined) { excluded.push({ eventRef, reason: "SERIES" }); continue; }
    if (event.template) { excluded.push({ eventRef, reason: "TEMPLATE" }); continue; }
    if (event.role !== "Dominant") { excluded.push({ eventRef, reason: "NON_DOMINANT" }); continue; }
    if (!event.closed) { deferred.push({ eventRef, reason: "NOT_CLOSED" }); continue; }
    if (event.canonicalTitle === undefined || !event.canonicalTitle.trim()) { deferred.push({ eventRef, reason: "GENERIC_TITLE" }); continue; }
    const places = event.places.map(normalizePlace);
    if (new Set(places.map(({ placeRef }) => placeRef)).size !== places.length) throw new TypeError(`TIMELINE_DUPLICATE_PLACE:${event.lifeEventId}`);
    if (event.primaryPlaceRef !== undefined && !places.some(({ placeRef }) => placeRef === event.primaryPlaceRef)) {
      throw new TypeError(`TIMELINE_PRIMARY_PLACE_NOT_INCLUDED:${event.lifeEventId}`);
    }
    autonomous.push({
      eventRef,
      sourceKind: "LIFE_EVENT",
      canonicalName: event.canonicalTitle,
      startDate: event.startDate,
      endDate: event.endDate,
      typeKey: event.typeKey,
      typeLabel: event.typeLabel,
      familyKey: event.familyKey,
      familySource: "LIFE_EVENT",
      participantRefs: uniqueSorted(event.participantRefs),
      places,
      ...(event.primaryPlaceRef === undefined ? {} : { primaryPlaceRef: event.primaryPlaceRef }),
      causalCost: { status: "UNKNOWN" },
      quality: normalizeQuality(event.quality),
    });
  }
  const events = [...moments, ...autonomous].sort((left, right) => left.startDate.localeCompare(right.startDate) || left.eventRef.localeCompare(right.eventRef));
  if (new Set(events.map(({ eventRef }) => eventRef)).size !== events.length) throw new TypeError("TIMELINE_DUPLICATE_EVENT_REF");
  const dependencyClosure = [
    ...input.moments.map((moment) => ({ ref: `timeline-input:moment:${moment.momentId}`, digest: digest(moment) })),
    ...input.lifeEvents.map((event) => ({ ref: `timeline-input:life-event:${event.lifeEventId}`, digest: digest(event) })),
  ].sort((left, right) => left.ref.localeCompare(right.ref));
  const structural = {
    adapterVersion: GLOBAL_TIMELINE_CANDIDATE_ADAPTER_VERSION,
    precedence: "CERTIFIED_MOMENT > AUTONOMOUS_DOMINANT_TITLED_LIFE_EVENT > DEFER" as const,
    sortContract: "startDate ASC, eventRef ASC" as const,
    events,
    deferred: deferred.sort((left, right) => left.eventRef.localeCompare(right.eventRef)),
    excluded: excluded.sort((left, right) => left.eventRef.localeCompare(right.eventRef)),
    dependencyClosure,
  };
  return { ...structural, inputHash: digest(structural) };
}

export type GlobalActivityCostProfileAdapterInput = {
  readonly activityId: string;
  readonly knownOccurrenceCosts: readonly { readonly occurrenceId: string; readonly causalCost: Money }[];
};

export type GlobalGroceryMonth = {
  readonly month: YearMonth;
  readonly occurrenceCount: number;
  readonly knownCostOccurrenceCount: number;
  readonly coverage: number;
  readonly basketStructure:
    | { readonly status: "KNOWN"; readonly small: number; readonly intermediate: number; readonly large: number }
    | { readonly status: "GATED"; readonly reasonCode: "COVERAGE_BELOW_70_PERCENT" };
  readonly monthlyGrocerySpend:
    | { readonly status: "KNOWN"; readonly value: Money }
    | { readonly status: "LOWER_BOUND"; readonly minimum: Money; readonly exactKnownSubtotal: Money }
    | { readonly status: "UNKNOWN" };
  readonly limitationCodes: readonly string[];
};

export type GlobalGroceryCandidateBundle = {
  readonly adapterVersion: typeof GLOBAL_GROCERY_ADAPTER_VERSION | typeof GLOBAL_GROCERY_PURCHASE_AWARE_ADAPTER_VERSION;
  readonly grain: "HOUSEHOLD_MONTH";
  readonly basketPolicy: typeof globalGroceryBasketPolicy;
  readonly thresholds: { readonly p25: Money; readonly p75: Money };
  readonly months: readonly GlobalGroceryMonth[];
  readonly eligibleMonthCount: number;
  readonly historicalComparisonGate: "AVAILABLE" | "GATED";
  readonly dependencyClosure: readonly { readonly ref: string; readonly digest: string }[];
  readonly inputHash: string;
};

function median(values: readonly Money[]): Money {
  if (values.length === 0) throw new TypeError("GROCERY_QUANTILE_EMPTY");
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[middle]!
    : parseMoney(new Big(values[middle - 1]!).plus(values[middle]!).div(2).toFixed());
}

function groceryQuartiles(values: readonly Money[]): { readonly p25: Money; readonly p75: Money } {
  const sorted = [...values].sort(compareMoney);
  if (sorted.length < 2) throw new TypeError("GROCERY_QUANTILE_SUPPORT_INSUFFICIENT");
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, middle);
  const upper = sorted.slice(sorted.length % 2 === 1 ? middle + 1 : middle);
  return { p25: median(lower.length === 0 ? sorted : lower), p75: median(upper.length === 0 ? sorted : upper) };
}

export function buildGlobalGroceryCandidateBundle(input: {
  readonly groceryActivityId: string;
  readonly grocerySubcategoryId: string;
  readonly months: readonly YearMonth[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly activityCostProfile: GlobalActivityCostProfileAdapterInput;
  readonly m2MonthlyComponents: readonly GlobalM2MonthlyComponent[];
  readonly economicComponents?: readonly import("./food-rhythm").GlobalFoodEconomicComponent[];
}): GlobalGroceryCandidateBundle {
  assertIdentity(input.groceryActivityId, "GROCERY_ACTIVITY_ID");
  assertIdentity(input.grocerySubcategoryId, "GROCERY_SUBCATEGORY_ID");
  if (input.activityCostProfile.activityId !== input.groceryActivityId) throw new TypeError("GROCERY_ACTIVITY_PROFILE_MISMATCH");
  const months = uniqueSorted(input.months.map(parseYearMonth)) as readonly YearMonth[];
  if (months.length !== input.months.length) throw new TypeError("GROCERY_MONTH_DUPLICATE");
  const monthSet = new Set<string>(months);
  const occurrences = input.occurrences
    .filter(({ activityId, startDate }) => String(activityId) === input.groceryActivityId && monthSet.has(startDate.slice(0, 7)))
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || String(left.lifeEventId).localeCompare(String(right.lifeEventId)));
  const occurrenceById = new Map(occurrences.map((occurrence) => [String(occurrence.lifeEventId), occurrence]));
  if (occurrenceById.size !== occurrences.length) throw new TypeError("GROCERY_OCCURRENCE_DUPLICATE");
  const costs = input.activityCostProfile.knownOccurrenceCosts.map((cost) => {
    const occurrence = occurrenceById.get(cost.occurrenceId);
    if (occurrence === undefined) throw new TypeError(`GROCERY_COST_WITHOUT_OCCURRENCE:${cost.occurrenceId}`);
    return { ...cost, causalCost: parseMoney(cost.causalCost), month: parseYearMonth(occurrence.startDate.slice(0, 7)) };
  });
  if (new Set(costs.map(({ occurrenceId }) => occurrenceId)).size !== costs.length) throw new TypeError("GROCERY_COST_OCCURRENCE_DUPLICATE");
  const thresholds = groceryQuartiles(costs.map(({ causalCost }) => causalCost));
  const monthRows: GlobalGroceryMonth[] = months.map((month) => {
    const monthOccurrences = occurrences.filter(({ startDate }) => startDate.startsWith(`${month}-`));
    const monthCosts = costs.filter((cost) => cost.month === month);
    const occurrenceCount = monthOccurrences.length;
    const knownCostOccurrenceCount = monthCosts.length;
    const coverage = occurrenceCount === 0 ? 0 : knownCostOccurrenceCount / occurrenceCount;
    const spendComponents = input.m2MonthlyComponents.filter((component) => component.month === month && component.subcategory.status === "KNOWN" && String(component.subcategory.id) === input.grocerySubcategoryId);
    const economicCourses = input.economicComponents?.filter((component) => component.economicMonth === month && component.subcategoryKey === "alimentation__courses_alimentaires");
    const monthlyGrocerySpend = economicCourses === undefined
      ? spendComponents.length === 0
        ? { status: "UNKNOWN" as const }
        : { status: "KNOWN" as const, value: spendComponents.reduce((total, component) => addMoney(total, component.amount), zero) }
      : economicCourses.some(({ amount }) => amount.status === "LOWER_BOUND")
        ? {
            status: "LOWER_BOUND" as const,
            exactKnownSubtotal: economicCourses.filter(({ amount }) => amount.status === "KNOWN")
              .reduce((total, { amount }) => addMoney(total, parseMoney(amount.status === "KNOWN" ? amount.value : "0")), zero),
            minimum: economicCourses.reduce((total, { amount }) => addMoney(total, parseMoney(amount.status === "KNOWN" ? amount.value : amount.minimum)), zero),
          }
        : { status: "KNOWN" as const, value: economicCourses.reduce((total, { amount }) => addMoney(total, parseMoney(amount.status === "KNOWN" ? amount.value : "0")), zero) };
    const eligible = coverage >= globalGroceryBasketPolicy.monthlyCoverageMinimum;
    return {
      month,
      occurrenceCount,
      knownCostOccurrenceCount,
      coverage,
      basketStructure: eligible
        ? {
            status: "KNOWN",
            small: monthCosts.filter(({ causalCost }) => compareMoney(causalCost, thresholds.p25) <= 0).length,
            intermediate: monthCosts.filter(({ causalCost }) => compareMoney(causalCost, thresholds.p25) > 0 && compareMoney(causalCost, thresholds.p75) < 0).length,
            large: monthCosts.filter(({ causalCost }) => compareMoney(causalCost, thresholds.p75) >= 0).length,
          }
        : { status: "GATED", reasonCode: "COVERAGE_BELOW_70_PERCENT" },
      monthlyGrocerySpend,
      limitationCodes: eligible ? [] : ["BASKET_STRUCTURE_COVERAGE_BELOW_70_PERCENT"],
    };
  });
  const eligibleMonthCount = monthRows.filter(({ basketStructure }) => basketStructure.status === "KNOWN").length;
  const dependencyClosure = [
    ...occurrences.map((occurrence) => ({ ref: `activity-occurrence:${occurrence.lifeEventId}`, digest: digest(occurrence) })),
    ...costs.map((cost) => ({ ref: `activity-cost:${cost.occurrenceId}`, digest: digest(cost) })),
    ...input.m2MonthlyComponents.filter((component) => component.subcategory.status === "KNOWN" && String(component.subcategory.id) === input.grocerySubcategoryId)
      .filter(() => input.economicComponents === undefined)
      .map((component) => ({ ref: `m2-component:${component.canonicalComponentKey}:${component.month}`, digest: digest(component) })),
    ...(input.economicComponents ?? []).filter(({ subcategoryKey }) => subcategoryKey === "alimentation__courses_alimentaires")
      .map((component) => ({ ref: `economic-component:${component.economicSegmentKey}`, digest: digest(component) })),
  ].sort((left, right) => left.ref.localeCompare(right.ref));
  if (new Set(dependencyClosure.map(({ ref }) => ref)).size !== dependencyClosure.length) throw new TypeError("GROCERY_DEPENDENCY_DUPLICATE");
  const structural = {
    adapterVersion: input.economicComponents === undefined ? GLOBAL_GROCERY_ADAPTER_VERSION : GLOBAL_GROCERY_PURCHASE_AWARE_ADAPTER_VERSION,
    grain: "HOUSEHOLD_MONTH" as const,
    basketPolicy: globalGroceryBasketPolicy,
    thresholds,
    months: monthRows,
    eligibleMonthCount,
    historicalComparisonGate: eligibleMonthCount >= globalGroceryBasketPolicy.historicalEligibleMonthMinimum ? "AVAILABLE" as const : "GATED" as const,
    dependencyClosure,
  };
  return { ...structural, inputHash: digest(structural) };
}
