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
Module._load = function loadHistoryV2Module(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveHistoryV2Module(request, parent, isMain, options) {
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

const materialization = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/history-v2.ts",
));
const identity = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/identity.ts",
));
const { SupabaseAnalyticsMaterializationStore } = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/store.ts",
));
const calendar = require(path.join(
  repositoryRoot,
  "src/analytics/history-v2/calendar/index.ts",
));
const daily = require(path.join(
  repositoryRoot,
  "src/analytics/history-v2/daily-finance/index.ts",
));
const historyAnalytics = require(path.join(
  repositoryRoot,
  "src/analytics/history-v2/index.ts",
));
const balance = require(path.join(
  repositoryRoot,
  "src/analytics/history-v2/month-balance/index.ts",
));
const historyCore = require(path.join(repositoryRoot, "src/core/history-v2/index.ts"));
const historyQuery = require(path.join(repositoryRoot, "src/query-api/history-v2/index.ts"));
const query = require(path.join(repositoryRoot, "src/query-api/index.ts"));

const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const householdId = uuid(1);
const selectedMonth = "2026-05";
const sourceRef = (id) => ({ kind: "fixture", id });
const target = (resource, params) => ({ resource, params });
const visibleKnown = (value) => ({ visibility: "VISIBLE", data: { status: "KNOWN", value } });
const knownCollection = (items) => ({
  visibility: "VISIBLE",
  data: { status: "KNOWN", items, totalCount: items.length },
});

const runtimeContext = {
  userId: "history-v2-preflight",
  householdId,
  persons: [],
  personIds: [],
  timezone: "Europe/Paris",
  periods: ["2026-04", "2026-05", "2026-06"].map((month, index) => ({
    analysisPeriodId: uuid(100 + index),
    householdId,
    month: `${month}-01`,
    financeStatus: "complete",
    lifeStatus: "complete",
    locationStatus: "complete",
    calendarStatus: "complete",
    isClosed: true,
    sourceRevision: "7",
  })),
  dataRevision: "7",
  analyticsRevision: "11",
  contractVersion: "v1",
  asOf: "2026-08-30T12:00:00Z",
};

function capabilities(resource) {
  const maximum = query.getQueryCapabilityMaximum(resource);
  return {
    resource: maximum.resource,
    availableSections: maximum.sections,
    availableMeasures: maximum.measures,
    compatibleFilters: maximum.filters,
    unavailable: [],
  };
}

function calendarArtifact(month) {
  return calendar.buildCalendarSemanticMonthArtifact({
    householdId,
    month,
    lifeEvents: [],
    moments: [],
    contexts: [],
    momentLifeEvents: [],
    sourceCompleteness: "KNOWN",
  });
}

function dailyArtifact(month) {
  return daily.buildDailyEconomicLedgerMonthArtifact({
    householdId,
    month,
    currency: "EUR",
    actualMonthAmount: "0",
    components: [],
    purchaseEvents: [],
  });
}

const calendarArtifacts = ["2026-04", "2026-05", "2026-06"].map(calendarArtifact);
const dailyArtifacts = ["2026-04", "2026-05", "2026-06"].map(dailyArtifact);
const selectedCalendarArtifact = calendarArtifacts[1];
const selectedDailyArtifact = dailyArtifacts[1];

function calendarBuilderContext(resource) {
  return {
    householdId,
    timeZone: "Europe/Paris",
    capabilities: capabilities(resource),
    calendarArtifacts,
    dailyArtifacts,
    personDirectory: [],
    expenseDescriptors: [],
  };
}

function balanceBuilderContext(resource, params) {
  const contract = query.getQueryResourceContract(resource);
  return {
    householdId,
    month: selectedMonth,
    resourceInputHash: historyAnalytics.computeResourceInputHash({
      identity: `${resource}:${JSON.stringify(params)}`,
      facts: [{
        factType: "fixture_resource_input",
        identity: `${resource}:${JSON.stringify(params)}`,
        value: { resource, params },
      }],
    }),
    policyVersions: historyCore.resolvePolicyVersions(contract.policyIds),
    capabilities: capabilities(resource),
    sourceRefs: [sourceRef(`resource:${resource}`)],
  };
}

