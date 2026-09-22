import assert from "node:assert/strict";
import fs from "node:fs";
import process from "node:process";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
      for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
    }
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const mobilityImport = await import("../src/server/canonical/mobility-import.ts");
const facts = await import("../src/analytics/facts/index.ts");
const production = await import("../src/analytics/production/index.ts");
const scopeModule = await import("../src/core/scope/index.ts");
const canonicalMobility = await import("../src/server/canonical/mobility.ts");

const sourcePath = process.env.MOBILITY_SOURCE_XLSX;
if (!sourcePath || !fs.existsSync(sourcePath)) {
  throw new Error("MOBILITY_SOURCE_XLSX doit pointer vers le corpus certifié pour ce check.");
}

const householdId = "00000000-0000-4000-8000-000000000001";
let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const rejects = (callback, pattern) => check(() => assert.throws(callback, pattern));
const rejectsAsync = async (callback, pattern) => { await assert.rejects(callback, pattern); checks += 1; };

const first = await mobilityImport.buildCanonicalMobilityImportPlan({ filePath: sourcePath, householdId });
check(() => assert.equal(first.report.status, "PASS"));
check(() => assert.equal(first.report.sourceHash, "7ad636617d1917f7827efb2ef545dede29757d47c58a642246d1dba1b1f20e38"));
check(() => assert.equal(first.report.sourceLegs, 684));
check(() => assert.deepEqual(first.report.sourceGroupCounts, { NAV: 390, JOUR: 77, AUT: 217 }));
check(() => assert.equal(first.report.uniqueSourceLegIds, 684));
check(() => assert.equal(first.report.uniqueCanonicalLegIds, 684));
check(() => assert.equal(first.report.duplicatePhysicalRows, 0));
check(() => assert.equal(first.report.totalDistanceKm, "7370.132"));
check(() => assert.equal(first.report.totalEstimatedFuelLiters, "647.270344"));
check(() => assert.equal(first.report.totalEstimatedFuelCost, "1188.481549222"));
check(() => assert.equal(first.report.periodStart, "2025-08-01"));
check(() => assert.equal(first.report.periodEnd, "2026-07-31"));
check(() => assert.equal(first.report.databaseWrites, 0));
check(() => assert.equal(first.report.financeRowsPlanned, 0));
check(() => assert.equal(first.report.datasetRowsToInsert, 1));
check(() => assert.equal(first.report.legRowsToInsert, 684));
check(() => assert.equal(first.report.resolvedPlaceIdentities, 0));
check(() => assert.equal(first.report.unresolvedPlaceIdentities, 92));
check(() => assert.equal(first.vehicleCandidate.owner_person_id, null));
check(() => assert.match(first.vehicleCandidate.label, /2010.*1\.4 VTi 95.*SP95.*BVM5/));
check(() => assert.equal(first.fuelPriceObservations.length, 12));
check(() => assert.equal(new Set(first.fuelPriceObservations.map(({ fuel_price_observation_id }) => fuel_price_observation_id)).size, 12));
check(() => assert.equal(first.fuelPriceObservations.every(({ observed_at }) => observed_at.endsWith("-01T00:00:00.000Z")), true));
check(() => assert.equal(first.legs.every(({ fuel_price_observation_id }) => typeof fuel_price_observation_id === "string"), true));
check(() => assert.equal(new Set(first.legs.map(({ fuel_price_observation_id }) => fuel_price_observation_id)).size, 12));

const repeated = await mobilityImport.buildCanonicalMobilityImportPlan({
  filePath: sourcePath,
  householdId,
  existing: {
    datasetIds: [first.dataset.dataset_id],
    legIds: first.legs.map(({ mobility_leg_id }) => mobility_leg_id),
  },
});
check(() => assert.equal(repeated.dataset.dataset_id, first.dataset.dataset_id));
check(() => assert.deepEqual(repeated.legs.map(({ mobility_leg_id }) => mobility_leg_id), first.legs.map(({ mobility_leg_id }) => mobility_leg_id)));
check(() => assert.equal(repeated.report.datasetRowsToInsert, 0));
check(() => assert.equal(repeated.report.legRowsToInsert, 0));

check(() => assert.equal(first.legs.every((leg) => ["NAV", "JOUR", "AUT"].includes(String(leg.source_group))), true));
check(() => assert.equal(first.legs.some((leg) => "purpose" in leg || "personaCategory" in leg || "activity" in leg), false));
check(() => assert.equal(first.legs.some((leg) => "participant_ids" in leg || "person_id" in leg), false));
check(() => assert.equal(first.legs.some((leg) => "fuel_paid_amount" in leg || "operation_id" in leg || "allocation_id" in leg), false));
check(() => assert.equal(first.facts.every(({ provenance }) => provenance === "estimated"), true));
check(() => assert.equal(first.facts.every(({ source }) => ["NAV", "JOUR", "AUT"].includes(source.group)), true));
check(() => assert.equal(first.facts.some(({ time }) => time.authority === "PROXY"), true));
check(() => assert.equal(first.facts.some(({ time }) => time.authority === "OBSERVED"), true));
check(() => assert.equal(first.facts.every(({ time }) => time.authority !== "OBSERVED" || time.observedTime !== null), true));
check(() => assert.equal(first.facts.every(({ time }) => time.authority === "OBSERVED" || time.observedTime === null), true));
check(() => assert.equal(first.facts.some(({ fuel }) => fuel.quality === "P4_NATIONAL_FALLBACK" && fuel.geoScope === "NATIONAL"), true));
check(() => assert.equal(first.facts.some(({ fuel }) => fuel.quality === "P4_NATIONAL_FALLBACK" && fuel.geoScope === "LOCAL_DEPARTMENT"), false));
check(() => assert.equal(first.facts.filter(({ fuel }) => fuel.quality === "P3_LOCAL_DEPARTMENT").length, 262));
check(() => assert.equal(first.facts.filter(({ fuel }) => fuel.quality === "P4_NATIONAL_FALLBACK").length, 422));

