import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function loadMaterializationModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveMaterializationModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  try {
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  } catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [
      `${resolvedRequest}.ts`, `${resolvedRequest}.tsx`,
      path.join(resolvedRequest, "index.ts"), path.join(resolvedRequest, "index.tsx"),
    ]) {
      try {
        return originalResolveFilename.call(this, candidate, parent, isMain, options);
      } catch {
        // Try the next TypeScript resolution convention.
      }
    }
    throw originalError;
  }
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

const {
  aggregateAdditiveMonthlyMetrics,
} = require(path.join(repositoryRoot, "src/server/analytics/materialization/global-planner.ts"));
const {
  areMaterializationVersionsCompatible,
  isScopedMaterializationFresh,
} = require(path.join(repositoryRoot, "src/server/analytics/materialization/freshness.ts"));
const {
  metricArtifactIdentity,
  metricBucketArtifactIdentity,
  querySnapshotIdentity,
  historyV2ResourceMethodSignature,
} = require(path.join(repositoryRoot, "src/server/analytics/materialization/identity.ts"));
const { FactSourceResolver } = require(path.join(
  repositoryRoot,
  "src/server/analytics/fact-source-resolver.ts",
));
const { resolveMinimalPlanningSource } = require(path.join(
  repositoryRoot,
  "src/server/analytics/minimal-source-resolver.ts",
));
const { projectActivityOccurrenceFact } = require(path.join(
  repositoryRoot,
  "src/analytics/facts/index.ts",
));
const { toBoundaryQueryRequest } = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/backfill.ts",
));
const { certifiedHistoricalMinimalSource } = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/certified-historical-minimal.ts",
));
const { executeQuery } = require(path.join(
  repositoryRoot,
  "src/query-api/server/execute-query.ts",
));
assert.match(fs.readFileSync(path.join(repositoryRoot, "src/server/analytics/materialization/identity.ts"), "utf8"), /history-calendar@v2/);
const lifeMoneyPoliciesV1 = {
  calendar_semantics: "v1",
  canonical_purchase_event_timing: "v1",
  facts_hash: "v1",
  life_money_selection: "v1",
  quality_visibility: "v1",
};
const lifeMoneySignatureV1 = historyV2ResourceMethodSignature(
  "history_month_life_money",
  lifeMoneyPoliciesV1,
);
const lifeMoneySignatureV2 = historyV2ResourceMethodSignature(
  "history_month_life_money",
  { ...lifeMoneyPoliciesV1, life_money_selection: "v2" },
);
assert.notEqual(
  lifeMoneySignatureV1,
  lifeMoneySignatureV2,
  "C: a policy-only change must invalidate the resource method signature",
);
const { MetricQueryService } = require(path.join(
  repositoryRoot,
  "src/server/analytics/metric-query-service.ts",
));
const {
  validateProducedMetric,
  produceMetric,
} = require(path.join(repositoryRoot, "src/analytics/production/index.ts"));
const { computeScopeHash, normalizeAnalysisScope } = require(path.join(
  repositoryRoot,
  "src/core/scope/index.ts",
));
const { normalizeQueryRequest } = require(path.join(
  repositoryRoot,
  "src/query-api/request/index.ts",
));
const { evaluateQueryCapabilities } = require(path.join(
  repositoryRoot,
  "src/query-api/capabilities/engine.ts",
));
const {
  parseAnalysisMonthInitialReadModel,
  parseAnalysisMonthStructureReadModel,
} = require(path.join(
  repositoryRoot,
  "src/query-api/analysis/month/validation.ts",
));
const { createAnalysisQuerySources } = require(path.join(
  repositoryRoot,
  "src/server/query/sources/analysis.ts",
));
const {
  shouldAutomaticallyRevalidateClientQuery,
} = require(path.join(repositoryRoot, "src/components/runtime/query-client.ts"));

