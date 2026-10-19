import "server-only";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { plannerDigest, plannerInteger, plannerKeys, plannerRecord, plannerString, plannerUuid } from "@/domain/phase2/planner/json";
import type { ComponentSelectionV1, ComponentSlotDefinition } from "@/domain/phase2/planner/component-contract";
import type { ContextFieldDefinition } from "@/domain/phase2/planner/context-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import type { ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import { PLANNED_ASSET_CATALOG_VERSION, type PlannedAssetRef } from "@/domain/phase2/planned-assets";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { parseKernelCost, parseKernelFunding } from "./cost-resolver";
import { isLegacyContextField, resolveContextTemplate } from "./context-registry";
import { parseJourneyDeclaration, parseMobilityPricing, parseProspectiveRoute, mobilityTime } from "./mobility-selections";
import { validateComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import {parseNightOutVenue,parseVenueEndpoints,sameVenuePlace} from "@/domain/phase2/planner/night-out-venue";
import {parseComponentEconomicScope} from "@/domain/phase2/planner/component-economic-scope";

export function contextDate(raw: unknown, targetMonth: string): string | null {
  if (raw == null) return null;
  const date = plannerString(raw);
  if (!date.startsWith(`${targetMonth}-`) || !/^\d{4}-\d{2}-\d{2}$/u.test(date)
    || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)
    throw new TypeError("PLANNER_CONTEXT_DATE_INVALID");
  return date;
}
function place(raw: unknown): ProspectivePlaceRef | null {
  if (raw == null) return null;
  const value = plannerRecord(raw);
  if (value.kind === "KNOWN") { plannerKeys(value, ["kind", "placeId"]); return { kind: "KNOWN", placeId: plannerUuid(value.placeId) }; }
  plannerKeys(value, ["kind", "label", "provenance"], ["kind", "label"]);
  if (value.kind !== "TEXT" || value.provenance !== undefined && value.provenance !== "USER_DECLARED_PROSPECTIVE") throw new TypeError("CONTEXT_MOBILITY_PLACE_INVALID");
  return { kind: "TEXT", label: plannerString(value.label), provenance: "USER_DECLARED_PROSPECTIVE" };
}
function person(raw: unknown): ProspectivePersonRef | null {
  if (raw == null) return null;
  const value = plannerRecord(raw);
  if (value.kind === "HOUSEHOLD_PERSON") {
    plannerKeys(value, ["kind", "personId"]);
    return { kind: "HOUSEHOLD_PERSON", personId: plannerUuid(value.personId) };
  }
  if (value.kind === "CONTACT") {
    plannerKeys(value, ["kind", "contactKey"]);
    const contactKey = plannerString(value.contactKey);
    if (!SOCIAL_CONTACTS_V1.some(contact => contact.key === contactKey)) throw new TypeError("CONTEXT_CONTACT_UNKNOWN");
    return { kind: "CONTACT", contactKey };
  }
  plannerKeys(value, ["kind", "label"]);
  if (value.kind !== "TEXT") throw new TypeError("CONTEXT_PERSON_REF_INVALID");
  return { kind: "TEXT", label: plannerString(value.label) };
}
function giftAssetRef(raw: unknown): PlannedAssetRef {
  const value = plannerRecord(raw);
  plannerKeys(value, ["catalogVersion", "assetKey", "labelAtSelection", "provenance"],
    ["catalogVersion", "assetKey", "labelAtSelection", "provenance"]);
  const assetKey = plannerString(value.assetKey);
  const labelAtSelection = plannerString(value.labelAtSelection);
  if (value.catalogVersion !== PLANNED_ASSET_CATALOG_VERSION || value.provenance !== "EXPLICIT_USER_DECISION"
    || !/^gift:[a-z0-9_]+$/u.test(assetKey) || !labelAtSelection.trim()) throw new TypeError("CONTEXT_GIFT_ASSET_REF_INVALID");
  return { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey, labelAtSelection, provenance: "EXPLICIT_USER_DECISION" };
}
function nightProductAssetRef(raw: unknown): PlannedAssetRef {
  const value = plannerRecord(raw);
  plannerKeys(value, ["catalogVersion", "assetKey", "labelAtSelection", "provenance"]);
  const assetKey = plannerString(value.assetKey), labelAtSelection = plannerString(value.labelAtSelection);
  if (value.catalogVersion !== PLANNED_ASSET_CATALOG_VERSION || value.provenance !== "EXPLICIT_USER_DECISION"
    || !/^(bar|club|house_party):[a-z0-9_]+$/u.test(assetKey) || !labelAtSelection.trim())
    throw new TypeError("CONTEXT_PRODUCT_ASSET_REF_INVALID");
  return { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey, labelAtSelection, provenance: "EXPLICIT_USER_DECISION" };
}
export function parseContextField(raw: unknown, field: ContextFieldDefinition, targetMonth: string): unknown {
  if (raw == null) return null;
  if(field.semanticContract==="NIGHT_OUT_VENUE")return parseNightOutVenue(raw);
  if (field.kind === "PLANNED_ASSET_REF") return giftAssetRef(raw);
  if (field.kind === "DATE") return contextDate(raw, targetMonth);
  if (field.kind === "PERSON_REF") return person(raw);
  if (field.kind === "PLACE_REF") return place(raw);
  if (field.kind === "PERSON_REFS") {
    if (!Array.isArray(raw) || raw.length > 50) throw new TypeError("CONTEXT_PARTICIPANTS_INVALID");
    const values = raw.map(person);
    if (values.some(value => value === null) || new Set(values.map(value => plannerDigest(value))).size !== values.length)
      throw new TypeError("CONTEXT_PARTICIPANTS_INVALID");
    return values;
  }
  if (field.kind === "COUNT") {
    const count = plannerInteger(raw, 1);
    if (count > 366) throw new TypeError("CONTEXT_COUNT_INVALID");
    return count;
  }
  const value = plannerString(raw);
  if (field.kind === "CHOICE" && !field.choices?.includes(value)) throw new TypeError("CONTEXT_FIELD_INVALID");
  return value;
}
function selection(raw: unknown, slot: ComponentSlotDefinition): ComponentSelectionV1 {
  const value = plannerRecord(raw), common = ["selectionId", "optionKey", "kind", "provenance"];
  const selectionId = plannerString(value.selectionId), optionKey = plannerString(value.optionKey);
  if (!["STRUCTURAL_DEFAULT", "PERSONAL_SUGGESTION", "EXPLICIT_USER_DECISION"].includes(String(value.provenance))) throw new TypeError("CONTEXT_DEFAULT_PROVENANCE_INVALID");
  const provenance = value.provenance as ComponentSelectionV1["provenance"];
  const identity = { selectionId, optionKey, provenance };
  if (value.kind === "UNRESOLVED") {
    plannerKeys(value, common);
    if (optionKey !== "unresolved") throw new TypeError("CONTEXT_UNRESOLVED_OPTION_INVALID");
    return { ...identity, kind: "UNRESOLVED" };
  }
  if (value.kind === "CHILD_CONTEXT") {
    plannerKeys(value, [...common, "childContextOccurrenceId"]);
    if (!slot.allowedChildTemplates.includes(optionKey)) throw new TypeError("CONTEXT_CHILD_CAPABILITY_FORBIDDEN");
    return { ...identity, kind: "CHILD_CONTEXT", childContextOccurrenceId: plannerUuid(value.childContextOccurrenceId) };
  }
  const option = slot.options.find(o => o.optionKey === optionKey && o.kind === value.kind);
  if (!option) throw new TypeError("CONTEXT_COMPONENT_CAPABILITY_FORBIDDEN");
  if (value.kind === "MOBILITY_INTENT") {
    plannerKeys(value, [...common, "origin", "destination", "returnRequired", "journey", "pricing", "plannedTime", "returnTime", "route", "venueEndpoints"], common);
    if (value.returnRequired !== undefined && typeof value.returnRequired !== "boolean") throw new TypeError("CONTEXT_MOBILITY_RETURN_INVALID");
    if (value.returnTime != null && value.returnRequired !== true) throw new TypeError("JOURNEY_RETURN_TIME_REQUIRES_RETURN");
    if (value.route !== undefined && (option.mobilityMode !== "CAR"
      || value.journey !== undefined && parseJourneyDeclaration(value.journey)?.relation !== "OWNS_JOURNEY"))
      throw new TypeError("COMPOSER_ROUTE_OWNER_REQUIRED");
    return { ...identity, kind: "MOBILITY_INTENT", origin: place(value.origin), destination: place(value.destination), returnRequired: value.returnRequired === true,
      ...(value.venueEndpoints===undefined?{}:{venueEndpoints:parseVenueEndpoints(value.venueEndpoints,{origin:place(value.origin),destination:place(value.destination)})}),
      ...(value.journey === undefined ? {} : { journey: parseJourneyDeclaration(value.journey) }),
      ...(value.pricing === undefined ? {} : { pricing: parseMobilityPricing(value.pricing) }),
      ...(value.route === undefined ? {} : { route: parseProspectiveRoute(value.route) }),
      plannedTime: mobilityTime(value.plannedTime), returnTime: mobilityTime(value.returnTime) };
  }
  plannerKeys(value, [...common, "label", "quantity", "cost", "binding", "fundingAllocations", "unitBasis", "quantityEvidenceVersion", "quantityPerPerson", "pricedParticipantCount", "productAssetRef", "lodgingPricing", "economicScope", ...(slot.acceptsNeedOccurrence ? ["needOccurrenceId"] : [])], [...common, "label", "quantity", "cost"]);
  const quantity = decisionAmount(value.quantity);
  if (value.unitBasis !== undefined && !["ITEM", "PERSON", "SHARED"].includes(String(value.unitBasis))) throw new TypeError("CONTEXT_UNIT_BASIS_INVALID");
  validateComponentQuantity(quantity, value.unitBasis, value.quantityEvidenceVersion, value.quantityPerPerson, value.pricedParticipantCount);
  const lodgingPricing = value.lodgingPricing === undefined ? undefined : (() => {
    const pricing = plannerRecord(value.lodgingPricing); plannerKeys(pricing, ["version", "basis", "nightCount"]);
    if (slot.slotKey !== "lodging" || pricing.version !== "lodging-pricing@v1" || !["TOTAL", "PER_NIGHT"].includes(String(pricing.basis)))
      throw new TypeError("CONTEXT_LODGING_PRICING_INVALID");
    const nightCount = pricing.nightCount === null ? null : plannerInteger(pricing.nightCount, 1);
    if (nightCount !== null && nightCount > 366 || value.unitBasis !== "ITEM" || value.quantityPerPerson !== undefined
      || quantity !== decisionAmount(pricing.basis === "PER_NIGHT" && nightCount !== null ? String(nightCount) : "1"))
      throw new TypeError("CONTEXT_LODGING_QUANTITY_INVALID");
    return { version: "lodging-pricing@v1" as const, basis: pricing.basis as "TOTAL" | "PER_NIGHT", nightCount };
  })();
  const perPerson = value.quantityPerPerson === undefined ? null : decisionAmount(value.quantityPerPerson);
  const participantCount = value.pricedParticipantCount === undefined ? null : plannerInteger(value.pricedParticipantCount, 1);
  const binding = value.binding === undefined ? { mode: "AUTO" as const } : (() => {
    const candidate = plannerRecord(value.binding); plannerKeys(candidate, ["mode"]);
    if (!["AUTO", "CONFIRMED_CONSUMPTION", "EXTRA_TO_SLOT", "NO_RELATED_SLOT"].includes(String(candidate.mode))) throw new TypeError("CONTEXT_BINDING_DECISION_INVALID");
    return { mode: candidate.mode as "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT" };
  })();
  return { ...identity, kind: "COMPONENT", label: plannerString(value.label), quantity, cost: parseKernelCost(value.cost), binding,
    fundingAllocations: parseKernelFunding(value.fundingAllocations ?? []),
    ...(value.unitBasis === undefined ? {} : { unitBasis: value.unitBasis as "ITEM" | "PERSON" | "SHARED" }),
    ...(perPerson === null ? {} : { quantityEvidenceVersion: "component-quantity@v1" as const, quantityPerPerson: perPerson, pricedParticipantCount: participantCount! }),
    ...(lodgingPricing ? { lodgingPricing } : {}),
    ...(value.economicScope===undefined?{}:{economicScope:parseComponentEconomicScope(value.economicScope,selectionId)}),
    ...(value.productAssetRef === undefined ? {} : { productAssetRef: nightProductAssetRef(value.productAssetRef) }),
    ...(value.needOccurrenceId === undefined ? {} : { needOccurrenceId: plannerString(value.needOccurrenceId) }) };
}
export function readContextSelections(context: PlannedContextState, targetMonth: string): ReadonlyMap<string, readonly ComponentSelectionV1[]> {
  const template = resolveContextTemplate(context.templateKey);
  plannerKeys(plannerRecord(context.fields), [...template.fields.map(f => f.fieldKey), "composerPresentation"], template.fields.filter(f => f.required).map(f => f.fieldKey));
  for (const field of template.fields) if (Object.hasOwn(context.fields, field.fieldKey)) {
    if (field.fieldKey === "objectAssetRef" && context.fields.fieldSchemaVersion !== "context-fields@v3"
      || !isLegacyContextField(context.templateKey, field.fieldKey) && field.fieldKey !== "fieldSchemaVersion"
      && !["context-fields@v2", "context-fields@v3", ...(context.templateKey === "night-out" ? ["context-fields@v6"] : context.templateKey === "family-visit" ? ["context-fields@v4"] : context.templateKey === "short-stay" ? ["context-fields@v5"] : [])].includes(String(context.fields.fieldSchemaVersion)))
      throw new TypeError("CONTEXT_FIELD_VERSION_REQUIRED");
    parseContextField(context.fields[field.fieldKey], field, targetMonth);
  }
  const start = contextDate(context.fields.plannedDate, targetMonth), end = contextDate(context.fields.endDate, targetMonth);
  if(context.fields.venueDecision!=null&&(context.fields.fieldSchemaVersion!=="context-fields@v6"||!sameVenuePlace(parseNightOutVenue(context.fields.venueDecision).place,place(context.fields.placeRef))))throw new TypeError("NIGHT_OUT_VENUE_CONTEXT_INVALID");
  if (start && end && end < start) throw new TypeError("CONTEXT_DATE_RANGE_INVALID");
  plannerKeys(plannerRecord(context.slotSelections), template.componentSlots.map(s => s.slotKey), []);
  return new Map(template.componentSlots.map(slot => {
    const raw = context.slotSelections[slot.slotKey];
    let items: readonly ComponentSelectionV1[];
    if (raw === undefined) items = template.structuralDefaults[slot.slotKey]?.items ?? [];
    else {
      const wrapper = plannerRecord(raw); plannerKeys(wrapper, ["items"]);
      if (!Array.isArray(wrapper.items) || wrapper.items.length > 500) throw new TypeError("CONTEXT_SLOT_ITEMS_INVALID");
      if (slot.cardinality !== "REPEATING" && wrapper.items.length > 1) throw new TypeError("CONTEXT_ONE_OF_MULTIPLE_SELECTIONS");
      items = wrapper.items.map(item => {
        const candidate = plannerRecord(item);
        if (candidate.provenance === "STRUCTURAL_DEFAULT") {
          const allowed = template.structuralDefaults[slot.slotKey]?.items ?? [];
          if (!allowed.some(defaultItem => plannerDigest(defaultItem) === plannerDigest(candidate))) throw new TypeError("CONTEXT_STRUCTURAL_DEFAULT_FORGED");
        }
        return selection(item, slot);
      });
      if (!items.length && slot.cardinality === "REQUIRED_ONE") items = template.structuralDefaults[slot.slotKey].items;
    }
    if (new Set(items.map(item => item.selectionId)).size !== items.length) throw new TypeError("CONTEXT_SELECTION_ID_DUPLICATE");
    for (const item of items) if (item.kind === "COMPONENT" && item.lodgingPricing) {
      if (context.fields.fieldSchemaVersion !== "context-fields@v5" || item.lodgingPricing.nightCount !== (context.fields.nightCount ?? null))
        throw new TypeError("CONTEXT_LODGING_NIGHTS_MISMATCH");
    }
    if (context.templateKey === "short-stay" && slot.slotKey === "extras" && items.length && context.fields.fieldSchemaVersion !== "context-fields@v5")
      throw new TypeError("CONTEXT_FIELD_VERSION_REQUIRED");
    for (const item of items) if (item.kind === "MOBILITY_INTENT") {
      if(item.venueEndpoints&&(context.templateKey!=="night-out"||!["outbound","return"].includes(slot.slotKey)||item.returnRequired||item.journey&&item.journey.relation!=="OWNS_JOURNEY"))throw new TypeError("NIGHT_OUT_ENDPOINT_OWNER_INVALID");
      if(item.venueEndpoints&&item.route?.stops.length)for(const key of ["origin","destination"] as const){
        const binding=item.venueEndpoints[key],stop=key==="origin"?item.route.stops[0]:item.route.stops.at(-1);
        if(binding&&(!stop||!sameVenuePlace(binding.venue.place,stop.placeId?{kind:"KNOWN",placeId:stop.placeId}:{kind:"TEXT",label:stop.label})))throw new TypeError("NIGHT_OUT_ENDPOINT_ROUTE_MISMATCH");
      }
      if (item.plannedTime && !(slot.mobilityRole === "RETURN" ? end ?? start : start) || item.returnTime && !start)
        throw new TypeError("JOURNEY_TIME_REQUIRES_DATE");
      if (item.returnRequired && (!end || end === start) && item.plannedTime && item.returnTime && item.returnTime < item.plannedTime)
        throw new TypeError("JOURNEY_RETURN_BEFORE_DEPARTURE");
    }
    return [slot.slotKey, [...items].sort((a, b) => a.selectionId < b.selectionId ? -1 : a.selectionId > b.selectionId ? 1 : 0)];
  }));
}
/** A child has exactly one owning socket. Parent links alone never grant a capability. */
export function validateContextGraph(state: PlanSemanticStateV1) {
  const selections = new Map(state.contexts.filter(c => c.templateKey !== "kernel.generic")
    .map(c => [c.contextOccurrenceId, readContextSelections(c, state.targetMonth)]));
  for(const context of state.contexts){
    const entries=[...(selections.get(context.contextOccurrenceId)?.entries()??[])];
    const all=entries.flatMap(([slot,items])=>items.map(item=>({slot,item}))),covered=new Set<string>();
    for(const {slot,item} of all)if(item.kind==="COMPONENT"&&item.economicScope){
      if(context.templateKey!=="night-out"||!["main","extras"].includes(slot))throw new TypeError("COMPONENT_ECONOMIC_SCOPE_OWNER_INVALID");
      for(const id of item.economicScope.coveredSelectionIds){
        if(covered.has(id)||all.some(other=>other.item.selectionId===id&&other.item!==item))throw new TypeError("COMPONENT_ECONOMIC_SCOPE_OVERLAP");covered.add(id);
      }
    }
  }
  const links = new Map<string, Readonly<{ parentId: string; selection: ComponentSelectionV1 }>>();
  for (const context of state.contexts) for (const items of selections.get(context.contextOccurrenceId)?.values() ?? []) for (const item of items) {
    if (item.kind !== "CHILD_CONTEXT") continue;
    const child = state.contexts.find(c => c.contextOccurrenceId === item.childContextOccurrenceId);
    if (!child || child.templateKey !== item.optionKey || child.parentContextOccurrenceId !== context.contextOccurrenceId) throw new TypeError("CONTEXT_CHILD_LINK_INVALID");
    if (links.has(child.contextOccurrenceId)) throw new TypeError("CONTEXT_CHILD_MULTIPLE_OWNERS");
    links.set(child.contextOccurrenceId, { parentId: context.contextOccurrenceId, selection: item });
  }
  for (const context of state.contexts) if (context.parentContextOccurrenceId && !links.has(context.contextOccurrenceId)) throw new TypeError("CONTEXT_PARENT_SOCKET_REQUIRED");
  return { selections, links };
}

/** These IDs need household owner evidence before a new revision may be committed. */
export function knownContextReferences(state: PlanSemanticStateV1): { personIds: string[]; placeIds: string[] } {
  const personIds = new Set<string>(), placeIds = new Set<string>();
  for (const context of state.contexts) {
    if (context.templateKey === "kernel.generic") continue;
    const template = resolveContextTemplate(context.templateKey);
    for (const field of template.fields) {
      const raw = context.fields[field.fieldKey];
      if (raw == null) continue;
      if (field.kind === "PERSON_REF" || field.kind === "PERSON_REFS") {
        const refs = (field.kind === "PERSON_REFS" ? parseContextField(raw, field, state.targetMonth) : [parseContextField(raw, field, state.targetMonth)]) as ProspectivePersonRef[];
        for (const ref of refs) if (ref?.kind === "HOUSEHOLD_PERSON") personIds.add(ref.personId);
      } else if (field.kind === "PLACE_REF") {
        const ref = parseContextField(raw, field, state.targetMonth) as ProspectivePlaceRef | null;
        if (ref?.kind === "KNOWN") placeIds.add(ref.placeId);
      }
    }
    for (const items of readContextSelections(context, state.targetMonth).values()) for (const item of items) {
      if (item.kind !== "MOBILITY_INTENT") continue;
      for (const ref of [item.origin, item.destination]) if (ref?.kind === "KNOWN") placeIds.add(ref.placeId);
      for (const stop of item.route?.stops ?? []) if (stop.placeId) placeIds.add(stop.placeId);
    }
  }
  return { personIds: [...personIds].sort(), placeIds: [...placeIds].sort() };
}
