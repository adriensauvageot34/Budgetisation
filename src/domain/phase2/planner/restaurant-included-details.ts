import { decisionAmount } from "../month-decision-contract";
import { canonicalPlannerJson, plannerKeys, plannerRecord, plannerString, plannerUuid } from "./json";
import { componentId } from "./identity";
import type { PlannedContextState, PlanSemanticStateV1 } from "./semantic-state";

export type RestaurantIncludedDetail = Readonly<{
  detailId: string; label: string; included: true; quantity: string | null;
  unitBasis: "ITEM" | "PERSON" | "SHARED" | null;
  amount: Readonly<{ kind: "DECLARED_LINE_TOTAL"; value: string }> | Readonly<{ kind: "UNKNOWN" }>;
  provenance: "EXPLICIT_USER_DECISION";
}>;
export type RestaurantIncludedDetailsV1 = Readonly<{
  version: "restaurant-included-details@v1"; mealSelectionId: string; items: readonly RestaurantIncludedDetail[];
}>;
export type RestaurantDetailsDecision = "KEEP_CONFIRMED" | "REMOVE_ALL";
export type RestaurantDetailsAdmission = Readonly<{
  contextOccurrenceId: string; includedDetailsAfterMealChange?: RestaurantDetailsDecision;
}>;

export function parseRestaurantIncludedDetails(raw: unknown): RestaurantIncludedDetailsV1 {
  const block = plannerRecord(raw); plannerKeys(block, ["version", "mealSelectionId", "items"]);
  if (block.version !== "restaurant-included-details@v1" || !Array.isArray(block.items)
    || !block.items.length || block.items.length > 10000) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_INVALID");
  const items = block.items.map((rawItem): RestaurantIncludedDetail => {
    const item = plannerRecord(rawItem);
    plannerKeys(item, ["detailId", "label", "included", "quantity", "unitBasis", "amount", "provenance"]);
    if (item.included !== true || item.provenance !== "EXPLICIT_USER_DECISION"
      || !([null, "ITEM", "PERSON", "SHARED"] as readonly unknown[]).includes(item.unitBasis))
      throw new TypeError("RESTAURANT_INCLUDED_DETAILS_INVALID");
    const quantity = item.quantity === null ? null : decisionAmount(item.quantity);
    if (quantity !== null && !/[1-9]/u.test(quantity)) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_INVALID");
    const amount = plannerRecord(item.amount);
    if (amount.kind === "UNKNOWN") plannerKeys(amount, ["kind"]);
    else { plannerKeys(amount, ["kind", "value"]);
      if (amount.kind !== "DECLARED_LINE_TOTAL") throw new TypeError("RESTAURANT_INCLUDED_DETAILS_INVALID");
      decisionAmount(amount.value);
    }
    return { detailId: plannerUuid(item.detailId), label: plannerString(item.label), included: true, quantity,
      unitBasis: item.unitBasis as RestaurantIncludedDetail["unitBasis"],
      amount: amount.kind === "UNKNOWN" ? { kind: "UNKNOWN" } : { kind: "DECLARED_LINE_TOTAL", value: amount.value as string },
      provenance: "EXPLICIT_USER_DECISION" };
  });
  if (new Set(items.map(item => item.detailId)).size !== items.length) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_INVALID");
  return { version: "restaurant-included-details@v1", mealSelectionId: plannerString(block.mealSelectionId), items };
}

function meal(context: PlannedContextState) {
  const items = context.slotSelections.meal?.items;
  if (!Array.isArray(items) || items.length !== 1) return null;
  const item = plannerRecord(items[0]);
  return item.kind === "COMPONENT" && item.optionKey === "restaurant" ? item : null;
}

export function restaurantIncludedDetails(context: PlannedContextState): RestaurantIncludedDetailsV1 | null {
  if (!Object.hasOwn(context.fields, "restaurantIncludedDetails")) return null;
  if (context.templateKey !== "restaurant") throw new TypeError("RESTAURANT_INCLUDED_DETAILS_OWNER_INVALID");
  const block = parseRestaurantIncludedDetails(context.fields.restaurantIncludedDetails), parent = meal(context);
  if (!parent || parent.selectionId !== block.mealSelectionId) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_PARENT_INVALID");
  return block;
}

/** Compare declared tariff parameters only. This never calculates an economic total. */
export function restaurantMealTariff(context: PlannedContextState): string {
  const parent = meal(context);
  return canonicalPlannerJson(parent ? Object.fromEntries(
    ["selectionId", "cost", "quantity", "unitBasis", "quantityEvidenceVersion", "quantityPerPerson", "pricedParticipantCount"]
      .filter(key => Object.hasOwn(parent, key)).map(key => [key, parent[key]])) : null);
}

export function assertRestaurantDetailsWritable(state: PlanSemanticStateV1, context: PlannedContextState): void {
  const parent = meal(context);
  const refs = [context.contextOccurrenceId, ...(parent && typeof parent.selectionId === "string"
    ? [componentId(context.contextOccurrenceId, "meal", parent.selectionId)] : [])];
  if (refs.some(ref => state.preferences.anchors.includes(ref) || state.preferences.flexibility[ref] === "PRESERVE"))
    throw new TypeError("COMPOSER_CONTEXT_LOCKED");
}

/** Shared owner guard for local and server admission, including generic socket mutations.
 * Reads / history restoration validate snapshots separately; they are not new edit commands.
 */
export function validateRestaurantDetailsTransition(before: PlanSemanticStateV1, after: PlanSemanticStateV1,
  admission?: RestaurantDetailsAdmission): void {
  for (const next of after.contexts) {
    const previous = before.contexts.find(context => context.contextOccurrenceId === next.contextOccurrenceId);
    const oldBlock = previous ? restaurantIncludedDetails(previous) : null, nextBlock = restaurantIncludedDetails(next);
    const changed = canonicalPlannerJson(oldBlock) !== canonicalPlannerJson(nextBlock);
    const owner = admission?.contextOccurrenceId === next.contextOccurrenceId;
    if (changed && !owner) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_OWNER_REQUIRED");
    if (changed || oldBlock && previous && canonicalPlannerJson(previous) !== canonicalPlannerJson(next))
      assertRestaurantDetailsWritable(before, previous ?? next);
    if (!oldBlock || !previous || restaurantMealTariff(previous) === restaurantMealTariff(next)) continue;
    const policy = owner ? admission?.includedDetailsAfterMealChange : undefined;
    if (!policy) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_REVIEW_REQUIRED");
    if (policy === "REMOVE_ALL") {
      if (nextBlock) throw new TypeError("RESTAURANT_INCLUDED_DETAILS_INVALID");
    } else if (policy !== "KEEP_CONFIRMED" || !nextBlock || meal(next)?.selectionId !== oldBlock.mealSelectionId)
      throw new TypeError("RESTAURANT_INCLUDED_DETAILS_PARENT_INVALID");
  }
}

