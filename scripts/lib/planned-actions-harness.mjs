import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { forecast, inputs, referenceEvidence } from "../check-phase2-october-contract.mjs";
import { plannedExpenseMemoryClient } from "./planned-expense-memory-client.mjs";
const require = createRequire(import.meta.url);

/** Runs the real server actions, parsers, resolver, mutations and finance engine.
 * Only authenticated transport, canonical reads and Next invalidation are faked. */
export function planningHarness() {
  const householdId = randomUUID(), userId = randomUUID();
  const client = plannedExpenseMemoryClient();
  const facts = { places: [], vehicle: null, history: [], inputs: { "2026-10": structuredClone(inputs) },
    refreshes: 0, monthReads: [], canonicalReads: 0 };
  const canonical = { from(table) {
    assert.equal(table, "analytics_query_snapshots");
    return { select() { return this; }, eq() { return this; }, is() { return this; }, order() { return this; },
      limit() { return this; }, maybeSingle() { return Promise.resolve({ data: { period_month: "2026-10-01" }, error: null }); } };
  } };
  require("../../src/server/canonical/client.ts").createCanonicalReadClient = () => canonical;
  const live = require("../../src/server/phase2/planned-context.ts");
  live.readPlannedContextOptions = async (_client, id) => {
    facts.canonicalReads++;
    return { places: id === householdId ? structuredClone(facts.places) : [], vehicle: facts.vehicle,
      prices: [], persons: [] };
  };
  live.readPlannedRouteHistory = async () => structuredClone(facts.history);
  require("../../src/server/bootstrap/auth.ts").getAuthenticatedBootstrapClient = async () => ({ supabase: client, user: { id: userId } });
  require("../../src/server/bootstrap/queries.ts").getCurrentHousehold = async () => ({ householdId, timezone: "Europe/Paris" });
  const snapshots = require("../../src/server/phase2/month-forecast-snapshot.ts");
  const { buildMonthReference } = require("../../src/server/phase2/month-reference.ts");
  const forecastFor = month => ({ ...structuredClone(forecast), meta: { ...forecast.meta, targetMonth: month },
    referencePlan: buildMonthReference(referenceEvidence, month, []) });
  snapshots.queryMonthForecast = async (_client, _household, month) => {
    if (month !== "2026-10") throw new TypeError("FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING");
    return forecast;
  };
  snapshots.resolvePlanningMonthForecast = async (_client, _household, month) => {
    facts.monthReads.push(month);
    return forecastFor(month);
  };
  const monthInputs = require("../../src/server/phase2/month-inputs.ts");
  const { defaultMonthInputs } = require("../../src/server/phase2/month-scenario.ts");
  monthInputs.readMonthInputs = async (_client, _household, month) => ({ inputs: structuredClone(facts.inputs[month] ?? defaultMonthInputs()),
    updatedAt: null, updatedBy: null });
  require("next/cache").revalidatePath = () => { facts.refreshes++; };
  const actions = require("../../src/app/mois-a-venir/planned-expenses-actions.ts");
  const service = require("../../src/server/phase2/planned-expenses.ts");
  return { client, facts, actions, service, householdId, userId, forecast, forecastFor, inputs };
}

export const value = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
export const item = (amount = "25.00", assetKey = null, modulePath = ["other"], allocations) => ({
  id: randomUUID(), assetKey, modulePath, label: "Coût explicite", quantity: "1", unitAmount: amount,
  baselineKey: null, ...(allocations ? { fundingAllocations: allocations } : {}),
});
export const draft = (items = [item()], date = "2026-10-05") => ({ familyKey: "other", subtypeKey: null,
  title: "Projet synthétique", plannedDate: date, context: {}, costItems: items });