const householdA = "00000000-0000-4000-8000-000000000001";
const householdB = "00000000-0000-4000-8000-000000000002";
const minimalOperationId = "00000000-0000-4000-8000-000000000101";
const minimalExcludedOperationId = "00000000-0000-4000-8000-000000000107";
const minimalCashUseId = "00000000-0000-4000-8000-000000000110";
const minimalNeedId = "00000000-0000-4000-8000-000000000102";
const minimalRuleId = "00000000-0000-4000-8000-000000000103";
const minimalExcludedRuleId = "00000000-0000-4000-8000-000000000108";
const minimalCategoryId = "00000000-0000-4000-8000-000000000104";
const minimalExcludedCategoryId = "00000000-0000-4000-8000-000000000109";
function minimalFact(
  amount,
  operationId = minimalOperationId,
  categoryId = minimalCategoryId,
  canonicalComponentKey = `operation:${operationId}`,
) {
  return {
    canonicalComponentKey,
    sourceOperation: { kind: "resolved", id: operationId },
    category: { kind: "resolved", id: categoryId },
    subcategory: { kind: "unknown" },
    economicTiming: {
      kind: "known",
      segments: [{
        timingState: "known",
        economicMonth: "2025-08",
        amount,
      }],
    },
  };
}
function minimalBundle(overrides = {}) {
  return {
    economicFacts: [],
    operations: [],
    allocations: [],
    items: [],
    paymentComponents: [],
    cashUses: [],
    baselineRules: [],
    needs: [],
    provisionPools: [],
    recurrenceSeries: [],
    annualEvents: [],
    worksiteActivityTypeIds: [],
    plannedActivityDays: [],
    ...overrides,
  };
}
const needBeforeCategoryExclusion = resolveMinimalPlanningSource({
  targetMonth: "2025-09",
  referenceMonths: ["2025-08"],
  bundle: minimalBundle({
    economicFacts: [
      minimalFact("10"),
      minimalFact("20", minimalExcludedOperationId, minimalExcludedCategoryId),
      minimalFact(
        "30",
        minimalOperationId,
        minimalExcludedCategoryId,
        `cash_use:${minimalCashUseId}`,
      ),
    ],
    operations: [minimalOperationId, minimalExcludedOperationId].map((operation_id) => ({
      operation_id,
      need_id: minimalNeedId,
      mode_prevision: "Référence mensuelle",
    })),
    needs: [{ need_id: minimalNeedId, person_id: null, actif: true }],
    cashUses: [{
      cash_use_id: minimalCashUseId,
      withdrawal_operation_id: minimalOperationId,
      type_precis: "Cash sans sous-catégorie canonique",
    }],
    baselineRules: [
      {
        baseline_rule_id: minimalRuleId,
        category_id: minimalCategoryId,
        subcategory_id: null,
        type_precis: null,
        eligibility: "Eligible",
        condition_code: null,
        valid_from: null,
        valid_to: null,
        method_version: "minimal_baseline_v1",
      },
      {
        baseline_rule_id: minimalExcludedRuleId,
        category_id: minimalExcludedCategoryId,
        subcategory_id: null,
        type_precis: null,
        eligibility: "Excluded",
        condition_code: null,
        valid_from: null,
        valid_to: null,
        method_version: "minimal_baseline_v1",
      },
    ],
  }),
});
assert.deepEqual(
  needBeforeCategoryExclusion.neutralVariableComponents.map(({ canonicalComponentKey, amount }) => ({
    canonicalComponentKey,
    amount: String(amount),
  })),
  [{ canonicalComponentKey: `minimal:need:${minimalNeedId}`, amount: "10" }],
  "a Need may group an eligible fact but must not override categorical exclusions",
);

const nonEligibleNeed = resolveMinimalPlanningSource({
  targetMonth: "2025-09",
  referenceMonths: ["2025-08"],
  bundle: minimalBundle({
    economicFacts: [minimalFact("20", minimalExcludedOperationId, minimalExcludedCategoryId)],
    operations: [{
      operation_id: minimalExcludedOperationId,
      need_id: minimalNeedId,
      mode_prevision: "Référence mensuelle",
    }],
    needs: [{ need_id: minimalNeedId, person_id: null, actif: true }],
    baselineRules: [{
      baseline_rule_id: minimalExcludedRuleId,
      category_id: minimalExcludedCategoryId,
      subcategory_id: null,
      type_precis: null,
      eligibility: "Excluded",
      condition_code: null,
      valid_from: null,
      valid_to: null,
      method_version: "minimal_baseline_v1",
    }],
  }),
});
assert.deepEqual(
  nonEligibleNeed.neutralVariableComponents,
  [],
  "a non-eligible Need fact must remain outside Minimal",
);

