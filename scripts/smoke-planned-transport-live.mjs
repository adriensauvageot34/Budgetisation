import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import "./check-phase2-october-contract.mjs";
const require = createRequire(import.meta.url);
process.loadEnvFile(".env.local");
const { TomTomRouteProvider, FrenchOfficialFuelPriceProvider, HereTollProvider } = require("../src/server/phase2/planned-car-providers.ts");
const { fuelEconomicCost, transportTotals, parseCarSnapshot } = require("../src/domain/phase2/planned-car.ts");
const { createCanonicalReadClient } = require("../src/server/canonical/client.ts");
const { readPlannedContextOptions, readPlannedRouteHistory } = require("../src/server/phase2/planned-context.ts");
const { estimatePlannedCar } = require("../src/server/phase2/planned-car-estimation.ts");
const client = createCanonicalReadClient();
const { data: vehicles, error } = await client.from("vehicles").select("vehicle_id,household_id").eq("status", "active").limit(1);
assert.ifError(error); assert(vehicles?.[0]);
const householdId = vehicles[0].household_id;
const people = await client.from("persons").select("person_id,display_name").eq("household_id", householdId); assert.ifError(people.error);
const options = await readPlannedContextOptions(client, householdId, people.data.map((p) => ({ personId: p.person_id, displayName: p.display_name })));
const historicalTables = ["mobility_legs", "mobility_trips", "operations", "purchase_events", "product_observations", "fuel_price_observations", "referentiel_lieu"];
const { createHash } = require("node:crypto");
async function fingerprint() {
  const result = {};
  for (const table of historicalTables) {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await client.from(table).select("*").range(offset, offset + 999); assert.ifError(page.error);
      rows.push(...page.data); if (page.data.length < 1000) break;
    }
    const hashes = rows.map((r) => createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(r).sort()))).digest("hex")).sort();
    result[table] = { count: rows.length, hash: createHash("sha256").update(hashes.join("")).digest("hex") };
  }
  return result;
}
const before = await fingerprint();
const home = options.places.find((p) => p.name === "Domicile Adrien & Manon"); assert(home?.coordinates);
const local = options.places.find((p) => p.coordinates && !p.privatePlace && p.placeId !== home.placeId
  && Math.abs(p.coordinates.latitude - home.coordinates.latitude) < 0.02 && Math.abs(p.coordinates.longitude - home.coordinates.longitude) < 0.03); assert(local);
const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const route = new TomTomRouteProvider(), fuel = new FrenchOfficialFuelPriceProvider(), toll = new HereTollProvider();
const localResult = await estimatePlannedCar({ plannedDate: date, stops: [home, local, home].map((p, i) => ({ label: p.name, placeId: p.placeId, endpointSource: i === 1 ? "ROOT_PLACE" : "DIRECT_PLACE" })) },
  { places: options.places, vehicle: options.vehicle, history: await readPlannedRouteHistory(client, householdId) }, { route, fuel, toll });
assert.equal(localResult.status, "LIVE"); assert(localResult.snapshot); parseCarSnapshot(localResult.snapshot);
assert.equal(localResult.snapshot.fuelPrice?.source, "FR_GOV_FUEL_INSTANT_V2");
assert.equal(localResult.snapshot.toll.status, "NONE"); assert.equal(localResult.snapshot.toll.amount, "0.00");
// Public toll collection points: an unambiguous motorway trace without courtyard/street map discrepancies.
const motorwayCoordinates = [{ latitude: 43.67048, longitude: 4.0129699, source: "USER_DECLARED" }, { latitude: 45.4761, longitude: 4.8337799, source: "USER_DECLARED" }];
const motorwayRoute = await route.estimateCarRoute({ coordinates: motorwayCoordinates,
  plannedDate: date, plannedTime: "14:00", timeKind: "DEPARTURE", preference: "FASTEST" });
assert(motorwayRoute.hasToll); const motorwayToll = await toll.estimateTolls(motorwayRoute);
const alternate = await route.estimateCarRoute({ coordinates: motorwayCoordinates,
  plannedDate: date, plannedTime: "14:00", timeKind: "DEPARTURE", preference: "AVOID_TOLLS" });
const alternateToll = await toll.estimateTolls(alternate);
const after = await fingerprint(); assert.deepEqual(after, before);
const price = localResult.snapshot.fuelPrice.pricePerLiter;
const summarize = (r, t) => ({ distanceKm: r.distanceKm, durationSeconds: r.durationSeconds, fuelLiters: r.liters, fuelPricePerLiter: price,
  fuelEconomicCost: fuelEconomicCost(r.liters, price), tollStatus: t.status, tollAmount: t.amount,
  ...transportTotals(fuelEconomicCost(r.liters, price), t.amount), geometryHash: r.geometryHash });
const report = { at: new Date().toISOString(), local: summarize(localResult.snapshot.route, localResult.snapshot.toll),
  officialPrice: localResult.snapshot.fuelPrice,
  motorway: summarize(motorwayRoute, motorwayToll), avoidTolls: summarize(alternate, alternateToll), zeroHistoricalWrite: before,
  hereTolls: motorwayToll.status === "KNOWN" && Number(motorwayToll.amount) > 0 ? "PASS" : "UNAVAILABLE" };
if (process.env.PLANNED_TRANSPORT_EVIDENCE_PATH) fs.writeFileSync(process.env.PLANNED_TRANSPORT_EVIDENCE_PATH, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.equal(report.hereTolls, "PASS", "HERE live toll must be positive on the imported motorway route");
assert(["NONE", "KNOWN", "UNAVAILABLE", "UNKNOWN"].includes(alternateToll.status));
assert.equal(alternate.routeMethodRef,"tomtom-planned-car-avoid-tolls@v2");
assert.notEqual(alternate.geometryHash,motorwayRoute.geometryHash);
assert.equal(alternateToll.amount === null, ["UNAVAILABLE", "UNKNOWN"].includes(alternateToll.status));
