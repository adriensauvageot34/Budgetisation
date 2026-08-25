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
  querySnapshotIdentity,
} = require(path.join(repositoryRoot, "src/server/analytics/materialization/identity.ts"));
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
const {
  shouldAutomaticallyRevalidateClientQuery,
} = require(path.join(repositoryRoot, "src/components/runtime/query-client.ts"));

const householdA = "00000000-0000-4000-8000-000000000001";
const householdB = "00000000-0000-4000-8000-000000000002";
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
assert.notEqual(queryKeyA, queryKeyContractV2, "contract changes must miss the snapshot");

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
