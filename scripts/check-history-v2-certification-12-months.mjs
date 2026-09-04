import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import Big from "big.js";
import ts from "typescript";

import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";
import { assertCurrentMinimalCertification, currentMinimalEvidenceFile } from "./lib/history-v2-current-minimal-evidence.mjs";

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
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
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

const [fixtureDirectory, oracleReportFile, outputDirectory] = process.argv.slice(2);
const publicationOnly = process.argv.slice(5).includes("--publication-only");
const selectedMonth = process.argv.slice(5).find((arg) => arg.startsWith("--month="))?.slice(8);
if (selectedMonth !== undefined && publicationOnly) throw new Error("Single-month rebuild requires full invariant certification.");
if (fixtureDirectory === undefined || oracleReportFile === undefined || outputDirectory === undefined) {
  throw new Error("Usage: node scripts/check-history-v2-certification-12-months.mjs <fixture-directory> <expected-vs-engine-final.json> <output-directory>");
}
const fixturePath = path.resolve(fixtureDirectory);
const oraclePath = path.resolve(oracleReportFile);
const outputPath = path.resolve(outputDirectory);
fs.mkdirSync(outputPath, { recursive: true });

const materialization = require(path.join(repositoryRoot, "src/server/analytics/materialization/history-v2.ts"));
const monthlyEngines = require(path.join(repositoryRoot, "src/server/analytics/history-v2-monthly-engines.ts"));
const { CanonicalRepository } = require(path.join(repositoryRoot, "src/server/canonical/repository.ts"));
const { FactSourceResolver } = require(path.join(repositoryRoot, "src/server/analytics/fact-source-resolver.ts"));
const { execFileSync } = require("node:child_process");
const implementationFiles = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--",
  "src/analytics", "src/core", "src/query-api", "src/server/analytics", "src/server/canonical", "scripts/check-history-v2-certification-12-months.mjs",
  "package.json", "package-lock.json", "pnpm-lock.yaml", "tsconfig.json",
], { cwd: repositoryRoot, encoding: "utf8" }).trim().split(/\r?\n/u))].filter((file) => fs.existsSync(path.join(repositoryRoot, file))).sort();
const { scopedMetricReadModel } = require(path.join(repositoryRoot, "src/server/analytics/metric-query-service.ts"));
const { parseActivityCausalFinancialLinks } = require(path.join(repositoryRoot, "src/analytics/facts/index.ts"));
const calendar = require(path.join(repositoryRoot, "src/analytics/history-v2/calendar/index.ts"));
const daily = require(path.join(repositoryRoot, "src/analytics/history-v2/daily-finance/index.ts"));
const historyAnalytics = require(path.join(repositoryRoot, "src/analytics/history-v2/index.ts"));
const balance = require(path.join(repositoryRoot, "src/analytics/history-v2/month-balance/index.ts"));
const historyCore = require(path.join(repositoryRoot, "src/core/history-v2/index.ts"));
const historyQuery = require(path.join(repositoryRoot, "src/query-api/history-v2/index.ts"));
const query = require(path.join(repositoryRoot, "src/query-api/index.ts"));
const time = require(path.join(repositoryRoot, "src/core/time/index.ts"));
const { selectEconomicComponentsForScope } = require(path.join(repositoryRoot, "src/analytics/context/index.ts"));

const tables = loadFixtureTables(fixturePath);
const one = (table, predicate) => (tables.get(table) ?? []).find(predicate);
const oracleReport = JSON.parse(fs.readFileSync(oraclePath, "utf8"));
const oracleMonths = oracleReport.finalExpectedOracle.months;
const months = Object.freeze([
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
]);
assert.deepEqual(months, [
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
]);
assert.deepEqual(Object.keys(oracleMonths).sort(), months, "L'oracle EXPECTED doit couvrir exactement la fenêtre certifiée.");
if (selectedMonth !== undefined) assert.ok(months.includes(selectedMonth), "Month outside the supported certified History window.");
const fixtureHouseholds = tables.get("households") ?? [];
assert.equal(fixtureHouseholds.length, 1, "La fixture History V2 doit contenir un unique Household cible.");
const householdId = fixtureHouseholds[0].household_id;
assert.equal(
  oracleReport.finalExpectedOracle.metadata.householdId,
  householdId,
  "L'oracle EXPECTED doit décrire le Household de la fixture, sans le sélectionner.",
);
const household = one("households", (row) => row.household_id === householdId);
const revision = one("household_revisions", (row) => row.household_id === householdId);
assert.ok(household && revision, "Household/revision fixture absente.");
for (const [option, actual] of [["--household=", householdId], ["--source-revision=", String(revision.data_revision)]]) {
  const expected = process.argv.slice(5).find((arg) => arg.startsWith(option))?.slice(option.length);
  if (selectedMonth !== undefined) assert.equal(expected, actual, `Single-month producer ${option} mismatch`);
}
const persons = (tables.get("persons") ?? [])
  .filter((row) => row.household_id === householdId)
  .map((row) => ({
    personId: row.person_id,
    householdId: row.household_id,
    displayName: row.display_name,
    status: row.status,
  }))
  .sort((left, right) => left.personId.localeCompare(right.personId));
const periods = (tables.get("analysis_periods") ?? [])
  .filter((row) => row.household_id === householdId)
  .map((row) => ({
    analysisPeriodId: row.analysis_period_id,
    householdId: row.household_id,
    month: row.month,
    financeStatus: row.finance_status,
    lifeStatus: row.life_status,
    locationStatus: row.location_status,
    calendarStatus: row.calendar_status,
    isClosed: row.is_closed,
    sourceRevision: String(row.source_revision),
  }));
const runtimeContext = {
  userId: "history-v2-read-only-certification",
  householdId,
  persons,
  personIds: persons.map(({ personId }) => personId),
  timezone: household.timezone,
  periods,
  dataRevision: String(revision.data_revision),
  analyticsRevision: String(revision.analytics_revision),
  contractVersion: "v1",
  asOf: "2026-08-31T12:00:00Z",
};
const repository = new CanonicalRepository(createFixtureSupabaseClient(fixturePath), runtimeContext);
const factResolver = new FactSourceResolver(repository);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const stableJson = (value) => JSON.stringify(stable(value));
const implementation = {
  status: "KNOWN",
  gitSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  digest: sha256(stableJson(implementationFiles.map((file) => ({ file, digest: sha256(fs.readFileSync(path.join(repositoryRoot, file), "utf8").replaceAll("\r\n", "\n")) })))),
};
const sourceRef = (kind, id) => ({ kind, id: String(id) });
const target = (resource, params) => ({ resource, params });
const visibleKnown = (value) => ({ visibility: "VISIBLE", data: { status: "KNOWN", value } });
const knownCollection = (items) => ({
  visibility: "VISIBLE",
  data: { status: "KNOWN", items, totalCount: items.length },
});
const zero = "0";
const money = (value) => new Big(String(value ?? 0)).toFixed();
const sumMoney = (values) => values.reduce((sum, value) => sum.plus(String(value)), new Big(0)).toFixed();
const absMoney = (value) => new Big(String(value)).abs().toFixed();
const moneyClose = (left, right, tolerance = "0.01") => new Big(String(left)).minus(String(right)).abs().lte(tolerance);
const daysBetween = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
const rangeFor = (month) => ({
  start: time.parseLocalDate(`${month}-01`),
  endExclusive: time.parseLocalDate(`${time.addMonths(month, 1)}-01`),
});
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
const categoryLabels = new Map((tables.get("categories") ?? []).map((row) => [row.category_id, row.nom_canonique]));
const subcategoryLabels = new Map((tables.get("subcategories") ?? []).map((row) => [row.subcategory_id, row.nom_canonique]));
const merchantLabels = new Map((tables.get("merchants") ?? []).map((row) => [row.merchant_id, row.nom_canonique]));
const placeLabels = new Map((tables.get("referentiel_lieu") ?? []).map((row) => [row.place_id, row.nom_canonique]));
const personDirectory = persons.map(({ personId, displayName }) => ({
  personId,
  displayInitial: String(displayName ?? "?").slice(0, 1).toUpperCase(),
  label: String(displayName ?? personId),
  sourceRefs: [sourceRef("person", personId)],
}));

const artifactMonths = ["2025-07", ...months, "2026-08"];
const calendarArtifacts = [];
const dailyArtifacts = [];
for (const month of artifactMonths) {
  console.error(`history_v2_artifacts ${month}`);
  const ledger = await monthlyEngines.buildDailyEconomicLedgerMonthFromCanonical(repository, month);
  dailyArtifacts.push(ledger);
  calendarArtifacts.push(await monthlyEngines.buildCalendarCentricMonthFromCanonical(repository, month, ledger));
}
const calendarByMonth = new Map(calendarArtifacts.map((artifact) => [artifact.month, artifact]));
const dailyByMonth = new Map(dailyArtifacts.map((artifact) => [artifact.month, artifact]));

