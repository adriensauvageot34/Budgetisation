import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseYearMonth, type YearMonth } from "../../core/time";
import { decomposeGlobalPurchaseFrequencyTicket } from "./category-needs";
import { deferredRelationshipExaminations, dailyRelationshipCatalog, nonDailyRelationshipPlan } from "./relationship-catalog";
import { weeklyRelationshipCatalog } from "./relationship-weekly";
import type { buildGlobalMerchantSubstitution } from "./merchant-substitution";
import type { buildGlobalProductCapabilityClosure } from "./product-capabilities";
import type { GlobalPurchaseMerchantResult } from "./purchases";

export const GLOBAL_PURCHASE_CONVERGENCE_METHOD_VERSION = "global_purchase_convergence@v1";
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
export function buildGlobalM2PurchaseEnrichment(input: {
  readonly purchase: GlobalPurchaseMerchantResult;
  readonly targetMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
}) {
  const targetMonth = parseYearMonth(input.targetMonth);
  const referenceMonths = [...new Set(input.referenceMonths.map(parseYearMonth))].sort() as YearMonth[];
  if (referenceMonths.length === 0 || referenceMonths.some((month) => month >= targetMonth)) throw new TypeError("P10_M2_PURCHASE_REFERENCE_INVALID");
  if (targetMonth > input.purchase.certifiedThroughMonth) throw new TypeError("P10_M2_PURCHASE_LOOKAHEAD");
  const purchaseCoverage = input.purchase.coverage.purchaseCoverage;
  const coverageComplete = purchaseCoverage.status === "KNOWN" && "ratio" in purchaseCoverage && purchaseCoverage.ratio === 1;
  const events = input.purchase.events.filter(({ outcome }) => outcome === "RETAINED" || outcome === "PARTIALLY_RETURNED");
  const datesKnown = events.every(({ purchaseAt }) => purchaseAt.status === "KNOWN");
  const asAmounts = (months: readonly YearMonth[]) => events.flatMap((event) =>
    event.purchaseAt.status === "KNOWN" && months.includes(parseYearMonth(event.purchaseAt.date.slice(0, 7)))
      ? [{ purchaseEventId: event.purchaseEventId, amount: event.netRetainedValue }]
      : []);
  const reference = asAmounts(referenceMonths);
  const current = asAmounts([targetMonth]);
  const frequencyTicket = decomposeGlobalPurchaseFrequencyTicket({
    authorityAvailable: input.purchase.status !== "CONFLICT" && datesKnown,
    purchaseCoverage: coverageComplete ? 1 : 0,
    reference,
    current,
  });
  const dependencyRefs = [...new Set(events.flatMap(({ evidenceRefs }) => evidenceRefs))].sort();
  return {
    frequencyTicket,
    reference,
    current,
    sourceRevision: input.purchase.sourceRevision,
    purchaseInputHash: input.purchase.inputHash,
    dependencyRefs,
    methodVersion: GLOBAL_PURCHASE_CONVERGENCE_METHOD_VERSION,
    inputHash: digest({ targetMonth, referenceMonths, purchaseInputHash: input.purchase.inputHash, purchaseCoverage, events: events.map(({ purchaseEventId, purchaseAt, netRetainedValue }) => ({ purchaseEventId, purchaseAt, netRetainedValue })), method: GLOBAL_PURCHASE_CONVERGENCE_METHOD_VERSION }),
  };
}

export function recertifyGlobalBCDForPurchases(input: {
  readonly purchase: GlobalPurchaseMerchantResult;
  readonly m2: ReturnType<typeof buildGlobalM2PurchaseEnrichment>;
  readonly substitution: ReturnType<typeof buildGlobalMerchantSubstitution>;
  readonly productCapabilities: ReturnType<typeof buildGlobalProductCapabilityClosure>;
  readonly economicAuthorityBeforeHash: string;
  readonly economicAuthorityAfterHash: string;
  readonly localizedPurchaseRelationshipAuthority: "UNAVAILABLE";
}) {
  if (!input.economicAuthorityBeforeHash || input.economicAuthorityBeforeHash !== input.economicAuthorityAfterHash) throw new TypeError("P10_UPSTREAM_ECONOMIC_TRUTH_CHANGED_REQUIRES_T02");
  const p10Definition = nonDailyRelationshipPlan.find(({ id }) => id === "specific-place-visit-localized-purchase");
  const examination = deferredRelationshipExaminations().find(({ id }) => id === p10Definition?.id);
  if (!p10Definition || !examination || examination.owner !== "P10" || examination.eligible || input.localizedPurchaseRelationshipAuthority !== "UNAVAILABLE") {
    throw new TypeError("P10_M5_RELATIONSHIP_REQUIRES_P06_T02_RECERTIFICATION");
  }
  const expectedDefinitionCount = dailyRelationshipCatalog.length + weeklyRelationshipCatalog.length + nonDailyRelationshipPlan.length;
  if (expectedDefinitionCount !== 31) throw new TypeError("P10_M5_FDR_PLAN_CARDINALITY_CHANGED");
  const m3Series = input.substitution.status === "KNOWN"
    ? [
        ...input.substitution.temporalSeries.map(({ signalId, subjectRef, catalogKey, universeId, temporal }) => ({ signalId, subjectRef, catalogKey, universeId, temporalInputHash: temporal.inputHash })),
        ...input.substitution.signals.map(({ signalId, universeId, evidenceRefs }) => ({ signalId, subjectRef: `substitution-universe:${universeId}`, catalogKey: "CONSUMPTION_SUBSTITUTION" as const, universeId, evidenceRefs })),
      ]
    : [];
  const downstreamGraph = {
    m8Inputs: ["fct_purchase_event", "fct_economic_component", "GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"],
    m8Consumers: ["M2_PURCHASE_ENRICHMENT", "M3_CONSUMPTION_SERIES", "M5_EXAMINATION"],
    forbiddenEdges: ["M2_TO_M8_RESULT", "M5_TO_M8_RESULT", "M3_RELATIONSHIP_ENRICHMENT_TO_M5_REGIME"],
  } as const;
  return {
    status: "PASS" as const,
    b: { purchaseFrequencyTicket: input.m2.frequencyTicket, economicAuthorityNoOp: true as const },
    c: { series: m3Series, m1EconomicTruthNoOp: true as const },
    d: {
      expectedDefinitionCount,
      examinedDefinition: { ...examination, status: "EXCLUDED_WITH_REASON" as const, exclusionReason: "LOCALIZED_PURCHASE_RELATIONSHIP_AUTHORITY_UNAVAILABLE" },
      fdrUniverseChanged: false as const,
      qValuesChanged: false as const,
      fullFdrReplayRequired: false as const,
    },
    productCapabilities: input.productCapabilities.capabilities,
    downstreamGraph,
    cycleFree: true as const,
    methodVersion: GLOBAL_PURCHASE_CONVERGENCE_METHOD_VERSION,
    closureHash: digest({ purchase: input.purchase.inputHash, m2: input.m2.inputHash, substitution: input.substitution.inputHash, products: input.productCapabilities.inputHash, examination, downstreamGraph }),
  };
}
