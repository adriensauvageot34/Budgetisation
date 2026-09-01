import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const engine = await import("../src/analytics/history-v2/month-balance/index.ts");
const history = await import("../src/core/history-v2/index.ts");
const query = await import("../src/query-api/index.ts");
const registry = await import("../src/query-api/read-model-registry.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const money = (value) => String(value);
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

check(() => {
  const v2 = Object.entries(query.queryResourceContractRegistry).filter(([, contract]) => contract.family === "history_v2");
  assert.equal(v2.length, 15);
  const adapters = readFileSync(new URL("../src/query-api/server/adapter-registry.ts", import.meta.url), "utf8");
  for (const [resource] of v2) assert.match(adapters, new RegExp(`${resource}:`));
});
check(() => assert.equal(query.getQueryResourceContract(query.queryResourceKeys.historyMonthBalanceSummary).contractVersion, "v2"));
check(() => assert.deepEqual(query.normalizeQueryRequest({ resource: "history_category_detail", scope: { subject: { kind: "household" }, time: { kind: "month", month: "2026-05" } }, params: { categoryId: "food" } }).params, { categoryId: "food" }));
check(() => assert.throws(() => query.normalizeQueryRequest({ resource: "history_spending_segment_detail", scope: { subject: { kind: "household" }, time: { kind: "month", month: "2026-05" } }, params: { axis: "necessity", bucket: "OPTIONAL", behavior: "FIXED" } }), (error) => error.issues?.some(({ message }) => /exactement un axe/.test(message))));

const comparison = engine.compareMonthReference({ actual: money(1200), reference: money(1000) });
check(() => assert.equal(comparison.delta, money(200)));
check(() => assert.equal(comparison.relativeDelta, 0.2));
check(() => assert.equal(comparison.materiality.material, true));
check(() => assert.equal(engine.compareMonthReference({ actual: money(10), reference: money(0) }).relativeDelta, undefined));
check(() => assert.equal(engine.compareMonthReference({ actual: money(0), reference: money(0) }).materiality.relativeSatisfied, false));
check(() => assert.equal(engine.computeUsualZone({ typical: money(1000), supportMonths: 5 }).status, "NOT_APPLICABLE"));
check(() => assert.deepEqual(engine.computeUsualZone({ typical: money(1000), supportMonths: 8 }).value, { lowerBound: money(900), upperBound: money(1100), tolerance: money(100), supportMonths: 8, supportLevel: "limited" }));
check(() => assert.deepEqual(engine.computeHistoricalRank({ current: money(100), comparableActualsIncludingCurrent: [money(200), money(200.004), money(100), money(50)] }).value, { rank: 3, universeCount: 4, presentation: "RANKED" }));

const bridge = engine.buildBankEconomyBridge({ bankOutflows: money(1100), actual: money(1000), lines: [{ lineId: "cash", kind: "CASH_USE", label: "Cash", signedAmount: money(-100), sourceRefs: ["cash:1"] }], linesComplete: true });
check(() => assert.equal(bridge.residual, money(0)));
check(() => assert.equal(bridge.result.status, "KNOWN"));
check(() => assert.equal(bridge.visible, true));
check(() => assert.throws(() => engine.buildBankEconomyBridge({ bankOutflows: money(1), actual: money(1), lines: [{ lineId: "x", kind: "CASH_USE", label: "x", signedAmount: money(0), sourceRefs: [] }, { lineId: "x", kind: "CASH_USE", label: "x", signedAmount: money(0), sourceRefs: [] }], linesComplete: true }), /double comptage/));
check(() => assert.equal(engine.resolveImportedSummaryFreshness({ current: { publicationId: "p", revision: "r", contractVersion: "v2", factsHash: "h", policySignature: "s" } }), "MISSING"));
check(() => assert.equal(engine.resolveImportedSummaryFreshness({ source: { publicationId: "p", revision: "r", contractVersion: "v2", factsHash: "h", policySignature: "s" }, current: { publicationId: "p", revision: "r", contractVersion: "v2", factsHash: "h", policySignature: "s" } }), "CURRENT"));

const typical = engine.computeTypicalCompositionBaseline({ pivotMonthIds: ["2026-03", "2026-04"], months: [{ month: "2026-03", complete: true, amountsByStableId: { a: money(60), b: money(40) } }, { month: "2026-04", complete: true, amountsByStableId: { a: money(40), b: money(60) } }], typicalCategoryAmount: money(100) });
check(() => assert.equal(typical.amountsByStableId.a.value, money(50)));
check(() => assert.equal(typical.total.status, "KNOWN"));
check(() => assert.throws(() => engine.computeTypicalCompositionBaseline({ pivotMonthIds: ["2026-03"], months: [{ month: "2026-03", complete: true, amountsByStableId: { a: money(90) } }], typicalCategoryAmount: money(100) }), /réconcilier/));

const explanation = engine.explainCategory({ categoryDelta: money(100), categoryMaterial: true, contributions: [{ stableId: "a", label: "A", actual: money(80), baseline: { status: "KNOWN", value: money(10) }, contribution: { status: "KNOWN", value: money(70) } }, { stableId: "b", label: "B", actual: money(0), baseline: { status: "KNOWN", value: money(30) }, contribution: { status: "KNOWN", value: money(-30) } }] });
check(() => assert.equal(explanation.drivers.length, 1));
check(() => assert.equal(explanation.compensator.stableId, "b"));
check(() => assert.equal(explanation.residual.value, money(60)));
check(() => assert.equal(engine.classifyStableIdentityLifecycle({ stableId: "x", currentAmount: money(50), currentCategoryAmount: money(200), immediatelyPrior: ["2026-04", "2026-03", "2026-02"].map((month) => ({ month, complete: true, amount: money(0) })), olderKnownPositive: false }), "NEW"));
check(() => assert.equal(engine.classifyStableIdentityLifecycle({ stableId: "x", currentAmount: money(50), currentCategoryAmount: money(200), immediatelyPrior: ["2026-04", "2026-03", "2026-02"].map((month) => ({ month, complete: true, amount: money(0) })), olderKnownPositive: true }), "REAPPEARED"));
check(() => assert.equal(engine.explainFrequencyTicket({ currentFrequency: 6, referenceFrequency: 3, currentMedianTicket: money(10), referenceMedianTicket: money(10), referenceMonths: 6, ticketSupport: 8, currentCoverage: 1 }).dominantFactor, "FREQUENCY"));
check(() => assert.equal(engine.explainFrequencyTicket({ currentFrequency: 2, referenceFrequency: 2, currentMedianTicket: money(20), referenceMedianTicket: money(10), referenceMonths: 6, ticketSupport: 4, currentCoverage: 1 }).availability, "UNKNOWN"));
const preview = engine.selectCategoryPreview([{ categoryId: "big", amount: money(100), material: false, lifecycle: "NONE", classified: true }, { categoryId: "new", amount: money(25), material: false, lifecycle: "NEW", classified: true }, { categoryId: "small", amount: money(10), material: false, lifecycle: "NONE", classified: true }, { categoryId: "unknown", amount: money(5), material: false, lifecycle: "NONE", classified: false }], 2);
check(() => assert.deepEqual(preview.selected.map(({ categoryId }) => categoryId), ["new", "big"]));
check(() => assert.equal(preview.otherAmount, money(10)));
check(() => assert.equal(preview.unclassifiedAmount, money(5)));
const merchantPurchase = engine.selectMerchantPurchaseDrivers({ candidates: [{ explanationId: "merchant", kind: "MERCHANT", label: "M", amount: money(50), contribution: money(30), subcategoryContribution: money(100), sameDirection: true, currentCoverage: 0.95, pivotCoverage: 0.95, stableIdentity: true, expenseEventIds: [], merchantRank: 3 }, { explanationId: "purchase", kind: "PURCHASE_EVENT", label: "P", amount: money(40), contribution: money(40), subcategoryContribution: money(100), sameDirection: true, currentCoverage: 1, pivotCoverage: 1, stableIdentity: true, purchaseEventId: "p1", expenseEventIds: ["e1"] }], causallyRepresentedExpenseEventIds: ["e1"], lifecycleRepresentedPurchaseEventIds: [] });
check(() => assert.deepEqual(merchantPurchase.map(({ explanationId }) => explanationId), ["merchant"]));

const spending = engine.buildSpendingAxes({ actual: money(100), components: [{ componentKey: "1", amount: money(60), necessity: "OPTIONAL", behavior: "VARIABLE", lifeScope: "CURRENT_LIFE", nonNegative: true }, { componentKey: "2", amount: money(40), necessity: "CONSTRAINED", behavior: "FIXED", lifeScope: "CURRENT_LIFE", nonNegative: true }] });
check(() => assert.equal(spending.necessity.result.status, "KNOWN"));
check(() => assert.equal(spending.matrix.immediateMargin.value, money(60)));
check(() => assert.equal(spending.matrix.mediumMargin.value, money(0)));
const partialSpending = engine.buildSpendingAxes({ actual: money(100), components: [{ componentKey: "1", amount: money(70), necessity: "OPTIONAL", behavior: "VARIABLE", nonNegative: true }, { componentKey: "2", amount: money(30), nonNegative: true }] });
check(() => assert.equal(partialSpending.necessity.result.partialMeaning, "OBSERVED_ONLY"));
check(() => assert.equal(partialSpending.matrix.immediateMargin.partialMeaning, "LOWER_BOUND"));
check(() => assert.equal(partialSpending.necessity.gapMaterial, true));
const contributorSelection = engine.selectSpendingContributors([
  { componentKey: "1", amount: money(40), categoryId: "food", subcategoryId: "groceries" },
  { componentKey: "2", amount: money(20), categoryId: "food", subcategoryId: "groceries" },
  { componentKey: "3", amount: money(20), categoryId: "transport" },
  { componentKey: "4", amount: money(15), categoryId: "home", subcategoryId: "energy" },
  { componentKey: "5", amount: money(5), categoryId: "health" },
]);
check(() => assert.deepEqual(contributorSelection.contributors.map(({ contributorId, grain }) => [contributorId, grain]), [["groceries", "SUBCATEGORY"], ["transport", "CATEGORY"], ["energy", "SUBCATEGORY"]]));
check(() => assert.equal(contributorSelection.contributors.length, 3));
check(() => assert.equal(contributorSelection.otherAmount, money(5)));

const minimal = engine.buildMinimalPreview({ minimal: money(100), components: [{ componentId: "1", label: "Loyer", family: "OBLIGATIONS", amount: money(50) }, { componentId: "2", label: "Courses", family: "VARIABLES_INDISPENSABLES", amount: money(20) }, { componentId: "3", label: "Provision", family: "PROVISIONS", amount: money(20) }, { componentId: "4", label: "Santé", family: "BESOINS_CONDITIONNELS", amount: money(10) }] });
check(() => assert.equal(minimal.families.length, 4));
check(() => assert.equal(minimal.families.reduce((total, family) => total + Number(family.amount), 0), 100));
check(() => assert.throws(() => engine.buildMinimalPreview({ minimal: money(101), components: [{ componentId: "1", label: "x", family: "OBLIGATIONS", amount: money(100) }] }), /projection additive/));

const activities = engine.rankActivities([{ activityTypeKey: "cinema", occurrences: 6, referenceOccurrences: 3, hasOtherNarrativeMoment: false, priorityBand: 2, qualifiedCostShare: 0.05, qualifiedCost: money(50) }, { activityTypeKey: "sport", occurrences: 2, referenceOccurrences: 2, bestHighlightRank: 1, hasOtherNarrativeMoment: false, priorityBand: 3, qualifiedCostShare: 0 }]);
check(() => assert.equal(activities[0].activityTypeKey, "cinema"));
check(() => assert.equal(activities[0].score, 64));
const activityEligibility = engine.rankActivities([
  { activityTypeKey: "zero-narrative", occurrences: 0, bestHighlightRank: 1, hasOtherNarrativeMoment: true, priorityBand: 4 },
  { activityTypeKey: "zero-cost", occurrences: 0, hasOtherNarrativeMoment: false, priorityBand: 4, qualifiedCostShare: 0.5, qualifiedCost: money(500) },
  { activityTypeKey: "one", occurrences: 1, hasOtherNarrativeMoment: false, priorityBand: 1 },
]);
check(() => assert.deepEqual(activityEligibility.map(({ activityTypeKey }) => activityTypeKey), ["one"]));
check(() => assert.equal(engine.rankActivities([1, 2, 3, 4].map((occurrences) => ({ activityTypeKey: `a${occurrences}`, occurrences, hasOtherNarrativeMoment: false, priorityBand: 1 }))).length, 4));
check(() => assert.throws(() => engine.computeActivityInterestScore({ activityTypeKey: "bad", occurrences: 1, referenceOccurrences: 1, hasOtherNarrativeMoment: false, priorityBand: 5 }), /erreur de contrat/));
check(() => assert.deepEqual(engine.resolveActivityCost({ causalExpenses: [{ expenseEventId: "e1", amount: money(10) }], associatedExpenses: [{ expenseEventId: "e1", amount: money(10) }, { expenseEventId: "e2", amount: money(20) }] }), { costKind: "CAUSAL", expenseEventIds: ["e1"], amount: money(10) }));
const moments = engine.rankMoments([{ momentId: "later", highlightRank: 2, priorityBand: 4, priorityWeight: 100, continuous: true, livedDaysInMonth: 10, causalCostComparable: false, startDate: "2026-05-01" }, { momentId: "first", highlightRank: 1, priorityBand: 1, priorityWeight: 1, continuous: false, livedDaysInMonth: 1, causalCostComparable: false, startDate: "2026-05-20" }]);
check(() => assert.equal(moments[0].momentId, "first"));
check(() => assert.deepEqual(engine.selectMomentMedia({ momentId: "m", periodStart: "2026-05-01", periodEnd: "2026-05-31", candidates: [{ mediaId: "later-cover", momentId: "m", capturedAt: "2026-05-20", role: "COVER", direct: true }, { mediaId: "early", momentId: "m", capturedAt: "2026-05-01", role: "OTHER", direct: true }] }), { kind: "MEDIA", mediaId: "later-cover" }));
check(() => assert.deepEqual(engine.selectMomentMedia({ momentId: "m", periodStart: "2026-05-01", periodEnd: "2026-05-31", candidates: [{ mediaId: "external", momentId: "other", capturedAt: "2026-05-20", role: "COVER", direct: true }] }), { kind: "GRAPHIC_FALLBACK" }));
const places = engine.rankPlaces([{ placeId: "home", momentCount: 0, presenceDays: 31, activityTypeCount: 0, semanticKind: "OTHER", routineKind: "HOME" }, { placeId: "trip", bestHighlightRank: 2, momentCount: 1, presenceDays: 2, activityTypeCount: 1, localizedAmount: money(100), localizedShare: 0.05, localizedCoverage: 0.9, semanticKind: "TRAVEL_STAY", routineKind: "NONE" }]);
check(() => assert.equal(places.length, 1));
check(() => assert.equal(places[0].placeId, "trip"));
check(() => assert.equal(places[0].financePoints, 10));
check(() => assert.equal(engine.selectDisplayPlaceCandidate([{ placeId: "country", authority: "CANONICAL_VISIT" }, { placeId: "city", parentPlaceId: "country", authority: "CANONICAL_VISIT" }, { placeId: "venue", parentPlaceId: "city", authority: "DIRECT_NARRATIVE" }]), "venue"));
check(() => assert.equal(engine.resolveLocalizedAmountVisibility({ localizedAmount: money(60), authoritativeLocalizableAbsoluteAmount: money(60), allLocalizableAbsoluteAmount: money(100), monotoneNonNegative: true }).detailAmount.partialMeaning, "LOWER_BOUND"));
check(() => assert.equal(engine.resolveLocalizedAmountVisibility({ localizedAmount: money(79), authoritativeLocalizableAbsoluteAmount: money(79), allLocalizableAbsoluteAmount: money(100), monotoneNonNegative: false }).cardAmount.status, "UNKNOWN"));
check(() => assert.equal(engine.resolveLocalizedAmountVisibility({ localizedAmount: money(80), authoritativeLocalizableAbsoluteAmount: money(80), allLocalizableAbsoluteAmount: money(100), monotoneNonNegative: true }).cardAmount.status, "KNOWN"));

function capabilities(resource) {
  const maximum = query.getQueryCapabilityMaximum(resource);
  return { resource: maximum.resource, availableSections: maximum.sections, availableMeasures: maximum.measures, compatibleFilters: maximum.filters, unavailable: [] };
}
const resource = query.queryResourceKeys.historyMonthBalanceSummary;
const contract = query.getQueryResourceContract(resource);
const context = { householdId: uuid(1), month: "2026-05", resourceInputHash: "a".repeat(64), policyVersions: history.resolvePolicyVersions(contract.policyIds), capabilities: capabilities(resource), sourceRefs: [{ kind: "artifact", id: "month:2026-05" }] };
const metric = (value) => ({ visibility: "VISIBLE", data: { status: "KNOWN", value } });
check(() => assert.deepEqual(query.projectAnalysisMoneyMetric({ metricId: "economic_consumption_net_attributable", scopeHash: "b".repeat(64), envelope: { availability: "known", value: money(1200), unit: "EUR", provenance: "observed", methodVersion: "economic_consumption_net_attributable@v1", support: { unit: "economic_component", n: 1, qualification: "sufficient" } } }), metric(money(1200))));
const summary = query.buildMonthBalanceSummaryReadModel({ context, actual: metric(money(1200)), typical: metric(money(1000)), minimal: metric(money(800)), comparableActualsIncludingCurrent: [money(1200), money(1000)], typicalSupportMonths: 8, importedSummary: { freshness: "MISSING" } });
check(() => assert.equal(query.monthBalanceSummaryReadModelSchema.parse(summary).month, "2026-05"));
check(() => assert.equal(summary.actualVsTypical.data.value.delta, money(200)));
check(() => assert.throws(() => query.monthBalanceSummaryReadModelSchema.parse({ ...summary, rogue: true }), (error) => error.issues?.some(({ code }) => code === "unrecognized_key")));
check(() => assert.throws(() => query.monthBalanceSummaryReadModelSchema.parse({ ...summary, importedSummary: { freshness: undefined } }), (error) => error.issues?.some(({ message }) => /undefined/.test(message))));
const categoryResource = query.queryResourceKeys.historyCategoryDetail;
const categoryContract = query.getQueryResourceContract(categoryResource);
const categoryContext = {
  ...context,
  policyVersions: history.resolvePolicyVersions(categoryContract.policyIds),
  capabilities: capabilities(categoryResource),
};
const categorySummary = {
  categoryId: "food",
  label: "Alimentation",
  actual: { status: "KNOWN", value: money(100) },
  shareOfActual: { status: "KNOWN", value: 1 },
  typical: { status: "KNOWN", value: money(100) },
  delta: { status: "KNOWN", value: money(0) },
  material: false,
  detailRef: { resource: categoryResource, params: { categoryId: "food" } },
  sourceRefs: [{ kind: "category", id: "food" }],
};
const categoryDetail = query.buildCategoryDetailReadModel({
  context: categoryContext,
  category: categorySummary,
  typicalComposition: typical,
  explanation,
  frequencyTicket: engine.explainFrequencyTicket({ currentFrequency: 1, referenceFrequency: 1, currentMedianTicket: money(10), referenceMedianTicket: money(10), referenceMonths: 8, ticketSupport: 8, currentCoverage: 1 }),
  merchantAndPurchaseDrivers: [],
  lifecycleBadges: [],
  classifications: partialSpending,
});
check(() => assert.equal(query.categoryDetailReadModelSchema.parse(categoryDetail).classificationViews.necessity.data.result.status, "PARTIAL"));
check(() => {
  for (const axis of ["necessity", "behavior", "lifeScope"]) {
    const view = categoryDetail.classificationViews[axis].data;
    assert.equal(Number(view.classifiedAmount) + Number(view.unclassifiedAmount), 100);
  }
  assert.equal(categoryDetail.classificationViews.necessity.data.unclassifiedAmount, money(30), "UNKNOWN reste explicitement non classé");
});
check(() => assert.throws(() => query.buildCategoryDetailReadModel({
  context: categoryContext,
  category: { ...categorySummary, actual: { status: "KNOWN", value: money(101) } },
  typicalComposition: typical,
  explanation,
  frequencyTicket: engine.explainFrequencyTicket({ currentFrequency: 1, referenceFrequency: 1, currentMedianTicket: money(10), referenceMedianTicket: money(10), referenceMonths: 8, ticketSupport: 8, currentCoverage: 1 }),
  merchantAndPurchaseDrivers: [],
  lifecycleBadges: [],
  classifications: partialSpending,
}), /réconcilier/));
const spendingResource = query.queryResourceKeys.historyMonthSpendingNature;
const spendingContext = {
  ...context,
  policyVersions: history.resolvePolicyVersions(query.getQueryResourceContract(spendingResource).policyIds),
  capabilities: capabilities(spendingResource),
};
const spendingReadModel = query.buildMonthSpendingNatureReadModel({
  context: spendingContext,
  actual: metric(money(100)),
  necessity: spending.necessity,
  behavior: spending.behavior,
  lifeScope: spending.lifeScope,
  matrix: spending.matrix,
  segments: [{
    segment: { axis: "necessity", bucket: "OPTIONAL" },
    amount: money(60),
    shareOfActual: 0.6,
    contributors: { visibility: "VISIBLE", data: { status: "KNOWN", items: [{ contributorId: "groceries", grain: "SUBCATEGORY", label: "Courses", amount: money(40), sourceRefs: [{ kind: "subcategory", id: "groceries" }] }], totalCount: 1 } },
    otherAmount: metric(money(20)),
    detailRef: { resource: query.queryResourceKeys.historySpendingSegmentDetail, params: { axis: "necessity", bucket: "OPTIONAL" } },
  }],
});
const { segments: _segments, ...oldSpendingReadModel } = spendingReadModel;
check(() => assert.equal(query.newMonthSpendingNatureReadModelSchema.parse(spendingReadModel).segments.data.items[0].contributors.data.items[0].grain, "SUBCATEGORY"));
check(() => assert.equal(query.oldMonthSpendingNatureReadModelSchema.parse(oldSpendingReadModel).month, "2026-05"));
check(() => assert.throws(() => query.oldMonthSpendingNatureReadModelSchema.parse(spendingReadModel), (error) => error.issues?.some(({ code }) => code === "unrecognized_key")));
check(() => assert.throws(() => query.newMonthSpendingNatureReadModelSchema.parse(oldSpendingReadModel), (error) => error.issues?.some(({ message }) => /segments/.test(message))));

const lifeMoneyResource = query.queryResourceKeys.historyMonthLifeMoney;
const lifeMoneyContext = {
  ...context,
  policyVersions: history.resolvePolicyVersions(query.getQueryResourceContract(lifeMoneyResource).policyIds),
  capabilities: capabilities(lifeMoneyResource),
};
const sevenEligible = engine.rankActivities(Array.from({ length: 7 }, (_, index) => ({ activityTypeKey: `eligible-${index}`, occurrences: index + 1, hasOtherNarrativeMoment: false, priorityBand: 1 }))).map((score) => ({
  ...score,
  label: score.activityTypeKey,
  costKind: "NONE",
  cost: { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } },
  detailRef: { resource: query.queryResourceKeys.historyActivityDetail, params: { activityTypeKey: score.activityTypeKey } },
  sourceRefs: [{ kind: "activity", id: score.activityTypeKey }],
}));
check(() => assert.equal(query.buildMonthLifeMoneyReadModel({ context: lifeMoneyContext, activities: sevenEligible, moments: [], places: [] }).activities.data.items.length, 6));
check(() => assert.equal(registry.findSchemaRegistryOrphans().length, 0));

console.log(`History V2 Month Balance: ${checks}/${checks} PASS`);
