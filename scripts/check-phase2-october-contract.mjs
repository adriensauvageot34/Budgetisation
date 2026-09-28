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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const { defaultMonthInputs, deriveMonthScenario } = require(path.resolve(root, "src/server/phase2/month-scenario.ts"));
const { buildMonthReference, RESTAURANT_SUBCATEGORIES } = require(path.resolve(root, "src/server/phase2/month-reference.ts"));
const months = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 7 + index, 1));
  return date.toISOString().slice(0, 7);
});
const observations = [
  ["Courses alimentaires", [479.74, 662.71, 546.58, 417.80, 251.30, 547.71, 363.95, 259.16, 353.74, 397.06, 556.16, 439.97]],
  ["Bureau de tabac / presse", [330.80, 229.90, 323.00, 315.65, 416.95, 190.70, 315.20, 387.10, 211.40, 231.88, 343.75, 297.28]],
  ["Restaurant", [23.60, 244.14, 52.10, 167.40, 149.97, 62.45, 10.80, 45.70, 73.80, 121.10, 139.30, 51.50]],
  ["Boulangerie", [15.20, 22.60, 24.95, 44.60, 31.10, 3.95, 8.60, 38.45, 15.40, 6.20, 27.20, 43.80]],
];
const economicEntries = observations.flatMap(([subcategory, amounts]) => amounts.map((amount, index) => ({
  operationId: `fixture-${subcategory}-${index}`, date: `${months[index]}-01`, amount: amount.toFixed(2),
  subcategory, person: subcategory === "Boulangerie" ? "Adrien" : null,
  preciseType: subcategory === "Boulangerie" ? "Repas du midi au travail" : null, merchant: null,
})));
for (let index = 0; index < 8; index += 1) economicEntries.push({
  operationId: `manon-meal-${index}`, date: `2026-07-${String(index + 2).padStart(2, "0")}`,
  amount: index === 7 ? "4.84" : "4.85", subcategory: "Boulangerie", person: "Manon",
  preciseType: "Repas du midi au travail", merchant: null,
});
for (let index = 0; index < 129; index += 1) {
  const day = new Date(Date.UTC(2025, 7, index + 1)).toISOString().slice(0, 10);
  const amount = index < 33 ? "1.65" : index < 97 ? "2.95" : index < 128 ? "4.00" : "8.70";
  economicEntries.push({ operationId: `coffee-${index}`, date: day, amount,
    subcategory: "Café au travail", person: null, preciseType: null, merchant: "Bibal" });
}
for (const excluded of ["Bar", "Glacier / dessert", "Café / salon de thé", "Activité / loisir"])
  economicEntries.push({ operationId: `excluded-${excluded}`, date: "2026-07-01", amount: "9999.00",
    subcategory: excluded, person: null, preciseType: null, merchant: null });
const mobilityLegs = [];
for (let index = 0; index < 180; index += 1) {
  const date = new Date(Date.UTC(2025, 7, index + 1)).toISOString().slice(0, 10);
  mobilityLegs.push({ date, origin: "Domicile Adrien & Manon", destination: "Promotrans – Montpellier", fuelCost: "0.92" },
    { date, origin: "Promotrans – Montpellier", destination: "Domicile Adrien & Manon", fuelCost: "0.92" });
  if (index < 18) mobilityLegs.push({ date, origin: "Promotrans – Montpellier",
    destination: "Marie Blachère – Montpellier sud", fuelCost: "0.165" },
    { date, origin: "Marie Blachère – Montpellier sud", destination: "Promotrans – Montpellier", fuelCost: "0.165" });
}
const referencePlan = buildMonthReference({ startMonth: "2025-08", endMonth: "2026-07", economicEntries, mobilityLegs },
  "2026-10", ["2025-08-04", "2025-09-03", "2025-10-05"].map((date) => ({ componentKey: "obligation:edf", date })));
assert.deepEqual(referencePlan.necessaryTotal, { low: "632.00", central: "788.00", high: "929.00" });
assert.deepEqual(referencePlan.flexibleTotal, { low: "79.00", central: "177.93", high: "397.00" });
assert.deepEqual(referencePlan.restaurantCorpus, [...RESTAURANT_SUBCATEGORIES]);
assert.equal(referencePlan.flexible.find((item) => item.key === "household-restaurants")?.central, "68.13");
assert.equal(referencePlan.flexible.some((item) => item.key === "manon-work-coffee"), false);
const fixedEntries = [
  ["rent", "Nexity – Loyer", "717.37"], ["edf", "EDF", "78.20"], ["max", "Max", "13.99"],
  ["habitation", "Pacifica habitation", "8.98"], ["legal", "Pacifica protection juridique", "8.92"],
  ["alerts", "Crédit Agricole Alertes SMS", "2.75"], ["civil", "Pacifica responsabilité civile", "6.57"],
  ["sfr1", "SFR NCNTEU-01", "62.13"], ["water", "Eau", "23.00"], ["sfr2", "SFR NCNTEU-02", "14.99"],
  ["account", "Crédit Agricole tenue de compte", "1.72"], ["sfr3", "SFR N6DDPV-01", "37.18"],
  ["google-one", "Google One 100 Go", "1.99"], ["auto", "Pacifica automobile", "84.71"],
  ["offer", "Crédit Agricole Offre Essentiel", "5.00"], ["chatgpt", "ChatGPT", "21.05"],
  ["sfr4", "SFR 121K9JZRA", "36.98"], ["qobuz", "Qobuz", "14.99"], ["google-ai", "Google AI Pro", "2.99"],
];
const fixed = fixedEntries.map(([id, label, amount]) => ({ key: `obligation:${id}`, label,
  nature: "CONTRACTUAL_EXPECTED", additiveGroup: "obligations", knowledgeState: "PROBABLE",
  low: amount, central: amount, high: amount }));
