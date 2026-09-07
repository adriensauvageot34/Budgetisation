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
Module._load = function loadModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveModule(request, parent, isMain, options) {
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

const { executeQuery } = require(path.join(repositoryRoot, "src/query-api/server/execute-query.ts"));
const {
  evaluateQueryCapabilities,
  getQueryResourceContract,
  getQueryResourceDefinition,
  normalizeQueryRequest,
} = require(path.join(repositoryRoot, "src/query-api/index.ts"));
const { getMetricRegistryEntry } = require(path.join(repositoryRoot, "src/analytics/production/index.ts"));
const {
  legacyGlobalReadThroughResources,
  shouldSkipLegacyGlobalReadThroughWrite,
} = require(path.join(repositoryRoot, "src/server/analytics/materialization/identity.ts"));
const { SupabaseAnalyticsMaterializationStore } = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/store.ts",
));

const expectedLegacyGlobalResources = Object.freeze([
  "analysis_global_baseline",
  "analysis_global_breakdown",
  "analysis_global_contexts",
  "analysis_global_evolution",
  "analysis_global_habits",
  "analysis_global_initial",
  "analysis_global_profiles",
  "analysis_global_typical",
  "analysis_global_universe",
]);
assert.deepEqual(legacyGlobalReadThroughResources, expectedLegacyGlobalResources);
for (const resource of expectedLegacyGlobalResources) {
  assert.equal(getQueryResourceContract(resource).family, "legacy_v1");
  assert.deepEqual(getQueryResourceDefinition(resource).allowedTimeKinds, ["global"]);
}

const householdId = "00000000-0000-4000-8000-000000000001";
const rawGlobalScope = {
  subject: { kind: "household" },
  time: {
    kind: "global",
    observationWindow: "last_12_months",
    asOf: "2026-07",
  },
};
const authorizedContext = {
  userId: "p18t-test-actor",
  householdId,
  persons: [],
  personIds: [],
  timezone: "Europe/Paris",
  periods: [],
  dataRevision: "1",
  analyticsRevision: "79",
  contractVersion: "v1",
  asOf: "2026-08-31T12:00:00Z",
};
const queryContext = {
  actor: { actorId: "p18t-test-actor" },
  household: { householdId },
  revisions: {
    dataRevision: "1",
    analyticsRevision: "79",
    dependencies: [],
  },
  contractVersion: "v1",
  now: "2026-08-31T12:00:00Z",
};

const paramsByResource = Object.freeze({
  analysis_global_initial: {},
  analysis_global_baseline: {},
  analysis_global_typical: {},
  analysis_global_breakdown: { dimension: "category", measure: "category_amount", limit: 10 },
  analysis_global_evolution: { view: "money" },
  analysis_global_contexts: {},
  analysis_global_habits: { view: "contexts" },
  analysis_global_profiles: { target: { kind: "ensemble" } },
  analysis_global_universe: {},
});

function unknownScopedMetric(metricId, scopeHash) {
  const definition = getMetricRegistryEntry(metricId);
  return {
    metricId,
    scopeHash,
    envelope: {
      availability: "unknown",
      value: null,
      unit: definition.unit,
      provenance: definition.provenanceRule,
      methodVersion: definition.methodVersion,
    },
  };
}

const knownZeroCount = Object.freeze({
  availability: "known",
  value: 0,
  unit: "count",
  provenance: "observed",
});

function legacyGlobalFixture(request, capabilities) {
  const identity = {
    observationWindow: request.scope.time.observationWindow,
    asOf: request.scope.time.asOf,
    subject: request.scope.subject,
  };
  switch (request.resource) {
    case "analysis_global_initial":
      return {
        ...identity,
        documentedMonths: knownZeroCount,
        documentedActivities: knownZeroCount,
        momentsCount: knownZeroCount,
        observedPlacesCount: knownZeroCount,
        operationsCount: knownZeroCount,
        economicConsumptionNetAttributable: unknownScopedMetric(
          "economic_consumption_net_attributable",
          request.scopeHash,
        ),
        capabilities,
      };
    case "analysis_global_baseline": {
      const unavailable = { status: "unavailable", reason: "missing_source" };
      return {
        ...identity,
        defaultView: "month",
        day: { neutral: unavailable, typical: unavailable },
        week: { neutral: unavailable, calendarAdjustedNeutral: unavailable },
        month: { minimal: unavailable, calendarAdjustedNeutral: unavailable },
        capabilities,
      };
    }
    case "analysis_global_typical":
      return {
        ...identity,
        monthlyTypical: { status: "unavailable", reason: "missing_source" },
        behaviorRows: [],
        capabilities,
      };
    case "analysis_global_breakdown":
      return {
        ...identity,
        breakdown: {
          dimension: request.params.dimension,
          measure: request.params.measure,
          rows: [],
          reconciliation: "partial",
          capabilities,
        },
      };
    case "analysis_global_evolution":
      return {
        ...identity,
        view: request.params.view,
        series: [],
        smallMultiplesRecommended: true,
        capabilities,
      };
    case "analysis_global_contexts":
      return { ...identity, contexts: { sections: [], capabilities } };
    case "analysis_global_habits":
      return {
        ...identity,
        view: request.params.view,
        availableViews: ["contexts", "heatmap"],
        content: { kind: "unavailable", reason: "missing_method_or_source" },
        capabilities,
      };
    case "analysis_global_profiles":
      return {
        ...identity,
        target: request.params.target,
        label: "Ensemble",
        destination: { kind: "persona", target: request.params.target },
        capabilities,
      };
    case "analysis_global_universe":
      return {
        ...identity,
        moments: { sort: "recent", items: [], hasMore: false },
        places: { sort: "frequent", items: [], hasMore: false },
        merchants: { sort: "spent", items: [], hasMore: false },
        capabilities,
      };
    default:
      throw new TypeError(`Fixture legacy Global absente pour ${request.resource}.`);
  }
}

