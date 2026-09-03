import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { runInNewContext } from "node:vm";
import Big from "big.js";
import ts from "typescript";

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
const historyAnalytics = await import("../src/analytics/history-v2/index.ts");
const history = await import("../src/core/history-v2/index.ts");
const scope = await import("../src/core/scope/index.ts");
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
check(() => assert.deepEqual(engine.resolveActivityCost({ causalExpenses: [{ expenseEventId: "e1", amount: money(10), authority: "CANONICAL_CAUSAL_LINK", evidenceRefs: ["link:1"] }], associatedExpenses: [{ expenseEventId: "e1", amount: money(10), authority: "CANONICAL_ASSOCIATION", evidenceRefs: ["association:1"] }, { expenseEventId: "e2", amount: money(20), authority: "CANONICAL_ASSOCIATION", evidenceRefs: ["association:2"] }] }), { costKind: "CAUSAL", expenseEventIds: ["e1"], amount: money(10) }));
const moments = engine.rankMoments([{ momentId: "later", highlightRank: 2, priorityBand: 4, priorityWeight: 100, continuous: true, livedDaysInMonth: 10, causalCostComparable: false, startDate: "2026-05-01" }, { momentId: "first", highlightRank: 1, priorityBand: 1, priorityWeight: 1, continuous: false, livedDaysInMonth: 1, causalCostComparable: false, startDate: "2026-05-20" }]);
check(() => assert.equal(moments[0].momentId, "first"));
check(() => assert.deepEqual(engine.selectMomentMedia({ momentId: "m", periodStart: "2026-05-01", periodEnd: "2026-05-31", candidates: [{ mediaId: "later-cover", momentId: "m", capturedAt: "2026-05-20", role: "COVER", direct: true }, { mediaId: "early", momentId: "m", capturedAt: "2026-05-01", role: "OTHER", direct: true }] }), { kind: "MEDIA", mediaId: "later-cover" }));
check(() => assert.deepEqual(engine.selectMomentMedia({ momentId: "m", periodStart: "2026-05-01", periodEnd: "2026-05-31", candidates: [{ mediaId: "external", momentId: "other", capturedAt: "2026-05-20", role: "COVER", direct: true }] }), { kind: "GRAPHIC_FALLBACK" }));
const places = engine.rankPlaces([{ placeId: "home", momentCount: 0, presenceDays: 31, activityTypeCount: 0, semanticKind: "OTHER", routineKind: "HOME" }, { placeId: "trip", bestHighlightRank: 2, momentCount: 1, presenceDays: 2, activityTypeCount: 1, localizedAmount: money(100), localizedShare: 0.05, localizedCoverage: 0.9, semanticKind: "TRAVEL_STAY", routineKind: "NONE" }]);
check(() => assert.equal(places.length, 1));
check(() => assert.equal(places[0].placeId, "trip"));
check(() => assert.equal(places[0].financePoints, 10));
check(() => {
  const base = { placeId: "canonical", momentCount: 0, presenceDays: 0, activityTypeCount: 0, semanticKind: "OTHER", routineKind: "NONE" };
  for (const [routineKind, expected] of [["HOME", 35], ["REGULAR_WORK", 30], ["OTHER_ROUTINE", 15], ["NONE", 0]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, routineKind }).routinePenalty, expected);
  }
  for (const [semanticKind, expected] of [["TRAVEL_STAY", 10], ["FAMILY_FRIEND", 10], ["LEISURE_EVENT", 6], ["HEALTH", 6], ["OTHER", 0]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, semanticKind }).semanticBonus, expected);
  }
  for (const [presenceDays, expected] of [[0, 0], [1, 5], [2, 9], [3, 13], [4, 13], [5, 17], [7, 17], [8, 21], [14, 21], [15, 25]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, presenceDays }).presencePoints, expected);
  }
  for (const [momentCount, expected] of [[0, 0], [1, 18], [2, 21], [3, 24]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, momentCount }).narrativePoints, expected);
  }
  for (const [bestHighlightRank, expected] of [[1, 40], [2, 36], [3, 32], [4, 28], [5, 24]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, momentCount: 3, bestHighlightRank }).narrativePoints, expected, "Highlight et nombre de Moments ne s'additionnent pas");
  }
  for (const [activityTypeCount, expected] of [[0, 0], [1, 5], [2, 10], [3, 15]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, activityTypeCount }).activityPoints, expected);
  }
  for (const [localizedShare, expected] of [[0, 0], [0.005, 2], [0.01, 4], [0.02, 7], [0.05, 10]]) {
    assert.equal(engine.computePlaceSignificanceScore({ ...base, localizedShare, localizedCoverage: 0.8 }).financePoints, expected);
    assert.equal(engine.computePlaceSignificanceScore({ ...base, localizedShare, localizedCoverage: 0.79 }).financePoints, 0);
  }
  const visibility = engine.resolveLocalizedAmountVisibility({ localizedAmount: "80", authoritativeLocalizableAbsoluteAmount: "80", allLocalizableAbsoluteAmount: "100", monotoneNonNegative: true });
  assert.equal(visibility.cardAmount.quality.coverage.basis, "localizable_spend_scope");
});
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

