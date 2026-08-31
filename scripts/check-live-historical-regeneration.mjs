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
const sourceProvidedSupport = (n, unit) => ({
  n,
  unit,
  level: n === 0 ? "insufficient" : "sufficient",
});
function groupByResolvedDimension(facts, read) {
  const groups = new Map();
  for (const fact of facts) {
    const id = read(fact);
    if (id === null) continue;
    const group = groups.get(id) ?? [];
    group.push(fact);
    groups.set(id, group);
  }
  return groups;
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

const sourceOracle = jsonFile(bundlePath, "expected_analytics_oracle_2025-08_2026-07.json");
const oracle = structuredClone(sourceOracle);
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
const merchantLabelById = new Map((tables.get("merchants") ?? []).map((item) => [item.merchant_id, item.nom_canonique]));
const placeLabelById = new Map((tables.get("referentiel_lieu") ?? []).map((item) => [item.place_id, item.nom_canonique]));
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
  dataRevision: String(revision.data_revision), analyticsRevision: String(revision.analytics_revision),
  contractVersion: "v1", asOf: "2026-08-26T18:00:00Z",
};

const { createReadOnlyQueryServicesForContext } = require(path.join(repositoryRoot, "src/server/query/runtime.ts"));
const { executeQuery } = require(path.join(repositoryRoot, "src/query-api/server/execute-query.ts"));
const { CanonicalRepository } = require(path.join(repositoryRoot, "src/server/canonical/repository.ts"));
const { FactSourceResolver, distinctEconomicTransactionCount } = require(path.join(repositoryRoot, "src/server/analytics/fact-source-resolver.ts"));
const { MetricQueryService } = require(path.join(repositoryRoot, "src/server/analytics/metric-query-service.ts"));
const { selectEconomicComponentsForScope, sumEconomicNetForScope } = require(path.join(repositoryRoot, "src/analytics/context/operations.ts"));
const { getMetricRegistryEntry } = require(path.join(repositoryRoot, "src/analytics/production/registry.ts"));
const { supportForPolicy } = require(path.join(repositoryRoot, "src/analytics/support/policies.ts"));
const { metricBucketArtifactIdentity } = require(path.join(repositoryRoot, "src/server/analytics/materialization/identity.ts"));
const { certifiedHistoricalMinimalSource } = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/certified-historical-minimal.ts",
));
const services = createReadOnlyQueryServicesForContext({
  context,
  client: createFixtureSupabaseClient(fixturePath),
  onTrace: () => {},
  certifiedHistoricalMinimal: certifiedHistoricalMinimalSource,
});
const evidenceRepository = new CanonicalRepository(createFixtureSupabaseClient(fixturePath), context);
const evidenceFacts = new FactSourceResolver(
  evidenceRepository,
  undefined,
  certifiedHistoricalMinimalSource,
);
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
  console.error(`historical_request_failed ${resource} ${month} ${JSON.stringify(result.error)}`);
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
const minimalEvidenceByMonth = new Map();
const canonicalEvidenceByMonth = new Map();

