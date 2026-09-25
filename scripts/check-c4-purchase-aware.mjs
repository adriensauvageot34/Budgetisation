import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { adaptSwileWorkbook } from "./swile-source-adapter.mjs";
import { importBenefitSnapshot } from "../src/server/imports/generic-benefit-importer.mjs";
import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

const [sourcePath, masterPath, fixturePath] = process.argv.slice(2);
if (!sourcePath || !masterPath || !fixturePath || !process.env.PGLITE_MODULE_PATH || !process.env.SWILE_PYTHON) {
  throw new Error("Usage: SWILE_PYTHON=... PGLITE_MODULE_PATH=... node check-c4-purchase-aware.mjs <source.xlsx> <master.xlsx> <fixture-dir>");
}
const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) { return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain); };
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const dto = await adaptSwileWorkbook(sourcePath, masterPath);
const db = new PGlite();
const query = (sql, params = []) => db.query(sql, params);
const migrations = [
  "20260829231059_purchase_event_identity.sql",
  "20260829231101_economic_component_classifications.sql",
  "20260925003500_generic_benefit_purchase_foundation.sql",
  "20260925113000_purchase_event_visibility_scope.sql",
  "20260925153000_purchase_event_semantic_context.sql",
  "20260925160000_purchase_event_classification_assertions.sql",
];
const base = `
create role anon; create role authenticated; create role service_role;
create schema private;
create table public.households (household_id uuid primary key);
create table public.canonical_household_scope_control (household_id uuid, household_count bigint, status text);
create table public.persons (person_id uuid primary key, household_id uuid not null references public.households);
create table public.bank_accounts (bank_account_id uuid primary key);
create table public.import_batches (import_batch_id uuid primary key, household_id uuid not null references public.households,
  bank_account_id uuid references public.bank_accounts, source_system text not null, file_hash text not null,
  period_start date, period_end date, imported_at timestamptz default now(), status text,
  unique (household_id, source_system, file_hash));
create table public.operations (operation_id uuid primary key, montant_bancaire_depense numeric(18,2));
create table public.operation_allocations (allocation_id uuid primary key);
create table public.operation_items (item_id uuid primary key);
create table public.payment_components (payment_component_id uuid primary key);
create table public.cash_economic_uses (cash_use_id uuid primary key);
create table public.merchants (merchant_id uuid primary key);
create table public.categories (category_id uuid primary key);
create table public.subcategories (subcategory_id uuid primary key);
create table public.needs (need_id uuid primary key);
`;