function officialAuthorityResolver(input) {
  const referenceMonths = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"];
  return {
    async resolve(metricId, requestedScope) {
      const scopeHash = scope.computeScopeHash(scope.normalizeAnalysisScope(requestedScope));
      if (metricId === "minimal_month_cost") {
        return {
          kind: "minimal_month",
          scopeHash,
          availability: "known",
          neutralVariableComponents: [{
            canonicalComponentKey: "minimal:need:test",
            amount: money(input.minimal),
            support: { n: 6, unit: "month", level: "sufficient" },
            coverage: { level: "complete" },
            provenance: "derived",
          }],
          mandatoryMonthlyObligationsAndProvisions: [],
          coverage: { level: "complete" },
        };
      }
      assert.equal(metricId, "typical_month_cost");
      const normalized = scope.normalizeAnalysisScope(requestedScope);
      const categoryFiltered = normalized.filters.categoryIds.length > 0;
      const value = money(categoryFiltered ? input.categoryTypical : input.typical);
      return {
        kind: "typical_month",
        scopeHash,
        window: {
          family: "comparison",
          householdId: uuid(1),
          householdTimeZone: "Europe/Paris",
          asOf: "2026-05",
          targetPeriod: "2026-05",
          requestedPeriodCount: 12,
          includedPeriods: referenceMonths,
          excludedPeriods: [],
          effectivePeriodCount: referenceMonths.length,
          firstIncluded: referenceMonths[0],
          lastIncluded: referenceMonths.at(-1),
        },
        monthlyObservations: referenceMonths.map((period) => ({ period, value })),
      };
    },
  };
}

const unrelatedOracle = { typical: "9999", minimal: "9999", categoryTypical: "9999" };
const authorityCategoryId = uuid(9);
const officialBeforeOracleMutation = await historyAnalytics.resolveHistoryV2BalanceAnalyticsAuthority({
  resolver: officialAuthorityResolver({ typical: 1000, minimal: 800, categoryTypical: 120 }),
  month: "2026-05",
  categoryIds: [authorityCategoryId],
});
unrelatedOracle.typical = "1";
unrelatedOracle.minimal = "2";
unrelatedOracle.categoryTypical = "3";
const officialAfterOracleMutation = await historyAnalytics.resolveHistoryV2BalanceAnalyticsAuthority({
  resolver: officialAuthorityResolver({ typical: 1000, minimal: 800, categoryTypical: 120 }),
  month: "2026-05",
  categoryIds: [authorityCategoryId],
});
const metricReadModel = (produced) => {
  const { metricId, scopeHash, referenceWindow: _referenceWindow, estimationTrace: _estimationTrace, ...envelope } = produced;
  return { metricId, scopeHash, envelope };
};
const authoritySummary = (authority) => query.buildMonthBalanceSummaryReadModel({
  context,
  actual: metric(money(1200)),
  typical: query.projectAnalysisMoneyMetric(metricReadModel(authority.typical.metric)),
  minimal: query.projectAnalysisMoneyMetric(metricReadModel(authority.minimal.metric)),
  comparableActualsIncludingCurrent: [money(1000), money(1200)],
  typicalSupportMonths: authority.typical.metric.support?.n ?? 0,
  importedSummary: { freshness: "MISSING" },
});
check(() => {
  assert.deepEqual(officialAfterOracleMutation, officialBeforeOracleMutation);
  assert.deepEqual(
    authoritySummary(officialAfterOracleMutation),
    authoritySummary(officialBeforeOracleMutation),
    "modifier uniquement l'oracle ne doit modifier aucun payload History construit",
  );
});

const changedOfficialAnalytics = await historyAnalytics.resolveHistoryV2BalanceAnalyticsAuthority({
  resolver: officialAuthorityResolver({ typical: 1100, minimal: 850, categoryTypical: 140 }),
  month: "2026-05",
  categoryIds: [authorityCategoryId],
});
check(() => {
  assert.equal(officialBeforeOracleMutation.typical.metric.value, money(1000));
  assert.equal(changedOfficialAnalytics.typical.metric.value, money(1100));
  assert.equal(officialBeforeOracleMutation.minimal.metric.value, money(800));
  assert.equal(changedOfficialAnalytics.minimal.metric.value, money(850));
  assert.equal(officialBeforeOracleMutation.categoryTypicals[0].metric.value, money(120));
  assert.equal(changedOfficialAnalytics.categoryTypicals[0].metric.value, money(140));
  assert.equal(authoritySummary(officialBeforeOracleMutation).typicalValue.data.value, money(1000));
  assert.equal(authoritySummary(changedOfficialAnalytics).typicalValue.data.value, money(1100));
  assert.equal(authoritySummary(officialBeforeOracleMutation).minimalValue.data.value, money(800));
  assert.equal(authoritySummary(changedOfficialAnalytics).minimalValue.data.value, money(850));
});

const certificationSource = readFileSync(new URL("./check-history-v2-certification-12-months.mjs", import.meta.url), "utf8");
check(() => {
  assert.doesNotMatch(certificationSource, /data\.oracle/u);
  assert.match(certificationSource, /resolveHistoryV2BalanceAnalyticsAuthority/u);
  assert.match(certificationSource, /dailyByMonth\.get\(month\)\.actualMonthAmount/u);
  assert.match(certificationSource, /officialMetricNode\(data\.analyticsAuthority\.minimal\.metric\)/u);
});

