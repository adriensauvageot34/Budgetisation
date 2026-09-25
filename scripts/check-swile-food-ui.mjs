import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) {
  return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".css"] = (module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }; };
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename }).outputText, filename,
);

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createGlobalV2FixtureBundle, createGlobalV2FixtureTransport } = require(path.join(root, "src/features/global-v2/fixture-data.ts"));
const { expandGlobalBackgroundFoodReadModel } = require(path.join(root, "src/query-api/global-v2/background-rhythms.ts"));
const { FoodRhythmRiver } = require(path.join(root, "src/features/global-v2/food-rhythm-river.tsx"));
const { FoodMonthFocus } = require(path.join(root, "src/features/global-v2/food-month-focus.tsx"));

const bundle = createGlobalV2FixtureBundle("contract");
const transport = createGlobalV2FixtureTransport(bundle, "contract");
const { data: base } = await transport({ resource: "analysis_global_background_rhythms", params: {} });
const covered = structuredClone(base);
covered.food.benefitCoverage = {
  status: "PARTIAL", startMonth: "2025-08", endMonth: "2026-07",
  exceptions: covered.food.months.map((_, index) => [index, index === 0 ? "OUT_OF_COVERAGE" : "IN_COVERAGE"]),
};
covered.food.monthlyBenefitFunding = [[6, "141.73"], [7, "90.00"]];
const semantic = expandGlobalBackgroundFoodReadModel(covered);
const html = renderToStaticMarkup(React.createElement(FoodRhythmRiver, { food: semantic }));
assert.equal((html.match(/data-tone="food-/gu) ?? []).length, 3);
assert.match(html, /Swile · titres-restaurant/u);
assert.match(html, /<circle[^>]*data-month="2026-02"/u);
assert.doesNotMatch(html, /<circle[^>]*data-month="2025-08"/u);
assert.match(html, /Février 2026 : 141,73[\s\u00a0\u202f]*€ financés par Swile/u);
assert.match(html, /Août 2025 : titres-restaurant non observés/u);
assert.doesNotMatch(html, /Août 2025 : 0[\s\u00a0\u202f]*€ financés par Swile/u);
const focus = (index) => renderToStaticMarkup(React.createElement(FoodMonthFocus, {
  month: semantic.months[index], annotations: semantic.annotations, connectorPosition: 50, onClose: () => {},
}));
assert.match(focus(6), /Swile · 141,73[\s\u00a0\u202f]*€ financés en titres-restaurant/u);
assert.match(focus(0), /Source titres-restaurant non observée pour ce mois/u);
assert.doesNotMatch(focus(0), /Swile · 0[\s\u00a0\u202f]*€/u);
console.log("Swile FOOD UI: covered February and out-of-coverage August PASS");