const categorySummary = {
  categoryId: "food",
  label: "Vie courante",
  actual: { status: "KNOWN", value: "70" },
  shareOfActual: { status: "KNOWN", value: 0.7 },
  typical: { status: "KNOWN", value: "60" },
  delta: { status: "KNOWN", value: "10" },
  material: true,
  detailRef: target(query.queryResourceKeys.historyCategoryDetail, { categoryId: "food" }),
  sourceRefs: [sourceRef("category:food")],
};

const spending = balance.buildSpendingAxes({
  actual: "100",
  components: [
    {
      componentKey: "component:1",
      amount: "60",
      necessity: "OPTIONAL",
      behavior: "VARIABLE",
      lifeScope: "CURRENT_LIFE",
      nonNegative: true,
    },
    {
      componentKey: "component:2",
      amount: "40",
      necessity: "CONSTRAINED",
      behavior: "FIXED",
      lifeScope: "CURRENT_LIFE",
      nonNegative: true,
    },
  ],
});
const categorySpending = balance.buildSpendingAxes({
  actual: "70",
  components: [
    {
      componentKey: "category-component:known",
      amount: "60",
      necessity: "OPTIONAL",
      behavior: "VARIABLE",
      lifeScope: "CURRENT_LIFE",
      nonNegative: true,
    },
    {
      componentKey: "category-component:unknown",
      amount: "10",
      nonNegative: true,
    },
  ],
});
const minimalPreview = balance.buildMinimalPreview({
  minimal: "100",
  components: [
    { componentId: "minimal:1", label: "Obligations", family: "OBLIGATIONS", amount: "50" },
    { componentId: "minimal:2", label: "Variable", family: "VARIABLES_INDISPENSABLES", amount: "20" },
    { componentId: "minimal:3", label: "Provision", family: "PROVISIONS", amount: "20" },
    { componentId: "minimal:4", label: "Conditionnel", family: "BESOINS_CONDITIONNELS", amount: "10" },
  ],
});
const frequencyTicket = balance.explainFrequencyTicket({
  currentFrequency: 2,
  referenceFrequency: 2,
  currentMedianTicket: "20",
  referenceMedianTicket: "20",
  referenceMonths: 8,
  ticketSupport: 8,
  currentCoverage: 1,
});
const activitySummary = {
  ...balance.rankActivities([{
    activityTypeKey: "cinema",
    occurrences: 2,
    referenceOccurrences: 1,
    hasOtherNarrativeMoment: false,
    priorityBand: 2,
    qualifiedCostShare: 0.1,
    qualifiedCost: "10",
  }])[0],
  label: "Cinéma",
  costKind: "CAUSAL",
  cost: { status: "KNOWN", value: "10" },
  detailRef: target(query.queryResourceKeys.historyActivityDetail, { activityTypeKey: "cinema" }),
  sourceRefs: [sourceRef("activity:cinema")],
};
const momentSummary = {
  momentId: "moment:weekend",
  title: "Week-end",
  startDate: "2026-05-09",
  endDate: "2026-05-10",
  highlightRank: 1,
  causalCost: { status: "KNOWN", value: "20" },
  fallbackIconKey: "moment",
  detailRef: target(query.queryResourceKeys.historyMomentDetail, { momentId: "moment:weekend" }),
  sourceRefs: [sourceRef("moment:weekend")],
};
const placeSummary = {
  ...balance.rankPlaces([{
    placeId: "place:paris",
    bestHighlightRank: 1,
    momentCount: 1,
    presenceDays: 2,
    activityTypeCount: 1,
    localizedAmount: "30",
    localizedShare: 0.3,
    localizedCoverage: 1,
    semanticKind: "TRAVEL_STAY",
    routineKind: "NONE",
  }])[0],
  label: "Paris",
  localizedAmount: { status: "KNOWN", value: "30" },
  detailRef: target(query.queryResourceKeys.historyPlaceDetail, { placeId: "place:paris" }),
  sourceRefs: [sourceRef("place:paris")],
};

