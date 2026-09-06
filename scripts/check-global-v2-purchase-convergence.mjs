import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* next */ }
      }
      throw originalError;
    }
  },
});

const analytics = await import("../src/analytics/global-v2/index.ts");
const { parseMoney } = await import("../src/core/money/index.ts");
const { parseLocalDate, parseYearMonth } = await import("../src/core/time/index.ts");

let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };
const rejects = (assertion, pattern) => check(() => assert.throws(assertion, pattern));
const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map(parseYearMonth);
const referenceMonths = months.slice(0, 6);
const currentMonths = months.slice(6);
const merchantA = "merchant:a";
const merchantB = "merchant:b";
const merchantC = "merchant:c";
const merchantD = "merchant:d";
const event = (merchantId, month, ordinal, amount) => ({
  purchaseEventId: `${merchantId}:${month}:${ordinal}`,
  merchantId,
  month,
  netRetainedValue: parseMoney(String(amount)),
  evidenceRefs: [`purchase-event:${merchantId}:${month}:${ordinal}`],
});
const catalog = (universes = [{ universeId: "universe:groceries", merchantIds: [merchantA, merchantB], evidenceRefs: ["universe:groceries:members"] }]) => ({
  status: "KNOWN",
  catalogVersion: "substitution-universe-catalog@fixture-v1",
  universes,
  evidenceRefs: ["catalog:fixture"],
});
const coverage = (events) => ({ status: "KNOWN", numerator: events.length, denominator: events.length, ratio: 1, evidenceRefs: ["coverage:purchase-events"] });
const buildSubstitution = (events, options = {}) => analytics.buildGlobalMerchantSubstitution({
  sourceRevision: "source:7",
  analyticsRevision: "analytics:11",
  certifiedThroughMonth: months.at(-1),
  referenceMonths,
  currentMonths,
  purchaseCoverage: coverage(events),
  catalog: catalog(),
  events,
  ...options,
});

// P10-N01..N04: raw product-like data cannot open an authority gate.
const productClosure = analytics.buildGlobalProductCapabilityClosure({
  rawOperationItemCount: 12,
  rawProductObservationCount: 9,
  rawPriceObservationCount: 20,
  evidenceRefs: ["probe:raw-items", "probe:raw-price-observations"],
});
check(() => assert.equal(productClosure.status, "AUTHORITY_GATED"));
check(() => assert.equal(productClosure.rawInputsAreAuthority, false));
check(() => assert.equal(productClosure.capabilities.length, 14));
check(() => assert.ok(productClosure.capabilities.every(({ state }) => state === "UNAVAILABLE")));
check(() => assert.deepEqual(productClosure.capabilities.flatMap(({ authorityGateIds }) => authorityGateIds).sort(), ["AG002", "AG003", "AG004", "AG012", "AG013", "AG014", "AG015", "AG016", "AG017", "AG018", "AG019", "AG020", "AG021", "AG022"].sort()));
check(() => assert.ok(productClosure.forbiddenFallbacks.includes("DEFAULT_QUANTITY_ONE")));
rejects(() => analytics.buildGlobalProductCapabilityClosure({ rawOperationItemCount: -1, rawProductObservationCount: 0, rawPriceObservationCount: 0, evidenceRefs: ["probe"] }), /P10_INVALID_RAW_PRODUCT_COUNTS/);

// P10-S01: exact 6+6 opposing spend shares, materiality and support produce an associative signal.
const spendEvents = months.flatMap((month, index) => [
  event(merchantA, month, 1, index < 6 ? 60 : 40),
  event(merchantB, month, 1, index < 6 ? 40 : 60),
]);
const spendResult = buildSubstitution(spendEvents);
check(() => assert.equal(spendResult.status, "KNOWN"));
check(() => assert.equal(spendResult.signals.length, 1));
check(() => assert.equal(spendResult.signals[0].axis, "SPEND_SHIFT"));
check(() => assert.equal(spendResult.signals[0].associationOnly, true));
check(() => assert.equal(spendResult.signals[0].fromMerchantId, merchantA));
check(() => assert.equal(spendResult.signals[0].toMerchantId, merchantB));
check(() => assert.ok(spendResult.signals[0].evidenceRefs.length > 0));

