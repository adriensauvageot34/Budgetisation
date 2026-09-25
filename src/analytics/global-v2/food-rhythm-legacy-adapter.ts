import type { GlobalFoodEconomicComponent, GlobalFoodFinancialComponent } from "./food-rhythm";

/** Compatibility for the existing DEFAULT wire. Operation text is translated before classification. */
export function legacyFoodEconomicComponent(component: GlobalFoodFinancialComponent): GlobalFoodEconomicComponent {
  return {
    canonicalComponentKey: component.canonicalComponentKey,
    economicSegmentKey: component.economicSegmentKey,
    purchaseIdentityKey: `operation:${component.operationId}`,
    purchaseEventId: null,
    economicMonth: component.economicMonth,
    economicDate: component.economicDate,
    amount: { status: "KNOWN", value: component.amount },
    subcategoryKey: component.subcategoryKey,
    semanticPurpose: component.operationTypePrecis === "Repas du midi au travail" ? "WORK_LUNCH" : null,
    merchantLabel: component.merchantLabel,
    articleCount: component.articleCount,
    sourceType: component.sourceType,
  };
}
