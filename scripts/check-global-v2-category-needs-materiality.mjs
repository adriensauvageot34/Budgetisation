import assert from "node:assert/strict";
import fs from "node:fs";
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

const globalCore = await import("../src/core/global-v2/index.ts");
const globalAnalytics = await import("../src/analytics/global-v2/index.ts");
const identity = await import("../src/core/identity/index.ts");
const money = await import("../src/core/money/index.ts");
const time = await import("../src/core/time/index.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const rejects = (fn, pattern) => check(() => assert.throws(fn, pattern));
const m = money.parseMoney;
const ym = time.parseYearMonth;
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const categoryA = identity.parseCategoryId(uuid(101));
const categoryB = identity.parseCategoryId(uuid(102));
const subcategoryA = identity.parseSubcategoryId(uuid(201));
const subcategoryB = identity.parseSubcategoryId(uuid(202));
const subcategoryC = identity.parseSubcategoryId(uuid(203));
const known = (id, ref) => ({ status: "KNOWN", id, evidenceRefs: [ref] });
const state = (status, ref = []) => ({ status, evidenceRefs: ref });
const references = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map(ym);
const target = ym("2026-07");

const component = (month, key, amount, category, subcategory, need) => ({
  month: ym(month),
  canonicalComponentKey: key,
  amount: m(amount),
  category,
  subcategory,
  need,
  necessity: known("Indispensable", "classification:necessity"),
  behavior: known("Variable", "classification:behavior"),
  lifeScope: key.startsWith("u-") || key === "refund-target" ? state("CONFLICT", ["classification:conflict"]) : known("Vie courante", "classification:life-scope"),
  economicIdentityRefs: [`economic-component:${key}`],
  evidenceRefs: [`fact:${key}`],
});

const monthly = references.flatMap((month, index) => [
  component(month, `a-${month}`, String(60 + index), known(categoryA, `category:${categoryA}`), known(subcategoryA, `subcategory:${subcategoryA}`), known("need-home", "need:home")),
  component(month, `b-${month}`, String(20 + index), known(categoryA, `category:${categoryA}`), known(subcategoryB, `subcategory:${subcategoryB}`), state("UNKNOWN")),
  component(month, `u-${month}`, "-5", state("UNKNOWN"), state("UNKNOWN"), state("UNKNOWN")),
]);
const targetComponents = [
  component(target, "a-target", "70", known(categoryA, `category:${categoryA}`), known(subcategoryA, `subcategory:${subcategoryA}`), known("need-home", "need:home")),
  component(target, "b-target", "30", known(categoryA, `category:${categoryA}`), known(subcategoryB, `subcategory:${subcategoryB}`), state("UNKNOWN")),
  component(target, "refund-target", "-20", state("UNKNOWN"), state("NOT_APPLICABLE"), state("UNKNOWN")),
];

const result = globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target,
  referenceMonths: references,
  components: [...monthly, ...targetComponents],
  actual: m("80"),
  officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("100") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
});
check(() => assert.equal(globalAnalytics.resolveGlobalM2NeedDimension({ sourceNeedId: "need-a", operationComponentCount: 2, knownNeedIds: new Set(["need-a"]), evidenceRefs: ["need:a"] }).status, "KNOWN"));
check(() => assert.equal(globalAnalytics.resolveGlobalM2NeedDimension({ operationNeedId: "need-a", operationComponentCount: 2, knownNeedIds: new Set(["need-a"]), evidenceRefs: ["operation:a"] }).status, "UNKNOWN"));
check(() => assert.equal(globalAnalytics.resolveGlobalM2NeedDimension({ operationNeedId: "need-a", operationComponentCount: 1, knownNeedIds: new Set(["need-a"]), evidenceRefs: ["operation:a"] }).status, "KNOWN"));
check(() => assert.equal(globalAnalytics.resolveGlobalM2NeedDimension({ sourceNeedId: "need-a", operationNeedId: "need-b", operationComponentCount: 1, knownNeedIds: new Set(["need-a", "need-b"]), evidenceRefs: ["source:a", "operation:b"] }).status, "CONFLICT"));
check(() => assert.equal(globalAnalytics.resolveGlobalM2NeedDimension({ sourceNeedId: "need-label-only", operationComponentCount: 1, knownNeedIds: new Set(), evidenceRefs: ["text:repetition"] }).status, "CONFLICT"));
check(() => assert.equal(result.categories.reconcilesToActual, true));
check(() => assert.equal(result.needs.reconcilesToActual, true));
check(() => assert.equal(result.categories.currentTotal, "80"));
check(() => assert.equal(result.needs.currentTotal, "80"));
check(() => assert.equal(result.categories.annualTotal, "560"));
check(() => assert.equal(result.needs.annualTotal, "560"));
check(() => assert.equal(result.categories.groups.reduce((total, { annualAmount }) => money.addMoney(total, annualAmount), m("0")), result.categories.annualTotal));
check(() => assert.equal(result.needs.groups.reduce((total, { annualAmount }) => money.addMoney(total, annualAmount), m("0")), result.needs.annualTotal));
check(() => assert.equal(result.categories.groups.find(({ key }) => key === "__UNKNOWN__").monthlyAmount, "-20"));
check(() => assert.equal(result.categories.groups.find(({ key }) => key === categoryA).contributors.reduce((total, item) => money.addMoney(total, item.amount), m("0")), "100"));
const annualCategoryA = result.categories.groups.find(({ key }) => key === categoryA);
check(() => assert.equal(annualCategoryA.annualAmount, "610"));
check(() => assert.equal(annualCategoryA.activeMonths, 7));
check(() => assert.equal(annualCategoryA.currentShare, "1.25"));
check(() => assert.equal(annualCategoryA.referenceShare, "1.0625"));
check(() => assert.equal(annualCategoryA.shareDeltaPoints, "18.75"));
check(() => assert.ok(Math.abs(Number(annualCategoryA.annualShare) * Number(result.categories.annualTotal) - Number(annualCategoryA.annualAmount)) < 1e-9));
check(() => assert.equal(annualCategoryA.annualSubcategoryBreakdown.reduce((total, item) => money.addMoney(total, item.annualAmount), m("0")), annualCategoryA.annualAmount));
check(() => assert.deepEqual(annualCategoryA.annualSubcategoryBreakdown.map(({ key, annualAmount }) => [key, annualAmount]), [[subcategoryA, "445"], [subcategoryB, "165"]]));
check(() => assert.equal(result.categories.groups.find(({ key }) => key === "__UNKNOWN__").classificationBreakdown.lifeScope[0].key, "__CONFLICT__"));
check(() => assert.equal(result.categories.coverage.effective, 2 / 3));
check(() => assert.equal(result.needs.coverage.effective, 1 / 3));
check(() => assert.deepEqual(result.needs.monetaryCoverage, {
  status: "PARTIAL", knownAmount: "445", unresolvedAmount: "115", totalAmount: "560", knownShare: "0.79464285714285714286",
}));
const conflictCoverage = globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target,
  referenceMonths: references,
  components: [...monthly, ...targetComponents.map((item) => item.canonicalComponentKey === "refund-target" ? { ...item, need: state("CONFLICT", ["need:conflict"]) } : item)],
  actual: m("80"),
  officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("100") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
});
check(() => assert.equal(conflictCoverage.needs.monetaryCoverage.status, "CONFLICT"));
check(() => assert.equal(conflictCoverage.needs.monetaryCoverage.unresolvedAmount, "115"));
check(() => assert.equal(result.categories.shareSumIsExhaustive, false));
check(() => assert.equal(result.purchaseFrequencyTicket.reasonCode, "PURCHASE_EVENT_AUTHORITY_UNAVAILABLE"));
check(() => assert.ok(result.materialityCandidates.some(({ phenomenonId }) => phenomenonId === `category:${categoryA}`)));
check(() => assert.deepEqual(result.categories.groups.find(({ key }) => key === categoryA).historicalSeries.map(({ month }) => month), [...references, target]));
const reordered = globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target,
  referenceMonths: [...references].reverse(),
  components: [...targetComponents, ...monthly].reverse(),
  actual: m("80"),
  officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("100") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
});
check(() => assert.equal(reordered.inputHash, result.inputHash));
check(() => assert.deepEqual(reordered.categories, result.categories));
check(() => assert.deepEqual(reordered.needs, result.needs));
const twelveReferences = Array.from({ length: 12 }, (_, index) => ym(`2025-${String(index + 1).padStart(2, "0")}`));
const authoritativeAnnual = globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: ym("2026-01"),
  referenceMonths: twelveReferences,
  components: [
    ...twelveReferences.map((month) => component(month, `rolling-${month}`, "10", known(categoryA, `category:${categoryA}`), known(subcategoryA, `subcategory:${subcategoryA}`), known("need-home", "need:home"))),
    component("2026-01", "rolling-target", "20", known(categoryA, `category:${categoryA}`), known(subcategoryA, `subcategory:${subcategoryA}`), known("need-home", "need:home")),
  ],
  actual: m("20"),
  officialTypicalTotal: m("10"),
  officialCategoryCurrentAmounts: { [categoryA]: m("20") },
  officialCategoryTypicalAmounts: { [categoryA]: m("10") },
});
check(() => assert.equal(authoritativeAnnual.categories.groups[0].historicalSeries.length, 13));
check(() => assert.equal(authoritativeAnnual.categories.groups[0].annualAmount, "140"));
check(() => assert.equal(authoritativeAnnual.categories.groups[0].activeMonths, 13));
check(() => assert.equal(authoritativeAnnual.categories.annualTotal, "140"));
rejects(() => globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target,
  referenceMonths: references,
  components: [...monthly, ...targetComponents, targetComponents[0]],
  actual: m("150"), officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("170") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
}), /dupliquée/);
rejects(() => globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target, referenceMonths: references, components: [...monthly, ...targetComponents],
  actual: m("81"), officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("100") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
}), /Actual/);
rejects(() => globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target, referenceMonths: references, components: [...monthly, ...targetComponents],
  actual: m("80"), officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("99") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
}), /category_amount officiel/);
rejects(() => globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target, referenceMonths: [...references, target], components: [...monthly, ...targetComponents],
  actual: m("80"), officialTypicalTotal: m("80"),
  officialCategoryCurrentAmounts: { [categoryA]: m("100") },
  officialCategoryTypicalAmounts: { [categoryA]: m("85") },
}), /strictement antérieures/);