function buildBalanceReadModel(request) {
  const context = balanceBuilderContext(request.resource, request.params);
  switch (request.resource) {
    case "history_month_balance_summary":
      return historyQuery.buildMonthBalanceSummaryReadModel({
        context,
        actual: visibleKnown("100"),
        typical: visibleKnown("90"),
        minimal: visibleKnown("70"),
        comparableActualsIncludingCurrent: ["100", "90"],
        typicalSupportMonths: 8,
        importedSummary: { freshness: "MISSING" },
      });
    case "history_bank_economy_bridge":
      return historyQuery.buildBankEconomyBridgeReadModel({
        context,
        bridge: balance.buildBankEconomyBridge({
          bankOutflows: "100",
          actual: "100",
          lines: [],
          linesComplete: true,
        }),
      });
    case "history_month_categories":
      return historyQuery.buildMonthCategoriesReadModel({
        context,
        categories: [categorySummary],
        otherAmount: visibleKnown("30"),
        unclassifiedAmount: visibleKnown("0"),
      });
    case "history_category_detail":
      return historyQuery.buildCategoryDetailReadModel({
        context,
        category: { ...categorySummary, categoryId: request.params.categoryId },
        typicalComposition: balance.computeTypicalCompositionBaseline({
          pivotMonthIds: ["2026-03", "2026-04"],
          months: [
            { month: "2026-03", complete: true, amountsByStableId: { food: "60" } },
            { month: "2026-04", complete: true, amountsByStableId: { food: "60" } },
          ],
          typicalCategoryAmount: "60",
        }),
        explanation: balance.explainCategory({
          categoryDelta: "10",
          categoryMaterial: true,
          contributions: [{
            stableId: "food",
            label: "Vie courante",
            actual: "70",
            baseline: { status: "KNOWN", value: "60" },
            contribution: { status: "KNOWN", value: "10" },
          }],
        }),
        frequencyTicket,
        merchantAndPurchaseDrivers: [],
        lifecycleBadges: [],
        classifications: categorySpending,
      });
    case "history_month_spending_nature":
      return historyQuery.buildMonthSpendingNatureReadModel({
        context,
        actual: visibleKnown("100"),
        necessity: spending.necessity,
        behavior: spending.behavior,
        lifeScope: spending.lifeScope,
        matrix: spending.matrix,
      });
    case "history_spending_segment_detail":
      return historyQuery.buildSpendingSegmentDetailReadModel({
        context,
        segment: request.params,
        amount: visibleKnown("20"),
        contributors: knownCollection([]),
        otherAmount: visibleKnown("0"),
      });
    case "history_minimal_preview":
      return historyQuery.buildMinimalPreviewReadModel({
        context,
        minimal: visibleKnown("100"),
        preview: minimalPreview,
      });
    case "history_month_life_money":
      return historyQuery.buildMonthLifeMoneyReadModel({
        context,
        activities: [activitySummary],
        moments: [momentSummary],
        places: [placeSummary],
      });
    case "history_activity_detail":
      return historyQuery.buildActivityDetailReadModel({
        context,
        activity: { ...activitySummary, activityTypeKey: request.params.activityTypeKey },
        occurrences: knownCollection([]),
        frequencyTicket: { visibility: "VISIBLE", data: frequencyTicket },
        causalExpenses: knownCollection([]),
        associatedExpenses: knownCollection([]),
      });
    case "history_moment_detail":
      return historyQuery.buildMomentDetailReadModel({
        context,
        moment: { ...momentSummary, momentId: request.params.momentId },
        causalCost: visibleKnown("20"),
        spentDuring: visibleKnown("20"),
        causalExpenses: knownCollection([]),
        spentDuringExpenses: knownCollection([]),
      });
    case "history_place_detail":
      return historyQuery.buildPlaceDetailReadModel({
        context,
        place: { ...placeSummary, placeId: request.params.placeId },
        localizedCoverage: { status: "KNOWN", value: 1 },
        localizedAmount: visibleKnown("30"),
        presenceDays: knownCollection([]),
      });
    default:
      throw new TypeError(`Fixture Bilan absente pour ${request.resource}.`);
  }
}

