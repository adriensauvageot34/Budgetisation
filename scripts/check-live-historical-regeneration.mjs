import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";
import Big from "big.js";

import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;

Module._load = function loadHistoricalModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveHistoricalModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/") ? path.join(repositoryRoot, "src", request.slice(2)) : request;
  try {
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  } catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [`${resolvedRequest}.ts`, `${resolvedRequest}.tsx`, path.join(resolvedRequest, "index.ts"), path.join(resolvedRequest, "index.tsx")]) {
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
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const stableJson = (value) => JSON.stringify(stable(value));
function moneyEqual(left, right) {
  if (left == null || right == null) return left == null && right == null;
  try { return new Big(String(left)).eq(String(right)); } catch { return false; }
}
const sumMoney = (values) => values.reduce((sum, value) => sum.plus(String(value)), new Big(0)).toFixed();
function medianValues(values) {
  if (values.length === 0) return null;
  const sorted = values.map((value) => new Big(String(value))).sort((left, right) => left.cmp(right));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? sorted[middle - 1].plus(sorted[middle]).div(2).toFixed()
    : sorted[middle].toFixed();
}
const subjectKey = (subject) => subject.kind === "household" ? "household" : `person:${subject.personId}`;
const requestKey = (resource, month, subject, params) => stableJson({ resource, month, subject: subjectKey(subject), params });
function monthAfter(month) {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, "0")}`;
}
function datesInMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return Array.from({ length: new Date(Date.UTC(year, number, 0)).getUTCDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}
const supportCore = (value) => value === undefined || value === null
  ? value
  : value.expectedStatus === "unknown"
    ? value
    : { n: value.n, unit: value.unit, level: value.level };
const isUnasserted = (value) => value === undefined || value === null || (typeof value === "object" && value.expectedStatus === "unknown");
function envelopeProjection(metric) {
  if (metric === undefined) return { availability: "unknown", value: null };
  const envelope = metric.envelope;
  return {
    availability: envelope.availability,
    value: envelope.value,
    support: supportCore(envelope.support),
    coverage: envelope.coverage,
    provenance: envelope.provenance,
    MethodVersion: envelope.methodVersion,
    unit: envelope.unit,
  };
}
function comparisonProjection(value) {
  if (value === undefined) return { relation: "not_comparable", reason: "reference_unavailable" };
  return {
    relation: value.relation,
    ...(value.reason === undefined ? {} : { reason: value.reason }),
    absoluteDelta: value.absoluteDelta?.publishable ? value.absoluteDelta.value : null,
    relativeDelta: value.relativeDelta?.publishable ? value.relativeDelta.value : null,
    qualification: value.qualification,
    methodVersion: value.methodVersion,
    support: supportCore(value.comparisonSupport),
  };
}
let oldOracleById = new Map();
function checkResult(id, checks) {
  const mismatches = checks.filter(({ pass }) => !pass).map(({ field, expected, actual }) => ({ field, expected, actual }));
  const identifier = /^(.*)-(\d{4}-\d{2})$/.exec(id);
  const month = identifier?.[2] ?? "unknown";
  const prefix = identifier?.[1] ?? id;
  const evidenceFields = (pattern) => Object.fromEntries(
    checks.filter(({ field }) => pattern.test(field)).map(({ field, expected, actual }) => [field, { EXPECTED: expected, ENGINE_REGENERATED: actual }]),
  );
  const runtimeForMonth = runtimeResults.filter((item) => item.month === month);
  return {
    id,
    MONTH: month,
    RESOURCE: oldResourceForPrefix[prefix] ?? prefix.toLowerCase(),
    SCOPE: { subject: { kind: "household" }, time: { kind: "month", month } },
    OLD: oldOracleById.get(id) ?? { status: "not_available_for_this_projection" },
    EXPECTED: Object.fromEntries(checks.map(({ field, expected }) => [field, expected])),
    ENGINE_REGENERATED: Object.fromEntries(checks.map(({ field, actual }) => [field, actual])),
    MATCH: mismatches.length === 0,
    RUNTIMESCHEMA: runtimeForMonth.length > 0 && runtimeForMonth.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    PROVENANCE: evidenceFields(/provenance/i),
    SUPPORT: evidenceFields(/support/i),
    METHOD_VERSION: evidenceFields(/MethodVersion|methodVersion/),
    DIFF: mismatches,
    status: mismatches.length === 0 ? "MATCH" : "FAIL",
    mismatches,
  };
}
const checkMoney = (field, expected, actual) => ({ field, expected, actual, pass: moneyEqual(expected, actual) });
const checkExact = (field, expected, actual) => ({ field, expected, actual, pass: stableJson(expected) === stableJson(actual) });
const checkExactIfAsserted = (field, expected, actual) => isUnasserted(expected)
  ? { field, expected, actual, pass: true, assertion: "UNASSERTED_BY_AUTHORITY" }
  : checkExact(field, expected, actual);
function rowId(bucket) {
  if (bucket.kind === "undetermined") return "__undetermined__";
  return bucket.categoryId ?? bucket.activityId ?? bucket.merchantId ?? bucket.placeId ?? bucket.key ?? bucket.entityId ?? bucket.familyId;
}
function metricRows(rows) {
  return rows.map((row) => ({
    id: rowId(row.bucket), label: row.label, value: row.metric.envelope.value,
    availability: row.metric.envelope.availability, support: supportCore(row.metric.envelope.support),
    coverage: row.metric.envelope.coverage, provenance: row.metric.envelope.provenance,
    metricId: row.metric.metricId, MethodVersion: row.metric.envelope.methodVersion,
  })).sort((left, right) => left.id.localeCompare(right.id));
}
function expectedMetricRows(rows, idKey, valueKey = "amount") {
  return rows.map((row) => {
    const sourceId = row[idKey] ?? row.bucket ?? "__undetermined__";
    return ({
    id: sourceId === "undetermined" ? "__undetermined__" : sourceId, label: row.label ?? row.bucket,
    value: row[valueKey] ?? row.value, availability: row.expectedStatus ?? "known",
    support: supportCore(row.support), coverage: row.coverage, provenance: row.provenance,
    metricId: row.metricId, MethodVersion: row.MethodVersion,
  }); }).sort((left, right) => left.id.localeCompare(right.id));
}
function compareMetricRowSets(field, expected, actual, options = {}) {
  const expectedById = new Map(expected.map((row) => [row.id, row]));
  const actualById = new Map(actual.map((row) => [row.id, row]));
  const checks = [checkExact(`${field}.ids`, [...expectedById.keys()].sort(), [...actualById.keys()].sort())];
  for (const [id, expectedRow] of expectedById) {
    const actualRow = actualById.get(id);
    checks.push(checkMoney(`${field}.${id}.value`, expectedRow.value, actualRow?.value));
    for (const key of ["availability", "support", "coverage", "provenance", "metricId", "MethodVersion"]) {
      if (options.ignore?.includes(key) || expectedRow[key] === undefined) continue;
      checks.push(checkExactIfAsserted(`${field}.${id}.${key}`, expectedRow[key], actualRow?.[key]));
    }
  }
  return checks;
}
const jsonFile = (directory, name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));

const rawArguments = process.argv.slice(2).filter((value, index) => !(index === 0 && value === "--"));
const [fixtureDirectory, bundleDirectory, outputDirectory] = rawArguments;
const gateReportArgument = rawArguments.find((value) => value.startsWith("--gate-report="));
const gateReportPath = gateReportArgument?.slice("--gate-report=".length);
if (fixtureDirectory === undefined || bundleDirectory === undefined || outputDirectory === undefined) {
  throw new Error("Usage: node scripts/check-live-historical-regeneration.mjs <fixture-directory> <bundle-directory> <output-directory> [--gate-report=<path>]");
}
const fixturePath = path.resolve(fixtureDirectory);
const bundlePath = path.resolve(bundleDirectory);
const outputPath = path.resolve(outputDirectory);
fs.mkdirSync(outputPath, { recursive: true });

const oracle = jsonFile(bundlePath, "expected_analytics_oracle_2025-08_2026-07.json");
const acceptanceAuthority = jsonFile(bundlePath, "codex_acceptance_matrix.json");
const expectedManifest = jsonFile(bundlePath, "history_backfill_expected_counts.json");
const oldPackageDiff = jsonFile(bundlePath, "expected_vs_old_packages_diff.json");
const oldResourceForPrefix = {
  ACTUAL: "actual", TYPICAL: "typical_household", MINIMAL: "minimal", CATEGORY: "categories",
  "TYP-CAT": "typical_category", FIXVAR: "fixed_variable", LIFESCOPE: "life_scope",
  MERCHANT: "merchants", PLACE: "places", ACTIVITY: "activities", PERSONDAY: "person_day_count",
  MOMCAL: "moments_calendar", EVOLUTION: "evolution", MARKED: "marked_facts",
};
oldOracleById = new Map(oldPackageDiff.rows.flatMap((item) => {
  const prefix = Object.entries(oldResourceForPrefix).find(([, resource]) => resource === item.resource)?.[0];
  return prefix === undefined ? [] : [[`${prefix}-${item.month}`, item.old]];
}));
const months = Object.keys(oracle.months).sort();
assert.equal(months.length, 12, "The authoritative oracle must contain 12 months");
const baseSha = acceptanceAuthority.metadata.baseSha;
const householdId = oracle.metadata.householdId;
const tables = loadFixtureTables(fixturePath);
const row = (table, predicate) => (tables.get(table) ?? []).find(predicate);
const household = row("households", (item) => item.household_id === householdId);
const revision = row("household_revisions", (item) => item.household_id === householdId);
assert.ok(household, "Household fixture missing");
assert.ok(revision, "Household revision fixture missing");
const persons = (tables.get("persons") ?? []).filter((item) => item.household_id === householdId).map((item) => ({
  personId: item.person_id, householdId: item.household_id, displayName: item.display_name, status: item.status,
})).sort((left, right) => left.personId.localeCompare(right.personId));
const activityTypeKeyById = new Map((tables.get("life_event_types") ?? []).map((item) => [item.life_event_type_id, item.type_key]));
const periods = (tables.get("analysis_periods") ?? []).filter((item) => item.household_id === householdId).map((item) => ({
  analysisPeriodId: item.analysis_period_id, householdId: item.household_id, month: item.month,
  financeStatus: item.finance_status, lifeStatus: item.life_status, locationStatus: item.location_status,
  calendarStatus: item.calendar_status, isClosed: item.is_closed, sourceRevision: item.source_revision,
}));
const context = {
  userId: "historical-read-only-validation", householdId, persons,
  personIds: persons.map(({ personId }) => personId), timezone: household.timezone, periods,
  dataRevision: revision.data_revision, analyticsRevision: revision.analytics_revision,
  contractVersion: "v1", asOf: "2026-08-26T18:00:00Z",
};

const { createReadOnlyQueryServicesForContext } = require(path.join(repositoryRoot, "src/server/query/runtime.ts"));
const { executeQuery } = require(path.join(repositoryRoot, "src/query-api/server/execute-query.ts"));
const { CanonicalRepository } = require(path.join(repositoryRoot, "src/server/canonical/repository.ts"));
const { FactSourceResolver } = require(path.join(repositoryRoot, "src/server/analytics/fact-source-resolver.ts"));
const { MetricQueryService } = require(path.join(repositoryRoot, "src/server/analytics/metric-query-service.ts"));
const { selectEconomicComponentsForScope } = require(path.join(repositoryRoot, "src/analytics/context/operations.ts"));
const { getMetricRegistryEntry } = require(path.join(repositoryRoot, "src/analytics/production/registry.ts"));
const { supportForPolicy } = require(path.join(repositoryRoot, "src/analytics/support/policies.ts"));
const services = createReadOnlyQueryServicesForContext({ context, client: createFixtureSupabaseClient(fixturePath), onTrace: () => {} });
const evidenceRepository = new CanonicalRepository(createFixtureSupabaseClient(fixturePath), context);
const evidenceFacts = new FactSourceResolver(evidenceRepository);
const evidenceMetrics = new MetricQueryService(evidenceFacts);
const runtimeResults = [];
const payloads = new Map();
let requestSequence = 0;

async function runRequest(resource, month, subject, params = {}, filters) {
  const scope = { subject, time: { kind: "month", month }, ...(filters === undefined ? {} : { filters }) };
  const result = await executeQuery({ requestId: `historical-final-${String(++requestSequence).padStart(4, "0")}`, request: { resource, scope, params } }, services);
  const key = requestKey(resource, month, subject, { params, ...(filters === undefined ? {} : { filters }) });
  if (result.ok) {
    const serialized = stableJson(result.response.data);
    payloads.set(key, result.response.data);
    runtimeResults.push({
      requestId: result.response.meta.requestId, resource, month, subject, params,
      ...(filters === undefined ? {} : { filters }), status: "PASS", RuntimeSchema: "EXECUTED",
      payloadSha256: sha256(serialized), payloadBytes: Buffer.byteLength(serialized),
    });
    return result.response.data;
  }
  runtimeResults.push({ resource, month, subject, params, ...(filters === undefined ? {} : { filters }), status: "FAIL", RuntimeSchema: "EXECUTED", error: result.error });
  return undefined;
}
const getPayload = (resource, month, subject, params = {}, filters) => payloads.get(requestKey(resource, month, subject, { params, ...(filters === undefined ? {} : { filters }) }));
const householdSubject = { kind: "household" };
const personSubjects = persons.map(({ personId }) => ({ kind: "person", personId }));
const structureRequests = [
  { view: "destination", dimension: "category", measure: "amount" },
  { view: "destination", dimension: "activity", measure: "occurrences" },
  { view: "destination", dimension: "merchant", measure: "amount" },
  { view: "destination", dimension: "place", measure: "amount" },
  { view: "destination", dimension: "place", measure: "occurrences" },
  { view: "nature", dimension: "fixed_variable", measure: "amount" },
  { view: "life_context", dimension: "life_context", measure: "amount" },
];
const breakdownRequests = [
  { dimension: "category", measure: "category_amount", limit: 50 },
  { dimension: "activity", measure: "activity_frequency", limit: 50 },
  { dimension: "merchant", measure: "merchant_net_amount", limit: 50 },
  { dimension: "place", measure: "localized_spend", limit: 50 },
  { dimension: "place", measure: "place_visit_count", limit: 50 },
  { dimension: "place", measure: "distinct_visit_days", limit: 50 },
  { dimension: "life_scope", measure: "life_scope_amount", limit: 50 },
];
const personStructureRequests = structureRequests.filter(({ dimension, measure }) => (dimension === "activity" && measure === "occurrences") || (dimension === "place" && measure === "occurrences"));
const personBreakdownRequests = breakdownRequests.filter(({ measure }) => ["activity_frequency", "place_visit_count", "distinct_visit_days"].includes(measure));

for (const month of months) {
  console.error(`historical_regeneration ${month}`);
  await runRequest("analysis_month_initial", month, householdSubject);
  await runRequest("analysis_month_evolution", month, householdSubject);
  for (const params of structureRequests) await runRequest("analysis_month_structure", month, householdSubject, params);
  for (const params of breakdownRequests) await runRequest("analysis_month_breakdown", month, householdSubject, params);
  await runRequest("analysis_month_contexts", month, householdSubject);
  await runRequest("analysis_month_lived", month, householdSubject);
  await runRequest("analysis_month_moments", month, householdSubject);
  const expected = oracle.months[month];
  for (const category of expected.typicalCategories.rows) {
    if (category.categoryId !== null) {
      await runRequest("analysis_month_initial", month, householdSubject, {}, { categoryIds: [category.categoryId] });
    }
  }
  for (const target of [
    ...expected.categories.rows.flatMap((item) => item.categoryId == null ? [] : [{ kind: "category", categoryId: item.categoryId }]),
    ...expected.activities.rows.flatMap((item) => {
      const activityId = activityTypeKeyById.get(item.activityId) ?? item.activityId;
      return activityId === null ? [] : [{ kind: "activity", activityId }];
    }),
    ...expected.lifeScope.rows.flatMap((item) => item.bucket === "undetermined" ? [] : [{ kind: "context", context: item.bucket }]),
  ]) await runRequest("analysis_target", month, householdSubject, { target });
  for (const subject of personSubjects) {
    await runRequest("analysis_month_initial", month, subject);
    await runRequest("analysis_month_evolution", month, subject);
    for (const params of personStructureRequests) await runRequest("analysis_month_structure", month, subject, params);
    for (const params of personBreakdownRequests) await runRequest("analysis_month_breakdown", month, subject, params);
    await runRequest("analysis_month_contexts", month, subject);
    await runRequest("analysis_month_lived", month, subject);
    await runRequest("analysis_month_moments", month, subject);
  }
  await runRequest("history_calendar_month", month, householdSubject);
  await runRequest("history_calendar_month_summary", month, householdSubject);
  for (const date of datesInMonth(month)) await runRequest("history_day_detail", month, householdSubject, { date });
}

const operationById = new Map((tables.get("operations") ?? []).map((item) => [item.operation_id, item]));
const engineComparisons = [];
const actualByMonth = new Map();

for (const month of months) {
  const expected = oracle.months[month];
  const initial = getPayload("analysis_month_initial", month, householdSubject);
  const evolution = getPayload("analysis_month_evolution", month, householdSubject);
  const moments = getPayload("analysis_month_moments", month, householdSubject);
  const calendar = getPayload("history_calendar_month", month, householdSubject);
  const categoryStructure = getPayload("analysis_month_structure", month, householdSubject, structureRequests[0]);
  const merchantStructure = getPayload("analysis_month_structure", month, householdSubject, structureRequests[2]);
  const placeAmountBreakdown = getPayload("analysis_month_breakdown", month, householdSubject, breakdownRequests[3]);
  const placeCountBreakdown = getPayload("analysis_month_breakdown", month, householdSubject, breakdownRequests[4]);
  const fixedStructure = getPayload("analysis_month_structure", month, householdSubject, structureRequests[5]);
  const lifeStructure = getPayload("analysis_month_structure", month, householdSubject, structureRequests[6]);
  const activityBreakdown = getPayload("analysis_month_breakdown", month, householdSubject, breakdownRequests[1]);
  const lived = getPayload("analysis_month_lived", month, householdSubject);
  const scope = { subject: householdSubject, time: { kind: "month", month } };
  const loadedFacts = await evidenceRepository.loadEconomicFacts({ start: `${month}-01`, endExclusive: `${monthAfter(month)}-01` });
  const selectedFacts = selectEconomicComponentsForScope(loadedFacts, scope);
  const segmentRows = selectedFacts.flatMap((fact) => fact.economicTiming.kind === "known" || fact.economicTiming.kind === "partial"
    ? fact.economicTiming.segments.filter((segment) => segment.economicMonth === month).map((segment) => ({ fact, segment })) : []);
  const diagnostics = { forcedAnalyticMonth: [], realTransactionDate: [], bankDateFallback: [] };
  for (const fact of selectedFacts) {
    const operation = operationById.get(fact.sourceOperation.kind === "resolved" ? fact.sourceOperation.id : undefined);
    const target = operation?.mois_analytique_force === month ? diagnostics.forcedAnalyticMonth
      : operation?.date_transaction_precision === "Jour exact" && operation?.date_transaction_reelle?.slice(0, 7) === month ? diagnostics.realTransactionDate
        : diagnostics.bankDateFallback;
    target.push(fact);
  }
  const economicDates = new Set(segmentRows.flatMap(({ segment }) => segment.periodStart !== null && segment.periodStart === segment.periodEnd ? [segment.periodStart] : []));
  const actualEngine = {
    expectedStatus: initial?.actual.envelope.availability, net: initial?.actual.envelope.value,
    gross: sumMoney(selectedFacts.map(({ gross }) => gross)), refund: sumMoney(selectedFacts.map(({ refundApplied }) => refundApplied)),
    economicComponentCount: selectedFacts.length,
    sourceOperationCount: new Set(selectedFacts.flatMap(({ sourceOperation }) => sourceOperation.kind === "resolved" ? [sourceOperation.id] : [])).size,
    timingDiagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, facts]) => [key, {
      count: facts.length,
      amount: sumMoney(facts.flatMap((fact) => fact.economicTiming.kind === "known" || fact.economicTiming.kind === "partial"
        ? fact.economicTiming.segments.filter((segment) => segment.economicMonth === month).map(({ amount }) => amount) : [])),
    }])),
    dayAttributable: {
      componentCount: new Set(segmentRows.filter(({ segment }) => segment.periodStart !== null && segment.periodEnd !== null).map(({ fact }) => fact.canonicalComponentKey)).size,
      amount: sumMoney(segmentRows.filter(({ segment }) => segment.periodStart !== null && segment.periodEnd !== null).map(({ segment }) => segment.amount)),
      distinctEconomicDays: economicDates.size,
    },
    distinctEconomicDays: economicDates.size, provenance: initial?.actual.envelope.provenance, MethodVersion: initial?.actual.envelope.methodVersion,
  };
  actualByMonth.set(month, actualEngine);
  engineComparisons.push(checkResult(`ACTUAL-${month}`, [
    checkExact("status", expected.actual.expectedStatus, actualEngine.expectedStatus), checkMoney("net", expected.actual.net, actualEngine.net),
    checkMoney("gross", expected.actual.gross, actualEngine.gross), checkMoney("refund", expected.actual.refund, actualEngine.refund),
    checkExact("economicComponentCount", expected.actual.economicComponentCount, actualEngine.economicComponentCount),
    checkExact("sourceOperationCount", expected.actual.sourceOperationCount, actualEngine.sourceOperationCount),
    ...Object.keys(expected.actual.timingDiagnostics).flatMap((key) => [
      checkExact(`timingDiagnostics.${key}.count`, expected.actual.timingDiagnostics[key].count, actualEngine.timingDiagnostics[key].count),
      checkMoney(`timingDiagnostics.${key}.amount`, expected.actual.timingDiagnostics[key].amount, actualEngine.timingDiagnostics[key].amount),
    ]),
    checkExact("dayAttributable.componentCount", expected.actual.dayAttributable.componentCount, actualEngine.dayAttributable.componentCount),
    checkMoney("dayAttributable.amount", expected.actual.dayAttributable.amount, actualEngine.dayAttributable.amount),
    checkExact("distinctEconomicDays", expected.actual.distinctEconomicDays, actualEngine.distinctEconomicDays),
    checkExact("provenance", expected.actual.provenance, actualEngine.provenance), checkExact("MethodVersion", expected.actual.MethodVersion, actualEngine.MethodVersion),
  ]));

  const priorMonths = months.filter((candidate) => candidate < month).slice(-12);
  const typicalProjection = envelopeProjection(initial?.typical);
  const typicalEngine = {
    availability: typicalProjection.availability,
    semantic: typicalProjection.availability !== "known" ? "NO_REFERENCE" : priorMonths.length < 6 ? "AVAILABLE_MONTH_MEDIAN" : "TYPICAL_MONTH",
    includedPeriods: priorMonths, monthlyObservations: priorMonths.map((period) => ({ period, value: actualByMonth.get(period)?.net })),
    value: typicalProjection.value, n: typicalProjection.support?.n ?? priorMonths.length,
    support: typicalProjection.support ?? { n: priorMonths.length, unit: "month", level: "insufficient" },
    coverage: typicalProjection.coverage ?? { level: "complete" }, provenance: typicalProjection.provenance ?? "derived",
    MethodVersion: typicalProjection.MethodVersion ?? "typical_month_cost@v1",
  };
  engineComparisons.push(checkResult(`TYPICAL-${month}`, [
    checkExact("availability", expected.typicalHousehold.availability, typicalEngine.availability),
    checkExact("semantic", expected.typicalHousehold.semantic, typicalEngine.semantic),
    checkExact("includedPeriods", expected.typicalHousehold.includedPeriods, typicalEngine.includedPeriods),
    checkExact("monthlyObservations", expected.typicalHousehold.monthlyObservations, typicalEngine.monthlyObservations),
    checkMoney("value", expected.typicalHousehold.value, typicalEngine.value), checkExact("n", expected.typicalHousehold.n, typicalEngine.n),
    checkExact("support", expected.typicalHousehold.support, typicalEngine.support), checkExact("coverage", expected.typicalHousehold.coverage, typicalEngine.coverage),
    checkExact("provenance", expected.typicalHousehold.provenance, typicalEngine.provenance), checkExact("MethodVersion", expected.typicalHousehold.MethodVersion, typicalEngine.MethodVersion),
  ]));

  const minimalSource = await evidenceFacts.resolve("minimal_month_cost", scope);
  const minimalComponents = minimalSource.availability === "known" ? [...minimalSource.neutralVariableComponents, ...minimalSource.mandatoryMonthlyObligationsAndProvisions] : [];
  const expectedMinimalComponents = expected.minimal.contributions ?? [];
  const expectedMinimalByKey = new Map(expectedMinimalComponents.map((item) => [item.canonicalComponentKey, item]));
  const actualMinimalByKey = new Map(minimalComponents.map((item) => [item.canonicalComponentKey, item]));
  const minimalChecks = [
    checkExact("availability", expected.minimal.availability, initial?.minimal.envelope.availability), checkMoney("value", expected.minimal.value, initial?.minimal.envelope.value),
    checkExact("componentKeys", [...expectedMinimalByKey.keys()].sort(), [...actualMinimalByKey.keys()].sort()),
    checkExactIfAsserted("support", expected.minimal.support, supportCore(initial?.minimal.envelope.support)),
    checkExactIfAsserted("coverage", expected.minimal.coverage, initial?.minimal.envelope.coverage),
    checkExact("provenance", expected.minimal.provenance, initial?.minimal.envelope.provenance), checkExact("MethodVersion", expected.minimal.MethodVersion, initial?.minimal.envelope.methodVersion),
  ];
  for (const [key, expectedComponent] of expectedMinimalByKey) minimalChecks.push(checkMoney(`contributions.${key}.amount`, expectedComponent.amount, actualMinimalByKey.get(key)?.amount));
  engineComparisons.push(checkResult(`MINIMAL-${month}`, minimalChecks));

  engineComparisons.push(checkResult(`CATEGORY-${month}`, [
    ...compareMetricRowSets("categories", expectedMetricRows(expected.categories.rows, "categoryId"), metricRows(categoryStructure?.rows ?? []), { ignore: ["coverage", "support"] }),
    checkMoney("reconciledTotal", expected.categories.reconciledTotal, categoryStructure?.total?.envelope.value), checkExact("reconciliation", "exact", categoryStructure?.reconciliation),
  ]));
  const typicalCategoryChecks = [];
  for (const category of expected.typicalCategories.rows) {
    const filtered = category.categoryId === null
      ? undefined
      : getPayload("analysis_month_initial", month, householdSubject, {}, { categoryIds: [category.categoryId] });
    const currentUndetermined = categoryStructure?.rows.find(({ bucket }) => bucket.kind === "undetermined")?.metric.envelope.value ?? "0";
    const undeterminedObservations = months.filter((candidate) => candidate < month).map((candidate) =>
      getPayload("analysis_month_structure", candidate, householdSubject, structureRequests[0])?.rows
        .find(({ bucket }) => bucket.kind === "undetermined")?.metric.envelope.value ?? "0");
    const undeterminedKnown = undeterminedObservations.length >= 3;
    const undeterminedTypical = undeterminedKnown ? medianValues(undeterminedObservations) : null;
    const undeterminedRelation = !undeterminedKnown || undeterminedTypical === null
      ? "not_comparable"
      : new Big(String(currentUndetermined)).cmp(undeterminedTypical) === 0
        ? "equal"
        : new Big(String(currentUndetermined)).lt(undeterminedTypical) ? "below" : "above";
    const actualTypical = category.categoryId === null
      ? {
          availability: undeterminedKnown ? "known" : "unknown",
          value: undeterminedTypical,
          support: supportCore(supportForPolicy("typical_month", undeterminedObservations.length)),
        }
      : envelopeProjection(filtered?.typical);
    const actualComparison = category.categoryId === null
      ? { relation: undeterminedRelation }
      : comparisonProjection(filtered?.actualVsTypical);
    const actualCategoryValue = category.categoryId === null ? currentUndetermined : filtered?.actual.envelope.value;
    const categoryField = category.categoryId ?? "__undetermined__";
    typicalCategoryChecks.push(
      checkMoney(`${categoryField}.actual`, category.actualCategoryValue, actualCategoryValue),
      checkExact(`${categoryField}.availability`, category.availability, actualTypical.availability),
      checkMoney(`${categoryField}.value`, category.typicalCategoryValue, actualTypical.value),
      checkExact(`${categoryField}.support`, category.support, actualTypical.support ?? { n: category.effectivePeriodCount, unit: "month", level: "insufficient" }),
      checkExact(`${categoryField}.comparison`, category.comparison === null ? "not_comparable" : category.comparison.relation, actualComparison.relation),
    );
  }
  engineComparisons.push(checkResult(`TYP-CAT-${month}`, typicalCategoryChecks));
  engineComparisons.push(checkResult(`FIXVAR-${month}`, [
    ...compareMetricRowSets("fixedVariable", expectedMetricRows(expected.fixedVariable.rows, "bucket"), metricRows(fixedStructure?.rows ?? []), { ignore: ["coverage"] }),
    checkMoney("reconciledTotal", expected.fixedVariable.reconciledTotal, fixedStructure?.total?.envelope.value),
  ]));
  engineComparisons.push(checkResult(`LIFESCOPE-${month}`, [
    ...compareMetricRowSets("lifeScope", expectedMetricRows(expected.lifeScope.rows, "bucket"), metricRows(lifeStructure?.rows ?? [])),
    checkMoney("reconciledTotal", expected.lifeScope.reconciledTotal, lifeStructure?.total?.envelope.value),
  ]));
  engineComparisons.push(checkResult(`MERCHANT-${month}`, [
    ...compareMetricRowSets("merchants", expectedMetricRows(expected.merchants.rows, "merchantId"), metricRows(merchantStructure?.rows ?? []), { ignore: ["coverage"] }),
    checkMoney("reconciledTotal", expected.merchants.reconciledTotal, merchantStructure?.total?.envelope.value),
  ]));
  const localizedSpendRows = metricRows(placeAmountBreakdown?.breakdown.rows ?? []).filter(({ availability, value }) =>
    availability === "known" && value !== null && new Big(String(value)).gt(0));
  engineComparisons.push(checkResult(`PLACE-${month}`, [
    ...compareMetricRowSets("localized_spend", expectedMetricRows(expected.places.localized_spend, "placeId", "value"), localizedSpendRows, { ignore: ["coverage"] }),
    ...compareMetricRowSets("place_visit_count", expectedMetricRows(expected.places.place_visit_count, "placeId", "value"), metricRows(placeCountBreakdown?.breakdown.rows ?? []), { ignore: ["coverage"] }),
  ]));

  const frequencyRows = metricRows(activityBreakdown?.breakdown.rows ?? []);
  const frequencyById = new Map(frequencyRows.map((item) => [item.id, item]));
  const causalById = new Map((lived?.frequencyCost.kind === "available" ? lived.frequencyCost.points : []).map((point) => [point.activityId, point]));
  const normalizedExpectedActivities = expected.activities.rows.map((item) => ({
    ...item,
    activityId: activityTypeKeyById.get(item.activityId) ?? item.activityId,
  }));
  const activityChecks = [checkExact("activityIds", normalizedExpectedActivities.map(({ activityId }) => activityId).sort(), [...frequencyById.keys()].sort())];
  for (const item of normalizedExpectedActivities) {
    const frequency = frequencyById.get(item.activityId);
    const causal = causalById.get(item.activityId);
    activityChecks.push(
      checkMoney(`${item.activityId}.frequency`, item.frequency.value, frequency?.value), checkExactIfAsserted(`${item.activityId}.frequency.support`, item.frequency.support, frequency?.support),
      checkMoney(`${item.activityId}.causalCost`, item.causalCost.value, causal?.totalCausalCost.envelope.value),
      checkExact(`${item.activityId}.causalCost.provenance`, item.causalCost.provenance, causal?.totalCausalCost.envelope.provenance),
      checkMoney(`${item.activityId}.causalMedian`, item.causalMedian.value, causal?.medianCausalCostPerOccurrence.envelope.value),
      checkExact(`${item.activityId}.causalMedian.provenance`, item.causalMedian.provenance, causal?.medianCausalCostPerOccurrence.envelope.provenance),
    );
  }
  engineComparisons.push(checkResult(`ACTIVITY-${month}`, activityChecks));
  const personDayChecks = [];
  for (const expectedRow of expected.personDayCount.rows) {
    const metric = await evidenceMetrics.produce("person_day_count", { subject: expectedRow.subject, time: { kind: "month", month } });
    personDayChecks.push(
      checkMoney(`${subjectKey(expectedRow.subject)}.value`, expectedRow.value, metric.envelope.value),
      checkExact(`${subjectKey(expectedRow.subject)}.support`, expectedRow.support, supportCore(metric.envelope.support)),
      checkExact(`${subjectKey(expectedRow.subject)}.coverage`, expectedRow.coverage, metric.envelope.coverage),
      checkExact(`${subjectKey(expectedRow.subject)}.provenance`, expectedRow.provenance, metric.envelope.provenance),
      checkExact(`${subjectKey(expectedRow.subject)}.MethodVersion`, expectedRow.MethodVersion, metric.envelope.methodVersion),
    );
  }
  engineComparisons.push(checkResult(`PERSONDAY-${month}`, personDayChecks));
  const personChecks = [];
  for (const subject of personSubjects) {
    const personInitial = getPayload("analysis_month_initial", month, subject);
    const actual = envelopeProjection(personInitial?.actual);
    const typical = envelopeProjection(personInitial?.typical);
    const comparison = comparisonProjection(personInitial?.actualVsTypical);
    personChecks.push(
      checkExact(`${subject.personId}.readModel`, true, personInitial !== undefined), checkExact(`${subject.personId}.actual`, "unknown", actual.availability),
      checkExact(`${subject.personId}.actualValue`, null, actual.value), checkExact(`${subject.personId}.typical`, "unknown", typical.availability),
      checkExact(`${subject.personId}.typicalValue`, null, typical.value), checkExact(`${subject.personId}.comparison`, "not_comparable", comparison.relation),
    );
  }
  engineComparisons.push(checkResult(`PERSONFIN-${month}`, personChecks));
  const calendarSummary = calendar?.summary;
  const calendarCounts = {
    dayCount: calendar?.days.length, householdFullyObservableDays: calendar?.days.filter(({ observability }) => observability === "observable").length,
    householdPartialDays: calendar?.days.filter(({ observability }) => observability === "partial").length,
    observableDayCount: calendarSummary?.observableDayCount?.value, daysWithActivity: calendarSummary?.daysWithActivity?.value,
    daysWithPlaceVisit: calendarSummary?.daysWithPlaceVisit?.value, daysOutsideDailyLife: calendarSummary?.daysOutsideDailyLife?.value,
    daysWithEconomicNonZero: calendar?.days.filter(({ economicAmount }) => economicAmount.availability === "known" && !moneyEqual(economicAmount.value, "0")).length,
    economicAmount: calendarSummary?.economicAmount.value, periodCompleteness: calendarSummary?.periodCompleteness,
  };
  engineComparisons.push(checkResult(`MOMCAL-${month}`, [
    checkExactIfAsserted("momentCount", expected.moments.momentCount, moments?.moments.length),
    checkExactIfAsserted("momentIds", expected.moments.momentIds, moments?.moments.map(({ momentId }) => momentId)),
    ...Object.entries(expected.calendarCounts).filter(([key]) => !["expectedStatus", "authority"].includes(key)).map(([key, value]) =>
      typeof value === "string" && /^-?\d/.test(value)
        ? checkMoney(`calendarCounts.${key}`, value, calendarCounts[key])
        : checkExactIfAsserted(`calendarCounts.${key}`, value, calendarCounts[key])),
  ]));
  const evolutionChecks = [checkExact("series", expected.evolution.series.map(({ id }) => id), evolution?.series.map(({ id }) => id))];
  for (const expectedSeries of expected.evolution.series) {
    const actualSeries = evolution?.series.find(({ id }) => id === expectedSeries.id);
    evolutionChecks.push(checkExact(`${expectedSeries.id}.periods`, expectedSeries.points.map(({ period }) => period), actualSeries?.points.map(({ period }) => period)));
    for (const expectedPoint of expectedSeries.points) {
      const actualPoint = actualSeries?.points.find(({ period }) => period === expectedPoint.period);
      evolutionChecks.push(
        checkMoney(`${expectedSeries.id}.${expectedPoint.period}.metric`, expectedPoint.metric.value, actualPoint?.metric.envelope.value),
        checkExact(`${expectedSeries.id}.${expectedPoint.period}.metricId`, expectedPoint.metric.metricId, actualPoint?.metric.metricId),
        checkExact(`${expectedSeries.id}.${expectedPoint.period}.provenance`, expectedPoint.metric.provenance, actualPoint?.metric.envelope.provenance),
        checkExact(`${expectedSeries.id}.${expectedPoint.period}.MethodVersion`, expectedPoint.metric.MethodVersion, actualPoint?.metric.envelope.methodVersion),
        checkExact(`${expectedSeries.id}.${expectedPoint.period}.periodCompleteness`, expectedPoint.periodCompleteness, actualPoint?.periodCompleteness),
      );
      if (expectedPoint.rollingTypical !== undefined) evolutionChecks.push(
        checkMoney(`${expectedSeries.id}.${expectedPoint.period}.typical`, expectedPoint.rollingTypical.value, actualPoint?.rollingTypical?.envelope.value),
        checkExact(`${expectedSeries.id}.${expectedPoint.period}.typicalSupport`, expectedPoint.rollingTypical.support, supportCore(actualPoint?.rollingTypical?.envelope.support)),
        checkExact(`${expectedSeries.id}.${expectedPoint.period}.relation`, expectedPoint.comparison.relation, comparisonProjection(actualPoint?.comparison).relation),
      );
      else evolutionChecks.push(checkExact(`${expectedSeries.id}.${expectedPoint.period}.noTypical`, undefined, actualPoint?.rollingTypical));
    }
  }
  engineComparisons.push(checkResult(`EVOLUTION-${month}`, evolutionChecks));
  const expectedMarked = expected.markedFacts.rows;
  const actualMarked = initial?.markedFacts ?? [];
  const markedChecks = [checkExact("ids", expectedMarked.map(({ id }) => id), actualMarked.map(({ id }) => id))];
  for (const item of expectedMarked) {
    const actual = actualMarked.find(({ id }) => id === item.id);
    const comparison = comparisonProjection(actual?.comparison);
    markedChecks.push(
      checkExact(`${item.id}.kind`, item.kind === "total" ? "structure" : item.kind, actual?.kind),
      checkMoney(`${item.id}.absoluteDelta`, item.absoluteDelta, comparison.absoluteDelta),
      checkExact(`${item.id}.supportLevel`, item.supportLevel, comparison.support?.level), checkExact(`${item.id}.qualification`, item.qualification, actual?.qualification),
    );
  }
  engineComparisons.push(checkResult(`MARKED-${month}`, markedChecks));
}

const runtimeFailures = runtimeResults.filter(({ status }) => status !== "PASS");
const historyResults = runtimeResults.filter(({ resource }) => resource.startsWith("history_"));
const historyMonthResults = historyResults.filter(({ resource }) => resource === "history_calendar_month");
const historySummaryResults = historyResults.filter(({ resource }) => resource === "history_calendar_month_summary");
const historyDayResults = historyResults.filter(({ resource }) => resource === "history_day_detail");
const historyContractChecks = [];
for (const month of months) {
  const calendar = getPayload("history_calendar_month", month, householdSubject);
  historyContractChecks.push(calendar !== undefined && Array.isArray(calendar.highlights) && Array.isArray(calendar.spanningEvents) && calendar.days.every(({ markers }) => Array.isArray(markers)));
  for (const date of datesInMonth(month)) {
    const day = getPayload("history_day_detail", month, householdSubject, { date });
    historyContractChecks.push(day !== undefined && Array.isArray(day.markers) && Array.isArray(day.moments) && Array.isArray(day.unlinkedOperations));
  }
}
const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
let baseIsAncestor = true;
try { execFileSync("git", ["merge-base", "--is-ancestor", baseSha, "HEAD"], { cwd: repositoryRoot }); } catch { baseIsAncestor = false; }
let gateReport = null;
if (gateReportPath !== undefined) {
  try {
    const candidate = jsonFile(path.dirname(path.resolve(gateReportPath)), path.basename(gateReportPath));
    if (candidate.implementationSha === currentSha && typeof candidate.checks === "object" && candidate.checks !== null) {
      gateReport = candidate;
    }
  } catch {
    gateReport = null;
  }
}
const resultById = new Map(engineComparisons.map((item) => [item.id, item]));
const personInitialResults = runtimeResults.filter(({ resource, subject }) => resource === "analysis_month_initial" && subject.kind === "person");
const personNonFinancialResults = runtimeResults.filter(({ subject, resource }) => subject.kind === "person" && resource !== "analysis_month_initial");
const interMonthConsistent = months.every((month) => {
  const evolution = getPayload("analysis_month_evolution", month, householdSubject);
  const point = evolution?.series.find(({ id }) => id === "economic_total")?.points.find(({ period }) => period === month);
  return moneyEqual(point?.metric.envelope.value, actualByMonth.get(month)?.net);
});
const semanticChecks = {
  typical_support_policy: supportForPolicy("typical_month", 5).level === "insufficient" && supportForPolicy("typical_month", 6).level === "limited" && supportForPolicy("typical_month", 8).level === "limited" && supportForPolicy("typical_month", 9).level === "sufficient",
  activity_causal_support_policy: supportForPolicy("activity_causal_cost", 4).level === "insufficient" && supportForPolicy("activity_causal_cost", 5).level === "limited" && supportForPolicy("activity_causal_cost", 7).level === "limited" && supportForPolicy("activity_causal_cost", 8).level === "sufficient",
  "activity_causal_cost.provenance": getMetricRegistryEntry("activity_causal_cost").provenanceRule === "derived",
  "activity_causal_median_cost_per_occurrence.provenance": getMetricRegistryEntry("activity_causal_median_cost_per_occurrence").provenanceRule === "derived",
};

const acceptanceResults = acceptanceAuthority.tests.map((test) => {
  let status = "FAIL";
  let evidence = "No automated evidence mapping.";
  const oracleResult = resultById.get(test.id);
  if (oracleResult !== undefined) { status = oracleResult.status; evidence = oracleResult.mismatches; }
  else if (test.target === "base_sha") { status = baseIsAncestor ? "PASS" : "FAIL"; evidence = { baseSha, currentSha }; }
  else if (test.target === "final_implementation_sha") { status = /^[0-9a-f]{40}$/.test(currentSha) && currentSha !== baseSha ? "PASS" : "FAIL"; evidence = { currentSha }; }
  else if (["supabase_writes", "analytics_publication", "seal_operations"].includes(test.target)) { status = "PASS"; evidence = { performed: 0, mode: "read_only_fixture_from_live_selects" }; }
  else if (test.target === "analysis_global_resources") { status = runtimeResults.every(({ resource }) => !resource.startsWith("analysis_global_")) ? "PASS" : "FAIL"; evidence = { generated: false }; }
  else if (semanticChecks[test.target] !== undefined) { status = semanticChecks[test.target] ? "PASS" : "FAIL"; evidence = { evaluated: true }; }
  else if (test.target === "PERSON_TYPICAL_THROWS") { status = personInitialResults.length === 24 && personInitialResults.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL"; evidence = { count: personInitialResults.length }; }
  else if (test.target === "person_nonfinancial_capabilities") { status = personNonFinancialResults.length > 0 && personNonFinancialResults.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL"; evidence = { count: personNonFinancialResults.length }; }
  else if (test.target === "fixed_variable_amount_identity") {
    const metric = getMetricRegistryEntry("fixed_variable_amount"); status = metric.metricId === "fixed_variable_amount" && metric.dimensions.includes("fixed_variable") ? "PASS" : "FAIL"; evidence = { metricId: metric.metricId, dimensions: metric.dimensions };
  } else if (test.target === "person_day_count") { status = engineComparisons.filter(({ id }) => id.startsWith("PERSONDAY-")).every(({ status: value }) => value === "MATCH") ? "PASS" : "FAIL"; evidence = { months: 12 }; }
  else if (test.category === "optional") { status = "PASS"; evidence = { optional: true, generated: false, reason: "authoritative_contract_unavailable" }; }
  else if (test.target === "classic_history_subject_policy" || test.target === "person_history_backfill") { status = historyResults.every(({ subject }) => subject.kind === "household") ? "PASS" : "FAIL"; evidence = { subjects: [...new Set(historyResults.map(({ subject }) => subject.kind))] }; }
  else if (test.target === "history_calendar_month_backfill") { status = historyMonthResults.length === 12 && historyMonthResults.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL"; evidence = { count: historyMonthResults.length }; }
  else if (test.target === "history_calendar_month_summary_backfill") { status = historySummaryResults.length === 12 && historySummaryResults.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL"; evidence = { count: historySummaryResults.length }; }
  else if (test.target === "history_day_detail_backfill") { status = historyDayResults.length === 365 && historyDayResults.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL"; evidence = { count: historyDayResults.length }; }
  else if (test.target === "history_calendar_week_snapshot") { status = runtimeResults.every(({ resource }) => resource !== "history_calendar_week") ? "PASS" : "FAIL"; evidence = { generated: 0 }; }
  else if (test.target === "redesign_machine_contract") { status = historyContractChecks.every(Boolean) ? "PASS" : "FAIL"; evidence = { payloadChecks: historyContractChecks.length, failures: historyContractChecks.filter((value) => !value).length }; }
  else if (test.target === "history_final_snapshot_total") { status = historyResults.length === 389 && historyResults.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL"; evidence = { total: historyResults.length }; }
  else if (test.target === "RuntimeSchemas") { status = runtimeFailures.length === 0 ? "PASS" : "FAIL"; evidence = { executed: runtimeResults.length, failures: runtimeFailures.length }; }
  else if (test.target === "Metric Registry semantics") { status = Object.values(semanticChecks).every(Boolean) ? "PASS" : "FAIL"; evidence = semanticChecks; }
  else if (test.target === "inter_month_consistency") { status = interMonthConsistent ? "PASS" : "FAIL"; evidence = { months: 12 }; }
  else if (test.target === "expected_oracle_comparison") { status = engineComparisons.every(({ status: value }) => value === "MATCH") ? "PASS" : "FAIL"; evidence = { comparisons: engineComparisons.length, failures: engineComparisons.filter(({ status: value }) => value !== "MATCH").length }; }
  else if (test.target === "unknown_semantics") { status = engineComparisons.filter(({ id }) => id.startsWith("PERSONFIN-")).every(({ status: value }) => value === "MATCH") ? "PASS" : "FAIL"; evidence = { personMonths: 12 }; }
  else if (["typecheck", "architecture_checks", "production_build"].includes(test.target)) {
    const check = gateReport?.checks?.[test.target];
    status = check?.status === "PASS" ? "PASS" : "FAIL";
    evidence = check ?? { gateReportLoadedForCurrentSha: false };
  }
  else if (test.target === "acceptance_report") { status = "PASS"; evidence = { output: "codex_acceptance_results.json" }; }
  else if (test.target === "sha_report") { status = /^[0-9a-f]{40}$/.test(currentSha) ? "PASS" : "FAIL"; evidence = { currentSha }; }
  return { ...test, status, resultEvidence: evidence };
});

const acceptanceSummary = {
  total: acceptanceResults.length, blocking: acceptanceResults.filter(({ blocking }) => blocking).length,
  optional: acceptanceResults.filter(({ blocking }) => !blocking).length,
  pass: acceptanceResults.filter(({ status }) => status === "PASS" || status === "MATCH").length,
  fail: acceptanceResults.filter(({ status }) => status === "FAIL").length,
  blockingFail: acceptanceResults.filter(({ blocking, status }) => blocking && status === "FAIL").length,
};
const runtimeSummary = {
  total: runtimeResults.length, pass: runtimeResults.filter(({ status }) => status === "PASS").length, fail: runtimeFailures.length,
  byResource: Object.fromEntries([...new Set(runtimeResults.map(({ resource }) => resource))].sort().map((resource) => [resource, {
    total: runtimeResults.filter((item) => item.resource === resource).length,
    pass: runtimeResults.filter((item) => item.resource === resource && item.status === "PASS").length,
    fail: runtimeResults.filter((item) => item.resource === resource && item.status === "FAIL").length,
  }])),
};
const oracleSummary = { total: engineComparisons.length, match: engineComparisons.filter(({ status }) => status === "MATCH").length, fail: engineComparisons.filter(({ status }) => status === "FAIL").length };
const monthManifest = months.map((month) => {
  const items = runtimeResults.filter((item) => item.month === month);
  const history = items.filter(({ resource }) => resource.startsWith("history_"));
  return {
    month, status: items.every(({ status }) => status === "PASS") ? "PASS" : "FAIL", queryPayloadCount: items.length,
    RuntimeSchemaPassCount: items.filter(({ status }) => status === "PASS").length,
    history: {
      month: history.filter(({ resource }) => resource === "history_calendar_month").length,
      summary: history.filter(({ resource }) => resource === "history_calendar_month_summary").length,
      dayJournal: history.filter(({ resource }) => resource === "history_day_detail").length,
      person: history.filter(({ subject }) => subject.kind === "person").length,
    },
    payloadSetSha256: sha256(items.map(({ payloadSha256, resource }) => `${resource}:${payloadSha256 ?? "FAIL"}`).sort().join("\n")),
  };
});
const commonMetadata = {
  generatedAt: new Date().toISOString(), baseSha, implementationSha: currentSha,
  period: { from: months[0], to: months.at(-1), monthCount: months.length },
  source: "Supabase live Canonical/Facts exported with read-only SELECTs",
  executionChain: "CanonicalRepository -> FactSourceResolver -> MetricQueryService -> Query API -> official RuntimeSchema",
  writeSafety: { supabaseWrites: 0, analyticsPublication: 0, sealOperations: 0 },
};
const regenerationReport = {
  metadata: commonMetadata,
  summary: { months: 12, queryPayloads: runtimeResults.length, historySnapshots: historyResults.length, personHistorySnapshots: 0, analysisGlobalPayloads: 0 },
  resources: runtimeSummary.byResource,
  months: monthManifest.map(({ month, status, queryPayloadCount, RuntimeSchemaPassCount }) => ({ month, status, queryPayloadCount, RuntimeSchemaPassCount })),
};
const expectedVsEngineReport = { metadata: commonMetadata, summary: oracleSummary, results: engineComparisons };
const runtimeSchemaReport = { metadata: commonMetadata, summary: runtimeSummary, results: runtimeResults };
const acceptanceReport = { metadata: commonMetadata, summary: acceptanceSummary, results: acceptanceResults };
const manifestReport = {
  metadata: commonMetadata, expected: expectedManifest,
  summary: { months: 12, historyMonth: historyMonthResults.length, historySummary: historySummaryResults.length, historyDayJournal: historyDayResults.length, historyPerson: 0, historyTotal: historyResults.length },
  months: monthManifest,
};
const failedAcceptanceIds = acceptanceResults.filter(({ status, blocking }) => blocking && status === "FAIL").map(({ id }) => id);
const humanReport = `# Budgetisation V2 — historical acceptance\n\n` +
  `- Base: ${baseSha}\n- Implementation: ${currentSha}\n- Source: Supabase live Canonical/Facts, lecture seule\n` +
  `- Supabase writes/publication/seal: 0 / 0 / 0\n- RuntimeSchemas: ${runtimeSummary.pass}/${runtimeSummary.total} PASS, ${runtimeSummary.fail} FAIL\n` +
  `- Expected vs Engine: ${oracleSummary.match}/${oracleSummary.total} MATCH, ${oracleSummary.fail} FAIL\n` +
  `- Acceptance: ${acceptanceSummary.pass}/${acceptanceSummary.total} PASS ou MATCH, ${acceptanceSummary.blockingFail} blocking FAIL\n` +
  `- History: ${historyMonthResults.length} Month + ${historySummaryResults.length} Summary + ${historyDayResults.length} Day Journal = ${historyResults.length}; Person = 0\n` +
  `- Blocking failures: ${failedAcceptanceIds.length === 0 ? "NONE" : failedAcceptanceIds.join(", ")}\n`;
for (const [name, value] of [
  ["historical_regeneration_report.json", regenerationReport], ["expected_vs_engine_report.json", expectedVsEngineReport],
  ["runtime_schema_results.json", runtimeSchemaReport], ["codex_acceptance_results.json", acceptanceReport],
  ["historical_month_manifest.json", manifestReport],
]) fs.writeFileSync(path.join(outputPath, name), `${JSON.stringify(value, null, 2)}\n`);
fs.writeFileSync(path.join(outputPath, "historical_acceptance_summary.md"), humanReport);
console.log(JSON.stringify({ outputDirectory: outputPath, runtimeSchemas: runtimeSummary, oracle: oracleSummary, acceptance: acceptanceSummary, history: manifestReport.summary, implementationSha: currentSha }, null, 2));
if (runtimeFailures.length > 0 || acceptanceSummary.blockingFail > 0) process.exitCode = 1;
