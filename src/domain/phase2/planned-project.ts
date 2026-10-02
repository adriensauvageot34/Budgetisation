import type { CostItem, PlannedExpenseDraft, PlannedProjectContext } from "./planned-contract";
import { validGooglePlaceId, type ProjectPlaceKind } from "./restaurant-places";
import { intentForDraft } from "./planned-ux";
import { getPlannedExpenseDateRange } from "./planned-dates";

/** Exact economic identities; a custom lodging line must explicitly carry its purpose. */
export function projectCostComponent(item: CostItem): "Transport" | "Péages" | "Hébergement" | null {
  if (item.assetKey === "transport:toll") return "Péages";
  if (["transport:train", "transport:bus", "transport:uber", "transport:carpool", "transport:flight", "transport:other"].includes(item.assetKey ?? "")) return "Transport";
  if (["trip:hotel", "trip:airbnb"].includes(item.assetKey ?? "") || item.assetKey === null && item.label === "Hébergement") return "Hébergement";
  return null;
}

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
export function projectNights(draft: PlannedExpenseDraft): number {
  const { startDate, endDate } = getPlannedExpenseDateRange(draft);
  return startDate && endDate ? Math.max(0, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000)) : 0;
}
export const projectAllowsDateRange = (draft: PlannedExpenseDraft): boolean => draft.familyKey === "visit_trip"
  || draft.familyKey === "activity" || draft.familyKey === "outing";
export const projectLodgingAvailable = (draft: PlannedExpenseDraft): boolean => draft.context.project?.version === 2
  && projectAllowsDateRange(draft) && (draft.context.project.tripKind === "STAY" || projectNights(draft) > 0);
export const projectLodgingAssetAllowed = (draft: PlannedExpenseDraft, item: CostItem): boolean => projectLodgingAvailable(draft)
  && item.modulePath?.length === 1 && ["trip:hotel", "trip:airbnb"].includes(item.assetKey ?? "");
const fail = (): never => { throw new TypeError("PLANNED_PROJECT_INVALID"); };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const only = (v: Record<string, unknown>, keys: readonly string[]) => { if (Object.keys(v).some(k => !keys.includes(k))) fail(); };
const text = (v: unknown, max = 160): string => typeof v === "string" && v.trim() && v.length <= max ? v.trim() : fail();
const choice = <const T extends string>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : fail();

/** The same structural boundary is used by Server and fixture tests. No registry is stored. */
export function parsePlannedProject(value: unknown): PlannedProjectContext {
  const raw = object(value);
  only(raw, ["version", "financialScope", "moment", "exactTime", "returnMoment", "returnExactTime", "channel", "entity", "sellerGooglePlaceId", "unpricedComponents", "tripKind", "lodging", "mealFormat", "groceryFocus", "automotiveKind", "linkedProjectId", "shareTransport"]);
  if (raw.version !== 2) fail();
  const result: { -readonly [K in keyof PlannedProjectContext]?: PlannedProjectContext[K] } = { version: 2 };
  if (raw.financialScope !== undefined) {
    const scope = object(raw.financialScope); only(scope, ["personIds", "count"]);
    if (!Array.isArray(scope.personIds) || scope.personIds.length > 20 || scope.personIds.some(id => typeof id !== "string" || !uuid.test(id))
      || new Set(scope.personIds).size !== scope.personIds.length || !Number.isInteger(scope.count) || Number(scope.count) < 1
      || Number(scope.count) > 99 || Number(scope.count) < scope.personIds.length) fail();
    result.financialScope = { personIds: scope.personIds as string[], count: Number(scope.count) };
  }
  if (raw.moment !== undefined) result.moment = choice(raw.moment, ["NONE", "MORNING", "LUNCH", "EVENING", "EXACT"]);
  if (raw.exactTime !== undefined) {
    if (typeof raw.exactTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(raw.exactTime) || result.moment !== "EXACT") fail();
    result.exactTime = raw.exactTime as string;
  }
  if (result.moment === "EXACT" && !result.exactTime) fail();
  if (raw.returnMoment !== undefined) result.returnMoment = choice(raw.returnMoment, ["NONE", "MORNING", "LUNCH", "EVENING", "EXACT"]);
  if (raw.returnExactTime !== undefined) {
    if (typeof raw.returnExactTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(raw.returnExactTime) || result.returnMoment !== "EXACT") fail();
    result.returnExactTime = raw.returnExactTime as string;
  }
  if (result.returnMoment === "EXACT" && !result.returnExactTime) fail();
  if (raw.channel !== undefined) result.channel = choice(raw.channel, ["STORE", "DELIVERY", "PICKUP", "SECOND_HAND", "UNDECIDED"]);
  if (raw.entity !== undefined) {
    const entity = object(raw.entity); only(entity, ["kind", "label", "googlePlaceId", "city", "address"]);
    result.entity = { kind: choice(entity.kind, ["VENUE", "PRODUCT", "EVENT", "DESTINATION", "SELLER"]), label: text(entity.label, 120),
      ...(entity.city !== undefined ? { city: text(entity.city, 100) } : {}), ...(entity.address !== undefined ? { address: text(entity.address, 240) } : {}),
      ...(entity.googlePlaceId !== undefined ? { googlePlaceId: validGooglePlaceId(entity.googlePlaceId) ? entity.googlePlaceId : fail() } : {}) };
    if (result.entity.googlePlaceId && ["PRODUCT", "SELLER"].includes(result.entity.kind)) fail();
  }
  if (raw.sellerGooglePlaceId !== undefined) result.sellerGooglePlaceId = validGooglePlaceId(raw.sellerGooglePlaceId) ? raw.sellerGooglePlaceId : fail();
  if (raw.unpricedComponents !== undefined) {
    if (!Array.isArray(raw.unpricedComponents) || raw.unpricedComponents.length > 20) fail();
    const components = (raw.unpricedComponents as unknown[]).map(v => text(v, 100));
    if (new Set(components).size !== components.length) fail();
    result.unpricedComponents = components;
  }
  if (raw.tripKind !== undefined) result.tripKind = choice(raw.tripKind, ["STAY", "PUNCTUAL"]);
  if (raw.lodging !== undefined) result.lodging = choice(raw.lodging, ["RELATIVE", "HOTEL", "HOSTEL", "RENTAL", "OTHER", "LATER"]);
  if (raw.mealFormat !== undefined) result.mealFormat = choice(raw.mealFormat, ["TWO", "GROUP", "APERO", "MEAL"]);
  if (raw.groceryFocus !== undefined) result.groceryFocus = choice(raw.groceryFocus, ["FOOD", "HYGIENE", "CLEANING", "DRINKS", "OTHER"]);
  if (raw.automotiveKind !== undefined) result.automotiveKind = choice(raw.automotiveKind, ["PRODUCT", "SERVICE"]);
  if (raw.linkedProjectId !== undefined) result.linkedProjectId = typeof raw.linkedProjectId === "string" && uuid.test(raw.linkedProjectId) ? raw.linkedProjectId : fail();
  if (raw.shareTransport !== undefined) {
    if (typeof raw.shareTransport !== "boolean" || raw.shareTransport && !result.linkedProjectId) fail();
    result.shareTransport = raw.shareTransport as boolean;
  }
  return result as PlannedProjectContext;
}

