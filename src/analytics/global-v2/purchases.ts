import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, type GlobalCoverageDimension } from "../../core/global-v2";
import { addMoney, compareMoney, parseMoney, type Money } from "../../core/money";
import { parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "../../core/time";
import { parseMethodVersion, parsePolicyVersion } from "../../core/versions";
import type { EconomicComponentFact, PurchaseEventFact } from "../facts";
import { medianMoney } from "../references";
import { decomposeGlobalPurchaseFrequencyTicket } from "./category-needs";
import { buildGlobalTemporalAnalysis } from "./temporal-analysis";

export const GLOBAL_M8_METHOD_VERSION = parseMethodVersion("global_purchase_merchant@v1");

export const globalM8Policies = Object.freeze({
  identity: "purchase-event-identity-hierarchy@v1",
  retained: "purchase-retained-outcome@v1",
  adjustment: "purchase-adjustment-economic-authority@v1",
  merchant: "purchase-canonical-merchant@v1",
  coverage: "purchase-merchant-coverage@v1",
  ticket: "purchase-retained-ticket@v1",
  temporal: "global_temporal_analysis@v1",
});

export type GlobalPurchaseKind =
  | "RETAIL_PURCHASE"
  | "ONLINE_ORDER"
  | "SERVICE_PURCHASE"
  | "SUBSCRIPTION_RENEWAL"
  | "CASH_PURCHASE"
  | "OTHER_PURCHASE"
  | "UNKNOWN_PURCHASE_KIND";

export type GlobalPurchaseOutcome =
  | "RETAINED"
  | "PARTIALLY_RETURNED"
  | "FULLY_RETURNED"
  | "CANCELLED"
  | "UNKNOWN";

export type GlobalPurchaseAdjustmentType =
  | "REFUND"
  | "PARTIAL_REFUND"
  | "RETURN"
  | "CREDIT"
  | "CHARGEBACK"
  | "CANCELLATION"
  | "EXCHANGE";

export type GlobalPurchaseMetadataAuthority = {
  readonly purchaseEventId: string;
  readonly identificationLevel: 1 | 2 | 3 | 4;
  readonly purchaseAt?: {
    readonly date: LocalDate;
    readonly precision: "EXACT" | "DATE_ONLY" | "APPROXIMATE";
    readonly authority: "RECEIPT_OR_ORDER" | "REAL_TRANSACTION_DATE" | "SOURCE_TRANSACTION_DATE" | "QUALIFIED_BANK_DATE_FALLBACK";
    readonly evidenceRefs: readonly string[];
  };
  readonly purchaseKind?: GlobalPurchaseKind;
  readonly interactionMode?: "ACTIVE_PURCHASE" | "AUTOMATIC_RENEWAL";
  readonly merchantId?: string;
  readonly merchantEstablishmentId?: string;
  readonly marketplaceId?: string;
  readonly paymentProcessorId?: string;
  readonly channel?: "IN_STORE" | "ONLINE" | "MARKETPLACE" | "OTHER";
  readonly receiptId?: string;
  readonly orderId?: string;
  readonly lineRefs?: readonly string[];
  readonly beneficiaryPersonIds?: readonly string[];
  readonly participantPersonIds?: readonly string[];
  readonly mixedOperationKnown?: boolean;
  readonly expectedConsumptionComponentRefs?: readonly string[];
  readonly dataNature?: "OBSERVED" | "DECLARED" | "HYBRID";
  readonly evidenceRefs: readonly string[];
};

export type GlobalPurchaseAdjustmentInput = {
  readonly adjustmentId: string;
  readonly purchaseEventId: string;
  readonly adjustmentType: GlobalPurchaseAdjustmentType;
  readonly amount: Money;
  readonly canonicalComponentKey?: string;
  readonly occurredAt?: LocalDate;
  readonly evidenceRefs: readonly string[];
};

export type GlobalPurchaseEligibilityUniverse =
  | { readonly status: "KNOWN"; readonly eligiblePurchaseRefs: readonly string[]; readonly evidenceRefs: readonly string[] }
  | { readonly status: "UNKNOWN"; readonly reasonCode: "DATA_GATED" | "AUTHORITY_GATED"; readonly evidenceRefs: readonly string[] };

export type GlobalPurchaseMerchantInput = {
  readonly householdId: string;
  readonly sourceRevision: string;
  readonly certifiedThroughMonth: YearMonth;
  readonly facts: readonly PurchaseEventFact[];
  readonly economicFacts: readonly EconomicComponentFact[];
  readonly metadataAuthorities?: readonly GlobalPurchaseMetadataAuthority[];
  readonly adjustments?: readonly GlobalPurchaseAdjustmentInput[];
  readonly eligibilityUniverse: GlobalPurchaseEligibilityUniverse;
  readonly observableMonths: readonly YearMonth[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
};

/** Shared exact formula already certified by M2; M8 supplies retained events. */
export function decomposeGlobalMerchantFrequencyTicket(input: {
  readonly authorityAvailable: boolean;
  readonly purchaseCoverage: number;
  readonly reference: readonly { readonly purchaseEventId: string; readonly amount: Money }[];
  readonly current: readonly { readonly purchaseEventId: string; readonly amount: Money }[];
}) {
  return decomposeGlobalPurchaseFrequencyTicket(input);
}

const zero = parseMoney("0");
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const unique = (values: readonly string[]) => [...new Set(values)].sort();
const sum = (values: readonly Money[]) => values.reduce(addMoney, zero);

function assertNoUndefined(value: unknown, path = "M8"): void {
  if (value === undefined) throw new TypeError(`${path}_UNDEFINED_PROPERTY`);
  if (Array.isArray(value)) return value.forEach((entry, index) => assertNoUndefined(entry, `${path}.${index}`));
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) assertNoUndefined(entry, `${path}.${key}`);
  }
}