// HC2: run through the real Canonical-classification and financial-link Facts.
const facts = await import("../src/analytics/facts/index.ts");
const component = (id, amount, overrides = {}) => ({
  fact: "fct_economic_component", householdId: uuid(1), householdTimeZone: "Europe/Paris",
  canonicalComponentKey: `operation:${uuid(id)}`, sourceOperation: { kind: "resolved", id: uuid(id) },
  net: money(amount), category: { kind: "resolved", id: uuid(2) }, subcategory: { kind: "unknown" },
  moment: { kind: "resolved", id: uuid(3) }, canonicalPlace: { kind: "unknown" },
  necessity: { kind: "resolved", value: "probablement indispensable" },
  behavior: { kind: "resolved", value: "pas fixe" }, lifeScope: { kind: "resolved", value: "hors quotidien" },
  ...overrides,
});
const hComponents = [component(11, 60), component(12, 40)];
const hCandidates = hComponents.map((value, index) => ({
  householdId: value.householdId, canonicalComponentKey: value.canonicalComponentKey,
  sourceOperationId: value.sourceOperation.id, operationMixed: false,
  sourceValues: index === 0 ? { NECESSITY: "Optionnelle", BEHAVIOR: "Variable", LIFE_SCOPE: "Hors quotidien" }
    : { NECESSITY: "probablement indispensable", BEHAVIOR: "pas fixe", LIFE_SCOPE: "quotidien inconnu" },
  operationValues: {},
}));
const hClassifications = facts.resolveEconomicComponentClassifications({ candidates: hCandidates, assertions: [] });
const hProjected = historyAnalytics.projectHistorySpendingComponents(hComponents, hClassifications);
check(() => {
  assert.equal(hProjected[0].lifeScope, "OUT_OF_DAILY", "Hors quotidien ne doit plus être capturé comme CURRENT_LIFE");
  assert.equal(hProjected[1].necessity, undefined);
  assert.equal(hProjected[1].behavior, undefined);
  assert.equal(hProjected[1].lifeScope, undefined);
  assert.equal(hProjected[1].classificationStates.necessity, "UNKNOWN");
});
check(() => {
  const axes = engine.buildSpendingAxes({ actual: "100", components: hProjected });
  for (const name of ["necessity", "behavior", "lifeScope", "matrix"]) {
    assert.equal(Number(axes[name].classifiedAmount) + Number(axes[name].unclassifiedAmount), 100);
  }
  assert.equal(axes.necessity.result.status, "PARTIAL");
  assert.equal(axes.necessity.result.partialMeaning, "OBSERVED_ONLY");
  assert.equal(axes.matrix.immediateMargin.partialMeaning, "LOWER_BOUND");
});
check(() => {
  const conflicting = facts.resolveEconomicComponentClassifications({ candidates: hCandidates, assertions: [{
    canonicalComponentKey: hComponents[0].canonicalComponentKey, axis: "NECESSITY",
    resolution: { status: "CONFLICT", value: null, authority: "EXPLICIT_COMPONENT_OVERRIDE", evidenceRefs: ["a", "b"], provenance: "EXPLICIT_USER_ASSERTION" },
  }] });
  const axes = engine.buildSpendingAxes({ actual: "100", components: historyAnalytics.projectHistorySpendingComponents(hComponents, conflicting) });
  assert.equal(axes.necessity.result.status, "CONFLICT");
  assert.equal(axes.matrix.immediateMargin.status, "CONFLICT");
  assert.equal(axes.necessity.unclassifiedAmount, "100");
});
check(() => {
  const axes = engine.buildSpendingAxes({ actual: "0", components: [{ componentKey: "a", amount: "10", nonNegative: true }, { componentKey: "b", amount: "-10", nonNegative: false }] });
  assert.equal(axes.necessity.result.status, "UNKNOWN", "Un gap net nul ne prouve jamais une couverture complète");
  assert.equal(axes.matrix.immediateMargin.status, "UNKNOWN");
  assert.equal(engine.buildSpendingAxes({ actual: "0", components: [] }).necessity.result.status, "NOT_APPLICABLE");
  assert.throws(() => engine.buildSpendingAxes({ actual: "1", components: hProjected }), /réconcilier/);
});
check(() => {
  const assertedUnknown = { ...hClassifications[0], necessity: { ...hClassifications[0].necessity, status: "UNKNOWN", value: null } };
  assert.equal(historyAnalytics.projectHistorySpendingComponents([hComponents[0]], [assertedUnknown])[0].necessity, undefined);
  assert.throws(() => historyAnalytics.projectHistorySpendingComponents([hComponents[0]], [{ ...hClassifications[0], necessity: { ...hClassifications[0].necessity, evidenceRefs: [] } }]), /preuve/);
});