function factValue(fact, key) {
  const value = fact[key];
  return value?.kind === "resolved" ? value.value ?? value.id : undefined;
}
function categoryOf(fact) {
  return fact.category.kind === "resolved" ? String(fact.category.id) : undefined;
}
function subcategoryOf(fact) {
  return fact.subcategory.kind === "resolved" ? String(fact.subcategory.id) : "__UNDETERMINED__";
}
function sourceOperationOf(fact) {
  return fact.sourceOperation.kind === "resolved" ? String(fact.sourceOperation.id) : undefined;
}
function canonicalPlaceOf(fact) {
  return fact.canonicalPlace.kind === "resolved" ? String(fact.canonicalPlace.placeId) : undefined;
}
function componentDate(ledger, componentKey) {
  const event = ledger.expenseEvents.find((candidate) => candidate.componentKeys.includes(componentKey));
  return event?.effectiveEconomicDate.status === "KNOWN" ? event.effectiveEconomicDate.value : undefined;
}
function calendarMomentItemId(artifact, momentId) {
  if (artifact.items.status !== "KNOWN" && artifact.items.status !== "PARTIAL") return undefined;
  return artifact.items.items.find((item) => item.sourceRefs.includes(`moment:${momentId}`))?.calendarItemId;
}
function expenseDescriptorsFor(month, facts, ledger, operations, momentRelations, calendarArtifact) {
  const operationById = new Map(operations.map((row) => [String(row.operation_id), row]));
  const momentCosts = [...new Set(momentRelations.map(({ momentId }) => momentId))].map((momentId) => ({
    owner: calendarMomentItemId(calendarArtifact, momentId),
    resolved: historyAnalytics.resolveMomentFinancialCost({ householdId, momentId, relations: momentRelations }),
  }));
  return ledger.expenseEvents.map((event) => {
    const componentFacts = facts.filter((fact) => event.componentKeys.includes(String(fact.canonicalComponentKey)));
    const operation = componentFacts.map(sourceOperationOf).flatMap((id) => id === undefined ? [] : [operationById.get(id)]).find(Boolean);
    const merchantId = componentFacts.map((fact) => factValue(fact, "merchant")).find(Boolean);
    const owners = momentCosts.filter(({ owner, resolved }) => owner !== undefined
      && historyAnalytics.isWhollyCausalMomentExpense({ componentKeys: event.componentKeys, amount: event.economicAmount }, resolved));
    return {
      expenseEventId: event.expenseEventId,
      label: String(operation?.description_precise ?? operation?.libelle_bancaire ?? "Dépense économique"),
      sourceRefs: event.componentKeys.map((id) => sourceRef("economic_component", id)),
      ...(owners.length !== 1 ? {} : { narrativeOwnerId: owners[0].owner }),
      ...(merchantId === undefined ? {} : { merchantLabel: merchantLabels.get(String(merchantId)) ?? String(merchantId) }),
    };
  });
}
function groupFactsAmount(facts, readKey) {
  const result = new Map();
  for (const fact of facts) {
    const key = readKey(fact);
    if (key === undefined) continue;
    result.set(key, sumMoney([result.get(key) ?? zero, fact.net]));
  }
  return result;
}
function spendingComponents(data) {
  return historyAnalytics.projectHistorySpendingComponents(data.facts, data.classifications);
}
function bridgeFor(month, facts, operations, actual) {
  const bankByOperation = new Map();
  for (const row of operations) {
    if (String(row.date_bancaire).slice(0, 7) !== month) continue;
    const amount = new Big(String(row.montant_bancaire_depense ?? 0));
    if (amount.gt(0)) bankByOperation.set(String(row.operation_id), amount.toFixed());
  }
  const economicByOperation = groupFactsAmount(facts, sourceOperationOf);
  const operationIds = [...new Set([...bankByOperation.keys(), ...economicByOperation.keys()])].sort();
  const lines = operationIds.flatMap((operationId) => {
    const bank = bankByOperation.get(operationId) ?? zero;
    const economic = economicByOperation.get(operationId) ?? zero;
    const signedAmount = new Big(economic).minus(bank).toFixed();
    if (new Big(signedAmount).eq(0)) return [];
    const kind = new Big(bank).eq(0)
      ? "ECONOMIC_EXPENSE_WITHOUT_BANK_OUTFLOW"
      : new Big(economic).eq(0)
        ? "BANK_OUTFLOW_EXCLUDED"
        : "TIMING_REALLOCATION";
    const sourceRefs = [
      `operation:${operationId}`,
      ...facts.filter((fact) => sourceOperationOf(fact) === operationId).map((fact) => String(fact.canonicalComponentKey)),
    ];
    return [{ lineId: `operation:${operationId}`, kind, label: "Réconciliation canonique", signedAmount, sourceRefs }];
  });
  return balance.buildBankEconomyBridge({
    bankOutflows: sumMoney([...bankByOperation.values()]),
    actual,
    lines,
    linesComplete: true,
  });
}
function minimalFamily(componentKey) {
  if (componentKey.startsWith("minimal:provision:")) return "PROVISIONS";
  if (componentKey.startsWith("minimal:need:")) return "VARIABLES_INDISPENSABLES";
  if (componentKey.startsWith("minimal:conditional:")) return "BESOINS_CONDITIONNELS";
  return "OBLIGATIONS";
}
function pivotMonthIds(typicalCategory) {
  const values = typicalCategory.monthlyObservations
    .map(({ period, value }) => ({ period, value }))
    .sort((left, right) => new Big(left.value).cmp(right.value) || left.period.localeCompare(right.period));
  if (values.length === 0) return [];
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? [values[middle].period] : [values[middle - 1].period, values[middle].period];
}

const monthData = new Map();
for (const month of months) {
  console.error(`history_v2_sources ${month}`);
  const range = rangeFor(month);
  const [loadedFacts, operations, occurrences, visits, moments, classifications] = await Promise.all([
    repository.loadEconomicFacts(range),
    repository.loadOperationsByBankRange(range),
    repository.loadActivityOccurrences(range),
    repository.loadPlaceVisits(range),
    repository.loadEntityRows("moments", "moment_id"),
    repository.loadEconomicComponentClassifications(range),
  ]);
  const occurrenceIds = occurrences.map(({ lifeEventId }) => String(lifeEventId));
  const [causalLinks, lifeEventRecords] = await Promise.all([
    repository.loadActivityCausalFinancialLinkRows(occurrenceIds),
    repository.loadLifeEventRecords(occurrenceIds),
  ]);
  const primaryPlaces = lifeEventRecords.flatMap((row) => typeof row.primary_place_id === "string"
    ? [{ lifeEventId: String(row.life_event_id), placeId: row.primary_place_id }] : []);
  const activityCosts = await factResolver.loadActivityOccurrenceCosts({
    subject: { kind: "household" },
    time: { kind: "month", month },
  });
  const calendarArtifact = calendarByMonth.get(month);
  const dailyArtifact = dailyByMonth.get(month);
  assert.ok(calendarArtifact && dailyArtifact);
  const momentIds = calendarArtifact.items.status === "KNOWN" || calendarArtifact.items.status === "PARTIAL"
    ? [...new Set(calendarArtifact.items.items.flatMap(({ sourceRefs }) => sourceRefs
      .filter((ref) => ref.startsWith("moment:")).map((ref) => ref.slice("moment:".length))))] : [];
  // Causal net is not a Daily allocation: retain before/after-period components.
  const momentRelations = historyAnalytics.projectCanonicalMomentRelations(await repository.loadEconomicFactsByMomentIds(momentIds));
  const scope = { subject: { kind: "household" }, time: { kind: "month", month } };
  const amountByComponent = new Map(dailyArtifact.allocationEntries.map(({ componentKey, amount }) => [componentKey, amount]));
  const facts = selectEconomicComponentsForScope(loadedFacts, scope).map((fact) => ({
    ...fact,
    net: amountByComponent.get(String(fact.canonicalComponentKey)) ?? zero,
  }));
  const analyticsAuthority = await historyAnalytics.resolveHistoryV2BalanceAnalyticsAuthority({
    resolver: factResolver,
    month,
    categoryIds: facts.flatMap((fact) => {
      const categoryId = categoryOf(fact);
      return categoryId === undefined ? [] : [categoryId];
    }),
  });
  monthData.set(month, {
    month,
    analyticsAuthority,
    classifications,
    facts,
    operations,
    occurrences,
    visits,
    primaryPlaces,
    moments,
    causalLinks,
    activityCosts,
    momentRelations,
    canonicalMomentIds: momentIds,
    calendarArtifact,
    dailyArtifact,
    expenseDescriptors: expenseDescriptorsFor(month, facts, dailyArtifact, operations, momentRelations, calendarArtifact),
  });
}

const allExpenseDescriptors = [...new Map(
  [...monthData.values()].flatMap(({ expenseDescriptors }) => expenseDescriptors)
    .map((descriptor) => [descriptor.expenseEventId, descriptor]),
).values()];