const frozenMinimalValues = new Map([
  ["2025-08", null],
  ["2025-09", "1508.41"],
  ["2025-10", "1619.635"],
  ["2025-11", "1692.27333333333333333332"],
  ["2025-12", "1680.2975"],
  ["2026-01", "1713.194"],
  ["2026-02", "1741.095"],
  ["2026-03", "1733.67"],
  ["2026-04", "1699.0725"],
  ["2026-05", "1669.8233333333333333333333333333333333333333333332"],
  ["2026-06", "1631.587"],
  ["2026-07", "1636.62727272727272727273"],
]);
for (const [month, expected] of frozenMinimalValues) {
  const scope = normalizeAnalysisScope({
    subject: { kind: "household" },
    time: { kind: "month", month },
  });
  const source = certifiedHistoricalMinimalSource.resolve({
    month,
    scopeHash: computeScopeHash(scope),
  });
  assert.ok(source, `frozen Minimal source missing for ${month}`);
  const metric = produceMetric({ metricId: "minimal_month_cost", scope, source });
  assert.equal(metric.value, expected, `frozen Minimal value mismatch for ${month}`);
}
assert.equal(
  certifiedHistoricalMinimalSource.resolve({
    month: "2026-08",
    scopeHash: computeScopeHash(normalizeAnalysisScope({
      subject: { kind: "household" },
      time: { kind: "month", month: "2026-08" },
    })),
  }),
  null,
  "the frozen source must never become a current-month fallback",
);

const pendingWorksiteOccurrence = projectActivityOccurrenceFact({
  household: { householdId: householdA, householdTimeZone: "Europe/Paris" },
  lifeEvent: {
    life_event_id: "00000000-0000-4000-8000-000000000105",
    life_event_type_id: "00000000-0000-4000-8000-000000000106",
    life_event_series_id: null,
    parent_life_event_id: null,
    start_date: "2025-08-04",
    end_date: "2025-08-04",
    validation_status: "À valider",
  },
  lifeEventType: {
    life_event_type_id: "00000000-0000-4000-8000-000000000106",
    type_key: "travail_site",
    can_span_days: false,
    active: true,
  },
  participations: [],
});
assert.equal(pendingWorksiteOccurrence, null, "À valider must remain excluded from ActivityOccurrence");
const commuteFromPlannedWorksite = resolveMinimalPlanningSource({
  targetMonth: "2025-09",
  referenceMonths: ["2025-08"],
  bundle: minimalBundle({
    economicFacts: [minimalFact("10")],
    operations: [{ operation_id: minimalOperationId, mode_prevision: "Référence mensuelle" }],
    baselineRules: [{
      baseline_rule_id: minimalRuleId,
      category_id: minimalCategoryId,
      subcategory_id: null,
      type_precis: null,
      eligibility: "Conditional",
      condition_code: "WORK_COMMUTE_FUEL_ONLY",
      valid_from: null,
      valid_to: null,
      method_version: "minimal_baseline_v1",
    }],
    worksiteActivityTypeIds: ["travail_site"],
    plannedActivityDays: [{
      activityId: "travail_site",
      startDate: "2025-08-04",
      validationStatus: "À valider",
    }],
  }),
});
assert.equal(
  String(commuteFromPlannedWorksite.neutralVariableComponents[0]?.amount),
  "1.7",
  "a planned À valider worksite day must feed only the Minimal commute estimate",
);
const baseContext = {
  userId: "test-actor",
  householdId: householdA,
  persons: [],
  personIds: [],
  timezone: "Europe/Paris",
  periods: [
    { householdId: householdA, month: "2026-07-01", isClosed: true, sourceRevision: "1" },
    { householdId: householdA, month: "2026-08-01", isClosed: false, sourceRevision: null },
  ],
  dataRevision: "2",
  analyticsRevision: "1",
  contractVersion: "v1",
  asOf: "2026-08-25T00:00:00Z",
};
const julyScope = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "month", month: "2026-07" },
});
const augustScope = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "month", month: "2026-08" },
});
const normalizedAugustInitial = normalizeQueryRequest({
  resource: "analysis_month_initial",
  scope: {
    subject: { kind: "household" },
    time: { kind: "month", month: "2025-08" },
  },
  params: {},
});
assert.equal(Object.hasOwn(normalizedAugustInitial, "scopeHash"), true);
const boundaryAugustInitial = toBoundaryQueryRequest(normalizedAugustInitial);
assert.equal(Object.hasOwn(boundaryAugustInitial, "scopeHash"), false);
assert.deepEqual(Object.keys(boundaryAugustInitial).sort(), ["params", "resource", "scope"]);
const boundaryExecution = await executeQuery({
  requestId: "backfill-boundary-2025-08-initial",
  request: boundaryAugustInitial,
}, {
  resolveContext: async () => ({
    actor: { actorId: "backfill-boundary-test" },
    household: { householdId: householdA },
    revisions: { dataRevision: "1", analyticsRevision: "1", dependencies: [] },
    contractVersion: "v1",
    now: "2026-08-27T00:00:00Z",
  }),
  authorize: async () => ({ granted: false, errorCode: "PERMISSION_DENIED" }),
  sources: {},
});
assert.equal(boundaryExecution.ok, false);
assert.equal(boundaryExecution.error.code, "PERMISSION_DENIED");

