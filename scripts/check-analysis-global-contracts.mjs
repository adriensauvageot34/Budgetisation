import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const resources = [
  "analysis_global_initial",
  "analysis_global_baseline",
  "analysis_global_typical",
  "analysis_global_evolution",
  "analysis_global_habits",
  "analysis_global_profiles",
  "analysis_global_universe",
];

const resourceRegistry = read("src/query-api/request/resource-registry.ts");
const readModelRegistry = read("src/query-api/read-model-registry.ts");
const adapterRegistry = read("src/query-api/server/adapter-registry.ts");
const serverTypes = read("src/query-api/server/types.ts");
const sources = read("src/server/query/sources/analysis.ts");
for (const resource of resources) {
  assert.match(resourceRegistry, new RegExp(`\\"${resource}\\"`), `${resource} absent du Resource Registry`);
  assert.match(readModelRegistry, new RegExp(`${resource}:`), `${resource} absent du Read Model Registry`);
  assert.match(adapterRegistry, new RegExp(`${resource}:`), `${resource} absent de l'Adapter Registry`);
}
for (const reader of ["Initial", "Baseline", "Typical", "Evolution", "Habits", "Profiles", "Universe"]) {
  assert.match(serverTypes, new RegExp(`readAnalysisGlobal${reader}`));
  assert.match(sources, new RegExp(`readAnalysisGlobal${reader}`));
}

const route = read("src/app/historique/analyse/global/page.tsx");
assert.match(route, /resolveDefaultGlobalAsOf/);
assert.match(route, /analysisGlobalInitial/);
assert.doesNotMatch(route, /analysisGlobal(?:Baseline|Typical|Evolution|Habits|Profiles|Universe)/, "Le serveur Global ne doit charger que initial au premier rendu");

const page = read("src/features/analysis/global/analysis-global-page.tsx");
const headings = ["Notre vie en chiffres", "Notre socle de vie", "Notre vie habituelle", "Comment notre vie évolue", "Nos habitudes", "Nos profils", "Notre univers"];
let previous = -1;
for (const heading of headings) {
  const position = page.indexOf(heading);
  assert.ok(position > previous, `Ordre Global invalide pour ${heading}`);
  previous = position;
}
assert.doesNotMatch(page, /goToMonth\(.*asOf/);
assert.doesNotMatch(page, /@\/server|@\/analytics/);
assert.doesNotMatch(page, /\.reduce\(|groupBy\(/, "React Global ne doit pas agréger des faits");

const types = read("src/query-api/analysis/global/types.ts");
assert.match(types, /availableViews/);
assert.match(types, /activity_month_frequency/);
assert.match(types, /missing_method_or_source/);
assert.match(types, /GlobalReferenceSlot/);
assert.match(sources, /selectedActivityOccurrences/);
assert.match(sources, /selectedPlaceVisits/);
assert.match(sources, /loadOperationBundle/);
assert.match(sources, /createGalleryQuerySources/);
assert.doesNotMatch(sources, /neutralDay\s*\*|neutralWeek\s*\*/);

const targetRegistry = resourceRegistry.match(/analysis_target:\s*\{[\s\S]*?allowedTimeKinds:\s*\[([^\]]+)\]/)?.[1] ?? "";
assert.match(targetRegistry, /"month"/);
assert.match(targetRegistry, /"global"/);

const subviews = read("src/navigation/contracts/subviews.ts");
for (const state of ["baselineView", "evolutionView", "selectedMonth", "habitsView", "profileTarget", "selectedHeatmapCell"]) assert.match(subviews, new RegExp(state));

console.log("ANALYSIS_GLOBAL_CONTRACTS=PASS");