function buildReadModel(request) {
  switch (request.resource) {
    case "history_month_calendar":
      return historyQuery.buildMonthCalendarReadModel(
        calendarBuilderContext(request.resource),
        selectedMonth,
      );
    case "history_week":
      return historyQuery.buildWeekReadModel(
        calendarBuilderContext(request.resource),
        request.params.weekStart,
      );
    case "history_day_journal":
      return historyQuery.buildJournalDayReadModel(
        calendarBuilderContext(request.resource),
        request.params.date,
        {
          refundsAndAdjustments: { status: "KNOWN", items: [], totalCount: 0 },
          inflows: { status: "KNOWN", items: [], totalCount: 0 },
          technicalMovements: { status: "KNOWN", items: [], totalCount: 0 },
          causalCostByCalendarItemId: {},
        },
      );
    case "history_month_overview":
      return historyQuery.buildMonthQuickOverviewReadModel(
        calendarBuilderContext(request.resource),
        selectedMonth,
        {
          bankOutflows: { status: "KNOWN", value: "0" },
          bankInflows: { status: "KNOWN", value: "0" },
          causalCostByCalendarItemId: {},
          explicitIncidentHighlights: [],
        },
      );
    default:
      return buildBalanceReadModel(request);
  }
}

function queryBuildResult(request, mutation = "base") {
  return {
    data: buildReadModel(request),
    facts: [{
      factType: "fixture_query",
      identity: `${request.resource}:${JSON.stringify(request.params)}`,
      value: {
        resource: request.resource,
        params: request.params,
        mutation: request.resource === "history_place_detail" ? mutation : "base",
      },
    }],
  };
}

const artifactInputs = [
  {
    artifactFamily: "calendar_semantic_month",
    payload: selectedCalendarArtifact,
    facts: [{ factType: "fixture_artifact", identity: "calendar:2026-05", value: { rows: 0 } }],
  },
  {
    artifactFamily: "daily_economic_ledger_month",
    payload: selectedDailyArtifact,
    facts: [{ factType: "fixture_artifact", identity: "ledger:2026-05", value: { amount: "0" } }],
  },
];

let checks = 0;
const check = (callback) => {
  callback();
  checks += 1;
};
const checkAsync = async (callback) => {
  await callback();
  checks += 1;
};

const monthScope = {
  subject: { kind: "household" },
  time: { kind: "month", month: selectedMonth },
};

function evaluatedCapabilities(resource, params) {
  const request = query.normalizeQueryRequest({ resource, scope: monthScope, params });
  const result = query.evaluateQueryCapabilities(request, {
    requestId: `capabilities-${resource}`,
    permission: { granted: true },
  });
  assert.equal(result.ok, true, `${resource} doit être autorisée.`);
  return result.capabilities;
}

function assertMaximumCapabilities(resource, params = {}) {
  const maximum = query.getQueryCapabilityMaximum(resource);
  const actual = evaluatedCapabilities(resource, params);
  assert.deepEqual(actual.availableSections, maximum.sections, `${resource}: sections`);
  assert.deepEqual(actual.availableMeasures, maximum.measures, `${resource}: mesures`);
  assert.deepEqual(actual.compatibleFilters, maximum.filters, `${resource}: filtres`);
  assert.deepEqual(actual.unavailable, [], `${resource}: aucune capability implicite ne doit être rejetée.`);
}

check(() => assertMaximumCapabilities("history_month_balance_summary"));
check(() => assertMaximumCapabilities("history_month_categories"));
check(() => assertMaximumCapabilities("history_category_detail", { categoryId: "food" }));
check(() => assertMaximumCapabilities("history_month_spending_nature"));
check(() => assertMaximumCapabilities("history_spending_segment_detail", { axis: "lifeScope", bucket: "HOUSEHOLD" }));
check(() => assertMaximumCapabilities("history_spending_segment_detail", { necessity: "INDISPENSABLE", behavior: "FIXED" }));
check(() => assertMaximumCapabilities("history_month_life_money"));
check(() => assertMaximumCapabilities("history_activity_detail", { activityTypeKey: "sport" }));
check(() => assertMaximumCapabilities("history_place_detail", { placeId: uuid(501) }));
check(() => {
  const guard = evaluatedCapabilities("analysis_target", {
    target: { kind: "activity", activityId: "sport" },
  });
  assert.equal(guard.availableMeasures.includes("category_amount"), false);
  assert.equal(
    guard.unavailable.some(({ kind, reason }) => kind === "measure" && reason === "not_applicable"),
    true,
    "Une ressource sans agrégation Category doit toujours exiger le filtre canonique.",
  );
});