const purchase = globalAnalytics.decomposeGlobalPurchaseFrequencyTicket({
  authorityAvailable: true,
  purchaseCoverage: 1,
  reference: [{ purchaseEventId: "p1", amount: m("20") }, { purchaseEventId: "p2", amount: m("40") }],
  current: [{ purchaseEventId: "p3", amount: m("30") }, { purchaseEventId: "p4", amount: m("40") }, { purchaseEventId: "p5", amount: m("50") }],
});
check(() => assert.equal(purchase.status, "KNOWN"));
check(() => assert.equal(purchase.frequencyEffect, "35"));
check(() => assert.equal(purchase.ticketEffect, "25"));
check(() => assert.equal(purchase.deltaSpend, "60"));
check(() => assert.equal(purchase.reconciles, true));
check(() => assert.equal(globalAnalytics.decomposeGlobalPurchaseFrequencyTicket({ authorityAvailable: false, purchaseCoverage: 1, reference: [], current: [] }).reasonCode, "PURCHASE_EVENT_AUTHORITY_UNAVAILABLE"));
check(() => assert.equal(globalAnalytics.decomposeGlobalPurchaseFrequencyTicket({ authorityAvailable: true, purchaseCoverage: 0.9, reference: [], current: [] }).reasonCode, "PURCHASE_EVENT_COVERAGE_INCOMPLETE"));
rejects(() => globalAnalytics.decomposeGlobalPurchaseFrequencyTicket({ authorityAvailable: true, purchaseCoverage: 1, reference: [{ purchaseEventId: "p1", amount: m("1") }, { purchaseEventId: "p1", amount: m("2") }], current: [{ purchaseEventId: "p2", amount: m("3") }] }), /dupliqué/);

