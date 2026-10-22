import { parsePlanSemanticState, type PlanSemanticStateV1, type PlannedContextState } from "./semantic-state";
import type { ComponentSelectionV1 } from "./component-contract";
import type { PlannerJson } from "./json";
import { plannerDigest } from "./json";
import { plannedAsset, PLANNED_ASSET_CATALOG_VERSION } from "../planned-assets";
import {parseNightOutVenue,sameVenuePlace,parseVenueEndpoints} from "./night-out-venue";
import {parseRouteEndpointBindings} from "./route-endpoint";
import {parseComponentEconomicScope} from "./component-economic-scope";
import { transitionNightOutConsumption, transitionNightOutGlobal, refreshGlobalConsumption, type NightOutConsumptionCommand, type NightOutGlobalCommand } from "./night-out-consumption";

export type NightOutBeforeEdit = Readonly<{
  childContextOccurrenceId: string; selectionId: string;
  bottle: ComponentSelectionV1; extras: readonly ComponentSelectionV1[];
}>;
export type NightOutEdit = Readonly<{
  contextOccurrenceId: string;
  fields: Readonly<Record<string, PlannerJson>>;
  /** Omitted sockets retain their entire prior structure, including child contexts. */
  slots?: Readonly<Partial<Record<"main" | "food" | "extras" | "outbound" | "return", readonly ComponentSelectionV1[]>>>;
  before?: NightOutBeforeEdit | null;
  consumption?: NightOutConsumptionCommand;
  globalConsumption?: NightOutGlobalCommand;
  coverageReplacement?:Readonly<{version:"night-out-coverage-replacement@v1";selectionId:string;expectedComponentDigest:string}>;
}>;

/** Exact owner-scoped replacement, independent of labels and costs. No amounts are computed here. */
const coverageItems=(context:PlannedContextState,key:string):readonly ComponentSelectionV1[]=>{
  const values=context.slotSelections[key]?.items;return Array.isArray(values)?values as readonly ComponentSelectionV1[]:[];
};
export function substituteNightOutCoverage(context:PlannedContextState,selectionId:string,replacement:ComponentSelectionV1):NightOutEdit{
  const slot=["main","extras"].find(key=>coverageItems(context,key).some(item=>item.selectionId===selectionId));
  const aggregate=slot?coverageItems(context,slot).find(item=>item.selectionId===selectionId):null;
  if(!slot||!aggregate||typeof aggregate!=="object"||Array.isArray(aggregate)||aggregate.kind!=="COMPONENT"||!aggregate.economicScope)throw new TypeError("NIGHT_OUT_COVERAGE_LEGACY_NEEDS_CHOICE");
  const scope=parseComponentEconomicScope(aggregate.economicScope,selectionId);
  if(scope.kind!=="AGGREGATED_SUBSTITUTIVE_ESTIMATE")throw new TypeError("NIGHT_OUT_COVERAGE_NOT_SUBSTITUTIVE");
  if(Array.isArray(aggregate.fundingAllocations)&&aggregate.fundingAllocations.length)throw new TypeError("NIGHT_OUT_COVERAGE_FUNDING_NEEDS_CHOICE");
  if(replacement.kind!=="COMPONENT"||replacement.selectionId===selectionId)throw new TypeError("NIGHT_OUT_COVERAGE_REPLACEMENT_INVALID");
  const items=(key:string)=>coverageItems(context,key);
  return {contextOccurrenceId:context.contextOccurrenceId,fields:{},coverageReplacement:{version:"night-out-coverage-replacement@v1",selectionId,expectedComponentDigest:plannerDigest(aggregate)},
    slots:{...(slot==="main"?{main:items("main").filter(i=>i.selectionId!==selectionId)}:{}),extras:[...items("extras").filter(i=>i.selectionId!==selectionId),replacement]}};
}

