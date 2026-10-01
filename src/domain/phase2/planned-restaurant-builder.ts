import type { CostItem, PlannedExpenseContext, PlannedRestaurantContext } from "./planned-contract";
import { changeBuilderContext, editBuilderDraft, type BuilderState } from "./planned-builder";
import { isRootCost } from "./planned-product";
import { restaurantEstimatedCost } from "./planned-restaurant";
import type { PlannedPlaceOption } from "./planned-places";
import { derivePlannedPlaceRoles } from "./planned-place-rules";
import { routePlaceIdentity, stopForPlace } from "./planned-routes";

/** A deliberate bill replacement keeps the previous bill in the existing local Undo mechanism. */
export function replaceRestaurantBill(state: BuilderState, items: readonly CostItem[], basis: NonNullable<PlannedRestaurantContext["priceBasis"]>) {
  const { undo: _undo, ...before } = state;
  const next = editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, restaurant: { ...state.draft.context.restaurant, priceBasis: basis } },
    costItems: [...state.draft.costItems.filter((item) => !isRootCost(item)), ...items] });
  return { ...next, costMode: "ITEMIZED" as const, quickTotal: "", undo: structuredClone(before),
    origins: { ...next.origins, ...Object.fromEntries(items.map((item) => [`cost.${item.id}`, basis === "ESTIMATED" ? "AUTO_DERIVED" : "EXPLICIT"])) } } as BuilderState;
}
export function useRestaurantEstimate(state: BuilderState, makeId: () => string) {
  return replaceRestaurantBill(state, [restaurantEstimatedCost(state.draft.context, state.draft.costItems.find(isRootCost)?.id ?? makeId(), state.quickBaseline ?? null)], "ESTIMATED");
}
export function changeRestaurantContext(state: BuilderState, patch: Partial<PlannedExpenseContext>, restaurant?: Partial<PlannedRestaurantContext>) {
  let next = changeBuilderContext(state, { ...state.draft.context, ...patch,
    restaurant: { ...state.draft.context.restaurant, ...restaurant } });
  // Reuse the root-route invalidator for a changed restaurant endpoint or departure time.
  next = { ...next, draft: editBuilderDraft(state, next.draft).draft };
  // The estimate is derived from the declared party composition. Recompute it in its single domain owner.
  if (next.draft.context.restaurant?.priceBasis === "ESTIMATED" && next.draft.context.participantPersonIds?.length) {
    const item = next.draft.costItems.find(isRootCost);
    if (item) next = { ...next, draft: { ...next.draft, costItems: next.draft.costItems.map((cost) => cost.id === item.id ? restaurantEstimatedCost(next.draft.context, item.id, item.baselineKey) : cost) } };
  }
  return next;
}
export function startRestaurantCar(state: BuilderState, places: readonly PlannedPlaceOption[]) {
  const home = places.find((place) => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
  if (!home || !state.draft.context.place) throw new TypeError("PLANNED_ROUTE_PLACE_INVALID");
  const ref = state.draft.context.place;
  const known = ref.kind === "KNOWN" ? places.find((place) => place.placeId === ref.placeId) : undefined;
  const departure = { label: home.name, placeId: home.placeId, endpointSource: "DIRECT_PLACE" as const };
  const next = changeRestaurantContext(state, { transportMode: "CAR" }, { freeTransportMode: undefined });
  const primary = stopForPlace(ref, known?.name ?? (ref.kind === "TEXT" ? ref.label : "Restaurant"), "ROOT_PLACE");
  const existing = next.draft.context.route?.mode === "CAR" ? next.draft.context.route : undefined;
  if (existing?.stops.some((stop) => stop.endpointSource === "ROOT_PLACE" && routePlaceIdentity(stop) === routePlaceIdentity(primary))) return next;
  // A city-first change can temporarily remove the root stop. Insert the new destination without dropping explicit detours.
  const stops = existing?.stops.length && !(existing.stops.length === 1 && existing.stops[0]?.placeId === home.placeId)
    ? [...existing.stops] : [departure, departure];
  stops.splice(stops.at(-1)?.placeId === home.placeId ? stops.length - 1 : stops.length, 0, primary);
  return editBuilderDraft(next, { ...next.draft, context: { ...next.draft.context,
    route: { ...existing, mode: "CAR", plannedTime: next.draft.context.restaurant?.plannedTime ?? null, timeKind: "DEPARTURE", stops } } });
}
