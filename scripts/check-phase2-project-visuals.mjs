import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { planningHarness, value } from "./lib/planned-actions-harness.mjs";
const require = createRequire(import.meta.url);
require.extensions[".css"] = module => { module.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? undefined : String(key) }); };
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { GoogleRestaurantPlaces } = require("../src/server/places/google-places.ts");
const { restaurantPhotoCandidates } = require("../src/domain/phase2/restaurant-places.ts");
const { createBuilderState, editBuilderDraft, materializeBuilderDraft, undoBuilderChange } = require("../src/domain/phase2/planned-builder.ts");
const { beginProjectV2, applyProjectAnswer } = require("../src/domain/phase2/planned-question-engine.ts");
const { compatibleProjectVisual } = require("../src/domain/phase2/planned-visual.ts");
const { ProjectHeroCard } = require("../src/app/mois-a-venir/project-hero-card.tsx");
const { RestaurantPhotoAttribution } = require("../src/app/mois-a-venir/restaurant-photo-background.tsx");
const { projectPlannedExpenseCards } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const placeId = "ChIJrestaurant_fixture", otherId = "ChIJother_restaurant";
let generation = 1;
const network = [];
const raw = (count = 6) => ({ id: placeId, types: ["restaurant"], photos: Array.from({ length: count }, (_, index) => ({
  name: `places/${placeId}/photos/ref_${generation}_${index}`, widthPx: index === 0 ? 120 : 1600, heightPx: index === 0 ? 800 : 900,
  authorAttributions: [{ displayName: `Auteur ${index}`, uri: `https://maps.google.com/contrib/${index}` }], googleMapsUri: `https://www.google.com/maps/photo/${index}`,
})) });
const provider = new GoogleRestaurantPlaces({ key: "SYNTHETIC_SERVER_KEY", fetch: async (url, init) => {
  network.push({ url, init });
  return Response.json(url.includes("/media?") ? { photoUri: `https://lh3.googleusercontent.com/${new URL(url).pathname.split("/").at(-2)}` } : raw());
} });
const gallery = await provider.photos(placeId);
assert.equal(gallery.length, 4); assert.equal(gallery[0].photoIndex, 1, "prefer a landscape with useful resolution over a small portrait");
assert.equal(new Set(gallery.map(p => p.photoIndex)).size, 4);
assert(network.every(c => c.init.cache === "no-store" && !c.url.includes("SYNTHETIC_SERVER_KEY")));
const firstChoice = await provider.photo(placeId, 960, 540, 3);
assert.match(firstChoice.photoUri, /ref_1_3$/); assert.equal(firstChoice.authors[0].displayName, "Auteur 3");
generation = 2;
assert.match((await provider.photo(placeId, 960, 540, 3)).photoUri, /ref_2_3$/, "refresh photo resource names rather than storing expiring references");
assert((await provider.photos(placeId, 320, 200, 5)).some(p => p.photoIndex === 5), "retain a saved choice outside the current top four");
assert.equal((await provider.photo(placeId, 960, 540, 9)).photoIndex, 1, "disappearing photos safely fall back to the best available");
for (const count of [0, 1, 2, 3]) {
  const p = new GoogleRestaurantPlaces({ key: "test", fetch: async url => Response.json(url.includes("/media?") ? { photoUri: "https://lh3.googleusercontent.com/fixture" } : raw(count)) });
  assert.equal((await p.photos(placeId)).length, count);
}
assert.equal(restaurantPhotoCandidates({ photos: [{ name: `places/${otherId}/photos/foreign` }] }, placeId).length, 0);
const unsafe = new GoogleRestaurantPlaces({ key: "test", fetch: async url => Response.json(url.includes("/media?") ? { photoUri: "https://untrusted.test/private" } : raw(4)) });
assert.deepEqual(await unsafe.photos(placeId), []);
const partial = new GoogleRestaurantPlaces({ key: "test", fetch: async url => url.includes("ref_2_2/media") ? new Response(null, { status: 404 })
  : Response.json(url.includes("/media?") ? { photoUri: "https://lh3.googleusercontent.com/fixture" } : raw(4)) });
assert.equal((await partial.photos(placeId)).length, 3, "one failed image never blocks the other choices");

const h = planningHarness(), personId = randomUUID();
h.client.persons.push({ person_id: personId, display_name: "Personne fixture", status: "active", household_id: h.householdId });
const env = { persons: [{ personId, displayName: "Personne fixture" }], places: [] };
let state = beginProjectV2(createBuilderState({ familyKey: "food", subtypeKey: "restaurant", title: "Restaurant fixture", plannedDate: null, costItems: [], context: {} }), env);
for (const [question, answer] of [["participants", personId], ["date", { date: "2026-10-10", moment: "EVENING" }], ["occasion", "NONE"],
  ["entity", { label: "Restaurant fixture", googlePlaceId: placeId, city: "Montpellier" }], ["transport", "FREE"], ["costMode", "TOTAL"], ["costTotal", "60.00"]]) state = applyProjectAnswer(state, question, answer, env);