function recordingClient() {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        calls.push({ kind: "from", table });
        return {
          async upsert(row, options) {
            calls.push({ kind: "upsert", table, row, options });
            return { error: null };
          },
        };
      },
    },
  };
}

let passedResources = 0;
for (const resource of expectedLegacyGlobalResources) {
  const rawRequest = { resource, scope: rawGlobalScope, params: paramsByResource[resource] };
  const normalizedRequest = normalizeQueryRequest(rawRequest);
  assert.equal(shouldSkipLegacyGlobalReadThroughWrite(normalizedRequest, undefined), true);
  assert.equal(shouldSkipLegacyGlobalReadThroughWrite(normalizedRequest, "draft-global-v2"), false);

  const fake = recordingClient();
  const store = new SupabaseAnalyticsMaterializationStore(fake.client, authorizedContext);
  let sourceCalls = 0;
  let writeBoundaryCalls = 0;
  let expectedPayload;
  const traces = [];
  const sources = new Proxy({}, {
    get() {
      return async ({ request, context }) => {
        sourceCalls += 1;
        expectedPayload = legacyGlobalFixture(request, context.capabilities);
        return expectedPayload;
      };
    },
  });
  const result = await executeQuery({
    requestId: `p18t:${resource}`,
    request: rawRequest,
  }, {
    resolveContext: async () => queryContext,
    authorize: async () => ({ granted: true }),
    sources,
    materialization: {
      readQuery: async () => null,
      writeQuery: async (request, payload) => {
        writeBoundaryCalls += 1;
        await store.writeQuery(request, payload);
      },
      queryCachePolicy: (request, source) => store.queryCachePolicy(request, source),
    },
    onTrace: (trace) => traces.push(trace),
  });
  assert.equal(result.ok, true, `${resource} doit répondre en succès sur cache miss.`);
  assert.equal(sourceCalls, 1, `${resource} doit appeler exactement son adapter/source.`);
  assert.equal(writeBoundaryCalls, 1, `${resource} doit atteindre la politique centrale de persistance.`);
  assert.deepEqual(result.response.data, expectedPayload, `${resource} doit préserver son payload calculé.`);
  assert.equal(fake.calls.length, 0, `${resource} ne doit émettre aucun appel Supabase de write-through.`);
  assert.equal(traces.length, 1);
  assert.equal(traces[0].outcome, "success");
  assert.equal(traces[0].materialization, "miss");
  passedResources += 1;
}

const allowedMonthlyRequest = normalizeQueryRequest({
  resource: "analysis_month_initial",
  scope: { subject: { kind: "household" }, time: { kind: "month", month: "2026-07" } },
  params: {},
});
assert.equal(shouldSkipLegacyGlobalReadThroughWrite(allowedMonthlyRequest, undefined), false);
const allowedMonthly = recordingClient();
await new SupabaseAnalyticsMaterializationStore(
  allowedMonthly.client,
  authorizedContext,
).writeQuery(allowedMonthlyRequest, { marker: "allowed-monthly-write-through" });
assert.equal(allowedMonthly.calls.filter(({ kind }) => kind === "upsert").length, 1);

const explicitPublicationRequest = normalizeQueryRequest({
  resource: "analysis_global_initial",
  scope: rawGlobalScope,
  params: {},
});
const explicitPublication = recordingClient();
await new SupabaseAnalyticsMaterializationStore(
  explicitPublication.client,
  authorizedContext,
).writeQuery(explicitPublicationRequest, { marker: "explicit-publication-write" }, "draft-global-v2");
assert.equal(explicitPublication.calls.filter(({ kind }) => kind === "upsert").length, 1);
assert.equal(
  explicitPublication.calls.find(({ kind }) => kind === "upsert").row.publication_id,
  "draft-global-v2",
);

console.log(`GLOBAL_LEGACY_READ_THROUGH=${passedResources}/${expectedLegacyGlobalResources.length} PASS`);
console.log("LEGACY_GLOBAL_QUERY_RESPONSE=PASS");
console.log("LEGACY_GLOBAL_SUPABASE_WRITE_THROUGH=0");
console.log("MONTHLY_WRITE_THROUGH_NEGATIVE_CONTROL=PASS");
console.log("EXPLICIT_PUBLICATION_NEGATIVE_CONTROL=PASS");