assert.equal(isScopedMaterializationFresh({
  rowSourceRevision: BigInt(1),
  currentDataRevision: BigInt(2),
  period: { kind: "month", month: "2026-07", isClosed: true, sourceRevision: "1" },
  latestImpactRevision: BigInt(0),
}), true, "an August revision must not stale July");
assert.equal(isScopedMaterializationFresh({
  rowSourceRevision: BigInt(1),
  currentDataRevision: BigInt(2),
  period: { kind: "month", month: "2026-08", isClosed: false, sourceRevision: "2" },
  latestImpactRevision: BigInt(2),
}), false, "the open August artifact must follow current dataRevision");
assert.equal(isScopedMaterializationFresh({
  rowSourceRevision: BigInt(1),
  currentDataRevision: BigInt(2),
  period: { kind: "month", month: "2026-07", isClosed: true, sourceRevision: "1" },
  latestImpactRevision: BigInt(2),
}), false, "a July-scoped impact must stale July");

assert.equal(areMaterializationVersionsCompatible({
  rowMethodVersion: "metric@v1",
  currentMethodVersion: "metric@v2",
  rowContractVersion: "v1",
  currentContractVersion: "v1",
}), false);
assert.equal(areMaterializationVersionsCompatible({
  rowMethodVersion: "metric@v1",
  currentMethodVersion: "metric@v1",
  rowContractVersion: "v1",
  currentContractVersion: "v2",
}), false);

const metricKeyA = metricArtifactIdentity(
  baseContext,
  "economic_consumption_net_attributable",
  julyScope,
).artifactKey;
assert.equal(
  metricArtifactIdentity(
    baseContext,
    "economic_consumption_net_attributable",
    julyScope,
  ).period.sourceRevision,
  "1",
);
assert.equal(
  metricArtifactIdentity(
    baseContext,
    "economic_consumption_net_attributable",
    julyScope,
    "current",
  ).period.sourceRevision,
  "2",
  "a targeted recomputation must publish the current data revision",
);
const metricKeyB = metricArtifactIdentity(
  { ...baseContext, householdId: householdB },
  "economic_consumption_net_attributable",
  julyScope,
).artifactKey;
assert.notEqual(metricKeyA, metricKeyB, "artifact cache keys must be household-scoped");
const normalizedInitial = normalizeQueryRequest({
  resource: "analysis_month_initial",
  scope: julyScope,
  params: {},
});
const queryKeyA = querySnapshotIdentity(baseContext, normalizedInitial).queryKey;
const queryKeyB = querySnapshotIdentity(
  { ...baseContext, householdId: householdB },
  normalizedInitial,
).queryKey;
const queryKeyContractV2 = querySnapshotIdentity(
  { ...baseContext, contractVersion: "v2" },
  normalizedInitial,
).queryKey;
assert.notEqual(queryKeyA, queryKeyB, "query snapshots must never cross households");
assert.equal(
  queryKeyA,
  queryKeyContractV2,
  "a global context must not silently bump a certified V1 resource",
);
assert.equal(
  querySnapshotIdentity(baseContext, normalizedInitial).contractVersion,
  "v1",
  "snapshot contractVersion must be resolved by resource",
);
const activeResourceRegistry = fs.readFileSync(
  path.join(repositoryRoot, "src/query-api/request/resource-registry.ts"),
  "utf8",
);
for (const retiredResource of ["history_calendar_month", "history_calendar_month_summary", "history_day_detail"]) {
  assert.equal(activeResourceRegistry.includes(`\"${retiredResource}\"`), false);
}

