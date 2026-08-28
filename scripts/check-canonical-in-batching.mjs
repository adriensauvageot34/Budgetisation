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
Module._load = function loadCanonicalBatchingModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveCanonicalBatchingModule(
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
  CANONICAL_IN_BATCH_SIZE,
  CANONICAL_IN_MAX_CONCURRENCY,
  readCanonicalInBatches,
} = require(path.join(repositoryRoot, "src/server/canonical/in-batches.ts"));
const { CanonicalRepository } = require(path.join(
  repositoryRoot,
  "src/server/canonical/repository.ts",
));

assert.equal(CANONICAL_IN_BATCH_SIZE, 100);
assert.equal(CANONICAL_IN_MAX_CONCURRENCY, 3);

const realisticIds = Array.from(
  { length: 237 },
  (_, index) => `operation-${String(index).padStart(4, "0")}`,
);
const genericCalls = [];
const genericRows = await readCanonicalInBatches({
  values: [...realisticIds].reverse().concat(realisticIds[42], realisticIds[199]),
  executeBatch: async (batch) => {
    genericCalls.push([...batch]);
    const rows = [...batch].reverse().map((id) => ({ id, value: `value:${id}` }));
    return [...rows, rows[0]];
  },
  rowIdentity: ({ id }) => id,
  compareRows: (left, right) => left.id.localeCompare(right.id),
});

assert.deepEqual(genericCalls.map(({ length }) => length), [100, 100, 37]);
assert.ok(genericCalls.every((batch) => batch.length <= CANONICAL_IN_BATCH_SIZE));
assert.deepEqual(genericCalls.flat(), realisticIds);
assert.equal(genericRows.length, realisticIds.length);
assert.equal(new Set(genericRows.map(({ id }) => id)).size, realisticIds.length);
assert.deepEqual(genericRows.map(({ id }) => id), realisticIds);

const concurrencyIds = Array.from(
  { length: 437 },
  (_, index) => `concurrency-${String(index).padStart(4, "0")}`,
);
const releases = [];
let activeBatchCount = 0;
let maximumActiveBatchCount = 0;
let startedBatchCount = 0;
const boundedRead = readCanonicalInBatches({
  values: concurrencyIds,
  executeBatch: async (batch) => {
    startedBatchCount += 1;
    activeBatchCount += 1;
    maximumActiveBatchCount = Math.max(maximumActiveBatchCount, activeBatchCount);
    await new Promise((resolve) => releases.push(resolve));
    activeBatchCount -= 1;
    return batch.map((id) => ({ id }));
  },
  rowIdentity: ({ id }) => id,
  compareRows: (left, right) => left.id.localeCompare(right.id),
});
while (startedBatchCount < CANONICAL_IN_MAX_CONCURRENCY) await Promise.resolve();
assert.equal(startedBatchCount, CANONICAL_IN_MAX_CONCURRENCY);
assert.equal(activeBatchCount, CANONICAL_IN_MAX_CONCURRENCY);
for (let expectedStarted = 4; expectedStarted <= 5; expectedStarted += 1) {
  releases.shift()();
  while (startedBatchCount < expectedStarted) await Promise.resolve();
  assert.ok(activeBatchCount <= CANONICAL_IN_MAX_CONCURRENCY);
}
while (releases.length > 0) releases.shift()();
const boundedRows = await boundedRead;
assert.equal(maximumActiveBatchCount, CANONICAL_IN_MAX_CONCURRENCY);
assert.deepEqual(boundedRows.map(({ id }) => id), concurrencyIds);

const expectedBatchError = new Error("physical batch unavailable");
let failedGenericCalls = 0;
await assert.rejects(
  () => readCanonicalInBatches({
    values: realisticIds,
    executeBatch: async (batch, batchIndex) => {
      failedGenericCalls += 1;
      if (batchIndex === 1) throw expectedBatchError;
      return batch.map((id) => ({ id }));
    },
    rowIdentity: ({ id }) => id,
    compareRows: (left, right) => left.id.localeCompare(right.id),
  }),
  expectedBatchError,
);
assert.equal(failedGenericCalls, 3);

