import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const sourceFiles = [
  "src/query-api/global-v2/details.ts",
  "src/query-api/global-v2/index.ts",
  "src/server/analytics/global-v2-candidate.ts",
  "src/server/analytics/global-v2-production-orchestrator.ts",
  "src/features/global-v2/fixture-data.ts",
  "src/features/global-v2/background-rhythms.module.css",
].map((relativePath) => ({ relativePath, source: read(relativePath) }));
const backgroundProductFiles = [
  "src/features/global-v2/background-rhythms.tsx",
  "src/features/global-v2/food-rhythm-river.tsx",
  "src/features/global-v2/food-month-focus.tsx",
  "src/features/global-v2/car-mobility-route.tsx",
  "src/features/global-v2/car-month-focus.tsx",
  "src/features/global-v2/annual-month-interaction-layer.tsx",
  "src/features/global-v2/annual-month-focus.ts",
  "src/features/global-v2/rhythm-month-focus-region.tsx",
  "src/query-api/global-v2/background-rhythms.ts",
].map((relativePath) => ({ relativePath, source: read(relativePath) }));

for (const token of [
  "groceryRoutineEntityRef",
  "groceryRhythmContext",
  "GlobalGroceryRhythmContext",
  "GLOBAL_GROCERY_DETAIL_RESOURCE_MISMATCH",
  "groceryRhythmCard",
  "groceryMonthGrid",
  "groceryMonthCard",
  "global_legacy_grocery_adapter",
]) {
  assert.deepEqual(sourceFiles.filter(({ source }) => source.includes(token)).map(({ relativePath }) => relativePath), [], `${token} doit être absent du produit final.`);
}

for (const { relativePath, source } of backgroundProductFiles) {
  assert.equal(source.includes("analysis_global_routine_detail"), false, `${relativePath} ne doit pas relire le détail routine générique.`);
}

const backgroundFeature = read("src/features/global-v2/background-rhythms.tsx");
const carFeature = read("src/features/global-v2/car-mobility-route.tsx");
assert.match(backgroundFeature, /analysis_global_background_rhythms/u);
assert.match(backgroundFeature, /state\.status === "ERROR"[\s\S]*result\.retry/u, "L’échec annuel doit rester une erreur du nouveau produit.");
assert.match(carFeature, /analysis_global_background_rhythm_month_detail/u);
assert.equal(carFeature.includes("analysis_global_routine_detail"), false);

const details = read("src/query-api/global-v2/details.ts");
assert.equal(details.includes("groceryRhythm"), false, "GlobalExpandedReadModel ne doit plus contenir groceryRhythm.");
assert.match(details, /analysis_global_routine_detail/u, "Le détail routine générique doit rester enregistré.");

const candidate = read("src/server/analytics/global-v2-candidate.ts");
assert.match(candidate, /function routineDetailProjection/u);
assert.match(candidate, /candidateAdapters: \{ readonly timeline: GlobalTimelineCandidateBundle \}/u);
assert.equal(candidate.includes("candidateAdapters.grocery"), false);

const adapters = read("src/analytics/global-v2/candidate-adapters.ts");
for (const authority of ["GlobalGroceryCandidateBundle", "buildGlobalGroceryCandidateBundle", "globalGroceryBasketPolicy"]) assert.match(adapters, new RegExp(authority, "u"));
const serverAdapters = read("src/server/analytics/global-v2-candidate-adapters.ts");
assert.match(serverAdapters, /resolveGlobalGroceryCandidateAdapter/u);

const orchestrator = read("src/server/analytics/global-v2-production-orchestrator.ts");
assert.match(orchestrator, /resolveGlobalGroceryCandidateAdapter/u);
assert.match(orchestrator, /groceryAuthority: grocery/u, "Le bundle Grocery doit rester exposé comme autorité amont FOOD.");
assert.match(orchestrator, /const candidateAdapters = \{ timeline \}/u);
assert.match(orchestrator, /resolveGlobalBackgroundRhythmsProduction/u, "La préparation live doit construire les projections BackgroundRhythms.");
assert.match(orchestrator, /backgroundRhythms: resolved\.backgroundRhythms/u, "Le candidat officiel doit recevoir les projections BackgroundRhythms.");

const productionProjection = read("src/server/analytics/global-v2-background-rhythms-production.ts");
assert.match(productionProjection, /buildGlobalFoodRhythmProjection/u);
assert.match(productionProjection, /buildGlobalCarMobilityRhythmProjection/u);
assert.match(productionProjection, /buildMonthlyMobilityNarrative/u);
assert.equal(/\.xlsx|XLSX/u.test(productionProjection), false, "L’adaptateur live BackgroundRhythms ne doit pas importer le classeur Mobility.");

const foodProjection = read("src/analytics/global-v2/food-rhythm.ts");
assert.match(foodProjection, /GlobalGroceryCandidateBundle/u);
assert.match(foodProjection, /readonly grocery: GlobalGroceryCandidateBundle/u);
assert.match(foodProjection, /input\.grocery/u);

const carProjection = read("src/analytics/global-v2/car-mobility-rhythm.ts");
assert.match(carProjection, /MobilityLegFact/u);
assert.equal(/\.xlsx|XLSX/u.test(carProjection), false, "CAR_MOBILITY ne doit jamais importer le classeur Mobility.");
for (const { relativePath, source } of backgroundProductFiles) assert.equal(/\.xlsx|XLSX/u.test(source), false, `${relativePath} ne doit pas importer le classeur Mobility.`);

const page = read("src/features/global-v2/global-v2-page.tsx");
for (const component of ["LifeActivityDetail", "LifePersonRhythm"]) assert.match(page, new RegExp(component, "u"));
assert.match(page, /analysis_global_routine_detail/u);

console.log("Global V2 BackgroundRhythms cutover source guards: PASS.");