function uniqueById<T>(values: readonly T[], id: (value: T) => string, error: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = id(value);
    const previous = result.get(key);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(value)) throw new TypeError(error);
    if (previous !== undefined) throw new TypeError(error);
    result.set(key, value);
  }
  return result;
}

function coverage(dimension: GlobalCoverageDimension, numerator: number, denominator: number, evidenceRefs: readonly string[]) {
  return denominator === 0
    ? { dimension, status: "NOT_APPLICABLE" as const, unit: "purchase-event", basis: "resolved-over-eligible", evidenceRefs: unique(evidenceRefs), policyRef: globalM8Policies.coverage }
    : { dimension, status: numerator === denominator ? "KNOWN" as const : "PARTIAL" as const, numerator, denominator, ratio: numerator / denominator, unit: "purchase-event", basis: "resolved-over-eligible", evidenceRefs: unique(evidenceRefs), policyRef: globalM8Policies.coverage };
}

function dimensionFromComponents(
  components: readonly EconomicComponentFact[],
  selector: (component: EconomicComponentFact) => EconomicComponentFact["merchant"],
) {
  const values = components.map(selector);
  if (values.some((value) => value.kind === "conflict")) return { status: "CONFLICT" as const, evidenceRefs: [] as readonly string[] };
  const resolved = unique(values.flatMap((value) => value.kind === "resolved" ? [String(value.id)] : []));
  if (resolved.length > 1) return { status: "CONFLICT" as const, evidenceRefs: resolved.map((id) => `merchant:${id}`) };
  if (resolved.length === 0 || values.some((value) => value.kind !== "resolved")) return { status: "UNKNOWN" as const, evidenceRefs: resolved.map((id) => `merchant:${id}`) };
  return { status: "KNOWN" as const, id: resolved[0], evidenceRefs: [`merchant:${resolved[0]}`] };
}

function beneficiaryFromComponents(components: readonly EconomicComponentFact[]) {
  const ids: string[] = [], evidence: string[] = [];
  for (const component of components) {
    const person = component.person;
    if (person.kind === "conflict") return { status: "CONFLICT" as const, evidenceRefs: unique(person.evidenceRefs ?? []) };
    if (person.kind === "unknown" || person.kind === "not_applicable" || person.kind === "partial") {
      return { status: "UNKNOWN" as const, evidenceRefs: unique("evidenceRefs" in person ? person.evidenceRefs ?? [] : []) };
    }
    if (person.kind === "resolved") {
      ids.push(String(person.id));
      evidence.push(...(person.evidenceRefs ?? []));
    } else {
      ids.push(...person.shares.map(({ personId }) => String(personId)));
      evidence.push(...person.evidenceRefs);
    }
  }
  return { status: "KNOWN" as const, personIds: unique(ids), evidenceRefs: unique(evidence) };
}

function support(months: readonly YearMonth[], count: number) {
  return {
    naturalGrain: "PURCHASE_EVENT" as const,
    eligibleUnits: months.length,
    observedUnits: months.length,
    includedUnits: months.length,
    excludedObservedUnits: 0,
    minimumRequired: 1,
    supportStatus: months.length === 0 ? "INSUFFICIENT" as const : months.length >= 6 ? "SUFFICIENT" as const : "PARTIAL_SUPPORT" as const,
    occurrenceCount: count,
    policyRef: "global-purchase-observable-months@v1",
  };
}