const canonicalMomentRelations = historyAnalytics.projectCanonicalMomentRelations(hComponents);
const contextualMomentRelations = hComponents.map((component) => ({
  householdId: component.householdId, momentId: component.moment.id, componentKey: component.canonicalComponentKey,
  kind: "UNDEFINED", authority: "CANONICAL_MOMENT_REFERENCE",
}));
check(() => {
  assert.ok(canonicalMomentRelations.every(({ kind, authority, evidenceRefs }) => kind === "CAUSAL"
    && authority === "CANONICAL_COMPONENT_MOMENT" && evidenceRefs[0].startsWith("financial_economic_cost_canonical:")));
  const resolved = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: canonicalMomentRelations });
  assert.equal(resolved.causalCost.status, "KNOWN");
  assert.equal(resolved.causalCost.value, "100");
});
check(() => {
  assert.ok(contextualMomentRelations.every(({ kind }) => kind === "UNDEFINED"), "Une référence non qualifiée ne prouve ni CAUSAL ni ASSOCIATED");
  const cost = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: contextualMomentRelations });
  const during = query.computeSpentDuring({ expenses: { status: "KNOWN", totalCount: 1, items: [{ expenseEventId: "unrelated", economicDate: "2026-05-12", amount: "60" }] }, window: { startDate: "2026-05-10", endDate: "2026-05-15" } });
  assert.equal(during.status, "KNOWN");
  assert.equal(during.value, "60");
  assert.equal(cost.causalCost.status, "UNKNOWN");
  assert.deepEqual(cost.causalComponentKeys, []);
});
const explicitMomentRelation = { ...contextualMomentRelations[0], kind: "CAUSAL", authority: "EXPLICIT_CANONICAL_CAUSAL_LINK", evidenceRefs: ["synthetic-explicit-assertion:1"], amount: "60", sourceEconomicAmount: "60" };
check(() => {
  const association = { ...contextualMomentRelations[0], kind: "CONTEXTUAL", authority: "EXPLICIT_CANONICAL_ASSOCIATION", evidenceRefs: ["synthetic-association:1"] };
  const resolved = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [association] });
  assert.equal(resolved.causalCost.status, "UNKNOWN");
  assert.deepEqual(resolved.causalComponentKeys, []);
  assert.throws(() => historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [{ ...association, authority: "CANONICAL_MOMENT_REFERENCE" }] }), /association Moment qualifiée/);
  assert.throws(() => historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [{ ...association, evidenceRefs: [] }] }), /association Moment qualifiée/);
});
check(() => {
  const result = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [
    ...contextualMomentRelations,
    explicitMomentRelation,
    { ...explicitMomentRelation, householdId: uuid(8), amount: "999" },
    { ...explicitMomentRelation, momentId: uuid(8), componentKey: `operation:${uuid(88)}`, amount: "999", sourceEconomicAmount: "999" },
  ] });
  assert.equal(result.causalCost.value, "60", "Seule la preuve causale du Household/Moment demandé contribue");
  assert.equal(result.causalCost.status, "PARTIAL", "L'autre référence non qualifiée reste non résolue");
  assert.deepEqual(result.causalComponentKeys, [hComponents[0].canonicalComponentKey]);
});

check(() => {
  const twice = [canonicalMomentRelations[0], { ...canonicalMomentRelations[0], momentId: uuid(8) }];
  for (const momentId of [uuid(3), uuid(8)]) {
    assert.equal(historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId, relations: twice }).causalCost.status, "CONFLICT");
  }
  const split = [
    { ...explicitMomentRelation, amount: "20" },
    { ...explicitMomentRelation, amount: "40", momentId: uuid(8) },
  ];
  assert.equal(historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: split }).causalCost.value, "20");
  assert.equal(historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(8), relations: split }).causalCost.value, "40");
  assert.equal(historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [...split, split[0]] }).causalCost.value, "20");
  for (const amounts of [["-40", "-20"], ["40", "-20"]]) {
    const relations = split.map((relation, index) => ({ ...relation, sourceEconomicAmount: "-60", amount: amounts[index] }));
    const cost = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations }).causalCost;
    assert.equal(cost.status, amounts[0].startsWith("-") ? "KNOWN" : "CONFLICT", "Le net signé ne permet pas de masquer une sur-attribution");
  }
  const cancellingPartials = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [
    { ...explicitMomentRelation, sourceEconomicAmount: "100", amount: "80" },
    { ...explicitMomentRelation, componentKey: "refund", sourceEconomicAmount: "-40", amount: "-20" },
  ] });
  assert.equal(cancellingPartials.causalCost.value, "60");
  assert.equal(historyAnalytics.isWhollyCausalMomentExpense({ componentKeys: [explicitMomentRelation.componentKey, "refund"], amount: "60" }, cancellingPartials), false, "Deux attributions partielles qui se compensent ne possèdent pas l'achat entier");
});

// Exercise the strict physical-row projector, not a Fact bearing a suggestive field name.
function physicalComponentFixture(sourceKind = "Operation", momentId = uuid(3)) {
  const [prefix, layer] = { Operation: ["operation", "Operation_parent"], Allocation: ["allocation", "Allocation"], Item: ["item", "Item"], Payment_component: ["payment_component", "Payment_component"], Cash_use: ["cash_use", "Cash_economic_use"] }[sourceKind];
  const key = `${prefix}:${uuid(11)}`;
  return {
    household: { householdId: uuid(1), householdTimeZone: "Europe/Paris" },
    economicComponent: { operation_id: uuid(11), cash_use_id: sourceKind === "Cash_use" ? uuid(11) : null, source_layer: layer, component_id: uuid(11), canonical_economic_gross: "100", refund_applied: "40", canonical_economic_net: "60", category_id: null, subcategory_id: null, moment_id: momentId, canonical_economic_amount: "60", canonical_component_key: key, source_kind: sourceKind },
    operation: { operation_id: uuid(11), date_bancaire: "2026-03-01", mois_analytique_force: null, date_transaction_reelle: "2026-03-01", date_transaction_precision: "Jour exact", merchant_id: uuid(9), importance: null, nature_fixe_variable: null, contexte_vie: null },
    place: { canonical_component_key: key, operation_id: sourceKind === "Cash_use" ? null : uuid(11), place_id: uuid(9), resolution_state: "known" },
    timingRows: [], timingControl: { canonical_component_key: key, canonical_economic_net: "60", segment_count: 0, known_count: 0, partial_count: 0, unknown_count: 0, household_count: 1, household_mismatch_count: 0, segment_amount_sum: null, amount_delta: null, status: "UNKNOWN" },
    reconciliationControl: { operation_id: uuid(11), economic_gross_delta: "0", economic_refund_resolution: "RESOLVED", economic_status: "OK" },
  };
}
check(() => {
  for (const kind of ["Operation", "Allocation", "Item", "Payment_component", "Cash_use"]) {
    const projected = facts.projectEconomicComponentFact(physicalComponentFixture(kind));
    assert.deepEqual(projected.moment, { kind: "resolved", id: uuid(3) });
    const relations = historyAnalytics.projectCanonicalMomentRelations([projected]);
    const cost = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations }).causalCost;
    assert.equal(cost.value, "60", `${kind}: net après remboursement, y compris avant la période du Moment`);
    assert.ok(relations[0].evidenceRefs[0].includes(projected.canonicalComponentKey));
    const withoutLink = facts.projectEconomicComponentFact(physicalComponentFixture(kind, null));
    assert.equal(withoutLink.merchant.id, uuid(9));
    assert.equal(withoutLink.canonicalPlace.placeId, uuid(9));
    assert.equal(historyAnalytics.projectCanonicalMomentRelations([withoutLink]).length, 0, "Même lieu/marchand ne reconstitue jamais le lien absent");
  }
});

