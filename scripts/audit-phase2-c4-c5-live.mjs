// Read-only certification. Run with server environment; never commits live payloads or credentials.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import "./check-phase2-october-contract.mjs";
const require = createRequire(import.meta.url);
const { readPlannedContextOptions, readPlannedRouteHistory } = require("../src/server/phase2/planned-context.ts");
const { resolvePlannedRoute } = require("../src/domain/phase2/planned-routes.ts");
const { SOCIAL_CONTACTS_V1 } = require("../src/domain/phase2/planned-rules.ts");
const { derivePlannedPlaceRoles } = require("../src/domain/phase2/planned-place-rules.ts");
const { queryMonthForecast } = require("../src/server/phase2/month-forecast-snapshot.ts");
const { readMonthInputs } = require("../src/server/phase2/month-inputs.ts");
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const { simulatePlannedExpense } = require("../src/server/phase2/planned-expenses.ts");
const { projectPlannedExpenseImpact } = require("../src/server/phase2/planned-impact.ts");
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const households = await client.from("households").select("household_id").limit(1).single();
if (households.error) throw households.error;
const householdId = households.data.household_id;
const counts = {};
for (const table of ["phase2_planned_expenses", "mobility_legs", "mobility_trips"]) {
  const result = await client.from(table).select("*", { head: true, count: "exact" }).eq("household_id", householdId);
  if (result.error) throw result.error;
  counts[table] = result.count;
}
const people = await client.from("persons").select("person_id,display_name").eq("household_id", householdId).eq("status", "active");
if (people.error) throw people.error;
const options = await readPlannedContextOptions(client, householdId,
  people.data.map((person) => ({ personId: person.person_id, displayName: person.display_name })));
const history = await readPlannedRouteHistory(client, householdId);
assert(options.vehicle);
const home = options.places.find((place) => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
assert(home, "canonical home role");
const point = (placeId) => ({ label: "Lieu canonique", placeId });
for (const key of ["manon_father", "lucas", "cedric"]) {
  const contact = SOCIAL_CONTACTS_V1.find((contact) => contact.key === key);
  const destination = contact.places.find((link) => link.placeId)?.placeId;
  const route = resolvePlannedRoute([point(home.placeId), point(destination), point(home.placeId)], history, options.vehicle);
  console.log(JSON.stringify({ oracle: key, status: route.status, distanceKm: route.fuelEstimate?.distanceKm ?? null,
    fuelCost: route.fuelEstimate?.cost ?? null, directedDistances: route.stops.slice(0, -1).map((stop) => stop.distanceToNextKm),
    observedAt: options.vehicle.fuelPriceObservedAt }));
  // Dated certification oracles re-read on 2026-09-30 Europe/Paris; never product constants.
  const oracles = { manon_father: { status: "KNOWN", directed: ["62.962", "64.342"], cost: "20.83" },
    lucas: { status: "PARTIAL", directed: ["6.196", null], cost: null },
    cedric: { status: "KNOWN", directed: ["13.169", "14.327"], cost: "4.96" } };
  assert.equal(route.status, oracles[key].status);
  assert.deepEqual(route.stops.slice(0, -1).map((stop) => stop.distanceToNextKm), oracles[key].directed);
  assert.equal(route.fuelEstimate?.cost ?? null, oracles[key].cost);
  const completedStops = route.stops.map((stop, index, all) => index !== all.length - 1 && !stop.distanceToNextKm
    ? { ...stop, distanceToNextKm: "8.000", distanceSource: "MANUAL" } : stop);
  const completed = resolvePlannedRoute(completedStops, history, options.vehicle);
  assert(completed.fuelEstimate);
  const draft = { familyKey: "visit_trip", subtypeKey: "friend_visit", title: "Audit sans écriture", plannedDate: null,
    context: { personVisited: { kind: "TEXT", label: "Contact prospectif" }, route: { mode: "CAR", stops: completed.stops, fuelEstimate: completed.fuelEstimate } },
    costItems: [{ id: "00000000-0000-4000-8000-000000000011", assetKey: "transport:fuel_usage", label: "Usage carburant", quantity: "1",
      unitAmount: completed.fuelEstimate.cost, baselineKey: null, modulePath: ["visit_friend"], priceSource: "CALCULATED" }] };
  const forecast = await queryMonthForecast(client, householdId, "2026-10");
  const { inputs } = await readMonthInputs(client, householdId, "2026-10");
  const before = deriveMonthScenario(forecast, inputs, null, "2026-09-30", []).economicPlan;
  const after = (await simulatePlannedExpense(client, householdId, forecast, inputs, [], draft, "2026-09-30")).economicPlan;
  const impact = projectPlannedExpenseImpact(before, after, draft);
  assert.equal(impact.payableGross, "0.00");
  assert.equal(after.plannedFunding.bankAllocated, "0.00");
  assert.equal(impact.grossCost, impact.netAdditionalImpact.central);
  const invalidEvidence = structuredClone(draft);
  invalidEvidence.context.route.stops.find((stop) => stop.evidence).evidence.observationCount += 1;
  assert.deepEqual((await simulatePlannedExpense(client, householdId, forecast, inputs, [], invalidEvidence, "2026-09-30")).economicPlan,
    after, "C6 now re-resolves untrusted/stale route observations using current canonical truth");
}
for (const [table, count] of Object.entries(counts)) {
  const result = await client.from(table).select("*", { head: true, count: "exact" }).eq("household_id", householdId);
  if (result.error) throw result.error;
  assert.equal(result.count, count);
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), counts, liveRouteServerValidation: "PASS", liveOctoberScenario: "PASS", writes: 0 }));