function metricValue(value, reasonCode = "DATA_NO_SOURCE") {
  return value === undefined || value === null
    ? { status: "UNKNOWN", quality: { reasonCode } }
    : { status: "KNOWN", value: money(value) };
}
function officialMetricNode(metric) {
  return historyQuery.projectAnalysisMoneyMetric(scopedMetricReadModel(metric));
}
function balanceContext(data, resource, params) {
  const contract = query.getQueryResourceContract(resource);
  const identity = `${resource}:${data.month}:${stableJson(params)}`;
  return {
    householdId,
    month: data.month,
    resourceInputHash: historyAnalytics.computeResourceInputHash({
      identity,
      // Builder placeholder, bound to the declared inputs by the preflight seal.
      // This provisional metadata is never written to a snapshot.
      facts: [],
    }),
    policyVersions: historyCore.resolvePolicyVersions(contract.policyIds),
    capabilities: capabilities(resource),
    sourceRefs: [
      sourceRef("calendar_artifact", data.calendarArtifact.artifactInputHash),
      sourceRef("daily_ledger_artifact", data.dailyArtifact.artifactInputHash),
    ],
  };
}
function calendarContext(resource) {
  return {
    householdId,
    timeZone: runtimeContext.timezone,
    capabilities: capabilities(resource),
    calendarArtifacts,
    dailyArtifacts,
    personDirectory,
    expenseDescriptors: allExpenseDescriptors,
  };
}
function categoryState(data) {
  if (data.categoryState !== undefined) return data.categoryState;
  const actual = data.dailyArtifact.actualMonthAmount;
  const actualByCategory = groupFactsAmount(data.facts, (fact) => categoryOf(fact) ?? "__UNCLASSIFIED__");
  const typicalRows = new Map(data.analyticsAuthority.categoryTypicals.map((authority) => [authority.categoryId, {
    categoryId: authority.categoryId,
    availability: authority.metric.availability,
    typicalCategoryValue: authority.metric.value,
    monthlyObservations: authority.monthlyObservations,
  }]));
  const candidates = [...actualByCategory].map(([categoryId, amount]) => {
    const typical = typicalRows.get(categoryId);
    const delta = typical?.availability === "known"
      ? new Big(amount).minus(typical.typicalCategoryValue).toFixed()
      : undefined;
    const material = delta === undefined
      ? false
      : balance.evaluateMateriality({ delta, reference: typical.typicalCategoryValue, absoluteThreshold: "25", relativeThreshold: 0.2 }).material;
    return { categoryId, amount, material, lifecycle: "NONE", classified: categoryId !== "__UNCLASSIFIED__" };
  });
  const preview = balance.selectCategoryPreview(candidates, 8);
  const summaries = preview.selected.map((candidate) => {
    const typical = typicalRows.get(candidate.categoryId);
    const typicalValue = typical?.availability === "known"
      ? { status: "KNOWN", value: money(typical.typicalCategoryValue) }
      : { status: "UNKNOWN", quality: { reasonCode: "REFERENCE_INSUFFICIENT_SUPPORT" } };
    const deltaValue = typicalValue.status === "KNOWN"
      ? { status: "KNOWN", value: new Big(candidate.amount).minus(typicalValue.value).toFixed() }
      : { status: "UNKNOWN", quality: { reasonCode: "REFERENCE_INSUFFICIENT_SUPPORT" } };
    return {
      categoryId: candidate.categoryId,
      label: categoryLabels.get(candidate.categoryId) ?? candidate.categoryId,
      actual: { status: "KNOWN", value: candidate.amount },
      shareOfActual: new Big(actual).eq(0)
        ? { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } }
        : { status: "KNOWN", value: Number(new Big(candidate.amount).div(actual).toString()) },
      typical: typicalValue,
      delta: deltaValue,
      material: candidate.material,
      detailRef: target(query.queryResourceKeys.historyCategoryDetail, { categoryId: candidate.categoryId }),
      sourceRefs: [sourceRef("category", candidate.categoryId)],
    };
  });
  data.categoryState = { actualByCategory, typicalRows, preview, summaries };
  return data.categoryState;
}
function categoryComposition(data, categoryId) {
  const typical = categoryState(data).typicalRows.get(categoryId);
  if (typical?.availability !== "known") {
    return {
      pivotMonthIds: [],
      amountsByStableId: {},
      total: { status: "UNKNOWN", quality: { reasonCode: "REFERENCE_INSUFFICIENT_SUPPORT" } },
    };
  }
  const pivots = pivotMonthIds(typical);
  const rows = pivots.map((month) => {
    const source = monthData.get(month);
    const amountsByStableId = Object.fromEntries(
      groupFactsAmount(
        source?.facts.filter((fact) => categoryOf(fact) === categoryId) ?? [],
        subcategoryOf,
      ),
    );
    return { month, complete: true, amountsByStableId };
  });
  return balance.computeTypicalCompositionBaseline({
    pivotMonthIds: pivots,
    months: rows,
    typicalCategoryAmount: money(typical.typicalCategoryValue),
  });
}
function categoryExplanation(data, summary, composition) {
  const actualByStableId = groupFactsAmount(
    data.facts.filter((fact) => categoryOf(fact) === summary.categoryId),
    subcategoryOf,
  );
  const keys = [...new Set([...actualByStableId.keys(), ...Object.keys(composition.amountsByStableId)])].sort();
  const contributions = keys.map((stableId) => {
    const actual = actualByStableId.get(stableId) ?? zero;
    const baseline = composition.amountsByStableId[stableId] ?? { status: "KNOWN", value: zero };
    return {
      stableId,
      label: stableId === "__UNDETERMINED__" ? "Non classé" : subcategoryLabels.get(stableId) ?? stableId,
      actual,
      baseline,
      contribution: baseline.status === "KNOWN"
        ? { status: "KNOWN", value: new Big(actual).minus(baseline.value).toFixed() }
        : { status: "UNKNOWN", quality: baseline.quality ?? { reasonCode: "COVERAGE_PARTIAL" } },
    };
  });
  const delta = summary.delta.status === "KNOWN" ? summary.delta.value : zero;
  return balance.explainCategory({ categoryDelta: delta, categoryMaterial: summary.material, contributions });
}
function frequencyTicketUnknown() {
  return balance.explainFrequencyTicket({
    currentFrequency: 0,
    referenceFrequency: 0,
    currentMedianTicket: zero,
    referenceMedianTicket: zero,
    referenceMonths: 0,
    ticketSupport: 0,
    currentCoverage: 0,
  });
}
function spendingState(data) {
  if (data.spendingState !== undefined) return data.spendingState;
  data.spendingState = balance.buildSpendingAxes({
    actual: data.dailyArtifact.actualMonthAmount,
    components: spendingComponents(data),
  });
  return data.spendingState;
}
function categoryClassificationState(data, categoryId) {
  const components = spendingComponents(data).filter((component) =>
    categoryId === "__UNCLASSIFIED__"
      ? component.categoryId === undefined
      : component.categoryId === categoryId);
  return balance.buildSpendingAxes({
    actual: sumMoney(components.map(({ amount }) => amount)),
    components,
  });
}
function minimalState(data) {
  if (data.minimalState !== undefined) return data.minimalState;
  const source = data.analyticsAuthority.minimal;
  const available = source.metric.availability === "known" && source.metric.value !== null;
  const components = available
    ? source.components.map((entry) => ({
        componentId: entry.canonicalComponentKey,
        label: entry.canonicalComponentKey,
        family: minimalFamily(entry.canonicalComponentKey),
        amount: money(entry.amount),
      }))
    : [];
  data.minimalState = {
    available,
    value: available ? money(source.metric.value) : undefined,
    preview: balance.buildMinimalPreview({ minimal: available ? money(source.metric.value) : zero, components }),
  };
  return data.minimalState;
}