/** One semantic decision, shared by local staging and server validation. No financial calculation. */
export function editNightOut(raw: PlanSemanticStateV1, edit: NightOutEdit): PlanSemanticStateV1 {
  const state = parsePlanSemanticState(raw);
  const parent = state.contexts.find(c => c.contextOccurrenceId === edit.contextOccurrenceId);
  if (parent?.templateKey !== "night-out") throw new TypeError("COMPOSER_NIGHT_OUT_TARGET_INVALID");
  const protectedContext = (id: string) => state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE";
  if (protectedContext(parent.contextOccurrenceId)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  if (edit.globalConsumption) {
    if (Object.keys(edit.fields).length || edit.slots || edit.before !== undefined || edit.consumption || edit.coverageReplacement)
      throw new TypeError("NIGHT_OUT_GLOBAL_COMMAND_INVALID");
    return parsePlanSemanticState(transitionNightOutGlobal(state, parent, edit.globalConsumption));
  }
  if (edit.consumption) {
    if (Object.keys(edit.fields).length || edit.slots || edit.before !== undefined || edit.coverageReplacement)
      throw new TypeError("NIGHT_OUT_CONSUMPTION_COMMAND_INVALID");
    const next = transitionNightOutConsumption(parent, edit.consumption);
    return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c === parent ? next : c) });
  }
  if(edit.coverageReplacement){
    const proof=edit.coverageReplacement;
    if(proof.version!=="night-out-coverage-replacement@v1"||edit.before!==undefined||Object.keys(edit.fields).length)throw new TypeError("NIGHT_OUT_COVERAGE_REPLACEMENT_INVALID");
    const current=["main","extras"].flatMap(key=>coverageItems(parent,key)).find(item=>item.selectionId===proof.selectionId);
    if(!current||plannerDigest(current)!==proof.expectedComponentDigest)throw new TypeError("NIGHT_OUT_COVERAGE_STALE");
    const additions=(edit.slots?.extras??[]).filter(item=>!coverageItems(parent,"extras").some(old=>old.selectionId===item.selectionId));
    if(additions.length!==1)throw new TypeError("NIGHT_OUT_COVERAGE_REPLACEMENT_INVALID");
    const expected=substituteNightOutCoverage(parent,proof.selectionId,additions[0]);
    if(plannerDigest(expected)!==plannerDigest(edit))throw new TypeError("NIGHT_OUT_COVERAGE_SCOPE_MISMATCH");
  }
  const fields = { ...parent.fields };
  for (const [key, value] of Object.entries(edit.fields)) {
    if (value === "") delete fields[key]; else fields[key] = value;
  }
  if(Object.hasOwn(edit.fields,"placeRef")&&!Object.hasOwn(edit.fields,"venueDecision"))delete fields.venueDecision;
  if(fields.venueDecision!=null){const venue=parseNightOutVenue(fields.venueDecision);if(!sameVenuePlace(venue.place,fields.placeRef as never))throw new TypeError("NIGHT_OUT_VENUE_CONTEXT_INVALID");fields.fieldSchemaVersion="context-fields@v6";}
  for(const items of Object.values(edit.slots??{}))for(const item of items??[])if(item.kind==="MOBILITY_INTENT"&&item.venueEndpoints)parseVenueEndpoints(item.venueEndpoints,item);
  for(const items of Object.values(edit.slots??{}))for(const item of items??[])if(item.kind==="MOBILITY_INTENT"&&item.routeEndpointBindings)parseRouteEndpointBindings(item.routeEndpointBindings,item);
  if (Object.keys(edit.fields).some(key => !["label", "plannedDate", "endDate", "participantRefs", "placeRef", "venueDecision", "timingNote"].includes(key)))
    throw new TypeError("COMPOSER_NIGHT_OUT_FIELD_INVALID");
  if (Object.keys(fields).some(key => !["label", "plannedDate", "endDate", "participantRefs", "placeRef", "venueDecision", "timingNote", "fieldSchemaVersion", "composerPresentation", "nightOutConsumption"].includes(key)))
    throw new TypeError("COMPOSER_NIGHT_OUT_FIELD_INVALID");
  if (!["context-fields@v3","context-fields@v6"].includes(String(fields.fieldSchemaVersion)) && Object.keys(fields).some(key => !["label", "plannedDate", "endDate", "fieldSchemaVersion"].includes(key)))
    fields.fieldSchemaVersion = "context-fields@v2";
  const slots = { ...parent.slotSelections };
  for (const [key, items] of Object.entries(edit.slots ?? {})) {
    if (!["main", "food", "extras", "outbound", "return"].includes(key) || !Array.isArray(items)) throw new TypeError("COMPOSER_NIGHT_OUT_SLOT_INVALID");
    slots[key] = { items };
  }
  const formerBefore = Array.isArray(parent.slotSelections.before?.items) ? parent.slotSelections.before.items[0] : null;
  const formerChildId = formerBefore && typeof formerBefore === "object" && !Array.isArray(formerBefore)
    && formerBefore.kind === "CHILD_CONTEXT" ? String(formerBefore.childContextOccurrenceId) : null;
  if (edit.before !== undefined && formerChildId && protectedContext(formerChildId)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  let newChild: PlannedContextState | null = null;
  if (edit.before !== undefined) {
    if (edit.before === null) slots.before = { items: [] };
    else {
      const before = edit.before;
      const prior = state.contexts.find(c => c.contextOccurrenceId === before.childContextOccurrenceId);
      if (prior && (prior.templateKey !== "activity" || prior.parentContextOccurrenceId !== parent.contextOccurrenceId))
        throw new TypeError("COMPOSER_NIGHT_OUT_CHILD_INVALID");
      if (!prior && state.contexts.some(c => c.contextOccurrenceId === before.childContextOccurrenceId))
        throw new TypeError("COMPOSER_NIGHT_OUT_CHILD_ID_REUSED");
      newChild = { contextOccurrenceId: before.childContextOccurrenceId, templateKey: "activity", status: "ACTIVE",
        parentContextOccurrenceId: parent.contextOccurrenceId, provenance: "EXPLICIT_USER_DECISION",
        fields: prior?.fields ?? { fieldSchemaVersion: "context-fields@v2", label: "Before" },
        slotSelections: { ...prior?.slotSelections, main: { items: [before.bottle] }, extras: { items: before.extras } } };
      slots.before = { items: [{ selectionId: before.selectionId, optionKey: "activity", kind: "CHILD_CONTEXT",
        childContextOccurrenceId: before.childContextOccurrenceId, provenance: "EXPLICIT_USER_DECISION" }] };
    }
  }
  const removed = new Set<string>();
  if (edit.before !== undefined && formerChildId && formerChildId !== newChild?.contextOccurrenceId) removed.add(formerChildId);
  for (let size = -1; size !== removed.size;) {
    size = removed.size;
    for (const c of state.contexts) if (c.parentContextOccurrenceId && removed.has(c.parentContextOccurrenceId)) removed.add(c.contextOccurrenceId);
  }
  if ([...removed].some(protectedContext)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  const contexts = state.contexts.filter(c => !removed.has(c.contextOccurrenceId)).map(c =>
    c.contextOccurrenceId === parent.contextOccurrenceId ? { ...c, fields, slotSelections: slots }
      : newChild && c.contextOccurrenceId === newChild.contextOccurrenceId ? newChild : c);
  if (newChild && !state.contexts.some(c => c.contextOccurrenceId === newChild.contextOccurrenceId)) contexts.push(newChild);
  for (const context of contexts.filter(c => c.contextOccurrenceId === parent.contextOccurrenceId || c.contextOccurrenceId === newChild?.contextOccurrenceId)) {
    const prior = state.contexts.find(c => c.contextOccurrenceId === context.contextOccurrenceId);
    for (const [slot, selection] of Object.entries(context.slotSelections)) if (Array.isArray(selection.items)) for (const item of selection.items) {
      if (!item || typeof item !== "object" || Array.isArray(item) || item.kind !== "COMPONENT" || !item.productAssetRef) continue;
      const ref = item.productAssetRef as unknown as { catalogVersion: string; assetKey: string; labelAtSelection: string; provenance: string };
      const old = Array.isArray(prior?.slotSelections[slot]?.items) ? prior.slotSelections[slot].items.find(candidate =>
        candidate && typeof candidate === "object" && !Array.isArray(candidate) && candidate.selectionId === item.selectionId) : null;
      const promotedRef = context.contextOccurrenceId === newChild?.contextOccurrenceId && slot === "main"
        && formerBefore && typeof formerBefore === "object" && !Array.isArray(formerBefore) && formerBefore.kind === "COMPONENT"
        ? formerBefore.productAssetRef : null;
      const oldRef = old && typeof old === "object" && !Array.isArray(old) ? old.productAssetRef : promotedRef;
      if (plannerDigest(oldRef ?? null) === plannerDigest(item.productAssetRef)) continue;
      const asset = plannedAsset(ref.assetKey);
      if (!asset || !["bar", "club", "house_party"].includes(asset.module) || ref.catalogVersion !== PLANNED_ASSET_CATALOG_VERSION
        || ref.provenance !== "EXPLICIT_USER_DECISION" || ref.labelAtSelection !== asset.label) throw new TypeError("CONTEXT_PRODUCT_ASSET_UNKNOWN");
    }
  }
  return parsePlanSemanticState(refreshGlobalConsumption({ ...state, contexts }));
}
