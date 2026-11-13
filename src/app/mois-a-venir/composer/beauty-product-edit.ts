import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { declareComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { DropTarget } from "@/domain/phase2/planner/composer-contract";
import { presetForContext, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import type { PlanSemanticStateV1, PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { publishedDrop } from "./interactions";
import { rankDiscoveryCandidates } from "./catalog-discovery";

export type BeautyProduct = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
const productArtwork: Partial<Record<ComposerPresetKey, string>> = {
  mascara: "beauty:mascara",
  eyeliner: "beauty:eyeliner",
  "eyebrow-pencil": "beauty:eyebrow_pencil",
  "hair-wax": "beauty:hair_wax",
  "face-cleanser": "beauty:face_cleanser",
  "makeup-remover": "beauty:makeup_remover",
};

export function beautyProductPresentation(context?: Pick<PlannedContextState, "templateKey" | "fields">) {
  const preset = context?.templateKey === "beauty-restock" ? presetForContext(context) : undefined;
  const catalogAssetKey = preset && productArtwork[preset.presetKey];
  return preset && catalogAssetKey ? { key: preset.presetKey, label: preset.label, catalogAssetKey } : undefined;
}
export const isBeautyProductContext = (context?: Pick<PlannedContextState, "templateKey" | "fields">) => !!beautyProductPresentation(context);

/** Resolves the existing Beauty owner and its published products socket, never a name match. */
export function beautyProductEquipment(model: ComposerUiModel, state: PlanSemanticStateV1, contextOccurrenceId: string, expected?: ComponentSelectionV1) {
  const context = state.contexts.find(item => item.contextOccurrenceId === contextOccurrenceId);
  const card = model.board.contexts.find(item => item.contextOccurrenceId === contextOccurrenceId);
  const locked = (id: string) => state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE";
  if (!context || context.status !== "ACTIVE" || !isBeautyProductContext(context) || !card || !isBeautyProductContext(card) || card.readOnly
    || !card.capabilityRefs.includes("PATCH_CONTEXT") || locked(contextOccurrenceId)) return undefined;
  const socket = card.sockets.find(item => item.slotKey === "products" && item.contextOccurrenceId === contextOccurrenceId);
  const assetKey = "option:beauty-restock:products:product";
  const asset = model.library.searchableAssets.find(item => item.assetKey === assetKey && item.optionKind === "COMPONENT");
  const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId, slotKey: "products" };
  if (!socket || socket.cardinality !== "REPEATING" || !socket.capabilityRefs.includes("beauty-restock:products:SELECT_COMPONENT")
    || !socket.choiceAssetKeys?.includes(assetKey) || !asset || publishedDrop(model, assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return undefined;
  const items = (context.slotSelections.products?.items ?? []) as readonly ComponentSelectionV1[];
  const selection = items.find((item): item is BeautyProduct =>
    item.kind === "COMPONENT" && item.optionKey === "product" && item.selectionId === expected?.selectionId);
  if (expected && (!selection || !socket.currentItems.some(item => item.kind === "COMPONENT" && item.selectionId === expected.selectionId)
    || locked(componentId(contextOccurrenceId, "products", expected.selectionId))
    || canonicalPlannerJson(selection) !== canonicalPlannerJson(expected))) return undefined;
  return { asset, target, items, selection };
}

export function beautyProductSuggestions(context: PlannedContextState, model: ComposerUiModel) {
  const id = context.contextOccurrenceId;
  const presentation = beautyProductPresentation(context);
  const owner = beautyProductEquipment(model, model.semanticState, id);
  if (!presentation || !owner) return [];
  const prefix = `${id}:${presentation.key}`;
  const products = owner.items.filter((item): item is BeautyProduct => item.kind === "COMPONENT" && item.optionKey === "product");
  const editable = products.flatMap(product => {
    const route = beautyProductEquipment(model, model.semanticState, id, product);
    return route ? [{ product, route }] : [];
  });
  const candidates = editable.map(({ product, route }) => ({
    key: prefix + ":product:" + product.selectionId, label: product.cost.kind === "UNKNOWN" ? "Préciser le prix du produit" : "Modifier prix et quantité",
    hint: product.label + (products.length > 1 ? " · Poste " + (products.indexOf(product) + 1) : ""),
    tiers: [product.cost.kind === "UNKNOWN" ? 0 : 1], route,
  }));
  const actions = candidates.map(candidate => ({ ...candidate, kind: "PRODUCT" as const }));
  const add = !products.length ? [{
    key: prefix + ":add", label: "Préciser le produit", hint: "Produit et quantité à renseigner · éditeur",
    tiers: [0], route: owner, kind: "PRODUCT" as const,
  }] : [];
  const needs = model.editors.find(editor => editor.assetKey === owner.asset.assetKey)?.fields.find(field => field.key === "needOccurrenceId")?.choices ?? [];
  const renewals = products.flatMap(product => {
    if (!product.needOccurrenceId) return [];
    const need = needs.find(choice => choice.value === product.needOccurrenceId);
    return need ? [{
      key: prefix + ":need:" + product.selectionId + ":" + need.value, label: "Consulter le besoin lié",
      hint: product.label + " · besoin publié", tiers: [2], kind: "NEED" as const, caption: need.label,
    }] : [];
  });
  return rankDiscoveryCandidates([...add, ...actions, ...renewals]).map(candidate => ({
    ...candidate, iconKey: owner.asset.iconKey, catalogAssetKey: presentation.catalogAssetKey,
  }));
}

export function editBeautyProductPriceAndQuantity(selection: BeautyProduct, quantityInput: string, priceInput: string, priceMode: BeautyProduct["cost"]["kind"]) {
  const units = quantityInput.trim().replace(",", ".");
  const price = priceInput.trim().replace(",", ".");
  let quantity: string, cost: BeautyProduct["cost"];
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
