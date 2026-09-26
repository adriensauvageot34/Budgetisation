import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const householdId = process.argv.find((arg) => arg.startsWith("--household-id="))?.split("=")[1];
const targetMonth = process.argv.find((arg) => arg.startsWith("--target-month="))?.split("=")[1];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || !householdId || !targetMonth) throw new TypeError("LIVE_FORECAST_CONFIG_MISSING");
const secretKeyFetch = async (input, init) => {
  const request = new Request(input, init);
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  const withoutBearer = new Request(request, { headers });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(withoutBearer.clone());
    if (response.status !== 401 || !(await response.clone().text()).includes("JWT issued at future")) return response;
    if (attempt === 2) throw new TypeError("SUPABASE_API_CLOCK_SKEW");
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
};
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  ...(key.startsWith("sb_secret_") ? { global: { fetch: secretKeyFetch } } : {}) });
const { queryMonthForecast } = require(path.resolve(root, "src/server/phase2/month-forecast-snapshot.ts"));
const { readMonthInputs } = require(path.resolve(root, "src/server/phase2/month-inputs.ts"));
const { deriveMonthScenario } = require(path.resolve(root, "src/server/phase2/month-scenario.ts"));
const forecast = await queryMonthForecast(client, householdId, targetMonth);
const original = JSON.stringify(forecast);
const stored = await readMonthInputs(client, householdId, targetMonth);
const inputs = stored.inputs;
const today = new Date().toISOString().slice(0, 10);
const base = deriveMonthScenario(forecast, inputs, null, today);
const numeric = (value) => Number(value);
const near = (actual, expected, label) => assert.ok(Math.abs(numeric(actual) - expected) < 0.01, `${label}: ${actual}`);

// 1. A genuinely additive purchase changes economic and prudent cash availability by its exact delta.
const purchase = deriveMonthScenario(forecast, inputs, { amount: "150", parentEnvelope: null,
  amountAlreadyCoveredByParentEnvelope: "0" }, today);
near(purchase.whatIf.additiveImpact, 150, "what-if impact");
near(purchase.freeToSpend.central, numeric(base.freeToSpend.central) - 150, "what-if FreeToSpend");
near(purchase.cashPrudent.central, numeric(base.cashPrudent.central) - 150, "what-if prudent cash");

// 2. The part already inside a published parent envelope is replaced, not added again.
const partial = deriveMonthScenario(forecast, inputs, { amount: "150", parentEnvelope: "personal-care",
  amountAlreadyCoveredByParentEnvelope: "50" }, today);
near(partial.whatIf.additiveImpact, 100, "parent replacement");
near(partial.freeToSpend.central, numeric(base.freeToSpend.central) - 100, "parent FreeToSpend");
const planned = deriveMonthScenario(forecast, { ...inputs, plannedEvents: [{ id: randomUUID(), label: "Événement de test",
  plannedCost: "150", baselineDisplaced: "50", parentEnvelope: "personal-care", plannedDate: `${targetMonth}-15` }] }, null, today);
near(planned.userPlannedEventDelta, 100, "event baseline displacement");
near(planned.freeToSpend.central, numeric(base.freeToSpend.central) - 100, "event economic replacement");

// 3. Missing declarations remain unknown, including future events.
const unknown = deriveMonthScenario(forecast, { ...inputs, openingBalance: null,
  benefit: { currentBalance: null, expectedLoading: null }, plannedEvents: [] }, null, today);
assert.equal(unknown.availableNow.status, "UNAVAILABLE");
assert.equal(unknown.benefitPotential, null);
assert.equal(unknown.userPlannedEventDelta, null);
assert.equal(unknown.undeclaredEventDelta, null);
assert.equal(JSON.stringify(forecast), original, "published payload must stay immutable");
const withOpening = deriveMonthScenario(forecast, { ...inputs, openingBalance: { amount: "1000", asOfDate: today } }, null, today);
assert.equal(withOpening.availableNow.status, "AVAILABLE");
near(withOpening.availableNow.value, 1000 - numeric(inputs.safetyReserve), "AvailableNow current-date opening");
console.log(JSON.stringify({ status: "PASS", tests: 3, targetMonth, publicationId: forecast.meta.sourcePublicationId,
  sourceRevision: forecast.meta.sourceRevision, analyticsRevision: forecast.meta.analyticsRevision,
  freeToSpendBefore: base.freeToSpend.central, freeToSpendAfter150: purchase.freeToSpend.central,
  cashPrudentBefore: base.cashPrudent.central, cashPrudentAfter150: purchase.cashPrudent.central,
  partialImpact: partial.whatIf.additiveImpact, persistedInputs: stored.updatedAt !== null }));
