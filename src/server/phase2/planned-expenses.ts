import "server-only";

import { randomUUID } from "node:crypto";
import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { PLANNED_EXPENSE_SUBTYPES, plannedAsset, rootAssetModule, type AssetModule, type PlannedExpenseFamily } from "@/domain/phase2/planned-assets";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { placesForPlannedContext } from "@/domain/phase2/planned-places";
import type { CostItem, FundingAllocation, FundingSource, PlannedBaselineKey, PlannedExpenseContext,
  PlannedExpenseDraft, PriceSource } from "@/domain/phase2/planned-contract";
import { readPlannedContextOptions } from "./planned-context";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import { simulatePlannedExpenseScenario, type MonthInputs } from "./month-scenario";

export { PLANNED_EXPENSE_SUBTYPES };
export type { PlannedExpenseFamily };
export type { CostItem, FundingAllocation, FundingSource, PlannedBaselineKey, PlannedExpenseContext,
  PlannedExpenseDraft, PriceSource };
export type PlannedExpenseStatus = "PLANNED" | "DECLARED_REALIZED";
export type PlannedExpense = PlannedExpenseDraft & Readonly<{ id: string; householdId: string; targetMonth: string;
  status: PlannedExpenseStatus; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string }>;
export type PlannedExpenseScenarioEntry = Pick<PlannedExpense, "id" | "targetMonth" | "status" | "costItems">;

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
const moduleKeys = new Set<AssetModule>(["bar", "club", "house_party", "groceries", "restaurant", "fast_food", "work_meal", "transport", "visit_family", "visit_friend", "trip", "activity", "fishing", "beauty", "clothing", "household", "home", "gift", "tech", "automotive", "other"]);

