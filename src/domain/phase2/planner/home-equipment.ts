import { componentId } from "./identity";
import { plannerDigest, plannerKeys, plannerRecord, plannerString, plannerUuid } from "./json";
import { editPurchaseBasket, isPurchaseBasket, purchaseComponents } from "./purchase-basket";
import { parsePlanSemanticState, type PlannedContextState, type PlanSemanticStateV1 } from "./semantic-state";
import type { ComponentSelectionV1 } from "./component-contract";

export const HOME_EQUIPMENT_FIELD = "homeEquipment";
const MAX_EQUIPMENT = 100;
type EquipmentStatus = "OWNED" | "NEEDED";
export type HomeEquipment = Readonly<{ id: string; label: string; status: EquipmentStatus }>;
export type HomeEquipmentEdit = Readonly<{
  contextOccurrenceId: string;
  expectedContextDigest: string;
  change: { kind: "SET"; equipment: HomeEquipment }
    | { kind: "REMOVE"; id: string }
    | { kind: "BUY"; id: string; basketId: string; expectedBasketDigest: string };
}>;

export function homeEquipmentKey(label: string) {
  const key = label.normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return key === "lampe domestique" ? "lampe" : key;
}

function parseEquipment(raw: unknown): HomeEquipment {
  const item = plannerRecord(raw);
  plannerKeys(item, ["id", "label", "status"]);
  const label = plannerString(item.label).trim();
  if (!homeEquipmentKey(label) || label.length > 120 || (item.status !== "OWNED" && item.status !== "NEEDED"))
    throw new TypeError("HOME_EQUIPMENT_INVALID");
  return { id: plannerUuid(item.id), label, status: item.status };
}

export function parseHomeEquipment(raw: unknown): readonly HomeEquipment[] {
  const block = plannerRecord(raw);
  plannerKeys(block, ["version", "items"]);
  if (block.version !== "home-equipment@v1" || !Array.isArray(block.items) || block.items.length > MAX_EQUIPMENT)
    throw new TypeError("HOME_EQUIPMENT_INVALID");
  const items = block.items.map(parseEquipment);
  if (new Set(items.map(item => item.id)).size !== items.length
    || new Set(items.map(item => homeEquipmentKey(item.label))).size !== items.length)
    throw new TypeError("HOME_EQUIPMENT_DUPLICATE");
  return items;
}

export function homeEquipment(context: Pick<PlannedContextState, "templateKey" | "fields">) {
  return context.templateKey === "home-project" && context.fields[HOME_EQUIPMENT_FIELD] !== undefined
    ? parseHomeEquipment(context.fields[HOME_EQUIPMENT_FIELD]) : [];
}

export function homeEquipmentBaskets(state: PlanSemanticStateV1, project: PlannedContextState) {
  const ids = new Set(((project.slotSelections.purchases?.items ?? []) as readonly ComponentSelectionV1[])
    .flatMap(item => item.kind === "CHILD_CONTEXT" ? [item.childContextOccurrenceId] : []));
  return state.contexts.filter(context => context.parentContextOccurrenceId === project.contextOccurrenceId
    && ids.has(context.contextOccurrenceId) && isPurchaseBasket(context));
}

export function homeEquipmentPurchases(baskets: readonly PlannedContextState[], equipment: { id?: string; label: string }) {
  return baskets.flatMap(basket => purchaseComponents(basket, "item")
    .filter(line => line.selectionId === equipment.id || homeEquipmentKey(line.label) === homeEquipmentKey(equipment.label))
    .map(line => ({ basket, line })));
}

export function homeLegacyEquipment(context: PlannedContextState) {
  return ((context.slotSelections.items?.items ?? []) as readonly ComponentSelectionV1[])
    .filter(item => item.kind === "COMPONENT");
}