try {
  await db.exec(base);
  for (const name of migrations) await db.exec(fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8"));
  await query("insert into public.households values ($1)", [dto.batch.householdId]);
  await query("insert into public.canonical_household_scope_control values ($1,1,'READY')", [dto.batch.householdId]);
  for (const purchase of dto.purchases.filter(({ owner }) => owner.kind === "operation")) {
    await query("insert into public.operations values ($1,$2)", [purchase.owner.operationId, purchase.funding.find(({ kind }) => kind === "BANK_CARD").amount]);
  }
  for (const [table, column, values] of [
    ["merchants", "merchant_id", dto.purchases.map(({ merchant }) => merchant.id)],
    ["categories", "category_id", dto.purchases.map(({ categoryId }) => categoryId)],
    ["subcategories", "subcategory_id", dto.purchases.map(({ subcategoryId }) => subcategoryId)],
    ["needs", "need_id", dto.purchases.map(({ needId }) => needId)],
  ]) for (const value of new Set(values.filter(Boolean))) await query(`insert into public.${table} (${column}) values ($1)`, [value]);
  const imported = await importBenefitSnapshot(db, dto);
  assert.equal(imported.status, "IMPORTED");
  const pilotTables = {};
  for (const name of ["purchase_events", "purchase_event_memberships", "purchase_event_timing_assertions",
    "purchase_economic_components", "economic_component_classifications", "purchase_event_classification_assertions",
    "purchase_funding_components", "benefit_wallets"]) {
    pilotTables[name] = (await query(`select * from public.${name}`)).rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date
        ? /(?:_date|_month|_start|_end)$/u.test(key) ? value.toISOString().slice(0, 10) : value.toISOString()
        : value])));
  }

  const fixtureTables = loadFixtureTables(fixturePath);
  const household = fixtureTables.get("households")?.[0];
  assert.equal(dto.batch.householdId, household.household_id);
  const revision = fixtureTables.get("household_revisions")?.find(({ household_id }) => household_id === household.household_id);
  assert.equal(String(revision.data_revision), "8");
  const persons = (fixtureTables.get("persons") ?? []).filter(({ household_id }) => household_id === household.household_id)
    .map((row) => ({ personId: row.person_id, householdId: row.household_id, displayName: row.display_name, status: row.status }));
  const periods = (fixtureTables.get("analysis_periods") ?? []).filter(({ household_id }) => household_id === household.household_id)
    .map((row) => ({ analysisPeriodId: row.analysis_period_id, householdId: row.household_id, month: row.month,
      financeStatus: row.finance_status, lifeStatus: row.life_status, locationStatus: row.location_status,
      calendarStatus: row.calendar_status, isClosed: row.is_closed, sourceRevision: String(row.source_revision) }));
  const context = { userId: "c4-disposable", householdId: household.household_id, persons,
    personIds: persons.map(({ personId }) => personId), timezone: household.timezone, periods,
    dataRevision: String(revision.data_revision), analyticsRevision: String(revision.analytics_revision),
    contractVersion: "v2", asOf: "2026-09-24T00:00:00Z" };
  const client = createFixtureSupabaseClient(fixturePath, { tableRows: pilotTables,
    emptyTables: ["life_event_continuity_assertions"] });
  const { CanonicalRepository } = require(path.join(root, "src/server/canonical/repository.ts"));
  const { FactSourceResolver } = require(path.join(root, "src/server/analytics/fact-source-resolver.ts"));
  const { resolveGlobalM2HouseholdAuthority } = require(path.join(root, "src/server/analytics/global-v2-category-needs-authority.ts"));
  const { resolveGlobalGroceryCandidateAdapter } = require(path.join(root, "src/server/analytics/global-v2-candidate-adapters.ts"));
  const { resolveGlobalBackgroundRhythmsProduction, projectGlobalFoodEconomicComponents } = require(path.join(root, "src/server/analytics/global-v2-background-rhythms-production.ts"));
  const { resolveGlobalFoodGroceryPurchaseAwarePilot } = require(path.join(root, "src/server/analytics/global-v2-food-grocery-pilot.ts"));
  const { buildGlobalActivityCostProfile } = require(path.join(root, "src/analytics/global-v2/routines.ts"));
  const repository = new CanonicalRepository(client, context);
  const resolver = new FactSourceResolver(repository);
  const months = periods.filter(({ isClosed, month }) => isClosed && month >= "2025-08-01" && month <= "2026-07-01")
    .sort((a, b) => a.month.localeCompare(b.month)).map(({ month }) => month.slice(0, 7));
  assert.equal(months.length, 12);
  const range = { start: "2025-08-01", endExclusive: "2026-08-01" };
  const [m2, occurrenceBatches, costBatches, taxonomy, minimalBundle] = await Promise.all([
    resolveGlobalM2HouseholdAuthority({ repository, resolver, targetMonth: "2026-07" }),
    Promise.all(months.map((month) => resolver.loadActivityOccurrences({ subject: { kind: "household" }, time: { kind: "month", month } }))),
    Promise.all(months.map((month) => resolver.loadActivityOccurrenceCosts({ subject: { kind: "household" }, time: { kind: "month", month } }))),
    repository.loadCalendarEconomicTaxonomy(), repository.loadMinimalPlanningBundle(range),
  ]);
  const occurrences = occurrenceBatches.flat();
  const costs = costBatches.flat();
  const defaultCanonical = await repository.loadPurchaseAwareCanonical(range, "DEFAULT");
  assert.deepEqual(defaultCanonical.facts, minimalBundle.economicFacts);
  const defaultProfiles = [...new Set(occurrences.map(({ activityId }) => String(activityId)))].sort()
    .map((activityId) => buildGlobalActivityCostProfile({ activityId, occurrences, activityCosts: costs }));
  const defaultGrocery = resolveGlobalGroceryCandidateAdapter({ months, occurrences,
    activityCostProfiles: defaultProfiles, m2MonthlyComponents: m2.transformationMonthlyComponents,
    subcategoryRows: taxonomy.subcategories });
  const defaultBackground = await resolveGlobalBackgroundRhythmsProduction({ client, repository, months,
    grocery: defaultGrocery, subcategoryRows: taxonomy.subcategories, minimalBundle, occurrences, activityCosts: costs });
  const pilot = await resolveGlobalFoodGroceryPurchaseAwarePilot({ repository, months,
    minimalBundle, occurrences, activityCosts: costs,
    m2MonthlyComponents: m2.transformationMonthlyComponents, subcategoryRows: taxonomy.subcategories });
  const { canonical, economicComponents, correctedCosts, grocery, food, carMobility } = pilot;
  assert.equal(canonical.status, "PASS", JSON.stringify(canonical.blocking));
  const purchaseComponents = economicComponents.filter(({ purchaseEventId }) => purchaseEventId !== null);
  assert.equal(pilotTables.purchase_events.length, 200);
  assert.equal(purchaseComponents.length, 195, "Five August 2026 purchases fall outside the twelve-month FOOD period.");
  assert.equal(purchaseComponents.filter(({ sourceType }) => sourceType === "OPERATION").length, 54);
  assert.equal(purchaseComponents.filter(({ sourceType }) => sourceType === "PURCHASE_COMPONENT").length, 141);
  const classify = ({ subcategoryKey, semanticPurpose }) => subcategoryKey === "alimentation__courses_alimentaires" ? "COURSES"
    : ["restauration__restaurant", "restauration__fast_food_snack"].includes(subcategoryKey)
      || (subcategoryKey === "alimentation__boulangerie" && semanticPurpose === "WORK_LUNCH") ? "RESTAURANT"
      : subcategoryKey === "restauration__livraison_de_repas" ? "DELIVERY" : "OUT_OF_FOOD";
  assert.deepEqual(Object.fromEntries(["COURSES", "RESTAURANT", "DELIVERY", "OUT_OF_FOOD"].map((bucket) =>
    [bucket, purchaseComponents.filter((component) => classify(component) === bucket).length])),
  { COURSES: 45, RESTAURANT: 63, DELIVERY: 8, OUT_OF_FOOD: 79 });
  assert.deepEqual(Object.fromEntries(["COURSES", "RESTAURANT", "DELIVERY", "OUT_OF_FOOD"].map((bucket) =>
    [bucket, dto.purchases.filter(({ oracle }) => oracle.foodVerdict === bucket).length])),
  { COURSES: 47, RESTAURANT: 64, DELIVERY: 8, OUT_OF_FOOD: 81 });
  const mixedExample = dto.purchases.find((purchase) => purchase.grossAmount === "30.80"
    && purchase.funding.some(({ kind, amount }) => kind === "BANK_CARD" && amount === "5.80")
    && purchase.funding.some(({ kind, amount }) => kind === "BENEFIT_WALLET" && amount === "25.00"));
  assert.ok(mixedExample);
  assert.deepEqual(purchaseComponents.filter(({ canonicalComponentKey }) => canonicalComponentKey === `operation:${mixedExample.owner.operationId}`)
    .map(({ amount }) => amount), [{ status: "KNOWN", value: "30.8" }]);
  assert.ok(purchaseComponents.some(({ sourceType, amount }) => sourceType === "PURCHASE_COMPONENT"
    && amount.status === "KNOWN" && Number(amount.value) === 25));
  assert.ok(purchaseComponents.some(({ amount }) => amount.status === "LOWER_BOUND" && Number(amount.minimum) === 9.4));
  assert.ok(purchaseComponents.some(({ amount }) => amount.status === "KNOWN" && Number(amount.value) === 24.46));
  assert.equal(correctedCosts.length, costs.length);
  assert.deepEqual(correctedCosts.map(({ occurrenceId }) => occurrenceId), costs.map(({ occurrenceId }) => occurrenceId));
  assert.ok(correctedCosts.some((cost, index) => cost.causalCost.availability === "known"
    && costs[index].causalCost.availability === "known"
    && Number(cost.causalCost.value) > Number(costs[index].causalCost.value)));
  assert.ok(correctedCosts.every((cost, index) => JSON.stringify(cost.evidence) === JSON.stringify(costs[index].evidence)));
  const missingMerchants = [...new Map(dto.purchases.filter(({ merchant }) =>
    !(fixtureTables.get("merchants") ?? []).some(({ merchant_id }) => merchant_id === merchant.id))
    .map(({ merchant }) => [merchant.id, merchant.name])).entries()].map(([id, name]) => ({ id, name }));
  assert.equal(missingMerchants.length, 17);
  assert.equal((await query("select count(*)::int value from public.merchants")).rows[0].value >= 17, true);
  assert.deepEqual(carMobility, defaultBackground.carMobility);
  assert.equal(defaultBackground.food.annual.total, "6738.58");
  assert.equal(defaultBackground.food.annual.deliveryBehavior.paymentCount, 8);
  assert.deepEqual(defaultGrocery.thresholds, { p25: "18.29", p75: "51.99" });
  const oracleProcess = spawnSync(process.env.SWILE_PYTHON, ["-c",
    "import json,openpyxl,sys; s=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)['25_A3_DELTA_ORACLE']; r=list(s.values); h=r[3]; print(json.dumps([dict(zip(h,x)) for x in r[4:] if x[0] and str(x[0]).startswith('202')]))",
    masterPath], { encoding: "utf8" });
  if (oracleProcess.status !== 0) throw new Error(oracleProcess.stderr);
  const oracle = JSON.parse(oracleProcess.stdout);
  assert.equal(oracle.length, 36);
  const bucketField = { COURSES: "courses", RESTAURANT: "restaurants", DELIVERY: "deliveries" };
  const cents = (value) => Math.round(Number(value) * 100);
  const mismatches = oracle.flatMap((row) => {
    const actual = food.months.find(({ month }) => month === row.month);
    const baseline = defaultBackground.food.months.find(({ month }) => month === row.month);
    const field = bucketField[row.stream];
    const knowledge = actual?.amountKnowledge?.[field];
    return cents(baseline?.[field]) === cents(row.baseline_food)
      && cents(knowledge?.exactKnownSubtotal) - cents(baseline?.[field]) === cents(row.exact_incremental_correction)
      && cents(knowledge?.minimumTotal) - cents(knowledge?.exactKnownSubtotal) === cents(row.lower_bound_incremental_minimum)
      && cents(actual?.[field]) === cents(row.target_minimum_total)
      && knowledge?.status === row.target_knowledge_state ? []
      : [{ month: row.month, stream: row.stream, expected: row.target_minimum_total,
        actual: actual?.[field], baseline: baseline?.[field], exactKnown: knowledge?.exactKnownSubtotal,
        expectedKnowledge: row.target_knowledge_state, actualKnowledge: knowledge?.status }];
  });
  assert.equal(food.annual.amountKnowledge.total.exactKnownSubtotal, "8443.82");
  assert.equal(food.annual.total, "8546.07");
  assert.equal(food.months.filter(({ quality }) => quality.financialKnowledge === "KNOWN").length, 6);
  assert.equal(food.months.filter(({ quality }) => quality.financialKnowledge === "LOWER_BOUND").length, 6);
  assert.equal(food.annual.restaurantBehavior.purchaseCount, 154);
  assert.equal(food.annual.restaurantBehavior.semanticOccurrenceCount, 148);
  assert.equal(food.annual.restaurantBehavior.knownCostOccurrenceCount, 28);
  assert.equal(food.annual.restaurantBehavior.medianCost.status, "GATED");
  assert.equal(food.annual.deliveryBehavior.purchaseCount, 13);
  assert.equal(food.annual.deliveryBehavior.occurrenceStatus, "UNKNOWN");
  assert.ok(food.months.filter(({ quality }) => quality.financialKnowledge === "LOWER_BOUND")
    .every(({ nonGroceryShare, nonGroceryShareKnowledge }) => nonGroceryShare === null && nonGroceryShareKnowledge.status === "GATED"));
  assert.ok(food.annotations.every(({ fromMonth, toMonth }) =>
    food.months.find(({ month }) => month === fromMonth)?.quality.financialKnowledge === "KNOWN"
    && food.months.find(({ month }) => month === toMonth)?.quality.financialKnowledge === "KNOWN"));
  assert.ok(food.months.flatMap(({ compositionHighlights }) => Object.values(compositionHighlights).flat())
    .some(({ sourceType, stableSourceId }) => sourceType === "PURCHASE_COMPONENT" && stableSourceId.startsWith("purchase-event:")));
  assert.notEqual(food.inputHash, defaultBackground.food.inputHash);
  assert.notEqual(grocery.inputHash, defaultGrocery.inputHash);
  const fundingVariantClient = createFixtureSupabaseClient(fixturePath, { tableRows: {
    ...pilotTables,
    purchase_funding_components: [...pilotTables.purchase_funding_components,
      ...pilotTables.purchase_funding_components.map((row) => ({ ...row, purchase_funding_component_id: `${row.purchase_funding_component_id}:duplicate` }))],
    benefit_wallets: [...pilotTables.benefit_wallets, { ...pilotTables.benefit_wallets[0], benefit_wallet_id: "variant-wallet" }],
  }, emptyTables: ["life_event_continuity_assertions"] });
  const fundingVariantRepository = new CanonicalRepository(fundingVariantClient, context);
  const fundingVariantCanonical = await fundingVariantRepository.loadPurchaseAwareCanonical(range, "PURCHASE_AWARE_PILOT");
  const fundingVariantComponents = projectGlobalFoodEconomicComponents({ canonical: fundingVariantCanonical,
    bundle: minimalBundle, subcategoryRows: taxonomy.subcategories });
  assert.deepEqual(fundingVariantComponents, economicComponents);
  // Compare the complete DEFAULT candidate under identical fixture data, with and without pilot tables.
  const eventRows = fixtureTables.get("life_events") ?? [];
  const eventsById = new Map(eventRows.map((row) => [row.life_event_id, row]));
  const momentLinks = fixtureTables.get("moment_life_events") ?? [];
  const primaryPlacesByMoment = new Map();
  for (const link of momentLinks) {
    const place = eventsById.get(link.life_event_id)?.primary_place_id;
    if (!place) continue;
    const places = primaryPlacesByMoment.get(link.moment_id) ?? new Set();
    places.add(place);
    primaryPlacesByMoment.set(link.moment_id, places);
  }
  const duplicateLink = momentLinks.find((link) => primaryPlacesByMoment.get(link.moment_id)?.size === 1
    && eventsById.get(link.life_event_id)?.primary_place_id);
  assert.ok(duplicateLink);
  const localizationRows = [
    { life_event_id: "152b3ea2-7161-5aca-8969-0dfa9cd11949", localization_id: "1bbf13ca-c4ad-5c29-8a17-d8d12c5e72df", location_certainty: "Confirmé", role: "Contexte" },
    { life_event_id: "152b3ea2-7161-5aca-8969-0dfa9cd11949", localization_id: "c387cc67-8506-5ec4-8b8d-ab7888fa53f1", location_certainty: "Confirmé", role: "Contexte" },
    { life_event_id: duplicateLink.life_event_id, localization_id: "aff5f0f9-793c-5333-9c14-47a9009c411d", location_certainty: "Confirmé", role: "Contexte" },
  ];
  const locationRows = [
    ...(fixtureTables.get("location_occurrences") ?? []),
    { localization_id: "1bbf13ca-c4ad-5c29-8a17-d8d12c5e72df", place_id: "45b9c4a9-4da2-5768-9aa0-4f8d32549fbb" },
    { localization_id: "c387cc67-8506-5ec4-8b8d-ab7888fa53f1", place_id: "9c6b6a7a-3301-5a8c-ad5c-64446f6cbb12" },
    { localization_id: "aff5f0f9-793c-5333-9c14-47a9009c411d", place_id: eventsById.get(duplicateLink.life_event_id).primary_place_id },
  ];
  const sharedRows = { life_event_localizations: localizationRows, location_occurrences: locationRows };
  const emptyPilotRows = Object.fromEntries(Object.keys(pilotTables).map((table) => [table, []]));
  const defaultFixtureClient = createFixtureSupabaseClient(fixturePath, { tableRows: { ...emptyPilotRows, ...sharedRows },
    emptyTables: ["life_event_continuity_assertions"] });
  const populatedFixtureClient = createFixtureSupabaseClient(fixturePath, { tableRows: { ...pilotTables, ...sharedRows },
    emptyTables: ["life_event_continuity_assertions"] });
  const { resolveGlobalV2ProductionOwnerOutputs } = require(path.join(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
  const { buildGlobalV2CandidateFromOwnerOutputs } = require(path.join(root, "src/server/analytics/global-v2-candidate.ts"));
  const defaultOwners = await resolveGlobalV2ProductionOwnerOutputs(new CanonicalRepository(defaultFixtureClient, context));
  const populatedOwners = await resolveGlobalV2ProductionOwnerOutputs(new CanonicalRepository(populatedFixtureClient, context));
  assert.deepEqual(populatedOwners.ownerOutputs, defaultOwners.ownerOutputs);
  assert.deepEqual(populatedOwners.backgroundRhythms, defaultOwners.backgroundRhythms);
  assert.deepEqual(populatedOwners.groceryAuthority, defaultOwners.groceryAuthority);
  const candidateInput = (owners) => ({
    project: "ipuuhxrblxormwgoaqnz", householdId: household.household_id,
    householdTimeZone: household.timezone, personIds: persons.map(({ personId }) => personId),
    asOf: context.asOf, certifiedThrough: "2026-07-31", dataRevision: String(revision.data_revision),
    analyticsRevision: String(revision.analytics_revision),
    implementationIdentity: "d87bac7e96d6934c7e7a0e6e48f181d34326ffd8",
    ownerOutputs: owners.ownerOutputs, eventMobilityAuthority: owners.eventMobilityAuthority,
    presentationLabels: owners.presentationLabels, candidateAdapters: owners.candidateAdapters,
    momentComponentPresentation: owners.momentComponentPresentation,
  });
  const defaultCandidate = buildGlobalV2CandidateFromOwnerOutputs(candidateInput(defaultOwners));
  const populatedCandidate = buildGlobalV2CandidateFromOwnerOutputs(candidateInput(populatedOwners));
  assert.deepEqual(populatedCandidate, defaultCandidate);
  console.log(JSON.stringify({ c4: mismatches.length === 0 ? "PASS" : "ORACLE_MISMATCH",
    importedPurchases: pilotTables.purchase_events.length, canonicalFacts: canonical.facts.length,
    foodAnnual: food.annual, groceryThresholds: grocery.thresholds,
    groceryOccurrenceCount: grocery.months.reduce((n, m) => n + m.occurrenceCount, 0),
    groceryKnownCostCount: grocery.months.reduce((n, m) => n + m.knownCostOccurrenceCount, 0),
    groceryEligibleMonths: grocery.eligibleMonthCount, monthStreamOraclePassCount: 36 - mismatches.length,
    mismatches, carInputHash: carMobility.inputHash,
    defaultCarInputHash: defaultBackground.carMobility.inputHash,
    defaultFoodInputHash: defaultBackground.food.inputHash,
    pilotFoodInputHash: food.inputHash,
    defaultGroceryInputHash: defaultGrocery.inputHash,
    pilotGroceryInputHash: grocery.inputHash,
    fundingDirectFoodImpact: 0, walletCreditFoodImpact: 0,
    defaultGlobalCandidateEquality: "PASS", defaultArtifactCount: defaultCandidate.artifacts.length,
    defaultSnapshotCount: defaultCandidate.snapshots.length,
    merchantReferencesResolvedEphemeral: missingMerchants }, null, 2));
  assert.deepEqual(mismatches, []);
} finally {
  await db.close();
}