function economicClient({ failBatchIndex } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        assert.equal(table, "financial_economic_cost_canonical");
        const state = { batch: [], batchIndex: -1 };
        const query = {
          select() {
            return query;
          },
          in(column, values) {
            assert.equal(column, "operation_id");
            state.batch = [...values];
            state.batchIndex = calls.length;
            calls.push([...values]);
            return query;
          },
          order() {
            return query;
          },
          then(resolve, reject) {
            if (state.batchIndex === failBatchIndex) {
              return Promise.resolve({
                data: null,
                error: { code: "400", message: "request target is too long" },
              }).then(resolve, reject);
            }
            const rows = state.batch.map((operationId) => ({
              operation_id: operationId,
              canonical_component_key: `economic:${operationId}`,
            }));
            return Promise.resolve({
              data: rows.length === 0 ? [] : [...rows].reverse().concat(rows[0]),
              error: null,
            }).then(resolve, reject);
          },
        };
        return query;
      },
    },
  };
}

const runtimeContext = {
  householdId: "00000000-0000-4000-8000-000000000001",
  timezone: "Europe/Paris",
  personIds: [],
  persons: [],
  periods: [],
};
const economic = economicClient();
const repository = new CanonicalRepository(economic.client, runtimeContext);
const economicRows = await repository.loadEconomicComponentRowsByOperations(
  [...realisticIds].reverse().concat(realisticIds[5]),
);

assert.deepEqual(economic.calls.map(({ length }) => length), [100, 100, 37]);
assert.deepEqual(economic.calls.flat(), realisticIds);
assert.equal(economicRows.length, realisticIds.length);
assert.equal(
  new Set(economicRows.map(({ canonical_component_key: key }) => key)).size,
  realisticIds.length,
);
assert.deepEqual(
  economicRows.map(({ canonical_component_key: key }) => key),
  realisticIds.map((id) => `economic:${id}`),
);

const cachedRows = await repository.loadEconomicComponentRowsByOperations(realisticIds);
assert.strictEqual(cachedRows, economicRows);
assert.equal(economic.calls.length, 3);

const failingEconomic = economicClient({ failBatchIndex: 1 });
const failingRepository = new CanonicalRepository(
  failingEconomic.client,
  runtimeContext,
);
const originalConsoleError = console.error;
console.error = () => {};
try {
  await assert.rejects(
    () => failingRepository.loadEconomicComponentRowsByOperations(realisticIds),
    /Lecture canonique economic indisponible/,
  );
} finally {
  console.error = originalConsoleError;
}
assert.equal(failingEconomic.calls.length, 3);

const paginatedOperationRows = Array.from({ length: 1_505 }, (_, index) => ({
  operation_id: `paged-operation-${String(index).padStart(4, "0")}`,
  date_bancaire: "2026-01-15",
  montant: "1",
}));
const operationRanges = [];
const paginationClient = {
  from(table) {
    if (table === "canonical_household_scope_control") {
      const query = {
        select() { return query; },
        limit() { return query; },
        then(resolve, reject) {
          return Promise.resolve({
            data: [{ household_count: 1, household_id: runtimeContext.householdId, status: "READY" }],
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    }
    assert.equal(table, "operations");
    let range = [0, paginatedOperationRows.length - 1];
    const query = {
      select() { return query; },
      gte() { return query; },
      lt() { return query; },
      order() { return query; },
      range(from, to) {
        range = [from, to];
        operationRanges.push(range);
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve({
          data: paginatedOperationRows.slice(range[0], range[1] + 1),
          error: null,
        }).then(resolve, reject);
      },
    };
    return query;
  },
};
const paginationRepository = new CanonicalRepository(paginationClient, runtimeContext);
const paginatedOperations = await paginationRepository.loadOperationsByBankRange({
  start: "2026-01-01",
  endExclusive: "2026-02-01",
});
assert.equal(paginatedOperations.length, 1_505);
assert.deepEqual(operationRanges, [[0, 999], [1000, 1999]]);
assert.deepEqual(
  paginatedOperations.map(({ operation_id: operationId }) => operationId),
  paginatedOperationRows.map(({ operation_id: operationId }) => operationId),
);

console.log("Canonical .in batching checks: PASS");
