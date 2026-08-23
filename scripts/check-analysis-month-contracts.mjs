import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) {
        throw originalError;
      }

      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // Try the next TypeScript resolution convention.
        }
      }

      throw originalError;
    }
  },
});

const [markedFacts, activityCost, structure, minimalMonth, production, scopeModule] = await Promise.all([
  import("../src/analytics/insights/marked-facts.ts"),
  import("../src/analytics/facts/activity-cost.ts"),
  import("../src/analytics/facts/structure.ts"),
  import("../src/analytics/baseline/minimal-month.ts"),
  import("../src/analytics/production/producer.ts"),
  import("../src/core/scope/index.ts"),
]);

const { isMaterialMarkedFactCandidate, robustZScore, selectMarkedFacts } = markedFacts;
const {
  buildActivityOccurrenceCostFacts,
  medianKnownActivityCausalCost,
  parseActivityCausalFinancialLinks,
} = activityCost;
const { partitionEconomicComponentsForStructure } = structure;
const {
  calculateMinimalMonthCost,
  minimalBaselineEligibilityDecision,
  selectMinimalBaselineRule,
  weakestMaterialSupport,
} = minimalMonth;
const { produceMetric } = production;
const { computeScopeHash, normalizeAnalysisScope } = scopeModule;

const candidate = (kind, absoluteDelta, relativeDelta, id = `${kind}:${absoluteDelta}:${relativeDelta}`) => ({
  id,
  kind,
  absoluteDelta,
  relativeDelta,
  supportLevel: "sufficient",
  phenomenonKey: id,
  evidenceKeys: [id],
});

assert.equal(isMaterialMarkedFactCandidate(candidate("total", "49", "0.09")), false);
assert.equal(isMaterialMarkedFactCandidate(candidate("total", "50", "0.10")), true);
assert.equal(isMaterialMarkedFactCandidate(candidate("category", "24", "0.25")), false);
assert.equal(isMaterialMarkedFactCandidate(candidate("category", "25", "0.20")), true);
assert.equal(robustZScore({ value: "100", median: "50", mad: "0" }), null);
assert.deepEqual(selectMarkedFacts([]), []);
assert.equal(
  selectMarkedFacts(Array.from({ length: 8 }, (_, index) => candidate("category", String(100 - index), "0.30", `candidate-${index}`)), 99).length,
  5,
);
assert.deepEqual(
  selectMarkedFacts([
    { ...candidate("total", "50", "0.10", "parent"), evidenceKeys: ["same"] },
    { ...candidate("category", "50", "0.20", "child"), evidenceKeys: ["same"], parentId: "parent" },
    candidate("unsupported", "999", "9", "unsupported"),
  ]).map(({ id }) => id),
  ["child"],
);

const householdId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";
const secondEventId = "00000000-0000-4000-8000-000000000004";
const activityId = "activity:test";
const operationId = "00000000-0000-4000-8000-000000000003";
const componentKey = `operation:${operationId}`;
const occurrence = {
  fact: "fct_activity_occurrence",
  householdId,
  householdTimeZone: "Europe/Paris",
  lifeEventId: eventId,
  activityId,
  lifeEventSeriesId: null,
  parentLifeEventId: null,
  startDate: "2026-07-01",
  endDate: "2026-07-01",
  validationStatus: "Confirmé",
  participantIds: [],
};
const component = {
  fact: "fct_economic_component",
  householdId,
  householdTimeZone: "Europe/Paris",
  canonicalComponentKey: componentKey,
  net: "10",
};
const costFacts = buildActivityOccurrenceCostFacts({
  occurrences: [occurrence],
  components: [component],
  links: [
    { financialLinkId: "link-a", lifeEventId: eventId, canonicalComponentKey: componentKey, relationType: "Paiement_activite", economicAmountLinked: "10" },
    { financialLinkId: "link-b", lifeEventId: eventId, canonicalComponentKey: componentKey, relationType: "Paiement_activite", economicAmountLinked: "10" },
  ],
});
assert.equal(costFacts.length, 1);
assert.deepEqual(costFacts[0].causalCost, { availability: "known", value: "10" });
const overAllocatedFacts = buildActivityOccurrenceCostFacts({
  occurrences: [occurrence, { ...occurrence, lifeEventId: secondEventId }],
  components: [component],
  links: [
    { financialLinkId: "link-c", lifeEventId: eventId, canonicalComponentKey: componentKey, relationType: "Paiement_activite", economicAmountLinked: "10" },
    { financialLinkId: "link-d", lifeEventId: secondEventId, canonicalComponentKey: componentKey, relationType: "Paiement_activite", economicAmountLinked: "10" },
  ],
});
assert.equal(overAllocatedFacts.every(({ causalCost }) => causalCost.availability === "unknown"), true);
assert.equal(parseActivityCausalFinancialLinks([{
  financial_link_id: "during",
  life_event_id: eventId,
  source_kind: "Operation",
  operation_id: operationId,
  allocation_id: null,
  item_id: null,
  cash_use_id: null,
  relation_type: "Effectue_pendant",
  economic_amount_linked: "10",
  validation_status: "Confirmé",
}]).length, 0);
assert.equal(medianKnownActivityCausalCost([]), null);

