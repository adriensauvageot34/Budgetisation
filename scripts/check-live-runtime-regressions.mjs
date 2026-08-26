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
Module._load = function loadRuntimeRegressionModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveRuntimeRegressionModule(
  request,
  parent,
  isMain,
  options,
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  try {
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  } catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [
      `${resolvedRequest}.ts`,
      `${resolvedRequest}.tsx`,
      path.join(resolvedRequest, "index.ts"),
      path.join(resolvedRequest, "index.tsx"),
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
  activityOccurrenceLifeEventTypeSelection,
  taxonomyPhysicalMappings,
  taxonomySelection,
} = require(path.join(repositoryRoot, "src/server/canonical/physical-contracts.ts"));
const { isMissingPurchaseRelationError } = require(path.join(
  repositoryRoot,
  "src/server/canonical/read-error-policy.ts",
));
const { projectActivityOccurrenceFact } = require(path.join(
  repositoryRoot,
  "src/analytics/facts/canonical.ts",
));
const { diagnosticOperationsRequest } = require(path.join(
  repositoryRoot,
  "src/app/diagnostic/operations-plan.ts",
));
const {
  operationDisplayModel,
  operationQueryHasLocalError,
  operationsFiltersForRuntimeRoot,
} = require(path.join(repositoryRoot, "src/features/operations/query-state.ts"));
const { exactEconomicAmountForDate } = require(path.join(
  repositoryRoot,
  "src/server/query/sources/shared.ts",
));
const { resolveHistoricalEconomicTiming } = require(path.join(
  repositoryRoot,
  "src/analytics/facts/economic-timing.ts",
));
const {
  financialReferenceCandidateFromAnalysisPeriod,
  selectComparisonReferenceWindow,
} = require(path.join(repositoryRoot, "src/analytics/references/index.ts"));
const { produceMetric } = require(path.join(
  repositoryRoot,
  "src/analytics/production/index.ts",
));
const { resolveMinimalPlanningSource } = require(path.join(
  repositoryRoot,
  "src/server/analytics/minimal-source-resolver.ts",
));
const { FactSourceResolver } = require(path.join(
  repositoryRoot,
  "src/server/analytics/fact-source-resolver.ts",
));
const { scopedMetricReadModel } = require(path.join(
  repositoryRoot,
  "src/server/analytics/metric-query-service.ts",
));
const { parseScopedMoneyMetricReadModel } = require(path.join(
  repositoryRoot,
  "src/query-api/read-models/index.ts",
));
const { resolveDefaultGlobalAsOf, isAllowedGlobalAsOf } = require(path.join(
  repositoryRoot,
  "src/server/bootstrap/global-as-of.ts",
));
const { operationsPeriodFromScope } = require(path.join(
  repositoryRoot,
  "src/navigation/transfer/operations-intent.ts",
));
const { normalizeAnalysisScope } = require(path.join(
  repositoryRoot,
  "src/core/scope/index.ts",
));
const {
  operationsAnalysisFilters,
  prepareExplorationScope,
  scopeForRoot,
} = require(path.join(
  repositoryRoot,
  "src/navigation/transfer/root-scope.ts",
));
const { useQueryRuntime } = require(path.join(
  repositoryRoot,
  "src/components/runtime/query-client.ts",
));
const { queryResultToState } = require(path.join(
  repositoryRoot,
  "src/app/product-query.ts",
));
const { recoverQueryRuntimeError } = require(path.join(
  repositoryRoot,
  "src/server/query/recoverable-error.ts",
));
const {
  QueryExecutionError,
  QueryTemporaryUnavailableError,
} = require(path.join(repositoryRoot, "src/query-api/server/errors.ts"));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

assert.equal(taxonomyPhysicalMappings.categories.idColumn, "category_id");
assert.equal(taxonomyPhysicalMappings.subcategories.idColumn, "subcategory_id");
assert.notEqual(taxonomyPhysicalMappings.categories.idColumn, "id");
assert.notEqual(taxonomyPhysicalMappings.subcategories.idColumn, "id");
assert.equal(
  taxonomySelection("categories"),
  "category_id,category_key,nom_canonique",
);
assert.equal(
  taxonomySelection("subcategories"),
  "subcategory_id,category_id,subcategory_key,nom_canonique",
);

assert.equal(
  activityOccurrenceLifeEventTypeSelection,
  "life_event_type_id,type_key,can_span_days,active",
);
const strictActivityTypeRow = {
  life_event_type_id: "00000000-0000-4000-8000-000000000020",
  type_key: "activity-running",
  can_span_days: true,
  active: true,
};
assert.equal(Object.hasOwn(strictActivityTypeRow, "label"), false);
const activityFact = projectActivityOccurrenceFact({
  household: {
    householdId: "00000000-0000-4000-8000-000000000001",
    householdTimeZone: "Europe/Paris",
  },
  lifeEvent: {
    life_event_id: "00000000-0000-4000-8000-000000000021",
    life_event_type_id: strictActivityTypeRow.life_event_type_id,
    life_event_series_id: null,
    parent_life_event_id: null,
    start_date: "2026-07-01",
    end_date: "2026-07-02",
    validation_status: "Confirmé",
  },
  lifeEventType: strictActivityTypeRow,
  participations: [],
});
assert.notEqual(activityFact, null);
assert.throws(() => projectActivityOccurrenceFact({
  household: {
    householdId: "00000000-0000-4000-8000-000000000001",
    householdTimeZone: "Europe/Paris",
  },
  lifeEvent: {
    life_event_id: "00000000-0000-4000-8000-000000000021",
    life_event_type_id: strictActivityTypeRow.life_event_type_id,
    life_event_series_id: null,
    parent_life_event_id: null,
    start_date: "2026-07-01",
    end_date: "2026-07-02",
    validation_status: "Confirmé",
  },
  lifeEventType: { ...strictActivityTypeRow, label: "Course" },
  participations: [],
}));

const operationsRequest = diagnosticOperationsRequest({
  latestBankMonth: "2026-07",
  completeClosedFinancePeriodCount: 0,
});
assert.notEqual(operationsRequest, null);
assert.equal(operationsRequest.scope.time.kind, "bank_month");
assert.equal(operationsRequest.scope.time.month, "2026-07");
assert.equal(operationsRequest.params.time.kind, "bank_month");
assert.equal(diagnosticOperationsRequest({
  latestBankMonth: null,
  completeClosedFinancePeriodCount: 4,
}), null);

const initialFilters = { timeKind: "bank_month", month: "2026-07" };
const calendarRuntimeRoot = {
  area: "calendar",
  context: { kind: "calendar_month", month: "2026-07" },
};
assert.equal(
  operationsFiltersForRuntimeRoot(calendarRuntimeRoot, initialFilters),
  initialFilters,
);
const runtimeOperationsFilters = {
  timeKind: "economic_month",
  month: "2026-06",
};
assert.equal(
  operationsFiltersForRuntimeRoot(
    { kind: "operations", filters: runtimeOperationsFilters },
    initialFilters,
  ),
  runtimeOperationsFilters,
);

const defaultOperationsRoot = {
  kind: "operations",
  filters: { timeKind: "bank_month", month: "2026-05" },
};
assert.equal(operationsAnalysisFilters(defaultOperationsRoot), undefined);
const defaultOperationsScope = scopeForRoot(defaultOperationsRoot);
assert.notEqual(defaultOperationsScope, null);
assert.deepEqual(defaultOperationsScope.filters, {
  categoryIds: [],
  activityIds: [],
  merchantIds: [],
  placeIds: [],
  lifeScopeContext: [],
  dayContext: [],
});

const merchantId = "11111111-1111-4111-8111-111111111111";
const merchantOperationsRoot = {
  kind: "operations",
  filters: {
    timeKind: "economic_month",
    month: "2026-05",
    merchantIds: [merchantId],
  },
};
const rawMerchantFilters = operationsAnalysisFilters(merchantOperationsRoot);
assert.deepEqual(rawMerchantFilters, { merchantIds: [merchantId] });
for (const absentKey of [
  "categoryIds",
  "activityIds",
  "placeIds",
  "lifeScopeContext",
  "dayContext",
]) {
  assert.equal(Object.hasOwn(rawMerchantFilters, absentKey), false);
}
assert.deepEqual(scopeForRoot(merchantOperationsRoot).filters.merchantIds, [merchantId]);

const globalOperationsScope = scopeForRoot({
  kind: "operations",
  filters: {
    timeKind: "global_window",
    globalWindow: "last_6_months",
    asOf: "2026-07",
  },
});
assert.equal(globalOperationsScope.time.kind, "global");
assert.equal(globalOperationsScope.time.observationWindow, "last_6_months");

const analysisMonthRoot = {
  area: "analysis",
  context: { kind: "analysis_month", month: "2026-05" },
};
assert.doesNotThrow(() => scopeForRoot(analysisMonthRoot));
assert.deepEqual(scopeForRoot(analysisMonthRoot).filters, defaultOperationsScope.filters);

const normalizedRouteFilters = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "month", month: "2026-05" },
  filters: { merchantIds: [merchantId] },
}).filters;
const filteredMonthScope = scopeForRoot({
  area: "analysis",
  context: {
    kind: "analysis_month",
    month: "2026-05",
    filters: normalizedRouteFilters,
  },
});
assert.deepEqual(filteredMonthScope.filters, normalizedRouteFilters);

