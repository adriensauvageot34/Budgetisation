import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
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
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);
require.extensions[".css"] = (module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }; };

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { TimelineEventFacts } = require(path.resolve("src/features/global-v2/life-timeline.tsx"));
const { parseGlobalLifeTimelineV2ReadModel, parseGlobalLifeTimelineV3ReadModel } = require(path.resolve("src/query-api/global-v2/index.ts"));
const timelineSource = fs.readFileSync(path.resolve("src/features/global-v2/life-timeline.tsx"), "utf8");
const css = fs.readFileSync(path.resolve("src/features/global-v2/global-v2.module.css"), "utf8");
const card = timelineSource.slice(timelineSource.indexOf("function TimelineV2EventRow"), timelineSource.indexOf("function TimelineEventRow"));

const known = (value) => ({ authority: "CANONICAL_LINKED", status: "KNOWN", value });
const unknown = { authority: "NONE", status: "UNKNOWN" };
const mobility = (status, estimatedFuelCost, distanceKm) => ({ status, estimatedFuelCost, distanceKm, physicalLegCount: 1, tripCount: 1, estimatedFuelLiters: "1.234", validationStatus: "CONFIRMED" });
const rendered = (eventCost, mobilityContext) => renderToStaticMarkup(React.createElement(TimelineEventFacts, { event: {
  eventCost, ...(mobilityContext === undefined ? {} : { mobilityContext }),
} })).replaceAll("\u00a0", " ").replaceAll("\u202f", " ");
const visibleText = (html) => html.replace(/<[^>]+>/gu, "").replaceAll("&amp;", "&");

const milk = rendered(known("26.70"), mobility("KNOWN", "2.296093", "12.227"));
assert.match(visibleText(milk), /Dépenses liées · 26,70 €[\s\S]*Déplacement · ≈ 2,30 € · 12,2 km/u);
assert.match(milk, /class="timelineEventFacts timelineSemanticFacts"/u);
assert.match(milk, /class="timelineMobilityFact"/u);
assert.doesNotMatch(milk, /29,00/u);
const nimes = rendered(unknown, mobility("PARTIAL", "7.48", "53.088"));
assert.match(visibleText(nimes), /Déplacement partiel · ≈ 7,48 € · 53,1 km documentés/u);
assert.doesNotMatch(nimes, /Dépenses liées|0 €|≥/u);
const marc = rendered(known("139.71"), mobility("PARTIAL", "5.37", "32.589"));
assert.match(visibleText(marc), /Dépenses liées · 139,71 €[\s\S]*Déplacement partiel · ≈ 5,37 € · 32,6 km documentés/u);
assert.doesNotMatch(marc, /145,08|≥/u);
const zero = rendered(known("0"), mobility("PARTIAL", "1", "6.8"));
assert.match(visibleText(zero), /Dépenses liées · 0 €[\s\S]*Déplacement partiel · ≈ 1,00 € · 6,8 km documentés/u);
assert.match(visibleText(rendered(known("42"))), /Dépenses liées · 42 €/u);
assert.match(visibleText(rendered(unknown, mobility("KNOWN", "105.03", "776.8"))), /Déplacement · ≈ 105,03 € · 776,8 km/u);
assert.doesNotMatch(rendered(unknown), /Dépenses liées|Déplacement|0 €/u);
assert.match(milk, /aria-hidden="true"/u);
for (const output of [milk, nimes, marc, zero]) assert.doesNotMatch(output, /estimatedFuelLiters|physicalLegCount|tripCount|validationStatus|mobilityLegId|mobilityTripId|contextLinkId|CONFIRMED/u);
for (const forbidden of ["Coût total", "Total avec déplacement", "Essence :", "≥"]) assert.equal(card.includes(forbidden), false);
assert.doesNotMatch(card, /eventCost\.value\s*\+|estimatedFuelCost\s*\+|Number\(event\.eventCost\.value\).*estimatedFuelCost/u);
assert.match(card, /<span className=\{styles\.timelineEventBody\}>[\s\S]*<TimelineEventFacts event=\{event\} \/>/u);
assert.match(card, /const canExpand = expenseRows\.length > 0 && comparisonAvailable/u);
assert.match(card, /expenseRows\.length > 0 \? <TimelineExpenses rows=\{expenseRows\} compact/u);
assert.doesNotMatch(timelineSource.slice(timelineSource.indexOf("function TimelineExpenses"), timelineSource.indexOf("function TimelineMobilityFact")), /mobilityContext|estimatedFuelCost/u);
assert.match(timelineSource, /Comparaison des dépenses liées de \$\{event\.canonicalName\}/u);
assert.match(timelineSource, /<h5 className=\{styles\.timelineComparatorTitle\}>Comparaison des dépenses liées<\/h5>/u);
assert.match(card, /Se distingue côté dépenses/u);
assert.match(timelineSource, /model\.schemaVersion === "global-life-timeline@v2" \|\| model\.schemaVersion === "global-life-timeline@v3"/u);
assert.match(css, /\.timelineSemanticFacts\s*\{[^}]*min-width:\s*0/u);
assert.match(css, /\.timelineMobilityFact\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/u);
assert.doesNotMatch(css.slice(css.indexOf(".timelineMobilityFact"), css.indexOf(".timelineChevron")), /white-space:\s*nowrap|min-width:\s*[1-9]\d+px|!important/u);

const { v2, v3 } = await import("./check-global-v2-timeline-query-v3.mjs");
const v2Model = parseGlobalLifeTimelineV2ReadModel(v2.timeline);
const v3Model = parseGlobalLifeTimelineV3ReadModel(v3.timeline);
assert.equal(v2Model.schemaVersion, "global-life-timeline@v2");
assert.equal(v3Model.schemaVersion, "global-life-timeline@v3");
assert.doesNotMatch(rendered(v2Model.events[0].eventCost), /Déplacement/u);
assert.match(rendered(v3Model.events[0].eventCost, v3Model.events[0].mobilityContext), /Déplacement/u);

console.log(JSON.stringify({ result: "PASS", cases: 9, v2: "PASS", v3: "PASS", known: "PASS", partial: "PASS", economicZero: "PASS", noTotal: "PASS", noLowerBound: "PASS", hiddenFields: "PASS", comparatorWording: "PASS" }));
