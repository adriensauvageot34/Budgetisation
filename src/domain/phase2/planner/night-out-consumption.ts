import type { ComponentSelectionV1 } from "./component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "./semantic-state";
import { presetForContext } from "./composer-presets";
import { parsePlannerJsonObject, plannerKeys, plannerRecord, plannerString, plannerDigest, type PlannerJsonObject } from "./json";
import { parseComponentEconomicScope } from "./component-economic-scope";
import { decisionAmount } from "../month-decision-contract";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
/** Only the inactive Au bar choices are stored here. Active facts remain in extras.
 * Before, main contributions, meals and journeys are never part of this switch. */
export type NightOutConsumptionV1 = Readonly<{
  version: "night-out-consumption@v1";
  mode: "DIRECT" | "DETAILED";
  directSelectionId: string | null;
  inactive: readonly Component[];
}>;
/** v2 keeps descriptive selections in their original sockets. The amount is a
 * separate explicit authority, never a historical ComponentEconomicScope. */
export type ConsumptionReference = Readonly<{contextOccurrenceId: string; slotKey: string; selectionId: string}>;
export type NightOutConsumptionV2 = Readonly<{
  version: "night-out-consumption@v2"; mode: "GLOBAL" | "DETAILED";
  globalSelectionId: string; amount: string; covered: readonly ConsumptionReference[];
  legacyV1?: NightOutConsumptionV1;
}>;
export type NightOutConsumption = NightOutConsumptionV1 | NightOutConsumptionV2;
export function parseNightOutConsumption(raw: unknown): NightOutConsumption {
  const v = plannerRecord(raw);
  if (v.version === "night-out-consumption@v2") {
    plannerKeys(v, ["version", "mode", "globalSelectionId", "amount", "covered", "legacyV1"], ["version", "mode", "globalSelectionId", "amount", "covered"]);
    if (!["GLOBAL", "DETAILED"].includes(String(v.mode)) || !Array.isArray(v.covered) || v.covered.length > 1500)
      throw new TypeError("NIGHT_OUT_GLOBAL_INVALID");
    const covered = v.covered.map(rawRef => { const ref = plannerRecord(rawRef);
      plannerKeys(ref, ["contextOccurrenceId", "slotKey", "selectionId"]);
      return {contextOccurrenceId: plannerString(ref.contextOccurrenceId), slotKey: plannerString(ref.slotKey), selectionId: plannerString(ref.selectionId)};
    });
    if (new Set(covered.map(consumptionReferenceKey)).size !== covered.length || v.mode === "DETAILED" && covered.length)
      throw new TypeError("NIGHT_OUT_GLOBAL_COVERAGE_INVALID");
    const legacy = v.legacyV1 === undefined ? undefined : parseNightOutConsumption(v.legacyV1);
    if (legacy && (legacy.version !== "night-out-consumption@v1" || legacy.mode !== "DETAILED")) throw new TypeError("NIGHT_OUT_GLOBAL_LEGACY_INVALID");
    return {version: "night-out-consumption@v2", mode: v.mode as NightOutConsumptionV2["mode"],
      globalSelectionId: plannerString(v.globalSelectionId), amount: decisionAmount(v.amount), covered,
      ...(legacy ? {legacyV1: legacy as NightOutConsumptionV1} : {})};
  }
  plannerKeys(v, ["version", "mode", "directSelectionId", "inactive"]);
  if (v.version !== "night-out-consumption@v1" || !["DIRECT", "DETAILED"].includes(String(v.mode))
    || !Array.isArray(v.inactive) || v.inactive.length > 500) throw new TypeError("NIGHT_OUT_CONSUMPTION_INVALID");
  const id = v.directSelectionId === null ? null : plannerString(v.directSelectionId);
  const inactive = v.inactive.map(rawItem => {
    const item = parsePlannerJsonObject(rawItem);
    if (item.kind !== "COMPONENT" || item.optionKey !== "extra" || item.provenance !== "EXPLICIT_USER_DECISION")
      throw new TypeError("NIGHT_OUT_CONSUMPTION_COMPONENT_INVALID");
    plannerString(item.selectionId); plannerString(item.label); decisionAmount(item.quantity);
    const cost = plannerRecord(item.cost);
    if (cost.kind === "MANUAL") decisionAmount(cost.unitAmount);
    if (!["MANUAL", "UNKNOWN", "QUOTE"].includes(String(cost.kind))) throw new TypeError("NIGHT_OUT_CONSUMPTION_COST_INVALID");
    return item as unknown as Component;
  });
  if (new Set(inactive.map(i => i.selectionId)).size !== inactive.length
    || v.mode === "DIRECT" && !id
    || v.mode === "DETAILED" && (inactive.length > 1 || (id === null) !== (inactive.length === 0)
      || inactive.length === 1 && inactive[0].selectionId !== id)) throw new TypeError("NIGHT_OUT_CONSUMPTION_INVALID");
  return { version: "night-out-consumption@v1", mode: v.mode as NightOutConsumptionV1["mode"], directSelectionId: id, inactive };
}
export const nightOutConsumption = (context: PlannedContextState): NightOutConsumption | null =>
  context.fields.nightOutConsumption === undefined ? null : parseNightOutConsumption(context.fields.nightOutConsumption);