const support = (status = "SUFFICIENT", grain = "MONTH") => globalCore.parseGlobalSupport({
  naturalGrain: grain, eligibleUnits: 6, observedUnits: 6, includedUnits: 6,
  excludedObservedUnits: 0, minimumRequired: 6, supportStatus: status, policyRef: "test-support@v1",
});
const coverage = (ratio = 1, status = "KNOWN") => globalCore.parseGlobalCoverageSet({
  dimensions: [{ dimension: "CLASSIFICATION", status, numerator: ratio, denominator: 1, ratio, unit: "component", basis: "test", evidenceRefs: ["proof:coverage"], policyRef: "test-coverage@v1" }],
  requiredDimensions: ["CLASSIFICATION"], effective: ratio, aggregation: "MIN_REQUIRED_DIMENSIONS",
});
const candidate = (overrides = {}) => globalCore.parseGlobalMaterialityCandidate({
  candidateId: "candidate:a", phenomenonId: "category:a", metricRef: "metric:category-amount",
  effect: { absolute: "20", relative: "0.2" }, knowledgeState: "KNOWN",
  support: support(), coverage: coverage(), evidenceRefs: ["proof:a"], entityRefs: ["category:a"],
  methodVersion: "global_category_need@v1", materialityPolicy: globalAnalytics.globalMaterialityPolicies.CATEGORY_NEED.ref,
  ...overrides,
});
const engine = new globalAnalytics.GlobalMaterialityEngine();
check(() => assert.equal(engine.evaluate({ candidate: candidate(), policyId: "CATEGORY_NEED" }).status, "MATERIAL"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ effect: { absolute: "14", relative: "2" } }), policyId: "CATEGORY_NEED" }).status, "NOT_MATERIAL"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ support: support("INSUFFICIENT") }), policyId: "CATEGORY_NEED" }).status, "INELIGIBLE"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ support: support("PARTIAL_SUPPORT") }), policyId: "CATEGORY_NEED" }).status, "QUALIFIED_PARTIAL"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ coverage: coverage(0.5, "PARTIAL"), knowledgeState: "PARTIAL" }), policyId: "CATEGORY_NEED" }).status, "QUALIFIED_PARTIAL"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ effect: { absolute: "1", relative: "0.01" }, coverage: coverage(0.5, "PARTIAL"), knowledgeState: "PARTIAL" }), policyId: "CATEGORY_NEED" }).status, "QUALIFIED_PARTIAL"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ knowledgeState: "UNKNOWN" }), policyId: "CATEGORY_NEED" }).status, "INELIGIBLE"));
check(() => assert.equal(engine.evaluate({ candidate: candidate({ effect: { absolute: "15", relative: "0.01" } }), policyId: "CATEGORY_NEED", shareDeltaPoints: "2" }).status, "MATERIAL"));
const zeroTypical = globalAnalytics.buildGlobalCategoryNeeds({
  targetMonth: target,
  referenceMonths: references,
  components: [
    ...references.flatMap((month) => [
      component(month, `stable-${month}`, "100", known(categoryA, `category:${categoryA}`), known(subcategoryA, `subcategory:${subcategoryA}`), known("need-home", "need:home")),
      component(month, `new-${month}`, "0", known(categoryB, `category:${categoryB}`), known(subcategoryC, `subcategory:${subcategoryC}`), known("need-gifts", "need:gifts")),
    ]),
    component(target, "stable-target", "85", known(categoryA, `category:${categoryA}`), known(subcategoryA, `subcategory:${subcategoryA}`), known("need-home", "need:home")),
    component(target, "new-target", "15", known(categoryB, `category:${categoryB}`), known(subcategoryC, `subcategory:${subcategoryC}`), known("need-gifts", "need:gifts")),
  ],
  actual: m("100"),
  officialTypicalTotal: m("100"),
  officialCategoryCurrentAmounts: { [categoryA]: m("85"), [categoryB]: m("15") },
  officialCategoryTypicalAmounts: { [categoryA]: m("100"), [categoryB]: m("0") },
});
const appearedGroup = zeroTypical.categories.groups.find(({ key }) => key === categoryB);
const appearedCandidate = zeroTypical.materialityCandidates.find(({ phenomenonId }) => phenomenonId === `category:${categoryB}`);
check(() => assert.equal(appearedGroup.referenceShare, "0"));
check(() => assert.equal(appearedGroup.currentShare, "0.15"));
check(() => assert.equal(appearedGroup.shareDeltaPoints, "15"));
check(() => assert.equal(appearedCandidate.effect.relative, undefined));
check(() => assert.equal(engine.evaluate({ candidate: appearedCandidate, policyId: "CATEGORY_NEED" }).status, "NOT_MATERIAL"));
check(() => assert.equal(engine.evaluate({ candidate: appearedCandidate, policyId: "CATEGORY_NEED", shareDeltaPoints: appearedGroup.shareDeltaPoints }).status, "MATERIAL"));
rejects(() => engine.evaluate({ candidate: candidate({ materialityPolicy: { id: "global-materiality-category-need", version: "v2" } }), policyId: "CATEGORY_NEED" }), /ne correspond pas/);
const duplicate = candidate({ candidateId: "candidate:b" });
const distinctGrain = candidate({ candidateId: "candidate:c", support: support("SUFFICIENT", "OCCURRENCE") });
const evaluated = engine.evaluateAll([
  { candidate: duplicate, policyId: "CATEGORY_NEED" },
  { candidate: candidate(), policyId: "CATEGORY_NEED" },
  { candidate: distinctGrain, policyId: "CATEGORY_NEED" },
]);
check(() => assert.equal(evaluated.length, 2));
check(() => assert.deepEqual(evaluated.map(({ candidateId }) => candidateId), ["candidate:a", "candidate:c"]));