const analysisGlobalRoot = {
  area: "analysis",
  context: {
    kind: "analysis_global",
    observationWindow: "last_12_months",
    asOf: "2026-07",
  },
};
assert.doesNotThrow(() => scopeForRoot(analysisGlobalRoot));
assert.deepEqual(scopeForRoot(analysisGlobalRoot).filters, defaultOperationsScope.filters);
const filteredGlobalScope = scopeForRoot({
  ...analysisGlobalRoot,
  context: { ...analysisGlobalRoot.context, filters: normalizedRouteFilters },
});
assert.deepEqual(filteredGlobalScope.filters, normalizedRouteFilters);

for (const calendarRoot of [
  { area: "calendar", context: { kind: "calendar_month", month: "2026-05" } },
  { area: "calendar", context: { kind: "calendar_week", month: "2026-05", week: "semaine-18" } },
]) {
  assert.doesNotThrow(() => scopeForRoot(calendarRoot));
  assert.equal(scopeForRoot(calendarRoot).time.month, "2026-05");
}

const inactiveSnapshot = {
  history: { root: defaultOperationsRoot, exploration: null },
};
assert.deepEqual(prepareExplorationScope({
  root: inactiveSnapshot.history.root,
  registeredScope: null,
  explorationRequested: inactiveSnapshot.history.exploration !== null,
}), { kind: "inactive" });
const activePreparation = prepareExplorationScope({
  root: merchantOperationsRoot,
  registeredScope: null,
  explorationRequested: true,
});
assert.equal(activePreparation.kind, "ready");
assert.deepEqual(activePreparation.scope.filters.merchantIds, [merchantId]);
assert.deepEqual(prepareExplorationScope({
  root: { kind: "operations", filters: {} },
  registeredScope: null,
  explorationRequested: true,
}), { kind: "invalid_scope" });

