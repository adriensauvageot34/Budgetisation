import { decisionAmount } from "../month-decision-contract";
import type { ComponentSelectionV1, ContextBindingDecision } from "./component-contract";
import { plannerDigest, plannerDigestString, plannerKeys, plannerRecord, plannerString, plannerUuid } from "./json";
import { componentId } from "./identity";
import type { PlannedContextState, PlanSemanticStateV1 } from "./semantic-state";

export const PURCHASE_BASKET_FIELDS = "context-fields@v7";
export const BASKET_UNITS = ["UNIT", "PACK", "KG", "L"] as const;
export const DELIVERY_MODES = ["UNKNOWN", "DELIVERY", "PICKUP", "IN_STORE"] as const;
export const DELIVERY_COVERAGES = ["UNKNOWN", "INCLUDED", "FREE", "ADDITIONAL"] as const;
export type BasketUnit = typeof BASKET_UNITS[number];
export type BasketDeliveryMode = typeof DELIVERY_MODES[number];
export type BasketDeliveryCoverage = typeof DELIVERY_COVERAGES[number];
export type BasketConcept = Readonly<{ id: string; label: string }>;
export type BasketArticle = Readonly<{ unit: BasketUnit; concept?: BasketConcept }>;
export type PurchaseComponent = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;

export type PurchaseBasketChange =
  | { kind: "UPGRADE" }
  | { kind: "SAVE_ITEM"; selectionId: string; label: string; quantity: string; unit: BasketUnit; price: string; concept?: BasketConcept }
  | { kind: "REMOVE_ITEM"; selectionId: string }
  | { kind: "SAVE_EXTRA"; selectionId: string; label: string; price: string }
  | { kind: "REMOVE_EXTRA"; selectionId: string }
  | { kind: "SET_DETAILS"; merchant: string; date: string; coverage: "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" }
  | { kind: "SET_DELIVERY"; mode: BasketDeliveryMode; coverage: BasketDeliveryCoverage; selectionId?: string; price?: string };
export type PurchaseBasketEdit = Readonly<{ contextOccurrenceId: string; expectedContextDigest: string; change: PurchaseBasketChange }>;
export const isPurchaseBasket = (context: Pick<PlannedContextState, "templateKey" | "fields">) =>
  context.templateKey === "purchase" && context.fields.fieldSchemaVersion === PURCHASE_BASKET_FIELDS;
export const purchaseComponents = (context: PlannedContextState, slot: string): readonly PurchaseComponent[] =>
  ((context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[]).filter(
    (item): item is PurchaseComponent => item.kind === "COMPONENT");
export const legacyDeliveryFee = (item: PurchaseComponent) => /^(?:frais de )?livraison$/iu.test(item.label.trim());
export const MAX_PURCHASE_ARTICLES = 500;

function oneOf<const T extends string>(values: readonly T[], value: unknown): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new TypeError("PURCHASE_BASKET_CHOICE_INVALID");
  return value as T;
}
export function readBasketArticle(raw: unknown, quantity: string): BasketArticle {
  const value = plannerRecord(raw);
  plannerKeys(value, ["unit", "concept"], ["unit"]);
  const unit = oneOf(BASKET_UNITS, value.unit);
  if ((unit === "UNIT" || unit === "PACK") && !/^\d+(?:\.0+)?$/u.test(quantity))
    throw new TypeError("PURCHASE_BASKET_WHOLE_QUANTITY_REQUIRED");
  if (value.concept === undefined) return { unit };
  const concept = plannerRecord(value.concept);
  plannerKeys(concept, ["id", "label"]);
  const id = plannerString(concept.id);
  if (!/^v22-art:excel:\d+$/u.test(id)) throw new TypeError("PURCHASE_BASKET_CONCEPT_INVALID");
  return { unit, concept: { id, label: plannerString(concept.label) } };
}

