import type { ComponentSelectionV1, ComponentSlotDefinition } from "./component-contract";
import type { PlannedContextState, PlanSemanticStateV1 } from "./semantic-state";
import { plannerDigest, plannerKeys, plannerRecord, plannerString, plannerUuid, type PlannerJson } from "./json";
import { presetForContext } from "./composer-presets";
import { componentId } from "./identity";
import { SOCIAL_CONTACTS_V1 } from "../planned-rules";
import { decisionAmount } from "../month-decision-contract";
import { validateComponentQuantity } from "./component-quantity";
import { parseKernelCost, parseKernelFunding } from "./component-input";
import { PLANNED_ASSET_CATALOG_VERSION, plannedAsset } from "../planned-assets";

export type BeforeMoment = Readonly<{ version: "before-moment@v1"; consumption: "NONE" | "ITEMS" }>;
export type BeforeMomentEdit = Readonly<{
  version: "before-moment-edit@v1"; expectedStateDigest: string;
  childContextOccurrenceId: string; selectionId: string;
  fields: Readonly<Record<string, PlannerJson>>;
  consumption: Readonly<{ kind: "NONE" }> | Readonly<{ kind: "ITEMS"; main: ComponentSelectionV1; extras: readonly ComponentSelectionV1[] }>;
}>;
export type BeforeMomentRemoval = Readonly<{
  version: "before-moment-remove@v1"; expectedStateDigest: string;
  parentContextOccurrenceId: string; childContextOccurrenceId: string; selectionId: string;
}>;
export function parseBeforeMoment(raw: unknown): BeforeMoment {
  const value = plannerRecord(raw); plannerKeys(value, ["version", "consumption"]);
  if (typeof value.version !== "string" || value.version !== "before-moment@v1"
    || typeof value.consumption !== "string" || value.consumption !== "NONE" && value.consumption !== "ITEMS")
    throw new TypeError("BEFORE_MOMENT_INVALID");
  return value as BeforeMoment;
}
export const beforeMoment = (context: PlannedContextState): BeforeMoment | null =>
  Object.hasOwn(context.fields, "beforeMoment") ? parseBeforeMoment(context.fields.beforeMoment) : null;

/** A moment removal is bound to the exact linked child and the complete Draft. */
export function beforeMomentRemoval(state: PlanSemanticStateV1, childId: string): BeforeMomentRemoval {
  validateBeforeMoments(state.contexts, state.targetMonth);
  const child = state.contexts.find(c => c.contextOccurrenceId === childId);
  if (!child || !beforeMoment(child)) throw new TypeError("BEFORE_MOMENT_OWNER_REQUIRED");
  const parent = state.contexts.find(c => c.contextOccurrenceId === child.parentContextOccurrenceId)!;
  const link = plannerRecord((parent.slotSelections.before.items as readonly PlannerJson[])[0]);
  return { version: "before-moment-remove@v1", expectedStateDigest: plannerDigest(state), parentContextOccurrenceId: parent.contextOccurrenceId,
    childContextOccurrenceId: child.contextOccurrenceId, selectionId: plannerString(link.selectionId) };
}

export function validateBeforeMomentRemoval(state: PlanSemanticStateV1, parent: PlannedContextState, raw: unknown): void {
  const command = plannerRecord(raw);
  plannerKeys(command, ["version", "expectedStateDigest", "parentContextOccurrenceId", "childContextOccurrenceId", "selectionId"]);
  if (command.version !== "before-moment-remove@v1") throw new TypeError("BEFORE_MOMENT_COMMAND_INVALID");
  const parentId = plannerUuid(command.parentContextOccurrenceId), childId = plannerUuid(command.childContextOccurrenceId);
  plannerUuid(command.selectionId);
  const selectionId = command.selectionId;
  const child = state.contexts.find(c => c.contextOccurrenceId === childId), links = parent.slotSelections.before?.items;
  const link = Array.isArray(links) && links.length === 1 ? plannerRecord(links[0]) : null;
  if (parentId !== parent.contextOccurrenceId || !child || !beforeMoment(child) || child.parentContextOccurrenceId !== parentId
    || !link || link.kind !== "CHILD_CONTEXT" || link.childContextOccurrenceId !== childId || link.selectionId !== selectionId)
    throw new TypeError("BEFORE_MOMENT_REMOVAL_TARGET_INVALID");
  if (command.expectedStateDigest !== plannerDigest(state)) throw new TypeError("BEFORE_MOMENT_STALE");
}