const sample = first.facts[0];
check(() => assert.deepEqual(facts.parseMobilityLegFact(sample), sample));
const sampleRow = first.legs.find(({ mobility_leg_id }) => mobility_leg_id === sample.legId);
check(() => assert.ok(sampleRow));
const projectedSample = canonicalMobility.projectMobilityLegFactFromCanonicalRow({
  ...sampleRow,
  distance_km_text: sampleRow.distance_km,
  duration_seconds_text: sampleRow.duration_seconds,
  duration_no_traffic_seconds_text: sampleRow.duration_no_traffic_seconds,
  estimated_fuel_liters_text: sampleRow.estimated_fuel_liters,
  estimated_fuel_cost_text: sampleRow.estimated_fuel_cost,
  fuel_price_per_liter_text: sampleRow.fuel_price_per_liter,
});
check(() => assert.deepEqual(projectedSample, sample));
rejects(() => facts.parseMobilityLegFact({ ...sample, provenance: "observed" }), /estimated/);
rejects(() => facts.parseMobilityLegFact({ ...sample, participantIds: ["00000000-0000-4000-8000-000000000002"] }), /clé non autorisée/);
rejects(() => facts.parseMobilityLegFact({ ...sample, distanceKm: "-1" }), /positif ou nul/);
rejects(() => facts.parseMobilityLegFact({ ...sample, time: { ...sample.time, authority: "PROXY", observedTime: "2025-08-01T08:00:00" } }), /non observée/);
rejects(() => facts.parseMobilityLegFact({ ...sample, fuel: { ...sample.fuel, quality: "P4_NATIONAL_FALLBACK", geoScope: "LOCAL_DEPARTMENT" } }), /qualité|P4/i);

const wrongPlaceMap = await mobilityImport.buildCanonicalMobilityImportPlan({
  filePath: sourcePath,
  householdId,
  placeAuthorities: [{ sourceLabel: "not-the-source-label", latitude: "43.5995731", longitude: "3.8925078", placeId: "00000000-0000-4000-8000-000000000099" }],
});
check(() => assert.equal(wrongPlaceMap.report.resolvedPlaceIdentities, 0));
check(() => assert.equal(wrongPlaceMap.report.unresolvedPlaceIdentities, 92));

const firstLeg = first.legs[0];
const explicitlyMapped = await mobilityImport.buildCanonicalMobilityImportPlan({
  filePath: sourcePath,
  householdId,
  placeAuthorities: [{
    sourceLabel: firstLeg.origin_source_label,
    latitude: firstLeg.origin_source_latitude,
    longitude: firstLeg.origin_source_longitude,
    placeId: "00000000-0000-4000-8000-000000000099",
  }],
});
check(() => assert.equal(explicitlyMapped.report.resolvedPlaceIdentities, 1));
check(() => assert.equal(explicitlyMapped.facts.some(({ origin, destination }) =>
  origin.placeId === "00000000-0000-4000-8000-000000000099"
  || destination.placeId === "00000000-0000-4000-8000-000000000099"), true));

check(() => assert.equal(production.metricRegistry.fuel_trip_estimate.additivity.kind, "non_additive"));
check(() => assert.equal(production.metricRegistry.mobility_usage_estimated_fuel_cost.additivity.kind, "additive"));
check(() => assert.deepEqual(production.metricRegistry.mobility_usage_estimated_fuel_cost.sourceFact, ["fct_mobility_leg"]));
check(() => assert.equal(facts.sumMobilityEstimatedFuelCost(first.facts), "1188.481549222"));
const mobilityScope = { subject: { kind: "household" }, time: { kind: "global", observationWindow: "last_12_months", asOf: "2026-07" } };
const normalizedMobilityScope = scopeModule.normalizeAnalysisScope(mobilityScope);
const producedMobilityCost = production.produceMetric({
  metricId: "mobility_usage_estimated_fuel_cost",
  scope: mobilityScope,
  source: {
    kind: "mobility_legs",
    scopeHash: scopeModule.computeScopeHash(normalizedMobilityScope),
    availability: "known",
    facts: first.facts,
  },
});
check(() => assert.equal(producedMobilityCost.value, "1188.481549222"));
check(() => assert.equal(producedMobilityCost.provenance, "estimated"));

const migration = fs.readFileSync(new URL("../supabase/migrations/20260922082729_canonical_mobility_leg_foundation.sql", import.meta.url), "utf8");
check(() => assert.match(migration, /create table public\.mobility_datasets/));
check(() => assert.match(migration, /create table public\.mobility_legs/));
check(() => assert.match(migration, /enable row level security/g));
check(() => assert.doesNotMatch(migration, /persona_mobility|manon_mobility|persona_fuel_cost/i));
check(() => assert.doesNotMatch(migration, /insert\s+into\s+public\.(operations|operation_allocations|operation_items|financial_source_person_links)/i));
check(() => assert.doesNotMatch(migration, /create table public\.mobility_trips/i));

await rejectsAsync(
  () => mobilityImport.buildCanonicalMobilityImportPlan({ filePath: sourcePath, householdId: "not-a-uuid" }),
  /UUID/,
);

console.log(`Canonical Mobility: ${checks}/${checks} PASS; source=${first.report.sourceLegs}; writes=${first.report.databaseWrites}`);