const declaration = globalAnalytics.createGlobalM2DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [] });
check(() => assert.ok(declaration.factDependencies.some(({ id, requirement }) => id === "fct_purchase_event" && requirement === "OPTIONAL")));
check(() => assert.ok(declaration.otherModuleDependencies.some(({ id, requirement }) => id.includes("P10") && requirement === "OPTIONAL")));
check(() => assert.ok(!declaration.factDependencies.some(({ id, requirement }) => id === "fct_purchase_event" && requirement === "REQUIRED")));
check(() => globalCore.assertGlobalDependencyClosure(declaration, {
  factDependencyIds: ["fct_economic_component", "fct_economic_component_classification", "fct_purchase_event"],
  entityDependencyIds: ["categories", "subcategories", "needs"],
  upstreamAnalyticsIds: ["economic_consumption_net_attributable", "category_amount", "typical_month_cost"],
  otherModuleDependencyIds: ["global-v2:m1-economic-function", "GlobalMaterialityEngine", "global-v2:m8-purchase-enrichment:P10"],
  policyIds: ["global-category-need-reference", "global-category-need-support", "global-category-need-coverage", "global-materiality-category-need", "reference", "support", "coverage", "materiality", "purchaseEnrichment"],
}));

const source = fs.readFileSync(new URL("../src/analytics/global-v2/category-needs.ts", import.meta.url), "utf8");
check(() => assert.doesNotMatch(source, /CertifiedHistorical|EXPECTED|oracle/i));
check(() => assert.doesNotMatch(source, /merchant_label|description|libell[eé]/i));
const markedFacts = fs.readFileSync(new URL("../src/analytics/insights/marked-facts.ts", import.meta.url), "utf8");
check(() => assert.match(markedFacts, /markedFactsMaterialityPolicy/));

console.log(`Global V2 category/Needs/materiality: ${checks}/${checks} checks PASS`);