// P10-S02/N04: catalog or coverage absence remains unavailable, not an empty-known universe.
const noCatalog = buildSubstitution(spendEvents, { catalog: { status: "UNKNOWN", reasonCode: "DATA_GATED", evidenceRefs: ["catalog:missing"] } });
check(() => assert.equal(noCatalog.status, "UNAVAILABLE"));
check(() => assert.equal(noCatalog.reasonCode, "SUBSTITUTION_UNIVERSE_DATA_GATED"));
const partialCoverage = buildSubstitution(spendEvents, { purchaseCoverage: { status: "PARTIAL", reasonCode: "MISSING_PURCHASES", evidenceRefs: ["coverage:partial"] } });
check(() => assert.equal(partialCoverage.reasonCode, "PURCHASE_EVENT_COVERAGE_INCOMPLETE"));
const separateUniverses = buildSubstitution([
  ...spendEvents,
  ...months.flatMap((month) => [event(merchantC, month, 1, 10), event(merchantD, month, 1, 10)]),
], { catalog: catalog([
  { universeId: "universe:one", merchantIds: [merchantA, merchantC], evidenceRefs: ["universe:one"] },
  { universeId: "universe:two", merchantIds: [merchantB, merchantD], evidenceRefs: ["universe:two"] },
]) });
check(() => assert.equal(separateUniverses.signals.length, 0));

// P10-S03/S05 exact boundaries and frequency-only proof from the shared materiality owner.
check(() => assert.equal(analytics.meetsGlobalMerchantEventSupport(7), false));
check(() => assert.equal(analytics.meetsGlobalMerchantEventSupport(8), true));
check(() => assert.equal(analytics.meetsGlobalMerchantShareShiftThreshold("0.0999"), false));
check(() => assert.equal(analytics.meetsGlobalMerchantShareShiftThreshold("0.10"), true));
check(() => assert.equal(analytics.meetsGlobalMerchantCounterbalanceThreshold("-0.10", "0.0499"), false));
check(() => assert.equal(analytics.meetsGlobalMerchantCounterbalanceThreshold("-0.10", "0.05"), true));
check(() => assert.equal(analytics.areGlobalMerchantChangeOnsetsCompatible(parseLocalDate("2026-01-01"), parseLocalDate("2026-02-01")), true));
check(() => assert.equal(analytics.areGlobalMerchantChangeOnsetsCompatible(parseLocalDate("2026-01-01"), parseLocalDate("2026-02-02")), false));
const frequencyEvents = months.flatMap((month, index) => index < 6
  ? [event(merchantA, month, 1, 30), event(merchantA, month, 2, 30), event(merchantB, month, 1, 40)]
  : [event(merchantA, month, 1, 60), event(merchantB, month, 1, 20), event(merchantB, month, 2, 20)]);
const proofs = [merchantA, merchantB].map((merchantId) => ({
  merchantId,
  boundaryMonth: currentMonths[0],
  window: "6+6",
  status: "MATERIAL",
  policyRef: "global-materiality:activity-frequency:v1",
  evidenceRefs: [`materiality:${merchantId}:frequency`],
}));
const frequencyResult = buildSubstitution(frequencyEvents, { frequencyMaterialityProofs: proofs });
check(() => assert.equal(frequencyResult.signals.length, 1));
check(() => assert.equal(frequencyResult.signals[0].axis, "FREQUENCY_SHIFT"));
check(() => assert.ok(frequencyResult.signals[0].evidenceRefs.some((ref) => ref.startsWith("materiality:"))));
const frequencyWithoutProof = buildSubstitution(frequencyEvents);
check(() => assert.equal(frequencyWithoutProof.signals.length, 0));
check(() => assert.notEqual(frequencyWithoutProof.inputHash, frequencyResult.inputHash));