/** One command changes one line, or a declared basket property. The Compiler owns all totals. */
export function editPurchaseBasket(state: PlanSemanticStateV1, edit: PurchaseBasketEdit): PlanSemanticStateV1 {
  const target = plannerUuid(edit.contextOccurrenceId);
  const context = state.contexts.find(item => item.contextOccurrenceId === target);
  if (!context || context.templateKey !== "purchase") throw new TypeError("PURCHASE_BASKET_TARGET_INVALID");
  const locked = (ref: string) => state.preferences.anchors.includes(ref) || state.preferences.flexibility[ref] === "PRESERVE";
  if (locked(target)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  if (plannerDigestString(edit.expectedContextDigest) !== plannerDigest(context)) throw new TypeError("PURCHASE_BASKET_CHANGED");
  const change = edit.change, fields = { ...context.fields }, slots = { ...context.slotSelections };
  const articles = purchaseComponents(context, "item"), fees = purchaseComponents(context, "shipping");
  const assertWritable = (slot: string, id: string) => {
    if (locked(componentId(target, slot, id))) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
  };
  if (change.kind === "UPGRADE") {
    if (isPurchaseBasket(context)) throw new TypeError("PURCHASE_BASKET_CHANGED");
    fields.fieldSchemaVersion = PURCHASE_BASKET_FIELDS;
    if (!articles.length) delete slots.item;
  } else {
    if (!isPurchaseBasket(context)) throw new TypeError("PURCHASE_BASKET_VERSION_REQUIRED");
    switch (change.kind) {
      case "SAVE_ITEM": {
        const id = plannerUuid(change.selectionId);
        const previous = articles.find(item => item.selectionId === id);
        if (!previous && articles.length >= MAX_PURCHASE_ARTICLES) throw new TypeError("PURCHASE_BASKET_LIMIT");
        assertWritable("item", id);
        const quantity = decisionAmount(change.quantity.trim().replace(",", "."));
        if (Number(quantity) <= 0) throw new TypeError("PURCHASE_BASKET_QUANTITY_INVALID");
        const label = plannerString(change.label.trim());
        const price = change.price.trim().replace(",", ".");
        const concept = previous?.basketArticle?.concept ?? change.concept;
        if (previous && change.concept && (!concept || plannerDigest(concept) !== plannerDigest(change.concept)))
          throw new TypeError("PURCHASE_BASKET_CONCEPT_CHANGED");
        const basketArticle = readBasketArticle({ unit: change.unit, ...(concept ? { concept } : {}) }, quantity);
        const { quantityEvidenceVersion, quantityPerPerson, pricedParticipantCount, ...previousFields } = previous ?? {};
        const item: PurchaseComponent = { ...previousFields, selectionId: id, optionKey: "item", kind: "COMPONENT",
          label, quantity, unitBasis: change.unit === "PACK" ? "SHARED" : "ITEM", basketArticle,
          cost: price ? { kind: "MANUAL", unitAmount: decisionAmount(price) } : previous?.cost.kind === "QUOTE" ? previous.cost : { kind: "UNKNOWN" },
          provenance: "EXPLICIT_USER_DECISION" };
        slots.item = { items: previous ? articles.map(current => current === previous ? item : current) : [...articles, item] };
        break;
      }
      case "REMOVE_ITEM": {
        const id = plannerUuid(change.selectionId);
        assertWritable("item", id);
        if (!articles.some(item => item.selectionId === id)) throw new TypeError("PURCHASE_BASKET_CHANGED");
        slots.item = { items: articles.filter(item => item.selectionId !== id) };
        break;
      }
      case "SAVE_EXTRA":
      case "REMOVE_EXTRA": {
        const id = plannerUuid(change.selectionId);
        assertWritable("extras", id);
        const extras = purchaseComponents(context, "extras");
        const previous = extras.find(item => item.selectionId === id);
        if (change.kind === "REMOVE_EXTRA") {
          if (!previous) throw new TypeError("PURCHASE_BASKET_CHANGED");
          slots.extras = { items: extras.filter(item => item.selectionId !== id) };
          break;
        }
        if (!previous && extras.length >= 500) throw new TypeError("PURCHASE_BASKET_LIMIT");
        const label = plannerString(change.label.trim());
        const price = change.price.trim().replace(",", ".");
        const item: PurchaseComponent = { kind: "COMPONENT", optionKey: "extra", quantity: "1", unitBasis: "ITEM",
          ...previous, selectionId: id, label, cost: price ? { kind: "MANUAL", unitAmount: decisionAmount(price) }
            : previous?.cost.kind === "QUOTE" ? previous.cost : { kind: "UNKNOWN" }, provenance: "EXPLICIT_USER_DECISION" };
        if (legacyDeliveryFee(item) && (!previous || !legacyDeliveryFee(previous))) throw new TypeError("PURCHASE_BASKET_USE_DELIVERY");
        slots.extras = { items: previous ? extras.map(current => current === previous ? item : current) : [...extras, item] };
        break;
      }
      case "SET_DETAILS": {
        const merchant = change.merchant.trim();
        fields.merchantLabel = merchant ? plannerString(merchant) : null;
        if (change.date && (!/^\d{4}-\d{2}-\d{2}$/u.test(change.date) || !change.date.startsWith(state.targetMonth + "-")
          || !Number.isFinite(Date.parse(change.date)) || new Date(change.date).toISOString().slice(0, 10) !== change.date))
          throw new TypeError("PURCHASE_BASKET_DATE_INVALID");
        fields.plannedDate = change.date || null;
        const coverage: ContextBindingDecision["mode"] = oneOf(["AUTO", "CONFIRMED_CONSUMPTION", "EXTRA_TO_SLOT"], change.coverage);
        if (context.fields.budgetDomain === "groceries") fields.basketCoverage = coverage;
        else if (coverage !== "AUTO") throw new TypeError("PURCHASE_BASKET_COVERAGE_INVALID");
        break;
      }
      case "SET_DELIVERY": {
        const mode = oneOf(DELIVERY_MODES, change.mode);
        const coverage = oneOf(DELIVERY_COVERAGES, change.coverage);
        if (coverage !== "UNKNOWN" && purchaseComponents(context, "extras").some(legacyDeliveryFee))
          throw new TypeError("PURCHASE_BASKET_LEGACY_DELIVERY");
        if (fees[0]) assertWritable("shipping", fees[0].selectionId);
        fields.deliveryMode = mode;
        fields.deliveryCoverage = coverage;
        if (coverage === "ADDITIONAL") {
          const id = plannerUuid(change.selectionId);
          if (fees[0] && fees[0].selectionId !== id) throw new TypeError("PURCHASE_BASKET_CHANGED");
          assertWritable("shipping", id);
          const price = (change.price ?? "").trim().replace(",", ".");
          slots.shipping = { items: [{ kind: "COMPONENT", optionKey: "shipping", selectionId: id, label: "Frais de livraison",
            quantity: "1", unitBasis: "ITEM", cost: price ? { kind: "MANUAL", unitAmount: decisionAmount(price) } : { kind: "UNKNOWN" },
            provenance: "EXPLICIT_USER_DECISION" }] };
        } else {
          if (change.selectionId || change.price) throw new TypeError("PURCHASE_BASKET_DELIVERY_INVALID");
          slots.shipping = { items: [] };
        }
        break;
      }
      default: throw new TypeError("PURCHASE_BASKET_CHANGE_INVALID");
    }
  }
  return { ...state, contexts: state.contexts.map(item => item === context ? { ...context, fields, slotSelections: slots } : item) };
}