function expenseSummaries(data) {
  if (data.expenseSummaries !== undefined) return data.expenseSummaries;
  const descriptors = new Map(data.expenseDescriptors.map((entry) => [entry.expenseEventId, entry]));
  data.expenseSummaries = data.dailyArtifact.expenseEvents.flatMap((event) => {
    if (event.effectiveEconomicDate.status !== "KNOWN") return [];
    const descriptor = descriptors.get(event.expenseEventId);
    if (descriptor === undefined) return [];
    return [{
      expenseEventId: event.expenseEventId,
      economicDate: event.effectiveEconomicDate.value,
      label: descriptor.label,
      eventKind: event.kind === "CANONICAL_CHARGE" ? "ECONOMIC_CHARGE" : event.kind,
      amount: event.economicAmount,
      sourceRefs: descriptor.sourceRefs,
      ...(descriptor.merchantLabel === undefined ? {} : { merchantLabel: descriptor.merchantLabel }),
      ...(descriptor.narrativeOwnerId === undefined ? {} : { narrativeOwnerId: descriptor.narrativeOwnerId }),
    }];
  });
  return data.expenseSummaries;
}
function activityState(data) {
  if (data.activityState !== undefined) return data.activityState;
  const artifactItems = data.calendarArtifact.items.status === "KNOWN" || data.calendarArtifact.items.status === "PARTIAL"
    ? data.calendarArtifact.items.items : [];
  const itemByActivity = new Map();
  for (const item of artifactItems) {
    const lifeEventRefs = item.sourceRefs.filter((value) => value.startsWith("life_event:"));
    if (lifeEventRefs.length === 0) continue;
    const group = itemByActivity.get(item.semanticTypeKey) ?? [];
    group.push(item);
    itemByActivity.set(item.semanticTypeKey, group);
  }
  const costsByActivity = new Map([...itemByActivity.keys()].map((activityId) => [activityId,
    historyAnalytics.resolveHistoryActivityCost(data.activityCosts.filter((cost) => String(cost.activityId) === activityId)),
  ]));
  const scoreInputs = [...itemByActivity].map(([activityTypeKey, items]) => ({
    activityTypeKey,
    occurrences: data.occurrences.filter((value) => String(value.activityId) === activityTypeKey).length,
    hasOtherNarrativeMoment: items.some((item) => item.sourceKind === "fused"),
    priorityBand: Math.min(4, Math.max(...items.map(({ priorityBand }) => priorityBand))),
    ...(costsByActivity.get(activityTypeKey)?.cost.status !== "KNOWN" ? {} : {
      qualifiedCost: costsByActivity.get(activityTypeKey).cost.value,
      qualifiedCostShare: new Big(data.dailyArtifact.actualMonthAmount).eq(0)
        ? 0 : Number(new Big(costsByActivity.get(activityTypeKey).cost.value).div(data.dailyArtifact.actualMonthAmount).abs().toString()),
    }),
  }));
  const scores = balance.rankActivities(scoreInputs);
  const summaries = scores.map((score) => ({
    ...score,
    label: itemByActivity.get(score.activityTypeKey)?.[0]?.title ?? score.activityTypeKey,
    ...costsByActivity.get(score.activityTypeKey),
    detailRef: target(query.queryResourceKeys.historyActivityDetail, { activityTypeKey: score.activityTypeKey }),
    sourceRefs: [...new Set(itemByActivity.get(score.activityTypeKey).flatMap(({ sourceRefs }) => sourceRefs))]
      .map((ref) => historyQuery.parseArtifactSourceRef(ref)),
  }));
  data.activityState = { summaries, costsByActivity };
  return data.activityState;
}
function momentState(data) {
  if (data.momentState !== undefined) return data.momentState;
  const items = data.calendarArtifact.items.status === "KNOWN" || data.calendarArtifact.items.status === "PARTIAL"
    ? data.calendarArtifact.items.items.filter((item) => item.sourceKind === "moment" || item.sourceKind === "fused") : [];
  const costForMoment = (momentId) => historyAnalytics.resolveMomentFinancialCost({ householdId, momentId, relations: data.momentRelations });
  const candidates = items.flatMap((item) => {
    const ref = item.sourceRefs.find((value) => value.startsWith("moment:"));
    const startDate = item.startDate ?? item.anchorDate;
    if (ref === undefined || startDate === undefined) return [];
    const momentId = ref.slice("moment:".length);
    return [{
      momentId,
      priorityBand: item.priorityBand,
      priorityWeight: item.priorityWeight,
      continuous: item.continuityQualifier?.status === "KNOWN" && item.continuityQualifier.value === "CONTINUOUS",
      livedDaysInMonth: item.endDate === undefined ? 1 : Math.max(1, daysBetween(startDate, item.endDate) + 1),
      ...(costForMoment(momentId).causalCost.status !== "KNOWN" ? {} : { causalCost: costForMoment(momentId).causalCost.value }),
      causalCostComparable: costForMoment(momentId).causalCost.status === "KNOWN",
      startDate,
    }];
  });
  const ranked = balance.rankMoments(candidates);
  const summaries = ranked.map((candidate, index) => {
    const item = items.find((value) => value.sourceRefs.includes(`moment:${candidate.momentId}`));
    return {
      momentId: candidate.momentId,
      title: item?.title ?? candidate.momentId,
      startDate: candidate.startDate,
      ...(item?.endDate === undefined ? {} : { endDate: item.endDate }),
      highlightRank: Math.min(5, index + 1),
      causalCost: costForMoment(candidate.momentId).causalCost,
      fallbackIconKey: item?.iconKey ?? "moment",
      detailRef: target(query.queryResourceKeys.historyMomentDetail, { momentId: candidate.momentId }),
      sourceRefs: [sourceRef("moment", candidate.momentId)],
    };
  });
  data.momentState = { summaries, costForMoment, items };
  return data.momentState;
}
function placeState(data) {
  if (data.placeState !== undefined) return data.placeState;
  const visitGroups = new Map();
  for (const visit of data.visits) {
    const placeId = String(visit.placeId);
    const group = visitGroups.get(placeId) ?? [];
    group.push(visit);
    visitGroups.set(placeId, group);
  }
  const amountByPlace = groupFactsAmount(data.facts, canonicalPlaceOf);
  const activityTypes = historyAnalytics.historyPlaceActivityTypes(data.occurrences, data.primaryPlaces);
  const placeIds = [...new Set([...visitGroups.keys(), ...amountByPlace.keys(), ...activityTypes.keys()])];
  const financeByPlace = new Map(placeIds.map((placeId) => [placeId,
    historyAnalytics.resolveHistoryPlaceFinance(data.facts, placeId),
  ]));
  const inputs = placeIds.map((placeId) => {
    const visits = visitGroups.get(placeId) ?? [];
    const finance = financeByPlace.get(placeId);
    const localizedAmount = finance.cardAmount.status === "KNOWN" ? finance.cardAmount.value : undefined;
    return {
      placeId,
      presenceDays: new Set(visits.map(({ localDate }) => String(localDate))).size,
      ...(activityTypes.has(placeId) ? { activityTypeCount: activityTypes.get(placeId).size } : {}),
      ...(localizedAmount === undefined ? {} : {
        localizedAmount,
        ...(new Big(data.dailyArtifact.actualMonthAmount).lte(0) ? {} : {
          localizedShare: Number(new Big(localizedAmount).div(data.dailyArtifact.actualMonthAmount).toString()),
        }),
        ...(finance.localizedCoverage === undefined ? {} : { localizedCoverage: finance.localizedCoverage }),
      }),
      // Normative roles exist; their Canonical inputs are absent here (DATA_MISSING).
      // Never substitute a label, visit frequency or causal-finance place for them.
    };
  });
  const scores = balance.rankPlaces(inputs);
  const summaries = scores.map((score) => ({
    ...score,
    label: placeLabels.get(score.placeId) ?? score.placeId,
    localizedAmount: financeByPlace.get(score.placeId).cardAmount,
    detailRef: target(query.queryResourceKeys.historyPlaceDetail, { placeId: score.placeId }),
    sourceRefs: [sourceRef("place", score.placeId)],
  }));
  data.placeState = { summaries, visitGroups, amountByPlace, financeByPlace };
  return data.placeState;
}
function causalCostByCalendarItem(data) {
  const output = {};
  for (const summary of momentState(data).summaries) {
    const calendarItemId = calendarMomentItemId(data.calendarArtifact, summary.momentId);
    if (calendarItemId !== undefined) output[calendarItemId] = summary.causalCost;
  }
  return output;
}
function unknownCollection(reasonCode = "DATA_NO_SOURCE") {
  return { status: "UNKNOWN", quality: { reasonCode } };
}
function journalSupplement(data) {
  if (data.journalSupplement !== undefined) return data.journalSupplement;
  // Existing Journal movement parsing is outside HC2; never reused for M3/Place.
  const normalizeToken = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  const refunds = [];
  let refundTimingMissing = false;
  for (const fact of data.facts) {
    if (new Big(fact.refundApplied).lte(0)) continue;
    const date = componentDate(data.dailyArtifact, String(fact.canonicalComponentKey));
    if (date === undefined) {
      refundTimingMissing = true;
      continue;
    }
    const event = data.dailyArtifact.expenseEvents.find(({ componentKeys }) => componentKeys.includes(String(fact.canonicalComponentKey)));
    refunds.push({
      movementId: `refund:${String(fact.canonicalComponentKey)}`,
      date,
      label: "Remboursement économique",
      amount: fact.refundApplied,
      ...(event === undefined ? {} : { relatedExpenseEventId: event.expenseEventId }),
      sourceRefs: [sourceRef("economic_component", fact.canonicalComponentKey)],
    });
  }
  const inflows = [];
  const technical = [];
  let inflowTimingMissing = false;
  let technicalTimingMissing = false;
  for (const row of data.operations) {
    const flux = normalizeToken(row.flux);
    const role = normalizeToken(row.role_budgetaire);
    const kind = normalizeToken(row.type_precis);
    const isInflow = flux.includes("entree") || flux.includes("credit") || flux.includes("revenu") || row.type_ressource != null;
    const isTechnical = role.includes("tech") || role.includes("transfert") || kind.includes("transfert") || kind.includes("retrait") || kind.includes("paiement carte");
    if (!isInflow && !isTechnical) continue;
    const date = row.date_transaction_reelle == null ? undefined : String(row.date_transaction_reelle).slice(0, 10);
    if (date === undefined) {
      if (isInflow) inflowTimingMissing = true;
      if (isTechnical) technicalTimingMissing = true;
      continue;
    }
    const amount = absMoney(row.montant ?? row.montant_bancaire_depense ?? zero);
    if (isInflow) inflows.push({
      movementId: `operation:${String(row.operation_id)}`,
      date,
      label: String(row.description_precise ?? row.libelle_bancaire ?? "Entrée bancaire"),
      amount,
      sourceRefs: [sourceRef("operation", row.operation_id)],
    });
    if (isTechnical) technical.push({
      movementId: `operation:${String(row.operation_id)}`,
      date,
      label: String(row.description_precise ?? row.libelle_bancaire ?? "Mouvement technique"),
      movementKind: kind.includes("transfert") ? "TRANSFER" : kind.includes("retrait") ? "CASH_WITHDRAWAL" : kind.includes("carte") ? "CARD_PAYMENT" : "OTHER_TECHNICAL",
      amount,
      sourceRefs: [sourceRef("operation", row.operation_id)],
    });
  }
  const collection = (items, partial, reasonCode) => partial
    ? { status: "PARTIAL", items, partialMeaning: "OBSERVED_ONLY", knownCount: items.length, quality: { reasonCode } }
    : { status: "KNOWN", items, totalCount: items.length };
  data.journalSupplement = {
    refundsAndAdjustments: collection(refunds, refundTimingMissing, "DATA_UNASSIGNED_TIMING"),
    inflows: collection(inflows, inflowTimingMissing, "DATA_UNASSIGNED_TIMING"),
    technicalMovements: collection(technical, technicalTimingMissing, "DATA_UNASSIGNED_TIMING"),
    causalCostByCalendarItemId: causalCostByCalendarItem(data),
    bankInflows: sumMoney(inflows.map(({ amount }) => amount)),
  };
  return data.journalSupplement;
}

function displayMetric(value) {
  if (value.status === "KNOWN" || value.status === "PARTIAL") return { visibility: "VISIBLE", data: value };
  if (value.status === "NOT_APPLICABLE") return { visibility: "HIDDEN", reasonCode: value.quality?.reasonCode ?? "POLICY_NOT_APPLICABLE" };
  return { visibility: "PLACEHOLDER", reasonCode: value.quality?.reasonCode ?? "DATA_NO_SOURCE" };
}
function expenseCollectionValue(data) {
  const items = expenseSummaries(data);
  const unassigned = data.dailyArtifact.unassignedEconomicAmount;
  const complete = unassigned.status === "KNOWN" && new Big(unassigned.value).eq(0);
  return complete
    ? { status: "KNOWN", items, totalCount: items.length }
    : { status: "PARTIAL", items, partialMeaning: "OBSERVED_ONLY", knownCount: items.length, quality: { reasonCode: "DATA_UNASSIGNED_TIMING" } };
}
function segmentSelection(data, params) {
  return spendingComponents(data).filter((component) => {
    if (params.axis !== undefined) return component[params.axis] === params.bucket;
    return component.necessity === params.necessity && component.behavior === params.behavior;
  });
}

