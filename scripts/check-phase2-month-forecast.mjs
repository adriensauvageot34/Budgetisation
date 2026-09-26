import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
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
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const args = new Map(process.argv.slice(2).map((entry) => {
  const separator = entry.indexOf("=");
  return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
}));
const householdId = args.get("--household-id");
const targetMonth = args.get("--target-month");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !householdId || !targetMonth) throw new TypeError("SUPABASE_URL, server key, --household-id and --target-month are required");
const secretKeyFetch = async (input, init) => {
  const request = new Request(input, init);
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  const withoutBearer = new Request(request, { headers });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(withoutBearer.clone());
    if (response.status !== 401 || !(await response.clone().text()).includes("JWT issued at future")) return response;
    if (attempt === 2) throw new TypeError(`SUPABASE_API_CLOCK_SKEW:${new URL(request.url).pathname}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new TypeError("SUPABASE_API_RETRY_EXHAUSTED");
};
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  ...(key.startsWith("sb_secret_") ? { global: { fetch: secretKeyFetch } } : {}),
});
const { loadMonthForecastAuthorities } = require(path.resolve(root, "src/server/phase2/live-month-forecast.ts"));
const { assembleMonthForecast, sumAdditiveForecastComponents } = require(path.resolve(root, "src/server/phase2/month-forecast.ts"));
const authorities = await loadMonthForecastAuthorities(client, householdId);
const forecast = assembleMonthForecast(authorities, targetMonth);
const numeric = (value) => value === null ? null : Number(value);
const near = (actual, expected, tolerance, label) => {
  assert.notEqual(actual, null, `${label} unavailable`);
  assert.ok(Math.abs(numeric(actual) - expected) <= tolerance, `${label}: ${actual} differs from ${expected} by more than ${tolerance}`);
};
const central = (key) => forecast.components.find((entry) => entry.key === key)?.central ?? null;

console.log(JSON.stringify({
  publication: forecast.meta.sourcePublicationId,
  sourceRevision: forecast.meta.sourceRevision,
  analyticsRevision: forecast.meta.analyticsRevision,
  targetMonth,
  foodMethod: authorities.background.food.methodVersion,
  obligationCount: forecast.components.filter((entry) => entry.additiveGroup === "obligations").length,
  conditionalCount: forecast.components.filter((entry) => entry.knowledgeState === "CONDITIONAL_UNKNOWN").length,
  income: forecast.income.central,
  obligations: forecast.obligations,
  food: central("food"), health: central("health"), care: central("personal-care"),
  tobacco: central("tobacco-vape"), coffee: central("work-coffee"), animals: central("animal-care"),
  mobilityUsage: central("mobility-usage"), economicCost: forecast.economicCost,
  cashGross: forecast.cash.grossBeforeUnconfirmedFunding,
  benefitHistorical: forecast.funding.benefitHistoricalRange,
  freeToSpend: forecast.freeToSpend,
  availableNow: forecast.availableNow.status,
}, null, 2));
if (args.has("--inspect")) process.exit(0);
if (args.has("--ui-mapping")) {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { queryMonthForecast } = require(path.resolve(root, "src/server/phase2/month-forecast-snapshot.ts"));
  const { MonthForecastView } = require(path.resolve(root, "src/features/phase2/month-forecast-view.tsx"));
  const queried = await queryMonthForecast(client, householdId, targetMonth);
  const render = (payload) => renderToStaticMarkup(React.createElement(MonthForecastView, { forecast: payload }));
  const html = render(queried);
  assert.match(html, /985,48\s*€/u);
  assert.match(html, /2[\s\u00a0\u202f]*363,51\s*€/u);
  assert.match(html, /aucun événement enregistré/iu);
  assert.match(html, /Delta financier : Inconnu/u);
  assert.match(html, /indisponible sans solde d’ouverture/u);
  assert.doesNotMatch(html, /0\s*€\s*événements/iu);
  const changed = structuredClone(queried);
  changed.freeToSpend.central = "12345.67";
  assert.match(render(changed), /12[\s\u00a0\u202f]*345,67\s*€/u);
  assert.doesNotMatch(render(changed), /985,48\s*€/u);
  console.log(JSON.stringify({ test: "PASS UI payload mapping and UNKNOWN visibility", targetMonth,
    publicationId: queried.meta.sourcePublicationId, htmlBytes: Buffer.byteLength(html) }));
  process.exit(0);
}
if (args.has("--round-trip")) {
  const { materializeMonthForecast, queryMonthForecast, MONTH_FORECAST_RESOURCE } = require(path.resolve(root, "src/server/phase2/month-forecast-snapshot.ts"));
  const snapshot = await materializeMonthForecast(client, householdId, targetMonth);
  const queried = await queryMonthForecast(client, householdId, targetMonth);
  const business = ({ meta, components, income, obligations, economicCost, cash, funding, events, reserve, freeToSpend, availableNow, limitations }) => ({
    meta: { targetMonth: meta.targetMonth, sourcePublicationId: meta.sourcePublicationId,
      sourceRevision: meta.sourceRevision, analyticsRevision: meta.analyticsRevision, certificationStatus: meta.certificationStatus },
    components, income, obligations, economicCost, cash, funding, events, reserve, freeToSpend, availableNow, limitations,
  });
  assert.deepEqual(business(snapshot), business(forecast));
  assert.deepEqual(business(queried), business(snapshot));
  const { count, error: countError } = await client.from("analytics_query_snapshots")
    .select("query_snapshot_id", { count: "exact", head: true })
    .eq("household_id", householdId).eq("resource", MONTH_FORECAST_RESOURCE)
    .eq("period_month", `${targetMonth}-01`).eq("is_active", true).is("invalidated_at", null);
  if (countError) throw countError;
  assert.equal(count, 1);
  console.log(JSON.stringify({ test: "PASS engine=snapshot=query", resource: MONTH_FORECAST_RESOURCE,
    contractVersion: snapshot.resourceMeta.contractVersion, methodSignature: snapshot.resourceMeta.methodSignature,
    publicationId: snapshot.meta.sourcePublicationId, targetMonth, activeSnapshotCount: count,
    computedAt: snapshot.meta.computedAt, queryFreeToSpendCentral: queried.freeToSpend.central }));
  process.exit(0);
}

// Golden amounts are test expectations from the October master, never production constants.
assert.equal(authorities.background.food.methodVersion, "global_food_rhythm@v2-purchase-aware");
near(forecast.obligations.low, 1140, 1, "obligations low");
near(forecast.obligations.central, 1143.51, 0.01, "obligations central");
near(forecast.obligations.high, 1145, 1, "obligations high");
near(central("food"), 690, 35, "Food central");
near(central("health"), 25, 10, "health central");
near(central("personal-care"), 70, 10, "care central");
near(central("tobacco-vape"), 290, 10, "tobacco central");
near(central("work-coffee"), 35, 10, "coffee central");
near(central("animal-care"), 5, 5, "animal central");
near(central("mobility-usage"), 105, 15, "mobility usage central");
near(forecast.income.central, 3548.99, 0.01, "income central");
near(forecast.economicCost.low, 2190, 20, "economic low");
near(forecast.economicCost.central, 2363.51, 0.01, "economic central");
near(forecast.economicCost.high, 2560, 20, "economic high");
near(forecast.freeToSpend.central, 985.48, 0.01, "FreeToSpend central");
assert.equal(forecast.reserve.amount, "200");
assert.equal(forecast.economicCost.coverage, "KNOWN_BASELINE_ONLY");
assert.equal(forecast.availableNow.status, "UNAVAILABLE");
assert.equal(forecast.events.knowledgeState, "UNKNOWN");
assert.ok(forecast.components.some((entry) => /Ornikar|Alma/iu.test(entry.label) && entry.knowledgeState === "CONDITIONAL_UNKNOWN"));
console.log("PASS golden forecast");

const benefitChanged = structuredClone(authorities);
benefitChanged.background.food.monthlyBenefitFunding = benefitChanged.background.food.monthlyBenefitFunding.map(([month, value]) => [month, String(Number(value) + 100)]);
const benefitForecast = assembleMonthForecast(benefitChanged, targetMonth);
assert.deepEqual(benefitForecast.economicCost, forecast.economicCost);
assert.deepEqual(benefitForecast.cash.grossBeforeUnconfirmedFunding, forecast.cash.grossBeforeUnconfirmedFunding);
assert.notDeepEqual(benefitForecast.cash.afterPotentialBenefit, forecast.cash.afterPotentialBenefit);
console.log("PASS Benefit funding separate from consumption");

const paidChanged = structuredClone(authorities);
paidChanged.background.carMobility.months = paidChanged.background.carMobility.months.map((month) => ({
  ...month, observedFuelPaid: { ...month.observedFuelPaid, amount: String(Number(month.observedFuelPaid.amount) + 100) },
}));
const paidForecast = assembleMonthForecast(paidChanged, targetMonth);
assert.deepEqual(paidForecast.economicCost, forecast.economicCost);
assert.notDeepEqual(paidForecast.cash.grossBeforeUnconfirmedFunding, forecast.cash.grossBeforeUnconfirmedFunding);
console.log("PASS fuel paid separate from fuel usage");

const additive = forecast.components.filter((entry) => entry.additiveGroup !== "obligations");
const food = additive.find((entry) => entry.key === "food");
const baseline = sumAdditiveForecastComponents(additive);
const withExplanatoryChild = sumAdditiveForecastComponents([
  ...additive, { ...food, key: "food:restaurant-child", parentEnvelope: "food", additiveGroup: "food", nature: "EXPLANATORY" },
]);
assert.deepEqual(withExplanatoryChild, baseline);
const replacement = { ...food, key: "food:new-envelope", replaces: ["food"], central: String(Number(food.central) + 10) };
const replaced = sumAdditiveForecastComponents([...additive, replacement]);
near(replaced.central, Number(baseline.central) + 10, 0.01, "replacement without double count");
console.log("PASS parent and child nonadditive");