export function parsePlannedExpenseDraft(value: unknown, targetMonth: string): PlannedExpenseDraft {
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
  if (!Array.isArray(raw.costItems) || raw.costItems.length < 1 || raw.costItems.length > 50)
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
      if (!Array.isArray(item.modulePath) || item.modulePath.length < 1 || item.modulePath.length > 5
        || item.modulePath.some((part: unknown) => typeof part !== "string" || !moduleKeys.has(part as AssetModule)))
        throw new TypeError("PLANNED_EXPENSE_MODULE_PATH_INVALID");
      return item.modulePath as AssetModule[];
    })();
    const module = modulePath?.at(-1) ?? rootAssetModule(familyKey, raw.subtypeKey as string | null);
    if (assetKey !== null && plannedAsset(assetKey)?.module !== module)
      throw new TypeError("PLANNED_EXPENSE_ASSET_MODULE_INVALID");
    const baselineKey = item.baselineKey;
    if (baselineKey !== null && (typeof baselineKey !== "string" || !baselineKeys.has(baselineKey as PlannedBaselineKey)))
      throw new TypeError("PLANNED_EXPENSE_BASELINE_INVALID");
    const allowedBaseline = module === "groceries" ? ["groceries"] : module === "restaurant" || module === "fast_food"
      ? ["household-restaurants"] : module === "work_meal" ? ["adrien-work-meals", "manon-work-meals"] : [];
    if (baselineKey !== null && !allowedBaseline.includes(baselineKey as string))
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
    }
    const priceSource = item.priceSource;
    if (priceSource !== undefined && !["MANUAL", "SYSTEM_DEFAULT", "LAST_KNOWN", "CALCULATED"].includes(priceSource as string))
      throw new TypeError("PLANNED_EXPENSE_PRICE_SOURCE_INVALID");
    if (priceSource === "CALCULATED" && assetKey !== "transport:fuel_usage")
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
  keysOnly(contextRaw, ["participantPersonIds", "travellingParticipantPersonIds", "additionalGuestCount", "personVisited",
    "place", "purchaseMode", "deliveryProvider", "seller", "gift", "route"], "PLANNED_EXPENSE_CONTEXT_FIELDS_INVALID");
  const context: { -readonly [K in keyof PlannedExpenseContext]?: PlannedExpenseContext[K] } = {};
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
  if (contextRaw.personVisited !== undefined) {
    const visited = object(contextRaw.personVisited, "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
    if (visited.kind === "KNOWN") {
      keysOnly(visited, ["kind", "personId"], "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
      context.personVisited = { kind: "KNOWN", personId: uuid(visited.personId, "PLANNED_EXPENSE_VISITED_PERSON_INVALID") };
    } else if (visited.kind === "TEXT") {
      keysOnly(visited, ["kind", "label"], "PLANNED_EXPENSE_VISITED_PERSON_INVALID");
      context.personVisited = { kind: "TEXT", label: title(visited.label, "PLANNED_EXPENSE_VISITED_PERSON_INVALID") };
    } else throw new TypeError("PLANNED_EXPENSE_VISITED_PERSON_INVALID");
  }
  if (contextRaw.place !== undefined) {
    const place = object(contextRaw.place, "PLANNED_EXPENSE_PLACE_INVALID");
    if (place.kind === "KNOWN") {
      keysOnly(place, ["kind", "placeId"], "PLANNED_EXPENSE_PLACE_FIELDS_INVALID");
      context.place = { kind: "KNOWN", placeId: uuid(place.placeId, "PLANNED_EXPENSE_PLACE_ID_INVALID") };
    } else if (place.kind === "TEXT") {
      keysOnly(place, ["kind", "label"], "PLANNED_EXPENSE_PLACE_FIELDS_INVALID");
      context.place = { kind: "TEXT", label: title(place.label, "PLANNED_EXPENSE_PLACE_LABEL_INVALID") };
    } else throw new TypeError("PLANNED_EXPENSE_PLACE_KIND_INVALID");
  }
  if (contextRaw.purchaseMode !== undefined) {
    if (!["IN_STORE", "ONLINE", "TAKEAWAY", "DELIVERY"].includes(contextRaw.purchaseMode as string))
      throw new TypeError("PLANNED_EXPENSE_PURCHASE_MODE_INVALID");
    context.purchaseMode = contextRaw.purchaseMode as PlannedExpenseContext["purchaseMode"];
  }
  if (contextRaw.deliveryProvider !== undefined)
    context.deliveryProvider = title(contextRaw.deliveryProvider, "PLANNED_EXPENSE_DELIVERY_PROVIDER_INVALID");
  if (contextRaw.seller !== undefined)
    context.seller = title(contextRaw.seller, "PLANNED_EXPENSE_SELLER_INVALID");
  if (familyKey === "food" && raw.subtypeKey === "fast_food"
    && context.purchaseMode !== "TAKEAWAY" && context.purchaseMode !== "DELIVERY")
    throw new TypeError("PLANNED_EXPENSE_PURCHASE_MODE_REQUIRED");
  if (familyKey === "purchase" && raw.subtypeKey === "clothing"
    && context.purchaseMode !== "IN_STORE" && context.purchaseMode !== "ONLINE")
    throw new TypeError("PLANNED_EXPENSE_PURCHASE_MODE_REQUIRED");
  if (context.purchaseMode === "DELIVERY" && !context.deliveryProvider)
    throw new TypeError("PLANNED_EXPENSE_DELIVERY_PROVIDER_REQUIRED");
  if (context.purchaseMode === "ONLINE" && !context.seller)
    throw new TypeError("PLANNED_EXPENSE_SELLER_REQUIRED");
  if (contextRaw.gift !== undefined) {
    const gift = object(contextRaw.gift, "PLANNED_EXPENSE_GIFT_INVALID");
    keysOnly(gift, ["recipient", "occasion"], "PLANNED_EXPENSE_GIFT_INVALID");
    context.gift = { recipient: title(gift.recipient, "PLANNED_EXPENSE_GIFT_RECIPIENT_INVALID"),
      occasion: title(gift.occasion, "PLANNED_EXPENSE_GIFT_OCCASION_INVALID") };
  }
  if (contextRaw.route !== undefined) {
    const route = object(contextRaw.route, "PLANNED_EXPENSE_ROUTE_INVALID");
    keysOnly(route, ["mode", "stops", "fuelEstimate"], "PLANNED_EXPENSE_ROUTE_INVALID");
    if (!["CAR", "TRAIN", "BUS", "TAXI"].includes(route.mode as string)
      || !Array.isArray(route.stops) || route.stops.length < 2 || route.stops.length > 12)
      throw new TypeError("PLANNED_EXPENSE_ROUTE_INVALID");
    const stops = route.stops.map((rawStop: unknown, index: number) => {
      const stop = object(rawStop, "PLANNED_EXPENSE_ROUTE_STOP_INVALID");
      keysOnly(stop, ["label", "placeId", "distanceToNextKm"], "PLANNED_EXPENSE_ROUTE_STOP_INVALID");
      const label = title(stop.label, "PLANNED_EXPENSE_ROUTE_STOP_INVALID");
      const placeId = stop.placeId === undefined ? undefined : uuid(stop.placeId, "PLANNED_EXPENSE_ROUTE_PLACE_INVALID");
      const km = stop.distanceToNextKm;
      if (index === (route.stops as unknown[]).length - 1 ? km !== null && km !== undefined
        : typeof km !== "string" || !/^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/u.test(km) || new Big(km).lte(0))
        throw new TypeError("PLANNED_EXPENSE_ROUTE_DISTANCE_INVALID");
      return { label, ...(placeId ? { placeId } : {}), distanceToNextKm: index === (route.stops as unknown[]).length - 1 ? null : km as string };
    });
    let fuelEstimate: NonNullable<PlannedExpenseContext["route"]>["fuelEstimate"];
    if (route.fuelEstimate !== undefined) {
      const estimate = object(route.fuelEstimate, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      keysOnly(estimate, ["vehicleLabel", "consumptionL100Km", "fuelPricePerLiter", "fuelPriceSource", "distanceKm", "liters", "cost"], "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      const consumptionL100Km = decimal(estimate.consumptionL100Km, /^(?:0|[1-9]\d{0,2})(?:\.\d{1,3})?$/u, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      const fuelPricePerLiter = decimal(estimate.fuelPricePerLiter, /^(?:0|[1-9]\d{0,2})(?:\.\d{1,3})?$/u, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID");
      const distanceKm = stops.slice(0, -1).reduce((sum, stop) => sum.plus(stop.distanceToNextKm!), new Big(0));
      const liters = distanceKm.times(consumptionL100Km).div(100);
      const cost = liters.times(fuelPricePerLiter).round(2);
      if (estimate.distanceKm !== distanceKm.toFixed(2) || estimate.liters !== liters.round(3).toFixed(3)
        || estimate.cost !== cost.toFixed(2)) throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_MISMATCH");
      fuelEstimate = { vehicleLabel: title(estimate.vehicleLabel, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID"),
        consumptionL100Km, fuelPricePerLiter, fuelPriceSource: title(estimate.fuelPriceSource, "PLANNED_EXPENSE_FUEL_ESTIMATE_INVALID"),
        distanceKm: distanceKm.toFixed(2), liters: liters.round(3).toFixed(3), cost: cost.toFixed(2) };
    }
    if (route.mode === "CAR" && (!fuelEstimate || costItems.filter((item) => item.assetKey === "transport:fuel_usage"
      && item.quantity === "1" && item.unitAmount === fuelEstimate.cost && item.priceSource === "CALCULATED").length !== 1))
      throw new TypeError("PLANNED_EXPENSE_CAR_ESTIMATE_REQUIRED");
    context.route = { mode: route.mode as NonNullable<PlannedExpenseContext["route"]>["mode"], stops,
      ...(fuelEstimate ? { fuelEstimate } : {}) };
  }
  if ((familyKey === "visit_trip" && ["family_visit", "friend_visit"].includes(raw.subtypeKey as string))
    && !context.personVisited) throw new TypeError("PLANNED_EXPENSE_VISITED_PERSON_REQUIRED");
  if (familyKey === "food" && raw.subtypeKey === "work_meal" && context.participantPersonIds?.length !== 1)
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_REQUIRED");
  if (familyKey === "purchase" && raw.subtypeKey === "gift" && !context.gift)
    throw new TypeError("PLANNED_EXPENSE_GIFT_RECIPIENT_REQUIRED");
  if (costItems.some((item) => item.assetKey === "transport:fuel_usage")
    && (context.route?.mode !== "CAR" || !context.route.fuelEstimate))
    throw new TypeError("PLANNED_EXPENSE_CAR_ESTIMATE_REQUIRED");
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
  const participantIds = draft.context.participantPersonIds ?? [];
  const travellerIds = draft.context.travellingParticipantPersonIds ?? [];
  const workMealPeople = new Set(draft.costItems.flatMap((item) => item.baselineKey === "adrien-work-meals" ? ["Adrien"]
    : item.baselineKey === "manon-work-meals" ? ["Manon"] : []));
  if (participantIds.length === 0 && travellerIds.length === 0 && workMealPeople.size === 0
    && draft.context.personVisited?.kind !== "KNOWN" && draft.context.place?.kind !== "KNOWN"
    && !draft.context.route?.fuelEstimate && !draft.context.route?.stops.some((stop) => stop.placeId)) return;
  if (workMealPeople.size > 0 && participantIds.length === 0)
    throw new TypeError("PLANNED_EXPENSE_WORK_MEAL_PERSON_REQUIRED");
  const { data, error } = await client.from("persons").select("person_id,display_name,status")
    .eq("household_id", householdId);
  if (error) throw error;
  const people = (data ?? []).filter((person) => person.status === "active");
  const knownIds = new Set(people.map((person) => person.person_id));
  if ([...participantIds, ...travellerIds, ...(draft.context.personVisited?.kind === "KNOWN"
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
  }
  if (draft.context.place?.kind === "KNOWN" || draft.context.route?.fuelEstimate || draft.context.route?.stops.some((stop) => stop.placeId)) {
    const options = await readPlannedContextOptions(createCanonicalReadClient(), householdId,
      people.map((person) => ({ personId: person.person_id, displayName: person.display_name })));
    if (draft.context.place?.kind === "KNOWN") {
      const label = draft.familyKey === "food" && draft.subtypeKey === "work_meal"
        ? people.find((person) => person.person_id === participantIds[0])?.display_name
        : draft.context.personVisited?.kind === "TEXT" ? draft.context.personVisited.label : undefined;
      if (!placesForPlannedContext(options.places, draft.familyKey, draft.subtypeKey, label)
        .some((place) => place.placeId === (draft.context.place as { placeId: string }).placeId))
        throw new TypeError("PLANNED_EXPENSE_PLACE_CONTEXT_INVALID");
    }
    if (draft.context.route?.stops.some((stop) => stop.placeId && !options.places.some((place) => place.placeId === stop.placeId)))
      throw new TypeError("PLANNED_EXPENSE_ROUTE_PLACE_INVALID");
    if (draft.context.route?.fuelEstimate && (!options.vehicle
      || draft.context.route.fuelEstimate.vehicleLabel !== options.vehicle.label
      || draft.context.route.fuelEstimate.consumptionL100Km !== options.vehicle.consumptionL100Km
      || draft.context.route.fuelEstimate.fuelPricePerLiter !== options.vehicle.fuelPricePerLiter))
      throw new TypeError("PLANNED_EXPENSE_FUEL_ESTIMATE_STALE");
  }
}

const rowFields = "planned_expense_id,household_id,target_month,family_key,subtype_key,title,planned_date,status,cost_items,context,created_by,updated_by,created_at,updated_at";
const draftColumns = (draft: PlannedExpenseDraft) => ({ family_key: draft.familyKey, subtype_key: draft.subtypeKey,
  title: draft.title, planned_date: draft.plannedDate, cost_items: draft.costItems, context: draft.context });

export async function readPlannedExpenses(client: SupabaseClient, householdId: string, targetMonth: string): Promise<PlannedExpense[]> {
  parseTargetMonth(targetMonth);
  const { data, error } = await client.from("phase2_planned_expenses").select(rowFields)
    .eq("household_id", uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"))
    .eq("target_month", `${targetMonth}-01`).order("created_at").order("planned_expense_id");
  if (error) throw error;
  return (data ?? []).map(parseRow);
}

/** A draft never writes to Supabase. Editing replaces the saved ID in the same financial path. */
export async function simulatePlannedExpense(client: SupabaseClient, householdId: string,
  forecast: MonthForecastSnapshot, inputs: MonthInputs, saved: readonly PlannedExpense[],
  rawDraft: unknown, asOfDate: string, editedId?: string) {
  const draft = parsePlannedExpenseDraft(rawDraft, forecast.meta.targetMonth);
  await validateReferences(client, uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), draft);
  const existing = editedId === undefined ? undefined : saved.find((item) => item.id === uuid(editedId, "PLANNED_EXPENSE_ID_INVALID"));
  if (editedId !== undefined && (!existing || existing.status !== "PLANNED"))
    throw new TypeError("PLANNED_EXPENSE_EDIT_TARGET_INVALID");
  if (saved.some((item) => item.householdId !== householdId || item.targetMonth !== forecast.meta.targetMonth))
    throw new TypeError("PLANNED_EXPENSE_SAVED_SCOPE_INVALID");
  return simulatePlannedExpenseScenario(forecast, inputs, saved,
    { id: existing?.id ?? randomUUID(), targetMonth: forecast.meta.targetMonth, status: "PLANNED", costItems: draft.costItems }, asOfDate);
}
export async function createPlannedExpense(client: SupabaseClient, householdId: string, targetMonth: string,
  userId: string, rawDraft: unknown): Promise<PlannedExpense> {
  const draft = parsePlannedExpenseDraft(rawDraft, targetMonth);
  await validateReferences(client, uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"), draft);
  const { data, error } = await client.from("phase2_planned_expenses").insert({
    planned_expense_id: randomUUID(), household_id: householdId, target_month: `${targetMonth}-01`,
    ...draftColumns(draft), status: "PLANNED", created_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_by: userId,
  }).select(rowFields).single();
  if (error) throw error;
  return parseRow(data);
}
async function requireExpense(client: SupabaseClient, householdId: string, id: string): Promise<PlannedExpense> {
  const { data, error } = await client.from("phase2_planned_expenses").select(rowFields)
    .eq("household_id", uuid(householdId, "PLANNED_EXPENSE_HOUSEHOLD_INVALID"))
    .eq("planned_expense_id", uuid(id, "PLANNED_EXPENSE_ID_INVALID")).single();
  if (error) throw error;
  return parseRow(data);
}
export async function updatePlannedExpense(client: SupabaseClient, householdId: string, id: string,
  userId: string, rawDraft: unknown): Promise<PlannedExpense> {
  const previous = await requireExpense(client, householdId, id);
  if (previous.status !== "PLANNED") throw new TypeError("PLANNED_EXPENSE_REALIZED_EDIT_FORBIDDEN");
  const draft = parsePlannedExpenseDraft(rawDraft, previous.targetMonth);
  await validateReferences(client, householdId, draft);
  const { data, error } = await client.from("phase2_planned_expenses").update({ ...draftColumns(draft),
    updated_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_at: new Date().toISOString() })
    .eq("household_id", householdId).eq("planned_expense_id", id).eq("status", "PLANNED")
    .select(rowFields).single();
  if (error) throw error;
  const updated = parseRow(data);
  if (updated.createdBy !== previous.createdBy || updated.id !== previous.id || updated.householdId !== previous.householdId)
    throw new TypeError("PLANNED_EXPENSE_IDENTITY_CHANGED");
  return updated;
}
export async function deletePlannedExpense(client: SupabaseClient, householdId: string, id: string): Promise<void> {
  await requireExpense(client, householdId, id);
  const { data, error } = await client.from("phase2_planned_expenses").delete()
    .eq("household_id", householdId).eq("planned_expense_id", id).select("planned_expense_id").single();
  if (error) throw error;
  if (data?.planned_expense_id !== id) throw new TypeError("PLANNED_EXPENSE_DELETE_MISSING");
}
async function setStatus(client: SupabaseClient, householdId: string, id: string, userId: string,
  from: PlannedExpenseStatus, to: PlannedExpenseStatus): Promise<PlannedExpense> {
  const previous = await requireExpense(client, householdId, id);
  if (previous.status !== from) throw new TypeError("PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
  const { data, error } = await client.from("phase2_planned_expenses").update({ status: to,
    updated_by: uuid(userId, "PLANNED_EXPENSE_USER_INVALID"), updated_at: new Date().toISOString() })
    .eq("household_id", householdId).eq("planned_expense_id", id).eq("status", from).select(rowFields).single();
  if (error) throw error;
  const updated = parseRow(data);
  if (updated.createdBy !== previous.createdBy || updated.id !== previous.id) throw new TypeError("PLANNED_EXPENSE_IDENTITY_CHANGED");
  return updated;
}
export const markPlannedExpenseRealized = (client: SupabaseClient, householdId: string, id: string, userId: string) =>
  setStatus(client, householdId, id, userId, "PLANNED", "DECLARED_REALIZED");
export const restorePlannedExpense = (client: SupabaseClient, householdId: string, id: string, userId: string) =>
  setStatus(client, householdId, id, userId, "DECLARED_REALIZED", "PLANNED");