function historyQueryDependencies(data, request, readModel) {
  const resource = request.resource;
  const requestedMonths = resource === "history_month_calendar"
    ? [readModel.gridStartDate.slice(0, 7), data.month, readModel.gridEndDate.slice(0, 7)]
    : resource === "history_week" ? [readModel.weekStart.slice(0, 7), readModel.weekEnd.slice(0, 7)]
      : resource === "history_day_journal" ? dailyArtifacts.map(({ month }) => month) : [data.month];
  const selectedMonths = [...new Set(requestedMonths)].sort();
  const clean = (value) => JSON.parse(JSON.stringify(value, (key, child) =>
    ["generatedAt", "publicationMeta", "policyVersions", "contractVersion", "revision"].includes(key) ? undefined : child));
  const set = (values) => historyAnalytics.historyDependencySet(clean(values));
  const selectedLedgers = dailyArtifacts.filter(({ month }) => selectedMonths.includes(month));
  const eventIds = new Set(selectedLedgers.flatMap(({ expenseEvents }) => expenseEvents.map(({ expenseEventId }) => expenseEventId)));
  const sources = {
    calendar_artifacts: () => set(calendarArtifacts.filter(({ month }) => selectedMonths.includes(month))),
    daily_ledgers: () => set(selectedLedgers),
    persons: () => set(personDirectory),
    expenses: () => set(allExpenseDescriptors.filter(({ expenseEventId }) => eventIds.has(expenseEventId))),
    local_expenses: () => set(data.expenseDescriptors),
    typical: () => clean(data.analyticsAuthority.typical),
    minimal: () => clean(data.analyticsAuthority.minimal),
    category_typical: () => set(data.analyticsAuthority.categoryTypicals),
    actual_history: () => set(months.filter((month) => month <= data.month).map((month) => ({ month, actual: dailyByMonth.get(month).actualMonthAmount }))),
    category_history: () => {
      const typical = categoryState(data).typicalRows.get(request.params.categoryId);
      return set(typical?.availability !== "known" ? [] : pivotMonthIds(typical).map((month) => ({
        month, sourceAvailable: monthData.has(month),
        facts: set(monthData.get(month)?.facts.filter((fact) => categoryOf(fact) === request.params.categoryId) ?? []),
      })));
    },
    economic_components: () => set(data.facts),
    classifications: () => set(data.classifications),
    operations: () => set(data.operations.map((row) => Object.fromEntries([
      "operation_id", "date_bancaire", "montant_bancaire_depense", "description_precise", "libelle_bancaire",
      "flux", "role_budgetaire", "type_precis", "type_ressource", "date_transaction_reelle", "montant",
    ].filter((key) => row[key] !== undefined).map((key) => [key, row[key]])))),
    activity_occurrences: () => set(data.occurrences),
    activity_costs: () => set(data.activityCosts),
    activity_links: () => set(data.causalLinks),
    moment_relations: () => set(data.momentRelations),
    place_visits: () => set(data.visits),
    primary_places: () => set(data.primaryPlaces),
    // HC2 absence is explicit; no new semantic role or hierarchy is inferred.
    place_authorities: () => ({ semanticRoles: "UNKNOWN", routineRoles: "UNKNOWN", momentMembership: "UNKNOWN", hierarchy: "UNKNOWN" }),
    reference_labels: () => ({ categories: set([...categoryLabels]), subcategories: set([...subcategoryLabels]), merchants: set([...merchantLabels]), places: set([...placeLabels]) }),
    journal_supplement: () => clean(journalSupplement(data)),
    overview_supplement: () => clean(overviewSupplement(data)),
  };
  const identityFor = (name) => {
    const selector = { householdId, ownerMonth: data.month };
    if (["calendar_artifacts", "daily_ledgers", "expenses"].includes(name)) selector.sourceMonths = selectedMonths;
    if (name === "actual_history") selector.sourceMonths = months.filter((month) => month <= data.month);
    if (name === "category_history") {
      const typical = categoryState(data).typicalRows.get(request.params.categoryId);
      selector.categoryId = request.params.categoryId;
      selector.sourceMonths = typical?.availability === "known" ? [...pivotMonthIds(typical)].sort() : [];
    }
    if (name === "typical" || name === "category_typical") {
      const authorities = name === "typical" ? [data.analyticsAuthority.typical] : data.analyticsAuthority.categoryTypicals;
      selector.referenceWindows = authorities.map((authority) => ({
        ...(authority.categoryId === undefined ? {} : { categoryId: authority.categoryId }),
        includedPeriods: [...(authority.window?.includedPeriods ?? [])].sort(),
        excludedPeriods: [...(authority.window?.excludedPeriods ?? [])].map(({ period }) => period).sort(),
      })).sort((a, b) => (a.categoryId ?? "").localeCompare(b.categoryId ?? ""));
    }
    if (name === "moment_relations") selector.momentIds = [...new Set(data.canonicalMomentIds)].sort();
    // A logical source selector + its content digest remains interpretable after
    // canonical data changes; no financial rows are copied into the manifest.
    return stableJson(selector);
  };
  return historyAnalytics.historyResourceDependencyClosure({ resource, groups: Object.fromEntries(
    [...new Set(historyAnalytics.historyV2ResourceDependencyGroups[resource])].map((name) => [name, {
      identity: identityFor(name),
      value: sources[name](),
    }]),
  ) });
}

function overviewSupplement(data) {
  const bridge = bridgeFor(data.month, data.facts, data.operations, data.dailyArtifact.actualMonthAmount);
  return {
    bankOutflows: { status: "KNOWN", value: bridge.bankOutflows },
    bankInflows: { status: "KNOWN", value: journalSupplement(data).bankInflows },
    causalCostByCalendarItemId: causalCostByCalendarItem(data), explicitIncidentHighlights: [],
    narrativePlaces: placeState(data).summaries.slice(0, 4).map((place) => ({
      placeId: place.placeId, title: place.label,
      ...(place.presenceDays === undefined ? {} : { presenceDays: place.presenceDays }),
      localizedAmount: place.localizedAmount, iconKey: "place", sourceRefs: place.sourceRefs,
    })),
  };
}
function spendingContributorProjection(data, params) {
  const selected = segmentSelection(data, params);
  const selection = balance.selectSpendingContributors(selected);
  return {
    selected,
    contributors: selection.contributors.map((contributor) => ({
      contributorId: contributor.contributorId,
      grain: contributor.grain,
      label: contributor.grain === "SUBCATEGORY"
        ? subcategoryLabels.get(contributor.contributorId) ?? contributor.contributorId
        : categoryLabels.get(contributor.contributorId) ?? contributor.contributorId,
      amount: contributor.amount,
      sourceRefs: [sourceRef(
        contributor.grain === "SUBCATEGORY" ? "subcategory" : "category",
        contributor.contributorId,
      )],
    })),
    otherAmount: selection.otherAmount,
  };
}
function spendingNatureSegments(data, spending) {
  const segments = [];
  for (const [axis, state] of [
    ["necessity", spending.necessity],
    ["behavior", spending.behavior],
    ["lifeScope", spending.lifeScope],
  ]) {
    if (state.result.status !== "KNOWN" && state.result.status !== "PARTIAL") continue;
    for (const bucket of state.result.value) {
      const segment = { axis, bucket: bucket.key };
      const projection = spendingContributorProjection(data, segment);
      segments.push({
        segment,
        amount: bucket.amount,
        ...(bucket.shareOfActual === undefined ? {} : { shareOfActual: bucket.shareOfActual }),
        contributors: knownCollection(projection.contributors),
        otherAmount: visibleKnown(projection.otherAmount),
        detailRef: target(query.queryResourceKeys.historySpendingSegmentDetail, segment),
        ...(state.result.status === "PARTIAL" && state.result.quality !== undefined
          ? { quality: state.result.quality }
          : {}),
      });
    }
  }
  for (const cell of spending.matrix.cells) {
    const [necessity, behavior] = cell.key.split("__");
    const segment = { necessity, behavior };
    const projection = spendingContributorProjection(data, segment);
    segments.push({
      segment,
      amount: cell.amount,
      ...(cell.shareOfActual === undefined ? {} : { shareOfActual: cell.shareOfActual }),
      contributors: knownCollection(projection.contributors),
      otherAmount: visibleKnown(projection.otherAmount),
      detailRef: target(query.queryResourceKeys.historySpendingSegmentDetail, segment),
    });
  }
  return segments;
}
function buildActivityDetail(data, context, activityTypeKey) {
  const summary = activityState(data).summaries.find((value) => value.activityTypeKey === activityTypeKey);
  if (summary === undefined) throw new TypeError(`Activity ${activityTypeKey} absente.`);
  const occurrences = data.occurrences.filter((value) => String(value.activityId) === activityTypeKey).map((value) => {
    const item = data.calendarArtifact.items.status === "KNOWN" || data.calendarArtifact.items.status === "PARTIAL"
      ? data.calendarArtifact.items.items.find((candidate) => candidate.sourceRefs.includes(`life_event:${String(value.lifeEventId)}`))
      : undefined;
    return {
      occurrenceId: String(value.lifeEventId),
      effectiveDate: value.startDate,
      momentIds: item?.sourceRefs.filter((ref) => ref.startsWith("moment:")).map((ref) => ref.slice(7)) ?? [],
      placeIds: [],
      categoryIds: [],
      sourceRefs: [sourceRef("life_event", value.lifeEventId)],
    };
  }).sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate) || left.occurrenceId.localeCompare(right.occurrenceId));
  const costFacts = data.activityCosts.filter((cost) => {
    const occurrence = data.occurrences.find((value) => String(value.lifeEventId) === String(cost.occurrenceId));
    return occurrence !== undefined && String(occurrence.activityId) === activityTypeKey;
  });
  const componentKeys = new Set(costFacts.filter((cost) => cost.causalCost.availability === "known").flatMap(({ evidence }) => evidence.map(({ canonicalComponentKey }) => String(canonicalComponentKey))));
  const knownOccurrenceIds = new Set(costFacts.filter((cost) => cost.causalCost.availability === "known").map((cost) => String(cost.occurrenceId)));
  const uniqueLinks = new Map(parseActivityCausalFinancialLinks(data.causalLinks)
    .filter((link) => knownOccurrenceIds.has(String(link.lifeEventId)))
    .map((link) => [`${link.lifeEventId}:${link.canonicalComponentKey}`, link]));
  const linkedAmountByComponent = new Map();
  for (const link of uniqueLinks.values()) {
    if (link.economicAmountLinked === null) continue;
    linkedAmountByComponent.set(String(link.canonicalComponentKey), sumMoney([
      linkedAmountByComponent.get(String(link.canonicalComponentKey)) ?? zero, link.economicAmountLinked,
    ]));
  }
  const causalExpenses = expenseSummaries(data).filter((expense) => data.dailyArtifact.expenseEvents.some((event) =>
    event.expenseEventId === expense.expenseEventId && event.componentKeys.every((key) => componentKeys.has(key))
      && new Big(sumMoney(event.componentKeys.map((key) => linkedAmountByComponent.get(key) ?? zero))).eq(expense.amount)));
  return historyQuery.buildActivityDetailReadModel({
    context,
    activity: summary,
    occurrences: knownCollection(occurrences),
    frequencyTicket: { visibility: "VISIBLE", data: frequencyTicketUnknown() },
    causalExpenses: summary.cost.status === "UNKNOWN"
      ? { visibility: "VISIBLE", data: unknownCollection("DATA_NO_CAUSAL_LINK") }
      : { visibility: "VISIBLE", data: { status: "PARTIAL", items: causalExpenses, knownCount: causalExpenses.length, partialMeaning: "OBSERVED_ONLY", quality: { reasonCode: "DATA_PARTIAL_SOURCE" } } },
    associatedExpenses: { visibility: "HIDDEN", reasonCode: "POLICY_NOT_APPLICABLE" },
  });
}
function buildMomentDetail(data, context, momentId) {
  const summary = momentState(data).summaries.find((value) => value.momentId === momentId);
  if (summary === undefined) throw new TypeError(`Moment ${momentId} absent.`);
  const resolved = momentState(data).costForMoment(momentId);
  const causalExpenses = expenseSummaries(data).filter((expense) => historyAnalytics.isWhollyCausalMomentExpense({
    componentKeys: expense.sourceRefs.filter((ref) => ref.kind === "economic_component").map(({ id }) => id),
    amount: expense.amount,
  }, resolved));
  const spentDuring = historyQuery.computeSpentDuring({
    expenses: expenseCollectionValue(data),
    window: {
      ...(summary.startDate === undefined ? {} : { startDate: summary.startDate }),
      ...(summary.endDate === undefined ? { endDate: summary.startDate } : { endDate: summary.endDate }),
    },
  });
  return historyQuery.buildMomentDetailReadModel({
    context,
    moment: summary,
    causalCost: displayMetric(summary.causalCost),
    spentDuring: displayMetric(spentDuring),
    causalExpenses: summary.causalCost.status === "UNKNOWN" || summary.causalCost.status === "CONFLICT"
      ? { visibility: "VISIBLE", data: { status: summary.causalCost.status, quality: summary.causalCost.quality } }
      // The monthly ledger does not prove a complete human-event breakdown of
      // all causal components (including outside this month / unassigned dates).
      : { visibility: "VISIBLE", data: { status: "PARTIAL", items: causalExpenses, knownCount: causalExpenses.length, partialMeaning: "OBSERVED_ONLY", quality: { reasonCode: "DATA_PARTIAL_SOURCE" } } },
    spentDuringExpenses: expenseCollectionValue(data).status === "KNOWN"
      ? knownCollection(expenseSummaries(data).filter(({ economicDate }) => economicDate >= summary.startDate && economicDate <= (summary.endDate ?? summary.startDate)))
      : {
          visibility: "VISIBLE",
          data: {
            status: "PARTIAL",
            items: expenseSummaries(data).filter(({ economicDate }) => economicDate >= summary.startDate && economicDate <= (summary.endDate ?? summary.startDate)),
            partialMeaning: "OBSERVED_ONLY",
            knownCount: expenseSummaries(data).filter(({ economicDate }) => economicDate >= summary.startDate && economicDate <= (summary.endDate ?? summary.startDate)).length,
            quality: { reasonCode: "DATA_UNASSIGNED_TIMING" },
          },
        },
  });
}
function buildPlaceDetail(data, context, placeId) {
  const state = placeState(data);
  const summary = state.summaries.find((value) => value.placeId === placeId);
  if (summary === undefined) throw new TypeError(`Place ${placeId} absent.`);
  const byDate = new Map();
  for (const visit of state.visitGroups.get(placeId) ?? []) {
    const date = String(visit.localDate);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }
  const presenceDays = [...byDate].sort(([left], [right]) => left.localeCompare(right)).map(([date, presenceCount]) => ({
    date,
    presenceCount,
    sourceRefs: [sourceRef("place", placeId)],
  }));
  const finance = state.financeByPlace.get(placeId);
  return historyQuery.buildPlaceDetailReadModel({
    context,
    place: summary,
    localizedCoverage: finance.localizedCoverage === undefined
      ? { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } }
      : { status: "KNOWN", value: finance.localizedCoverage },
    localizedAmount: displayMetric(finance.detailAmount),
    presenceDays: knownCollection(presenceDays),
  });
}

