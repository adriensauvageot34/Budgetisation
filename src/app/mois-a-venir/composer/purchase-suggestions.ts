import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { componentId } from "@/domain/phase2/planner/identity";
import { isPurchaseBasket, legacyDeliveryFee, MAX_PURCHASE_ARTICLES, purchaseComponents, type PurchaseComponent } from "@/domain/phase2/planner/purchase-basket";
import { catalogRefLocked, normalizeCatalog, rankDiscoveryCandidates } from "./catalog-discovery";

export type PurchaseSuggestion = {
  key: string;
  kind: "ADD" | "ITEM" | "CHOOSE_ITEM" | "DETAILS" | "DELIVERY" | "LEGACY_FEE";
  label: string;
  hint: string;
  iconKey: string;
  visualConceptId?: string;
  selectionIds: readonly string[];
  tiers: readonly number[];
};

export function purchaseSuggestions(context: PlannedContextState, card: ComposerContextCardView, model: ComposerUiModel) {
  const id = context.contextOccurrenceId;
  if (!isPurchaseBasket(context) || !isPurchaseBasket(card) || context.status !== "ACTIVE" || card.contextOccurrenceId !== id
    || card.readOnly || card.externalIntentId !== null || !card.capabilityRefs.includes("PATCH_CONTEXT") || catalogRefLocked(model, id)) return [];

  const articles = purchaseComponents(context, "item");
  const groceries = context.fields.budgetDomain === "groceries";
  const clothing = context.fields.budgetDomain === "clothing";
  const iconKey = groceries ? "groceries" : clothing ? "clothing" : "purchase";
  const noun = groceries ? "produit" : "article";
  const candidates: PurchaseSuggestion[] = [];
  const offer = (kind: PurchaseSuggestion["kind"], label: string, hint: string, priority: number, ids: readonly string[] = [],
    visualConceptId?: string) => candidates.push({
    kind, label, hint, iconKey, visualConceptId, selectionIds: ids,
    key: [id, "purchase", kind, label, ...[...ids].sort()].join(":"), tiers: [priority],
  });
  const locked = (slot: string, selection: PurchaseComponent) => catalogRefLocked(model, componentId(id, slot, selection.selectionId));
  // Basket slots are owned by EDIT_PURCHASE_BASKET, including shipping, which has no generic drag asset.
  const slot = (key: string, option: string, cardinality: "REPEATING" | "OPTIONAL_ONE") =>
    card.sockets.find(socket => socket.contextOccurrenceId === id && socket.slotKey === key && socket.cardinality === cardinality
      && socket.capabilityRefs.includes("purchase:" + key + ":SELECT_COMPONENT")
      && socket.choiceAssetKeys?.includes("option:purchase:" + key + ":" + option));
  const itemSocket = slot("item", "item", "REPEATING");
  if (itemSocket) {
    const admitted = new Set(itemSocket.currentItems.filter(item => item.kind === "COMPONENT").map(item => item.selectionId));
    if (articles.length < MAX_PURCHASE_ARTICLES) {
      const label = clothing ? (articles.length ? "Ajouter un autre vêtement ou une chaussure" : "Préciser le vêtement ou la chaussure")
        : articles.length ? "Ajouter un " + noun : "Ajouter le premier " + noun;
      offer("ADD", label, "Saisie libre dans ce panier · éditeur", articles.length ? 3 : 0);
    }
    const groups = new Map<string, PurchaseComponent[]>();
    for (const article of articles) {
      const name = normalizeCatalog(article.label);
      const group = groups.get(name);
      if (group) group.push(article);
      else groups.set(name, [article]);
    }
    for (const group of groups.values()) {
      const editable = group.filter(item => !locked("item", item) && admitted.has(item.selectionId));
      const item = editable[0];
      if (!item) continue;
      const unknownPrice = editable.some(line => line.cost.kind === "UNKNOWN");
      const choose = editable.length > 1;
      offer(choose ? "CHOOSE_ITEM" : "ITEM",
        choose ? "Choisir la ligne · " + item.label : (unknownPrice ? "Préciser le prix · " : "Modifier · ") + item.label,
        choose ? (unknownPrice ? "Un prix reste à préciser parmi ces lignes" : "Plusieurs lignes modifiables portent ce nom")
          : unknownPrice ? "Prix inconnu · ligne existante" : "Prix et quantité · ligne existante",
        unknownPrice ? 0 : 2, editable.map(line => line.selectionId), choose ? undefined : item.basketArticle?.concept?.id);
    }
  }
  const editor = model.editors.find(candidate => candidate.assetKey === "template:purchase");
  const merchant = typeof context.fields.merchantLabel === "string" && context.fields.merchantLabel.trim();
  if (editor?.fields.some(field => field.key === "merchantLabel") && !merchant) {
    offer("DETAILS", "Préciser le vendeur", "Vendeur facultatif · configuration", 4);
  }
  const historicalFees = purchaseComponents(context, "extras").filter(legacyDeliveryFee);
  const fee = purchaseComponents(context, "shipping")[0];
  const shipping = slot("shipping", "shipping", "OPTIONAL_ONE");
  const coverage = context.fields.deliveryCoverage ?? "UNKNOWN";
  if (historicalFees.length) {
    const extrasSocket = slot("extras", "extra", "REPEATING");
    const historical = historicalFees.length === 1 ? historicalFees[0] : undefined;
    if (historical && extrasSocket
      && !locked("extras", historical) && extrasSocket.currentItems.some(item => item.selectionId === historical.selectionId)) {
      offer("LEGACY_FEE", "Modifier les frais historiques", "Ligne de livraison déjà présente", 1, [historical.selectionId]);
    }
  } else if (shipping
    && (!fee || !locked("shipping", fee) && shipping.currentItems.some(item => item.selectionId === fee.selectionId))) {
    const label = fee ? (fee.cost.kind === "UNKNOWN" ? "Préciser le montant de livraison" : "Modifier les frais de livraison")
      : coverage === "UNKNOWN" ? "Préciser la livraison et les frais" : "Consulter la livraison";
    offer("DELIVERY", label, fee ? "Frais distincts · ligne existante" : coverage === "INCLUDED" ? "Livraison comprise" : "Modalité et frais · éditeur",
      (!fee && coverage === "UNKNOWN") || fee?.cost.kind === "UNKNOWN" ? 1 : 5, fee ? [fee.selectionId] : []);
  }
  return rankDiscoveryCandidates(candidates);
}