/** Shared removal command for the editor and its existing trash gesture. */
export function removeBeforeMomentItem(state: PlanSemanticStateV1, childId: string, selectionId: string): BeforeMomentEdit {
  validateBeforeMoments(state.contexts, state.targetMonth);
  const child = state.contexts.find(c => c.contextOccurrenceId === childId);
  if (!child || !beforeMoment(child)) throw new TypeError("BEFORE_MOMENT_OWNER_REQUIRED");
  const parent = state.contexts.find(c => c.contextOccurrenceId === child.parentContextOccurrenceId)!;
  const link = plannerRecord((parent.slotSelections.before.items as readonly PlannerJson[])[0]);
  const main = items(child, "main") as ComponentSelectionV1[], extras = items(child, "extras") as ComponentSelectionV1[];
  if (![...main, ...extras].some(item => item.selectionId === selectionId)) throw new TypeError("BEFORE_MOMENT_ITEM_MISSING");
  const retainedMain = main.find(item => item.selectionId !== selectionId), remaining = extras.filter(item => item.selectionId !== selectionId);
  const promoted = retainedMain ?? (remaining[0] ? { ...remaining[0], optionKey: "activity" } : null);
  return { version: "before-moment-edit@v1", expectedStateDigest: plannerDigest(state), childContextOccurrenceId: childId,
    selectionId: plannerString(link.selectionId), fields: {}, consumption: promoted
      ? { kind: "ITEMS", main: promoted, extras: retainedMain ? remaining : remaining.slice(1) } : { kind: "NONE" } };
}
const items = (context: PlannedContextState, key: string) => {
  const wrapper = plannerRecord(context.slotSelections[key]); plannerKeys(wrapper, ["items"]);
  if (!Array.isArray(wrapper.items)) throw new TypeError("BEFORE_MOMENT_ITEMS_INVALID");
  return wrapper.items;
};

/** Snapshot invariant, before any structural default or economic coverage is derived.
 * A label never qualifies an activity for this exception. */