export function buildGlobalPurchaseMerchant(input: GlobalPurchaseMerchantInput) {
  assertNoUndefined(input);
  const certifiedThroughMonth = parseYearMonth(input.certifiedThroughMonth);
  const observableMonths = unique(input.observableMonths.map(parseYearMonth)).filter((month) => month <= certifiedThroughMonth) as YearMonth[];
  const facts = [...input.facts].sort((a, b) => String(a.purchaseEventId).localeCompare(String(b.purchaseEventId)));
  const factById = uniqueById(facts, (fact) => String(fact.purchaseEventId), "M8_DUPLICATE_PURCHASE_EVENT_ID");
  const economicByKey = uniqueById(input.economicFacts, (fact) => String(fact.canonicalComponentKey), "M8_DUPLICATE_ECONOMIC_COMPONENT");
  const metadataById = uniqueById(input.metadataAuthorities ?? [], (row) => row.purchaseEventId, "M8_CONTRADICTORY_PURCHASE_METADATA");
  const adjustmentsById = uniqueById(input.adjustments ?? [], (row) => row.adjustmentId, "M8_DUPLICATE_ADJUSTMENT_ID");
  for (const metadata of metadataById.values()) {
    if (!factById.has(metadata.purchaseEventId)) throw new TypeError("M8_METADATA_WITHOUT_PURCHASE_EVENT");
    if (metadata.evidenceRefs.length === 0 || metadata.purchaseAt?.evidenceRefs.length === 0) throw new TypeError("M8_METADATA_AUTHORITY_REQUIRES_EVIDENCE");
    if (metadata.purchaseAt !== undefined) {
      parseLocalDate(metadata.purchaseAt.date);
      if (metadata.purchaseAt.date.slice(0, 7) > certifiedThroughMonth) throw new TypeError("M8_PURCHASE_AT_AFTER_CERTIFIED_BOUNDARY");
    }
  }
  for (const adjustment of adjustmentsById.values()) {
    if (!factById.has(adjustment.purchaseEventId) || adjustment.evidenceRefs.length === 0 || compareMoney(parseMoney(adjustment.amount), zero) < 0) throw new TypeError("M8_INVALID_PURCHASE_ADJUSTMENT");
    if (adjustment.occurredAt !== undefined) parseLocalDate(adjustment.occurredAt);
  }
  const ownedComponents = new Map<string, string>();
  const eventRows = facts.map((fact) => {
    if (String(fact.householdId) !== input.householdId) throw new TypeError("M8_CROSS_HOUSEHOLD_PURCHASE_EVENT");
    const eventId = String(fact.purchaseEventId), metadata = metadataById.get(eventId);
    const consumptionRefs = unique(fact.sources.filter(({ membershipKind }) => membershipKind === "CONSUMPTION_COMPONENT").map(({ canonicalComponentKey }) => String(canonicalComponentKey)));
    const components = consumptionRefs.map((key) => {
      const component = economicByKey.get(key);
      if (component === undefined) throw new TypeError(`M8_MISSING_ECONOMIC_COMPONENT:${key}`);
      if (String(component.householdId) !== input.householdId) throw new TypeError("M8_CROSS_HOUSEHOLD_ECONOMIC_COMPONENT");
      if (compareMoney(component.gross, zero) < 0 || compareMoney(component.net, zero) < 0) throw new TypeError("M8_NEGATIVE_COMPONENT_IS_ADJUSTMENT_NOT_PURCHASE");
      const previousOwner = ownedComponents.get(key);
      if (previousOwner !== undefined && previousOwner !== eventId) throw new TypeError("M8_COMPONENT_HAS_MULTIPLE_PURCHASE_OWNERS");
      ownedComponents.set(key, eventId);
      return component;
    });
    const grossPurchaseValue = sum(components.map(({ gross }) => gross));
    const refundAllocatedAmount = sum(components.map(({ refundApplied }) => refundApplied));
    const netRetainedValue = sum(components.map(({ net }) => net));
    if (compareMoney(netRetainedValue, fact.economicAmount) !== 0) throw new TypeError("M8_PURCHASE_FACT_DOES_NOT_RECONCILE");
    const explicitAdjustments = [...adjustmentsById.values()].filter((row) => row.purchaseEventId === eventId).sort((a, b) => a.adjustmentId.localeCompare(b.adjustmentId));
    for (const adjustment of explicitAdjustments) {
      if (compareMoney(adjustment.amount, zero) > 0 && adjustment.canonicalComponentKey === undefined) throw new TypeError("M8_MONETARY_ADJUSTMENT_REQUIRES_COMPONENT_AUTHORITY");
      if (adjustment.canonicalComponentKey !== undefined) {
        const component = economicByKey.get(adjustment.canonicalComponentKey);
        if (!component || !consumptionRefs.includes(adjustment.canonicalComponentKey) || compareMoney(adjustment.amount, component.refundApplied) > 0) throw new TypeError("M8_ADJUSTMENT_OUTSIDE_PURCHASE_AUTHORITY");
      }
    }
    for (const componentKey of unique(explicitAdjustments.flatMap(({ canonicalComponentKey }) => canonicalComponentKey === undefined ? [] : [canonicalComponentKey]))) {
      const explicitAmount = sum(explicitAdjustments.filter(({ canonicalComponentKey }) => canonicalComponentKey === componentKey).map(({ amount }) => amount));
      if (compareMoney(explicitAmount, economicByKey.get(componentKey)!.refundApplied) !== 0) throw new TypeError("M8_ADJUSTMENTS_DO_NOT_RECONCILE_ECONOMIC_REFUND");
    }
    const cancelled = explicitAdjustments.some(({ adjustmentType }) => adjustmentType === "CANCELLATION");
    const outcome: GlobalPurchaseOutcome = cancelled ? "CANCELLED" : compareMoney(refundAllocatedAmount, zero) === 0 ? "RETAINED" : compareMoney(netRetainedValue, zero) === 0 ? "FULLY_RETURNED" : "PARTIALLY_RETURNED";
    const componentMerchant = dimensionFromComponents(components, ({ merchant }) => merchant);
    const merchant = metadata?.merchantId !== undefined
      ? componentMerchant.status === "KNOWN" && componentMerchant.id !== metadata.merchantId
        ? { status: "CONFLICT" as const, evidenceRefs: unique([...componentMerchant.evidenceRefs, ...metadata.evidenceRefs]) }
        : { status: "KNOWN" as const, id: metadata.merchantId, evidenceRefs: unique([...componentMerchant.evidenceRefs, ...metadata.evidenceRefs]) }
      : componentMerchant;
    const componentBeneficiary = beneficiaryFromComponents(components);
    const declaredBeneficiaries = metadata?.beneficiaryPersonIds === undefined ? undefined : unique(metadata.beneficiaryPersonIds);
    const declaredBeneficiaryEvidence = metadata?.evidenceRefs ?? [];
    const beneficiary = declaredBeneficiaries !== undefined
      ? componentBeneficiary.status === "KNOWN" && canonicalSerializeGlobal(componentBeneficiary.personIds) !== canonicalSerializeGlobal(declaredBeneficiaries)
        ? { status: "CONFLICT" as const, evidenceRefs: unique([...componentBeneficiary.evidenceRefs, ...declaredBeneficiaryEvidence]) }
        : { status: "KNOWN" as const, personIds: declaredBeneficiaries, evidenceRefs: unique([...componentBeneficiary.evidenceRefs, ...declaredBeneficiaryEvidence]) }
      : componentBeneficiary;
    const expected = unique(metadata?.expectedConsumptionComponentRefs ?? consumptionRefs);
    const missingExpected = expected.filter((key) => !consumptionRefs.includes(key));
    const mixedUnresolved = metadata?.mixedOperationKnown === true && (metadata.expectedConsumptionComponentRefs === undefined || missingExpected.length > 0);
    const purchaseAt = metadata?.purchaseAt === undefined
      ? { status: "UNKNOWN" as const, reasonCode: "PURCHASE_AT_AUTHORITY_UNAVAILABLE" as const }
      : { status: "KNOWN" as const, ...metadata.purchaseAt };
    const bankPostingDates = unique(components.flatMap(({ bankDate }) => bankDate.kind === "known" ? [bankDate.date] : []));
    const knowledgeState = merchant.status === "CONFLICT" || beneficiary.status === "CONFLICT"
      ? "CONFLICT" as const
      : mixedUnresolved || purchaseAt.status === "UNKNOWN" || merchant.status === "UNKNOWN" || beneficiary.status === "UNKNOWN"
        ? "PARTIAL" as const
        : "KNOWN" as const;
    const evidenceRefs = unique([`purchase-event:${eventId}`, ...fact.sources.flatMap(({ evidenceRefs }) => evidenceRefs), ...(metadata?.evidenceRefs ?? []), ...explicitAdjustments.flatMap(({ evidenceRefs }) => evidenceRefs)]);
    const explicitComponentKeys = new Set(explicitAdjustments.flatMap(({ canonicalComponentKey }) => canonicalComponentKey === undefined ? [] : [canonicalComponentKey]));
    const derivedAdjustments = components.flatMap((component) => compareMoney(component.refundApplied, zero) === 0 || explicitComponentKeys.has(String(component.canonicalComponentKey)) ? [] : [{
      adjustmentId: `economic-refund:${component.canonicalComponentKey}`,
      purchaseEventId: eventId,
      adjustmentType: compareMoney(component.net, zero) === 0 ? "REFUND" as const : "PARTIAL_REFUND" as const,
      amount: component.refundApplied,
      canonicalComponentKey: String(component.canonicalComponentKey),
      evidenceRefs: [`economic-component:${component.canonicalComponentKey}`],
      authority: "ECONOMIC_COMPONENT_REFUND" as const,
    }]);
    return {
      purchaseEventId: eventId,
      identificationLevel: metadata?.identificationLevel ?? 2,
      purchaseAt,
      economicDate: fact.timing.economicDate === null
        ? { status: fact.timing.status, ...(fact.timing.economicMonth === null ? {} : { month: fact.timing.economicMonth }) }
        : { status: "KNOWN" as const, date: fact.timing.economicDate, month: fact.timing.economicMonth },
      bankPostingDates,
      purchaseKind: metadata?.purchaseKind ?? "UNKNOWN_PURCHASE_KIND" as const,
      interactionMode: metadata?.interactionMode === undefined ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, value: metadata.interactionMode },
      merchant,
      merchantEstablishment: metadata?.merchantEstablishmentId === undefined ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, id: metadata.merchantEstablishmentId, evidenceRefs: unique(metadata.evidenceRefs) },
      marketplace: metadata?.marketplaceId === undefined ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, id: metadata.marketplaceId, evidenceRefs: unique(metadata.evidenceRefs) },
      paymentProcessor: metadata?.paymentProcessorId === undefined ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, id: metadata.paymentProcessorId, evidenceRefs: unique(metadata.evidenceRefs) },
      channel: metadata?.channel === undefined ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, value: metadata.channel, evidenceRefs: unique(metadata.evidenceRefs) },
      economicComponentRefs: consumptionRefs,
      paymentRefs: unique(fact.sources.filter(({ membershipKind }) => membershipKind === "EVIDENCE_SOURCE").map(({ canonicalComponentKey }) => String(canonicalComponentKey))),
      lineRefs: unique(metadata?.lineRefs ?? []),
      grossPurchaseValue,
      refundAllocatedAmount,
      economicNetValue: netRetainedValue,
      netRetainedValue: outcome === "CANCELLED" ? zero : netRetainedValue,
      outcome,
      purchaseOccurred: true as const,
      beneficiary,
      participantPersonIds: unique(metadata?.participantPersonIds ?? []),
      dataNature: metadata?.dataNature ?? (fact.provenance === "EXPLICIT_USER_ASSERTION" ? "DECLARED" as const : fact.provenance === "STRUCTURED_CANONICAL_SOURCE" ? "OBSERVED" as const : "HYBRID" as const),
      knowledgeState,
      partialReasons: unique([...(mixedUnresolved ? ["MISSING_LINKAGE"] : []), ...(purchaseAt.status === "UNKNOWN" ? ["PURCHASE_AT_AUTHORITY_UNAVAILABLE"] : []), ...(merchant.status === "UNKNOWN" ? ["MERCHANT_AUTHORITY_UNAVAILABLE"] : []), ...(beneficiary.status === "UNKNOWN" ? ["BENEFICIARY_AUTHORITY_UNAVAILABLE"] : [])]),
      adjustments: [...explicitAdjustments.map((adjustment) => ({ ...adjustment, authority: "EXPLICIT_PURCHASE_ADJUSTMENT" as const })), ...derivedAdjustments].sort((a, b) => a.adjustmentId.localeCompare(b.adjustmentId)),
      evidenceRefs,
      sourceRevision: input.sourceRevision,
      methodVersion: GLOBAL_M8_METHOD_VERSION,
    };
  });

  const retained = eventRows.filter(({ outcome }) => outcome === "RETAINED" || outcome === "PARTIALLY_RETURNED");
  const coverageEvidence = input.eligibilityUniverse.evidenceRefs;
  const purchaseCoverage = input.eligibilityUniverse.status === "UNKNOWN"
    ? { dimension: "PURCHASE_EVENT" as const, status: "UNKNOWN" as const, unit: "purchase-event", basis: "eligible-universe-not-authoritative", evidenceRefs: unique(coverageEvidence), policyRef: globalM8Policies.coverage }
    : coverage("PURCHASE_EVENT", eventRows.length, input.eligibilityUniverse.eligiblePurchaseRefs.length, [...coverageEvidence, ...input.eligibilityUniverse.eligiblePurchaseRefs]);
  if ((purchaseCoverage.status === "KNOWN" || purchaseCoverage.status === "PARTIAL") && purchaseCoverage.numerator > purchaseCoverage.denominator) throw new TypeError("M8_PURCHASE_COVERAGE_OVERFLOW");
  const merchantCoverage = coverage("CLASSIFICATION", eventRows.filter(({ merchant }) => merchant.status === "KNOWN").length, eventRows.length, eventRows.flatMap(({ evidenceRefs }) => evidenceRefs));
  const beneficiaryCoverage = coverage("PERSON_ATTRIBUTION", eventRows.filter(({ beneficiary }) => beneficiary.status === "KNOWN").length, eventRows.length, eventRows.flatMap(({ evidenceRefs }) => evidenceRefs));
  const establishmentCoverage = coverage("PLACE", eventRows.filter(({ merchantEstablishment }) => merchantEstablishment.status === "KNOWN").length, eventRows.length, eventRows.flatMap(({ evidenceRefs }) => evidenceRefs));

  const merchantIds = unique(retained.flatMap(({ merchant }) => merchant.status === "KNOWN" ? [merchant.id] : []));
  const merchants = merchantIds.map((merchantId) => {
    const checkoutEvents = eventRows.filter(({ merchant }) => merchant.status === "KNOWN" && merchant.id === merchantId);
    const retainedEvents = retained.filter(({ merchant }) => merchant.status === "KNOWN" && merchant.id === merchantId);
    const tickets = retainedEvents.map(({ netRetainedValue }) => netRetainedValue);
    const netEconomicSpend = sum(tickets);
    const meanRetainedTicket = tickets.length === 0 ? null : parseMoney(new Big(netEconomicSpend).div(tickets.length).toFixed());
    const medianRetainedTicket = tickets.length === 0 ? null : medianMoney(tickets);
    const sortedTickets = [...tickets].sort(compareMoney);
    const byMonth = new Map<YearMonth, number>();
    for (const event of retainedEvents) if (event.purchaseAt.status === "KNOWN") {
      const month = parseYearMonth(event.purchaseAt.date.slice(0, 7));
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
    const temporalPoints = observableMonths.map((month) => ({ month, corpus: "CERTIFIED_HISTORY" as const, status: purchaseCoverage.status === "KNOWN" ? "KNOWN" as const : "UNKNOWN" as const, ...(purchaseCoverage.status === "KNOWN" ? { value: String(byMonth.get(month) ?? 0) } : {}), eligible: true, complete: purchaseCoverage.status === "KNOWN", dependencyRefs: retainedEvents.filter((event) => event.purchaseAt.status === "KNOWN" && event.purchaseAt.date.startsWith(month)).map(({ purchaseEventId }) => `purchase-event:${purchaseEventId}`) }));
    const merchantSupport = support(observableMonths, retainedEvents.length);
    const temporal = buildGlobalTemporalAnalysis({
      certifiedThroughMonth,
      points: temporalPoints,
      policyId: "MERCHANT",
      evidence: {
        phenomenonId: `merchant:${merchantId}`,
        metricRef: "retainedPurchaseCount",
        knowledgeState: purchaseCoverage.status === "KNOWN" ? "KNOWN" : "UNKNOWN",
        support: merchantSupport,
        coverage: { dimensions: [purchaseCoverage], requiredDimensions: ["PURCHASE_EVENT"], ...(!("ratio" in purchaseCoverage) ? {} : { effective: purchaseCoverage.ratio }), aggregation: "MIN_REQUIRED_DIMENSIONS" },
        evidenceRefs: unique(checkoutEvents.flatMap(({ evidenceRefs }) => evidenceRefs)),
        entityRefs: [merchantId],
        methodVersion: GLOBAL_M8_METHOD_VERSION,
        materialityPolicy: { id: "global-materiality-merchant", version: parsePolicyVersion("v1") },
      },
    });
    const positiveMonths = temporalPoints.filter((point) => point.status === "KNOWN" && new Big(point.value ?? "0").gt(0));
    const priorToFirst = positiveMonths.length === 0 ? temporalPoints : temporalPoints.filter((point) => point.month < positiveMonths[0].month);
    const recentBoundary = observableMonths.slice(-3)[0];
    const evolution = positiveMonths.length > 0 && recentBoundary !== undefined && positiveMonths[0].month >= recentBoundary && priorToFirst.every((point) => point.status === "KNOWN" && new Big(point.value ?? "0").eq(0))
      ? { status: "KNOWN" as const, lifecycle: "NEWLY_OBSERVED" as const, authority: "SHARED_TEMPORAL_OBSERVATION" as const }
      : temporal.recentChange.status === "KNOWN" && temporal.recentChange.materiality.status === "MATERIAL" && new Big(temporal.recentChange.delta).gt(0)
        ? { status: "KNOWN" as const, lifecycle: "GROWING" as const, authority: "SHARED_RECENT_CHANGE" as const }
        : temporal.recentChange.status === "KNOWN" && temporal.recentChange.materiality.status === "MATERIAL" && new Big(temporal.recentChange.delta).lt(0)
          ? { status: "KNOWN" as const, lifecycle: "DECLINING" as const, authority: "SHARED_RECENT_CHANGE" as const }
          : temporalPoints.length >= 6 && temporalPoints.every((point) => point.status === "KNOWN" && point.value === temporalPoints[0].value) && new Big(temporalPoints[0].value ?? "0").gt(0)
            ? { status: "KNOWN" as const, lifecycle: "REGULAR" as const, authority: "EXACT_CONSTANT_TEMPORAL_PROOF" as const }
            : { status: "UNKNOWN" as const, reasonCode: "TEMPORAL_QUALIFICATION_NOT_PROVEN" as const };
    return {
      merchantId,
      checkoutPurchaseCount: checkoutEvents.length,
      retainedPurchaseCount: retainedEvents.length,
      activePurchaseCount: retainedEvents.filter(({ interactionMode }) => interactionMode.status === "KNOWN" && interactionMode.value === "ACTIVE_PURCHASE").length,
      automaticRenewalCount: retainedEvents.filter(({ interactionMode }) => interactionMode.status === "KNOWN" && interactionMode.value === "AUTOMATIC_RENEWAL").length,
      purchaseRate: observableMonths.length === 0 ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, value: new Big(retainedEvents.length).div(observableMonths.length).toFixed(), denominatorMonths: observableMonths.length },
      netEconomicSpend,
      meanRetainedTicket,
      medianRetainedTicket,
      ticketDistribution: {
        count: sortedTickets.length,
        values: sortedTickets,
        ...(sortedTickets.length === 0 ? {} : { minimum: sortedTickets[0], maximum: sortedTickets[sortedTickets.length - 1] }),
      },
      temporal,
      evolution,
      support: merchantSupport,
      coverage: merchantCoverage,
      detailRefs: retainedEvents.map(({ purchaseEventId }) => purchaseEventId),
      methodVersion: GLOBAL_M8_METHOD_VERSION,
    };
  });

  const dependencyRefs = unique([
    ...eventRows.flatMap(({ evidenceRefs }) => evidenceRefs),
    ...input.economicFacts.map(({ canonicalComponentKey }) => `economic-component:${canonicalComponentKey}`),
    ...input.eligibilityUniverse.evidenceRefs,
    ...(input.eligibilityUniverse.status === "KNOWN" ? input.eligibilityUniverse.eligiblePurchaseRefs : []),
  ]);
  const dependencyClosure = dependencyRefs.map((ref) => {
    const value = input.dependencyDigests[ref];
    if (!value) throw new TypeError(`M8_DEPENDENCY_CLOSURE_MISSING:${ref}`);
    return { ref, digest: value };
  });
  const conflict = eventRows.some(({ knowledgeState }) => knowledgeState === "CONFLICT");
  const partial = eventRows.some(({ knowledgeState }) => knowledgeState === "PARTIAL") || purchaseCoverage.status === "PARTIAL" || purchaseCoverage.status === "UNKNOWN";
  const status = conflict ? "CONFLICT" as const : input.eligibilityUniverse.status === "UNKNOWN" && eventRows.length === 0 ? "UNKNOWN" as const : partial ? "PARTIAL" as const : "KNOWN" as const;
  const capabilities = {
    purchaseIdentity: { state: eventRows.length > 0 || input.eligibilityUniverse.status === "KNOWN" ? "AVAILABLE" as const : "UNAVAILABLE" as const, reasonCode: eventRows.length > 0 ? "CANONICAL_PURCHASE_EVENT" : input.eligibilityUniverse.status === "KNOWN" ? "QUALIFIED_EMPTY_UNIVERSE" : input.eligibilityUniverse.reasonCode },
    adjustments: { state: eventRows.length === 0 ? "UNAVAILABLE" as const : "AVAILABLE" as const, reasonCode: eventRows.length === 0 ? "DATA_GATED" : "ECONOMIC_REFUND_AUTHORITY" },
    merchant: { state: merchantCoverage.status === "KNOWN" ? "AVAILABLE" as const : merchantCoverage.status === "PARTIAL" ? "PARTIAL" as const : "UNAVAILABLE" as const, reasonCode: merchantCoverage.status === "KNOWN" ? "CANONICAL_MERCHANT" : "MERCHANT_AUTHORITY_OR_DATA_GATED" },
    establishment: { state: establishmentCoverage.status === "KNOWN" ? "AVAILABLE" as const : "UNAVAILABLE" as const, reasonCode: establishmentCoverage.status === "KNOWN" ? "EXPLICIT_ESTABLISHMENT" : "AUTHORITY_GATED" },
    products: { state: "UNAVAILABLE" as const, reasonCode: "DEFERRED_P10" as const },
  };
  return {
    status,
    reasonCodes: unique([...(status === "UNKNOWN" ? [input.eligibilityUniverse.status === "UNKNOWN" ? input.eligibilityUniverse.reasonCode : "DATA_GATED"] : []), ...(partial ? ["PARTIAL_AUTHORITY_COVERAGE"] : [])]),
    methodVersion: GLOBAL_M8_METHOD_VERSION,
    sourceRevision: input.sourceRevision,
    certifiedThroughMonth,
    policies: globalM8Policies,
    checkoutPurchaseCount: eventRows.length,
    retainedPurchaseCount: retained.length,
    grossPurchaseValue: sum(eventRows.map(({ grossPurchaseValue }) => grossPurchaseValue)),
    refundAllocatedAmount: sum(eventRows.map(({ refundAllocatedAmount }) => refundAllocatedAmount)),
    netRetainedValue: sum(retained.map(({ netRetainedValue }) => netRetainedValue)),
    events: eventRows,
    merchants,
    coverage: { purchaseCoverage, merchantCoverage, beneficiaryCoverage, establishmentCoverage },
    capabilities,
    contributions: {
      m2PurchaseEvents: retained.map(({ purchaseEventId, purchaseAt, netRetainedValue, evidenceRefs }) => ({ purchaseEventId, purchaseAt, amount: netRetainedValue, evidenceRefs })),
      m5MerchantSignals: merchants.map(({ merchantId, detailRefs, coverage, support }) => ({ merchantId, detailRefs, coverage, support })),
      direction: "M8_TO_M2_M5_ONLY" as const,
    },
    dependencyClosure,
    inputHash: digest({
      householdId: input.householdId,
      sourceRevision: input.sourceRevision,
      certifiedThroughMonth,
      facts,
      economicFacts: [...input.economicFacts].sort((a, b) => String(a.canonicalComponentKey).localeCompare(String(b.canonicalComponentKey))),
      metadataAuthorities: [...metadataById.values()].sort((a, b) => a.purchaseEventId.localeCompare(b.purchaseEventId)),
      adjustments: [...adjustmentsById.values()].sort((a, b) => a.adjustmentId.localeCompare(b.adjustmentId)),
      eligibilityUniverse: input.eligibilityUniverse.status === "KNOWN"
        ? { ...input.eligibilityUniverse, eligiblePurchaseRefs: unique(input.eligibilityUniverse.eligiblePurchaseRefs), evidenceRefs: unique(input.eligibilityUniverse.evidenceRefs) }
        : { ...input.eligibilityUniverse, evidenceRefs: unique(input.eligibilityUniverse.evidenceRefs) },
      observableMonths,
      dependencyClosure,
      policies: globalM8Policies,
    }),
    outputHash: digest({ eventRows, merchants, coverage: { purchaseCoverage, merchantCoverage, beneficiaryCoverage, establishmentCoverage }, capabilities }),
    publicationEligible: false as const,
  };
}

export type GlobalPurchaseMerchantResult = ReturnType<typeof buildGlobalPurchaseMerchant>;