const salaries = [["Digital Learning Contest", "1988.39"], ["Promotrans", "1560.60"]].map(([source, amount]) => ({
  key: `income:${source}`, label: source, central: amount,
}));
const forecast = { meta: { targetMonth: "2026-10", sourcePublicationId: "test" }, components: [...fixed,
  { key: "obligation:ornikar", label: "Ornikar / Alma", nature: "CONDITIONAL_UNKNOWN",
    knowledgeState: "CONDITIONAL_UNKNOWN", additiveGroup: null, central: null, low: null, high: null }],
  income: { low: "3548.99", central: "3548.99", high: "3548.99", components: salaries },
  obligations: { low: "1143.51", central: "1143.51", high: "1143.51" },
  economicCost: { low: "2363.51", central: "2363.51", high: "2363.51" },
  freeToSpend: { low: "985.48", central: "985.48", high: "985.48" },
  cash: { grossBeforeUnconfirmedFunding: { low: "2363.51", central: "2363.51", high: "2363.51" } },
  reserve: { amount: "200.00" }, referencePlan };
const source = JSON.stringify(forecast);
const inputs = { ...defaultMonthInputs(), declaredResources: { "benefit:swile": "190.00", "benefit:edenred": "190.00" },
  excludedFixedObligations: ["obligation:qobuz", "obligation:google-ai"],
  fixedAmountOverrides: { "obligation:rent": { amount: "255.74", dueDate: "2026-10-04", reason: "MONTH_EXCEPTION" } },
  confirmedObligations: [{ componentKey: "obligation:ornikar", amount: "183.33", dueDate: "2026-10-13" }],
  declaredOutflows: [{ id: "00000000-0000-4000-8000-000000000001", label: "Épargne voyage", amount: "1200.00",
    dueDate: null, kind: "SAVINGS" }] };
const plan = (current = inputs) => deriveMonthScenario(forecast, current, null, "2026-09-28").economicPlan;
const baseline = plan();
assert.ok(baseline);
assert.deepEqual(baseline.resources.map((item) => item.amount), ["1988.39", "1560.60", "190.00", "190.00"]);
assert.equal(baseline.salaryCash, "3548.99");
assert.equal(baseline.mealBenefits, "380.00");
assert.equal(baseline.economicResources, "3928.99");
assert.equal(baseline.certainOutflows.total, "2047.23");
assert.equal(baseline.afterCertainOutflows, "1881.76");
assert.deepEqual(baseline.scenarios, { lowConsumption: "1170.76", central: "915.83", highConsumption: "555.76" });
assert.equal(baseline.automaticEventProvision, "0.00");
assert.equal(baseline.certainOutflows.items.find((item) => item.key === "obligation:rent")?.amount, "255.74");
assert.equal(baseline.certainOutflows.items.find((item) => item.key === "obligation:rent")?.dateCertainty, "DECLARED");
assert.deepEqual(baseline.certainOutflows.items.filter((item) => item.key === "obligation:edf")
  .map((item) => [item.date, item.dateCertainty]), [["2026-10-04", "HISTORICAL_ESTIMATE"]]);
assert.equal(baseline.certainOutflows.items.filter((item) => item.key === "obligation:ornikar").length, 1);
assert.equal(baseline.certainOutflows.items.find((item) => item.kind === "SAVINGS")?.date, null);
assert.ok(baseline.certainOutflows.items.some((item) => item.key === "obligation:google-one"));
assert.ok(!baseline.certainOutflows.items.some((item) => ["obligation:qobuz", "obligation:google-ai"].includes(item.key)));
assert.ok(!baseline.flexibleVariables.items.some((item) => item.key === "manon-work-coffee"));
assert.deepEqual(forecast.referencePlan.restaurantCorpus, ["Restaurant", "Fast-food / snack", "Livraison de repas"]);
const changed = plan({ ...inputs, resourceOverrides: { "income:Digital Learning Contest": "2150.00" } });
assert.equal(changed.economicResources, "4090.60");
assert.equal(changed.afterCertainOutflows, "2043.37");
assert.equal(changed.scenarios.central, "1077.44");
assert.deepEqual(plan(), baseline, "removing an override restores the source plan");
for (const [key, amount, expectedPocket] of [
  ["income:Digital Learning Contest", "2150.00", "BANK_CASH"],
  ["income:Promotrans", "1722.21", "BANK_CASH"],
  ["benefit:swile", "351.61", "MEAL_BENEFIT"],
  ["benefit:edenred", "351.61", "MEAL_BENEFIT"],
]) {
  const overridden = plan({ ...inputs, resourceOverrides: { [key]: amount } });
  const changed = overridden.resources.filter((item) => item.amount !== baseline.resources.find((source) => source.key === item.key)?.amount);
  assert.deepEqual(changed.map((item) => item.key), [key]);
  assert.equal(changed[0].pocket, expectedPocket);
  assert.equal(changed[0].provenance, "MONTH_OVERRIDE");
  assert.equal(overridden.economicResources, "4090.60");
  assert.equal(overridden.afterCertainOutflows, "2043.37");
  assert.equal(overridden.scenarios.central, "1077.44");
  assert.deepEqual(plan(), baseline);
}
const november = { ...forecast, meta: { ...forecast.meta, targetMonth: "2026-11" }, referencePlan: undefined };
assert.equal(deriveMonthScenario(november, defaultMonthInputs(), null, "2026-09-28").economicPlan, null,
  "October's declared decisions are not copied into a later month");
assert.equal(JSON.stringify(forecast), source, "scenario decisions never mutate the published snapshot");
console.log("PASS: October resources, certain outflows, scenarios, negative invariants, override propagation and undo");
export { forecast, inputs, deriveMonthScenario };