export const nightOutExtras = (context: PlannedContextState): readonly ComponentSelectionV1[] =>
  (context.slotSelections.extras?.items ?? []) as unknown as readonly ComponentSelectionV1[];
export const nightOutDirectSelectionId = (context: PlannedContextState): string | null => {
  const consumption = nightOutConsumption(context); return consumption?.version === "night-out-consumption@v1" ? consumption.directSelectionId : null;
};

/** Validate references as well as the version, even when saving an incomplete Draft. */
export function validateNightOutConsumption(context: PlannedContextState): void {
  const mode = nightOutConsumption(context); if (!mode) return;
  if (context.templateKey !== "night-out") throw new TypeError("NIGHT_OUT_CONSUMPTION_OWNER_INVALID");
  if (mode.version === "night-out-consumption@v2") {
    if (presetForContext(context)?.presetKey !== "bar-apero") throw new TypeError("NIGHT_OUT_GLOBAL_OWNER_INVALID");
    return;
  }
  const extras = nightOutExtras(context);
  const all = Object.values(context.slotSelections).flatMap(s => Array.isArray(s.items) ? s.items : []);
  if (mode.inactive.some(i => all.some(a => a && typeof a === "object" && !Array.isArray(a) && a.selectionId === i.selectionId)))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_ACTIVE_INACTIVE_OVERLAP");
  const direct = mode.mode === "DIRECT" ? extras.find(i => i.selectionId === mode.directSelectionId) : mode.inactive[0];
  if (mode.mode === "DIRECT" && extras.some(i => i.selectionId !== mode.directSelectionId
    && !(i.kind === "COMPONENT" && i.economicScope?.kind === "ADDITIVE_CONTRIBUTION")))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_ACTIVE_SCOPE_CONFLICT");
  if (mode.directSelectionId && (!direct || direct.kind !== "COMPONENT" || direct.optionKey !== "extra"
    || direct.quantity !== "1" && direct.quantity !== "1.00" || direct.unitBasis !== "SHARED"
    || !direct.economicScope || parseComponentEconomicScope(direct.economicScope, direct.selectionId).kind !== "AGGREGATED_SUBSTITUTIVE_ESTIMATE"))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_DIRECT_INVALID");
}

