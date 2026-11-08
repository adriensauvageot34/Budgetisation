import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { declareComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { DropTarget } from "@/domain/phase2/planner/composer-contract";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import type { PlanSemanticStateV1, PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { publishedDrop } from "./interactions";

export type MascaraProduct = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
export const isMascaraContext = (context?: Pick<PlannedContextState, "templateKey" | "fields">) =>
  context?.templateKey === "beauty-restock" && presetForContext(context)?.presetKey === "mascara";

/** Resolves the existing Beauty owner and its published products socket, never a name match. */
export function mascaraEquipment(model: ComposerUiModel, state: PlanSemanticStateV1, contextOccurrenceId: string, expected?: ComponentSelectionV1) {
  const context = state.contexts.find(item => item.contextOccurrenceId === contextOccurrenceId);
  const card = model.board.contexts.find(item => item.contextOccurrenceId === contextOccurrenceId);
  const locked = (id: string) => state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE";
  if (!context || !isMascaraContext(context) || !card || !isMascaraContext(card) || card.readOnly
    || !card.capabilityRefs.includes("PATCH_CONTEXT") || locked(contextOccurrenceId)) return undefined;
  const socket = card.sockets.find(item => item.slotKey === "products" && item.contextOccurrenceId === contextOccurrenceId);
  const assetKey = "option:beauty-restock:products:product";
  const asset = model.library.searchableAssets.find(item => item.assetKey === assetKey && item.optionKind === "COMPONENT");
  const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId, slotKey: "products" };
  if (!socket || socket.cardinality !== "REPEATING" || !socket.capabilityRefs.includes("beauty-restock:products:SELECT_COMPONENT")
    || !socket.choiceAssetKeys?.includes(assetKey) || !asset || publishedDrop(model, assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return undefined;
  const items = (context.slotSelections.products?.items ?? []) as readonly ComponentSelectionV1[];
  const selection = items.find((item): item is MascaraProduct =>
    item.kind === "COMPONENT" && item.optionKey === "product" && item.selectionId === expected?.selectionId);
  if (expected && (!selection || locked(componentId(contextOccurrenceId, "products", expected.selectionId))
    || canonicalPlannerJson(selection) !== canonicalPlannerJson(expected))) return undefined;
  return { asset, target, items, selection };
}

export function editMascaraPriceAndQuantity(selection: MascaraProduct, quantityInput: string, priceInput: string, priceMode: MascaraProduct["cost"]["kind"]) {
  const units = quantityInput.trim().replace(",", ".");
  const price = priceInput.trim().replace(",", ".");
  let quantity: string, cost: MascaraProduct["cost"];
  try { quantity = declareComponentQuantity("TOTAL_UNITS", units).quantity; }
  catch { throw Error("Indiquez une quantité supérieure à zéro, avec deux décimales au plus."); }
  try {
    cost = priceMode === "QUOTE" && selection.cost.kind === "QUOTE" ? selection.cost
      : priceMode === "UNKNOWN" ? { kind: "UNKNOWN" } : { kind: "MANUAL", unitAmount: decisionAmount(price) };
  } catch { throw Error("Complétez le prix, par exemple 12,50, ou laissez-le inconnu."); }
  if (quantity === selection.quantity && cost.kind === selection.cost.kind
    && (cost.kind !== "MANUAL" || selection.cost.kind === "MANUAL" && cost.unitAmount === selection.cost.unitAmount)) return selection;
  return { ...selection, quantity, cost, provenance: "EXPLICIT_USER_DECISION" as const };
}
