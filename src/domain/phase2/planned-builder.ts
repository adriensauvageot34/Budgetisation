import Big from "big.js";
import { ASSET_AGGREGATE_DESCENDANTS, plannedAsset, rootAssetModule, suggestedAssetQuantity, type AssetModule } from "./planned-assets";
import type { CostItem, PlannedBaselineKey, PlannedExpenseContext, PlannedExpenseDraft, ProspectivePlaceRef } from "./planned-contract";
import { deduplicateRouteStops, routePlaceIdentity, stopForPlace } from "./planned-routes";
import { moduleAvailability, resolvePlannedContext, plannedContextModifiers, plannedAllowsNoCost, SOCIAL_CONTACTS_V1, type ResolvedPlannedContext } from "./planned-rules";
import { plannedLineGross } from "./planned-money";
import { assetParticipantCount, costAllowsBaseline, isRootCost, isTransportCost, prospectivePersonLabel, transportAssetMatchesMode } from "./planned-product";
import { fundingAfterGrossChange } from "./planned-mutations";
import { rankPlacesForPlannedContext, type PlannedPlaceOption } from "./planned-places";
import { deriveProjectTitle } from "./planned-ux";
import { derivePlannedPlaceRoles } from "./planned-place-rules";
import { carEstimateProblems, isDerivedCarCost } from "./planned-car";

export type DraftOrigin = "AUTO_DERIVED" | "EXPLICIT";
export type Invalidation = "KEEP" | "RECOMPUTE" | "SUSPEND" | "REMOVE_DERIVED";
export const classifyBuilderInvalidation = (origin: DraftOrigin, compatible: boolean, canRecompute = false): Invalidation =>
  compatible ? "KEEP" : origin === "EXPLICIT" ? "SUSPEND" : canRecompute ? "RECOMPUTE" : "REMOVE_DERIVED";
export type CostMode = "QUICK_TOTAL" | "TARGETED_SPLIT" | "ITEMIZED";
export type BuilderIssue = Readonly<{ code: string; scope: string; severity: "BLOCK_PREVIEW" | "BLOCK_SAVE" | "ADVISORY";
  message: string; repairTarget: string }>;
export type SuspendedValue = Readonly<{ path: string; value: unknown; origin: DraftOrigin; reason: string }>;
export type BuilderSnapshot = Readonly<{ draft: PlannedExpenseDraft; costMode: CostMode; quickTotal: string;
  quickBaseline: PlannedBaselineKey | null | undefined; acceptedChildren: readonly AssetModule[];
  suspended: readonly SuspendedValue[]; origins: Readonly<Record<string, DraftOrigin>> }>;
export type BuilderState = BuilderSnapshot & Readonly<{ undo: BuilderSnapshot | null; revision: number }>;

const moneyPattern = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u;
const clone = <T>(value: T): T => structuredClone(value);
const snapshot = (state: BuilderState): BuilderSnapshot => ({ draft: clone(state.draft), costMode: state.costMode,
  quickTotal: state.quickTotal, quickBaseline: state.quickBaseline, acceptedChildren: [...state.acceptedChildren],
  suspended: clone(state.suspended), origins: { ...state.origins } });
const touch = (state: BuilderState, change: Partial<BuilderSnapshot>, reversible = false): BuilderState =>
  ({ ...state, ...change, undo: reversible ? snapshot(state) : state.undo, revision: state.revision + 1 });
const resolvedFor = (draft: PlannedExpenseDraft): ResolvedPlannedContext | null => {
  try { return resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey,
    modifiers: plannedContextModifiers(draft.context) }); } catch { return null; }
};