export type NightOutConsumptionCommand = Readonly<{
  expectedContextDigest: string;
  mode: "DIRECT" | "DETAILED";
  /** Only for the explicit amount action. Never calculated from the total. */
  amount?: string;
  selectionId?: string;
  acceptLegacy?: boolean;
}>;
export function transitionNightOutConsumption(context: PlannedContextState, command: NightOutConsumptionCommand): PlannedContextState {
  if (plannerDigest(context) !== command.expectedContextDigest) throw new TypeError("NIGHT_OUT_CONSUMPTION_STALE");
  if (context.templateKey !== "night-out") throw new TypeError("NIGHT_OUT_CONSUMPTION_OWNER_INVALID");
  if (!["DIRECT", "DETAILED"].includes(command.mode)) throw new TypeError("NIGHT_OUT_CONSUMPTION_INVALID");
  const prior = nightOutConsumption(context), extras = nightOutExtras(context);
  if (prior?.version === "night-out-consumption@v2") throw new TypeError("NIGHT_OUT_GLOBAL_COMMAND_REQUIRED");
  const main = (context.slotSelections.main?.items ?? []) as unknown as readonly ComponentSelectionV1[];
  if (main.some(i => i.kind === "COMPONENT" && i.economicScope?.kind !== "ADDITIVE_CONTRIBUTION"))
    throw new TypeError("NIGHT_OUT_CONSUMPTION_LEGACY_MAIN_NEEDS_CHOICE");
  if (prior?.mode === command.mode && command.amount === undefined) return context;
  // Never implicitly reinterpret a historical aggregate or a financed selection.
  const candidates = extras.filter(i => i.selectionId !== prior?.directSelectionId && !(i.kind === "COMPONENT" && i.economicScope?.kind === "ADDITIVE_CONTRIBUTION"));
  if (!prior && candidates.length && !command.acceptLegacy) throw new TypeError("NIGHT_OUT_CONSUMPTION_LEGACY_NEEDS_CHOICE");
  if (candidates.some(i => i.kind !== "COMPONENT" || i.provenance !== "EXPLICIT_USER_DECISION"
    || i.economicScope || i.fundingAllocations?.length)) throw new TypeError("NIGHT_OUT_CONSUMPTION_SCOPE_NEEDS_CHOICE");
  let next: NightOutConsumptionV1, items: readonly ComponentSelectionV1[];
  if (command.mode === "DETAILED") {
    const direct = prior?.mode === "DIRECT" ? extras.find(i => i.selectionId === prior.directSelectionId) : null;
    if (direct && (direct.kind !== "COMPONENT" || direct.fundingAllocations?.length)) throw new TypeError("NIGHT_OUT_CONSUMPTION_FUNDING_NEEDS_CHOICE");
    next = { version: "night-out-consumption@v1", mode: "DETAILED", directSelectionId: direct?.selectionId ?? null, inactive: direct ? [direct as Component] : [] };
    items = prior?.mode === "DIRECT" ? [...extras.filter(i => i !== direct), ...prior.inactive] : extras;
  } else {
    const original = prior?.mode === "DETAILED" ? prior.inactive[0] : prior?.mode === "DIRECT" ? extras.find(i => i.selectionId === prior.directSelectionId) : null;
    if (original && (original.kind !== "COMPONENT" || original.fundingAllocations?.length)) throw new TypeError("NIGHT_OUT_CONSUMPTION_FUNDING_NEEDS_CHOICE");
    if (!original && command.amount === undefined) throw new TypeError("NIGHT_OUT_CONSUMPTION_DIRECT_AMOUNT_REQUIRED");
    const selectionId = original?.selectionId ?? plannerString(command.selectionId);
    const direct: Component = original?.kind === "COMPONENT" ? { ...original,
      ...(command.amount === undefined ? {} : { cost: { kind: "MANUAL", unitAmount: decisionAmount(command.amount) } }) } : {
      selectionId, optionKey: "extra", kind: "COMPONENT", provenance: "EXPLICIT_USER_DECISION", label: "Consommations", quantity: "1", unitBasis: "SHARED",
      cost: { kind: "MANUAL", unitAmount: decisionAmount(command.amount) },
      economicScope: { version: "component-economic-scope@v1", kind: "AGGREGATED_SUBSTITUTIVE_ESTIMATE", coveredSelectionIds: [selectionId] }
    };
    const archived = prior?.mode === "DIRECT" ? prior.inactive : candidates as readonly Component[];
    next = { version: "night-out-consumption@v1", mode: "DIRECT", directSelectionId: selectionId, inactive: archived };
    const removed = new Set([...archived.map(i => i.selectionId), selectionId]);
    items = [...extras.filter(i => !removed.has(i.selectionId)), direct];
  }
  const result = { ...context, fields: { ...context.fields, nightOutConsumption: next as unknown as PlannerJsonObject },
    slotSelections: { ...context.slotSelections, extras: { items: items as unknown as readonly PlannerJsonObject[] } } };
  validateNightOutConsumption(result); return result;
}