function latestMonthFakeClient(periodMonth) {
  const calls = [];
  const builder = {
    select(columns) { calls.push(["select", columns]); return this; },
    eq(column, value) { calls.push(["eq", column, value]); return this; },
    is(column, value) { calls.push(["is", column, value]); return this; },
    not(column, operator, value) { calls.push(["not", column, operator, value]); return this; },
    order(column, options) { calls.push(["order", column, options]); return this; },
    async limit(value) {
      calls.push(["limit", value]);
      return {
        data: periodMonth === null ? [] : [{ period_month: `${periodMonth}-01` }],
        error: null,
      };
    },
  };
  return {
    calls,
    client: {
      from(table) {
        calls.push(["from", table]);
        return builder;
      },
    },
  };
}

const latestMonthContext = {
  ...runtimeContext,
  periods: ["2026-07", "2026-08"].map((month, index) => ({
    ...runtimeContext.periods[0],
    analysisPeriodId: uuid(600 + index),
    month: `${month}-01`,
  })),
};
const julyPublication = latestMonthFakeClient("2026-07");
const augustPublication = latestMonthFakeClient("2026-08");
const noPublication = latestMonthFakeClient(null);
await checkAsync(async () => {
  const result = await new SupabaseAnalyticsMaterializationStore(
    julyPublication.client,
    latestMonthContext,
  ).readLatestPublishedHistoryV2Month();
  assert.equal(result, "2026-07");
  assert.ok(latestMonthContext.periods.some(({ month }) => month === "2026-08-01"));
  assert.ok(julyPublication.calls.some((call) => call[0] === "eq" && call[1] === "resource" && call[2] === "history_month_calendar"));
  assert.ok(julyPublication.calls.some((call) => call[0] === "eq" && call[1] === "analytics_publications.status" && call[2] === "published"));
  assert.ok(julyPublication.calls.some((call) => call[0] === "eq" && call[1] === "is_active" && call[2] === true));
  assert.ok(julyPublication.calls.some((call) => call[0] === "is" && call[1] === "invalidated_at" && call[2] === null));
});
await checkAsync(async () => assert.equal(
  await new SupabaseAnalyticsMaterializationStore(
    augustPublication.client,
    latestMonthContext,
  ).readLatestPublishedHistoryV2Month(),
  "2026-08",
));
await checkAsync(async () => assert.equal(
  await new SupabaseAnalyticsMaterializationStore(
    noPublication.client,
    latestMonthContext,
  ).readLatestPublishedHistoryV2Month(),
  null,
));

const theoretical = materialization.createHistoryV2TheoreticalManifest(selectedMonth);
check(() => assert.equal(theoretical.resourceFamilies.length, 15));
check(() => assert.deepEqual(materialization.historyV2MaterializationProfile, {
  profileId: "history-v2-month@v1",
  scope: "household_month",
  contractVersion: "v2",
  artifactFamilies: theoretical.artifactFamilies,
  resourceFamilies: theoretical.resourceFamilies,
  topLevelResources: theoretical.topLevelResources,
  artifactStore: "analytics_artifacts",
  queryStore: "analytics_query_snapshots",
  publicationStore: "analytics_publications",
}));
check(() => assert.deepEqual(materialization.historyV2ReadOnlyBackfillProfile, {
  profileId: "history-v2-read-only-preflight@v1",
  materializationProfileId: "history-v2-month@v1",
  mode: "read_only",
  stage: "in_memory",
  finalize: "forbidden",
}));
check(() => assert.deepEqual(theoretical.artifactFamilies, [
  "calendar_semantic_month",
  "daily_economic_ledger_month",
]));
check(() => assert.equal(theoretical.topLevelResources.length, 8));
check(() => assert.equal(theoretical.requiredJournalDates.length, 31));
check(() => assert.deepEqual(theoretical.requiredOwnedWeekStarts, [
  "2026-05-04",
  "2026-05-11",
  "2026-05-18",
  "2026-05-25",
]));
check(() => assert.equal(theoretical.recursiveDetailResources.length, 5));
check(() => assert.equal(query.registeredQueryResourceKeys.filter((resource) =>
  query.getQueryResourceContract(resource).family === "history_v2").length, 15));

const preflight = await materialization.buildHistoryV2Preflight({
  context: runtimeContext,
  month: selectedMonth,
  artifacts: artifactInputs,
  buildQuery: (request) => queryBuildResult(request),
});