function moneyMetric(scope, value, n, coverage = { level: "complete" }) {
  return validateProducedMetric({
    metricId: "economic_consumption_net_attributable",
    scopeHash: computeScopeHash(scope),
    availability: "known",
    value,
    unit: "EUR/month",
    coverage,
    support: { n, unit: "transaction", level: n === 0 ? "insufficient" : "sufficient" },
    provenance: "observed",
    methodVersion: "economic_consumption_net_attributable@v1",
  });
}
const globalScope = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "global", observationWindow: "last_3_months", asOf: "2026-08" },
});
const monthly = [
  moneyMetric({ ...julyScope, time: { kind: "month", month: "2026-05" } }, "10", 1),
  moneyMetric({ ...julyScope, time: { kind: "month", month: "2026-06" } }, "20", 2),
  moneyMetric(julyScope, "30", 3),
];
const aggregated = aggregateAdditiveMonthlyMetrics({
  metricId: "economic_consumption_net_attributable",
  globalScope,
  monthlyMetrics: monthly,
});
const rawEquivalent = moneyMetric(globalScope, "60", 6);
assert.deepEqual(aggregated, rawEquivalent, "Global additive output must equal raw semantics");
assert.equal(aggregateAdditiveMonthlyMetrics({
  metricId: "distinct_visit_days",
  globalScope,
  monthlyMetrics: [],
}), null, "non-additive metrics must never be summed");
assert.equal(aggregateAdditiveMonthlyMetrics({
  metricId: "economic_consumption_net_attributable",
  globalScope,
  monthlyMetrics: [{ ...monthly[0], availability: "unknown", value: null }],
}), null, "unknown must never become zero");

const typicalWindow = {
  family: "comparison",
  householdId: householdA,
  householdTimeZone: "Europe/Paris",
  asOf: "2026-07",
  targetPeriod: "2026-07",
  requestedPeriodCount: 12,
  includedPeriods: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
  excludedPeriods: [],
  effectivePeriodCount: 6,
  firstIncluded: "2026-01",
  lastIncluded: "2026-06",
};
const observations = typicalWindow.includedPeriods.map((period, index) => ({
  period,
  value: String((index + 1) * 10),
}));
const typicalSource = {
  kind: "typical_month",
  scopeHash: computeScopeHash(julyScope),
  window: typicalWindow,
  monthlyObservations: observations,
};
const rawTypical = produceMetric({
  metricId: "typical_month_cost",
  scope: julyScope,
  source: typicalSource,
});
const materializedObservationTypical = produceMetric({
  metricId: "typical_month_cost",
  scope: julyScope,
  source: { ...typicalSource, monthlyObservations: [...observations] },
});
assert.deepEqual(materializedObservationTypical, rawTypical);

const personId = "00000000-0000-4000-8000-000000000003";
const personScope = normalizeAnalysisScope({
  subject: { kind: "person", personId },
  time: { kind: "month", month: "2026-07" },
});
const personRepository = {
  context: {
    householdId: householdA,
    timezone: "Europe/Paris",
    periods: [
      "2026-04", "2026-05", "2026-06", "2026-07",
    ].map((month) => ({
      householdId: householdA,
      month: `${month}-01`,
      financeStatus: "complete",
      isClosed: true,
    })),
  },
  async loadEconomicFacts() { return []; },
  async loadPersonDays() {
    return [{
      fact: "fct_person_day",
      householdId: householdA,
      householdTimeZone: "Europe/Paris",
      personDayId: "00000000-0000-4000-8000-000000000004",
      personId,
      localDate: "2026-07-01",
      locationObservability: "observable",
    }];
  },
  async loadPlaceVisits() { return [{ personId, placeId: "place:test" }]; },
  async loadActivityOccurrences() {
    return [{ participantIds: [personId], activityId: "activity:test" }];
  },
};
const personFacts = new FactSourceResolver(personRepository);
const personBundle = await new MetricQueryService(personFacts).produceActualWithTypical(
  personScope,
);
assert.equal(personBundle.actual.envelope.availability, "unknown");
assert.equal(personBundle.actual.envelope.value, null);
assert.equal(personBundle.typical.envelope.availability, "unknown");
assert.equal(personBundle.typical.envelope.value, null);
assert.equal(personBundle.comparison.relation, "not_comparable");
assert.equal(personBundle.comparison.absoluteDelta.publishable, false);
assert.equal(personBundle.comparison.relativeDelta.publishable, false);
for (const metricId of [
  "person_day_count",
  "place_visit_count",
  "activity_frequency",
]) {
  const source = await personFacts.resolve(metricId, personScope);
  assert.equal(source.availability, "known", `${metricId} Person must remain productible`);
  assert.equal(source.facts.length, 1, `${metricId} Person must keep its canonical facts`);
}

