import { BASKET_VARIANT_FIELDS, type PurchaseComponent } from "@/domain/phase2/planner/purchase-basket";

export function purchaseVariantText(item: PurchaseComponent) {
  const variant = item.basketArticle?.variant;
  return variant ? BASKET_VARIANT_FIELDS.map(key => variant[key]).filter(Boolean).join(" · ") : "";
}

export function purchaseLineLabel(item: PurchaseComponent, index?: number) {
  return [item.label, purchaseVariantText(item), index === undefined ? "" : `ligne ${index + 1}`].filter(Boolean).join(" · ");
}