function buildReadModel(data, request) {
  const context = balanceContext(data, request.resource, request.params);
  switch (request.resource) {
    case "history_month_calendar":
      return historyQuery.buildMonthCalendarReadModel(calendarContext(request.resource), data.month);
    case "history_week":
      return historyQuery.buildWeekReadModel(calendarContext(request.resource), request.params.weekStart);
    case "history_day_journal":
      return historyQuery.buildJournalDayReadModel(calendarContext(request.resource), request.params.date, journalSupplement(data));
    case "history_month_overview": {
      return historyQuery.buildMonthQuickOverviewReadModel(calendarContext(request.resource), data.month, overviewSupplement(data));
    }
    case "history_month_balance_summary": {
      const typical = data.analyticsAuthority.typical.metric;
      const minimal = minimalState(data);
      const actuals = months
        .filter((month) => month <= data.month)
        .map((month) => money(dailyByMonth.get(month).actualMonthAmount));
      return historyQuery.buildMonthBalanceSummaryReadModel({
        context,
        actual: visibleKnown(data.dailyArtifact.actualMonthAmount),
        typical: officialMetricNode(typical),
        minimal: officialMetricNode(data.analyticsAuthority.minimal.metric),
        comparableActualsIncludingCurrent: actuals,
        typicalSupportMonths: typical.support?.n ?? 0,
        importedSummary: { freshness: "MISSING" },
      });
    }
    case "history_bank_economy_bridge":
      return historyQuery.buildBankEconomyBridgeReadModel({
        context,
        bridge: bridgeFor(data.month, data.facts, data.operations, data.dailyArtifact.actualMonthAmount),
      });
    case "history_month_categories": {
      const state = categoryState(data);
      return historyQuery.buildMonthCategoriesReadModel({
        context,
        categories: state.summaries,
        otherAmount: visibleKnown(state.preview.otherAmount),
        unclassifiedAmount: visibleKnown(state.preview.unclassifiedAmount),
      });
    }
    case "history_category_detail": {
      const summary = categoryState(data).summaries.find((value) => value.categoryId === request.params.categoryId);
      if (summary === undefined) throw new TypeError(`Category ${request.params.categoryId} absente.`);
      const composition = categoryComposition(data, summary.categoryId);
      const classifications = categoryClassificationState(data, summary.categoryId);
      return historyQuery.buildCategoryDetailReadModel({
        context,
        category: summary,
        typicalComposition: composition,
        explanation: categoryExplanation(data, summary, composition),
        frequencyTicket: frequencyTicketUnknown(),
        merchantAndPurchaseDrivers: [],
        lifecycleBadges: [],
        classifications,
      });
    }
    case "history_month_spending_nature": {
      const spending = spendingState(data);
      return historyQuery.buildMonthSpendingNatureReadModel({
        context,
        actual: visibleKnown(data.dailyArtifact.actualMonthAmount),
        necessity: spending.necessity,
        behavior: spending.behavior,
        lifeScope: spending.lifeScope,
        matrix: spending.matrix,
        segments: spendingNatureSegments(data, spending),
      });
    }
    case "history_spending_segment_detail": {
      const projection = spendingContributorProjection(data, request.params);
      return historyQuery.buildSpendingSegmentDetailReadModel({
        context,
        segment: request.params,
        amount: visibleKnown(sumMoney(projection.selected.map(({ amount }) => amount))),
        contributors: knownCollection(projection.contributors),
        otherAmount: visibleKnown(projection.otherAmount),
      });
    }
    case "history_minimal_preview": {
      const minimal = minimalState(data);
      return historyQuery.buildMinimalPreviewReadModel({
        context,
        minimal: officialMetricNode(data.analyticsAuthority.minimal.metric),
        preview: minimal.preview,
      });
    }
    case "history_month_life_money":
      return historyQuery.buildMonthLifeMoneyReadModel({
        context,
        activities: activityState(data).summaries,
        moments: momentState(data).summaries,
        places: placeState(data).summaries,
      });
    case "history_activity_detail":
      return buildActivityDetail(data, context, request.params.activityTypeKey);
    case "history_moment_detail":
      return buildMomentDetail(data, context, request.params.momentId);
    case "history_place_detail":
      return buildPlaceDetail(data, context, request.params.placeId);
    default:
      throw new TypeError(`Ressource History V2 non gérée: ${request.resource}`);
  }
}