const scope = normalizeAnalysisScope({ subject: { kind: "household" }, time: { kind: "month", month: "2026-07" } });
const insufficientFacts = ["1", "2", "3", "4"].map((value, index) => ({
  ...costFacts[0],
  occurrenceId: `00000000-0000-4000-8000-00000000001${index}`,
  causalCost: { availability: "known", value },
}));
const insufficientMedian = produceMetric({
  metricId: "activity_causal_median_cost_per_occurrence",
  scope,
  source: { kind: "activity_occurrence_costs", scopeHash: computeScopeHash(scope), availability: "known", facts: insufficientFacts },
});
assert.equal(insufficientMedian.availability, "unknown");
assert.equal(insufficientMedian.support?.level, "insufficient");
assert.equal(medianKnownActivityCausalCost(["1", "2", "3", "4", "5"].map((value, index) => ({
  ...costFacts[0],
  occurrenceId: `00000000-0000-4000-8000-00000000002${index}`,
  causalCost: { availability: "known", value },
}))), "3");

const economicFact = (key, behavior, lifeScope, category, net = "0") => ({
  fact: "fct_economic_component",
  householdId,
  householdTimeZone: "Europe/Paris",
  canonicalComponentKey: key,
  sourceOperation: { kind: "resolved", id: operationId },
  gross: net,
  refundApplied: "0",
  net,
  bankDate: { kind: "known", date: "2026-07-01" },
  economicTiming: { kind: "known", segments: [] },
  person: { kind: "unknown" },
  category,
  subcategory: { kind: "unknown" },
  activity: { kind: "unknown" },
  merchant: { kind: "unknown" },
  moment: { kind: "unknown" },
  canonicalPlace: { kind: "unknown" },
  necessity: { kind: "unknown" },
  behavior,
  lifeScope,
});
const structureFacts = [
  economicFact("operation:00000000-0000-4000-8000-000000000010", { kind: "resolved", value: "Fixe" }, { kind: "resolved", value: "Vie courante" }, { kind: "resolved", id: "00000000-0000-4000-8000-000000000020" }, "0"),
  economicFact("operation:00000000-0000-4000-8000-000000000011", { kind: "unknown" }, { kind: "unknown" }, { kind: "undetermined" }, "12"),
];
const fixed = partitionEconomicComponentsForStructure(structureFacts, "fixed_variable");
assert.equal(fixed.find(({ key }) => key === "Fixe").facts.length, 1);
assert.equal(fixed.find(({ key }) => key === "Variable").facts.length, 0);
assert.equal(fixed.find(({ key }) => key === "À déterminer").facts.length, 1);
const lifeContext = partitionEconomicComponentsForStructure(structureFacts, "life_context");
assert.equal(lifeContext.find(({ key }) => key === "Vie courante").facts.length, 1);
assert.equal(lifeContext.find(({ key }) => key === "Hors quotidien").facts.length, 0);
assert.equal(lifeContext.find(({ key }) => key === "À déterminer").facts.length, 1);
assert.equal(partitionEconomicComponentsForStructure(structureFacts, "category").flatMap(({ facts }) => facts).length, structureFacts.length);

const categoryRule = { baselineRuleId: "category", categoryId: "cat", subcategoryId: null, preciseType: null, eligibility: "Excluded", conditionCode: null, validFrom: null, validTo: null, methodVersion: "minimal_baseline_v1" };
const subcategoryRule = { ...categoryRule, baselineRuleId: "subcategory", subcategoryId: "sub", eligibility: "Eligible" };
const preciseRule = { ...subcategoryRule, baselineRuleId: "precise", preciseType: "precise", eligibility: "Conditional", conditionCode: "REAL_RULE" };
assert.equal(selectMinimalBaselineRule([categoryRule, subcategoryRule, preciseRule], { categoryId: "cat", subcategoryId: "sub", preciseType: "precise", asOf: "2026-07-01" })?.baselineRuleId, "precise");
assert.equal(selectMinimalBaselineRule([{ ...preciseRule, categoryId: "other" }, categoryRule], { categoryId: "cat", subcategoryId: "sub", preciseType: "precise", asOf: "2026-07-01" })?.baselineRuleId, "category");
assert.deepEqual(minimalBaselineEligibilityDecision(categoryRule), { kind: "excluded" });
assert.deepEqual(minimalBaselineEligibilityDecision(preciseRule), { kind: "condition_required", conditionCode: "REAL_RULE" });
assert.equal(selectMinimalBaselineRule([categoryRule], { categoryId: "other", subcategoryId: null, preciseType: null, asOf: "2026-07-01", roleBudgetaire: "Socle" }), null);
const support10 = { n: 10, unit: "day", level: "sufficient" };
const support6 = { n: 6, unit: "independent_28d_block", level: "limited" };
const componentInput = (key, support) => ({ canonicalComponentKey: key, amount: "10", support, coverage: { level: "complete" }, provenance: "derived" });
assert.equal(weakestMaterialSupport([componentInput("a", support10), componentInput("b", support6)])?.n, 6);
assert.throws(() => calculateMinimalMonthCost({
  neutralVariableComponents: [componentInput("same", support10)],
  mandatoryMonthlyObligationsAndProvisions: [componentInput("same", support6)],
}), /comptée/);
assert.equal(calculateMinimalMonthCost({ neutralVariableComponents: [], mandatoryMonthlyObligationsAndProvisions: [] }).value, "0");

console.log("ANALYSIS_MONTH_CONTRACT_INVARIANTS=PASS");