export function validateBeforeMoments(contexts: readonly PlannedContextState[], targetMonth?: string): void {
  for (const child of contexts) {
    const marker = beforeMoment(child);
    if (!marker) {
      if (child.fields.fieldSchemaVersion === "context-fields@v7") throw new TypeError("BEFORE_MOMENT_REQUIRED");
      continue;
    }
    const parent = contexts.find(c => c.contextOccurrenceId === child.parentContextOccurrenceId);
    const links = contexts.flatMap(c => Object.entries(c.slotSelections).flatMap(([slot, wrapper]) =>
      Array.isArray(wrapper.items) ? wrapper.items.flatMap(raw => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.kind !== "CHILD_CONTEXT"
          || raw.childContextOccurrenceId !== child.contextOccurrenceId) return [];
        return [{ parent: c, slot, link: raw }];
      }) : []));
    const owned = links[0];
    if (child.templateKey !== "activity" || child.fields.fieldSchemaVersion !== "context-fields@v7"
      || !parent || parent.templateKey !== "night-out" || presetForContext(parent)?.presetKey !== "bar-apero"
      || links.length !== 1 || owned.parent !== parent || owned.slot !== "before"
      || !Array.isArray(parent.slotSelections.before?.items) || parent.slotSelections.before.items.length !== 1 || owned.link.optionKey !== "activity"
      || owned.link.provenance !== "EXPLICIT_USER_DECISION" || child.provenance !== "EXPLICIT_USER_DECISION")
      throw new TypeError("BEFORE_MOMENT_OWNER_INVALID");
    plannerUuid(child.contextOccurrenceId); plannerUuid(owned.link.selectionId);
    plannerKeys(plannerRecord(child.slotSelections), ["main", "extras", "transport"], ["main", "extras"]);
    plannerKeys(plannerRecord(child.fields), ["fieldSchemaVersion", "beforeMoment", "label", "plannedDate", "placeRef", "participantRefs", "composerPresentation"], ["fieldSchemaVersion", "beforeMoment"]);
    if (child.fields.label != null) plannerString(child.fields.label);
    if (child.fields.plannedDate != null) {
      const date = plannerString(child.fields.plannedDate);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || targetMonth && !date.startsWith(targetMonth + "-")
        || !Number.isFinite(Date.parse(date + "T12:00:00Z")) || new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date)
        throw new TypeError("PLANNER_CONTEXT_DATE_INVALID");
    }
    if (child.fields.placeRef != null) {
      const place = plannerRecord(child.fields.placeRef);
      if (place.kind === "KNOWN") { plannerKeys(place, ["kind", "placeId"]); plannerUuid(place.placeId); }
      else {
        plannerKeys(place, ["kind", "label", "provenance"], ["kind", "label"]);
        if (place.kind !== "TEXT" || place.provenance !== undefined && place.provenance !== "USER_DECLARED_PROSPECTIVE") throw new TypeError("CONTEXT_MOBILITY_PLACE_INVALID");
        plannerString(place.label);
      }
    }
    if (child.fields.participantRefs != null) {
      const people = child.fields.participantRefs;
      if (!Array.isArray(people) || people.length > 50 || new Set(people.map(plannerDigest)).size !== people.length) throw new TypeError("CONTEXT_PARTICIPANTS_INVALID");
      for (const raw of people) {
        const person = plannerRecord(raw);
        if (person.kind === "HOUSEHOLD_PERSON") { plannerKeys(person, ["kind", "personId"]); plannerUuid(person.personId); }
        else if (person.kind === "CONTACT") {
          plannerKeys(person, ["kind", "contactKey"]);
          if (!SOCIAL_CONTACTS_V1.some(p => p.key === person.contactKey)) throw new TypeError("CONTEXT_CONTACT_UNKNOWN");
        } else { plannerKeys(person, ["kind", "label"]); if (person.kind !== "TEXT") throw new TypeError("CONTEXT_PERSON_REF_INVALID"); plannerString(person.label); }
      }
    }
    const main = items(child, "main"), extras = items(child, "extras");
    if (child.slotSelections.transport) for (const raw of items(child, "transport")) {
      const transport = plannerRecord(raw);
      if (!["MOBILITY_INTENT", "UNRESOLVED"].includes(String(transport.kind))) throw new TypeError("BEFORE_MOMENT_TRANSPORT_INVALID");
    }
    if (marker.consumption === "NONE") {
      if (main.length || extras.length) throw new TypeError("BEFORE_MOMENT_NONE_NOT_EMPTY");
    } else {
      if (main.length !== 1 || extras.length > 500) throw new TypeError("BEFORE_MOMENT_ITEMS_INVALID");
      const ids = new Set<string>();
      for (const [slot, values] of [["main", main], ["extras", extras]] as const) for (const raw of values) {
        const item = plannerRecord(raw), id = plannerString(item.selectionId);
        if (item.kind !== "COMPONENT" || item.optionKey !== (slot === "main" ? "activity" : "extra")
          || item.provenance !== "EXPLICIT_USER_DECISION" || ids.has(id)) throw new TypeError("BEFORE_MOMENT_ITEMS_INVALID");
        plannerKeys(item, ["kind", "optionKey", "selectionId", "provenance", "label", "quantity", "cost", "binding", "fundingAllocations", "unitBasis", "quantityEvidenceVersion", "quantityPerPerson", "pricedParticipantCount", "productAssetRef"],
          ["kind", "optionKey", "selectionId", "provenance", "label", "quantity", "cost"]);
        plannerString(item.label);
        const quantity = decisionAmount(item.quantity);
        if (item.unitBasis !== undefined && !["ITEM", "PERSON", "SHARED"].includes(String(item.unitBasis))) throw new TypeError("CONTEXT_UNIT_BASIS_INVALID");
        validateComponentQuantity(quantity, item.unitBasis, item.quantityEvidenceVersion, item.quantityPerPerson, item.pricedParticipantCount);
        parseKernelCost(item.cost); parseKernelFunding(item.fundingAllocations ?? []);
        if (item.binding !== undefined) {
          const binding = plannerRecord(item.binding); plannerKeys(binding, ["mode"]);
          if (!["AUTO", "CONFIRMED_CONSUMPTION", "EXTRA_TO_SLOT", "NO_RELATED_SLOT"].includes(String(binding.mode))) throw new TypeError("CONTEXT_BINDING_DECISION_INVALID");
        }
        if (item.productAssetRef !== undefined) {
          const ref = plannerRecord(item.productAssetRef); plannerKeys(ref, ["catalogVersion", "assetKey", "labelAtSelection", "provenance"]);
          const asset = plannedAsset(plannerString(ref.assetKey));
          if (!asset || !["bar", "club", "house_party"].includes(asset.module) || ref.catalogVersion !== PLANNED_ASSET_CATALOG_VERSION
            || ref.labelAtSelection !== asset.label || ref.provenance !== "EXPLICIT_USER_DECISION") throw new TypeError("CONTEXT_PRODUCT_ASSET_UNKNOWN");
        }
        ids.add(id);
      }
    }
  }
}

/** Only call on a validated snapshot. Ordinary/legacy activity slots are unchanged. */
export function beforeMomentSlot<T extends Pick<ComponentSlotDefinition, "slotKey" | "cardinality">>(context: PlannedContextState, slot: T): T {
  return context.templateKey === "activity" && slot.slotKey === "main" && beforeMoment(context)?.consumption === "NONE"
    ? { ...slot, cardinality: "OPTIONAL_ONE" } : slot;
}