export function addsHomeEquipmentCost(context: PlannedContextState, slotKey: string, items: readonly ComponentSelectionV1[]) {
  if (context.templateKey !== "home-project" || slotKey !== "items") return false;
  const existing = new Set(homeLegacyEquipment(context).map(item => item.selectionId));
  return items.some(item => item.kind === "COMPONENT" && !existing.has(item.selectionId));
}

const locked = (state: PlanSemanticStateV1, id: string) =>
  state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE";

/** Equipment notes belong to the project. Only the existing basket owner creates a financial line. */
export function editHomeEquipment(state: PlanSemanticStateV1, edit: HomeEquipmentEdit): PlanSemanticStateV1 {
  const id = plannerUuid(edit.contextOccurrenceId);
  const project = state.contexts.find(context => context.contextOccurrenceId === id && context.templateKey === "home-project");
  if (!project || locked(state, id)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  if (plannerDigest(project) !== edit.expectedContextDigest) throw new TypeError("HOME_EQUIPMENT_CHANGED");
  const change = edit.change;
  const items = homeEquipment(project);
  const baskets = homeEquipmentBaskets(state, project);

  if (change.kind === "BUY") {
    const item = items.find(equipment => equipment.id === change.id && equipment.status === "NEEDED");
    const basket = baskets.find(context => context.contextOccurrenceId === change.basketId);
    if (!item || !basket) throw new TypeError("HOME_EQUIPMENT_CHANGED");
    if (homeEquipmentPurchases(baskets, item).length) throw new TypeError("HOME_EQUIPMENT_DUPLICATE");
    return parsePlanSemanticState(editPurchaseBasket(state, {
      contextOccurrenceId: basket.contextOccurrenceId, expectedContextDigest: change.expectedBasketDigest,
      change: { kind: "SAVE_ITEM", selectionId: item.id, label: item.label, quantity: "1", unit: "UNIT", price: "" },
    }));
  }

  let next: readonly HomeEquipment[];
  const slotSelections = { ...project.slotSelections };
  if (change.kind === "SET") {
    const item = parseEquipment(change.equipment);
    const legacy = homeLegacyEquipment(project).find(line => line.selectionId === item.id);
    const prior = items.find(previous => previous.id === item.id);
    if (prior && homeEquipmentPurchases(baskets, prior).length) throw new TypeError("HOME_EQUIPMENT_IN_BASKET");
    if (item.status === "OWNED" && homeEquipmentPurchases(baskets, item).length)
      throw new TypeError("HOME_EQUIPMENT_IN_BASKET");
    if (!legacy && homeLegacyEquipment(project).some(line => homeEquipmentKey(line.label) === homeEquipmentKey(item.label)))
      throw new TypeError("HOME_EQUIPMENT_DUPLICATE");
    if (legacy) {
      if (locked(state, componentId(id, "items", legacy.selectionId))) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      const remaining = (slotSelections.items.items as readonly ComponentSelectionV1[])
        .filter(line => line.selectionId !== legacy.selectionId);
      slotSelections.items = { ...slotSelections.items, items: remaining };
    }
    next = prior ? items.map(previous => previous.id === item.id ? item : previous) : [...items, item];
  } else if (change.kind === "REMOVE") {
    const prior = items.find(item => item.id === plannerUuid(change.id));
    if (!prior) throw new TypeError("HOME_EQUIPMENT_CHANGED");
    if (homeEquipmentPurchases(baskets, prior).length) throw new TypeError("HOME_EQUIPMENT_IN_BASKET");
    next = items.filter(item => item !== prior);
  } else throw new TypeError("HOME_EQUIPMENT_INVALID");

  const fields = { ...project.fields };
  if (next.length) {
    const block = { version: "home-equipment@v1", items: next };
    parseHomeEquipment(block);
    fields[HOME_EQUIPMENT_FIELD] = block;
  } else delete fields[HOME_EQUIPMENT_FIELD];
  return parsePlanSemanticState({ ...state, contexts: state.contexts.map(context =>
    context === project ? { ...context, fields, slotSelections } : context) });
}