export const consumptionReferenceKey = (ref: ConsumptionReference): string => JSON.stringify([ref.contextOccurrenceId, ref.slotKey, ref.selectionId]);
export function globalConsumptionCovers(contexts: readonly PlannedContextState[], owner: string, slot: string, selectionId: string): boolean {
  return contexts.some(c => { const mode = nightOutConsumption(c);
    return mode?.version === "night-out-consumption@v2" && mode.mode === "GLOBAL" && mode.covered.some(ref =>
      ref.contextOccurrenceId === owner && ref.selectionId === selectionId && (ref.slotKey === slot || slot === "$before" && ["main", "extras"].includes(ref.slotKey)));
  });
}
const socketItems = (context: PlannedContextState, key: string): readonly ComponentSelectionV1[] =>
  (context.slotSelections[key]?.items ?? []) as unknown as readonly ComponentSelectionV1[];

/** Only the explicitly linked Before and the Bar extras are consumption sockets.
 * Meals, entry/contributions and all mobility keep their independent authority. */
export function globalConsumptionCoverage(contexts: readonly PlannedContextState[], parent: PlannedContextState): ConsumptionReference[] {
  if (parent.templateKey !== "night-out" || presetForContext(parent)?.presetKey !== "bar-apero")
    throw new TypeError("NIGHT_OUT_GLOBAL_OWNER_INVALID");
  if (socketItems(parent, "main").some(item => item.kind === "COMPONENT" && item.economicScope?.kind !== "ADDITIVE_CONTRIBUTION"))
    throw new TypeError("NIGHT_OUT_GLOBAL_LEGACY_NEEDS_CHOICE");
  const slots = [{context: parent, slotKey: "extras"}];
  const before = socketItems(parent, "before");
  if (before.length) {
    const link = before[0], child = link.kind === "CHILD_CONTEXT" && contexts.find(c => c.contextOccurrenceId === link.childContextOccurrenceId);
    if (before.length !== 1 || link.kind !== "CHILD_CONTEXT" || link.provenance !== "EXPLICIT_USER_DECISION"
      || !child || child.templateKey !== "activity" || child.parentContextOccurrenceId !== parent.contextOccurrenceId)
      throw new TypeError("NIGHT_OUT_GLOBAL_BEFORE_AMBIGUOUS");
    if (socketItems(child,"main").length !== 1) throw new TypeError("NIGHT_OUT_GLOBAL_BEFORE_AMBIGUOUS");
    slots.push({context: child, slotKey: "main"}, {context: child, slotKey: "extras"});
  }
  return slots.flatMap(({context, slotKey}) => socketItems(context, slotKey).flatMap(item => {
    if (item.provenance === "PERSONAL_SUGGESTION") return [];
    if (item.kind === "COMPONENT" && item.economicScope?.kind === "ADDITIVE_CONTRIBUTION") return [];
    // Catalogue identities with a distinct role are never absorbed, even if a
    // historical editor placed them in the generic extras socket.
    if (item.kind === "COMPONENT" && item.productAssetRef && ["bar:parking","bar:entry","club:parking","club:ticket","club:cloakroom","club:uber_out","club:uber_back"].includes(item.productAssetRef.assetKey)) return [];
    if (item.kind !== "COMPONENT" || item.provenance !== "EXPLICIT_USER_DECISION" || item.economicScope
      || item.fundingAllocations?.length || item.binding && !["AUTO", "NO_RELATED_SLOT"].includes(item.binding.mode)
      || item.needOccurrenceId || item.lodgingPricing)
      throw new TypeError("NIGHT_OUT_GLOBAL_SCOPE_NEEDS_CHOICE");
    return [{contextOccurrenceId: context.contextOccurrenceId, slotKey, selectionId: item.selectionId}];
  })).sort((a, b) => consumptionReferenceKey(a).localeCompare(consumptionReferenceKey(b)));
}

/** Saving/parsing never repairs a forged or stale coverage. Only admitted
 * semantic edits refresh the reference list, so newly added products are covered. */