export function createBuilderState(draft: PlannedExpenseDraft): BuilderState {
  const rootItems = draft.costItems.filter(isRootCost);
  const quick = rootItems.length === 1 && rootItems[0].id === "00000000-0000-4000-8000-000000000001"
    && rootItems[0].assetKey === null && rootItems[0].quantity === "1" && !rootItems[0].fundingAllocations?.length
    ? rootItems[0] : undefined;
  const targeted = rootItems.length > 0 && rootItems.every((item) => ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"].includes(item.id));
  return { draft: clone(quick ? { ...draft, costItems: draft.costItems.filter((item) => item !== quick) } : draft),
    costMode: quick || !draft.costItems.length ? "QUICK_TOTAL" : targeted ? "TARGETED_SPLIT" : "ITEMIZED", quickTotal: quick?.unitAmount ?? "",
    quickBaseline: quick?.baselineKey ?? (rootItems.length && rootItems.every((item) => item.baselineKey === rootItems[0].baselineKey) ? rootItems[0].baselineKey : undefined),
    acceptedChildren: [...new Set(draft.costItems.flatMap((item) => item.modulePath?.[1] ? [item.modulePath[1]] : []))],
    suspended: [], origins: Object.fromEntries(draft.costItems.flatMap((item) => [[`baseline.${item.id}`, "EXPLICIT"], [`cost.${item.id}`, isDerivedCarCost(item) ? "AUTO_DERIVED" : "EXPLICIT"]])),
    undo: null, revision: 0 };
}
export function editBuilderDraft(state: BuilderState, draft: PlannedExpenseDraft): BuilderState {
  let next = clone(draft);
  const placeChanged = JSON.stringify(draft.context.place) !== JSON.stringify(state.draft.context.place);
  const orphanChildren = (Object.keys(next.context.childLocalPlaceRefs ?? {}) as AssetModule[])
    .filter((child) => !next.costItems.some((item) => item.modulePath?.[1] === child));
  const routeAffected = next.context.route?.stops.some((stop) => stop.endpointSource === "ROOT_PLACE" && placeChanged
    || stop.childModule && orphanChildren.includes(stop.childModule));
  const routeTopology = (draft: PlannedExpenseDraft) => draft.context.route?.stops
    .map((stop) => [routePlaceIdentity(stop), stop.endpointSource, stop.childModule]);
  const topologyChanged = JSON.stringify(routeTopology(state.draft)) !== JSON.stringify(routeTopology(draft));
  const refs = { ...next.context.childLocalPlaceRefs };
  for (const child of orphanChildren) delete refs[child];
  if (orphanChildren.length) next = { ...next, context: { ...next.context, childLocalPlaceRefs: refs } };
  if (routeAffected && next.context.route) {
    const stops = next.context.route.stops.flatMap((stop) => {
      if (stop.childModule && orphanChildren.includes(stop.childModule)) return [];
      if (stop.endpointSource === "ROOT_PLACE" && placeChanged) return next.context.place
        ? [stopForPlace(next.context.place, stop.label, "ROOT_PLACE")] : [];
      return [stop];
    });
    next = { ...next, context: { ...next.context, route: stops.length >= 2
      ? invalidateBuilderRoute(next.context.route, stops) : undefined },
      costItems: next.costItems.filter((item) => !isDerivedCarCost(item)) };
  }
  if (state.draft.context.route?.liveEstimate && next.context.route && state.draft.plannedDate !== next.plannedDate) {
    next = { ...next, context: { ...next.context, route: { ...next.context.route, liveEstimate: undefined, fuelEstimate: undefined,
      plannedTime: next.plannedDate ? next.context.route.plannedTime : null, tollFreeConfirmed: undefined, stops: invalidateRouteDistances(next.context.route.stops) } }, costItems: next.costItems.filter((item) => !isDerivedCarCost(item)) };
  }
  return touch(state, { draft: next }, !!routeAffected || !!orphanChildren.length || topologyChanged || !!state.draft.context.route?.liveEstimate && state.draft.plannedDate !== next.plannedDate);
}
/** Adopt the server's transport revision after Preview, preserving Quick Total and local intent. */
export function adoptBuilderResolvedTransport(state: BuilderState, resolved: PlannedExpenseDraft): BuilderState {
  if (!resolved.context.route?.liveEstimate) return state;
  return touch(state, { draft: { ...state.draft, context: { ...state.draft.context, route: resolved.context.route },
    costItems: [...state.draft.costItems.filter((item) => !isTransportCost(item)), ...resolved.costItems.filter(isTransportCost)] } });
}
export function setBuilderChildPlace(state: BuilderState, child: AssetModule, ref?: ProspectivePlaceRef): BuilderState {
  const edge = resolvedFor(state.draft)?.children.find((candidate) => candidate.childModule === child);
  if (!edge || edge.localPlacePolicy === "HIDDEN" || !state.draft.costItems.some((item) => item.modulePath?.[1] === child))
    throw new TypeError("BUILDER_CHILD_PLACE_INVALID");
  const refs = { ...state.draft.context.childLocalPlaceRefs };
  if (ref) refs[child] = ref; else delete refs[child];
  const route = state.draft.context.route;
  // An edited endpoint leaves the route until the user explicitly chooses its new place again.
  const stops = route?.stops.filter((stop) => stop.childModule !== child);
  const included = route?.stops.some((stop) => stop.childModule === child);
  return touch(state, { draft: { ...state.draft, context: { ...state.draft.context, childLocalPlaceRefs: refs,
    ...(included ? { route: stops && stops.length >= 2 ? invalidateBuilderRoute(route!, stops) : undefined } : {}) },
    costItems: route?.stops.some((stop) => stop.childModule === child)
      ? state.draft.costItems.filter((item) => !isDerivedCarCost(item)) : state.draft.costItems } }, true);
}
export const invalidateRouteDistances = (stops: NonNullable<PlannedExpenseContext["route"]>["stops"]) =>
  deduplicateRouteStops(stops).map((stop, index, all) => ({ ...stop, distanceToNextKm: index === all.length - 1 ? null : "",
    distanceSource: undefined, estimatedFuelLiters: undefined, evidence: undefined }));
function invalidateBuilderRoute(route: NonNullable<PlannedExpenseContext["route"]>, stops: NonNullable<PlannedExpenseContext["route"]>["stops"]) {
  return { ...route, stops: invalidateRouteDistances(stops), liveEstimate: undefined, fuelEstimate: undefined, tollFreeConfirmed: undefined };
}
export function addBuilderChildRouteStop(state: BuilderState, child: AssetModule, label: string): BuilderState {
  const edge = resolvedFor(state.draft)?.children.find((candidate) => candidate.childModule === child);
  const ref = state.draft.context.childLocalPlaceRefs?.[child], route = state.draft.context.route;
  if (!ref || !route || route.stops.length < 2 || !edge || edge.rootTransportStopAvailability === "NEVER")
    throw new TypeError("BUILDER_CHILD_ROUTE_STOP_INVALID");
  if (route.stops.some((stop) => stop.childModule === child)) return state;
  const point = stopForPlace(ref, label, "CHILD_LOCAL_PLACE", child);
  const closed = routePlaceIdentity(route.stops[0]!) === routePlaceIdentity(route.stops.at(-1)!);
  const stops = closed ? [...route.stops.slice(0, -1), point, route.stops.at(-1)!] : [...route.stops, point];
  return touch(state, { draft: { ...state.draft, context: { ...state.draft.context,
    route: invalidateBuilderRoute(route, stops) },
    costItems: state.draft.costItems.filter((item) => !isDerivedCarCost(item)) } }, true);
}
export function removeBuilderChild(state: BuilderState, child: AssetModule): BuilderState {
  const refs = { ...state.draft.context.childLocalPlaceRefs };
  delete refs[child];
  const route = state.draft.context.route;
  const included = route?.stops.some((stop) => stop.childModule === child);
  const stops = route?.stops.filter((stop) => stop.childModule !== child);
  return touch(state, { acceptedChildren: state.acceptedChildren.filter((module) => module !== child),
    draft: { ...state.draft, context: { ...state.draft.context, childLocalPlaceRefs: refs,
      ...(included ? { route: stops && stops.length >= 2 ? invalidateBuilderRoute(route!, stops) : undefined } : {}) },
      costItems: state.draft.costItems.filter((item) => item.modulePath?.[1] !== child && (!included || !isDerivedCarCost(item))) } }, true);
}
export function changeBuilderRoot(state: BuilderState, draft: PlannedExpenseDraft): BuilderState {
  const hasContent = state.draft.costItems.length > 0 || state.quickTotal !== ""
    || Object.values(state.draft.context).some((value) => value !== undefined);
  const next = createBuilderState(draft);
  return { ...next, revision: state.revision + 1, undo: hasContent ? snapshot(state) : null,
    suspended: hasContent ? [{ path: "previousProject", value: snapshot(state), origin: "EXPLICIT",
      reason: "Le projet précédent est conservé. Confirmez ce changement de projet ou annulez." }] : [] };
}
export const setQuickTotal = (state: BuilderState, value: string): BuilderState =>
  touch(state, { quickTotal: value, costMode: "QUICK_TOTAL" });
export const setQuickBaseline = (state: BuilderState, value: PlannedBaselineKey | null): BuilderState =>
  touch(state, { quickBaseline: value });
export const acceptBuilderChild = (state: BuilderState, child: AssetModule): BuilderState => {
  const resolved = resolvedFor(state.draft);
  if (!resolved || moduleAvailability(resolved, child) === "FORBIDDEN" || child === "transport")
    throw new TypeError("BUILDER_CHILD_FORBIDDEN");
  return touch(state, { acceptedChildren: [...new Set([...state.acceptedChildren, child])],
    draft: child === "gift" && !state.draft.context.gift && prospectivePersonLabel(state.draft.context.personVisited)
      ? { ...state.draft, context: { ...state.draft.context, gift: {
        recipient: prospectivePersonLabel(state.draft.context.personVisited)!,
        occasion: state.draft.context.socialOccasion === "BIRTHDAY" ? "Anniversaire" : "Sans occasion particulière" } } } : state.draft,
    origins: { ...state.origins, [`child.${child}`]: "EXPLICIT",
      ...(child === "gift" && !state.draft.context.gift && prospectivePersonLabel(state.draft.context.personVisited) ? { gift: "AUTO_DERIVED" as const } : {}) } });
};
export const undoBuilderChange = (state: BuilderState): BuilderState => state.undo
  ? { ...clone(state.undo), undo: null, revision: state.revision + 1 } : state;

/** A quick total is a real user-entered aggregate, with no invented catalog asset key. */
export function materializeBuilderDraft(state: BuilderState, forPreview = false): PlannedExpenseDraft {
  const draft = state.draft;
  const previewTitle = draft.title.trim() || "Projet à nommer";
  const resolved = resolvedFor(draft);
  const activeItems = forPreview && resolved ? draft.costItems.filter((item) => {
    const child = item.modulePath?.[1];
    return (!child || moduleAvailability(resolved, child) !== "FORBIDDEN")
      && !(plannedAsset(item.assetKey ?? "")?.module === "transport" && resolved.transport === "FORBIDDEN");
  }) : draft.costItems;
  const context = forPreview ? { ...draft.context,
    ...(draft.context.place?.kind === "TEXT" && !draft.context.place.label.trim() ? { place: undefined } : {}),
    ...(draft.context.personVisited?.kind === "TEXT" && !draft.context.personVisited.label.trim() ? { personVisited: undefined } : {}),
    ...(draft.context.host?.kind === "TEXT" && !draft.context.host.label.trim() ? { host: undefined, hostParticipates: undefined } : {}),
    ...(draft.context.participantRefs ? { participantRefs: draft.context.participantRefs.filter((ref) => ref.kind !== "TEXT" || ref.label.trim()) } : {}),
    ...(draft.context.gift && !draft.context.gift.recipient.trim() ? { gift: undefined } : {}),
    ...(!draft.context.deliveryProvider?.trim() ? { deliveryProvider: undefined } : {}),
    ...(!draft.context.seller?.trim() ? { seller: undefined } : {}),
    ...(resolved?.transport === "FORBIDDEN" ? { route: undefined } : {}),
    ...(resolved?.transport === "FORBIDDEN" ? { transportMode: undefined } : {}),
    ...(resolved?.fields.place === "HIDDEN" ? { place: undefined } : {}),
    ...(draft.context.childLocalPlaceRefs ? { childLocalPlaceRefs: Object.fromEntries(
      Object.entries(draft.context.childLocalPlaceRefs).filter(([module, ref]) => activeItems.some((item) => item.modulePath?.[1] === module)
        && !(ref?.kind === "TEXT" && !ref.label.trim()))) } : {}) } : draft.context;
  if (state.costMode !== "QUICK_TOTAL") return forPreview ? { ...draft, title: previewTitle, context,
    costItems: activeItems.map((item) => ({ ...item,
      fundingAllocations: validFunding(item) ? item.fundingAllocations : undefined })) } : draft;
  if (!moneyPattern.test(state.quickTotal) || new Big(state.quickTotal).lte(0)) return { ...draft,
    title: forPreview ? previewTitle : draft.title, context, costItems: activeItems };
  const root = rootAssetModule(draft.familyKey, draft.subtypeKey);
  const line: CostItem = { id: "00000000-0000-4000-8000-000000000001", assetKey: null,
    label: draft.title.trim() || "Montant prévu", quantity: "1", unitAmount: new Big(state.quickTotal).toFixed(2),
    baselineKey: state.quickBaseline ?? null, modulePath: [root], priceSource: "MANUAL" };
  return { ...draft, title: forPreview ? previewTitle : draft.title, context, costItems: [line, ...activeItems] };
}
const validFunding = (item: CostItem): boolean => {
  if (!item.fundingAllocations) return true;
  try { return item.fundingAllocations.length > 0 && item.fundingAllocations.every((part) => moneyPattern.test(part.amount)
    && new Big(part.amount).gt(0)) && item.fundingAllocations.reduce((sum, part) => sum.plus(part.amount), new Big(0))
      .eq(plannedLineGross(item)); } catch { return false; }
};

export function splitRestaurantQuickTotal(state: BuilderState, mealAmount: string): BuilderState {
  if (state.draft.familyKey !== "food" || state.draft.subtypeKey !== "restaurant"
    || state.costMode !== "QUICK_TOTAL" || !moneyPattern.test(state.quickTotal)
    || !moneyPattern.test(mealAmount)) throw new TypeError("BUILDER_SPLIT_INVALID");
  const gross = new Big(state.quickTotal), meal = new Big(mealAmount);
  if (meal.lte(0) || meal.gt(gross)) throw new TypeError("BUILDER_SPLIT_INVALID");
  const root = rootAssetModule(state.draft.familyKey, state.draft.subtypeKey);
  const line = (id: string, assetKey: string, label: string, amount: Big): CostItem => ({ id,
    assetKey, label, quantity: "1", unitAmount: amount.toFixed(2), baselineKey: state.quickBaseline ?? null,
    modulePath: [root], priceSource: "MANUAL" });
  const costItems = [line("00000000-0000-4000-8000-000000000002", "restaurant:meal_total", "Repas et boissons sans alcool", meal)];
  if (meal.lt(gross)) costItems.push(line("00000000-0000-4000-8000-000000000003", "restaurant:alcohol_total", "Alcool", gross.minus(meal)));
  return touch(state, { draft: { ...state.draft, costItems: [...costItems, ...state.draft.costItems] }, costMode: "TARGETED_SPLIT",
    origins: { ...state.origins, "costItems": "EXPLICIT",
      ...(state.quickBaseline !== undefined ? Object.fromEntries(costItems.map((item) => [`baseline.${item.id}`, "EXPLICIT" as const])) : {}) } }, true);
}
export const itemizeBuilderCosts = (state: BuilderState): BuilderState =>
  touch(state, { costMode: "ITEMIZED", draft: state.costMode === "QUICK_TOTAL" || state.costMode === "TARGETED_SPLIT"
    ? { ...state.draft, costItems: state.draft.costItems.filter((item) => !isRootCost(item)) } : state.draft,
  origins: state.costMode === "QUICK_TOTAL" && state.quickBaseline !== undefined
    ? { ...state.origins, "baseline.00000000-0000-4000-8000-000000000001": "EXPLICIT" } : state.origins }, true);
const rootMealAggregate = (root: AssetModule): string | undefined => ({ restaurant: "restaurant:meal_total", fast_food: "fast_food:meal_total", work_meal: "work_meal:meal", groceries: "groceries:food" } as Partial<Record<AssetModule, string>>)[root];
export function canCollapseBuilderCosts(state: BuilderState): boolean {
  const items = state.draft.costItems.filter(isRootCost);
  return items.length > 0 && canCollapseCosts(items) && !items.some((item) => item.fundingAllocations?.length)
    && (items.every((item) => item.assetKey === null) || !!rootMealAggregate(rootAssetModule(state.draft.familyKey, state.draft.subtypeKey))
      && items.every((item) => plannedAsset(item.assetKey ?? "")?.fundingEligibility === "MEAL"));
}
export function collapseBuilderCosts(state: BuilderState): BuilderState {
  const rootItems = state.draft.costItems.filter(isRootCost);
  if (!canCollapseBuilderCosts(state))
    throw new TypeError("BUILDER_COLLAPSE_INCOMPATIBLE");
  const total = rootItems.reduce((sum, item) => sum.plus(new Big(item.quantity).times(item.unitAmount)), new Big(0));
  const aggregateKey = rootItems.every((item) => item.assetKey === null) ? undefined : rootMealAggregate(rootAssetModule(state.draft.familyKey, state.draft.subtypeKey));
  if (aggregateKey) return touch(state, { costMode: "TARGETED_SPLIT", quickTotal: "", quickBaseline: rootItems[0].baselineKey,
    draft: { ...state.draft, costItems: [{ id: "00000000-0000-4000-8000-000000000002", assetKey: aggregateKey,
      label: plannedAsset(aggregateKey)!.label, quantity: "1", unitAmount: total.toFixed(2), baselineKey: rootItems[0].baselineKey,
      modulePath: [rootAssetModule(state.draft.familyKey, state.draft.subtypeKey)], priceSource: "MANUAL" }, ...state.draft.costItems.filter((item) => !isRootCost(item))] } }, true);
  return touch(state, { costMode: "QUICK_TOTAL", quickTotal: total.gt(0) ? total.toFixed(2) : "",
    quickBaseline: rootItems[0]?.baselineKey ?? null,
    draft: { ...state.draft, costItems: state.draft.costItems.filter((item) => !isRootCost(item)) } }, true);
}

/** Explicit replacement preserves the aggregate in Undo, without keeping it in the calculation. */
export function replaceBuilderAggregate(state: BuilderState, item: CostItem): BuilderState {
  const removed = state.draft.costItems.filter((old) => JSON.stringify(old.modulePath) === JSON.stringify(item.modulePath)
    && (old.id === "00000000-0000-4000-8000-000000000001"
      || ASSET_AGGREGATE_DESCENDANTS[old.assetKey ?? ""]?.includes(item.assetKey ?? "")));
  return touch(state, { costMode: state.costMode === "QUICK_TOTAL" && isRootCost(item) ? "ITEMIZED" : state.costMode,
    draft: { ...state.draft, costItems: [...state.draft.costItems.filter((old) => !removed.includes(old)), item] } }, true);
}

export function changeBuilderContext(state: BuilderState, context: PlannedExpenseContext): BuilderState {
  const before = state.draft.context;
  const nextDraft: PlannedExpenseDraft = { ...state.draft, context: { ...context } };
  const resolved = resolvedFor(nextDraft);
  if (!resolved) throw new TypeError("BUILDER_CONTEXT_INVALID");
  const suspended = [...state.suspended];
  const origins = { ...state.origins };
  const nextContext: { -readonly [K in keyof PlannedExpenseContext]: PlannedExpenseContext[K] } = { ...context };
  const contactChanged = JSON.stringify(before.personVisited) !== JSON.stringify(context.personVisited)
    || JSON.stringify(before.host) !== JSON.stringify(context.host);
  if (contactChanged && origins.gift === "AUTO_DERIVED" && nextContext.gift && prospectivePersonLabel(context.personVisited))
    nextContext.gift = { ...nextContext.gift, recipient: prospectivePersonLabel(context.personVisited)! };
  const workPersonChanged = state.draft.subtypeKey === "work_meal"
    && JSON.stringify(before.participantPersonIds) !== JSON.stringify(context.participantPersonIds);
  const suspend = (path: keyof PlannedExpenseContext, value: unknown, reason: string) => {
    if (value === undefined || suspended.some((part) => part.path === path && JSON.stringify(part.value) === JSON.stringify(value))) return;
    if (classifyBuilderInvalidation(origins[path] ?? "EXPLICIT", false) === "REMOVE_DERIVED") return;
    suspended.push({ path, value: clone(value), origin: "EXPLICIT", reason });
  };
  for (const [key, field] of [["seller", "seller"], ["deliveryProvider", "deliveryProvider"],
    ["deliveryProviderKey", "deliveryProvider"], ["personVisited", "visitedContact"],
    ["host", "host"], ["visitFormat", "visitFormat"], ["socialOccasion", "socialOccasion"]] as const) {
    if (resolved.fields[field] === "HIDDEN") {
      suspend(key, before[key], "Cette précision ne correspond plus au nouveau contexte.");
      delete nextContext[key];
    }
  }
  if (resolved.fields.place === "HIDDEN" || before.housePartyPlaceMode !== context.housePartyPlaceMode
    || contactChanged || workPersonChanged) {
    suspend("place", before.place, "Le lieu ne correspond plus au nouveau contexte.");
    nextContext.place = undefined;
    if ((!before.place || origins.place === "AUTO_DERIVED") && resolved.place.source === "CONTACT_HOME"
      && (context.host ?? context.personVisited)?.kind === "CONTACT") {
      const contactKey = (context.host ?? context.personVisited) as { kind: "CONTACT"; contactKey: string };
      const home = SOCIAL_CONTACTS_V1.find((contact) => contact.key === contactKey.contactKey)?.places.find((link) => link.relation === "HOME");
      if (home?.placeId) nextContext.place = { kind: "KNOWN", placeId: home.placeId };
      else if (home?.textPlace) nextContext.place = { kind: "TEXT", label: home.textPlace, provenance: "USER_DECLARED_PROSPECTIVE" };
      if (nextContext.place) origins.place = "AUTO_DERIVED";
    }
  }
  if (resolved.transport === "FORBIDDEN" || contactChanged || before.housePartyPlaceMode !== context.housePartyPlaceMode) {
    suspend("route", before.route, "Le trajet utilisateur n’est plus applicable.");
    nextContext.route = undefined;
  }
  if (resolved.transport === "FORBIDDEN") {
    suspend("transportMode", before.transportMode, "Le déplacement n’est plus applicable.");
    nextContext.transportMode = undefined;
  }
  if (resolved.fields.host === "HIDDEN") nextContext.hostParticipates = undefined;
  if (resolved.fields.visitedContact === "HIDDEN") nextContext.visitedPersonParticipates = undefined;
  if (before.transportMode !== context.transportMode && context.transportMode !== "CAR" && before.route) {
    suspend("route", before.route, "Le trajet voiture est conservé pour annuler ce changement.");
    nextContext.route = undefined;
  }
  const costItems = state.draft.costItems.filter((item) => {
    if (context.noExpense && !before.noExpense && isRootCost(item)) {
      suspended.push({ path: `cost.${item.id}`, value: clone(item), origin: "EXPLICIT", reason: "Ce projet est désormais sans dépense principale." });
      return false;
    }
    if (context.workMealMode === "FROM_HOME" && (item.modulePath?.at(-1) ?? resolved.rootModule) === "work_meal") {
      suspended.push({ path: `cost.${item.id}`, value: clone(item), origin: "EXPLICIT", reason: "Le repas est désormais apporté de chez nous." });
      return false;
    }
    if (isDerivedCarCost(item) && !nextContext.route) {
      if (origins[`cost.${item.id}`] !== "AUTO_DERIVED") suspended.push({ path: `cost.${item.id}`,
        value: clone(item), origin: "EXPLICIT", reason: "Le trajet a changé." });
      return false;
    }
    if (isTransportCost(item) && (resolved.transport === "FORBIDDEN"
      || before.transportMode !== context.transportMode && !transportAssetMatchesMode(item.assetKey!, context.transportMode))) {
      suspended.push({ path: `cost.${item.id}`, value: clone(item), origin: "EXPLICIT", reason: "Ce coût de déplacement ne correspond plus au choix actuel." });
      return false;
    }
    const child = item.modulePath?.[1];
    if (child && moduleAvailability(resolved, child) === "FORBIDDEN") {
      suspended.push({ path: `cost.${item.id}`, value: clone(item), origin: "EXPLICIT",
        reason: "Cette dépense n’est plus disponible ici." });
      return false;
    }
    return true;
  });
  const countedItems = costItems.map((item) => {
    const asset = plannedAsset(item.assetKey ?? "");
    if (!asset || origins[`quantity.${item.id}`] !== "AUTO_DERIVED") return item;
    const quantity = suggestedAssetQuantity(asset, assetParticipantCount(asset, nextContext));
    const next = { ...item, quantity };
    return quantity !== item.quantity && moneyPattern.test(item.unitAmount) && item.fundingAllocations?.length === 1
      ? { ...next, fundingAllocations: fundingAfterGrossChange(item, plannedLineGross(next)) } : next;
  });
  const childRefs = { ...nextContext.childLocalPlaceRefs };
  for (const child of Object.keys(childRefs) as AssetModule[]) if (!costItems.some((item) => item.modulePath?.[1] === child)) {
    suspend("childLocalPlaceRefs", before.childLocalPlaceRefs, "Un lieu de complément est devenu incompatible.");
    delete childRefs[child];
  }
  if (nextContext.childLocalPlaceRefs) nextContext.childLocalPlaceRefs = childRefs;
  const removeQuick = (context.workMealMode === "FROM_HOME" || context.noExpense && !before.noExpense) && !!state.quickTotal;
  if (removeQuick) suspended.push({ path: "quickTotal", value: state.quickTotal, origin: "EXPLICIT", reason: "Le budget du repas acheté est conservé pour annuler." });
  return touch(state, { draft: { ...nextDraft, context: nextContext, costItems: countedItems }, suspended, origins,
    ...(removeQuick ? { quickTotal: "", quickBaseline: null } : {}) }, true);
}
export const discardSuspended = (state: BuilderState): BuilderState => touch(state, { suspended: [] }, true);

export function deriveBuilderReadiness(state: BuilderState, live?: Readonly<{ places: readonly PlannedPlaceOption[]; workMealPersonName?: string }>): Readonly<{ previewReady: boolean; saveReady: boolean;
  issues: readonly BuilderIssue[] }> {
  const issues: BuilderIssue[] = [];
  const issue = (severity: BuilderIssue["severity"], code: string, scope: string, message: string,
    repairTarget: string) => issues.push({ severity, code, scope, message, repairTarget });
  const draft = materializeBuilderDraft(state);
  const activeDraft = materializeBuilderDraft(state, true);
  const resolved = resolvedFor(draft);
  if (resolved && live && draft.context.place?.kind === "KNOWN") {
    const ref = draft.context.host ?? draft.context.personVisited;
    const compatible = rankPlacesForPlannedContext(live.places, resolved, {
      contactKey: ref?.kind === "CONTACT" ? ref.contactKey : undefined, workMealPersonName: live.workMealPersonName,
      assetKeys: draft.costItems.flatMap((item) => item.assetKey ? [item.assetKey] : []),
      giftAssetKey: draft.costItems.find((item) => item.assetKey?.startsWith("gift:"))?.assetKey ?? undefined });
    if (!compatible.some((item) => item.place.placeId === (draft.context.place as { placeId: string }).placeId))
      issue("BLOCK_SAVE", "PLACE_CONTEXT_MISMATCH", "context.place", "Le lieu choisi ne correspond plus à ces éléments. Choisissez un autre lieu ou saisissez la boutique.", "builder-context");
  }
  if (!resolved) issue("BLOCK_PREVIEW", "CONTEXT_INVALID", "context", "Choisissez un type de projet.", "builder-intent");
  if (!draft.title.trim()) issue("BLOCK_SAVE", "TITLE_REQUIRED", "title", "Donnez un nom à ce projet.", "builder-title");
  if (!activeDraft.costItems.length && !plannedAllowsNoCost(activeDraft)) issue("BLOCK_PREVIEW", "COST_REQUIRED", "costItems", "Indiquez le budget prévu.", "builder-cost");
  if (state.costMode === "QUICK_TOTAL" && state.quickTotal && (!moneyPattern.test(state.quickTotal) || new Big(state.quickTotal).lte(0)))
    issue("BLOCK_PREVIEW", "QUICK_TOTAL_INVALID", "quickTotal", "Corrigez le montant du total rapide.", "builder-cost");
  if (state.costMode === "QUICK_TOTAL" && state.quickTotal && state.draft.costItems.some(isRootCost))
    issue("BLOCK_PREVIEW", "QUICK_ROOT_DETAILS_ACTIVE", "costItems", "Gardez le total du projet ou ses détails, pas les deux.", "builder-cost");
  if (draft.context.participantRefs?.some((ref) => ref.kind === "TEXT" && !ref.label.trim()))
    issue("BLOCK_SAVE", "PARTICIPANT_LABEL_REQUIRED", "context.participantRefs", "Précisez le nom du participant ajouté.", "builder-context");
  if (resolved?.baseline.mode === "ASK" && state.costMode === "QUICK_TOTAL" && state.quickTotal && state.quickBaseline === undefined)
    issue("BLOCK_PREVIEW", "BASELINE_ANSWER_REQUIRED", "quickBaseline",
      "Cette dépense est-elle déjà comprise dans vos habitudes ?", "builder-cost");
  if (draft.context.place?.kind === "TEXT" && !draft.context.place.label.trim())
    issue("BLOCK_SAVE", "PLACE_LABEL_REQUIRED", "context.place", "Précisez le lieu choisi.", "builder-context");
  if (draft.context.personVisited?.kind === "TEXT" && !draft.context.personVisited.label.trim())
    issue("BLOCK_SAVE", "CONTACT_LABEL_REQUIRED", "context.personVisited", "Précisez le nom de la personne.", "builder-context");
  if (draft.context.route?.mode === "CAR" && !draft.context.route.fuelEstimate)
    issue("BLOCK_PREVIEW", "ROUTE_ESTIMATE_REQUIRED", "context.route", "Estimez le carburant du trajet.", "builder-addons");
  for (const message of carEstimateProblems(draft)) issue("BLOCK_PREVIEW", "ROUTE_COST_INCOMPLETE", "context.route", message, "builder-route");
  for (const [child, ref] of Object.entries(draft.context.childLocalPlaceRefs ?? {})) {
    const edge = resolved?.children.find((edge) => edge.childModule === child);
    if (!edge || edge.localPlacePolicy === "HIDDEN" || !draft.costItems.some((item) => item.modulePath?.[1] === child))
      issue("BLOCK_SAVE", "CHILD_PLACE_ORPHAN", `context.childLocalPlaceRefs.${child}`, "Retirez ce lieu devenu sans complément.", "builder-addons");
    if (ref?.kind === "TEXT" && !ref.label.trim())
      issue("BLOCK_SAVE", "CHILD_PLACE_LABEL_REQUIRED", `context.childLocalPlaceRefs.${child}`, "Précisez le lieu du complément.", "builder-addons");
  }
  for (const edge of resolved?.children ?? []) if (edge.localPlacePolicy === "REQUIRED"
    && draft.costItems.some((item) => item.modulePath?.[1] === edge.childModule) && !draft.context.childLocalPlaceRefs?.[edge.childModule])
    issue("BLOCK_SAVE", "CHILD_PLACE_REQUIRED", `context.childLocalPlaceRefs.${edge.childModule}`, "Choisissez le lieu du complément.", "builder-addons");
  for (const item of draft.costItems) {
    try { if (!item.label.trim() || !moneyPattern.test(item.unitAmount) || new Big(item.unitAmount).lte(0)
      || !/^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?$/u.test(item.quantity)
      || !new Big(item.quantity).gt(0)) throw new Error(); }
    catch { issue("BLOCK_PREVIEW", "COST_INVALID", `costItems.${item.id}`, `${item.label || "Élément sans nom"} — montant ou quantité à renseigner.`, "builder-cost"); }
    if (!validFunding(item)) issue("BLOCK_SAVE", "FUNDING_INCOMPLETE", `costItems.${item.id}.fundingAllocations`,
      "Répartissez entièrement le financement.", `funding-${item.id}`);
    if (resolved?.baseline.mode === "ASK" && state.costMode !== "QUICK_TOTAL"
      && costAllowsBaseline(item)
      && item.modulePath?.length !== 2 && !state.origins[`baseline.${item.id}`])
      issue("BLOCK_PREVIEW", "BASELINE_ANSWER_REQUIRED", `costItems.${item.id}.baselineKey`,
        "Précisez si cette ligne est habituelle ou en plus.", "builder-cost");
    const child = item.modulePath?.[1];
    if (child && resolved && moduleAvailability(resolved, child) === "FORBIDDEN") issue("BLOCK_SAVE", "CHILD_FORBIDDEN",
      `costItems.${item.id}.modulePath`, "Ce complément n’est plus disponible.", "builder-addons");
  }
  if (resolved) {
    const c = draft.context;
    if (resolved.fields.host === "REQUIRED" && (!c.host || c.host.kind === "TEXT" && !c.host.label.trim()))
      issue("BLOCK_SAVE", "HOST_REQUIRED", "context.host", "Précisez chez qui a lieu la soirée.", "builder-context");
    if (resolved.fields.workMealPerson === "REQUIRED" && c.participantPersonIds?.length !== 1)
      issue("BLOCK_PREVIEW", "PERSON_REQUIRED", "context.participantPersonIds", "Choisissez la personne concernée.", "builder-context");
    if (resolved.fields.visitedContact === "REQUIRED" && !c.personVisited)
      issue("BLOCK_SAVE", "CONTACT_REQUIRED", "context.personVisited", "Choisissez la personne à voir.", "builder-context");
    if (resolved.fields.purchaseMode === "REQUIRED" && !c.purchaseMode)
      issue("BLOCK_SAVE", "PURCHASE_MODE_REQUIRED", "context.purchaseMode", "Choisissez comment acheter.", "builder-context");
    if (resolved.fields.deliveryProvider === "REQUIRED" && (!c.deliveryProvider || !c.deliveryProviderKey))
      issue("BLOCK_SAVE", "PROVIDER_REQUIRED", "context.deliveryProvider", "Choisissez qui livre.", "builder-context");
    if ((draft.familyKey === "purchase" && draft.subtypeKey === "gift"
      || draft.costItems.some((item) => item.modulePath?.[1] === "gift")) && !c.gift?.recipient.trim())
      issue("BLOCK_SAVE", "GIFT_RECIPIENT_REQUIRED", "context.gift", "Précisez pour qui est le cadeau.",
        draft.subtypeKey === "gift" ? "builder-context" : "builder-addons");
    if (resolved.fields.place === "REQUIRED" && !c.place)
      issue("BLOCK_SAVE", "PLACE_REQUIRED", "context.place", "Choisissez le lieu.", "builder-context");
    if (resolved.transport === "FORBIDDEN" && c.route)
      issue("BLOCK_SAVE", "ROUTE_FORBIDDEN", "context.route", "Retirez le trajet devenu incompatible.", "builder-addons");
  }
  for (const [aggregate, descendants] of Object.entries(ASSET_AGGREGATE_DESCENDANTS)) {
    if (draft.costItems.some((item) => item.assetKey === aggregate) && draft.costItems.some((item) => descendants.includes(item.assetKey ?? "")))
      issue("BLOCK_PREVIEW", "AGGREGATE_DESCENDANTS", "costItems", "Gardez le total ou ses détails, pas les deux.", "builder-cost");
  }
  if (state.suspended.length) issue("BLOCK_SAVE", "SUSPENDED_EXPLICIT", "suspended",
    "Des informations saisies ne correspondent plus au contexte. Restaurez-les avec Annuler ou confirmez leur retrait.", "builder-suspended");
  for (const child of state.acceptedChildren) if (resolved && moduleAvailability(resolved, child) === "FORBIDDEN")
    issue("BLOCK_SAVE", "CHILD_FORBIDDEN", `child.${child}`, "Ce complément n’est plus disponible.", "builder-addons");
  const previewReady = !issues.some((part) => part.severity === "BLOCK_PREVIEW");
  return { previewReady, saveReady: previewReady && !issues.some((part) => part.severity === "BLOCK_SAVE"), issues };
}

/** Presentation stage filter. Full readiness remains the shared Save/Preview authority. */
export function builderIssuesForStep(state: BuilderState, step: number, live?: Parameters<typeof deriveBuilderReadiness>[1]): readonly BuilderIssue[] {
  return deriveBuilderReadiness(state, live).issues.filter((issue) => step >= 4 || step === 3
    && (issue.scope === "title" || issue.repairTarget === "builder-context" || issue.scope === "suspended"));
}

export const suggestedBuilderChildren = (state: BuilderState): readonly AssetModule[] =>
  (resolvedFor(state.draft)?.children ?? []).filter((edge) => edge.availability === "SUGGESTED"
    && !state.acceptedChildren.includes(edge.childModule)).slice(0, 2).map((edge) => edge.childModule);
export const availableBuilderChildren = (state: BuilderState): readonly AssetModule[] =>
  (resolvedFor(state.draft)?.children ?? []).filter((edge) => edge.availability === "AVAILABLE"
    && !state.acceptedChildren.includes(edge.childModule)).map((edge) => edge.childModule);
export const canCollapseCosts = (items: readonly CostItem[]): boolean => items.length <= 1 || items.every((item) =>
  item.baselineKey === items[0]?.baselineKey && JSON.stringify(item.fundingAllocations ?? []) === JSON.stringify(items[0]?.fundingAllocations ?? [])
  && plannedAsset(item.assetKey ?? "")?.fundingEligibility === plannedAsset(items[0]?.assetKey ?? "")?.fundingEligibility
  && !isDerivedCarCost(item));

/** One root answer is propagated to its compatible economic components, never asked per line. */
export function setBuilderRootBaseline(state: BuilderState, key: PlannedBaselineKey | null): BuilderState {
  const items = state.draft.costItems.filter((item) => item.modulePath?.length !== 2 && costAllowsBaseline(item));
  return touch(state, { quickBaseline: key, origins: { ...state.origins,
    ...Object.fromEntries(items.map((item) => [`baseline.${item.id}`, "EXPLICIT" as const])) },
    draft: { ...state.draft, costItems: state.draft.costItems.map((item) => items.includes(item) ? { ...item, baselineKey: key } : item) } });
}
/** Local editor commits only complete economic lines. A fee decomposes an existing total by default. */
export function commitBuilderCost(state: BuilderState, item: CostItem, feeIncluded = true): BuilderState {
  if (!item.label.trim() || !moneyPattern.test(item.unitAmount) || !/^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?$/u.test(item.quantity)
    || new Big(item.quantity).lte(0) || new Big(item.unitAmount).lte(0) || !validFunding(item)) throw new TypeError("BUILDER_LOCAL_COST_INVALID");
  const previous = state.draft.costItems.find((old) => old.id === item.id);
  const fee = /:(delivery_fee|service_fee)$/u.test(item.assetKey ?? "");
  const change = new Big(plannedLineGross(item)).minus(previous ? plannedLineGross(previous) : 0);
  let next = { ...state, draft: { ...state.draft, costItems: state.draft.costItems.filter((old) => old.id !== item.id) },
    origins: { ...state.origins, [`cost.${item.id}`]: "EXPLICIT" as const, [`price.${item.id}`]: "EXPLICIT" as const,
      [`quantity.${item.id}`]: "EXPLICIT" as const, ...(state.quickBaseline !== undefined ? { [`baseline.${item.id}`]: "EXPLICIT" as const } : {}) } };
  if (fee && feeIncluded && state.costMode === "QUICK_TOTAL" && moneyPattern.test(state.quickTotal)) {
    const remainder = new Big(state.quickTotal).minus(change);
    if (remainder.lte(0)) throw new TypeError("BUILDER_FEE_EXCEEDS_TOTAL");
    next = { ...next, quickTotal: remainder.toFixed(2) };
  }
  if (fee && feeIncluded && state.costMode === "TARGETED_SPLIT") {
    const aggregate = next.draft.costItems.find((line) => ["restaurant:meal_total", "fast_food:meal_total", "work_meal:meal", "groceries:food"].includes(line.assetKey ?? "") && line.modulePath?.length !== 2);
    if (aggregate) {
      const remainder = new Big(plannedLineGross(aggregate)).minus(change);
      const wallets = (aggregate.fundingAllocations ?? []).filter((part) => part.source !== "BANK");
      const funded = wallets.reduce((sum, part) => sum.plus(part.amount), new Big(0));
      if (remainder.lte(0) || remainder.lt(funded)) throw new TypeError("BUILDER_FEE_EXCEEDS_TOTAL");
      const allocations = wallets.length ? [...wallets, ...(remainder.gt(funded) ? [{ source: "BANK" as const, amount: remainder.minus(funded).toFixed(2) }] : [])] : undefined;
      next = { ...next, draft: { ...next.draft, costItems: next.draft.costItems.map((line) => line.id === aggregate.id ? { ...line, quantity: "1", unitAmount: remainder.toFixed(2), fundingAllocations: allocations } : line) } };
    }
  }
  const result = replaceBuilderAggregate(next, item);
  return { ...result, undo: snapshot(state) };
}
export function removeBuilderCost(state: BuilderState, id: string): BuilderState {
  const item = state.draft.costItems.find((item) => item.id === id);
  const restoreFee = state.costMode === "QUICK_TOTAL" && /:(delivery_fee|service_fee)$/u.test(item?.assetKey ?? "") && moneyPattern.test(state.quickTotal);
  let costItems = state.draft.costItems.filter((item) => item.id !== id);
  if (state.costMode === "TARGETED_SPLIT" && item && /:(delivery_fee|service_fee)$/u.test(item.assetKey ?? "")) {
    const aggregate = costItems.find((line) => ["restaurant:meal_total", "fast_food:meal_total", "work_meal:meal", "groceries:food"].includes(line.assetKey ?? "") && line.modulePath?.length !== 2);
    if (aggregate) costItems = costItems.map((line) => line.id === aggregate.id ? { ...line, quantity: "1", unitAmount: new Big(plannedLineGross(line)).plus(plannedLineGross(item)).toFixed(2),
      fundingAllocations: line.fundingAllocations ? [...line.fundingAllocations.filter((part) => part.source !== "BANK"), { source: "BANK", amount: new Big(line.fundingAllocations.find((part) => part.source === "BANK")?.amount ?? 0).plus(plannedLineGross(item)).toFixed(2) }] : undefined } : line);
  }
  return touch(state, { quickTotal: restoreFee ? new Big(state.quickTotal).plus(plannedLineGross(item!)).toFixed(2) : state.quickTotal,
    draft: { ...state.draft, costItems } }, true);
}
/** Funding a total promotes a real eligible catalog aggregate, preserving gross and bank remainder. */
export function fundBuilderTotal(state: BuilderState, source: "SWILE" | "EDENRED", amount: string, mealAmount?: string): BuilderState {
  const root = rootAssetModule(state.draft.familyKey, state.draft.subtypeKey);
  const assetKey = rootMealAggregate(root);
  if (!assetKey || state.costMode !== "QUICK_TOTAL" || !moneyPattern.test(state.quickTotal) || !moneyPattern.test(amount)) throw new TypeError("BUILDER_TOTAL_FUNDING_INVALID");
  const eligible = new Big(mealAmount ?? state.quickTotal), wallet = new Big(amount), total = new Big(state.quickTotal);
  if (eligible.gt(total) || eligible.lte(0) || wallet.lte(0) || wallet.gt(eligible)) throw new TypeError("BUILDER_TOTAL_FUNDING_INVALID");
  let next = root === "restaurant" ? splitRestaurantQuickTotal(state, eligible.toFixed(2)) : touch(state, { costMode: "TARGETED_SPLIT",
    draft: { ...state.draft, costItems: [{ id: "00000000-0000-4000-8000-000000000002", assetKey, label: plannedAsset(assetKey)!.label,
      quantity: "1", unitAmount: eligible.toFixed(2), modulePath: [root], baselineKey: state.quickBaseline ?? null,
      priceSource: "MANUAL" }, ...state.draft.costItems] } }, true);
  const id = "00000000-0000-4000-8000-000000000002";
  next = { ...next, origins: { ...next.origins, ...(state.quickBaseline !== undefined ? { [`baseline.${id}`]: "EXPLICIT" as const } : {}) }, draft: { ...next.draft,
    costItems: next.draft.costItems.map((item) => item.id === id ? { ...item, fundingAllocations: [
      { source, amount: wallet.toFixed(2) }, ...(eligible.gt(wallet) ? [{ source: "BANK" as const, amount: eligible.minus(wallet).toFixed(2) }] : [])] } : item) } };
  return next;
}

/** Canonical context defaults and presentation are synchronized at an edit boundary, never persisted as a registry. */
export function synchronizeIntentBuilder(state: BuilderState, places: readonly PlannedPlaceOption[], persons: readonly { personId: string; displayName: string }[]): BuilderState {
  let next = state;
  const personName = persons.find((person) => person.personId === state.draft.context.participantPersonIds?.[0])?.displayName;
  const resolved = resolvePlannedContext({ familyKey: state.draft.familyKey, subtypeKey: state.draft.subtypeKey, modifiers: plannedContextModifiers(state.draft.context, personName) });
  if (resolved.place.source === "OWN_HOME" && !state.draft.context.place) {
    const home = places.find((place) => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
    if (home) next = { ...next, origins: { ...next.origins, place: "AUTO_DERIVED" }, draft: { ...next.draft, context: { ...next.draft.context, place: { kind: "KNOWN", placeId: home.placeId } } } };
  }
  if (resolved.baseline.mode === "AUTO" && resolved.baseline.key) next = setBuilderRootBaseline(next, resolved.baseline.key);
  return { ...next, draft: { ...next.draft, title: deriveProjectTitle(next.draft, places, personName) } };
}