const withoutVisual = materializeBuilderDraft(state);
state = editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, project: { ...state.draft.context.project,
  visual: { source: "GOOGLE_PLACE_PHOTO", placeId, selectedIndex: 3 } } } });
const candidate = materializeBuilderDraft(state), preview = value(await h.actions.previewPlannedExpense("2026-10", candidate));
const plainPreview = value(await h.actions.previewPlannedExpense("2026-10", withoutVisual));
for (const key of ["grossCost", "payableGross", "fuelUsage", "netAdditionalImpact", "funding"]) assert.deepEqual(preview[key], plainPreview[key], `photos never change ${key}`);
assert.equal(h.client.writes.length, 0);
const saved = value(await h.actions.savePlannedExpense("2026-10", candidate, { id: randomUUID() })).expense;
const reloaded = (await h.service.readPlannedExpenses(h.client, h.householdId, "2026-10"))[0];
assert.deepEqual(reloaded.context.project.visual, candidate.context.project.visual);
assert.equal(compatibleProjectVisual(reloaded).selectedIndex, 3);
assert(!/photoUri|googleusercontent|\/photos\/|Auteur/u.test(JSON.stringify(reloaded)), "persist only place and user preference, not provider content");
const changed = applyProjectAnswer(state, "entity", { label: "Autre restaurant", googlePlaceId: otherId }, env);
assert.equal(changed.draft.context.project.visual, undefined);
assert.equal(undoBuilderChange(changed).draft.context.project.visual.selectedIndex, 3);
assert.equal(applyProjectAnswer(state, "entity", "LATER", env).draft.context.project.visual, undefined);
assert.equal(applyProjectAnswer(state, "entity", { label: "Restaurant saisi", address: "Adresse saisie" }, env).draft.context.project.visual, undefined);
for (const visual of [{ source: "GOOGLE_PLACE_PHOTO", placeId: otherId, selectedIndex: 0 }, { source: "GOOGLE_PLACE_PHOTO", placeId, selectedIndex: 10 },
  { source: "GOOGLE_PLACE_PHOTO", placeId, selectedIndex: 1.5 }, { source: "GOOGLE_PLACE_PHOTO", placeId, selectedIndex: 0, photoUrl: "https://untrusted.test" }]) {
  assert.equal((await h.actions.savePlannedExpense("2026-10", { ...candidate, context: { ...candidate.context, project: { ...candidate.context.project, visual } } }, { id: randomUUID() })).ok, false);
}
assert.equal(h.client.writes.length, 1, "invalid visual payloads never write");
value(await h.actions.savePlannedExpense("2026-10", withoutVisual, { id: randomUUID() }));
assert(h.client.writes.every(w => w.table === "phase2_planned_expenses"));
const card = projectPlannedExpenseCards([reloaded], "2026-10-02")[0];
const cardHtml = renderToStaticMarkup(React.createElement(ProjectHeroCard, { item: card }, React.createElement("button", null, "Modifier")));
assert.match(cardHtml, /aspect-video/); assert.match(cardHtml, /Restaurant fixture/); assert.match(cardHtml, /10 octobre/); assert.match(cardHtml, /60,00/); assert.match(cardHtml, /Modifier/);
assert.doesNotMatch(cardHtml, /grayscale|h-24/);
const attribution = renderToStaticMarkup(React.createElement(RestaurantPhotoAttribution, { photo: firstChoice }));
assert.match(attribution, /Google Maps/); assert.match(attribution, /Auteur 3/); assert.match(attribution, /maps\/photo\/3/);
const { restaurantPlacesRequest } = require("../src/server/places/http.ts");
const originalPhotos = GoogleRestaurantPlaces.prototype.photos;
try {
  GoogleRestaurantPlaces.prototype.photos = async (id, width, height, index) => { assert.equal(id, placeId); assert.equal(width, 320); assert.equal(height, 200); assert.equal(index, 3); return gallery; };
  const request = body => new Request("https://budget.test/api/places/photo", { method: "POST", headers: { cookie: "sb-fixture-auth-token=session", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await restaurantPlacesRequest(request({ placeId, gallery: true, selectedIndex: 3 }), "photo")).status, 200);
  for (const body of [{ placeId, selectedIndex: -1 }, { placeId, gallery: "true" }, { placeId, photoRef: "foreign" }]) assert.equal((await restaurantPlacesRequest(request(body), "photo")).status, 400);
} finally { GoogleRestaurantPlaces.prototype.photos = originalPhotos; }
console.log("PASS V2.3: four/three/two/one/zero photos, default quality, selected photo refresh, disappearing/failed images, place isolation, durable preference, Preview/Save/reload parity, venue change/remove/Undo, invalid payload zero writes, 16:9 hero/metadata, attribution, HTTP guards. Synthetic I/O only.");