// BOTH merges independently qualified axes without adding their values.
const bothEvents = months.flatMap((month, index) => index < 6
  ? [event(merchantA, month, 1, 40), event(merchantA, month, 2, 40), event(merchantB, month, 1, 20)]
  : [event(merchantA, month, 1, 40), event(merchantB, month, 1, 30), event(merchantB, month, 2, 30)]);
const bothResult = buildSubstitution(bothEvents, { frequencyMaterialityProofs: proofs });
check(() => assert.equal(bothResult.signals.length, 1));
check(() => assert.equal(bothResult.signals[0].axis, "BOTH"));

// P10-S04/H01: natural windows, no-lookahead, closure and canonical ordering.
rejects(() => analytics.buildGlobalMerchantSubstitution({ sourceRevision: "7", analyticsRevision: "11", certifiedThroughMonth: months[9], referenceMonths, currentMonths: months.slice(6, 9), purchaseCoverage: coverage(spendEvents), catalog: catalog(), events: spendEvents }), /P10_CURRENT_MONTH_WINDOW_INVALID/);
rejects(() => analytics.buildGlobalMerchantSubstitution({ sourceRevision: "7", analyticsRevision: "11", certifiedThroughMonth: months[10], referenceMonths, currentMonths, purchaseCoverage: coverage(spendEvents), catalog: catalog(), events: spendEvents }), /P10_MERCHANT_WINDOWS_NOT_CONTIGUOUS_OR_FUTURE/);
const permuted = buildSubstitution([...spendEvents].reverse(), { catalog: catalog([{ universeId: "universe:groceries", merchantIds: [merchantB, merchantA], evidenceRefs: ["universe:groceries:members"] }]) });
check(() => assert.equal(permuted.inputHash, spendResult.inputHash));
const changed = buildSubstitution(spendEvents.map((row, index) => index === 0 ? { ...row, netRetainedValue: parseMoney("61") } : row));
check(() => assert.notEqual(changed.inputHash, spendResult.inputHash));
const newCatalogVersion = buildSubstitution(spendEvents, { catalog: { ...catalog(), catalogVersion: "substitution-universe-catalog@fixture-v2" } });
check(() => assert.notEqual(newCatalogVersion.inputHash, spendResult.inputHash));

// P10-B01/B02: actual M8 evidence feeds the existing exact M2 decomposition.
const purchase = {
  status: "KNOWN",
  sourceRevision: "source:7",
  certifiedThroughMonth: parseYearMonth("2026-07"),
  inputHash: "purchase-input-hash",
  coverage: { purchaseCoverage: { status: "KNOWN", ratio: 1, numerator: 5, denominator: 5 } },
  events: [
    { purchaseEventId: "p-ref-1", outcome: "RETAINED", purchaseAt: { status: "KNOWN", date: "2026-01-10" }, netRetainedValue: parseMoney("20"), evidenceRefs: ["p-ref-1"] },
    { purchaseEventId: "p-ref-2", outcome: "RETAINED", purchaseAt: { status: "KNOWN", date: "2026-01-11" }, netRetainedValue: parseMoney("30"), evidenceRefs: ["p-ref-2"] },
    { purchaseEventId: "p-current-1", outcome: "RETAINED", purchaseAt: { status: "KNOWN", date: "2026-07-10" }, netRetainedValue: parseMoney("30"), evidenceRefs: ["p-current-1"] },
    { purchaseEventId: "p-current-2", outcome: "RETAINED", purchaseAt: { status: "KNOWN", date: "2026-07-11" }, netRetainedValue: parseMoney("40"), evidenceRefs: ["p-current-2"] },
    { purchaseEventId: "p-current-3", outcome: "PARTIALLY_RETURNED", purchaseAt: { status: "KNOWN", date: "2026-07-12" }, netRetainedValue: parseMoney("50"), evidenceRefs: ["p-current-3"] },
  ],
};
const m2 = analytics.buildGlobalM2PurchaseEnrichment({ purchase, targetMonth: parseYearMonth("2026-07"), referenceMonths: [parseYearMonth("2026-01")] });
check(() => assert.equal(m2.frequencyTicket.status, "KNOWN"));
check(() => assert.equal(m2.frequencyTicket.deltaSpend, "70"));
check(() => assert.equal(m2.frequencyTicket.frequencyEffect, "32.5"));
check(() => assert.equal(m2.frequencyTicket.ticketEffect, "37.5"));
const incompleteM2 = analytics.buildGlobalM2PurchaseEnrichment({ purchase: { ...purchase, coverage: { purchaseCoverage: { status: "PARTIAL", ratio: 0.8 } } }, targetMonth: parseYearMonth("2026-07"), referenceMonths: [parseYearMonth("2026-01")] });
check(() => assert.equal(incompleteM2.frequencyTicket.reasonCode, "PURCHASE_EVENT_COVERAGE_INCOMPLETE"));
rejects(() => analytics.buildGlobalM2PurchaseEnrichment({ purchase, targetMonth: parseYearMonth("2026-01"), referenceMonths: [parseYearMonth("2026-01")] }), /P10_M2_PURCHASE_REFERENCE_INVALID/);