export function validateGlobalConsumption(contexts: readonly PlannedContextState[]): void {
  const covered = new Set<string>();
  for (const parent of contexts) {
    const mode = nightOutConsumption(parent);
    if (mode?.version !== "night-out-consumption@v2") continue;
    if (contexts.some(c => Object.values(c.slotSelections).some(s => Array.isArray(s.items) && s.items.some(i =>
      i && typeof i === "object" && !Array.isArray(i) && i.selectionId === mode.globalSelectionId))))
      throw new TypeError("NIGHT_OUT_GLOBAL_ID_COLLISION");
    if (mode.mode !== "GLOBAL") continue;
    const refs = globalConsumptionCoverage(contexts, parent);
    if (plannerDigest(refs.map(consumptionReferenceKey).sort()) !== plannerDigest(mode.covered.map(consumptionReferenceKey).sort()))
      throw new TypeError("NIGHT_OUT_GLOBAL_COVERAGE_STALE");
    for (const ref of refs) { const key = consumptionReferenceKey(ref);
      if (covered.has(key)) throw new TypeError("NIGHT_OUT_GLOBAL_COVERAGE_OVERLAP"); covered.add(key);
    }
  }
}
export function refreshGlobalConsumption<T extends {contexts: readonly PlannedContextState[]}>(state: T): T {
  return {...state, contexts: state.contexts.map(context => {
    const mode = nightOutConsumption(context);
    return mode?.version === "night-out-consumption@v2" && mode.mode === "GLOBAL"
      ? {...context, fields: {...context.fields, nightOutConsumption: {...mode,
        covered: globalConsumptionCoverage(state.contexts, context)} as unknown as PlannerJsonObject}} : context;
  })};
}

export type NightOutGlobalCommand = Readonly<{
  version: "night-out-consumption@v2"; mode: "GLOBAL" | "DETAILED";
  expectedStateDigest: string; amount?: string; selectionId?: string; confirmed?: boolean;
}>;
/** A digest of the complete semantic state covers parent, Before, links and
 * protection preferences. No asynchronous parent-only replacement is admitted. */
export function transitionNightOutGlobal(state: PlanSemanticStateV1, parent: PlannedContextState, command: NightOutGlobalCommand): PlanSemanticStateV1 {
  if (plannerDigest(state) !== command.expectedStateDigest) throw new TypeError("NIGHT_OUT_GLOBAL_STALE");
  if (command.version !== "night-out-consumption@v2" || !["GLOBAL", "DETAILED"].includes(command.mode))
    throw new TypeError("NIGHT_OUT_GLOBAL_INVALID");
  if (parent.templateKey !== "night-out" || presetForContext(parent)?.presetKey !== "bar-apero") throw new TypeError("NIGHT_OUT_GLOBAL_OWNER_INVALID");
  const childIds = socketItems(parent, "before").flatMap(i => i.kind === "CHILD_CONTEXT" ? [i.childContextOccurrenceId] : []);
  if ([parent.contextOccurrenceId, ...childIds].some(id => state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE"))
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const prior = nightOutConsumption(parent);
  // A v1 DIRECT amount only owns Au bar. Require the existing explicit return to
  // v1 details before opting into a broader authority; never reinterpret it.
  if (prior?.version === "night-out-consumption@v1" && prior.mode === "DIRECT") throw new TypeError("NIGHT_OUT_GLOBAL_V1_DIRECT_NEEDS_DETAILS");
  const previous = prior?.version === "night-out-consumption@v2" ? prior : null;
  if (!previous && command.mode === "DETAILED") throw new TypeError("NIGHT_OUT_GLOBAL_MISSING");
  if (command.mode === "GLOBAL" && previous?.mode !== "GLOBAL" && !command.confirmed)
    throw new TypeError("NIGHT_OUT_GLOBAL_CONFIRMATION_REQUIRED");
  const amount = command.amount === undefined ? previous?.amount : decisionAmount(command.amount);
  if (amount === undefined) throw new TypeError("NIGHT_OUT_GLOBAL_AMOUNT_REQUIRED");
  const next: NightOutConsumptionV2 = {version: "night-out-consumption@v2", mode: command.mode,
    globalSelectionId: previous?.globalSelectionId ?? plannerString(command.selectionId), amount,
    covered: command.mode === "GLOBAL" ? globalConsumptionCoverage(state.contexts, parent) : [],
    ...(previous?.legacyV1 ? {legacyV1: previous.legacyV1} : prior?.version === "night-out-consumption@v1" ? {legacyV1: prior} : {})};
  return {...state, contexts: state.contexts.map(c => c === parent ? {...c,
    fields: {...c.fields, nightOutConsumption: next as unknown as PlannerJsonObject}} : c)};
}