{
  // Execute the actual repository method with a recording read-only client.
  const repositorySource = readFileSync(new URL("../src/server/canonical/repository.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("repository.ts", repositorySource, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find((node) => ts.isClassDeclaration(node) && node.name.text === "CanonicalRepository");
  const method = declaration.members.find((node) => node.name?.getText(ast) === "loadEconomicFactsByMomentIds");
  const js = ts.transpileModule(`class Probe { ${method.getText(ast)} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const Probe = runInNewContext(`${js}; Probe`, { unique: (ids) => [...new Set(ids)].sort() });
  const probe = new Probe();
  const calls = [];
  probe.assertAuthorizedCanonicalHouseholdScope = async () => calls.push("household");
  probe.cached = (_, read) => read();
  const rows = [physicalComponentFixture().economicComponent];
  probe.client = { from: (view) => { calls.push(view); return { select: (selection) => { assert.ok(selection.split(",").includes("moment_id")); return { in: (column, ids) => { calls.push([column, [...ids]]); return { order: () => rows }; } }; } }; } };
  probe.readRowsByInBatches = async (_key, source, ids, _identity, _order, read) => { assert.equal(source, "economic"); return read(ids); };
  probe.projectEconomicComponentRows = async (input) => { assert.equal(input, rows); return input.map((economicComponent) => facts.projectEconomicComponentFact({ ...physicalComponentFixture(), economicComponent })); };
  const loaded = await probe.loadEconomicFactsByMomentIds([uuid(3), uuid(3)]);
  check(() => {
    assert.equal(calls[0], "household");
    assert.equal(calls[1], "financial_economic_cost_canonical");
    assert.deepEqual(calls[2], ["moment_id", [uuid(3)]]);
    assert.equal(loaded[0].net, "60");
    assert.doesNotMatch(method.getText(ast), /date_bancaire|\.gte\(|\.lt\(|month|range/);
    assert.match(certificationSource, /projectCanonicalMomentRelations\(await repository\.loadEconomicFactsByMomentIds\(momentIds\)\)/);
  });
}
check(() => {
  assert.throws(() => historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [{ ...explicitMomentRelation, evidenceRefs: [] }] }), /assertion causale/);
  assert.throws(() => historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [{ ...explicitMomentRelation, authority: "CANONICAL_MOMENT_REFERENCE" }] }), /assertion causale/);
  const resolved = historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [explicitMomentRelation, explicitMomentRelation] });
  assert.equal(resolved.causalCost.value, "60");
  assert.equal(historyAnalytics.resolveMomentFinancialCost({ householdId: uuid(1), momentId: uuid(3), relations: [...contextualMomentRelations, explicitMomentRelation] }).causalCost.status, "PARTIAL");
});

const activityOccurrence = { householdId: uuid(1), householdTimeZone: "Europe/Paris", lifeEventId: uuid(5), activityId: "cinema" };
const linkRow = { financial_link_id: uuid(6), life_event_id: uuid(5), source_kind: "Operation", operation_id: uuid(11), allocation_id: null, item_id: null, cash_use_id: null, relation_type: "Paiement_activite", economic_amount_linked: "60", validation_status: "Confirmé" };
const activityFacts = (rows) => facts.buildActivityOccurrenceCostFacts({ occurrences: [activityOccurrence], components: [hComponents[0]], links: facts.parseActivityCausalFinancialLinks(rows) });
check(() => {
  for (const relation_type of ["Contexte", "Effectue_pendant"]) {
    const resolved = historyAnalytics.resolveHistoryActivityCost(activityFacts([{ ...linkRow, relation_type }]));
    assert.equal(resolved.costKind, "NONE");
    assert.equal(resolved.cost.status, "UNKNOWN");
  }
  assert.equal(historyAnalytics.resolveHistoryActivityCost(activityFacts([linkRow])).costKind, "CAUSAL");
  assert.equal(historyAnalytics.resolveHistoryActivityCost(activityFacts([linkRow])).cost.value, "60");
  assert.equal(historyAnalytics.resolveHistoryActivityCost(activityFacts([{ ...linkRow, validation_status: "À réexaminer" }])).costKind, "NONE");
  const unresolvedCausal = historyAnalytics.resolveHistoryActivityCost(activityFacts([{ ...linkRow, economic_amount_linked: null }]));
  assert.equal(unresolvedCausal.costKind, "CAUSAL");
  assert.equal(unresolvedCausal.cost.status, "UNKNOWN");
  assert.equal(unresolvedCausal.cost.quality.reasonCode, "DATA_PARTIAL_SOURCE");
});
check(() => {
  assert.throws(() => historyAnalytics.resolveHistoryActivityCost([{ ...activityFacts([linkRow])[0], evidence: [] }]), /preuve causale/);
  assert.throws(() => engine.resolveActivityCost({ causalExpenses: [], associatedExpenses: [{ expenseEventId: "x", amount: "10" }] }), /autorité explicite/);
  assert.throws(() => engine.resolveActivityCost({ causalExpenses: [{ expenseEventId: "x", amount: "10" }], associatedExpenses: [] }), /autorité explicite/);
  const partial = historyAnalytics.resolveHistoryActivityCost([...activityFacts([linkRow]), { ...activityFacts([])[0], occurrenceId: uuid(7) }]);
  assert.equal(partial.cost.status, "PARTIAL");
  assert.equal(partial.cost.partialMeaning, "OBSERVED_ONLY");
});

const localizedComponent = (amount) => component(11, amount, { canonicalPlace: { kind: "resolved", placeId: uuid(9), resolution: "operation_place_canonical" } });
check(() => {
  assert.equal(historyAnalytics.resolveHistoryPlaceFinance([component(11, 100)], uuid(9)).cardAmount.status, "UNKNOWN");
  assert.equal(historyAnalytics.resolveHistoryPlaceFinance([component(11, 100)], uuid(9)).localizedCoverage, 0);
  const result = historyAnalytics.resolveHistoryPlaceFinance([localizedComponent(60), component(12, 40)], uuid(9));
  assert.equal(result.localizedCoverage, 0.6);
  assert.equal(result.cardAmount.status, "UNKNOWN");
  assert.equal(result.detailAmount.status, "PARTIAL");
  assert.equal(result.detailAmount.partialMeaning, "LOWER_BOUND");
});
check(() => {
  const high = historyAnalytics.resolveHistoryPlaceFinance([localizedComponent(80), component(12, 20)], uuid(9));
  assert.equal(high.cardAmount.status, "KNOWN");
  assert.equal(high.localizedCoverage, 0.8);
  assert.equal(historyAnalytics.resolveHistoryPlaceFinance([localizedComponent(59), component(12, 41)], uuid(9)).detailAmount.status, "UNKNOWN");
  assert.equal(historyAnalytics.resolveHistoryPlaceFinance([localizedComponent(60), component(12, -40)], uuid(9)).detailAmount.partialMeaning, "OBSERVED_ONLY");
  assert.equal(historyAnalytics.resolveHistoryPlaceFinance([component(11, 100, { canonicalPlace: { kind: "not_applicable" } })], uuid(9)).detailAmount.status, "NOT_APPLICABLE");
});
check(() => {
  const score = engine.computePlaceSignificanceScore({ placeId: "visited", presenceDays: 14 });
  assert.equal(score.financePoints, 0);
  assert.equal(score.localizedAmount, undefined);
  assert.equal(score.momentCount, undefined);
  assert.deepEqual(score.missingInputs, ["momentCount", "activityTypeCount", "semanticKind", "routineKind"]);
  assert.equal(score.quality.reasonCode, "DATA_PARTIAL_SOURCE");
});
check(() => {
  assert.doesNotMatch(certificationSource, /function (necessity|behavior|lifeScope)\(|routineToken|localizedCoverage:\s*1|momentCount:\s*0|activityTypeCount:\s*0/);
  assert.doesNotMatch(certificationSource.slice(certificationSource.indexOf("function placeState"), certificationSource.indexOf("function causalCostByCalendarItem")), /normalizeToken/);
  assert.match(certificationSource, /repository\.loadEconomicComponentClassifications\(range\)/);
  assert.match(certificationSource, /projectHistorySpendingComponents\(data\.facts, data\.classifications\)/);
  assert.match(certificationSource, /resolveHistoryPlaceFinance\(data\.facts, placeId\)/);
  assert.doesNotMatch(certificationSource, /amountByMoment|factValue\(fact, "moment"\)/);
});
check(() => {
  const types = historyAnalytics.historyPlaceActivityTypes([
    { ...activityOccurrence, activityId: "cinema" },
    { ...activityOccurrence, lifeEventId: uuid(7), activityId: "cinema" },
  ], [{ lifeEventId: uuid(5), placeId: uuid(9) }, { lifeEventId: uuid(7), placeId: uuid(9) }]);
  assert.equal(types.get(uuid(9)).size, 1, "Types distincts, pas nombre d'occurrences");
  assert.equal(historyAnalytics.historyPlaceActivityTypes([activityOccurrence], []).size, 0);
});
check(() => {
  // Execute the actual publication producer functions, not reimplementations in tests.
  const file = ts.createSourceFile("certification.mjs", certificationSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = file.statements.filter(ts.isFunctionDeclaration).map((node) => node.getText(file)).join("\n");
  const producerPlaceLabels = new Map([[uuid(9), "Maison / travail (ce label ne qualifie pas la routine)"]]);
  const producer = runInNewContext(`${functions}\n({ spendingState, momentState, placeState, expenseDescriptorsFor, buildActivityDetail, buildPlaceDetail, buildMomentDetail })`, {
    Big, historyAnalytics, balance: engine, historyQuery: query, query, householdId: uuid(1),
    parseActivityCausalFinancialLinks: facts.parseActivityCausalFinancialLinks,
    knownCollection: (items) => ({ visibility: "VISIBLE", data: { status: "KNOWN", items, totalCount: items.length } }),
    placeLabels: producerPlaceLabels,
    merchantLabels: new Map(), zero: "0",
    sumMoney: (values) => values.reduce((sum, value) => sum.plus(value), new Big(0)).toFixed(),
    target: (resource, params) => ({ resource, params }), sourceRef: (kind, id) => ({ kind, id }),
    daysBetween: (start, end) => (Date.parse(end) - Date.parse(start)) / 86400000,
  });
  const data = {
    facts: [localizedComponent(60), component(12, 40)], classifications: hClassifications,
    occurrences: [], primaryPlaces: [], visits: Array.from({ length: 14 }, (_, day) => ({ placeId: uuid(9), localDate: `2026-05-${String(day + 1).padStart(2, "0")}` })),
    momentRelations: contextualMomentRelations,
    dailyArtifact: { actualMonthAmount: "100" },
    calendarArtifact: { items: { status: "KNOWN", items: [{ calendarItemId: "moment-fixture", sourceKind: "moment", sourceRefs: [`moment:${uuid(3)}`], startDate: "2026-05-10", endDate: "2026-05-15", priorityBand: 4, priorityWeight: 80, title: "Moment", iconKey: "family" }] } },
  };
  assert.equal(producer.spendingState(data).lifeScope.unclassifiedAmount, "40");
  assert.equal(producer.momentState(data).summaries[0].causalCost.status, "UNKNOWN");
  const place = producer.placeState(data).summaries[0];
  assert.equal(place.routinePenalty, 0);
  assert.ok(place.missingInputs.includes("routineKind"));
  assert.equal(place.localizedAmount.status, "UNKNOWN");
  const m4 = query.monthLifeMoneyReadModelSchema.parse(query.buildMonthLifeMoneyReadModel({
    context: lifeMoneyContext, activities: [], moments: producer.momentState(data).summaries, places: [place],
  }));
  assert.equal(m4.places.data.items[0].quality.reasonCode, "DATA_PARTIAL_SOURCE");
  assert.equal(m4.moments.data.items[0].causalCost.status, "UNKNOWN");
  const canonicalData = { ...data, momentState: undefined, momentRelations: canonicalMomentRelations };
  const canonicalM4 = query.monthLifeMoneyReadModelSchema.parse(query.buildMonthLifeMoneyReadModel({
    context: lifeMoneyContext, activities: [], moments: producer.momentState(canonicalData).summaries, places: [place],
  }));
  assert.equal(canonicalM4.moments.data.items[0].causalCost.value, "100", "L'autorité réelle atteint le ReadModel M4");
  const placeResource = query.queryResourceKeys.historyPlaceDetail;
  const placeContext = {
    ...context, policyVersions: history.resolvePolicyVersions(query.getQueryResourceContract(placeResource).policyIds),
    capabilities: capabilities(placeResource),
  };
  const partialPlaceDetail = query.placeDetailReadModelSchema.parse(producer.buildPlaceDetail(data, placeContext, uuid(9)));
  assert.equal(partialPlaceDetail.localizedCoverage.value, 0.6);
  assert.equal(partialPlaceDetail.localizedAmount.data.status, "PARTIAL");
  assert.equal(partialPlaceDetail.localizedAmount.data.value, "60");
  for (const label of ["Domicile Domicile Domicile", "Travail régulier Travail régulier", "Lieu sans qualification"]) {
    producerPlaceLabels.set(uuid(9), label);
    const repeated = producer.placeState({ ...data, placeState: undefined, visits: Array.from({ length: 31 }, (_, day) => ({ placeId: uuid(9), localDate: `2026-05-${String(day + 1).padStart(2, "0")}` })) }).summaries[0];
    assert.ok(repeated.missingInputs.includes("routineKind"));
    assert.ok(repeated.missingInputs.includes("semanticKind"));
    assert.equal(repeated.routinePenalty, 0, "Aucune qualification de routine depuis le label ou le nombre de présences");
    assert.equal(repeated.quality.reasonCode, "DATA_PARTIAL_SOURCE");
    assert.equal(repeated.localizedAmount.status, "UNKNOWN");
  }
  const officialFinanceData = { ...data, placeState: undefined, facts: [localizedComponent(80), component(12, 20)] };
  const officialPlaceDetail = query.placeDetailReadModelSchema.parse(producer.buildPlaceDetail(officialFinanceData, placeContext, uuid(9)));
  assert.equal(officialPlaceDetail.localizedCoverage.value, 0.8);
  assert.equal(officialPlaceDetail.localizedAmount.data.status, "KNOWN");
  assert.equal(officialPlaceDetail.localizedAmount.data.value, "80", "La finance canonique prouvée reste exposée dans le RM sans inventer la routine");
  assert.ok(officialPlaceDetail.place.missingInputs.includes("routineKind"));
  const refundPlace = producer.placeState({ ...data, placeState: undefined, facts: [localizedComponent(-80), component(12, 20)] }).summaries[0];
  assert.equal(refundPlace.financePoints, 0, "Un montant net négatif ne devient pas une part positive via abs()");
  const presenceOnlyData = { ...data, placeState: undefined, facts: [component(11, 60), component(12, 40)] };
  const presenceOnlyDetail = query.placeDetailReadModelSchema.parse(producer.buildPlaceDetail(presenceOnlyData, placeContext, uuid(9)));
  assert.equal(presenceOnlyDetail.localizedCoverage.value, 0);
  assert.equal(presenceOnlyDetail.localizedAmount.visibility, "PLACEHOLDER");
  assert.equal(presenceOnlyDetail.presenceDays.data.items.length, 14, "Les présences connues ne sont pas perdues faute d'autorité financière");
  const ledger = { expenseEvents: [{ expenseEventId: "e", componentKeys: [hComponents[0].canonicalComponentKey], economicAmount: "60" }] };
  const descriptors = producer.expenseDescriptorsFor("2026-05", data.facts, ledger, [], contextualMomentRelations, data.calendarArtifact);
  assert.equal(descriptors[0].narrativeOwnerId, undefined, "moment_id contextuel ne devient pas un owner causal");
  assert.equal(producer.expenseDescriptorsFor("2026-05", data.facts, ledger, [], canonicalMomentRelations, data.calendarArtifact)[0].narrativeOwnerId, "moment-fixture");
  ledger.expenseEvents[0].economicAmount = "100";
  assert.equal(producer.expenseDescriptorsFor("2026-05", data.facts, ledger, [], canonicalMomentRelations, data.calendarArtifact)[0].narrativeOwnerId, undefined, "Une composante de 60 ne possède pas l'achat de 100");
  const momentResource = query.queryResourceKeys.historyMomentDetail;
  const momentContext = { ...context, policyVersions: history.resolvePolicyVersions(query.getQueryResourceContract(momentResource).policyIds), capabilities: capabilities(momentResource) };
  const momentDetailData = {
    ...canonicalData,
    expenseSummaries: [
      { expenseEventId: "causal-before", economicDate: "2026-05-01", label: "Préparation", eventKind: "ECONOMIC_CHARGE", amount: "60", sourceRefs: [{ kind: "economic_component", id: hComponents[0].canonicalComponentKey }] },
      { expenseEventId: "unrelated-during", economicDate: "2026-05-12", label: "Sans lien causal", eventKind: "ECONOMIC_CHARGE", amount: "20", sourceRefs: [{ kind: "economic_component", id: `operation:${uuid(99)}` }] },
      { expenseEventId: "causal-during", economicDate: "2026-05-13", label: "Causal", eventKind: "ECONOMIC_CHARGE", amount: "40", sourceRefs: [{ kind: "economic_component", id: hComponents[1].canonicalComponentKey }] },
    ],
    dailyArtifact: { ...data.dailyArtifact, unassignedEconomicAmount: { status: "KNOWN", value: "0" } },
  };
  const momentDetail = query.momentDetailReadModelSchema.parse(producer.buildMomentDetail(momentDetailData, momentContext, uuid(3)));
  assert.equal(momentDetail.causalCost.data.value, "100");
  assert.equal(momentDetail.spentDuring.data.value, "60", "Temporel=20+40 ; causal=60+40, jamais assimilés");
  assert.equal(momentDetail.causalExpenses.data.items.length, 2);
  momentDetailData.expenseSummaries[0].amount = "100";
  assert.equal(producer.buildMomentDetail(momentDetailData, momentContext, uuid(3)).causalExpenses.data.items.length, 1, "Le détail exclut l'achat partiellement causal");
  const activityResource = query.queryResourceKeys.historyActivityDetail;
  const activityContext = {
    ...context, policyVersions: history.resolvePolicyVersions(query.getQueryResourceContract(activityResource).policyIds),
    capabilities: capabilities(activityResource),
  };
  const detailData = {
    ...data,
    occurrences: [{ ...activityOccurrence, startDate: "2026-05-12" }],
    activityCosts: activityFacts([linkRow]), causalLinks: [linkRow],
    activityState: { summaries: [{ ...sevenEligible[0], activityTypeKey: "cinema", costKind: "CAUSAL", cost: { status: "KNOWN", value: "60" } }] },
    expenseSummaries: [{ expenseEventId: "purchase", amount: "100" }],
    dailyArtifact: { expenseEvents: [{ expenseEventId: "purchase", componentKeys: [hComponents[0].canonicalComponentKey] }] },
  };
  const partialDetail = producer.buildActivityDetail(detailData, activityContext, "cinema");
  assert.equal(partialDetail.causalExpenses.data.status, "PARTIAL");
  assert.equal(partialDetail.causalExpenses.data.items.length, 0, "Une attribution causale de 60 ne doit pas exposer un achat entier de 100");
  detailData.expenseSummaries[0].amount = "60";
  assert.equal(producer.buildActivityDetail(detailData, activityContext, "cinema").causalExpenses.data.items.length, 1);
  detailData.activityState.summaries[0].cost = { status: "UNKNOWN" };
  const unknownDetail = producer.buildActivityDetail(detailData, activityContext, "cinema");
  assert.equal(unknownDetail.causalExpenses.data.status, "UNKNOWN");
  assert.equal(unknownDetail.associatedExpenses.visibility, "HIDDEN");
});
console.log(`History V2 Month Balance: ${checks}/${checks} PASS`);