const classRank = { PASS: 0, PARTIAL_EXPECTED: 1, DATA_MISSING: 2, FAIL: 3 };
function maxClass(left, right) {
  return classRank[right] > classRank[left] ? right : left;
}
function classifyPayload(value) {
  let classification = "PASS";
  const reasons = new Set();
  const seen = new Set();
  const visit = (candidate) => {
    if (candidate === null || typeof candidate !== "object" || seen.has(candidate)) return;
    seen.add(candidate);
    if (candidate.status === "CONFLICT") {
      classification = "FAIL";
      reasons.add(candidate.quality?.reasonCode ?? "DATA_CONFLICTING_AUTHORITIES");
    } else if (candidate.status === "UNKNOWN" || candidate.visibility === "PLACEHOLDER") {
      const reason = candidate.quality?.reasonCode ?? candidate.reasonCode ?? "DATA_NO_SOURCE";
      reasons.add(reason);
      classification = maxClass(classification,
        reason === "REFERENCE_INSUFFICIENT_SUPPORT" ? "PARTIAL_EXPECTED" : "DATA_MISSING");
    } else if (candidate.status === "PARTIAL") {
      const reason = candidate.quality?.reasonCode ?? "COVERAGE_PARTIAL";
      reasons.add(reason);
      classification = maxClass(classification,
        ["COVERAGE_PARTIAL", "DATA_PARTIAL_SOURCE", "DATA_UNASSIGNED_TIMING"].includes(reason)
          ? "PARTIAL_EXPECTED" : "FAIL");
    }
    for (const child of Array.isArray(candidate) ? candidate : Object.values(candidate)) visit(child);
  };
  visit(value);
  return { classification, reasons: [...reasons].sort() };
}
function resourceResult(preflight, resource) {
  const values = preflight.queries.filter(({ request }) => request.resource === resource).map(({ data }) => classifyPayload(data));
  return {
    resource,
    instances: values.length,
    classification: values.reduce((status, value) => maxClass(status, value.classification), "PASS"),
    reasons: [...new Set(values.flatMap(({ reasons }) => reasons))].sort(),
  };
}
function queryData(preflight, resource, predicate = () => true) {
  return preflight.queries.find(({ request }) => request.resource === resource && predicate(request))?.data;
}
function displayCollectionItems(node) {
  return node?.visibility === "VISIBLE" && (node.data.status === "KNOWN" || node.data.status === "PARTIAL")
    ? node.data.items : [];
}
async function assertMonthInvariants(data, preflight, deterministic, expectedOracle) {
  const ledger = data.dailyArtifact;
  const calendarArtifact = data.calendarArtifact;
  const checks = [];
  const check = (id, condition, evidence) => {
    checks.push({ id, status: condition ? "PASS" : "FAIL", evidence });
    assert.ok(condition, `${id} ${data.month}: ${evidence}`);
  };
  check("F01_ACTUAL_COMMON", moneyClose(ledger.actualMonthAmount, expectedOracle.actual.net), `${ledger.actualMonthAmount} == ${expectedOracle.actual.net}`);
  check("F02_DAILY_RECONCILIATION", moneyClose(ledger.reconciliationResidual, zero), `residual=${ledger.reconciliationResidual}`);
  const dayAmount = sumMoney(ledger.days.flatMap(({ economicAmount }) =>
    economicAmount.status === "KNOWN" || economicAmount.status === "PARTIAL" ? [economicAmount.value] : []));
  const unassigned = ledger.unassignedEconomicAmount.status === "KNOWN" || ledger.unassignedEconomicAmount.status === "PARTIAL"
    ? ledger.unassignedEconomicAmount.value : zero;
  check("F03_DAYS_PLUS_UNASSIGNED", moneyClose(sumMoney([dayAmount, unassigned]), ledger.actualMonthAmount), `days=${dayAmount}; unassigned=${unassigned}; actual=${ledger.actualMonthAmount}`);
  check("F04_NO_BANK_FALLBACK_DAILY", ledger.allocationEntries.every(({ timingAuthority }) => timingAuthority !== "BANK_DATE_FALLBACK"), "aucune allocation quotidienne par bank_date_fallback");
  check("F05_REFUND_EFFECTIVE_DATE", journalSupplement(data).refundsAndAdjustments.status !== "CONFLICT", "refunds issus de l'effectiveEconomicDate ou PARTIAL explicite");

  const items = calendarArtifact.items.status === "KNOWN" || calendarArtifact.items.status === "PARTIAL" ? calendarArtifact.items.items : [];
  const membership = new Map();
  for (const item of items) for (const member of item.memberSourceIds) membership.set(member, (membership.get(member) ?? 0) + 1);
  const occurrenceIds = data.occurrences.map(({ lifeEventId }) => String(lifeEventId));
  const invalidMemberships = occurrenceIds.filter((id) => membership.get(`life_event:${id}`) !== 1);
  check("C01_CANONICAL_MEMBERSHIP", invalidMemberships.length === 0, `${occurrenceIds.length} Life Events, invalid=${stableJson(invalidMemberships.map((id) => ({ id, count: membership.get(`life_event:${id}`) ?? 0 })))}`);
  check("C02_NO_SILENT_DUPLICATION", new Set(items.map(({ calendarItemId }) => calendarItemId)).size === items.length, `${items.length} CalendarSemanticItem uniques`);
  check("C03_RAW_OCCURRENCE_PRESERVED", items.every(({ rawOccurrenceCount, memberSourceIds }) => rawOccurrenceCount >= memberSourceIds.filter((id) => id.startsWith("life_event:")).length && rawOccurrenceCount > 0), "rawOccurrenceCount conservé après fusion/agrégation");

  const monthCalendar = queryData(preflight, "history_month_calendar");
  check("C04_MONTH_TOP3", Object.values(monthCalendar.daysByDate).every((day) => {
    const ordered = day.orderedMarkerGroups.status === "KNOWN" || day.orderedMarkerGroups.status === "PARTIAL" ? day.orderedMarkerGroups.items : [];
    return stableJson(day.visibleMarkers.map(({ calendarItemId }) => calendarItemId)) === stableJson(ordered.slice(0, 3).map(({ calendarItemId }) => calendarItemId));
  }), "Month visibleMarkers = préfixe serveur 1-3");
  const weeks = preflight.queries.filter(({ request }) => request.resource === "history_week").map(({ data: value }) => value);
  check("C05_WEEK_TOP6", weeks.every((week) => week.days.every((day) => {
    const ordered = day.orderedMarkerGroups.status === "KNOWN" || day.orderedMarkerGroups.status === "PARTIAL" ? day.orderedMarkerGroups.items : [];
    return stableJson(day.visibleMarkers.map(({ calendarItemId }) => calendarItemId)) === stableJson(ordered.slice(0, 6).map(({ calendarItemId }) => calendarItemId));
  })), "Week visibleMarkers = préfixe serveur 1-6");
  check("C06_HIDDEN_COUNTS_GROUPS", Object.values(monthCalendar.daysByDate).every((day) => {
    const total = day.orderedMarkerGroups.status === "KNOWN" ? day.orderedMarkerGroups.totalCount : day.orderedMarkerGroups.status === "PARTIAL" ? day.orderedMarkerGroups.knownCount : 0;
    const expected = Math.max(0, total - day.visibleMarkers.length);
    return day.hiddenMarkerCount.status !== "KNOWN" || day.hiddenMarkerCount.value === expected;
  }), "+N compte les groupes ordonnés, pas les sources");
  check("C07_RIBBON_OVERFLOW_DISTINCT", monthCalendar.ribbonSegments !== monthCalendar.ribbonOverflow, "collections Ribbon et overflow distinctes");
  check("C08_RIBBON_OVERFLOW_IDENTITIES", (monthCalendar.ribbonOverflow.status !== "KNOWN" && monthCalendar.ribbonOverflow.status !== "PARTIAL") || monthCalendar.ribbonOverflow.items.every((overflow) =>
    overflow.count === overflow.items.length
    && new Set(overflow.items.map(({ calendarItemId }) => calendarItemId)).size === overflow.items.length
    && overflow.items.every(({ segmentStart, targetRef }) => targetRef.resource === "history_day_journal" && targetRef.params.date === segmentStart)), "overflowCount, identités et cibles Journal exactes");

  const categoryTotal = sumMoney([...categoryState(data).actualByCategory.values()]);
  check("K01_CATEGORY_RECONCILIATION", moneyClose(categoryTotal, ledger.actualMonthAmount), `categories=${categoryTotal}; actual=${ledger.actualMonthAmount}`);
  const spending = spendingState(data);
  for (const [axis, value] of [["necessity", spending.necessity], ["behavior", spending.behavior], ["lifeScope", spending.lifeScope]]) {
    check(`N_${axis.toUpperCase()}_RECONCILIATION`, moneyClose(sumMoney([value.classifiedAmount, value.unclassifiedAmount]), ledger.actualMonthAmount), `${axis} classified + gap = Actual`);
  }
  const categoryDetails = preflight.queries.filter(({ request }) => request.resource === "history_category_detail").map(({ data: value }) => value);
  check("K02_CATEGORY_CLASSIFICATION_TABS", categoryDetails.every((detail) => ["necessity", "behavior", "lifeScope"].every((axis) => {
    const view = detail.classificationViews[axis];
    if (view.visibility !== "VISIBLE") return false;
    return moneyClose(sumMoney([view.data.classifiedAmount, view.data.unclassifiedAmount]), detail.category.actual.value);
  })), "les trois axes serveur se réconcilient séparément avec le total catégorie");
  const minimal = minimalState(data);
  check("N_MINIMAL_ADDITIVE", !minimal.available || moneyClose(minimal.preview.total, minimal.value), minimal.available ? `minimal=${minimal.value}` : "Minimal DATA_MISSING autorisé");
  const officialTypical = data.analyticsAuthority.typical.metric;
  const expectedTypical = expectedOracle.typicalHousehold;
  check(
    "X02_TYPICAL_EXPECTED",
    expectedTypical.availability === "known"
      ? officialTypical.availability === "known" && moneyClose(officialTypical.value, expectedTypical.value)
      : officialTypical.availability !== "known",
    `Analytics=${officialTypical.availability === "known" ? officialTypical.value : officialTypical.availability}; EXPECTED=${expectedTypical.availability === "known" ? expectedTypical.value : expectedTypical.availability}`,
  );
  // Compare-only evidence is read AFTER Canonical production/preflight, never by builders.
  const currentMinimalProof = currentMinimalEvidenceFile(data.month) !== null
    ? await assertCurrentMinimalCertification({
      month: data.month, repository, repositoryRoot,
      source: await factResolver.resolve("minimal_month_cost", { subject: { kind: "household" }, time: { kind: "month", month: data.month } }),
      metric: data.analyticsAuthority.minimal.metric, components: data.analyticsAuthority.minimal.components,
    }) : null;
  check(
    "X03_MINIMAL_EXPECTED",
    currentMinimalProof !== null
      ? currentMinimalProof.status === "PASS" && minimal.available
        && minimal.value === data.analyticsAuthority.minimal.metric.value
      : expectedOracle.minimal.availability === "known"
        ? minimal.available && moneyClose(minimal.value, expectedOracle.minimal.value)
        : !minimal.available,
    currentMinimalProof !== null
      ? stableJson({ authority: "COMPARE_ONLY", ...currentMinimalProof, canonicalValue: minimal.value })
      : `Analytics=${minimal.value ?? "UNKNOWN"}; EXPECTED=${expectedOracle.minimal.value ?? expectedOracle.minimal.availability}`,
  );
  const expectedCategoryTypicals = new Map((expectedOracle.typicalCategories?.rows ?? []).map((row) => [row.categoryId, row]));
  check(
    "K03_CATEGORY_TYPICAL_EXPECTED",
    categoryState(data).summaries.every((summary) => {
      const expected = expectedCategoryTypicals.get(summary.categoryId);
      if (expected === undefined) return summary.typical.status !== "KNOWN";
      return expected.availability === "known"
        ? summary.typical.status === "KNOWN" && moneyClose(summary.typical.value, expected.typicalCategoryValue)
        : summary.typical.status !== "KNOWN";
    }),
    "Typical catégorie Analytics comparé à EXPECTED sans alimenter le ReadModel",
  );
  const bridge = bridgeFor(data.month, data.facts, data.operations, ledger.actualMonthAmount);
  check("K_BRIDGE_RESIDUAL", moneyClose(bridge.residual, zero), `bridge residual=${bridge.residual}`);

  check("X_MANIFEST_15_RESOURCES", preflight.manifest.resourceFamilies.length === 15 && new Set(preflight.queries.map(({ request }) => request.resource)).size === 15, `${preflight.queries.length} instances, 15 familles`);
  check("X_RUNTIME_SCHEMAS", true, `${preflight.queries.length} payloads parsés par leurs RuntimeSchemas`);
  check("X_HASHES", /^[0-9a-f]{64}$/u.test(preflight.manifest.manifestHash) && /^[0-9a-f]{64}$/u.test(preflight.manifest.publicationFactsHash), "manifestHash/factsHash SHA-256");
  check("D01_DETERMINISM", deterministic.manifest.manifestHash === preflight.manifest.manifestHash && deterministic.manifest.publicationFactsHash === preflight.manifest.publicationFactsHash, "deux générations READ-ONLY identiques");
  check("X_NO_V1_AS_V2", preflight.queries.every(({ contractVersion }) => contractVersion === "v2"), "toutes les ressources portent contractVersion v2");

  for (const queryEntry of preflight.queries) {
    historyCore.parsePublicationMeta({
      publicationId: `read-only-certification:${data.month}`,
      revision: 1,
      contractVersion: "v2",
      factsHash: preflight.manifest.publicationFactsHash,
      policyVersions: queryEntry.policyVersions,
      generatedAt: runtimeContext.asOf,
    });
  }
  check("X_PUBLICATION_META", true, `${preflight.queries.length} PublicationMeta simulées et validées sans Stage`);
  const overview = queryData(preflight, "history_month_overview");
  check("L_OVERVIEW_NO_BASELINES", !("typical" in overview) && !("minimal" in overview) && !("historicalRank" in overview), "Overview sans Typical/Minimal/rang");
  const journals = preflight.queries.filter(({ request }) => request.resource === "history_day_journal").map(({ data: value }) => value);
  check("L_JOURNAL_NO_INVENTED_TIME", journals.every((journal) => displayCollectionItems(journal.untimedEvents).every((item) => item.startTime === undefined)), "aucune heure ajoutée aux événements non horodatés");
  check("L_JOURNAL_DEDUP", journals.every((journal) => {
    const other = displayCollectionItems(journal.otherMovements.otherExpenses);
    const causal = [...displayCollectionItems(journal.timedTimeline), ...displayCollectionItems(journal.untimedEvents)]
      .flatMap((item) => item.moment === undefined ? [] : displayCollectionItems(item.moment.causalExpenses));
    return causal.every(({ expenseEventId }) => !other.some((expense) => expense.expenseEventId === expenseEventId));
  }), "dépenses narratives absentes de Autres dépenses");
  return checks;
}

