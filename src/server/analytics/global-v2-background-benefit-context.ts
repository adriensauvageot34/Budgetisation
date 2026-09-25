import "server-only";

import Big from "big.js";
import type { GlobalFoodRhythmProjection } from "@/analytics/global-v2";
import type { PurchaseAwareCanonicalResult } from "@/analytics/facts";
import type { GlobalBackgroundBenefitCoverage, GlobalBackgroundBenefitFunding, GlobalBackgroundPurchasePresentation } from "@/query-api/global-v2/background-rhythms";

type FundingRow = Readonly<{
  purchase_event_id: string;
  funding_kind: "BENEFIT_WALLET" | "BANK_CARD" | "OTHER";
  amount_status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT";
  amount: string | number | null;
}>;
type PresentationRow = Readonly<{
  purchaseEventId: string;
  merchantLabel: string;
  channel: "DIRECT_OR_IN_PERSON" | "UBER_EATS" | "UNKNOWN";
}>;

/** Presentation aggregate only: the certified purchase gross remains untouched. */
export function buildGlobalBackgroundBenefitContext(input: {
  readonly canonical: PurchaseAwareCanonicalResult;
  readonly food: GlobalFoodRhythmProjection;
  readonly coverage: GlobalBackgroundBenefitCoverage;
  readonly months: readonly string[];
  readonly fundingComponents: readonly FundingRow[];
  readonly presentations: readonly PresentationRow[];
}): Readonly<{ benefitFunding: GlobalBackgroundBenefitFunding; purchasePresentation: GlobalBackgroundPurchasePresentation }> {
  if (input.canonical.visibility !== "PURCHASE_AWARE_PILOT" || input.canonical.status !== "PASS") throw new TypeError("BACKGROUND_BENEFIT_PILOT_REQUIRED");
  const monthByEvent = new Map<string, string>();
  for (const fact of input.canonical.facts) {
    if (fact.fact !== "fct_purchase_aware_economic_component") continue;
    if (fact.timing.economicMonth === null || monthByEvent.has(fact.purchaseEventId)) throw new TypeError("BACKGROUND_BENEFIT_EVENT_MONTH_INVALID");
    monthByEvent.set(fact.purchaseEventId, String(fact.timing.economicMonth));
  }
  const totalByMonth = new Map<string, Big>();
  if (input.food.fundingEligiblePurchaseEventIds === undefined) throw new TypeError("BACKGROUND_BENEFIT_FOOD_SCOPE_MISSING");
  const eligibleIds = new Set(input.food.fundingEligiblePurchaseEventIds);
  for (const row of input.fundingComponents) {
    if (row.funding_kind !== "BENEFIT_WALLET") continue;
    const month = monthByEvent.get(row.purchase_event_id);
    if (month === undefined) throw new TypeError("BACKGROUND_BENEFIT_FUNDING_EVENT_MISSING");
    if (!eligibleIds.has(row.purchase_event_id)) continue;
    if (row.amount_status !== "KNOWN" || row.amount === null) throw new TypeError("BACKGROUND_BENEFIT_FUNDING_NOT_KNOWN");
    const amount = new Big(String(row.amount));
    if (amount.lt(0)) throw new TypeError("BACKGROUND_BENEFIT_FUNDING_NEGATIVE");
    totalByMonth.set(month, (totalByMonth.get(month) ?? new Big(0)).plus(amount));
  }
  const monthSet = new Set(input.months);
  const months = [...totalByMonth.entries()].filter(([month]) => monthSet.has(month))
    .sort(([left], [right]) => left.localeCompare(right)).map(([month, amount]) => [month, amount.toFixed(2)] as const);
  const purchasePresentation: Record<string, PresentationRow> = {};
  for (const row of input.presentations) {
    if (!monthByEvent.has(row.purchaseEventId) || purchasePresentation[row.purchaseEventId] !== undefined) throw new TypeError("BACKGROUND_PURCHASE_PRESENTATION_INVALID");
    if (!row.merchantLabel.trim() || !["DIRECT_OR_IN_PERSON", "UBER_EATS", "UNKNOWN"].includes(row.channel)) throw new TypeError("BACKGROUND_PURCHASE_PRESENTATION_INVALID");
    purchasePresentation[row.purchaseEventId] = row;
  }
  return {
    benefitFunding: { coverage: input.coverage, months },
    purchasePresentation: Object.fromEntries(Object.entries(purchasePresentation).map(([eventId, { merchantLabel, channel }]) => [eventId, { merchantLabel, channel }])),
  };
}
