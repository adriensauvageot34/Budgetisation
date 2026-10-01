import "server-only";

import { randomUUID } from "node:crypto";
import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { ASSET_AGGREGATE_DESCENDANTS, ASSET_MODULES, PLANNED_EXPENSE_SUBTYPES, plannedAsset, rootAssetModule,
  type AssetModule, type PlannedExpenseFamily } from "@/domain/phase2/planned-assets";
import { costAllowsBaseline } from "@/domain/phase2/planned-product";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import { calculateRouteFuel, resolvePlannedRoute, routePlaceIdentity, assertPrimaryRouteStop } from "@/domain/phase2/planned-routes";
import { rankPlacesForPlannedContext } from "@/domain/phase2/planned-places";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { BRING_ITEMS_LENS, DELIVERY_PROVIDERS, FISHING_ASSET_LENS, SOCIAL_CONTACTS_V1, resolvePlannedContext, plannedContextModifiers, plannedAllowsNoCost,
  validateModulePath, childPlaceRoles } from "@/domain/phase2/planned-rules";
import type { CostItem, FundingAllocation, FundingSource, PlannedBaselineKey, PlannedExpenseContext,
  PlannedExpenseDraft, PriceSource, ModulePath, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { readPlannedContextOptions, readPlannedRouteHistory } from "./planned-context";
import { parseCarSnapshot, parseRouteCoordinates, carFuelEstimate, applyCarResult, carEstimateProblems } from "@/domain/phase2/planned-car";
import { estimatePlannedCar } from "./planned-car-estimation";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import { simulatePlannedExpenseScenario, type MonthInputs } from "./month-scenario";

export { PLANNED_EXPENSE_SUBTYPES };
export type { PlannedExpenseFamily };
export type { CostItem, FundingAllocation, FundingSource, PlannedBaselineKey, PlannedExpenseContext,
  PlannedExpenseDraft, PriceSource };
export type PlannedExpenseStatus = "PLANNED" | "DECLARED_REALIZED";
export type PlannedExpense = PlannedExpenseDraft & Readonly<{ id: string; householdId: string; targetMonth: string;
  status: PlannedExpenseStatus; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string }>;
export type PlannedExpenseScenarioEntry = Pick<PlannedExpense, "id" | "targetMonth" | "status" | "costItems">
  & Partial<Pick<PlannedExpense, "plannedDate" | "context">>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const moneyPattern = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u;
const quantityPattern = /^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?$/u;
const baselineKeys = new Set<PlannedBaselineKey>(["groceries", "household-restaurants", "adrien-work-meals", "manon-work-meals"]);
const object = (value: unknown, code: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(code);
  return value as Record<string, unknown>;
};
const keysOnly = (value: Record<string, unknown>, keys: readonly string[], code: string) => {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new TypeError(code);
};
const uuid = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new TypeError(code);
  return value;
};
const date = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)
    || Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new TypeError(code);
  return value;
};
const title = (value: unknown, code: string): string => {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 120) throw new TypeError(code);
  return value.trim();
};
export const parseTargetMonth = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) throw new TypeError("PLANNED_EXPENSE_MONTH_INVALID");
  date(`${value}-01`, "PLANNED_EXPENSE_MONTH_INVALID");
  return value;
};
export const lineGross = plannedLineGross;
export const grossPlannedExpenseCost = (expense: Pick<PlannedExpenseDraft, "costItems">): string =>
  expense.costItems.reduce((sum, item) => sum.plus(lineGross(item)), new Big(0)).toFixed(2);

const optionalText = (value: unknown, code: string, max = 120): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new TypeError(code);
  return value.trim();
};
const decimal = (value: unknown, pattern: RegExp, code: string): string => {
  if (typeof value !== "string" || !pattern.test(value) || new Big(value).lte(0)) throw new TypeError(code);
  return value;
};
const moduleKeys = new Set<AssetModule>(ASSET_MODULES);
const parsePlaceRef = (value: unknown): ProspectivePlaceRef => {
  const place = object(value, "PLANNED_EXPENSE_PLACE_INVALID");
  if (place.kind === "KNOWN") {
    keysOnly(place, ["kind", "placeId"], "PLANNED_EXPENSE_PLACE_FIELDS_INVALID");
    return { kind: "KNOWN", placeId: uuid(place.placeId, "PLANNED_EXPENSE_PLACE_ID_INVALID") };
  }
  if (place.kind === "TEXT") {
    keysOnly(place, ["kind", "label", "provenance"], "PLANNED_EXPENSE_PLACE_FIELDS_INVALID");
    if (place.provenance !== undefined && place.provenance !== "USER_DECLARED_PROSPECTIVE")
      throw new TypeError("PLANNED_EXPENSE_PLACE_PROVENANCE_INVALID");
    return { kind: "TEXT", label: title(place.label, "PLANNED_EXPENSE_PLACE_LABEL_INVALID"),
      ...(place.provenance ? { provenance: "USER_DECLARED_PROSPECTIVE" as const } : {}) };
  }
  throw new TypeError("PLANNED_EXPENSE_PLACE_KIND_INVALID");
};