const personAvailableMeasures = [
  "person_day_count",
  "place_visit_count",
  "distinct_visit_days",
  "activity_frequency",
];
const personAnalysisSources = createAnalysisQuerySources({
  context: personRepository.context,
  facts: personFacts,
  metrics: new MetricQueryService(personFacts),
  repository: {
    async loadTaxonomyRows() { return []; },
    async loadEntityRows() { return []; },
    async loadLifeEventTypeRowsByTypeKeys() { return []; },
  },
});
const personInitialRequest = normalizeQueryRequest({
  resource: "analysis_month_initial",
  scope: personScope,
  params: {},
});
const personInitialCapabilities = evaluateQueryCapabilities(personInitialRequest, {
  requestId: "person-initial",
  permission: { granted: true },
  applicability: { measures: personAvailableMeasures },
});
assert.equal(personInitialCapabilities.ok, true);
const personInitial = parseAnalysisMonthInitialReadModel(
  await personAnalysisSources.readAnalysisMonthInitial({
    request: personInitialRequest,
    context: { capabilities: personInitialCapabilities.capabilities },
  }),
);
assert.equal(personInitial.actual.envelope.availability, "unknown");
assert.equal(personInitial.typical.envelope.availability, "unknown");
assert.equal(personInitial.minimal.envelope.availability, "unknown");
assert.equal(personInitial.actualVsTypical.relation, "not_comparable");
assert.deepEqual(personInitial.markedFacts, []);
assert.deepEqual(personInitial.markedFactsSelection, {
  kind: "unavailable",
  reason: "insufficient_data",
});
for (const params of [
  { view: "destination", dimension: "category", measure: "amount" },
  { view: "nature", dimension: "fixed_variable", measure: "amount" },
  { view: "life_context", dimension: "life_context", measure: "amount" },
]) {
  const request = normalizeQueryRequest({
    resource: "analysis_month_structure",
    scope: personScope,
    params,
  });
  const capabilityResult = evaluateQueryCapabilities(request, {
    requestId: `person-structure:${params.dimension}`,
    permission: { granted: true },
    applicability: { measures: personAvailableMeasures },
  });
  assert.equal(capabilityResult.ok, true);
  const model = parseAnalysisMonthStructureReadModel(
    await personAnalysisSources.readAnalysisMonthStructure({
      request,
      context: { capabilities: capabilityResult.capabilities },
    }),
  );
  assert.equal(model.total.envelope.availability, "unknown");
  assert.equal(model.total.envelope.value, null);
  assert.equal(model.rows.length, 0);
  assert.equal(
    model.capabilities.availableMeasures.includes(
      params.dimension === "category"
        ? "category_amount"
        : params.dimension === "fixed_variable"
          ? "fixed_variable_amount"
          : "life_scope_amount",
    ),
    false,
  );
}

