import "server-only";
import Big from "big.js";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { plannerDigest, plannerKeys, plannerRecord, plannerString, plannerUuid } from "@/domain/phase2/planner/json";
import type { ComponentSelectionV1, ComponentSlotDefinition } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { parseKernelCost, parseKernelFunding } from "./cost-resolver";
import { resolveContextTemplate } from "./context-registry";
import { parseJourneyDeclaration, parseMobilityPricing, mobilityTime } from "./mobility-selections";

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
    plannerKeys(value, [...common, "origin", "destination", "returnRequired", "journey", "pricing", "plannedTime", "returnTime"], common);
    if (value.returnRequired !== undefined && typeof value.returnRequired !== "boolean") throw new TypeError("CONTEXT_MOBILITY_RETURN_INVALID");
    if (value.returnTime != null && value.returnRequired !== true) throw new TypeError("JOURNEY_RETURN_TIME_REQUIRES_RETURN");
    return { ...identity, kind: "MOBILITY_INTENT", origin: place(value.origin), destination: place(value.destination), returnRequired: value.returnRequired === true,
      ...(value.journey === undefined ? {} : { journey: parseJourneyDeclaration(value.journey) }),
      ...(value.pricing === undefined ? {} : { pricing: parseMobilityPricing(value.pricing) }),
      plannedTime: mobilityTime(value.plannedTime), returnTime: mobilityTime(value.returnTime) };
  }
  plannerKeys(value, [...common, "label", "quantity", "cost", "binding", "fundingAllocations", ...(slot.acceptsNeedOccurrence ? ["needOccurrenceId"] : [])], [...common, "label", "quantity", "cost"]);
  const quantity = decisionAmount(value.quantity);
  if (new Big(quantity).lte(0) || new Big(quantity).gt(9999)) throw new TypeError("PLANNER_QUANTITY_INVALID");
  const binding = value.binding === undefined ? { mode: "AUTO" as const } : (() => {
    const candidate = plannerRecord(value.binding); plannerKeys(candidate, ["mode"]);
    if (!["AUTO", "CONFIRMED_CONSUMPTION", "EXTRA_TO_SLOT", "NO_RELATED_SLOT"].includes(String(candidate.mode))) throw new TypeError("CONTEXT_BINDING_DECISION_INVALID");
    return { mode: candidate.mode as "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT" };
  })();
  return { ...identity, kind: "COMPONENT", label: plannerString(value.label), quantity, cost: parseKernelCost(value.cost), binding,
    fundingAllocations: parseKernelFunding(value.fundingAllocations ?? []),
    ...(value.needOccurrenceId === undefined ? {} : { needOccurrenceId: plannerString(value.needOccurrenceId) }) };
}
export function readContextSelections(context: PlannedContextState, targetMonth: string): ReadonlyMap<string, readonly ComponentSelectionV1[]> {
  const template = resolveContextTemplate(context.templateKey);
  plannerKeys(plannerRecord(context.fields), template.fields.map(f => f.fieldKey), template.fields.filter(f => f.required).map(f => f.fieldKey));
  for (const field of template.fields) if (context.fields[field.fieldKey] != null) {
    const raw = context.fields[field.fieldKey];
    if (field.kind === "DATE") contextDate(raw, targetMonth);
    else if (field.kind === "CHOICE" ? !field.choices?.includes(plannerString(raw)) : !plannerString(raw)) throw new TypeError("CONTEXT_FIELD_INVALID");
  }
  const start = contextDate(context.fields.plannedDate, targetMonth), end = contextDate(context.fields.endDate, targetMonth);
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
    for (const item of items) if (item.kind === "MOBILITY_INTENT") {
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