const monthScope = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "month", month: "2026-07" },
});
assert.deepEqual(operationsPeriodFromScope(monthScope), {
  timeKind: "economic_month",
  month: "2026-07",
});
const globalScope = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "global", observationWindow: "last_12_months", asOf: "2026-07" },
});
assert.deepEqual(operationsPeriodFromScope(globalScope), {
  timeKind: "global_window",
  globalWindow: "last_12_months",
  asOf: "2026-07",
});

assert.equal(
  exactEconomicAmountForDate([], "2026-07-01", "partial").envelope.availability,
  "unknown",
);
const qualifiedZero = exactEconomicAmountForDate([], "2026-07-01", "complete").envelope;
assert.equal(qualifiedZero.availability, "known");
assert.equal(qualifiedZero.value, "0");

const error = {
  code: "TEMPORARY_UNAVAILABLE",
  message: "Une dépendance est indisponible.",
  retryable: true,
  requestId: "runtime-regression-error",
};
const localErrorState = queryResultToState({ ok: false, error });
assert.equal(localErrorState.status, "error");
assert.equal(localErrorState.error.code, "TEMPORARY_UNAVAILABLE");
assert.equal(operationDisplayModel(localErrorState), undefined);
assert.equal(operationQueryHasLocalError(localErrorState), true);

function QueryRuntimeErrorHarness() {
  const state = useQueryRuntime(operationsRequest, localErrorState);
  return React.createElement(
    "output",
    { "data-status": state.status },
    state.status === "error" ? state.error.code : "unexpected",
  );
}
const renderedRuntimeError = renderToStaticMarkup(
  React.createElement(QueryRuntimeErrorHarness),
);
assert.match(renderedRuntimeError, /data-status="error"/);
assert.match(renderedRuntimeError, /TEMPORARY_UNAVAILABLE/);

const contractError = {
  code: "CONTRACT_MISMATCH",
  message: "Contrat invalide.",
  retryable: false,
  requestId: "contract-error",
};
assert.equal(
  recoverQueryRuntimeError(
    new QueryExecutionError(contractError),
    "fallback-request",
  ).error.code,
  "CONTRACT_MISMATCH",
);
assert.equal(
  recoverQueryRuntimeError(
    new QueryTemporaryUnavailableError(),
    "temporary-request",
  ).error.code,
  "TEMPORARY_UNAVAILABLE",
);
assert.equal(recoverQueryRuntimeError(new Error("system"), "system-request"), null);