// P10-C01/D01/H01: B/C enrich unidirectionally, P10 remains examined but excluded from the 31-test plan.
const convergence = analytics.recertifyGlobalBCDForPurchases({
  purchase,
  m2,
  substitution: spendResult,
  productCapabilities: productClosure,
  economicAuthorityBeforeHash: "economic-authority-stable",
  economicAuthorityAfterHash: "economic-authority-stable",
  localizedPurchaseRelationshipAuthority: "UNAVAILABLE",
});
check(() => assert.equal(convergence.status, "PASS"));
check(() => assert.equal(convergence.b.economicAuthorityNoOp, true));
check(() => assert.equal(convergence.c.m1EconomicTruthNoOp, true));
check(() => assert.ok(convergence.c.series.some(({ catalogKey }) => catalogKey === "CONSUMPTION_SUBSTITUTION")));
check(() => assert.equal(convergence.d.expectedDefinitionCount, 31));
check(() => assert.equal(convergence.d.examinedDefinition.exclusionReason, "LOCALIZED_PURCHASE_RELATIONSHIP_AUTHORITY_UNAVAILABLE"));
check(() => assert.equal(convergence.d.fdrUniverseChanged, false));
check(() => assert.equal(convergence.d.qValuesChanged, false));
check(() => assert.equal(convergence.cycleFree, true));
check(() => assert.deepEqual(convergence.downstreamGraph.forbiddenEdges, ["M2_TO_M8_RESULT", "M5_TO_M8_RESULT", "M3_RELATIONSHIP_ENRICHMENT_TO_M5_REGIME"]));
rejects(() => analytics.recertifyGlobalBCDForPurchases({ ...{
  purchase, m2, substitution: spendResult, productCapabilities: productClosure,
  economicAuthorityBeforeHash: "before", economicAuthorityAfterHash: "after",
  localizedPurchaseRelationshipAuthority: "UNAVAILABLE",
} }), /P10_UPSTREAM_ECONOMIC_TRUTH_CHANGED_REQUIRES_T02/);
check(() => assert.ok(!JSON.stringify({ productClosure, spendResult, m2, convergence }).toLowerCase().includes("oracle")));

console.log(`P10 purchase/product convergence: ${checks}/${checks} PASS`);
console.log("P10_PRODUCT_AUTHORITY_GATES=PASS");
console.log("P10_MERCHANT_SUBSTITUTION=PASS");
console.log("P10_BCD_RECERTIFICATION=PASS");
console.log("P10_FDR_NO_OP=PASS");
