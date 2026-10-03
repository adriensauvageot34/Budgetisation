import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url), root = process.cwd();
const folder = path.join(root, "public/planned-visuals/builder/clay");
const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(root, "src/app/mois-a-venir/builder-illustration-registry.json"), "utf8"));
const exportsBag = {};
new Function("exports", ts.transpileModule(fs.readFileSync(path.join(root, "src/domain/phase2/planned-assets.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(exportsBag);
const files = new Set(), keys = new Set(), bindings = new Set();
for (const image of manifest.illustrations) {
  assert(!keys.has(image.key), `duplicate image key ${image.key}`); keys.add(image.key);
  assert(!files.has(image.file), `duplicate file ${image.file}`); files.add(image.file);
  assert.match(image.file, /^[a-z-]+\/[a-z-]+\.webp$/u);
  const file = path.resolve(folder, image.file);
  assert(file.startsWith(folder + path.sep), "asset path must stay inside the library");
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString("ascii",0,4), "RIFF"); assert.equal(bytes.toString("ascii",8,12), "WEBP");
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, "complete WebP container");
  let frame;
  for (let offset=12; offset+8<=bytes.length;) {
    const length=bytes.readUInt32LE(offset+4);
    if (bytes.toString("ascii",offset,offset+4)==="VP8 ") frame=bytes.subarray(offset+8,offset+8+length);
    offset+=8+length+(length%2);
  }
  assert(frame, "the common export recipe uses lossy WebP");
  assert.equal(frame.subarray(3,6).toString("hex"), "9d012a");
  assert.equal(frame.readUInt16LE(6)&0x3fff,1200); assert.equal(frame.readUInt16LE(8)&0x3fff,600);
  assert.equal(registry.illustrations[image.key], image.file);
  assert(image.choices.length > 0, "no unused generated asset");
  for (const binding of image.choices) {
    assert(!bindings.has(binding), `duplicate semantic choice ${binding}`); bindings.add(binding);
    assert.equal(registry.choices[binding], image.key);
  }
}
assert.equal(Object.keys(registry.illustrations).length, keys.size);
assert.equal(Object.keys(registry.choices).length, bindings.size);
for (const asset of exportsBag.ASSET_CATALOG) assert(bindings.has(`asset:${asset.assetKey}`), `missing cost illustration: ${asset.assetKey}`);
for (const key of ["restaurant", "fast_food", "work_meal", "groceries", "party", "visit", "activity", "purchase", "trip"]) assert(bindings.has(`intent:${key}`));
for (const family of ["activity", "purchase"]) for (const subtype of exportsBag.PLANNED_SUBTYPE_LABELS[family]) assert(bindings.has(`choice:${family}Category:${subtype.key}`));
assert.equal(registry.choices["choice:transport:CAR"], "transport/car");
assert.equal(registry.choices["choice:transport:TAXI"], "transport/car");
const carCosts = exportsBag.ASSET_CATALOG.filter(a=>/:(?:rental_car|carpool|uber|uber_out|uber_back)$/u.test(a.assetKey));
assert(carCosts.length >= 3);
for (const asset of carCosts) assert.equal(registry.choices[`asset:${asset.assetKey}`], "transport/car");
assert.match(manifest.illustrations.find(i => i.key === "transport/car").subject, /red Peugeot 207/iu);
for (const scope of ["asset:restaurant:dessert", "asset:fast_food:dessert", "scene:dessert"]) assert.equal(registry.choices[scope], "food/dessert");
for (const binding of bindings) assert(!/personal:|Fontès|Servian|Isabelle|Marc|ADRIEN|MANON/u.test(binding), `personal entry must remain excluded: ${binding}`);
for (const key of ["UBER_EATS", "DELIVEROO", "DOMINOS", "LADY_SUSHI"]) assert.equal(registry.choices[`choice:provider:${key}`], undefined);
assert.equal(registry.choices["choice:occasion:NONE"], undefined, "no illustration for a negative decision");

require.extensions[".css"] = module => { module.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? undefined : String(key) }); };
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { BuilderIllustration, builderIllustration } = require("../src/app/mois-a-venir/builder-illustrations.tsx");
assert.equal(builderIllustration("intent:trip"), "/planned-visuals/builder/clay/intent/travel.webp");
for (const key of ["personal:contact:ISABELLE", "personal:place:FONTES", "constructor", "unknown", "Restaurant"]) {
  assert.equal(builderIllustration(key), undefined, "exact keys only, no fuzzy fallback");
  const html = renderToStaticMarkup(React.createElement(BuilderIllustration, { semanticKey:key }));
  assert(!html.includes("<img"), "neutral fallback must never request a broken image");
  assert(html.includes('data-artwork="neutral"'));
}
const custom = renderToStaticMarkup(React.createElement(BuilderIllustration, { semanticKey:"personal:contact:ISABELLE", personalSrc:"/personal-fixture.webp" }));
assert(custom.includes('/personal-fixture.webp'), "personal artwork extension remains supported");
const rendered = renderToStaticMarkup(React.createElement(BuilderIllustration, { semanticKey:"asset:restaurant:dessert" }));
assert(rendered.includes('alt=""') && rendered.includes('loading="lazy"') && rendered.includes('aria-hidden="true"'));
const source = fs.readFileSync(path.join(root, "src/app/mois-a-venir/planned-wizard-visuals.tsx"), "utf8");
assert(!/scene-atlas-v1|card-.*-glass\.webp|INTENT_GLASS_BACKGROUNDS/u.test(source));
assert(fs.readFileSync(path.join(root, "src/app/mois-a-venir/builder-illustrations.module.css"), "utf8").includes("prefers-reduced-motion"));
console.log(JSON.stringify({ status:"PASS", costAssets:exportsBag.ASSET_CATALOG.length, semanticChoices:[...bindings].filter(b=>!b.startsWith("scene:")).length, compatibilityScenes:[...bindings].filter(b=>b.startsWith("scene:")).length, individualIllustrations:keys.size, fallback:"PASS", personalExclusions:"PASS", brandPreservation:"PASS" }));
