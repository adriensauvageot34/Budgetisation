import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function load(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolve(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);

class Query {
  constructor(rows) { this.rows = rows; this.filters = []; this.sortKey = ""; this.from = 0; this.to = 999; }
  select() { return this; }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
  gte(key, value) { this.filters.push((row) => String(row[key] ?? "") >= value); return this; }
  lte(key, value) { this.filters.push((row) => String(row[key] ?? "") <= value); return this; }
  order(key) { this.sortKey = key; return this; }
  range(from, to) { this.from = from; this.to = to; return this; }
  then(resolve, reject) {
    return Promise.resolve({ data: this.rows.filter((row) => this.filters.every((filter) => filter(row)))
      .sort((a, b) => String(a[this.sortKey] ?? "").localeCompare(String(b[this.sortKey] ?? ""))).slice(this.from, this.to + 1), error: null }).then(resolve, reject);
  }
}
const tables = {
  life_event_types: [{ life_event_type_id: "work", type_key: "travail_site" }, { life_event_type_id: "out", type_key: "sortie_soiree" }, { life_event_type_id: "friend", type_key: "visite_ami" }],
  life_events: [{ life_event_id: "w1", life_event_type_id: "work", start_date: "2026-01-02", validation_status: "Confirmé" }, { life_event_id: "o1", life_event_type_id: "out", title: "Bar à jeux", start_date: "2026-01-03", validation_status: "Confirmé" }, { life_event_id: "f1", life_event_type_id: "friend", title: "Visite chez Cédric", start_date: "2026-01-06", primary_place_id: "cedric", validation_status: "Confirmé" }],
  life_event_participations: [{ participation_id: "p1", life_event_id: "w1", person_id: "a", participation_status: "Confirmée" }, { participation_id: "p2", life_event_id: "o1", person_id: "a", participation_status: "Confirmée" }, { participation_id: "p3", life_event_id: "f1", person_id: "m", participation_status: "Confirmée" }, { participation_id: "p4", life_event_id: "f1", person_id: "a", participation_status: "Confirmée" }],
  person_place_roles: [{ person_place_role_id: "r1", person_id: "m", place_id: "fontes", role: "FATHER_HOME" }, { person_place_role_id: "r2", person_id: "a", place_id: "ange", role: "WORK_MEAL_ANCHOR" }],
  person_habit_assertions: [{ person_habit_assertion_id: "ha1", household_id: "h", person_id: "a", habit_key: "hairdresser", monthly_visit_estimate: "1.00", typical_visit_price: "20.00", price_basis: "INDICATIVE_PRICE_NOT_PAYMENT", authority: "USER_VALIDATED" }],
  persona_profile_assertions: [{ assertion_id: "pa1", household_id: "h", person_id: "m", assertion_key: "daily_cigarettes", numeric_value: "2.00", authority: "USER_VALIDATED" }, { assertion_id: "pa2", household_id: "h", person_id: "a", assertion_key: "approximate_household_tobacco_budget", authority: "USER_VALIDATED" }, { assertion_id: "pa3", household_id: "h", person_id: "m", assertion_key: "vehicle_maintenance_responsibility", authority: "USER_VALIDATED" }],
  mobility_legs: [
    { mobility_leg_id: "leg-short", household_id: "h", vehicle_id: "car", travel_date: "2025-08-02", distance_km: "4.00", duration_seconds: "1200", estimated_fuel_liters: "0.32", estimated_fuel_cost: "0.60", status: "CERTIFIED_SOURCE" },
    { mobility_leg_id: "leg-long", household_id: "h", vehicle_id: "car", travel_date: "2026-01-02", distance_km: "50.00", duration_seconds: "7200", estimated_fuel_liters: "4.00", estimated_fuel_cost: "7.00", status: "CERTIFIED_SOURCE" },
    { mobility_leg_id: "leg-partial", household_id: "h", vehicle_id: "car", travel_date: "2026-01-03", distance_km: "15.00", duration_seconds: "1800", estimated_fuel_liters: "1.20", estimated_fuel_cost: "2.00", status: "SOURCE_PARTIAL" },
    { mobility_leg_id: "other-car", household_id: "h", vehicle_id: "other", travel_date: "2026-01-03", distance_km: "100.00", duration_seconds: "3600", estimated_fuel_liters: "8.00", estimated_fuel_cost: "15.00", status: "CERTIFIED_SOURCE" },
  ],
  referentiel_lieu: [{ place_id: "fontes", nom_canonique: "Fontès" }, { place_id: "ange", nom_canonique: "Ange" }, { place_id: "cedric", nom_canonique: "Chez Cédric" }],
  person_days: [{ person_day_id: "d1", person_id: "m", date: "2026-01-04" }, { person_day_id: "d2", person_id: "a", date: "2026-01-04" }, { person_day_id: "d3", person_id: "m", date: "2026-01-05" }],
  location_occurrences: [{ localization_id: "l1", person_day_id: "d1", person_id: "m", place_id: "fontes" }, { localization_id: "l2", person_day_id: "d1", person_id: "m", place_id: "fontes" }, { localization_id: "l3", person_day_id: "d2", person_id: "a", place_id: "ange" }, { localization_id: "l4", person_day_id: "d3", person_id: "m", place_id: "fontes" }],
  needs: [{ need_id: "vape", need_key: "vape_manon", person_id: "m" }, { need_id: "meal-a", need_key: "repas_travail_adrien", person_id: "a" }, { need_id: "tobacco", need_key: "tabac_foyer" }],
  tags: [{ tag_id: "photo", tag_key: "Contexte:projet_photo" }, { tag_id: "car", tag_key: "Contexte:voiture" }],
  operation_tags: [{ operation_tag_id: "t1", operation_id: "buy", tag_id: "photo" }, { operation_tag_id: "t2", operation_id: "refund", tag_id: "photo" }, { operation_tag_id: "t3", operation_id: "maintenance", tag_id: "car" }],
  operations: [
    { operation_id: "buy", montant: "-64.28", date_transaction_reelle: "2026-01-05" },
    { operation_id: "refund", montant: "27", date_transaction_reelle: "2026-01-06", rembourse_operation_id: "buy" },
    { operation_id: "vape-direct", need_id: "vape", montant: "-23.80", date_transaction_reelle: "2026-01-07" },
    { operation_id: "meal-ange", need_id: "meal-a", marchand: "Boulangerie Ange", montant: "-5.90", date_transaction_reelle: "2026-01-05" },
    { operation_id: "vape-parent", montant: "-64.50", date_transaction_reelle: "2026-01-08" },
    { operation_id: "insurance-old", recurrence_series_id: "ins-old", montant: "-100", date_transaction_reelle: "2026-01-02" },
    { operation_id: "insurance-current", recurrence_series_id: "ins-current", montant: "-80", date_transaction_reelle: "2026-01-11" },
    { operation_id: "insurance-isolated", recurrence_series_id: "ins-isolated", montant: "-80", date_transaction_reelle: "2026-01-12" },
    { operation_id: "insurance-refund", montant: "80", rembourse_operation_id: "insurance-isolated", date_transaction_reelle: "2026-01-13" },
    { operation_id: "maintenance", montant: "-30", date_transaction_reelle: "2026-01-14" },
  ],
  product_observations: [],
  operation_items: [{ item_id: "vi1", operation_id: "vape-parent", need_key: "vape_manon", nom: "Vaporesso kit", montant_economique: "38.01", uncertain: false }, { item_id: "vi2", operation_id: "vape-parent", need_key: "vape_manon", nom: "Fioles de goût", montant_economique: "12.00", uncertain: false }],
  recurrence_series: [
    { recurrence_series_id: "ins-old", series_key: "ornikar-assurances-assurances-assurance-automobile", marchand_normalise: "Ornikar Assurances", statut_serie: "Historique / interrompue" },
    { recurrence_series_id: "ins-current", series_key: "pacifica-assurances-assurance-automobile-contrat-140394759", marchand_normalise: "Pacifica", statut_serie: "Active" },
    { recurrence_series_id: "ins-isolated", series_key: "pacifica-assurances-auto-contrat-140804629", marchand_normalise: "Pacifica", statut_serie: "Historique / occurrence isolée" },
  ],
  financial_economic_cost_canonical: [
    { operation_id: "insurance-old", canonical_component_key: "old", canonical_economic_gross: "100", refund_applied: "0", canonical_economic_net: "100" },
    { operation_id: "insurance-current", canonical_component_key: "current", canonical_economic_gross: "80", refund_applied: "0", canonical_economic_net: "80" },
    { operation_id: "insurance-isolated", canonical_component_key: "isolated", canonical_economic_gross: "80", refund_applied: "80", canonical_economic_net: "0" },
    { operation_id: "maintenance", canonical_component_key: "maintenance", canonical_economic_gross: "30", refund_applied: "0", canonical_economic_net: "30" },
  ],
  financial_source_person_links: [
    { financial_source_person_link_id: "payer-old", operation_id: "insurance-old", person_id: "m", relation_type: "payer", validated_by: "USER_VALIDATED:P4.8-A1", validated_at: "2026-01-15" },
    { financial_source_person_link_id: "payer-current", operation_id: "insurance-current", person_id: "m", relation_type: "payer", validated_by: "USER_VALIDATED:P4.8-A1", validated_at: "2026-01-15" },
  ],
  operation_place_canonical: [], life_event_financial_links: [], operation_allocations: [{ allocation_id: "va1", operation_id: "vape-parent", need_id: "vape", montant: "64.50" }],
  vehicles: [{ vehicle_id: "car", household_id: "h", owner_person_id: null, label: "Peugeot 207", status: "active" }],
};
const clientFor = (data) => ({ from(table) { assert.ok(table in data, `unexpected table ${table}`); return new Query(data[table]); } });
const { resolveGlobalPersonaEditorial } = require(path.resolve(root, "src/server/analytics/global-v2-persona-editorial.ts"));
const inputFor = (data) => ({ client: clientFor(data), householdId: "h", personIdsByName: { Adrien: "a", Manon: "m" }, firstDay: "2026-01-01", certifiedThrough: "2026-01-31", m1Series: [{ recurrenceId: "ins-old", typicalOccurrenceCost: { status: "KNOWN", value: "100.00" } }, { recurrenceId: "ins-current", typicalOccurrenceCost: { status: "KNOWN", value: "80.00" } }], m2NeedGroups: [{ dimension: { id: "vape" }, annualAmount: "88.30", historicalSeries: [{ month: "2026-01", amount: "88.30" }] }, { dimension: { id: "tobacco" }, annualAmount: "2400.00" }], mobilitySummaries: [] });
const model = await resolveGlobalPersonaEditorial(inputFor(tables));
assert.equal(model.schemaVersion, "persona-editorial@v2");
assert.equal(model.persons[0].work.onsiteDays, 1);
assert.equal(model.persons[0].socialLife.outingsWithoutPartnerParticipation.length, 1);
assert.equal(model.persons[0].personalUniverses.photo.grossCost, "64.28");
assert.equal(model.persons[0].personalUniverses.photo.netCost, "37.28");
assert.equal(model.persons[1].socialLife.fatherHome[0].presenceDays, 2);
assert.equal(model.persons[1].socialLife.fatherHome[0].visitCount, 1);
assert.equal(model.persons[1].socialLife.friendVisits[0].label, "Chez Cédric");
assert.equal(model.persons[1].socialLife.friendVisits[0].visitCount, 1);
assert.equal(model.persons[0].recurringHabits.hairdresser.personalAnnualCost, null);
assert.equal(model.persons[0].recurringHabits.hairdresser.illustrativeAnnualCost, "240.00");
assert.equal(model.persons[0].recurringHabits.hairdresser.typicalVisitPrice, "20.00");
assert.equal(model.persons[0].work.workMeals.merchantHabitSummary.purchaseCount, 1);
assert.equal(model.persons[0].work.workMeals.allPurchaseHabitSummary.purchaseCount, 1);
assert.deepEqual(model.persons[0].work.workMeals.allPurchaseHabitSummary.merchants, ["Boulangerie Ange"]);
assert.equal(model.persons[0].work.workMeals.merchantHabitSummary.annualObservedCost, null);
assert.equal(model.persons[0].work.workMeals.anchorPresence.presenceDays, 1);
assert.deepEqual(model.persons[1].socialLife.fatherHome[0].monthlyPresenceSegments["2026-01"], [true, false, false, false]);
assert.equal(model.persons[1].work.workMeals.merchantHabitSummary.purchaseCount, 0);
assert.equal(model.persons[1].work.commute.strictOwnerSummary, null);
assert.equal(model.vehicleHouseholdCost.vehicle.label, "Peugeot 207");
assert.equal(model.vehicle.insuranceSummary.currentProvider, "Pacifica");
assert.equal(model.vehicle.insuranceSummary.currentMonthlyCost, "80.00");
assert.equal(model.vehicle.insuranceSummary.periodCost, "180.00");
assert.equal(model.vehicle.insuranceSummary.payerPersonId, "m");
assert.equal(model.vehicle.insuranceSummary.payerAuthority, "USER_VALIDATED");
assert.equal(model.vehicle.insuranceSummary.isolatedRefundResolved, true);
assert.equal(model.vehicle.maintenanceSummary.totalIdentifiedCost, "30.00");
assert.equal(model.vehicle.storySummary.period.first, "2025-02-01");
assert.equal(model.vehicle.storySummary.usage.distanceKm, "54.00");
assert.equal(model.vehicle.storySummary.usage.distinctUsageDays, 2);
assert.equal(model.vehicle.storySummary.usage.drivingHours, "2.33");
assert.equal(model.vehicle.storySummary.usage.estimatedFuelLiters, "4.32");
assert.equal(model.vehicle.storySummary.usage.estimatedFuelCost, "7.60");
assert.equal(model.vehicle.storySummary.tripProfile.shortTrips.tripShare, "50");
assert.equal(model.vehicle.storySummary.tripProfile.longTrips.distanceShare, "92.6");
assert.equal(model.vehicle.storySummary.insuranceEvolution.previousProvider, "Ornikar Assurances");
assert.equal(model.vehicle.storySummary.insuranceEvolution.currentProvider, "Pacifica");
assert.equal(model.vehicle.storySummary.insuranceEvolution.monthlyDifference, "20.00");
assert.deepEqual(model.vehicle.storySummary.maintenanceRhythm.peakMonths, ["2026-01"]);
assert.equal(model.vehicle.nonFuelCostTotal, "210.00");
assert.equal(model.vehicle.nonFuelCostTotalReady, true);
assert.equal(model.vehicle.householdVehicle.scope, "HOUSEHOLD");
assert.equal(model.vehicle.workUsageSummary, null);
assert.equal(Object.hasOwn(model.vehicle, "fuelPaidAmount"), false);
assert.equal(model.persons[1].recurringHabits.vape.allocatedObservedCost, "64.50");
assert.equal(model.persons[1].recurringHabits.vape.equipmentCost, "38.01");
assert.equal(model.persons[1].recurringHabits.cigarettesPerDay, "2.00");
assert.equal(model.persons[0].recurringHabits.tobacco.approximateMonthlyBudget, "200.00");
assert.equal(model.vehicle.maintenanceResponsibilityPersonId, "m");
assert.equal(model.persons[1].recurringHabits.vape.reconciledToM2, true);
const payerUnknown = await resolveGlobalPersonaEditorial(inputFor({ ...tables, financial_source_person_links: [] }));
assert.equal(payerUnknown.vehicle.insuranceSummary.payerAuthority, "UNKNOWN");
assert.equal(payerUnknown.vehicle.insuranceSummary.payerPersonId, null);
assert.equal(payerUnknown.vehicle.nonFuelCostTotal, "210.00");
const refundUnresolved = await resolveGlobalPersonaEditorial(inputFor({ ...tables, financial_economic_cost_canonical: tables.financial_economic_cost_canonical.map((row) => row.operation_id === "insurance-isolated" ? { ...row, refund_applied: "0", canonical_economic_net: "80" } : row) }));
assert.equal(refundUnresolved.vehicle.insuranceSummary.isolatedRefundResolved, false);
assert.equal(refundUnresolved.vehicle.nonFuelCostTotalReady, false);
assert.equal(refundUnresolved.vehicle.nonFuelCostTotal, null);
console.log("PERSONA_EDITORIAL_FOUNDATION=PASS");