const monthResults = [];
const publicationBundleMonths = [];
let totalQueries = 0;
for (const month of selectedMonth === undefined ? months : [selectedMonth]) {
  console.error(`history_v2_preflight ${month}`);
  const data = monthData.get(month);
  const artifacts = [
    {
      artifactFamily: "calendar_semantic_month",
      payload: data.calendarArtifact,
      facts: [{ factType: "calendar_semantic_month", identity: month, value: { artifactInputHash: data.calendarArtifact.artifactInputHash, items: data.calendarArtifact.items.status === "KNOWN" || data.calendarArtifact.items.status === "PARTIAL" ? data.calendarArtifact.items.items.length : null } }],
    },
    {
      artifactFamily: "daily_economic_ledger_month",
      payload: data.dailyArtifact,
      facts: [{ factType: "daily_economic_ledger_month", identity: month, value: { artifactInputHash: data.dailyArtifact.artifactInputHash, actual: data.dailyArtifact.actualMonthAmount, unassigned: data.dailyArtifact.unassignedEconomicAmount } }],
    },
  ];
  const buildQuery = (request) => {
    const readModel = buildReadModel(data, request);
    return {
      data: readModel,
      ...historyQueryDependencies(data, request, readModel),
    };
  };
  const preflight = await materialization.buildHistoryV2Preflight({ context: runtimeContext, month, artifacts, buildQuery, implementation });
  const deterministic = publicationOnly
    ? preflight
    : await materialization.buildHistoryV2Preflight({ context: runtimeContext, month, artifacts: [...artifacts].reverse(), buildQuery, implementation });
  const checks = publicationOnly ? [] : await assertMonthInvariants(data, preflight, deterministic, oracleMonths[month]);
  const resources = publicationOnly
    ? materialization.historyV2QueryResources.map((resource) => ({ resource, classification: "PASS", reasons: [] }))
    : materialization.historyV2QueryResources.map((resource) => resourceResult(preflight, resource));
  let classification = resources.reduce((status, value) => maxClass(status, value.classification), "PASS");
  const artifactClass = publicationOnly
    ? { classification: "PASS", reasons: [] }
    : classifyPayload({ calendar: data.calendarArtifact, daily: data.dailyArtifact });
  classification = maxClass(classification, artifactClass.classification);
  totalQueries += preflight.queries.length;
  if (process.env.HISTORY_V2_PREFLIGHT_BUNDLE_FILE !== undefined) {
    publicationBundleMonths.push({ month, preflight });
  }
  monthResults.push({
    month,
    classification,
    queryInstances: preflight.queries.length,
    artifactInstances: preflight.artifacts.length,
    manifestHash: preflight.manifest.manifestHash,
    factsHash: preflight.manifest.publicationFactsHash,
    actual: data.dailyArtifact.actualMonthAmount,
    typical: data.analyticsAuthority.typical.metric.availability === "known"
      ? data.analyticsAuthority.typical.metric.value
      : null,
    minimal: minimalState(data).value ?? null,
    dailyAssigned: data.dailyArtifact.assignedEconomicAmount,
    dailyUnassigned: data.dailyArtifact.unassignedEconomicAmount,
    timingCoverage: data.dailyArtifact.timingCoverage,
    calendarItems: data.calendarArtifact.items.status === "KNOWN" || data.calendarArtifact.items.status === "PARTIAL" ? data.calendarArtifact.items.items.length : 0,
    resources,
    artifactClassification: artifactClass,
    checks,
  });
}

const result = {
  gate: monthResults.some(({ classification }) => classification === "FAIL") ? "FAIL" : "PASS",
  implementationSha: implementation.gitSha,
  generatedAt: runtimeContext.asOf,
  mode: publicationOnly ? "READ_ONLY_REPUBLICATION_PREFLIGHT" : "READ_ONLY",
  stageFinalize: "NONE",
  householdId,
  months: monthResults,
  sourceRevision: runtimeContext.dataRevision,
  summary: {
    monthCount: monthResults.length,
    resourceFamilies: materialization.historyV2QueryResources.length,
    queryInstances: totalQueries,
    artifactInstances: monthResults.reduce((sum, value) => sum + value.artifactInstances, 0),
    runtimeSchemas: totalQueries,
    invariantChecks: monthResults.reduce((sum, value) => sum + value.checks.length, 0),
    classifications: Object.fromEntries(Object.keys(classRank).map((classification) => [classification, monthResults.filter((value) => value.classification === classification).length])),
    v1RuntimeSchemas: oracleReport.summary?.runtimeSchemas ?? 1536,
    v1OracleMatches: oracleReport.summary?.total ?? 180,
  },
  deterministicDigest: sha256(stableJson(monthResults.map(({ month, manifestHash, factsHash }) => ({ month, manifestHash, factsHash })))),
};
fs.writeFileSync(path.join(outputPath, "history-v2-certification-12-months.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
if (process.env.HISTORY_V2_PREFLIGHT_BUNDLE_FILE !== undefined) {
  const bundleFile = path.resolve(process.env.HISTORY_V2_PREFLIGHT_BUNDLE_FILE);
  fs.mkdirSync(path.dirname(bundleFile), { recursive: true });
  fs.writeFileSync(bundleFile, `${JSON.stringify({
    implementationSha: result.implementationSha,
    deterministicDigest: result.deterministicDigest,
    context: runtimeContext,
    months: publicationBundleMonths,
  })}\n`, "utf8");
}
console.log(JSON.stringify({
  gate: result.gate,
  months: result.summary.monthCount,
  resourceFamilies: result.summary.resourceFamilies,
  queryInstances: result.summary.queryInstances,
  runtimeSchemas: result.summary.runtimeSchemas,
  invariantChecks: result.summary.invariantChecks,
  classifications: result.summary.classifications,
  deterministicDigest: result.deterministicDigest,
  output: path.join(outputPath, "history-v2-certification-12-months.json"),
}, null, 2));
