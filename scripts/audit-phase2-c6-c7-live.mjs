// Read-only live verification. No auth session, prospective fixture or historical write.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import "./check-phase2-october-contract.mjs";
const require = createRequire(import.meta.url);
const { queryMonthForecast, resolvePlanningMonthForecast } = require("../src/server/phase2/month-forecast-snapshot.ts");
const { readMonthInputs } = require("../src/server/phase2/month-inputs.ts");
const { defaultMonthInputs, deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ["phase2_planned_expenses", "phase2_month_inputs", "operations", "life_events",
  "mobility_trips", "mobility_legs", "analytics_query_snapshots", "analytics_artifacts"];
const counts = async () => Object.fromEntries(await Promise.all(tables.map(async table => {
  const { count, error } = await client.from(table).select("*", { head: true, count: "exact" });
  if (error) throw error;
  return [table, count];
})));
const before = await counts();
const { data: household, error } = await client.from("households").select("household_id").limit(1).single();
if (error) throw error;
const id = household.household_id;
const [october, november, stored] = await Promise.all([
  queryMonthForecast(client, id, "2026-10"), resolvePlanningMonthForecast(client, id, "2026-11"),
  readMonthInputs(client, id, "2026-11"),
]);
assert.equal(november.referencePlan.targetMonth, "2026-11");
assert.equal(november.meta.targetMonth, "2026-11");
assert.equal(november.publicationMeta.publicationId, october.publicationMeta.publicationId);
assert.notDeepEqual(november.referencePlan.flexibleTotal, october.referencePlan.flexibleTotal,
  "target month's workdays are recomputed using current canonical reference evidence");
assert.equal(deriveMonthScenario(november, defaultMonthInputs(), null, "2026-09-30", []).economicPlan, null,
  "unprovided monthly meal resources remain unknown");
assert(!Object.hasOwn(stored.inputs.declaredResources, "benefit:swile"), "no October wallet resource copied");
const ownMonth = { ...stored.inputs, declaredResources: { "benefit:swile": "20.00", "benefit:edenred": "0.00" } };
const simulation = deriveMonthScenario(november, ownMonth, null, "2026-09-30", []).economicPlan;
assert(simulation); assert.equal(simulation.plannedFunding.swile.resource, "20.00");
assert.equal(simulation.plannedFunding.edenred.resource, "0.00");
assert.deepEqual(await counts(), before);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), counts: before,
  novemberOwnReference: "PASS", undeclaredMonthlyResources: "UNKNOWN", simulatedMonthlyResources: "PASS",
  prospectiveWrites: 0, historicalWrites: 0, snapshotWrites: 0 }));
