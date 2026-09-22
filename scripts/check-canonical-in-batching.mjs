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
  CANONICAL_ECONOMIC_IN_BATCH_SIZE,
  CANONICAL_IN_BATCH_SIZE,
  CANONICAL_IN_MAX_CONCURRENCY,
  readCanonicalInBatches,
} = require(path.join(repositoryRoot, "src/server/canonical/in-batches.ts"));
const { CanonicalRepository } = require(path.join(
  repositoryRoot,
  "src/server/canonical/repository.ts",
));

assert.equal(CANONICAL_IN_BATCH_SIZE, 100);
assert.equal(CANONICAL_ECONOMIC_IN_BATCH_SIZE, 120);
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

assert.deepEqual(economic.calls.map(({ length }) => length), [120, 117]);
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
assert.equal(economic.calls.length, 2);

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
assert.equal(failingEconomic.calls.length, 2);

const personLinkCalls = [];
const personLinkClient = {
  from(table) {
    assert.equal(table, "financial_source_person_links");
    const state = { sourceKind: undefined, idColumn: undefined, ids: [] };
    const query = {
      select(selection) {
        assert.match(selection, /share_exact:share::text/);
        return query;
      },
      eq(column, value) {
        assert.equal(column, "source_kind");
        state.sourceKind = value;
        return query;
      },
      in(column, values) {
        state.idColumn = column;
        state.ids = [...values];
        personLinkCalls.push({ sourceKind: state.sourceKind, idColumn: column, ids: [...values] });
        return query;
      },
      order() { return query; },
      then(resolve, reject) {
        const data = state.ids.map((sourceId) => ({
          source_kind: state.sourceKind,
          operation_id: state.idColumn === "operation_id" ? sourceId : null,
          allocation_id: state.idColumn === "allocation_id" ? sourceId : null,
          item_id: state.idColumn === "item_id" ? sourceId : null,
          cash_use_id: state.idColumn === "cash_use_id" ? sourceId : null,
          person_id: runtimeContext.householdId,
          relation_type: "beneficiary",
          share_exact: null,
        }));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  },
};
const personLinkRepository = new CanonicalRepository(personLinkClient, runtimeContext);
const personLinkComponents = [
  ...Array.from({ length: 101 }, (_, index) => ({ source_kind: "Operation", component_id: `operation-${index}` })),
  { source_kind: "Allocation", component_id: "allocation-1" },
  { source_kind: "Payment_component", component_id: "payment-ignored" },
];
const personLinkRows = await personLinkRepository.loadPersonLinkRowsForComponents(personLinkComponents);
assert.deepEqual(personLinkCalls.map(({ sourceKind, idColumn, ids }) => [sourceKind, idColumn, ids.length]), [
  ["Operation", "operation_id", 101],
  ["Allocation", "allocation_id", 1],
]);
assert.equal(personLinkRows.length, 102);
assert.equal(personLinkCalls.some(({ sourceKind }) => sourceKind === "Payment_component"), false);

const paginatedOperationRows = Array.from({ length: 1_505 }, (_, index) => ({
  operation_id: `paged-operation-${String(index).padStart(4, "0")}`,
  date_bancaire: "2026-01-15",
  montant: "1",
}));
const operationRanges = [];
const operationSelections = [];
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
      select(selection) {
        operationSelections.push(selection);
        return query;
      },
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
assert.deepEqual(operationSelections, [
  "*,montant_bancaire_exact:montant::text",
  "*,montant_bancaire_exact:montant::text",
]);
assert.deepEqual(
  paginatedOperations.map(({ operation_id: operationId }) => operationId),
  paginatedOperationRows.map(({ operation_id: operationId }) => operationId),
);

const economicRange = {
  start: "2026-01-01",
  endExclusive: "2026-02-01",
};
const sharedOperationId = "operation-shared";
const economicDiscoveryRows = {
  bank: [
    ...Array.from({ length: 1_001 }, (_, index) => ({
      operation_id: `bank-${String(index).padStart(4, "0")}`,
      complete_bank_field: `bank-value-${index}`,
    })),
    { operation_id: sharedOperationId, complete_bank_field: "shared-bank-value" },
  ],
  "real-date": [
    { operation_id: sharedOperationId },
    ...Array.from({ length: 1_004 }, (_, index) => ({
      operation_id: `real-${String(index).padStart(4, "0")}`,
    })),
  ],
  "forced-month": [
    ...Array.from({ length: 1_003 }, (_, index) => ({
      operation_id: `forced-${String(index).padStart(4, "0")}`,
    })),
    { operation_id: sharedOperationId },
  ],
};
const economicDiscoveryCalls = [];
const economicDiscoveryClient = {
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
    if (table === "financial_economic_timing_canonical") {
      const query = {
        select() { return query; },
        eq() { return query; },
        gte() { return query; },
        lt() { return query; },
        order() { return query; },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    }
    assert.equal(table, "operations");
    const state = { selection: undefined, kind: undefined, range: [0, Number.MAX_SAFE_INTEGER] };
    const query = {
      select(selection) {
        state.selection = selection;
        return query;
      },
      gte(column) {
        state.kind = column === "date_bancaire"
          ? "bank"
          : column === "date_transaction_reelle"
            ? "real-date"
            : "forced-month";
        return query;
      },
      lt() { return query; },
      eq() { return query; },
      order() { return query; },
      range(from, to) {
        state.range = [from, to];
        return query;
      },
      then(resolve, reject) {
        const rows = economicDiscoveryRows[state.kind];
        economicDiscoveryCalls.push({
          kind: state.kind,
          selection: state.selection,
          range: [...state.range],
        });
        const page = rows.slice(state.range[0], state.range[1] + 1);
        const data = state.selection === "operation_id"
          ? page.map(({ operation_id }) => ({ operation_id }))
          : page;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  },
};
const economicDiscoveryRepository = new CanonicalRepository(
  economicDiscoveryClient,
  runtimeContext,
);
const completeBankRows = await economicDiscoveryRepository.loadOperationsByBankRange(economicRange);
assert.equal(completeBankRows.length, economicDiscoveryRows.bank.length);
assert.equal(completeBankRows[0].complete_bank_field, "bank-value-0");

let economicOperationIds = [];
economicDiscoveryRepository.loadEconomicComponentRowsByOperations = async (operationIds) => {
  economicOperationIds = [...operationIds];
  return operationIds.map((operationId) => ({
    operation_id: operationId,
    canonical_component_key: `economic:${operationId}`,
  }));
};
economicDiscoveryRepository.loadEconomicComponentRowsByKeys = async () => [];
economicDiscoveryRepository.projectEconomicComponentRows = async (components) => components;

const economicFacts = await economicDiscoveryRepository.loadEconomicFacts(economicRange);
const expectedEconomicOperationIds = [...new Set([
  ...economicDiscoveryRows.bank,
  ...economicDiscoveryRows["real-date"],
  ...economicDiscoveryRows["forced-month"],
].map(({ operation_id }) => operation_id))].sort();

assert.deepEqual(economicOperationIds, expectedEconomicOperationIds);
assert.deepEqual(
  economicFacts.map(({ operation_id }) => operation_id),
  expectedEconomicOperationIds,
);
assert.equal(economicOperationIds.filter((id) => id === sharedOperationId).length, 1);
const idOnlyDiscoveryCalls = economicDiscoveryCalls
  .filter(({ selection }) => selection === "operation_id");
assert.equal(idOnlyDiscoveryCalls.length, 6);
assert.equal(economicDiscoveryCalls.length, 8);
assert.equal(
  economicDiscoveryCalls.filter(({ selection }) =>
    selection === "*,montant_bancaire_exact:montant::text").length,
  2,
);
for (const kind of ["bank", "real-date", "forced-month"]) {
  assert.deepEqual(
    idOnlyDiscoveryCalls
      .filter((call) => call.kind === kind)
      .map(({ range }) => range),
    [[0, 999], [1000, 1999]],
  );
}
assert.equal(economicOperationIds.includes("real-1003"), true);
assert.equal(economicOperationIds.includes("forced-1002"), true);

const { parseEconomicComponentFact } = require(path.join(
  repositoryRoot,
  "src/analytics/facts/validation.ts",
));
const closureHouseholdId = "10000000-0000-4000-8000-000000000001";
const closurePersonIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
];
const closureOperations = [
  { operation_id: "30000000-0000-4000-8000-000000000001", date_bancaire: "2025-01-05", date_transaction_reelle: null, date_transaction_precision: null, mois_analytique_force: null },
  { operation_id: "30000000-0000-4000-8000-000000000002", date_bancaire: "2024-12-20", date_transaction_reelle: "2025-02-07", date_transaction_precision: "Jour exact", mois_analytique_force: null },
  { operation_id: "30000000-0000-4000-8000-000000000003", date_bancaire: "2024-12-21", date_transaction_reelle: null, date_transaction_precision: null, mois_analytique_force: "2025-12" },
  { operation_id: "30000000-0000-4000-8000-000000000004", date_bancaire: "2025-06-30", date_transaction_reelle: null, date_transaction_precision: null, mois_analytique_force: null },
];
const closureTimingRows = [
  { canonical_component_key: "operation:30000000-0000-4000-8000-000000000001", economic_segment_id: "segment-1", economic_month: "2025-01-01" },
  { canonical_component_key: "operation:30000000-0000-4000-8000-000000000002", economic_segment_id: "segment-2", economic_month: "2025-02-01" },
  { canonical_component_key: "operation:30000000-0000-4000-8000-000000000003", economic_segment_id: "segment-3", economic_month: "2025-12-01" },
  { canonical_component_key: "operation:30000000-0000-4000-8000-000000000004", economic_segment_id: "segment-4a", economic_month: "2025-06-01" },
  { canonical_component_key: "operation:30000000-0000-4000-8000-000000000004", economic_segment_id: "segment-4b", economic_month: "2025-07-01" },
];
const amountByOperation = new Map(closureOperations.map((row, index) =>
  [row.operation_id, String((index + 1) * 100)]));
function closureFact(operationId) {
  const operation = closureOperations.find((row) => row.operation_id === operationId);
  const amount = amountByOperation.get(operationId);
  const rawSegments = closureTimingRows.filter((row) =>
    row.canonical_component_key === `operation:${operationId}`);
  const segmentAmount = String(Number(amount) / rawSegments.length);
  const person = operationId.endsWith("1")
    ? { kind: "resolved", id: closurePersonIds[0], attribution: "explicit_beneficiary", evidenceRefs: ["beneficiary:1"], payerEvidenceRefs: [] }
    : operationId.endsWith("4")
      ? { kind: "partial", shares: [{ personId: closurePersonIds[1], share: "0.5", evidenceRefs: ["share:1"] }], unattributedShare: "0.5", evidenceRefs: ["share:1"], payerEvidenceRefs: [] }
      : { kind: "unknown", reasonCode: "NO_EXPLICIT_BENEFICIARY", evidenceRefs: [], payerEvidenceRefs: [] };
  return parseEconomicComponentFact({
    fact: "fct_economic_component",
    householdId: closureHouseholdId,
    householdTimeZone: "Europe/Paris",
    canonicalComponentKey: `operation:${operationId}`,
    sourceOperation: { kind: "resolved", id: operationId },
    gross: amount,
    refundApplied: "0",
    net: amount,
    bankDate: { kind: "known", date: operation.date_bancaire },
    economicTiming: {
      kind: "known",
      segments: rawSegments.map((row) => ({
        segmentKey: row.economic_segment_id,
        timingState: "known",
        periodStart: row.economic_month,
        periodEnd: row.economic_month,
        economicMonth: row.economic_month.slice(0, 7),
        amount: segmentAmount,
      })),
    },
    person,
    category: { kind: "undetermined" },
    subcategory: { kind: "unknown" },
    activity: { kind: "unknown" },
    merchant: { kind: "unknown" },
    moment: { kind: "unknown" },
    canonicalPlace: { kind: "unknown" },
    necessity: { kind: "unknown" },
    behavior: { kind: "unknown" },
    lifeScope: { kind: "unknown" },
  });
}
function instrumentEconomicRepository() {
  const repository = new CanonicalRepository({}, {
    ...runtimeContext,
    householdId: closureHouseholdId,
    personIds: closurePersonIds,
    asOf: "2026-01-01T00:00:00.000Z",
  });
  const instrumentation = { queryCount: 0, rowsFetched: 0 };
  const read = (rows) => {
    instrumentation.queryCount += 1;
    instrumentation.rowsFetched += rows.length;
    return rows;
  };
  const inDateRange = (value, range) => value !== null && value >= range.start && value < range.endExclusive;
  repository.loadEconomicOperationIdsByBankRange = async (range) => read(closureOperations
    .filter((row) => inDateRange(row.date_bancaire, range))
    .map((row) => row.operation_id));
  repository.loadEconomicOperationIdsByHistoricalTimingRange = async (range) => read(closureOperations
    .filter((row) => inDateRange(row.date_transaction_reelle, range)
      || (row.mois_analytique_force !== null
        && row.mois_analytique_force >= range.start.slice(0, 7)
        && row.mois_analytique_force < range.endExclusive.slice(0, 7)))
    .map((row) => row.operation_id));
  repository.loadTimingRowsForRange = async (range) => read(closureTimingRows
    .filter((row) => inDateRange(row.economic_month, range)));
  repository.loadEconomicComponentRowsByOperations = async (operationIds) => read([...new Set(operationIds)].sort()
    .map((operationId) => ({ operation_id: operationId, canonical_component_key: `operation:${operationId}` })));
  repository.loadEconomicComponentRowsByKeys = async (componentKeys) => read([...new Set(componentKeys)].sort()
    .map((canonicalComponentKey) => ({ operation_id: canonicalComponentKey.slice("operation:".length), canonical_component_key: canonicalComponentKey })));
  repository.projectEconomicComponentRows = async (components) => {
    if (components.length > 0) {
      // Models the canonical operation/place/timing/control/reconciliation and
      // person-link dependency reads performed by the real projector.
      for (let dependency = 0; dependency < 20; dependency += 1) read(components);
    }
    return components.map((row) => closureFact(row.operation_id));
  };
  repository.loadOperationsByIds = async (operationIds) => read(closureOperations
    .filter((row) => operationIds.includes(row.operation_id)));
  repository.loadTimingRowsByKeys = async (componentKeys) => read(closureTimingRows
    .filter((row) => componentKeys.includes(row.canonical_component_key)));
  repository.loadComposition = async () => read([]);
  return { repository, instrumentation };
}
const annualRange = { start: "2025-01-01", endExclusive: "2026-01-01" };
const monthlyRanges = Array.from({ length: 12 }, (_, index) => {
  const start = `2025-${String(index + 1).padStart(2, "0")}-01`;
  const endExclusive = index === 11
    ? "2026-01-01"
    : `2025-${String(index + 2).padStart(2, "0")}-01`;
  return { start, endExclusive };
});
const legacy = instrumentEconomicRepository();
const legacyMonthlyFacts = await Promise.all(monthlyRanges.map((range) =>
  legacy.repository.loadEconomicFacts(range)));
const optimized = instrumentEconomicRepository();
const closure = await optimized.repository.preloadEconomicFactsClosure(annualRange);
const optimizedAfterPreload = { ...optimized.instrumentation };
const optimizedMonthlyFacts = await Promise.all(monthlyRanges.map((range) =>
  optimized.repository.loadEconomicFacts(range)));

assert.deepEqual(optimizedMonthlyFacts, legacyMonthlyFacts, "La closure doit reproduire exactement chaque lecture mensuelle historique.");
assert.equal(closure.economicFacts.length, 4);
assert.deepEqual(optimized.instrumentation, optimizedAfterPreload, "Les douze projections ne doivent déclencher aucune lecture physique supplémentaire.");
assert.ok(optimized.instrumentation.queryCount < legacy.instrumentation.queryCount / 2);
assert.ok(optimized.instrumentation.rowsFetched < legacy.instrumentation.rowsFetched);
assert.equal(optimizedMonthlyFacts[0][0].person.kind, "resolved", "L'autorité beneficiary doit être préservée.");
assert.equal(optimizedMonthlyFacts[5].find((fact) => String(fact.canonicalComponentKey).endsWith("4"))?.person.kind, "partial", "La couverture beneficiary partielle doit être préservée.");
assert.equal(optimizedMonthlyFacts[6].some((fact) => String(fact.canonicalComponentKey).endsWith("4")), true, "Un timing chevauchant deux mois doit rester visible dans les deux fenêtres.");
assert.equal(optimizedMonthlyFacts[11].some((fact) => String(fact.canonicalComponentKey).endsWith("3")), true, "Le mois 12 doit conserver l'inclusion par mois analytique forcé.");

console.log("Canonical .in batching checks: PASS");