const reachedResources = [...new Set(preflight.queries.map(({ request }) => request.resource))].sort();
check(() => assert.deepEqual(reachedResources, [...materialization.historyV2QueryResources].sort()));
check(() => assert.equal(preflight.manifest.requiredArtifactKeys.length, 2));
check(() => assert.equal(new Set(preflight.manifest.requiredArtifactKeys).size, 2));
check(() => assert.equal(preflight.manifest.requiredQueryKeys.length, preflight.queries.length));
check(() => assert.equal(new Set(preflight.manifest.requiredQueryKeys).size, preflight.queries.length));
check(() => assert.equal(preflight.queries.filter(({ request }) =>
  request.resource === "history_day_journal").length, 31));
check(() => assert.equal(preflight.queries.filter(({ request }) =>
  request.resource === "history_week").length, 4));
check(() => assert.ok(preflight.queries.filter(({ request }) =>
  request.resource === "history_spending_segment_detail").length >= 5));
check(() => assert.ok(preflight.manifest.externalQueryRefs.some(({ ownerMonth, resource }) =>
  ownerMonth === "2026-04" && resource === "history_day_journal")));
check(() => assert.ok(preflight.manifest.externalQueryRefs.some(({ ownerMonth, resource }) =>
  ownerMonth === "2026-06" && resource === "history_day_journal")));
check(() => assert.match(preflight.manifest.manifestHash, /^[0-9a-f]{64}$/));
check(() => assert.match(preflight.manifest.publicationFactsHash, /^[0-9a-f]{64}$/));
check(() => assert.equal(preflight.manifest.factDependencies.length,
  preflight.queries.length + artifactInputs.length));

const deterministic = await materialization.buildHistoryV2Preflight({
  context: runtimeContext,
  month: selectedMonth,
  artifacts: [...artifactInputs].reverse(),
  buildQuery: (request) => queryBuildResult(request),
});
check(() => assert.equal(deterministic.manifest.manifestHash, preflight.manifest.manifestHash));
check(() => assert.equal(
  deterministic.manifest.publicationFactsHash,
  preflight.manifest.publicationFactsHash,
));
check(() => assert.deepEqual(
  deterministic.manifest.requiredQueryKeys,
  preflight.manifest.requiredQueryKeys,
));

const changedPlaceFact = await materialization.buildHistoryV2Preflight({
  context: runtimeContext,
  month: selectedMonth,
  artifacts: artifactInputs,
  buildQuery: (request) => queryBuildResult(request, "place-fact-changed"),
});
check(() => assert.equal(changedPlaceFact.manifest.manifestHash, preflight.manifest.manifestHash));
check(() => assert.notEqual(
  changedPlaceFact.manifest.publicationFactsHash,
  preflight.manifest.publicationFactsHash,
));

const stage = materialization.stageHistoryV2GenerationInMemory({
  preflight,
  publicationId: "draft-history-v2-test",
  revision: 12,
  generatedAt: "2026-08-30T13:00:00Z",
});
check(() => assert.equal(stage.finalizeRequested, false));
check(() => assert.equal(stage.artifacts.length, 2));
check(() => assert.equal(stage.queries.length, preflight.manifest.requiredQueryKeys.length));
check(() => assert.ok(stage.queries.every(({ data }) =>
  data.publicationMeta.publicationId === "draft-history-v2-test")));
check(() => assert.ok(stage.queries.every(({ data }) =>
  data.publicationMeta.factsHash === preflight.manifest.publicationFactsHash)));
check(() => assert.ok(stage.artifacts.every(({ publicationMeta }) =>
  publicationMeta.factsHash === preflight.manifest.publicationFactsHash)));
check(() => assert.ok(stage.queries.every(({ data, policyVersions }) =>
  historyCore.policyVersionsEqual(data.publicationMeta.policyVersions, policyVersions))));
check(() => assert.equal(
  new Set(stage.queries.map(({ methodSignature }) => methodSignature)).size > 1,
  true,
  "les signatures restent propres aux ressources",
));
check(() => assert.throws(() => materialization.stageHistoryV2GenerationInMemory({
  preflight,
  publicationId: "",
  revision: 12,
  generatedAt: "2026-08-30T13:00:00Z",
}), /publicationId/));
await checkAsync(() => assert.rejects(
  materialization.buildHistoryV2Preflight({
    context: runtimeContext,
    month: selectedMonth,
    artifacts: [artifactInputs[0]],
    buildQuery: (request) => queryBuildResult(request),
  }),
  /exactement les deux artifacts/,
));

