import "server-only";
import catalog from "../../../../public/planned-visuals/builder/clay/v22/collection.json";
import { isBasketCatalogProduct } from "@/domain/phase2/planner/purchase-catalog";
import type { BasketConcept } from "@/domain/phase2/planner/purchase-basket";

const byId = new Map(catalog.entries.map(entry => [entry.visualConceptId, entry]));
export function assertPurchaseConcept(concept: BasketConcept, domain: unknown) {
  const entry = byId.get(concept.id);
  if (!entry || entry.label !== concept.label || !isBasketCatalogProduct(entry, domain))
    throw new TypeError("PURCHASE_BASKET_CONCEPT_NOT_ADMITTED");
}