const atomicMetricWrites = [];
const atomicBucketWrites = [];
const atomicMaterialization = {
  async readMetric() { return null; },
  async readGlobalAdditiveMetric() { return null; },
  async writeMetric(metricId, scope, metric) {
    atomicMetricWrites.push({ metricId, scope, metric });
  },
  async writeMetricBucket(metricId, scope, dimensionKey, bucketKey, metric) {
    atomicBucketWrites.push({ metricId, scope, dimensionKey, bucketKey, metric });
  },
};
const atomicMetrics = new MetricQueryService(personFacts, atomicMaterialization);
const personDayMetric = await atomicMetrics.produce("person_day_count", personScope);
assert.equal(personDayMetric.envelope.availability, "known");
assert.equal(personDayMetric.envelope.value, 1);
assert.equal(atomicMetricWrites.length, 1);
assert.equal(atomicMetricWrites[0].metricId, "person_day_count");

const householdAnalysisSources = createAnalysisQuerySources({
  context: personRepository.context,
  facts: personFacts,
  metrics: atomicMetrics,
  repository: {
    async loadTaxonomyRows() { return []; },
    async loadEntityRows() { return []; },
    async loadLifeEventTypeRowsByTypeKeys() { return []; },
  },
});
const fixedVariableRequest = normalizeQueryRequest({
  resource: "analysis_month_structure",
  scope: julyScope,
  params: { view: "nature", dimension: "fixed_variable", measure: "amount" },
});
const fixedVariableCapabilities = evaluateQueryCapabilities(fixedVariableRequest, {
  requestId: "household-fixed-variable",
  permission: { granted: true },
  applicability: { measures: ["fixed_variable_amount"] },
});
assert.equal(fixedVariableCapabilities.ok, true);
parseAnalysisMonthStructureReadModel(
  await householdAnalysisSources.readAnalysisMonthStructure({
    request: fixedVariableRequest,
    context: { capabilities: fixedVariableCapabilities.capabilities },
  }),
);
assert.deepEqual(
  atomicBucketWrites.map(({ dimensionKey, bucketKey }) => ({ dimensionKey, bucketKey })),
  [
    { dimensionKey: "fixed_variable", bucketKey: "Fixe" },
    { dimensionKey: "fixed_variable", bucketKey: "Variable" },
  ],
);
const fixedIdentity = metricBucketArtifactIdentity(
  baseContext,
  "fixed_variable_amount",
  julyScope,
  "fixed_variable",
  "Fixe",
);
const variableIdentity = metricBucketArtifactIdentity(
  baseContext,
  "fixed_variable_amount",
  julyScope,
  "fixed_variable",
  "Variable",
);
assert.notEqual(fixedIdentity.artifactKey, variableIdentity.artifactKey);
assert.equal(fixedIdentity.dimensionKey, "fixed_variable");
assert.equal(fixedIdentity.bucketKey, "Fixe");

let storedMetric = null;
let coldComputations = 0;
const resolver = {
  async resolve() {
    coldComputations += 1;
    return {
      kind: "economic_components",
      scopeHash: computeScopeHash(julyScope),
      availability: "known",
      facts: [],
      support: { n: 0, unit: "transaction", level: "insufficient" },
      coverage: { level: "complete" },
    };
  },
};
const materialization = {
  async readMetric() { return storedMetric; },
  async readGlobalAdditiveMetric() { return null; },
  async writeMetric(_metricId, _scope, metric) { storedMetric = metric; },
};
await new MetricQueryService(resolver, materialization).produce(
  "economic_consumption_net_attributable",
  julyScope,
);
await new MetricQueryService(resolver, materialization).produce(
  "economic_consumption_net_attributable",
  julyScope,
);
assert.equal(coldComputations, 1, "a second materialized read must not execute cold computation");

const responseBase = {
  data: {},
  meta: {
    dataRevision: "2",
    analyticsRevision: "1",
    contractVersion: "v1",
    computedAt: "2026-08-25T00:00:00Z",
  },
};
assert.equal(shouldAutomaticallyRevalidateClientQuery({
  ...responseBase,
  meta: {
    ...responseBase.meta,
    cachePolicy: { source: "materialized", revalidate: "never", sourceRevision: "1" },
  },
}), false);
assert.equal(shouldAutomaticallyRevalidateClientQuery({
  ...responseBase,
  meta: {
    ...responseBase.meta,
    cachePolicy: { source: "materialized", revalidate: "stale_while_revalidate", sourceRevision: "2" },
  },
}), true);

assert.equal(metricArtifactIdentity(baseContext, "economic_consumption_net_attributable", augustScope).period.isClosed, false);
console.log("Analytics materialization checks: PASS");