assert.equal(isMissingPurchaseRelationError({ code: "PGRST205" }), true);
assert.equal(isMissingPurchaseRelationError({ code: "42P01" }), true);
assert.equal(isMissingPurchaseRelationError({ code: "42501" }), false);

const componentKey = "operation:00000000-0000-4000-8000-000000000100";
const timingInput = {
  canonicalComponentKey: componentKey,
  canonicalEconomicNet: "120",
  forcedAnalyticMonth: null,
  realTransactionDate: null,
  realTransactionDateReliable: false,
  bankDate: "2026-06-03",
};
const explicitTiming = {
  kind: "known",
  segments: [{
    segmentKey: "00000000-0000-4000-8000-000000000101",
    timingState: "known",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-01",
    economicMonth: "2026-05",
    amount: "120",
  }],
};
const explicitResolution = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming,
  forcedAnalyticMonth: "2026-06",
  realTransactionDate: "2026-06-03",
  realTransactionDateReliable: true,
});
assert.equal(explicitResolution.source, "explicit_economic_segment");
assert.equal(explicitResolution.timing, explicitTiming);

const forcedMonthOnly = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming: { kind: "unknown" },
  forcedAnalyticMonth: "2026-04",
});
assert.equal(forcedMonthOnly.source, "forced_analytic_month");
assert.equal(forcedMonthOnly.timing.segments[0].economicMonth, "2026-04");
assert.equal(forcedMonthOnly.timing.segments[0].periodStart, null);
assert.equal(forcedMonthOnly.exactDayKnown, false);
const forcedMonthWithDifferentRealDate = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming: { kind: "unknown" },
  forcedAnalyticMonth: "2026-04",
  realTransactionDate: "2026-03-31",
  realTransactionDateReliable: true,
});
assert.equal(forcedMonthWithDifferentRealDate.timing.segments[0].economicMonth, "2026-04");
assert.equal(forcedMonthWithDifferentRealDate.timing.segments[0].periodStart, null);

const realDateResolution = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming: { kind: "unknown" },
  realTransactionDate: "2026-06-02",
  realTransactionDateReliable: true,
});
assert.equal(realDateResolution.source, "real_transaction_date");
assert.equal(realDateResolution.timing.segments[0].periodStart, "2026-06-02");
assert.equal(realDateResolution.timing.segments[0].economicMonth, "2026-06");

const bankDateResolution = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming: { kind: "unknown" },
});
assert.equal(bankDateResolution.source, "bank_date_fallback");
assert.equal(bankDateResolution.timing.segments[0].periodStart, "2026-06-03");
const futureTripMomentResolution = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming: { kind: "unknown" },
  realTransactionDate: "2026-06-02",
  realTransactionDateReliable: true,
});
assert.equal(futureTripMomentResolution.timing.segments[0].economicMonth, "2026-06");
const annualInsuranceResolution = resolveHistoricalEconomicTiming({
  ...timingInput,
  explicitTiming: { kind: "unknown" },
  bankDate: "2026-01-08",
});
assert.equal(annualInsuranceResolution.timing.segments[0].economicMonth, "2026-01");

const closedPeriods = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 7 + index, 1));
  const month = date.toISOString().slice(0, 7);
  return {
    analysisPeriodId: `period-${month}`,
    householdId: "00000000-0000-4000-8000-000000000001",
    month: `${month}-01`,
    financeStatus: "complete",
    lifeStatus: "complete",
    locationStatus: "complete",
    calendarStatus: "complete",
    isClosed: true,
    sourceRevision: "1",
  };
});
const currentOpenPeriod = {
  ...closedPeriods.at(-1),
  analysisPeriodId: "period-2026-08",
  month: "2026-08-01",
  financeStatus: "unknown",
  lifeStatus: "unknown",
  locationStatus: "unknown",
  calendarStatus: "unknown",
  isClosed: false,
};
const typicalWindow = selectComparisonReferenceWindow({
  householdId: "00000000-0000-4000-8000-000000000001",
  householdTimeZone: "Europe/Paris",
  targetPeriod: "2026-08",
  requestedPeriodCount: 12,
  candidates: [...closedPeriods, currentOpenPeriod].map((analysisPeriod) =>
    financialReferenceCandidateFromAnalysisPeriod({
      analysisPeriod,
      isComparable: true,
      isMethodExcluded: false,
    })),
});
assert.equal(typicalWindow.includedPeriods.length, 12);
assert.equal(typicalWindow.includedPeriods.includes("2026-08"), false);
assert.equal(resolveDefaultGlobalAsOf([...closedPeriods, currentOpenPeriod]), "2026-08");
assert.equal(isAllowedGlobalAsOf([...closedPeriods, currentOpenPeriod], "2026-08"), true);
assert.equal(isAllowedGlobalAsOf([...closedPeriods, currentOpenPeriod], "2026-09"), false);

