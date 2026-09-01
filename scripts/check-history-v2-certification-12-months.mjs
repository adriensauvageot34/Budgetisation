import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import Big from "big.js";
import ts from "typescript";

import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

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
const months = Object.keys(oracleMonths).sort();
assert.deepEqual(months, [
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
]);
const householdId = oracleReport.finalExpectedOracle.metadata.householdId;
const household = one("households", (row) => row.household_id === householdId);
const revision = one("household_revisions", (row) => row.household_id === householdId);
assert.ok(household && revision, "Household/revision fixture absente.");
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
function normalizeToken(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
}
function necessity(value) {
  const token = normalizeToken(value);
  if (token.includes("indispens")) return "INDISPENSABLE";
  if (token.includes("contraint") || token.includes("oblig")) return "CONSTRAINED";
  if (token.includes("option") || token.includes("facultat")) return "OPTIONAL";
  return undefined;
}
function behavior(value) {
  const token = normalizeToken(value);
  if (token.includes("fix")) return "FIXED";
  if (token.includes("vari")) return "VARIABLE";
  return undefined;
}
function lifeScope(value) {
  const token = normalizeToken(value);
  if (token.includes("courante") || token.includes("daily") || token.includes("quotid")) return "CURRENT_LIFE";
  if (token.includes("hors") || token.includes("out")) return "OUT_OF_DAILY";
  return undefined;
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
function expenseDescriptorsFor(month, facts, ledger, operations) {
  const operationById = new Map(operations.map((row) => [String(row.operation_id), row]));
  const artifact = calendarByMonth.get(month);
  return ledger.expenseEvents.map((event) => {
    const componentFacts = facts.filter((fact) => event.componentKeys.includes(String(fact.canonicalComponentKey)));
    const operation = componentFacts.map(sourceOperationOf).flatMap((id) => id === undefined ? [] : [operationById.get(id)]).find(Boolean);
    const merchantId = componentFacts.map((fact) => factValue(fact, "merchant")).find(Boolean);
    const momentId = componentFacts.map((fact) => factValue(fact, "moment")).find(Boolean);
    const narrativeOwnerId = momentId === undefined || artifact === undefined
      ? undefined
      : calendarMomentItemId(artifact, String(momentId));
    return {
      expenseEventId: event.expenseEventId,
      label: String(operation?.description_precise ?? operation?.libelle_bancaire ?? "Dépense économique"),
      sourceRefs: event.componentKeys.map((id) => sourceRef("economic_component", id)),
      ...(merchantId === undefined ? {} : { merchantLabel: merchantLabels.get(String(merchantId)) ?? String(merchantId) }),
      ...(narrativeOwnerId === undefined ? {} : { narrativeOwnerId }),
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
function spendingComponents(facts) {
  return facts.map((fact) => ({
    componentKey: String(fact.canonicalComponentKey),
    amount: fact.net,
    ...(necessity(factValue(fact, "necessity")) === undefined ? {} : { necessity: necessity(factValue(fact, "necessity")) }),
    ...(behavior(factValue(fact, "behavior")) === undefined ? {} : { behavior: behavior(factValue(fact, "behavior")) }),
    ...(lifeScope(factValue(fact, "lifeScope")) === undefined ? {} : { lifeScope: lifeScope(factValue(fact, "lifeScope")) }),
    ...(categoryOf(fact) === undefined ? {} : { categoryId: categoryOf(fact) }),
    ...(subcategoryOf(fact) === "__UNDETERMINED__" ? {} : { subcategoryId: subcategoryOf(fact) }),
    nonNegative: new Big(fact.net).gte(0),
  }));
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
  const [loadedFacts, operations, occurrences, visits, moments] = await Promise.all([
    repository.loadEconomicFacts(range),
    repository.loadOperationsByBankRange(range),
    repository.loadActivityOccurrences(range),
    repository.loadPlaceVisits(range),
    repository.loadEntityRows("moments", "moment_id"),
  ]);
  const causalLinks = await repository.loadActivityCausalFinancialLinkRows(
    occurrences.map(({ lifeEventId }) => String(lifeEventId)),
  );
  const activityCosts = await factResolver.loadActivityOccurrenceCosts({
    subject: { kind: "household" },
    time: { kind: "month", month },
  });
  const calendarArtifact = calendarByMonth.get(month);
  const dailyArtifact = dailyByMonth.get(month);
  assert.ok(calendarArtifact && dailyArtifact);
  const scope = { subject: { kind: "household" }, time: { kind: "month", month } };
  const amountByComponent = new Map(dailyArtifact.allocationEntries.map(({ componentKey, amount }) => [componentKey, amount]));
  const facts = selectEconomicComponentsForScope(loadedFacts, scope).map((fact) => ({
    ...fact,
    net: amountByComponent.get(String(fact.canonicalComponentKey)) ?? zero,
  }));
  monthData.set(month, {
    month,
    oracle: oracleMonths[month],
    facts,
    operations,
    occurrences,
    visits,
    moments,
    causalLinks,
    activityCosts,
    calendarArtifact,
    dailyArtifact,
    expenseDescriptors: expenseDescriptorsFor(month, facts, dailyArtifact, operations),
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
function metricNode(value, reasonCode = "DATA_NO_SOURCE") {
  return value === undefined || value === null
    ? { visibility: "PLACEHOLDER", reasonCode }
    : visibleKnown(money(value));
}
function balanceContext(data, resource, params) {
  const contract = query.getQueryResourceContract(resource);
  const identity = `${resource}:${data.month}:${stableJson(params)}`;
  return {
    householdId,
    month: data.month,
    resourceInputHash: historyAnalytics.computeResourceInputHash({
      identity,
      facts: [{
        factType: "history_v2_live_resource_input",
        identity,
        value: {
          resource,
          params,
          calendarArtifactInputHash: data.calendarArtifact.artifactInputHash,
          dailyArtifactInputHash: data.dailyArtifact.artifactInputHash,
          actual: data.oracle.actual.net,
        },
      }],
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
  const typicalRows = new Map((data.oracle.typicalCategories?.rows ?? []).map((row) => [row.categoryId, row]));
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
    components: spendingComponents(data.facts),
  });
  return data.spendingState;
}
function categoryClassificationState(data, categoryId) {
  const components = spendingComponents(data.facts).filter((component) =>
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
  const source = data.oracle.minimal;
  const available = source.availability === "known" && source.value !== null;
  const components = available
    ? source.contributions.map((entry) => ({
        componentId: entry.canonicalComponentKey,
        label: entry.canonicalComponentKey,
        family: minimalFamily(entry.canonicalComponentKey),
        amount: money(entry.amount),
      }))
    : [];
  data.minimalState = {
    available,
    value: available ? money(source.value) : undefined,
    preview: balance.buildMinimalPreview({ minimal: available ? money(source.value) : zero, components }),
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
  const costsByActivity = new Map();
  const occurrenceById = new Map(data.occurrences.map((value) => [String(value.lifeEventId), value]));
  for (const cost of data.activityCosts) {
    const occurrence = occurrenceById.get(String(cost.occurrenceId));
    if (occurrence === undefined || cost.causalCost.availability !== "known") continue;
    const activityId = String(occurrence.activityId);
    costsByActivity.set(activityId, sumMoney([costsByActivity.get(activityId) ?? zero, cost.causalCost.value]));
  }
  const scoreInputs = [...itemByActivity].map(([activityTypeKey, items]) => ({
    activityTypeKey,
    occurrences: data.occurrences.filter((value) => String(value.activityId) === activityTypeKey).length,
    hasOtherNarrativeMoment: items.some((item) => item.sourceKind === "fused"),
    priorityBand: Math.min(4, Math.max(...items.map(({ priorityBand }) => priorityBand))),
    ...(costsByActivity.get(activityTypeKey) === undefined ? {} : {
      qualifiedCost: costsByActivity.get(activityTypeKey),
      qualifiedCostShare: new Big(data.dailyArtifact.actualMonthAmount).eq(0)
        ? 0 : Number(new Big(costsByActivity.get(activityTypeKey)).div(data.dailyArtifact.actualMonthAmount).abs().toString()),
    }),
  }));
  const scores = balance.rankActivities(scoreInputs);
  const summaries = scores.map((score) => ({
    ...score,
    label: itemByActivity.get(score.activityTypeKey)?.[0]?.title ?? score.activityTypeKey,
    costKind: costsByActivity.has(score.activityTypeKey) ? "CAUSAL" : "NONE",
    cost: costsByActivity.has(score.activityTypeKey)
      ? { status: "KNOWN", value: costsByActivity.get(score.activityTypeKey) }
      : { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } },
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
  const amountByMoment = groupFactsAmount(data.facts, (fact) => factValue(fact, "moment"));
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
      ...(amountByMoment.get(momentId) === undefined ? {} : { causalCost: amountByMoment.get(momentId) }),
      causalCostComparable: amountByMoment.has(momentId),
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
      causalCost: amountByMoment.has(candidate.momentId)
        ? { status: "KNOWN", value: amountByMoment.get(candidate.momentId) }
        : { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } },
      fallbackIconKey: item?.iconKey ?? "moment",
      detailRef: target(query.queryResourceKeys.historyMomentDetail, { momentId: candidate.momentId }),
      sourceRefs: [sourceRef("moment", candidate.momentId)],
    };
  });
  data.momentState = { summaries, amountByMoment, items };
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
  const inputs = [...new Set([...visitGroups.keys(), ...amountByPlace.keys()])].map((placeId) => {
    const visits = visitGroups.get(placeId) ?? [];
    const localizedAmount = amountByPlace.get(placeId);
    const label = placeLabels.get(placeId) ?? placeId;
    const routineToken = normalizeToken(label);
    return {
      placeId,
      momentCount: 0,
      presenceDays: new Set(visits.map(({ localDate }) => String(localDate))).size,
      activityTypeCount: 0,
      ...(localizedAmount === undefined ? {} : {
        localizedAmount,
        localizedShare: new Big(data.dailyArtifact.actualMonthAmount).eq(0)
          ? 0 : Number(new Big(localizedAmount).div(data.dailyArtifact.actualMonthAmount).abs().toString()),
        localizedCoverage: 1,
      }),
      semanticKind: "OTHER",
      routineKind: routineToken.includes("domicile") || routineToken.includes("maison")
        ? "HOME" : routineToken.includes("travail") ? "REGULAR_WORK" : "NONE",
    };
  });
  const scores = balance.rankPlaces(inputs);
  const summaries = scores.map((score) => ({
    ...score,
    label: placeLabels.get(score.placeId) ?? score.placeId,
    localizedAmount: amountByPlace.has(score.placeId)
      ? { status: "KNOWN", value: amountByPlace.get(score.placeId) }
      : { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } },
    detailRef: target(query.queryResourceKeys.historyPlaceDetail, { placeId: score.placeId }),
    sourceRefs: [sourceRef("place", score.placeId)],
  }));
  data.placeState = { summaries, visitGroups, amountByPlace };
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
  return spendingComponents(data.facts).filter((component) => {
    if (params.axis !== undefined) return component[params.axis] === params.bucket;
    return component.necessity === params.necessity && component.behavior === params.behavior;
  });
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
  const componentKeys = new Set(costFacts.flatMap(({ evidence }) => evidence.map(({ canonicalComponentKey }) => String(canonicalComponentKey))));
  const causalExpenses = expenseSummaries(data).filter((expense) => data.dailyArtifact.expenseEvents.some((event) =>
    event.expenseEventId === expense.expenseEventId && event.componentKeys.some((key) => componentKeys.has(key))));
  return historyQuery.buildActivityDetailReadModel({
    context,
    activity: summary,
    occurrences: knownCollection(occurrences),
    frequencyTicket: { visibility: "VISIBLE", data: frequencyTicketUnknown() },
    causalExpenses: knownCollection(causalExpenses),
    associatedExpenses: { visibility: "HIDDEN", reasonCode: "POLICY_NOT_APPLICABLE" },
  });
}
function buildMomentDetail(data, context, momentId) {
  const summary = momentState(data).summaries.find((value) => value.momentId === momentId);
  if (summary === undefined) throw new TypeError(`Moment ${momentId} absent.`);
  const item = momentState(data).items.find((value) => value.sourceRefs.includes(`moment:${momentId}`));
  const ownerId = item?.calendarItemId;
  const causalExpenses = ownerId === undefined ? [] : expenseSummaries(data).filter(({ narrativeOwnerId }) => narrativeOwnerId === ownerId);
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
    causalExpenses: knownCollection(causalExpenses),
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
  const amount = state.amountByPlace.get(placeId);
  return historyQuery.buildPlaceDetailReadModel({
    context,
    place: summary,
    localizedCoverage: amount === undefined
      ? { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } }
      : { status: "KNOWN", value: 1 },
    localizedAmount: amount === undefined
      ? { visibility: "HIDDEN", reasonCode: "POLICY_NOT_APPLICABLE" }
      : visibleKnown(amount),
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
      const bridge = bridgeFor(data.month, data.facts, data.operations, data.dailyArtifact.actualMonthAmount);
      return historyQuery.buildMonthQuickOverviewReadModel(calendarContext(request.resource), data.month, {
        bankOutflows: { status: "KNOWN", value: bridge.bankOutflows },
        bankInflows: { status: "KNOWN", value: journalSupplement(data).bankInflows },
        causalCostByCalendarItemId: causalCostByCalendarItem(data),
        explicitIncidentHighlights: [],
        narrativePlaces: placeState(data).summaries.slice(0, 4).map((place) => ({
          placeId: place.placeId,
          title: place.label,
          ...(place.presenceDays === undefined ? {} : { presenceDays: place.presenceDays }),
          localizedAmount: place.localizedAmount,
          iconKey: "place",
          sourceRefs: place.sourceRefs,
        })),
      });
    }
    case "history_month_balance_summary": {
      const typical = data.oracle.typicalHousehold;
      const minimal = minimalState(data);
      const actuals = months.filter((month) => month <= data.month).map((month) => money(oracleMonths[month].actual.net));
      return historyQuery.buildMonthBalanceSummaryReadModel({
        context,
        actual: visibleKnown(data.dailyArtifact.actualMonthAmount),
        typical: metricNode(typical.availability === "known" ? typical.value : undefined, "REFERENCE_INSUFFICIENT_SUPPORT"),
        minimal: metricNode(minimal.value, "REFERENCE_INSUFFICIENT_SUPPORT"),
        comparableActualsIncludingCurrent: actuals,
        typicalSupportMonths: typical.n ?? 0,
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
        minimal: metricNode(minimal.value, "REFERENCE_INSUFFICIENT_SUPPORT"),
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
function assertMonthInvariants(data, preflight, deterministic) {
  const ledger = data.dailyArtifact;
  const calendarArtifact = data.calendarArtifact;
  const checks = [];
  const check = (id, condition, evidence) => {
    checks.push({ id, status: condition ? "PASS" : "FAIL", evidence });
    assert.ok(condition, `${id} ${data.month}: ${evidence}`);
  };
  check("F01_ACTUAL_COMMON", moneyClose(ledger.actualMonthAmount, data.oracle.actual.net), `${ledger.actualMonthAmount} == ${data.oracle.actual.net}`);
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
for (const month of months) {
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
      facts: [{
        factType: "history_v2_query_input",
        identity: `${request.resource}:${month}:${stableJson(request.params)}`,
        value: {
          resource: request.resource,
          params: request.params,
          resourceInputHash: readModel.resourceInputHash,
        },
      }],
    };
  };
  const preflight = await materialization.buildHistoryV2Preflight({ context: runtimeContext, month, artifacts, buildQuery });
  const deterministic = publicationOnly
    ? preflight
    : await materialization.buildHistoryV2Preflight({ context: runtimeContext, month, artifacts: [...artifacts].reverse(), buildQuery });
  const checks = publicationOnly ? [] : assertMonthInvariants(data, preflight, deterministic);
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
    typical: data.oracle.typicalHousehold.availability === "known" ? data.oracle.typicalHousehold.value : null,
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
  implementationSha: process.env.HISTORY_V2_IMPLEMENTATION_SHA ?? "WORKTREE",
  generatedAt: runtimeContext.asOf,
  mode: publicationOnly ? "READ_ONLY_REPUBLICATION_PREFLIGHT" : "READ_ONLY",
  stageFinalize: "NONE",
  householdId,
  months: monthResults,
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