/** GLOBAL changes economic activation, even though the stored child stays intact. */
export function assertMarkedBeforeConsumptionWritable(state: PlanSemanticStateV1, parent: PlannedContextState): void {
  for (const child of state.contexts.filter(c => c.parentContextOccurrenceId === parent.contextOccurrenceId && beforeMoment(c))) {
    assertBeforeOwnerWritable(state, parent);
    assertBeforeWritable(state, child, { ...child, slotSelections: { ...child.slotSelections, main: { items: [] }, extras: { items: [] } } });
  }
}

export function assertBeforeOwnerWritable(state: PlanSemanticStateV1, parent: PlannedContextState): void {
  const refs = [parent.contextOccurrenceId, `${parent.contextOccurrenceId}:before`,
    ...(Array.isArray(parent.slotSelections.before?.items) ? parent.slotSelections.before.items.map(raw =>
      componentId(parent.contextOccurrenceId, "before", plannerString(plannerRecord(raw).selectionId))) : [])];
  if (refs.some(ref => state.preferences.anchors.includes(ref) || state.preferences.flexibility[ref] === "PRESERVE"))
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
}

export function assertBeforeWritable(state: PlanSemanticStateV1, prior: PlannedContextState, next?: PlannedContextState): void {
  const locked = (ref: string) => state.preferences.anchors.includes(ref) || state.preferences.flexibility[ref] === "PRESERVE";
  if (locked(prior.contextOccurrenceId)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  for (const [slot, wrapper] of Object.entries(prior.slotSelections)) {
    if (plannerDigest(wrapper) === plannerDigest(next?.slotSelections[slot] ?? null)) continue;
    if (locked(`${prior.contextOccurrenceId}:${slot}`)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
    for (const raw of Array.isArray(wrapper.items) ? wrapper.items : []) {
      const item = plannerRecord(raw), ref = componentId(prior.contextOccurrenceId, slot, plannerString(item.selectionId));
      const kept = next?.slotSelections[slot]?.items;
      const matching = Array.isArray(kept) ? kept.find(raw => raw && typeof raw === "object" && !Array.isArray(raw) && raw.selectionId === item.selectionId) : null;
      if (locked(ref) && plannerDigest(item) !== plannerDigest(matching ?? null)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
    }
  }
  if (!next) for (const child of state.contexts.filter(c => c.parentContextOccurrenceId === prior.contextOccurrenceId))
    assertBeforeWritable(state, child);
}

/** Owner admission shared by local staging and the server. Snapshot reads/history
 * are validated independently and never silently adopt this marker. */
export function validateBeforeTransition(before: PlanSemanticStateV1, after: PlanSemanticStateV1,
  admission?: { contextOccurrenceId: string; before?: unknown }): void {
  validateBeforeMoments(after.contexts, after.targetMonth);
  for (const id of new Set([...before.contexts, ...after.contexts].filter(c => beforeMoment(c)).map(c => c.contextOccurrenceId))) {
    const prior = before.contexts.find(c => c.contextOccurrenceId === id), next = after.contexts.find(c => c.contextOccurrenceId === id);
    const parentId = prior?.parentContextOccurrenceId ?? next?.parentContextOccurrenceId;
    const oldLink = before.contexts.find(c => c.contextOccurrenceId === prior?.parentContextOccurrenceId)?.slotSelections.before ?? null;
    const newLink = after.contexts.find(c => c.contextOccurrenceId === next?.parentContextOccurrenceId)?.slotSelections.before ?? null;
    if (prior && next && (prior.parentContextOccurrenceId !== next.parentContextOccurrenceId || plannerDigest(oldLink) !== plannerDigest(newLink)))
      throw new TypeError("BEFORE_MOMENT_IDENTITY_CHANGED");
    if (plannerDigest(prior ?? null) === plannerDigest(next ?? null)) continue;
    const command = admission?.before;
    const owner = admission?.contextOccurrenceId === parentId && !!command && typeof command === "object" && "version" in command
      && (command.version === "before-moment-edit@v1" || command.version === "before-moment-remove@v1");
    // Preserve the existing explicit parent removal cascade, under its protections.
    const cascade = !next && !!parentId && !after.contexts.some(c => c.contextOccurrenceId === parentId);
    if (!owner && !cascade) throw new TypeError("BEFORE_MOMENT_OWNER_REQUIRED");
    if (prior) {
      const parent = before.contexts.find(c => c.contextOccurrenceId === prior.parentContextOccurrenceId);
      if (parent) assertBeforeOwnerWritable(before, parent);
      assertBeforeWritable(before, prior, next);
    }
  }
}