const minimalMonths = ["2026-05", "2026-06", "2026-07"];
const rule = (id, categoryId, eligibility, conditionCode = null) => ({
  baseline_rule_id: id,
  category_id: categoryId,
  subcategory_id: null,
  type_precis: null,
  eligibility,
  condition_code: conditionCode,
  valid_from: null,
  valid_to: null,
  method_version: "minimal_baseline_v1",
});
const operation = (id, categoryId, mode, extras = {}) => ({
  operation_id: id,
  category_id: categoryId,
  type_precis: extras.type_precis ?? "Source test",
  role_budgetaire: extras.role_budgetaire ?? "Socle",
  mode_prevision: mode,
  recurrence_series_id: extras.recurrence_series_id ?? null,
  need_id: extras.need_id ?? null,
  annual_event_id: extras.annual_event_id ?? null,
  provision_pool_id: extras.provision_pool_id ?? null,
});
const economicFact = (id, operationId, categoryId, month, amount) => ({
  canonicalComponentKey: `operation:${id}`,
  sourceOperation: { kind: "resolved", id: operationId },
  category: { kind: "resolved", id: categoryId },
  subcategory: { kind: "unknown" },
  economicTiming: {
    kind: "known",
    segments: [{
      segmentKey: `segment-${id}-${month}`,
      timingState: "known",
      periodStart: `${month}-10`,
      periodEnd: `${month}-10`,
      economicMonth: month,
      amount,
    }],
  },
});
const ids = {
  neutral: "00000000-0000-4000-8000-000000000201",
  excluded: "00000000-0000-4000-8000-000000000202",
  mixed: "00000000-0000-4000-8000-000000000203",
  child: "00000000-0000-4000-8000-000000000204",
  fuel: "00000000-0000-4000-8000-000000000205",
  provision: "00000000-0000-4000-8000-000000000206",
  recurrence: "00000000-0000-4000-8000-000000000207",
  cadence: "00000000-0000-4000-8000-000000000208",
};
const categories = {
  eligible: "00000000-0000-4000-8000-000000000301",
  excluded: "00000000-0000-4000-8000-000000000302",
  mixed: "00000000-0000-4000-8000-000000000303",
  fuel: "00000000-0000-4000-8000-000000000304",
  health: "00000000-0000-4000-8000-000000000305",
};
const minimalBundle = {
  economicFacts: [
    ...minimalMonths.map((month) => economicFact(ids.neutral, ids.neutral, categories.eligible, month, "60")),
    economicFact(ids.excluded, ids.excluded, categories.excluded, "2026-06", "999"),
    economicFact(ids.mixed, ids.mixed, categories.mixed, "2026-06", "500"),
    {
      ...economicFact(ids.child, ids.mixed, categories.eligible, "2026-06", "30"),
      canonicalComponentKey: `allocation:${ids.child}`,
    },
    economicFact(ids.fuel, ids.fuel, categories.fuel, "2026-06", "400"),
    economicFact(ids.provision, ids.provision, categories.health, "2026-06", "120"),
    economicFact(ids.recurrence, ids.recurrence, categories.eligible, "2026-06", "300"),
    economicFact(ids.cadence, ids.cadence, categories.eligible, "2026-06", "90"),
  ],
  operations: [
    operation(ids.neutral, categories.eligible, "Référence mensuelle"),
    operation(ids.excluded, categories.excluded, "Référence mensuelle"),
    operation(ids.mixed, categories.mixed, "Selon composants"),
    operation(ids.fuel, categories.fuel, "Référence mensuelle"),
    operation(ids.provision, categories.health, "Provision annualisée", { provision_pool_id: "pool-health" }),
    operation(ids.recurrence, categories.eligible, "Échéance fixe", { recurrence_series_id: "series-fixed" }),
    operation(ids.cadence, categories.eligible, "Cadence de rachat", { need_id: "need-care" }),
  ],
  allocations: [{
    allocation_id: ids.child,
    operation_id: ids.mixed,
    type_precis: "Composant éligible",
    role_budgetaire: "Socle",
    mode_prevision: "Référence mensuelle",
    recurrence_series_id: null,
    need_id: null,
    annual_event_id: null,
    provision_pool_id: null,
  }],
  items: [],
  paymentComponents: [],
  cashUses: [],
  baselineRules: [
    rule("rule-eligible", categories.eligible, "Eligible"),
    rule("rule-excluded", categories.excluded, "Excluded"),
    rule("rule-mixed", categories.mixed, "Conditional", "RESOLVE_COMPONENTS"),
    rule("rule-fuel", categories.fuel, "Conditional", "WORK_COMMUTE_FUEL_ONLY"),
    rule("rule-health", categories.health, "Excluded"),
  ],
  needs: [{ need_id: "need-care", actif: true }],
  provisionPools: [{ provision_pool_id: "pool-health", application_auto: true }],
  recurrenceSeries: [{ recurrence_series_id: "series-fixed", actif_prevision: true }],
  annualEvents: [],
  worksiteActivityTypeIds: ["worksite-type"],
  activityOccurrences: minimalMonths.flatMap((month, monthIndex) =>
    Array.from({ length: 2 }, (_, index) => ({
      activityId: "worksite-type",
      startDate: `${month}-0${index + 1}`,
      lifeEventId: `work-${monthIndex}-${index}`,
    }))),
};
const minimalResolution = resolveMinimalPlanningSource({
  bundle: minimalBundle,
  targetMonth: "2026-08",
  referenceMonths: minimalMonths,
});
assert.equal(minimalResolution.availability, "known");
assert.equal(minimalResolution.health.neutralVariable, "AVAILABLE");
assert.equal(minimalResolution.health.obligationsAndProvisions, "AVAILABLE");
assert.equal(minimalResolution.neutralVariableComponents.some(({ amount }) => amount === "999"), false);
assert.equal(minimalResolution.neutralVariableComponents.some(({ amount }) => amount === "500"), false);
assert.equal(
  minimalResolution.neutralVariableComponents.find(({ canonicalComponentKey }) =>
    canonicalComponentKey === "minimal:conditional:work-commute-fuel")?.amount,
  "3.4",
);
assert.equal(
  minimalResolution.mandatoryMonthlyObligationsAndProvisions.find(({ canonicalComponentKey }) =>
    canonicalComponentKey === "minimal:provision:pool-health")?.amount,
  "40",
);
assert.equal(
  minimalResolution.mandatoryMonthlyObligationsAndProvisions.filter(({ canonicalComponentKey }) =>
    canonicalComponentKey === "minimal:recurrence:series-fixed").length,
  1,
);
assert.equal(new Set([
  ...minimalResolution.neutralVariableComponents,
  ...minimalResolution.mandatoryMonthlyObligationsAndProvisions,
].map(({ canonicalComponentKey }) => canonicalComponentKey)).size,
minimalResolution.neutralVariableComponents.length + minimalResolution.mandatoryMonthlyObligationsAndProvisions.length);