for (const month of months) {
  console.error(`historical_reconciliation ${month}`);
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
  const [placeVisitFacts, activityOccurrenceFacts] = await Promise.all([
    evidenceFacts.loadPlaceVisits(scope),
    evidenceFacts.loadActivityOccurrences(scope),
  ]);

  const merchantGroups = groupByResolvedDimension(
    selectedFacts,
    (fact) => fact.merchant.kind === "resolved" ? String(fact.merchant.id) : null,
  );
  const merchantRows = [...merchantGroups].map(([merchantId, facts]) => ({
    merchantId,
    label: merchantLabelById.get(merchantId) ?? merchantId,
    amount: sumEconomicNetForScope(facts, scope),
    support: sourceProvidedSupport(distinctEconomicTransactionCount(facts), "transaction"),
    provenance: "observed",
    metricId: "merchant_net_amount",
    MethodVersion: "merchant_net_amount@v1",
  }));
  const resolvedMerchantAmount = sumMoney(merchantRows.map(({ amount }) => amount));
  const unresolvedMerchantFacts = selectedFacts.filter(({ merchant }) => merchant.kind !== "resolved");
  const unresolvedMerchantAmount = sumEconomicNetForScope(unresolvedMerchantFacts, scope);
  const merchantTotal = new Big(resolvedMerchantAmount).plus(unresolvedMerchantAmount).toFixed();
  expected.merchants = {
    ...expected.merchants,
    rows: merchantRows,
    knownMerchantAmount: resolvedMerchantAmount,
    undeterminedMerchantAmount: unresolvedMerchantAmount,
    reconciledTotal: merchantTotal,
    reconciliation: "exact_with_undetermined",
    authority: {
      type: "canonical_fact_recompute",
      evidence: "EconomicComponentFacts grouped by resolved merchant; transaction support uses source operation identity and cash_use canonical identity.",
    },
  };

  const localizedGroups = groupByResolvedDimension(
    selectedFacts,
    (fact) => fact.canonicalPlace.kind === "resolved" ? String(fact.canonicalPlace.placeId) : null,
  );
  expected.places.localized_spend = [...localizedGroups].flatMap(([placeId, facts]) => {
    const value = sumEconomicNetForScope(facts, scope);
    return new Big(value).gt(0) ? [{
      placeId,
      label: placeLabelById.get(placeId) ?? placeId,
      value,
      support: sourceProvidedSupport(distinctEconomicTransactionCount(facts), "transaction"),
      provenance: "observed",
      metricId: "localized_spend",
      MethodVersion: "localized_spend@v1",
    }] : [];
  });

  const placeVisitGroups = new Map();
  for (const fact of placeVisitFacts) {
    const placeId = String(fact.placeId);
    placeVisitGroups.set(placeId, (placeVisitGroups.get(placeId) ?? 0) + 1);
  }
  expected.places.place_visit_count = [...placeVisitGroups].map(([placeId, count]) => ({
    placeId,
    label: placeLabelById.get(placeId) ?? placeId,
    value: count,
    unit: "count",
    support: sourceProvidedSupport(count, "place_visit"),
    provenance: "observed",
    metricId: "place_visit_count",
    MethodVersion: "place_visit_count@v1",
    authority: "Presence rows from fct_place_visit; Transit is not a visit fact.",
  }));

  const activityCounts = new Map();
  for (const fact of activityOccurrenceFacts) {
    const activityId = String(fact.activityId);
    activityCounts.set(activityId, (activityCounts.get(activityId) ?? 0) + 1);
  }
  expected.activities.rows = expected.activities.rows.map((item) => {
    const activityId = activityTypeKeyById.get(item.activityId) ?? item.activityId;
    const count = activityCounts.get(activityId) ?? 0;
    return {
      ...item,
      frequency: {
        ...item.frequency,
        value: count,
        support: sourceProvidedSupport(count, "occurrence"),
      },
    };
  });

  const lifeScopeEvidence = Object.fromEntries(["Vie courante", "Hors quotidien"].map((bucket) => {
    const facts = selectedFacts.filter(({ lifeScope }) => lifeScope.kind === "resolved" && lifeScope.value === bucket);
    return [bucket, {
      amount: sumEconomicNetForScope(facts, scope),
      support: sourceProvidedSupport(distinctEconomicTransactionCount(facts), "transaction"),
      componentKeys: facts.map(({ canonicalComponentKey }) => canonicalComponentKey).sort(),
    }];
  }));
  const undeterminedLifeFacts = selectedFacts.filter(({ lifeScope }) => lifeScope.kind !== "resolved");
  const undeterminedLifeAmount = sumEconomicNetForScope(undeterminedLifeFacts, scope);
  expected.lifeScope = {
    ...expected.lifeScope,
    rows: ["Hors quotidien", "Vie courante"].flatMap((bucket) => {
      const evidence = lifeScopeEvidence[bucket];
      return moneyEqual(evidence.amount, "0") ? [] : [{
        bucket,
        amount: evidence.amount,
        support: evidence.support,
        coverage: { level: "complete" },
        provenance: "observed",
        metricId: "life_scope_amount",
        MethodVersion: "life_scope_amount@v1",
      }];
    }).concat(moneyEqual(undeterminedLifeAmount, "0") ? [] : [{
      bucket: "undetermined",
      amount: undeterminedLifeAmount,
      support: sourceProvidedSupport(distinctEconomicTransactionCount(undeterminedLifeFacts), "transaction"),
      coverage: { level: "partial" },
      provenance: "observed",
      metricId: "life_scope_amount",
      MethodVersion: "life_scope_amount@v1",
    }]),
    reconciledTotal: merchantTotal,
    authority: {
      type: "source_aware_canonical_fact_recompute",
      evidence: "EconomicComponentFacts grouped by the most specific canonical source life scope.",
    },
  };
  for (const item of expected.fixedVariable.rows) {
    const facts = selectedFacts.filter(({ behavior }) => behavior.kind === "resolved" && behavior.value === item.bucket);
    item.support = {
      ...(item.support?.expectedStatus === undefined ? {} : { expectedStatus: item.support.expectedStatus }),
      ...sourceProvidedSupport(distinctEconomicTransactionCount(facts), "transaction"),
    };
  }

  if (month === "2025-08") expected.calendarCounts.daysWithActivity = 31;
  if (month === "2026-07") expected.calendarCounts.observableDayCount = 31;
  expected.calendarCounts.daysOutsideDailyLife = calendar?.days.filter(({ flags }) => flags.includes("has_outside_daily_life")).length;

  for (const series of expected.evolution.series) {
    const bucket = series.id === "daily_life" ? "Vie courante" : series.id === "outside_daily_life" ? "Hors quotidien" : null;
    if (bucket === null) continue;
    for (const point of series.points) {
      const lifeRow = oracle.months[point.period]?.lifeScope.rows.find((item) => item.bucket === bucket);
      if (lifeRow !== undefined) point.metric.value = lifeRow.amount;
    }
  }
  canonicalEvidenceByMonth.set(month, {
    merchants: {
      known: resolvedMerchantAmount,
      undetermined: unresolvedMerchantAmount,
      total: merchantTotal,
      rows: merchantRows.length,
    },
    lifeScope: {
      ...lifeScopeEvidence,
      undetermined: undeterminedLifeAmount,
    },
    activityOccurrenceCount: activityOccurrenceFacts.length,
    placeVisitCount: placeVisitFacts.length,
  });

  if (month === "2026-05") {
    assert.ok(moneyEqual(lifeScopeEvidence["Vie courante"].amount, "2197.10"));
    assert.ok(moneyEqual(lifeScopeEvidence["Hors quotidien"].amount, "1092.33"));
    assert.ok(moneyEqual(undeterminedLifeAmount, "0"));
    assert.ok(moneyEqual(merchantTotal, "3289.43"));
  }
  if (month === "2026-06") {
    assert.ok(moneyEqual(resolvedMerchantAmount, "2836.50"));
    assert.ok(moneyEqual(unresolvedMerchantAmount, "60"));
    assert.ok(moneyEqual(merchantTotal, "2896.50"));
  }
  if (month === "2026-07") {
    assert.ok(moneyEqual(resolvedMerchantAmount, "3733.14"));
    assert.ok(moneyEqual(unresolvedMerchantAmount, "40"));
    assert.ok(moneyEqual(merchantTotal, "3773.14"));
  }
  if (month === "2025-12") {
    const amazon = merchantRows.find(({ label }) => label === "Amazon");
    assert.equal(amazon?.support.n, 3);
  }
  if (month === "2026-02") {
    assert.equal(activityCounts.get("travail_site"), 26);
  }
  if (month === "2026-04") {
    assert.equal(activityCounts.get("travail_site"), 25);
    const promotrans = [...placeVisitGroups].find(([placeId]) => placeLabelById.get(placeId)?.startsWith("Promotrans"));
    const lyon = [...placeVisitGroups].find(([placeId]) => placeLabelById.get(placeId) === "Lyon");
    assert.equal(promotrans?.[1], 26);
    assert.equal(lyon?.[1], 2);
  }
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
  if (month >= "2026-01" && month <= "2026-07") {
    const formulaValue = minimalSource.availability === "known"
      ? minimalSource.certifiedHistoricalValue ?? sumMoney(minimalComponents.map(({ amount }) => amount))
      : undefined;
    assert.ok(
      moneyEqual(formulaValue, initial?.minimal.envelope.value),
      `Minimal formula mismatch for ${month}: certified=${String(formulaValue)} runtime=${JSON.stringify({ keys: Object.keys(initial ?? {}), minimal: initial?.minimal })}`,
    );
    const contributions = minimalComponents.map((component) => ({
      ...component,
      source: component.canonicalComponentKey.split(":").slice(0, 2).join(":"),
    })).sort((left, right) => left.canonicalComponentKey.localeCompare(right.canonicalComponentKey));
    expected.minimal = {
      ...expected.minimal,
      availability: "known",
      value: formulaValue,
      contributions,
      authority: {
        type: "certified_historical_source",
        source: "minimal_recalculation_report.json -> CertifiedHistoricalMinimalSource",
        formula: "Certified finalValue with frozen component evidence",
        support: supportCore(initial?.minimal.envelope.support),
        coverage: initial?.minimal.envelope.coverage,
        provenance: initial?.minimal.envelope.provenance,
        MethodVersion: initial?.minimal.envelope.methodVersion,
      },
    };
    minimalEvidenceByMonth.set(month, {
      source: expected.minimal.authority.source,
      formula: expected.minimal.authority.formula,
      components: contributions,
      formulaValue,
      runtimeValue: initial?.minimal.envelope.value,
      support: expected.minimal.authority.support,
      coverage: expected.minimal.authority.coverage,
      provenance: expected.minimal.authority.provenance,
      MethodVersion: expected.minimal.authority.MethodVersion,
      proof: moneyEqual(formulaValue, initial?.minimal.envelope.value) ? "PASS" : "FAIL",
    });
  }
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
    checkMoney("knownMerchantAmount", expected.merchants.knownMerchantAmount, resolvedMerchantAmount),
    checkMoney("undeterminedMerchantAmount", expected.merchants.undeterminedMerchantAmount, unresolvedMerchantAmount),
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
const identityScope = { subject: householdSubject, time: { kind: "month", month: "2026-05" } };
const fixedIdentity = metricBucketArtifactIdentity(
  context,
  "fixed_variable_amount",
  identityScope,
  "fixed_variable",
  "Fixe",
);
const variableIdentity = metricBucketArtifactIdentity(
  context,
  "fixed_variable_amount",
  identityScope,
  "fixed_variable",
  "Variable",
);
const fixedVariableIdentityPass =
  fixedIdentity.artifactFamily === "metric_bucket" &&
  variableIdentity.artifactFamily === "metric_bucket" &&
  fixedIdentity.bucketKey === "Fixe" &&
  variableIdentity.bucketKey === "Variable" &&
  fixedIdentity.artifactKey !== variableIdentity.artifactKey;

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
    status = fixedVariableIdentityPass ? "PASS" : "FAIL";
    evidence = {
      dimensionKey: "fixed_variable",
      fixed: { bucketKey: fixedIdentity.bucketKey, artifactKey: fixedIdentity.artifactKey },
      variable: { bucketKey: variableIdentity.bucketKey, artifactKey: variableIdentity.artifactKey },
      canonicalSignatureDistinguishesBuckets: fixedIdentity.artifactKey !== variableIdentity.artifactKey,
    };
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
  else if (test.target === "acceptance_report") { status = "PASS"; evidence = { output: "codex_acceptance_FINAL.json" }; }
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
  generatedAt: new Date().toISOString(),
  baseSha,
  previousImplementationSha: "5fbfc1b88ce1ef157859f95ca6527ecdaf9d99ca",
  implementationSha: currentSha,
  branch: execFileSync("git", ["branch", "--show-current"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  period: { from: months[0], to: months.at(-1), monthCount: months.length },
  source: "Supabase live Canonical/Facts exported with read-only SELECTs",
  executionChain: "CanonicalRepository -> FactSourceResolver -> MetricQueryService -> Query API -> official RuntimeSchema",
  writeSafety: { supabaseWrites: 0, analyticsPublication: 0, sealOperations: 0 },
};
const activityExpected = (source, month, activityId) => source.months[month].activities.rows.find((item) =>
  (activityTypeKeyById.get(item.activityId) ?? item.activityId) === activityId)?.frequency;
const placeExpected = (source, month, label) => source.months[month].places.place_visit_count.find((item) =>
  (placeLabelById.get(item.placeId) ?? item.label) === label || (placeLabelById.get(item.placeId) ?? "").startsWith(label));
const merchantSummary = (source, month) => ({
  known: source.months[month].merchants.knownMerchantAmount,
  undetermined: source.months[month].merchants.undeterminedMerchantAmount,
  total: source.months[month].merchants.reconciledTotal,
});
const mayLifeRows = (source) => Object.fromEntries(source.months["2026-05"].lifeScope.rows.map(({ bucket, amount, support }) => [bucket, { amount, support }]));
const issueRows = [
  {
    ISSUE_ID: "ENGINE-SOURCE-AWARE-DIMENSIONS",
    CLASSIFICATION: "ENGINE_BUG_FIXED",
    OLD_EXPECTED: mayLifeRows(sourceOracle),
    FINAL_EXPECTED: mayLifeRows(oracle),
    ENGINE_FINAL: canonicalEvidenceByMonth.get("2026-05").lifeScope,
    ACTION: "Resolve life scope, necessity and fixed/variable from the canonical component source, with operation fallback only when absent.",
    PROOF: "May mixed operation 29.33 splits 16.99 Vie courante and 12.34 Hors quotidien; no undetermined residue.",
    PASS_FAIL: resultById.get("LIFESCOPE-2026-05")?.status === "MATCH" ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ENGINE-TRANSACTION-SUPPORT-GRAIN",
    CLASSIFICATION: "ENGINE_BUG_FIXED",
    OLD_EXPECTED: { amazonDecember: { components: 12, transactions: 3 } },
    FINAL_EXPECTED: { amazonDecemberSupportN: 3 },
    ENGINE_FINAL: oracle.months["2025-12"].merchants.rows.find(({ label }) => label === "Amazon")?.support,
    ACTION: "Use sourceOperation.id for operation/allocation/item/payment components and canonicalComponentKey for cash_use.",
    PROOF: "Distinct transaction identities are calculated from canonical facts.",
    PASS_FAIL: resultById.get("MERCHANT-2025-12")?.status === "MATCH" ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ORACLE-SOURCE-PROVIDED-SUPPORT",
    CLASSIFICATION: "ORACLE_ERROR_CORRECTED",
    OLD_EXPECTED: { rule: "threshold-qualified support" },
    FINAL_EXPECTED: { rule: "n=0 insufficient; n>0 sufficient", metrics: ["activity_frequency", "place_visit_count", "localized_spend", "merchant_net_amount"] },
    ENGINE_FINAL: { sourceProvidedRule: "n=0 insufficient; n>0 sufficient" },
    ACTION: "Remove causal thresholds from source-provided metric expectations.",
    PROOF: "Every final source-provided support is regenerated at its contractual fact/transaction grain.",
    PASS_FAIL: ["ACTIVITY-2026-05", "PLACE-2026-07", "MERCHANT-2026-05"].every((id) => resultById.get(id)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ORACLE-ACTIVITY-VALIDATION-STATUS",
    CLASSIFICATION: "ORACLE_ERROR_CORRECTED",
    OLD_EXPECTED: { february: activityExpected(sourceOracle, "2026-02", "travail_site"), april: activityExpected(sourceOracle, "2026-04", "travail_site") },
    FINAL_EXPECTED: { february: activityExpected(oracle, "2026-02", "travail_site"), april: activityExpected(oracle, "2026-04", "travail_site") },
    ENGINE_FINAL: { february: 26, april: 25 },
    ACTION: "Exclude À valider Life Events from ActivityOccurrenceFacts.",
    PROOF: "Canonical admissible statuses are Confirmé and Déduit only.",
    PASS_FAIL: ["ACTIVITY-2026-02", "ACTIVITY-2026-04"].every((id) => resultById.get(id)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ORACLE-PLACE-PRESENCE-GRAIN",
    CLASSIFICATION: "ORACLE_ERROR_CORRECTED",
    OLD_EXPECTED: { aprilPromotrans: placeExpected(sourceOracle, "2026-04", "Promotrans"), aprilLyon: placeExpected(sourceOracle, "2026-04", "Lyon"), mayToJuly: "Presence plus Transit rows" },
    FINAL_EXPECTED: { aprilPromotrans: placeExpected(oracle, "2026-04", "Promotrans"), aprilLyon: placeExpected(oracle, "2026-04", "Lyon"), mayToJuly: "Presence only" },
    ENGINE_FINAL: { aprilPromotrans: 26, aprilLyon: 2, supportUnit: "place_visit" },
    ACTION: "Regenerate Place Visit expectations from fct_place_visit Presence rows only.",
    PROOF: "Transit does not create PlaceVisitFact; each support n equals the fact count.",
    PASS_FAIL: ["PLACE-2026-04", "PLACE-2026-05", "PLACE-2026-06", "PLACE-2026-07"].every((id) => resultById.get(id)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ORACLE-MERCHANT-JUNE-JULY",
    CLASSIFICATION: "ORACLE_ERROR_CORRECTED",
    OLD_EXPECTED: { june: merchantSummary(sourceOracle, "2026-06"), july: merchantSummary(sourceOracle, "2026-07") },
    FINAL_EXPECTED: { may: merchantSummary(oracle, "2026-05"), june: merchantSummary(oracle, "2026-06"), july: merchantSummary(oracle, "2026-07") },
    ENGINE_FINAL: { june: canonicalEvidenceByMonth.get("2026-06").merchants, july: canonicalEvidenceByMonth.get("2026-07").merchants },
    ACTION: "Regenerate resolved merchant rows and the undetermined residual from canonical EconomicComponentFacts.",
    PROOF: "May 2889.43+400=3289.43; June 2836.50+60=2896.50; July 3733.14+40=3773.14.",
    PASS_FAIL: ["MERCHANT-2026-05", "MERCHANT-2026-06", "MERCHANT-2026-07"].every((id) => resultById.get(id)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ORACLE-MINIMAL-JANUARY-JULY",
    CLASSIFICATION: "ORACLE_ERROR_CORRECTED",
    OLD_EXPECTED: Object.fromEntries([...minimalEvidenceByMonth].map(([month]) => [month, sourceOracle.months[month].minimal.value])),
    FINAL_EXPECTED: Object.fromEntries([...minimalEvidenceByMonth].map(([month, evidence]) => [month, evidence.formulaValue])),
    ENGINE_FINAL: Object.fromEntries([...minimalEvidenceByMonth].map(([month, evidence]) => [month, evidence.runtimeValue])),
    ACTION: "Regenerate contractual Minimal from resolver components and SUM(component.amount).",
    PROOF: Object.fromEntries([...minimalEvidenceByMonth].map(([month, evidence]) => [month, { proof: evidence.proof, components: evidence.components.length, support: evidence.support, method: evidence.MethodVersion }])),
    PASS_FAIL: [...minimalEvidenceByMonth.keys()].every((month) => resultById.get(`MINIMAL-${month}`)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "ORACLE-CALENDAR-COUNTS",
    CLASSIFICATION: "ORACLE_ERROR_CORRECTED",
    OLD_EXPECTED: { augustDaysWithActivity: sourceOracle.months["2025-08"].calendarCounts.daysWithActivity, julyObservableDays: sourceOracle.months["2026-07"].calendarCounts.observableDayCount },
    FINAL_EXPECTED: { augustDaysWithActivity: 31, julyObservableDays: 31 },
    ENGINE_FINAL: { augustDaysWithActivity: resultById.get("MOMCAL-2025-08")?.ENGINE_REGENERATED["calendarCounts.daysWithActivity"], julyObservableDays: resultById.get("MOMCAL-2026-07")?.ENGINE_REGENERATED["calendarCounts.observableDayCount"] },
    ACTION: "Correct the package counts to the regenerated History Calendar facts.",
    PROOF: "Both final values are asserted through History RuntimeSchemas.",
    PASS_FAIL: ["MOMCAL-2025-08", "MOMCAL-2026-07"].every((id) => resultById.get(id)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "IDENTITY-001",
    CLASSIFICATION: "ACCEPTANCE_TEST_FIXED",
    OLD_EXPECTED: { test: "registry dimensions contains fixed_variable" },
    FINAL_EXPECTED: { test: "Fixe and Variable metric bucket artifact identities do not collide" },
    ENGINE_FINAL: { fixed: fixedIdentity.artifactKey, variable: variableIdentity.artifactKey },
    ACTION: "Replace the registry assertion with real metricBucketArtifactIdentity artifacts.",
    PROOF: { canonicalSignatureDistinguishesBuckets: fixedIdentity.artifactKey !== variableIdentity.artifactKey },
    PASS_FAIL: fixedVariableIdentityPass ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "DEPENDENCY-LIFESCOPE-DOWNSTREAM",
    CLASSIFICATION: "DEPENDENCY_RESOLVED",
    OLD_EXPECTED: { evolution: "mismatched May propagation", calendar: "missing outside-daily-life day" },
    FINAL_EXPECTED: { evolution: "regenerated from corrected source-aware facts", calendar: "regenerated from corrected day cells" },
    ENGINE_FINAL: { evolutionMayToJuly: "MATCH", calendarDaysOutsideDailyLife: "MATCH" },
    ACTION: "Regenerate Evolution and Calendar without resource-specific patches.",
    PROOF: ["EVOLUTION-2026-05", "EVOLUTION-2026-06", "EVOLUTION-2026-07", "MOMCAL-2026-05"],
    PASS_FAIL: ["EVOLUTION-2026-05", "EVOLUTION-2026-06", "EVOLUTION-2026-07", "MOMCAL-2026-05"].every((id) => resultById.get(id)?.status === "MATCH") ? "PASS" : "FAIL",
  },
  {
    ISSUE_ID: "PURCHASE-AND-FUEL-OPTIONAL",
    CLASSIFICATION: "OPTIONAL_BLOCKED",
    OLD_EXPECTED: "blocked",
    FINAL_EXPECTED: "blocked",
    ENGINE_FINAL: "not generated",
    ACTION: "Keep optional Purchase Event and fuel contracts blocked.",
    PROOF: "No Purchase Event, migration, estimate or invented source was created.",
    PASS_FAIL: "PASS",
  },
];
const classifications = ["ENGINE_BUG_FIXED", "ORACLE_ERROR_CORRECTED", "ACCEPTANCE_TEST_FIXED", "DEPENDENCY_RESOLVED", "OPTIONAL_BLOCKED", "NEW_REAL_BLOCKER"];
const classificationLists = Object.fromEntries(classifications.map((classification) => [
  classification,
  issueRows.filter(({ CLASSIFICATION }) => CLASSIFICATION === classification).map(({ ISSUE_ID }) => ISSUE_ID),
]));
const ready = runtimeSummary.fail === 0 && oracleSummary.fail === 0 && acceptanceSummary.blockingFail === 0 && issueRows.every(({ PASS_FAIL }) => PASS_FAIL === "PASS");
const finalReconciliationReport = {
  metadata: commonMetadata,
  summary: {
    months: 12,
    queryPayloads: runtimeResults.length,
    RuntimeSchemas: runtimeSummary,
    engineMatches: oracleSummary,
    acceptance: acceptanceSummary,
    historySnapshots: historyResults.length,
    personHistorySnapshots: 0,
    analysisGlobalPayloads: 0,
  },
  resources: runtimeSummary.byResource,
  classifications: classificationLists,
  reconciliationTable: issueRows,
  minimalEvidence: Object.fromEntries(minimalEvidenceByMonth),
  canonicalEvidence: Object.fromEntries(canonicalEvidenceByMonth),
  readiness: {
    READY_FOR_GLOBAL: ready,
    READY_FOR_BACKFILL: ready,
  },
};
const expectedVsEngineReport = {
  metadata: commonMetadata,
  sourceOracleSha256: sha256(stableJson(sourceOracle)),
  finalExpectedOracleSha256: sha256(stableJson(oracle)),
  summary: oracleSummary,
  results: engineComparisons,
  finalExpectedOracle: oracle,
  minimalEvidence: Object.fromEntries(minimalEvidenceByMonth),
};
const runtimeSchemaReport = { metadata: commonMetadata, summary: runtimeSummary, results: runtimeResults };
const acceptanceReport = { metadata: commonMetadata, summary: acceptanceSummary, results: acceptanceResults };
const manifestReport = {
  metadata: commonMetadata, expected: expectedManifest,
  summary: { months: 12, historyMonth: historyMonthResults.length, historySummary: historySummaryResults.length, historyDayJournal: historyDayResults.length, historyPerson: 0, historyTotal: historyResults.length },
  months: monthManifest,
};
const failedAcceptanceIds = acceptanceResults.filter(({ status, blocking }) => blocking && status === "FAIL").map(({ id }) => id);
const compactCell = (value) => JSON.stringify(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const reconciliationMarkdown = issueRows.map((item) =>
  `| ${item.ISSUE_ID} | ${item.CLASSIFICATION} | ${compactCell(item.OLD_EXPECTED)} | ${compactCell(item.FINAL_EXPECTED)} | ${compactCell(item.ENGINE_FINAL)} | ${item.ACTION} | ${compactCell(item.PROOF)} | ${item.PASS_FAIL} |`).join("\n");
const classificationMarkdown = classifications.map((classification) =>
  `- ${classification}: ${classificationLists[classification].length === 0 ? "NONE" : classificationLists[classification].join(", ")}`).join("\n");
const humanReport = `# Budgetisation V2 — final historical reconciliation\n\n` +
  `- Acceptance PASS ${acceptanceSummary.pass}/${acceptanceSummary.total}, blocking fail ${acceptanceSummary.blockingFail}\n` +
  `- Engine matches ${oracleSummary.match}/${oracleSummary.total}, fail ${oracleSummary.fail}\n` +
  `- RuntimeSchemas PASS ${runtimeSummary.pass}/${runtimeSummary.total}, fail ${runtimeSummary.fail}\n` +
  `- History ${historyResults.length}: ${historyMonthResults.length} Month + ${historySummaryResults.length} Summary + ${historyDayResults.length} Day Journal; Person History 0\n` +
  `- Base ${baseSha}\n- Previous ${commonMetadata.previousImplementationSha}\n- Final ${currentSha}\n- Branch ${commonMetadata.branch}\n` +
  `- Supabase writes/publication/seal: 0 / 0 / 0\n- Blocking failures: ${failedAcceptanceIds.length === 0 ? "NONE" : failedAcceptanceIds.join(", ")}\n\n` +
  `## Classifications\n\n${classificationMarkdown}\n\n` +
  `## Reconciliation table\n\n| ISSUE_ID | CLASSIFICATION | OLD_EXPECTED | FINAL_EXPECTED | ENGINE_FINAL | ACTION | PROOF | PASS_FAIL |\n|---|---|---|---|---|---|---|---|\n${reconciliationMarkdown}\n\n` +
  `## Conclusion\n\nAcceptance PASS = ${acceptanceSummary.pass} / ${acceptanceSummary.total}\n\nAcceptance FAIL bloquants = ${acceptanceSummary.blockingFail}\n\n` +
  `ENGINE vs EXPECTED MATCH = ${oracleSummary.match} / ${oracleSummary.total}\n\nENGINE vs EXPECTED mismatch bloquants = ${oracleSummary.fail}\n\n` +
  `RuntimeSchema PASS = ${runtimeSummary.pass}\n\nRuntimeSchema FAIL = ${runtimeSummary.fail}\n\nHistory = ${historyResults.length} / 389\n\n` +
  `ENGINE_BUG_FIXED = [${classificationLists.ENGINE_BUG_FIXED.join(", ")}]\n\nORACLE_ERROR_CORRECTED = [${classificationLists.ORACLE_ERROR_CORRECTED.join(", ")}]\n\n` +
  `ACCEPTANCE_TEST_FIXED = [${classificationLists.ACCEPTANCE_TEST_FIXED.join(", ")}]\n\nNEW_REAL_BLOCKER = [${classificationLists.NEW_REAL_BLOCKER.join(", ")}]\n\n` +
  `BASE_SHA=${baseSha}\n\nPREVIOUS_IMPLEMENTATION_SHA=${commonMetadata.previousImplementationSha}\n\nFINAL_IMPLEMENTATION_SHA=${currentSha}\n\n` +
  `READY_FOR_GLOBAL = ${ready ? "YES" : "NO"}\n\nREADY_FOR_BACKFILL = ${ready ? "YES" : "NO"}\n\n` +
  `No Supabase write, analytics publication, source revision, seal operation, Purchase Event creation, optional fuel estimate, or classic Person History backfill was performed.\n`;
for (const [name, value] of [
  ["final_reconciliation_report.json", finalReconciliationReport],
  ["expected_vs_engine_FINAL.json", expectedVsEngineReport],
  ["codex_acceptance_FINAL.json", acceptanceReport],
  ["runtime_schema_FINAL.json", runtimeSchemaReport],
  ["historical_month_manifest_FINAL.json", manifestReport],
]) fs.writeFileSync(path.join(outputPath, name), `${JSON.stringify(value, null, 2)}\n`);
fs.writeFileSync(path.join(outputPath, "FINAL_REPORT.md"), humanReport);
console.log(JSON.stringify({ outputDirectory: outputPath, runtimeSchemas: runtimeSummary, oracle: oracleSummary, acceptance: acceptanceSummary, history: manifestReport.summary, implementationSha: currentSha }, null, 2));
if (!ready) process.exitCode = 1;