export function assertProjectIntent(draft: PlannedExpenseDraft) {
  const p = draft.context.project;
  if (!p) return;
  if (p.exactTime && !draft.plannedDate) fail();
  if ((p.returnMoment || p.returnExactTime) && !getPlannedExpenseDateRange(draft).hasReturn) fail();
  const range = getPlannedExpenseDateRange(draft);
  if (range.startDate === range.endDate && range.startTime && range.endTime && range.endTime < range.startTime) fail();
  if (draft.context.visitTiming && draft.context.endDate && draft.context.visitTiming.return.date !== draft.context.endDate) fail();
  if (p.sellerGooglePlaceId && !draft.context.seller) fail();
  if (draft.context.route?.plannedTime && draft.context.route.plannedTime !== p.exactTime) fail();
  if (p.tripKind && !(draft.familyKey === "visit_trip" && ["trip_stay", "other_trip"].includes(draft.subtypeKey ?? ""))) fail();
  if (p.lodging && !projectLodgingAvailable(draft)) fail();
  if ((p.mealFormat || p.groceryFocus) && draft.subtypeKey !== "groceries" || p.automotiveKind && draft.subtypeKey !== "automotive") fail();
  if (p.shareTransport && (draft.context.route || draft.context.transportMode || draft.costItems.some(c => c.assetKey?.startsWith("transport:")))) fail();
  if (p.entity && ["PRODUCT", "SELLER"].includes(p.entity.kind) && draft.context.place?.kind === "TEXT" && draft.context.place.label === p.entity.label) fail();
}

export function projectLinkCompatible(child: PlannedExpenseDraft, parent: PlannedExpenseDraft): boolean {
  return !parent.context.project?.linkedProjectId && ["groceries", "purchase", "restaurant"].includes(intentForDraft(child))
    && ["outing", "visit_trip", "activity"].includes(parent.familyKey)
    && (!child.plannedDate || !parent.plannedDate || child.plannedDate === parent.plannedDate);
}
export function projectGoogleDestination(draft: PlannedExpenseDraft): { placeId: string; kind: ProjectPlaceKind } | undefined {
  const p = draft.context.project;
  if (p?.sellerGooglePlaceId && draft.context.seller) return { placeId: p.sellerGooglePlaceId, kind: "RETAIL" };
  const placeId = p?.entity?.googlePlaceId;
  if (!placeId) return undefined;
  return { placeId, kind: draft.familyKey === "activity" ? "ACTIVITY" : draft.familyKey === "visit_trip" ? "DESTINATION" : draft.familyKey === "outing" ? "VENUE" : "RESTAURANT" };
}
