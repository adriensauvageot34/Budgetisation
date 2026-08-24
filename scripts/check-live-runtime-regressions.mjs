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
} = require(path.join(repositoryRoot, "src/features/operations/query-state.ts"));
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

console.log("Live runtime regression checks: PASS");