export function parsePlannedExpenseDraft(value: unknown, targetMonth: string,
  purpose: "WRITE" | "PREVIEW" = "WRITE"): PlannedExpenseDraft {
  parseTargetMonth(targetMonth);
  const raw = object(value, "PLANNED_EXPENSE_DRAFT_INVALID");
  keysOnly(raw, ["familyKey", "subtypeKey", "title", "plannedDate", "costItems", "context"], "PLANNED_EXPENSE_DRAFT_FIELDS_INVALID");
  const family = raw.familyKey;
  if (typeof family !== "string" || !(family in PLANNED_EXPENSE_SUBTYPES)) throw new TypeError("PLANNED_EXPENSE_FAMILY_INVALID");
  const familyKey = family as PlannedExpenseFamily;
  const subtypes: readonly string[] = PLANNED_EXPENSE_SUBTYPES[familyKey];
  if (subtypes.length === 0 ? raw.subtypeKey !== null : !subtypes.includes(raw.subtypeKey as string))
    throw new TypeError("PLANNED_EXPENSE_SUBTYPE_INVALID");
  const plannedDate = raw.plannedDate === null ? null : date(raw.plannedDate, "PLANNED_EXPENSE_DATE_INVALID");
  if (plannedDate !== null && !plannedDate.startsWith(`${targetMonth}-`)) throw new TypeError("PLANNED_EXPENSE_DATE_MONTH_INVALID");
  if (!Array.isArray(raw.costItems) || raw.costItems.length > 50)
    throw new TypeError("PLANNED_EXPENSE_COST_ITEMS_INVALID");
  const costItems: CostItem[] = raw.costItems.map((value: unknown) => {
    const item = object(value, "PLANNED_EXPENSE_COST_ITEM_INVALID");
    keysOnly(item, ["id", "assetKey", "label", "variantLabel", "quantity", "unitAmount", "baselineKey",
      "fundingAllocations", "priceSource", "priceSourceLabel", "modulePath"], "PLANNED_EXPENSE_COST_ITEM_FIELDS_INVALID");
    const id = uuid(item.id, "PLANNED_EXPENSE_COST_ITEM_ID_INVALID");
    const label = title(item.label, "PLANNED_EXPENSE_COST_ITEM_LABEL_INVALID");
    const quantity = decimal(item.quantity, quantityPattern, "PLANNED_EXPENSE_COST_ITEM_QUANTITY_INVALID");
    const unitAmount = decimal(item.unitAmount, moneyPattern, "PLANNED_EXPENSE_COST_ITEM_UNIT_AMOUNT_INVALID");
    const gross = new Big(quantity).times(unitAmount).round(2);
    if (gross.lt("0.01") || gross.gt("999999999.99")) throw new TypeError("PLANNED_EXPENSE_COST_ITEM_GROSS_INVALID");
    const assetKey = item.assetKey;
    if (assetKey !== null && (typeof assetKey !== "string" || !plannedAsset(assetKey)))
      throw new TypeError("PLANNED_EXPENSE_ASSET_INVALID");
    const modulePath = item.modulePath === undefined ? undefined : (() => {
      if (!Array.isArray(item.modulePath) || item.modulePath.length < 1 || item.modulePath.length > 2
        || item.modulePath.some((part: unknown) => typeof part !== "string" || !moduleKeys.has(part as AssetModule)))
        throw new TypeError("PLANNED_EXPENSE_MODULE_PATH_INVALID");
      return item.modulePath as unknown as ModulePath;
    })();
    const module = modulePath?.at(-1) ?? rootAssetModule(familyKey, raw.subtypeKey as string | null);
    const baselineKey = item.baselineKey;
    if (baselineKey !== null && (typeof baselineKey !== "string" || !baselineKeys.has(baselineKey as PlannedBaselineKey)))
      throw new TypeError("PLANNED_EXPENSE_BASELINE_INVALID");
    const allowedBaseline = module === "groceries" ? ["groceries"] : module === "restaurant" || module === "fast_food"
      ? ["household-restaurants"] : module === "work_meal" ? ["adrien-work-meals", "manon-work-meals"] : [];
    if (baselineKey !== null && (!costAllowsBaseline({ assetKey: assetKey as string | null }) || !allowedBaseline.includes(baselineKey as string)))
      throw new TypeError("PLANNED_EXPENSE_BASELINE_SUBTYPE_INVALID");
    const allocations = item.fundingAllocations;
    let fundingAllocations: FundingAllocation[] | undefined;
    if (allocations !== undefined) {
      if (!Array.isArray(allocations) || allocations.length < 1 || allocations.length > 3)
        throw new TypeError("PLANNED_EXPENSE_FUNDING_INVALID");
      fundingAllocations = allocations.map((rawAllocation: unknown) => {
        const allocation = object(rawAllocation, "PLANNED_EXPENSE_FUNDING_INVALID");
        keysOnly(allocation, ["source", "amount"], "PLANNED_EXPENSE_FUNDING_INVALID");
        if (!["BANK", "SWILE", "EDENRED"].includes(allocation.source as string))
          throw new TypeError("PLANNED_EXPENSE_FUNDING_SOURCE_INVALID");
        return { source: allocation.source as FundingSource,
          amount: new Big(decimal(allocation.amount, moneyPattern, "PLANNED_EXPENSE_FUNDING_AMOUNT_INVALID")).toFixed(2) };
      });
      if (new Set(fundingAllocations.map((part) => part.source)).size !== fundingAllocations.length
        || !fundingAllocations.reduce((sum, part) => sum.plus(part.amount), new Big(0)).eq(gross))
        throw new TypeError("PLANNED_EXPENSE_FUNDING_SUM_INVALID");
      if (fundingAllocations.some((part) => part.source !== "BANK")
        && (assetKey === null || plannedAsset(assetKey)?.fundingEligibility !== "MEAL"))
        throw new TypeError("PLANNED_EXPENSE_FUNDING_INELIGIBLE");
      if (costItemCashTreatment({ assetKey }) === "ECONOMIC_ONLY")
        throw new TypeError("PLANNED_EXPENSE_FUEL_FUNDING_FORBIDDEN");
    }
    const priceSource = item.priceSource;
    if (priceSource !== undefined && !["MANUAL", "SYSTEM_DEFAULT", "LAST_KNOWN", "CALCULATED"].includes(priceSource as string))
      throw new TypeError("PLANNED_EXPENSE_PRICE_SOURCE_INVALID");
    if (priceSource === "CALCULATED" && assetKey !== "transport:fuel_usage" && assetKey !== "transport:toll")
      throw new TypeError("PLANNED_EXPENSE_PRICE_SOURCE_INVALID");
    return { id, assetKey: assetKey as string | null, label,
      ...(item.variantLabel !== undefined ? { variantLabel: optionalText(item.variantLabel, "PLANNED_EXPENSE_VARIANT_INVALID") } : {}),
      quantity, unitAmount: new Big(unitAmount).toFixed(2), baselineKey: baselineKey as PlannedBaselineKey | null,
      ...(fundingAllocations ? { fundingAllocations } : {}),
      ...(priceSource ? { priceSource: priceSource as PriceSource } : {}),
      ...(item.priceSourceLabel !== undefined ? { priceSourceLabel: optionalText(item.priceSourceLabel, "PLANNED_EXPENSE_PRICE_LABEL_INVALID", 160) } : {}),
      ...(modulePath ? { modulePath } : {}) };
  });
  if (new Set(costItems.map((item) => item.id)).size !== costItems.length) throw new TypeError("PLANNED_EXPENSE_COST_ITEM_ID_DUPLICATE");
  const contextRaw = object(raw.context, "PLANNED_EXPENSE_CONTEXT_INVALID");
  keysOnly(contextRaw, ["participantPersonIds", "travellingParticipantPersonIds", "additionalGuestCount", "personVisited", "participantRefs", "host", "hostParticipates", "visitedPersonParticipates", "transportMode",
    "place", "purchaseMode", "housePartyPlaceMode", "visitFormat", "socialOccasion", "occasionLabel",
    "deliveryProviderKey", "deliveryProvider", "seller", "gift", "childLocalPlaceRefs", "route",
    "companionMode", "groceriesNature", "workMealMode", "outingKind", "eventName", "endDate", "noExpense", "purchaseDescription"],
  "PLANNED_EXPENSE_CONTEXT_FIELDS_INVALID");
  const context: { -readonly [K in keyof PlannedExpenseContext]?: PlannedExpenseContext[K] } = {};
  for (const [field, values] of Object.entries({ companionMode: ["SOLO", "COUPLE", "GROUP"],
    groceriesNature: ["USUAL", "TOP_UP", "OCCASION"], workMealMode: ["BOUGHT", "DELIVERED", "FROM_HOME"], outingKind: ["CLUB", "EVENT"] })) {
    if (contextRaw[field] !== undefined) {
      if (!values.includes(contextRaw[field] as string)) throw new TypeError("PLANNED_EXPENSE_INTENT_MODIFIER_INVALID");
      Object.assign(context, { [field]: contextRaw[field] });
    }
  }
  if (contextRaw.eventName !== undefined) context.eventName = title(contextRaw.eventName, "PLANNED_EXPENSE_EVENT_NAME_INVALID");
  if (contextRaw.purchaseDescription !== undefined) {
    if (familyKey !== "purchase") throw new TypeError("PLANNED_EXPENSE_INTENT_MODIFIER_FORBIDDEN");
    context.purchaseDescription = title(contextRaw.purchaseDescription, "PLANNED_EXPENSE_PURCHASE_DESCRIPTION_INVALID");
  }
  if (contextRaw.endDate !== undefined) {
    context.endDate = date(contextRaw.endDate, "PLANNED_EXPENSE_END_DATE_INVALID");
    if (familyKey !== "visit_trip" || raw.subtypeKey !== "trip_stay" || plannedDate && context.endDate < plannedDate) throw new TypeError("PLANNED_EXPENSE_END_DATE_INVALID");
  }
  if (contextRaw.noExpense !== undefined) {
    if (typeof contextRaw.noExpense !== "boolean") throw new TypeError("PLANNED_EXPENSE_NO_EXPENSE_INVALID");
    if (!["activity", "visit_trip"].includes(familyKey)) throw new TypeError("PLANNED_EXPENSE_INTENT_MODIFIER_FORBIDDEN");
    context.noExpense = contextRaw.noExpense;
  }
  if (context.groceriesNature && !(familyKey === "food" && raw.subtypeKey === "groceries")
    || context.workMealMode && !(familyKey === "food" && raw.subtypeKey === "work_meal")
    || context.outingKind && !(familyKey === "outing" && raw.subtypeKey === "club_festival")) throw new TypeError("PLANNED_EXPENSE_INTENT_MODIFIER_FORBIDDEN");
  const personIds = (value: unknown, code: string): string[] => {
    if (!Array.isArray(value) || value.length > 20) throw new TypeError(code);
    const ids = value.map((id: unknown) => uuid(id, code));
    if (new Set(ids).size !== ids.length) throw new TypeError(code);
    return ids;
  };
  if (contextRaw.participantPersonIds !== undefined)
    context.participantPersonIds = personIds(contextRaw.participantPersonIds, "PLANNED_EXPENSE_PARTICIPANTS_INVALID");
  if (contextRaw.travellingParticipantPersonIds !== undefined)
    context.travellingParticipantPersonIds = personIds(contextRaw.travellingParticipantPersonIds, "PLANNED_EXPENSE_TRAVELLERS_INVALID");
  if (contextRaw.additionalGuestCount !== undefined) {
    if (!Number.isInteger(contextRaw.additionalGuestCount) || Number(contextRaw.additionalGuestCount) < 0
      || Number(contextRaw.additionalGuestCount) > 99) throw new TypeError("PLANNED_EXPENSE_GUEST_COUNT_INVALID");
    context.additionalGuestCount = Number(contextRaw.additionalGuestCount);
  }
  const parsePersonRef = (rawRef: unknown): NonNullable<PlannedExpenseContext["personVisited"]> => {
    const visited = object(rawRef, "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
    if (visited.kind === "HOUSEHOLD_PERSON" || visited.kind === "KNOWN") {
      keysOnly(visited, ["kind", "personId"], "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
      return { kind: "HOUSEHOLD_PERSON", personId: uuid(visited.personId, "PLANNED_EXPENSE_VISITED_PERSON_INVALID") };
    } else if (visited.kind === "CONTACT") {
      keysOnly(visited, ["kind", "contactKey"], "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
      if (typeof visited.contactKey !== "string" || !SOCIAL_CONTACTS_V1.some((contact) => contact.key === visited.contactKey))
        throw new TypeError("PLANNED_EXPENSE_CONTACT_INVALID");
      return { kind: "CONTACT", contactKey: visited.contactKey };
    } else if (visited.kind === "TEXT") {
      keysOnly(visited, ["kind", "label"], "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
      return { kind: "TEXT", label: title(visited.label, "PLANNED_EXPENSE_VISITED_PERSON_INVALID") };
    } else throw new TypeError("PLANNED_EXPENSE_VISITED_PERSON_INVALID");
  }
  if (contextRaw.personVisited !== undefined) context.personVisited = parsePersonRef(contextRaw.personVisited);
  if (contextRaw.host !== undefined) context.host = parsePersonRef(contextRaw.host);
  for (const field of ["hostParticipates", "visitedPersonParticipates"] as const) if (contextRaw[field] !== undefined) {
    if (typeof contextRaw[field] !== "boolean") throw new TypeError("PLANNED_EXPENSE_PARTICIPATION_INVALID");
    context[field] = contextRaw[field];
  }
  if (contextRaw.participantRefs !== undefined) {
    if (!Array.isArray(contextRaw.participantRefs) || contextRaw.participantRefs.length > 20)
      throw new TypeError("PLANNED_EXPENSE_PARTICIPANTS_INVALID");
    context.participantRefs = contextRaw.participantRefs.map(parsePersonRef);
    if (new Set(context.participantRefs.map((ref) => JSON.stringify(ref))).size !== context.participantRefs.length)
      throw new TypeError("PLANNED_EXPENSE_PARTICIPANTS_INVALID");
  }
  if (contextRaw.transportMode !== undefined) {
    if (!["CAR", "TRAIN", "BUS", "TAXI", "CARPOOL", "FREE", "OTHER", "PLANE"].includes(contextRaw.transportMode as string))
      throw new TypeError("PLANNED_EXPENSE_TRANSPORT_MODE_INVALID");
    context.transportMode = contextRaw.transportMode as PlannedExpenseContext["transportMode"];
  }
  if (contextRaw.place !== undefined) {
    context.place = parsePlaceRef(contextRaw.place);
  }
  if (contextRaw.purchaseMode !== undefined) {
    if (!["IN_STORE", "ONLINE", "TAKEAWAY", "DELIVERY"].includes(contextRaw.purchaseMode as string))
      throw new TypeError("PLANNED_EXPENSE_PURCHASE_MODE_INVALID");
    context.purchaseMode = contextRaw.purchaseMode as PlannedExpenseContext["purchaseMode"];
  }
  if (contextRaw.housePartyPlaceMode !== undefined) {
    if (contextRaw.housePartyPlaceMode !== "OWN_HOME" && contextRaw.housePartyPlaceMode !== "OTHER_HOME")
      throw new TypeError("PLANNED_EXPENSE_HOUSE_PARTY_MODE_INVALID");
    context.housePartyPlaceMode = contextRaw.housePartyPlaceMode;
  }
  if (contextRaw.visitFormat !== undefined) {
    if (!["SIMPLE", "APERO_PARTY", "MEAL", "STAY"].includes(contextRaw.visitFormat as string))
      throw new TypeError("PLANNED_EXPENSE_VISIT_FORMAT_INVALID");
    context.visitFormat = contextRaw.visitFormat as PlannedExpenseContext["visitFormat"];
  }
  if (contextRaw.socialOccasion !== undefined) {
    if (!["NONE", "BIRTHDAY", "CHRISTMAS", "CELEBRATION", "OTHER_SPECIAL"].includes(contextRaw.socialOccasion as string))
      throw new TypeError("PLANNED_EXPENSE_SOCIAL_OCCASION_INVALID");
    context.socialOccasion = contextRaw.socialOccasion as PlannedExpenseContext["socialOccasion"];
  }
  if (contextRaw.occasionLabel !== undefined)
    context.occasionLabel = title(contextRaw.occasionLabel, "PLANNED_EXPENSE_OCCASION_LABEL_INVALID");
  if (contextRaw.deliveryProviderKey !== undefined) {
    if (typeof contextRaw.deliveryProviderKey !== "string" || !DELIVERY_PROVIDERS.some((provider) => provider.key === contextRaw.deliveryProviderKey))
      throw new TypeError("PLANNED_EXPENSE_DELIVERY_PROVIDER_INVALID");
    context.deliveryProviderKey = contextRaw.deliveryProviderKey;
  }
  if (contextRaw.deliveryProvider !== undefined)
    context.deliveryProvider = title(contextRaw.deliveryProvider, "PLANNED_EXPENSE_DELIVERY_PROVIDER_INVALID");
  if (context.deliveryProvider && !context.deliveryProviderKey)
    context.deliveryProviderKey = DELIVERY_PROVIDERS.find((provider) => provider.label === context.deliveryProvider)?.key ?? "OTHER";
  if (contextRaw.seller !== undefined)
    context.seller = title(contextRaw.seller, "PLANNED_EXPENSE_SELLER_INVALID");
  if (contextRaw.childLocalPlaceRefs !== undefined) {
    const refs = object(contextRaw.childLocalPlaceRefs, "PLANNED_EXPENSE_CHILD_PLACE_INVALID");
    context.childLocalPlaceRefs = Object.fromEntries(Object.entries(refs).map(([key, value]) => {
      if (!moduleKeys.has(key as AssetModule) || key === "transport") throw new TypeError("PLANNED_EXPENSE_CHILD_PLACE_INVALID");
      return [key, parsePlaceRef(value)];
    }));
  }
  if (purpose === "WRITE" && familyKey === "food" && raw.subtypeKey === "fast_food"
    && context.purchaseMode !== "IN_STORE" && context.purchaseMode !== "TAKEAWAY" && context.purchaseMode !== "DELIVERY")
    throw new TypeError("PLANNED_EXPENSE_PURCHASE_MODE_REQUIRED");
  if (purpose === "WRITE" && context.purchaseMode === "DELIVERY" && !context.deliveryProvider)
    throw new TypeError("PLANNED_EXPENSE_DELIVERY_PROVIDER_REQUIRED");
  if (contextRaw.gift !== undefined) {
    const gift = object(contextRaw.gift, "PLANNED_EXPENSE_GIFT_INVALID");
    keysOnly(gift, ["recipient", "occasion"], "PLANNED_EXPENSE_GIFT_INVALID");
    context.gift = { recipient: title(gift.recipient, "PLANNED_EXPENSE_GIFT_RECIPIENT_INVALID"),
      occasion: title(gift.occasion, "PLANNED_EXPENSE_GIFT_OCCASION_INVALID") };
  }
  if (contextRaw.route !== undefined) {
    const route = object(contextRaw.route, "PLANNED_EXPENSE_ROUTE_INVALID");
    keysOnly(route, ["mode", "stops", "fuelEstimate", "liveEstimate", "plannedTime", "timeKind", "preference", "manualFuelPrice", "tollFreeConfirmed"], "PLANNED_EXPENSE_ROUTE_INVALID");
    const liveEstimate = route.liveEstimate === undefined ? undefined : parseCarSnapshot(route.liveEstimate);
    if (liveEstimate && route.mode !== "CAR") throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_MODE_INVALID");
    if (route.plannedTime != null && (typeof route.plannedTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(route.plannedTime) || !raw.plannedDate)) throw new TypeError("PLANNED_ROUTE_TIME_INVALID");
    if (route.timeKind !== undefined && !["DEPARTURE", "ARRIVAL"].includes(String(route.timeKind))) throw new TypeError("PLANNED_ROUTE_TIME_INVALID");
    if (route.preference !== undefined && (!["FASTEST", "AVOID_TOLLS"].includes(String(route.preference)) || liveEstimate && liveEstimate.preference !== route.preference)) throw new TypeError("PLANNED_ROUTE_PREFERENCE_INVALID");
    if (route.manualFuelPrice !== undefined && (typeof route.manualFuelPrice !== "string" || !/^\d(?:\.\d{1,3})?$/u.test(route.manualFuelPrice) || new Big(route.manualFuelPrice).lte(0))) throw new TypeError("PLANNED_ROUTE_PRICE_INVALID");
    if (route.tollFreeConfirmed !== undefined && typeof route.tollFreeConfirmed !== "boolean") throw new TypeError("PLANNED_ROUTE_TOLL_INVALID");
    if (!["CAR", "TRAIN", "BUS", "TAXI"].includes(route.mode as string)
      || !Array.isArray(route.stops) || route.stops.length < 2 || route.stops.length > 12)
      throw new TypeError("PLANNED_EXPENSE_ROUTE_INVALID");
    const stops = route.stops.map((rawStop: unknown, index: number) => {
      const stop = object(rawStop, "PLANNED_EXPENSE_ROUTE_STOP_INVALID");
      keysOnly(stop, ["label", "placeId", "distanceToNextKm", "endpointSource", "childModule", "distanceSource", "estimatedFuelLiters", "evidence", "coordinates"], "PLANNED_EXPENSE_ROUTE_STOP_INVALID");
      const label = title(stop.label, "PLANNED_EXPENSE_ROUTE_STOP_INVALID");
      const placeId = stop.placeId === undefined ? undefined : uuid(stop.placeId, "PLANNED_EXPENSE_ROUTE_PLACE_INVALID");
      const km = stop.distanceToNextKm;
      if (index === (route.stops as unknown[]).length - 1 ? km !== null && km !== undefined
        : typeof km !== "string" || !/^(?:0|[1-9]\d{0,4})(?:\.\d{1,3})?$/u.test(km) || new Big(km).lte(0))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_DISTANCE_INVALID");
      const source = stop.endpointSource;
      if (source !== undefined && !["ROOT_PLACE", "CHILD_LOCAL_PLACE", "DIRECT_PLACE"].includes(source as string))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_ENDPOINT_INVALID");
      const childModule = stop.childModule;
      if (childModule !== undefined && (typeof childModule !== "string" || !moduleKeys.has(childModule as AssetModule)))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_ENDPOINT_INVALID");
      if ((source === "CHILD_LOCAL_PLACE") !== (childModule !== undefined))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_ENDPOINT_INVALID");
      if (stop.distanceSource !== undefined && !["MANUAL", "HISTORICAL_ROUTE", "TOMTOM"].includes(stop.distanceSource as string)
        || stop.distanceSource === "TOMTOM" && liveEstimate?.route.provider !== "TOMTOM")
        throw new TypeError("PLANNED_EXPENSE_ROUTE_SOURCE_INVALID");
      let evidence;
      let estimatedFuelLiters: string | undefined;
      if (stop.distanceSource === "HISTORICAL_ROUTE") {
        if (!placeId || index === (route.stops as unknown[]).length - 1)
          throw new TypeError("PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
        const rawEvidence = object(stop.evidence, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
        keysOnly(rawEvidence, ["method", "observationCount", "minimumKm", "maximumKm", "firstDate", "lastDate"], "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
        if (!Number.isInteger(rawEvidence.observationCount) || Number(rawEvidence.observationCount) < 1)
          throw new TypeError("PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
        evidence = { method: title(rawEvidence.method, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID"),
          observationCount: Number(rawEvidence.observationCount),
          minimumKm: decimal(rawEvidence.minimumKm, /^(?:0|[1-9]\d{0,4})(?:\.\d{1,6})?$/u, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID"),
          maximumKm: decimal(rawEvidence.maximumKm, /^(?:0|[1-9]\d{0,4})(?:\.\d{1,6})?$/u, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID"),
          firstDate: date(rawEvidence.firstDate, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID"),
          lastDate: date(rawEvidence.lastDate, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID") };
        estimatedFuelLiters = decimal(stop.estimatedFuelLiters, /^(?:0|[1-9]\d{0,4})(?:\.\d{1,6})?$/u, "PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
      } else if (stop.estimatedFuelLiters !== undefined || stop.evidence !== undefined)
        throw new TypeError("PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
      return { label, ...(placeId ? { placeId } : {}), distanceToNextKm: index === (route.stops as unknown[]).length - 1 ? null : km as string,
        ...(stop.distanceSource ? { distanceSource: stop.distanceSource as "MANUAL" | "HISTORICAL_ROUTE" | "TOMTOM" } : {}),
        ...(stop.coordinates ? { coordinates: parseRouteCoordinates(stop.coordinates) } : {}),
        ...(evidence ? { evidence, estimatedFuelLiters } : {}),
        ...(source ? { endpointSource: source as "ROOT_PLACE" | "CHILD_LOCAL_PLACE" | "DIRECT_PLACE" } : {}),
        ...(childModule ? { childModule: childModule as AssetModule } : {}) };
    });
    for (let index = 1; index < stops.length; index++)
      if (routePlaceIdentity(stops[index - 1]!) === routePlaceIdentity(stops[index]!))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_DUPLICATE_CONSECUTIVE_PLACE");
    for (let index = 0; index < stops.length - 1; index++)
      if (stops[index]!.distanceSource === "HISTORICAL_ROUTE" && !stops[index + 1]!.placeId)
        throw new TypeError("PLANNED_EXPENSE_ROUTE_EVIDENCE_INVALID");
    let fuelEstimate: NonNullable<PlannedExpenseContext["route"]>["fuelEstimate"];
    if (route.fuelEstimate !== undefined) {
      const estimate = object(route.fuelEstimate, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      keysOnly(estimate, ["vehicleLabel", "consumptionL100Km", "fuelPricePerLiter", "fuelPriceSource", "fuelPriceObservedAt", "fuelPriceQuality", "distanceKm", "liters", "cost"], "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      const consumptionL100Km = decimal(estimate.consumptionL100Km, /^(?:0|[1-9]\d{0,2})(?:\.\d{1,3})?$/u, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      const fuelPricePerLiter = decimal(estimate.fuelPricePerLiter, /^(?:0|[1-9]\d{0,2})(?:\.\d{1,9})?$/u, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      const calculated = liveEstimate ? carFuelEstimate(liveEstimate) : calculateRouteFuel(stops, { label: title(estimate.vehicleLabel, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID"),
        consumptionL100Km, fuelPricePerLiter, fuelPriceSource: title(estimate.fuelPriceSource, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID"),
        ...(estimate.fuelPriceObservedAt !== undefined ? { fuelPriceObservedAt: title(estimate.fuelPriceObservedAt, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID") } : {}),
        ...(estimate.fuelPriceQuality !== undefined ? { fuelPriceQuality: title(estimate.fuelPriceQuality, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID") } : {}) });
      if (!calculated || Object.keys(calculated).some((key) => estimate[key] !== calculated[key as keyof typeof calculated]) || estimate.distanceKm !== calculated.distanceKm || estimate.liters !== calculated.liters
        || estimate.cost !== calculated.cost) throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_MISMATCH");
      fuelEstimate = calculated;
    }
    if (route.mode !== "CAR" && fuelEstimate)
      throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_MODE_INVALID");
    const fuelItems = costItems.filter((item) => item.assetKey === "transport:fuel_usage");
    if (route.mode === "CAR" && (!fuelEstimate || fuelItems.length !== 1 || fuelItems[0]!.quantity !== "1"
      || fuelItems[0]!.unitAmount !== fuelEstimate.cost || fuelItems[0]!.priceSource !== "CALCULATED"))
      throw new TypeError("PLANNED_EXPENSE_CAR_ESTIMATE_REQUIRED");
    if (liveEstimate && (liveEstimate.route.segments.length !== stops.length - 1
      || liveEstimate.route.provider === "TOMTOM" && stops.slice(0, -1).some((stop, i) => stop.distanceSource !== "TOMTOM" || stop.distanceToNextKm !== liveEstimate.route.segments[i]!.distanceKm))) throw new TypeError("PLANNED_EXPENSE_LIVE_ROUTE_INVALID");
    const calculatedTolls = costItems.filter((item) => item.assetKey === "transport:toll" && item.priceSource === "CALCULATED");
    const allTolls = costItems.filter((item) => item.assetKey === "transport:toll");
    if (calculatedTolls.length && !liveEstimate || liveEstimate && calculatedTolls.some((item) => item.quantity !== "1" || item.unitAmount !== liveEstimate.toll.amount)
      || liveEstimate && (allTolls.length > 1 || liveEstimate.toll.amount && new Big(liveEstimate.toll.amount).gt(0) && !allTolls.length)) throw new TypeError("PLANNED_ROUTE_TOLL_MISMATCH");
    context.route = { mode: route.mode as NonNullable<PlannedExpenseContext["route"]>["mode"], stops,
      ...(fuelEstimate ? { fuelEstimate } : {}), ...(liveEstimate ? { liveEstimate } : {}),
      ...(route.plannedTime !== undefined ? { plannedTime: route.plannedTime as string | null } : {}),
      ...(route.timeKind ? { timeKind: route.timeKind as "DEPARTURE" | "ARRIVAL" } : {}),
      ...(route.preference ? { preference: route.preference as "FASTEST" | "AVOID_TOLLS" } : {}),
      ...(route.manualFuelPrice ? { manualFuelPrice: route.manualFuelPrice as string } : {}),
      ...(route.tollFreeConfirmed !== undefined ? { tollFreeConfirmed: route.tollFreeConfirmed as boolean } : {}) };
  }
  if (purpose === "WRITE" && (familyKey === "visit_trip" && ["family_visit", "friend_visit"].includes(raw.subtypeKey as string))
    && !context.personVisited) throw new TypeError("PLANNED_EXPENSE_VISITED_PERSON_REQUIRED");
  if (familyKey === "food" && raw.subtypeKey === "work_meal" && context.participantPersonIds?.length !== 1)
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_REQUIRED");
  if (purpose === "WRITE" && familyKey === "purchase" && raw.subtypeKey === "gift" && !context.gift)
    throw new TypeError("PLANNED_EXPENSE_GIFT_RECIPIENT_REQUIRED");
  if (costItems.some((item) => item.assetKey === "transport:fuel_usage")
    && (context.route?.mode !== "CAR" || !context.route.fuelEstimate))
    throw new TypeError("PLANNED_EXPENSE_CAR_ESTIMATE_REQUIRED");
  if (costItems.some((item) => item.assetKey === "transport:toll" && item.priceSource === "CALCULATED") && !context.route?.liveEstimate) throw new TypeError("PLANNED_ROUTE_TOLL_MISMATCH");
  const resolved = resolvePlannedContext({ familyKey, subtypeKey: raw.subtypeKey as string | null,
    modifiers: plannedContextModifiers(context) });
  if (!costItems.length && !plannedAllowsNoCost({ familyKey, subtypeKey: raw.subtypeKey as string | null, context })) throw new TypeError("PLANNED_EXPENSE_COST_ITEMS_INVALID");
  if (context.workMealMode === "FROM_HOME" && costItems.some((item) => (item.modulePath?.at(-1) ?? resolved.rootModule) === "work_meal")) throw new TypeError("PLANNED_EXPENSE_HOME_MEAL_COST_INVALID");
  if (context.host && resolved.fields.host === "HIDDEN") throw new TypeError("PLANNED_EXPENSE_HOST_FORBIDDEN");
  if (purpose === "WRITE" && resolved.fields.host === "REQUIRED" && !context.host) throw new TypeError("PLANNED_EXPENSE_HOST_REQUIRED");
  if (context.hostParticipates && !context.host || context.visitedPersonParticipates && !context.personVisited)
    throw new TypeError("PLANNED_EXPENSE_PARTICIPATION_INVALID");
  if (context.place && resolved.fields.place === "HIDDEN") throw new TypeError("PLANNED_EXPENSE_PLACE_FORBIDDEN");
  if (purpose === "WRITE" && !context.place && resolved.fields.place === "REQUIRED") throw new TypeError("PLANNED_EXPENSE_PLACE_REQUIRED");
  if (context.personVisited && resolved.fields.visitedContact === "HIDDEN")
    throw new TypeError("PLANNED_EXPENSE_VISITED_PERSON_FORBIDDEN");
  if (context.personVisited?.kind === "CONTACT") {
    const contactKey = context.personVisited.contactKey;
    const contact = SOCIAL_CONTACTS_V1.find((item) => item.key === contactKey);
    if (!contact || (raw.subtypeKey === "family_visit" && contact.kind !== "FAMILY")
      || (raw.subtypeKey === "friend_visit" && contact.kind !== "FRIEND"))
      throw new TypeError("PLANNED_EXPENSE_CONTACT_CONTEXT_INVALID");
  }
  if (context.purchaseMode && resolved.fields.purchaseMode === "HIDDEN")
    throw new TypeError("PLANNED_EXPENSE_PURCHASE_MODE_FORBIDDEN");
  if ((context.deliveryProvider || context.deliveryProviderKey) && resolved.fields.deliveryProvider === "HIDDEN")
    throw new TypeError("PLANNED_EXPENSE_DELIVERY_PROVIDER_FORBIDDEN");
  if (purpose === "WRITE" && resolved.fields.deliveryProvider === "REQUIRED" && (!context.deliveryProvider || !context.deliveryProviderKey))
    throw new TypeError("PLANNED_EXPENSE_DELIVERY_PROVIDER_REQUIRED");
  const knownProvider = DELIVERY_PROVIDERS.find((provider) => provider.key === context.deliveryProviderKey);
  if (knownProvider && knownProvider.key !== "OTHER" && context.deliveryProvider !== knownProvider.label)
    throw new TypeError("PLANNED_EXPENSE_DELIVERY_PROVIDER_MISMATCH");
  const textPlaceLabel = context.place?.kind === "TEXT" ? context.place.label : undefined;
  if (textPlaceLabel && DELIVERY_PROVIDERS.some((provider) => provider.key !== "OTHER"
    && provider.label === textPlaceLabel))
    throw new TypeError("PLANNED_EXPENSE_MERCHANT_AS_PLACE_INVALID");
  if (context.seller && resolved.fields.seller === "HIDDEN") throw new TypeError("PLANNED_EXPENSE_SELLER_FORBIDDEN");
  if (context.housePartyPlaceMode && !(familyKey === "outing" && raw.subtypeKey === "house_party"))
    throw new TypeError("PLANNED_EXPENSE_HOUSE_PARTY_MODE_FORBIDDEN");
  if (context.visitFormat && resolved.fields.visitFormat === "HIDDEN")
    throw new TypeError("PLANNED_EXPENSE_VISIT_FORMAT_FORBIDDEN");
  if (context.socialOccasion && resolved.fields.socialOccasion === "HIDDEN")
    throw new TypeError("PLANNED_EXPENSE_SOCIAL_OCCASION_FORBIDDEN");
  if (context.transportMode && resolved.transport === "FORBIDDEN") throw new TypeError("PLANNED_EXPENSE_TRANSPORT_FORBIDDEN");
  if (context.route && context.transportMode && context.route.mode !== context.transportMode)
    throw new TypeError("PLANNED_EXPENSE_ROUTE_MODE_MISMATCH");
  if (context.transportMode === "FREE" && costItems.some((item) => plannedAsset(item.assetKey ?? "")?.module === "transport"))
    throw new TypeError("PLANNED_EXPENSE_TRANSPORT_FREE_COST_INVALID");
  if (context.route && resolved.transport === "FORBIDDEN") throw new TypeError("PLANNED_EXPENSE_TRANSPORT_FORBIDDEN");
  for (const item of costItems) {
    const path = item.modulePath ?? [resolved.rootModule];
    validateModulePath(path, resolved);
    const edge = path.length === 2 ? resolved.children.find((candidate) => candidate.childModule === path[1]) : undefined;
    if (edge?.baselineOverride === null && item.baselineKey !== null)
      throw new TypeError("PLANNED_EXPENSE_CHILD_BASELINE_FORBIDDEN");
    if (edge?.fundingOverride === "BANK_ONLY" && item.fundingAllocations?.some((part) => part.source !== "BANK"))
      throw new TypeError("PLANNED_EXPENSE_CHILD_FUNDING_FORBIDDEN");
    const assetModule = item.assetKey === null ? null : plannedAsset(item.assetKey)?.module;
    const fromBringItems = (familyKey === "visit_trip" && ["family_visit", "friend_visit"].includes(raw.subtypeKey as string))
      && path.length === 1 && item.assetKey !== null
      && Object.values(BRING_ITEMS_LENS).some((keys) => (keys as readonly string[]).includes(item.assetKey!));
    const fromFishing = familyKey === "activity" && raw.subtypeKey === "fishing"
      && path.length === 1 && item.assetKey !== null
      && (FISHING_ASSET_LENS as readonly string[]).includes(item.assetKey);
    if (assetModule !== null && assetModule !== path.at(-1)
      && !(assetModule === "transport" && path.length === 1 && resolved.transport !== "FORBIDDEN")
      && !fromBringItems && !fromFishing) throw new TypeError("PLANNED_EXPENSE_ASSET_MODULE_INVALID");
  }
  for (const [aggregateKey, descendants] of Object.entries(ASSET_AGGREGATE_DESCENDANTS)) {
    const aggregates = costItems.filter((item) => item.assetKey === aggregateKey);
    if (aggregates.some((aggregate) => costItems.some((item) => descendants.includes(item.assetKey ?? "")
      && JSON.stringify(item.modulePath ?? [resolved.rootModule]) === JSON.stringify(aggregate.modulePath ?? [resolved.rootModule]))))
      throw new TypeError("PLANNED_EXPENSE_AGGREGATE_DESCENDANTS_ACTIVE");
  }
  for (const [module, ref] of Object.entries(context.childLocalPlaceRefs ?? {})) {
    const edge = resolved.children.find((candidate) => candidate.childModule === module);
    if (!edge || edge.localPlacePolicy === "HIDDEN" || !costItems.some((item) => item.modulePath?.[1] === module))
      throw new TypeError("PLANNED_EXPENSE_CHILD_PLACE_INVALID");
    if (!ref) throw new TypeError("PLANNED_EXPENSE_CHILD_PLACE_INVALID");
    if (ref.kind === "TEXT" && DELIVERY_PROVIDERS.some((provider) => provider.key !== "OTHER" && provider.label === ref.label))
      throw new TypeError("PLANNED_EXPENSE_MERCHANT_AS_PLACE_INVALID");
  }
  for (const edge of resolved.children) if (purpose === "WRITE" && edge.localPlacePolicy === "REQUIRED"
    && costItems.some((item) => item.modulePath?.[1] === edge.childModule) && !context.childLocalPlaceRefs?.[edge.childModule])
    throw new TypeError("PLANNED_EXPENSE_CHILD_PLACE_REQUIRED");
  for (const stop of context.route?.stops ?? []) {
    if (!stop.placeId && (DELIVERY_PROVIDERS.some((provider) => provider.key !== "OTHER" && provider.label === stop.label)
      || context.seller === stop.label))
      throw new TypeError("PLANNED_EXPENSE_MERCHANT_AS_PLACE_INVALID");
    if (stop.endpointSource === "ROOT_PLACE" && (!context.place
      || context.place.kind === "KNOWN" && context.place.placeId !== stop.placeId
      || context.place.kind === "TEXT" && (context.place.label !== stop.label || stop.placeId)))
      throw new TypeError("PLANNED_EXPENSE_ROUTE_ENDPOINT_INVALID");
    if (stop.endpointSource === "CHILD_LOCAL_PLACE") {
      const childModule = stop.childModule;
      const ref = childModule ? context.childLocalPlaceRefs?.[childModule] : undefined;
      const edge = resolved.children.find((candidate) => candidate.childModule === childModule);
      if (!ref || !edge || edge.rootTransportStopAvailability === "NEVER"
        || ref.kind === "KNOWN" && ref.placeId !== stop.placeId
        || ref.kind === "TEXT" && (ref.label !== stop.label || stop.placeId))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_ENDPOINT_INVALID");
    }
  }
  if (context.route?.mode === "CAR") assertPrimaryRouteStop(context.route.stops, context.place);
  return { familyKey, subtypeKey: raw.subtypeKey as string | null, title: title(raw.title, "PLANNED_EXPENSE_TITLE_INVALID"),
    plannedDate, costItems, context };
}

function parseRow(value: unknown): PlannedExpense {
  const row = object(value, "PLANNED_EXPENSE_ROW_INVALID");
  const targetMonth = date(row.target_month, "PLANNED_EXPENSE_ROW_MONTH_INVALID").slice(0, 7);
  const draft = parsePlannedExpenseDraft({ familyKey: row.family_key, subtypeKey: row.subtype_key, title: row.title,
    plannedDate: row.planned_date, costItems: row.cost_items, context: row.context }, targetMonth);
  if (row.status !== "PLANNED" && row.status !== "DECLARED_REALIZED") throw new TypeError("PLANNED_EXPENSE_STATUS_INVALID");
  return { ...draft, id: uuid(row.planned_expense_id, "PLANNED_EXPENSE_ID_INVALID"),
    householdId: uuid(row.household_id, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), targetMonth,
    status: row.status, createdBy: uuid(row.created_by, "PLANNED_EXPENSE_CREATOR_INVALID"),
    updatedBy: uuid(row.updated_by, "PLANNED_EXPENSE_UPDATER_INVALID"),
    createdAt: dateTime(row.created_at), updatedAt: dateTime(row.updated_at) };
}
const dateTime = (value: unknown): string => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new TypeError("PLANNED_EXPENSE_TIMESTAMP_INVALID");
  return value;
};

async function validateReferences(client: SupabaseClient, householdId: string, draft: PlannedExpenseDraft): Promise<void> {
  const prospectiveRefs = [...draft.context.participantRefs ?? [], ...draft.context.host ? [draft.context.host] : []];
  const participantIds = [...draft.context.participantPersonIds ?? [], ...prospectiveRefs.flatMap((ref) => ref.kind === "HOUSEHOLD_PERSON" ? [ref.personId] : [])];
  const travellerIds = draft.context.travellingParticipantPersonIds ?? [];
  const workMealPeople = new Set(draft.costItems.flatMap((item) => item.baselineKey === "adrien-work-meals" ? ["Adrien"]
    : item.baselineKey === "manon-work-meals" ? ["Manon"] : []));
  if (participantIds.length === 0 && travellerIds.length === 0 && workMealPeople.size === 0
    && draft.context.personVisited?.kind !== "HOUSEHOLD_PERSON" && draft.context.place?.kind !== "KNOWN"
    && !Object.values(draft.context.childLocalPlaceRefs ?? {}).some((ref) => ref?.kind === "KNOWN")
    && !draft.context.route?.fuelEstimate && !draft.context.route?.stops.some((stop) => stop.placeId)) return;
  if (workMealPeople.size > 0 && participantIds.length === 0)
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_REQUIRED");
  const { data, error } = await client.from("persons").select("person_id,display_name,status")
    .eq("household_id", householdId);
  if (error) throw error;
  const people = (data ?? []).filter((person) => person.status === "active");
  const knownIds = new Set(people.map((person) => person.person_id));
  if ([...participantIds, ...travellerIds, ...(draft.context.personVisited?.kind === "HOUSEHOLD_PERSON"
    ? [draft.context.personVisited.personId] : [])].some((id) => !knownIds.has(id)))
    throw new TypeError("PLANNED_EXPENSE_PERSON_NOT_IN_HOUSEHOLD");
  if ([...workMealPeople].some((name) => !people.some((person) => person.display_name === name && participantIds.includes(person.person_id))))
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_BASELINE_PERSON_MISMATCH");
  if (draft.familyKey === "food" && draft.subtypeKey === "work_meal") {
    const name = people.find((person) => person.person_id === participantIds[0])?.display_name;
    if (name !== "Adrien" && name !== "Manon") throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_UNSUPPORTED");
    const allowed = name === "Adrien" ? "adrien-work-meals" : "manon-work-meals";
    if (draft.costItems.some((item) => item.baselineKey !== null && item.baselineKey !== allowed))
      throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_BASELINE_PERSON_MISMATCH");
    const sources = new Set(draft.costItems.flatMap((item) => item.fundingAllocations?.filter((part) => part.source !== "BANK").map((part) => part.source) ?? []));
    if (sources.size) {
      // Canonical wallets are not granted to authenticated clients. Read them only
      // after the active participant has been verified in this authenticated household.
      const wallets = await createCanonicalReadClient().from("benefit_wallets").select("provider,owner_person_id,status").eq("household_id", householdId);
      if (wallets.error) throw wallets.error;
      if ([...sources].some((source) => !wallets.data?.some((wallet) => wallet.provider === source && wallet.owner_person_id === participantIds[0] && wallet.status !== "INACTIVE")))
        throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_WALLET_PERSON_MISMATCH");
    }
  }
  if (draft.context.place?.kind === "KNOWN" || draft.context.route?.fuelEstimate
    || draft.context.route?.stops.some((stop) => stop.placeId)
    || Object.values(draft.context.childLocalPlaceRefs ?? {}).some((ref) => ref?.kind === "KNOWN")) {
    const options = await readPlannedContextOptions(createCanonicalReadClient(), householdId,
      people.map((person) => ({ personId: person.person_id, displayName: person.display_name })));
    if (draft.context.place?.kind === "KNOWN") {
      const rootPlaceId = draft.context.place.placeId;
      const visitedRef = draft.context.host ?? draft.context.personVisited;
      const label = draft.familyKey === "food" && draft.subtypeKey === "work_meal"
        ? people.find((person) => person.person_id === participantIds[0])?.display_name
        : visitedRef?.kind === "TEXT" ? visitedRef.label
          : visitedRef?.kind === "CONTACT"
            ? SOCIAL_CONTACTS_V1.find((contact) => contact.key === visitedRef.contactKey)?.label : undefined;
      const resolved = resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey,
        modifiers: plannedContextModifiers(draft.context, draft.subtypeKey === "work_meal" ? label : undefined) });
      const compatible = rankPlacesForPlannedContext(options.places, resolved,
        { contactKey: visitedRef?.kind === "CONTACT" ? visitedRef.contactKey
          : SOCIAL_CONTACTS_V1.find((contact) => contact.label === label)?.key,
        assetKeys: draft.costItems.flatMap((item) => item.assetKey ? [item.assetKey] : []), workMealPersonName: label, giftAssetKey: draft.costItems.find((item) => item.assetKey?.startsWith("gift:"))?.assetKey ?? undefined });
      if (!compatible.some((item) => item.place.placeId === rootPlaceId))
        throw new TypeError("PLANNED_EXPENSE_PLACE_CONTEXT_INVALID");
    }
    for (const [module, ref] of Object.entries(draft.context.childLocalPlaceRefs ?? {})) if (ref?.kind === "KNOWN") {
      const place = options.places.find((candidate) => candidate.placeId === ref.placeId);
      const roles = place ? derivePlannedPlaceRoles(place) : [];
      if (!place || place.privatePlace || !childPlaceRoles(module as AssetModule).some((role) => roles.includes(role)))
        throw new TypeError("PLANNED_EXPENSE_CHILD_PLACE_INVALID");
    }
    if (draft.context.route?.stops.some((stop) => stop.placeId && !options.places.some((place) => place.placeId === stop.placeId)))
      throw new TypeError("PLANNED_EXPENSE_ROUTE_PLACE_INVALID");
    if (!draft.context.route?.liveEstimate && draft.context.route?.fuelEstimate && (!options.vehicle
      || draft.context.route.fuelEstimate.vehicleLabel !== options.vehicle.label
      || draft.context.route.fuelEstimate.consumptionL100Km !== options.vehicle.consumptionL100Km
      || draft.context.route.fuelEstimate.fuelPricePerLiter !== options.vehicle.fuelPricePerLiter
      || draft.context.route.fuelEstimate.fuelPriceSource !== options.vehicle.fuelPriceSource))
      throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_STALE");
    if (draft.context.route?.stops.some((stop) => stop.distanceSource === "HISTORICAL_ROUTE")) {
      if (!options.vehicle) throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_STALE");
      const recalculated = resolvePlannedRoute(draft.context.route.stops,
        await readPlannedRouteHistory(createCanonicalReadClient(), householdId), options.vehicle);
      for (let index = 0; index < draft.context.route.stops.length; index++) {
        const stored = draft.context.route.stops[index]!, live = recalculated.stops[index];
        if (stored.distanceSource === "HISTORICAL_ROUTE" && (!live || stored.distanceToNextKm !== live.distanceToNextKm
          || stored.estimatedFuelLiters !== live.estimatedFuelLiters || !stored.evidence || !live.evidence
          || Object.keys(stored.evidence).some((key) => stored.evidence![key as keyof typeof stored.evidence] !== live.evidence![key as keyof typeof live.evidence])))
          throw new TypeError("PLANNED_EXPENSE_ROUTE_EVIDENCE_STALE");
      }
    }
    if (!draft.context.route?.liveEstimate && draft.context.route?.fuelEstimate?.fuelPriceObservedAt && (draft.context.route.fuelEstimate.fuelPriceObservedAt !== options.vehicle?.fuelPriceObservedAt
      || draft.context.route.fuelEstimate.fuelPriceQuality !== options.vehicle?.fuelPriceQuality))
      throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_STALE");
  }
}

const rowFields = "planned_expense_id,household_id,target_month,family_key,subtype_key,title,planned_date,status,cost_items,context,created_by,updated_by,created_at,updated_at";
const draftColumns = (draft: PlannedExpenseDraft) => ({ family_key: draft.familyKey, subtype_key: draft.subtypeKey,
  title: draft.title, planned_date: draft.plannedDate, cost_items: draft.costItems, context: draft.context });

/** Shared preview/create/update boundary: V1 structure, V2 resolved context, V3 graph,
 * V4 asset eligibility and V5 finance in parsePlannedExpenseDraft; V6 live refs below. */
export async function resolvePlannedExpenseDraft(client: SupabaseClient, householdId: string,
  targetMonth: string, rawDraft: unknown, purpose: "WRITE" | "PREVIEW" = "WRITE"): Promise<PlannedExpenseDraft> {
  // Parse the incoming estimate first: inconsistent client arithmetic is never trusted.
  let draft = parsePlannedExpenseDraft(rawDraft, targetMonth, purpose);
  let personName: string | undefined;
  if (draft.context.workMealMode && draft.context.workMealMode !== "FROM_HOME") {
    const people = await client.from("persons").select("person_id,display_name").eq("household_id", householdId);
    if (people.error) throw people.error;
    personName = people.data?.find((person) => person.person_id === draft.context.participantPersonIds?.[0])?.display_name;
  }
  const resolved = resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey, modifiers: plannedContextModifiers(draft.context, personName) });
  if (resolved.baseline.mode === "AUTO" && resolved.baseline.key) draft = { ...draft, costItems: draft.costItems.map((item) =>
    item.modulePath?.length !== 2 && costAllowsBaseline(item) ? { ...item, baselineKey: resolved.baseline.key } : item) };
  if (draft.context.route?.liveEstimate) {
    const reader = createCanonicalReadClient();
    const people = await client.from("persons").select("person_id,display_name").eq("household_id", householdId);
    if (people.error) throw people.error;
    const options = await readPlannedContextOptions(reader, householdId, (people.data ?? []).map((p) => ({ personId: p.person_id, displayName: p.display_name })));
    const previous = draft.context.route.liveEstimate;
    const result = await estimatePlannedCar({ stops: draft.context.route.stops, plannedDate: draft.plannedDate,
      plannedTime: draft.context.route.plannedTime ?? previous.plannedTime, timeKind: draft.context.route.timeKind ?? previous.timeKind,
      preference: draft.context.route.preference ?? previous.preference, manualFuelPrice: draft.context.route.manualFuelPrice }, { places: options.places, vehicle: options.vehicle, history: await readPlannedRouteHistory(reader, householdId) });
    if (!result.snapshot || !result.fuelEstimate) throw new TypeError("PLANNED_ROUTE_PRICE_UNAVAILABLE");
    const changed = previous.vehicleId !== result.snapshot.vehicleId || previous.route.geometryHash !== result.snapshot.route.geometryHash
      || previous.fuelEconomicCost !== result.snapshot.fuelEconomicCost || previous.toll.amount !== result.snapshot.toll.amount;
    if (changed && purpose === "WRITE") throw new TypeError("PLANNED_ROUTE_ESTIMATE_CHANGED");
    draft = parsePlannedExpenseDraft(applyCarResult(draft, result, randomUUID), targetMonth, purpose);
    if (carEstimateProblems(draft).length) throw new TypeError("PLANNED_ROUTE_COST_INCOMPLETE");
  } else if (draft.context.route?.mode === "CAR") {
    const options = await readPlannedContextOptions(createCanonicalReadClient(), householdId, []);
    if (!options.vehicle) throw new TypeError("PLANNED_EXPENSE_VEHICLE_PRICE_UNAVAILABLE");
    const route = resolvePlannedRoute(draft.context.route.stops,
      await readPlannedRouteHistory(createCanonicalReadClient(), householdId), options.vehicle);
    if (!route.fuelEstimate) throw new TypeError("PLANNED_EXPENSE_ROUTE_DISTANCE_REQUIRED");
    draft = parsePlannedExpenseDraft({ ...draft, context: { ...draft.context,
      route: { mode: "CAR", stops: route.stops, fuelEstimate: route.fuelEstimate } },
      costItems: draft.costItems.map((item) => item.assetKey === "transport:fuel_usage"
        ? { ...item, unitAmount: route.fuelEstimate!.cost } : item) }, targetMonth, purpose);
  }
  await validateReferences(client, uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), draft);
  return draft;
}

export async function readPlannedExpenses(client: SupabaseClient, householdId: string, targetMonth: string): Promise<PlannedExpense[]> {
  parseTargetMonth(targetMonth);
  const { data, error } = await client.from("phase2_planned_expenses").select(rowFields)
    .eq("household_id", uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"))
    .eq("target_month", `${targetMonth}-01`).order("created_at").order("planned_expense_id");
  if (error) throw error;
  return (data ?? []).map(parseRow);
}

/** A draft never writes to Supabase. Editing replaces the saved ID in the same financial path. */
export async function preparePlannedExpenseSimulation(client: SupabaseClient, householdId: string,
  forecast: MonthForecastSnapshot, inputs: MonthInputs, saved: readonly PlannedExpense[],
  rawDraft: unknown, asOfDate: string, editedId?: string, purpose: "WRITE" | "PREVIEW" = "WRITE") {
  const draft = await resolvePlannedExpenseDraft(client, householdId, forecast.meta.targetMonth, rawDraft, purpose);
  const existing = editedId === undefined ? undefined : saved.find((item) => item.id === uuid(editedId, "PLANNED_EXPENSE_ID_INVALID"));
  if (editedId !== undefined && !existing)
    throw new TypeError("PLANNED_EXPENSE_EDIT_TARGET_INVALID");
  if (saved.some((item) => item.householdId !== householdId || item.targetMonth !== forecast.meta.targetMonth))
    throw new TypeError("PLANNED_EXPENSE_SAVED_SCOPE_INVALID");
  return { draft, scenario: simulatePlannedExpenseScenario(forecast, inputs, saved,
    { id: existing?.id ?? randomUUID(), targetMonth: forecast.meta.targetMonth,
      status: existing?.status ?? "PLANNED", costItems: draft.costItems, plannedDate: draft.plannedDate, context: draft.context }, asOfDate) };
}
export async function simulatePlannedExpense(...args: Parameters<typeof preparePlannedExpenseSimulation>) {
  return (await preparePlannedExpenseSimulation(...args)).scenario;
}
export async function createPlannedExpense(client: SupabaseClient, householdId: string, targetMonth: string,
  userId: string, rawDraft: unknown, requestId: string): Promise<PlannedExpense> {
  const id = uuid(requestId, "PLANNED_EXPENSE_ID_INVALID");
  const draft = await resolvePlannedExpenseDraft(client, householdId, targetMonth, rawDraft);
  const { data, error } = await client.from("phase2_planned_expenses").insert({
    planned_expense_id: id, household_id: householdId, target_month: `${targetMonth}-01`,
    ...draftColumns(draft), status: "PLANNED", created_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_by: userId,
  }).select(rowFields).single();
  if (error?.code === "23505") {
    // The primary key arbitrates concurrent attempts. Never upsert: a replay cannot overwrite.
    const existing = await requireExpense(client, householdId, id);
    if (existing.createdBy !== userId || existing.targetMonth !== targetMonth || !sameIntent(existing, draft))
      throw new TypeError("PLANNED_EXPENSE_IDEMPOTENCY_CONFLICT");
    return existing;
  }
  if (error) throw error;
  return parseRow(data);
}
async function requireExpense(client: SupabaseClient, householdId: string, id: string): Promise<PlannedExpense> {
  const { data, error } = await client.from("phase2_planned_expenses").select(rowFields)
    .eq("household_id", uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"))
    .eq("planned_expense_id", uuid(id, "PLANNED_EXPENSE_ID_INVALID")).single();
  if (error?.code === "PGRST116" || !error && !data) throw new TypeError("PLANNED_EXPENSE_NOT_FOUND");
  if (error) throw error;
  return parseRow(data);
}
export async function updatePlannedExpense(client: SupabaseClient, householdId: string, id: string,
  userId: string, rawDraft: unknown, expectedUpdatedAt: string): Promise<PlannedExpense> {
  const previous = await requireExpense(client, householdId, id);
  if (previous.status !== "PLANNED") throw new TypeError("PLANNED_EXPENSE_REALIZED_EDIT_FORBIDDEN");
  assertVersion(previous, expectedUpdatedAt);
  const draft = await resolvePlannedExpenseDraft(client, householdId, previous.targetMonth, rawDraft);
  return compareAndSet(client, previous, userId, draft, "PLANNED", expectedUpdatedAt);
}
export async function deletePlannedExpense(client: SupabaseClient, householdId: string, id: string,
  expectedUpdatedAt: string): Promise<void> {
  const previous = await requireExpense(client, householdId, id);
  assertVersion(previous, expectedUpdatedAt);
  const { data, error } = await client.from("phase2_planned_expenses").delete()
    .eq("household_id", householdId).eq("planned_expense_id", id).eq("updated_at", expectedUpdatedAt)
    .select("planned_expense_id").maybeSingle();
  if (error) throw error;
  if (data?.planned_expense_id !== id) throw new TypeError("PLANNED_EXPENSE_EDIT_STALE");
}

function sameIntent(left: PlannedExpenseDraft, right: PlannedExpenseDraft): boolean {
  const intent = (draft: PlannedExpenseDraft) => {
    const copy = JSON.parse(JSON.stringify(draftColumns(draft)));
    // Live derivations may change between equivalent intent replays.
    if (copy.context.route?.mode === "CAR") {
      delete copy.context.route.fuelEstimate;
      if (copy.context.route.liveEstimate) {
        copy.context.route.selectedPreference = copy.context.route.liveEstimate.preference;
        copy.context.route.selectedVehicleId = copy.context.route.liveEstimate.vehicleId;
        delete copy.context.route.liveEstimate;
      }
      for (const stop of copy.context.route.stops) {
        if (stop.coordinates?.source !== "USER_DECLARED") delete stop.coordinates;
        if (stop.distanceSource === "HISTORICAL_ROUTE" || stop.distanceSource === "TOMTOM") {
        delete stop.distanceToNextKm; delete stop.estimatedFuelLiters; delete stop.evidence;
        }
      }
      for (const item of copy.cost_items) if (item.assetKey === "transport:fuel_usage" || item.assetKey === "transport:toll" && item.priceSource === "CALCULATED") delete item.unitAmount;
    }
    const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, part]) => [key, canonical(part)])) : value;
    return JSON.stringify(canonical(copy));
  };
  return intent(left) === intent(right);
}
function assertVersion(previous: PlannedExpense, expected: string, reality = false) {
  if (!expected || Number.isNaN(Date.parse(expected)) || previous.updatedAt !== expected)
    throw new TypeError(reality ? "REALITY_DRAFT_STALE" : "PLANNED_EXPENSE_EDIT_STALE");
}
async function compareAndSet(client: SupabaseClient, previous: PlannedExpense, userId: string,
  draft: PlannedExpenseDraft, status: PlannedExpenseStatus, expected: string,
  targetMonth = previous.targetMonth, reality = false): Promise<PlannedExpense> {
  const { data, error } = await client.from("phase2_planned_expenses").update({ ...draftColumns(draft), status,
    ...(targetMonth !== previous.targetMonth ? { target_month: `${targetMonth}-01` } : {}),
    updated_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"),
    updated_at: new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString() })
    .eq("household_id", previous.householdId).eq("planned_expense_id", previous.id)
    .eq("updated_at", expected).eq("status", previous.status).select(rowFields).maybeSingle();
  if (error) throw error;
  if (!data) throw new TypeError(reality ? "REALITY_DRAFT_STALE" : "PLANNED_EXPENSE_EDIT_STALE");
  return parseRow(data);
}

/** Final content and lifecycle are one SQL UPDATE, arbitrated by the existing updated_at. */
export async function declarePlannedExpense(client: SupabaseClient, householdId: string, id: string,
  userId: string, rawDraft: unknown, expected: string,
  preflight: (draft: PlannedExpenseDraft, previous: PlannedExpense) => Promise<void>, correction = false) {
  const previous = await requireExpense(client, householdId, id);
  const draft = await resolvePlannedExpenseDraft(client, householdId, previous.targetMonth, rawDraft);
  if (!correction && previous.status === "DECLARED_REALIZED" && previous.updatedBy === userId && sameIntent(previous, draft))
    return previous; // identical confirmation replay; no second write or contribution
  assertVersion(previous, expected, true);
  if (previous.status !== (correction ? "DECLARED_REALIZED" : "PLANNED"))
    throw new TypeError("PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
  await preflight(draft, previous);
  try { return await compareAndSet(client, previous, userId, draft, "DECLARED_REALIZED", expected, previous.targetMonth, true); }
  catch (error) {
    if (!correction && error instanceof Error && error.message === "REALITY_DRAFT_STALE") {
      const current = await requireExpense(client, householdId, id);
      if (current.status === "DECLARED_REALIZED" && current.updatedBy === userId && sameIntent(current, draft)) return current;
    }
    throw error;
  }
}
export async function restorePlannedExpense(client: SupabaseClient, householdId: string, id: string,
  userId: string, expected: string) {
  const previous = await requireExpense(client, householdId, id);
  assertVersion(previous, expected, true);
  if (previous.status !== "DECLARED_REALIZED") throw new TypeError("PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
  // Inverse presentation/funding transition preserves the final content exactly.
  return compareAndSet(client, previous, userId, previous, "PLANNED", expected, previous.targetMonth, true);
}
export async function reportPlannedExpense(client: SupabaseClient, householdId: string, id: string,
  userId: string, plannedDate: string, expected: string,
  preflight: (draft: PlannedExpenseDraft, targetMonth: string) => Promise<void>) {
  const previous = await requireExpense(client, householdId, id);
  assertVersion(previous, expected);
  if (previous.status !== "PLANNED") throw new TypeError("PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
  const targetMonth = date(plannedDate, "PLANNED_EXPENSE_DATE_INVALID").slice(0, 7);
  const raw = { familyKey: previous.familyKey, subtypeKey: previous.subtypeKey, title: previous.title,
    plannedDate, costItems: previous.costItems, context: previous.context };
  const draft = await resolvePlannedExpenseDraft(client, householdId, targetMonth, raw);
  await preflight(draft, targetMonth);
  return compareAndSet(client, previous, userId, draft, "PLANNED", expected, targetMonth);
}