const partialMinimal = resolveMinimalPlanningSource({
  bundle: { ...minimalBundle, worksiteActivityTypeIds: [], activityOccurrences: [] },
  targetMonth: "2026-08",
  referenceMonths: minimalMonths,
});
assert.equal(partialMinimal.health.neutralVariable, "PARTIAL");

const fakeMinimalRepository = {
  context: {
    householdId: "00000000-0000-4000-8000-000000000001",
    timezone: "Europe/Paris",
    periods: [...closedPeriods, currentOpenPeriod],
  },
  loadMinimalPlanningBundle: async () => minimalBundle,
};
const minimalScope = normalizeAnalysisScope({
  subject: { kind: "household" },
  time: { kind: "month", month: "2026-08" },
});
const resolvedMinimalSource = await new FactSourceResolver(fakeMinimalRepository)
  .resolve("minimal_month_cost", minimalScope);
assert.equal(resolvedMinimalSource.availability, "known");
const producedMinimal = produceMetric({
  metricId: "minimal_month_cost",
  scope: minimalScope,
  source: resolvedMinimalSource,
});
assert.equal(producedMinimal.availability, "known");
assert.doesNotThrow(() => parseScopedMoneyMetricReadModel(scopedMetricReadModel(producedMinimal)));

console.log("Live runtime regression checks: PASS");