let publicationInsert;
let artifactUpsert;
const rpcCalls = [];
const fakeClient = {
  from(table) {
    return {
      insert(row) {
        assert.equal(table, "analytics_publications");
        publicationInsert = row;
        return {
          select() {
            return {
              async single() {
                return { data: { publication_id: "draft-store-test" }, error: null };
              },
            };
          },
        };
      },
      async upsert(row) {
        assert.equal(table, "analytics_artifacts");
        artifactUpsert = row;
        return { error: null };
      },
    };
  },
  async rpc(name, args) {
    rpcCalls.push({ name, args });
    if (name === "restore_history_v2_publication") {
      return {
        data: [{
          analytics_revision: "14",
          source_revision: "9",
          active_publication_id: args.p_target_publication_id,
        }],
        error: null,
      };
    }
    throw new Error("Finalize interdit pendant ce test.");
  },
};
const fakeStore = new SupabaseAnalyticsMaterializationStore(fakeClient, runtimeContext, {
  readMode: "bypass",
});
const draftId = await fakeStore.beginMonthPublicationProfile({
  month: selectedMonth,
  requiredArtifactKeys: preflight.manifest.requiredArtifactKeys,
  requiredRequests: preflight.queries.map(({ request }) => request),
  baseAnalyticsRevision: "13",
});
await fakeStore.writeHistoryV2Artifact(stage.artifacts[0], "draft-history-v2-test");
const restored = await fakeStore.restoreHistoryV2Publication({
  currentPublicationId: "draft-store-test",
  targetPublicationId: null,
  householdId: runtimeContext.householdId,
  month: selectedMonth,
  expectedAnalyticsRevision: "13",
});
check(() => assert.equal(draftId, "draft-store-test"));
check(() => assert.deepEqual(
  publicationInsert.required_artifact_keys,
  preflight.manifest.requiredArtifactKeys,
));
check(() => assert.deepEqual(
  publicationInsert.required_query_keys,
  preflight.manifest.requiredQueryKeys,
));
check(() => assert.equal(publicationInsert.status, "draft"));
check(() => assert.equal(publicationInsert.base_analytics_revision, "13"));
check(() => assert.equal(artifactUpsert.is_active, false));
check(() => assert.equal(artifactUpsert.publication_id, "draft-history-v2-test"));
check(() => assert.equal(artifactUpsert.contract_version, "v2"));
check(() => assert.equal(rpcCalls.length, 1));
check(() => assert.deepEqual(rpcCalls[0], {
  name: "restore_history_v2_publication",
  args: {
    p_current_publication_id: "draft-store-test",
    p_target_publication_id: null,
    p_household_id: runtimeContext.householdId,
    p_period_month: `${selectedMonth}-01`,
    p_expected_analytics_revision: "13",
  },
}));
check(() => assert.deepEqual(restored, {
  analyticsRevision: "14",
  sourceRevision: "9",
  activePublicationId: null,
}));

check(() => {
  const calendarIdentity = identity.historyV2SharedArtifactIdentity(
    runtimeContext,
    selectedMonth,
    "calendar_semantic_month",
    "current",
  );
  const ledgerIdentity = identity.historyV2SharedArtifactIdentity(
    runtimeContext,
    selectedMonth,
    "daily_economic_ledger_month",
    "current",
  );
  assert.notEqual(calendarIdentity.artifactKey, ledgerIdentity.artifactKey);
  assert.equal(calendarIdentity.contractVersion, "v2");
  assert.equal(ledgerIdentity.contractVersion, "v2");
});
check(() => assert.equal(
  query.registeredQueryResourceKeys.includes("history_calendar_month"),
  false,
  "la ressource History V1 retirée ne doit plus rester active dans le registre",
));

console.log(JSON.stringify({
  gate: "PASS",
  checks,
  profileId: preflight.manifest.profileId,
  resourceFamilies: preflight.manifest.resourceFamilies.length,
  queryInstances: preflight.queries.length,
  artifactInstances: preflight.artifacts.length,
  externalQueryRefs: preflight.manifest.externalQueryRefs.length,
  manifestHash: preflight.manifest.manifestHash,
  publicationFactsHash: preflight.manifest.publicationFactsHash,
  finalizeRequested: stage.finalizeRequested,
}, null, 2));
