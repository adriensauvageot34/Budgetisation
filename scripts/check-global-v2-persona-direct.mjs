import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1))), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href : specifier;
    try { return nextResolve(target, context); } catch (error) {
      if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
      for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw error;
    }
  },
});

const { buildPersonaDirectModel, personaDirectDetailKey, selectPersonaDirectOwnerRefs } = await import("../src/query-api/global-v2/persona-direct-presentation.ts");
const adrien = "00000000-0000-0000-0000-000000000001";
const manon = "00000000-0000-0000-0000-000000000002";
const usage = (service, personId) => ({ semanticKey: `subscription.${service}.${personId}`, qualifications: ["PERSONAL_USAGE"] });
const profile = (personId, featuredTraits) => ({ subject: { kind: "PERSON", personId }, scope: "PERSONAL", featuredTraits });
const overview = {
  resource: "analysis_global_personas_expanded", sectionKey: "OVERVIEW",
  rows: [{ entityRef: `person:${adrien}`, labelKey: "Adrien · Profil" }, { entityRef: `person:${manon}`, labelKey: "Manon · Profil" }],
  profile: { profiles: [
    profile(adrien, [usage("chatgpt", adrien), usage("qobuz", adrien), { semanticKey: "mobility.work.adrien", qualifications: [] }, { semanticKey: "universe.creative_projects", qualifications: ["PHOTO", "MUSIC"] }, { semanticKey: "driving_license.adrien" }]),
    profile(manon, [usage("netflix", manon), usage("max", manon), { semanticKey: "mobility.work.manon", qualifications: ["CAR"] }, { semanticKey: "universe.beauty_and_care", children: [
      { semanticKey: "product-need:maquillage_manon_mascara", metrics: { occurrenceCount: 6, typicalPrice: 32, medianGapDays: 65 } },
      { semanticKey: "product-need:maquillage_manon_sourcils", metrics: { occurrenceCount: 7, typicalPrice: 9.99, medianGapDays: 57 } },
    ] }]),
  ] },
};
const ref = (resource, entityRef) => ({ role: "PRIMARY", resource, entityRef });
const block = (semanticKey, resource, entityRef) => ({ semanticKey, detailRefs: [ref(resource, entityRef)] });
const indices = [
  { personId: adrien, blocks: [
    block(`subscription.chatgpt.${adrien}`, "analysis_global_economic_recurrence_detail", "service:chatgpt"),
    block(`subscription.qobuz.${adrien}`, "analysis_global_economic_recurrence_detail", "service:qobuz"),
    block("need:adrien-lunch", "analysis_global_category_need_detail", "need:adrien-lunch"),
    block("activity:courses_alimentaires", "analysis_global_category_need_detail", "need:groceries"),
  ] },
  { personId: manon, blocks: [
    block(`subscription.netflix.${manon}`, "analysis_global_economic_recurrence_detail", "service:netflix"),
    block(`subscription.max.${manon}`, "analysis_global_economic_recurrence_detail", "service:max"),
    block("mobility:work-commute", "analysis_global_place_mobility_detail", "mobility:work"),
    block("mobility:family-visit:without-household-partner-confirmed", "analysis_global_place_mobility_detail", "mobility:family"),
    block("mobility:friend-visit", "analysis_global_place_mobility_detail", "mobility:friends"),
    block("need:manon-vape", "analysis_global_category_need_detail", "need:vape"),
    block("need:manon-lunch", "analysis_global_category_need_detail", "need:manon-lunch"),
  ] },
];
const labels = { needs: { "adrien-lunch": "Repas du midi au travail · Adrien", "manon-lunch": "Repas du midi au travail · Manon", "manon-vape": "Vape / cigarette électronique" } };
const refs = selectPersonaDirectOwnerRefs({ overview, indices, labels });
assert.equal(refs.length, 10);
assert.equal(refs.some((entry) => entry.entityRef === "need:groceries"), false);
assert.equal(refs.some((entry) => /leg|evidence/iu.test(entry.resource)), false);

const metric = (metricId, displayValue) => ({ metricId, displayValue, knowledgeState: "KNOWN" });
const data = new Map([
  ["service:chatgpt", [metric("detail:typical-occurrence-cost", "20,65 €")]],
  ["service:qobuz", [metric("detail:typical-occurrence-cost", "14,99 €")]],
  ["service:netflix", [metric("detail:typical-occurrence-cost", "14,99 €")]],
  ["service:max", [metric("detail:typical-occurrence-cost", "13,99 €")]],
  ["mobility:work", [metric("distinct-day-count", "120 journées"), metric("distance-km", "1 368 km"), metric("estimated-fuel-cost", "260,34 €")]],
  ["mobility:family", [metric("event-count", "7"), metric("distance-km", "326,868 km")]],
  ["mobility:friends", [metric("event-count", "6")]],
  ["need:vape", [metric("detail:annual-amount", "132,06 €"), metric("detail:current-amount", "21,88 €")]],
  ["need:adrien-lunch", [metric("detail:annual-amount", "308,45 €")]],
  ["need:manon-lunch", [metric("detail:annual-amount", "52,89 €")]],
]);
const details = new Map(refs.map((entry) => [personaDirectDetailKey(entry), { metrics: data.get(entry.entityRef) ?? [] }]));
const model = buildPersonaDirectModel({ overview, indices, details, labels, ownerDetailResolutionsInitial: refs.length, serverBuildMs: 321 });
const [adrienPortrait, manonPortrait] = model.profiles;
const getBlock = (portrait, key) => [...portrait.daily, ...portrait.recurring, ...portrait.phases].find((entry) => entry.key === key);
const stringify = (value) => JSON.stringify(value);
assert.deepEqual(model.profiles.map((entry) => entry.name), ["Adrien", "Manon"]);
assert.deepEqual(getBlock(adrienPortrait, "services").items.map((item) => item.title), ["ChatGPT", "Qobuz"]);
assert.match(stringify(getBlock(adrienPortrait, "services")), /14,99 €/u);
assert.deepEqual(getBlock(manonPortrait, "services").items.map((item) => item.title), ["Netflix", "Max"]);
assert.match(stringify(getBlock(manonPortrait, "services")), /13,99 €/u);
assert.match(stringify(getBlock(manonPortrait, "work-mobility")), /120 journées.*1 368 km.*260,34 €/u);
assert.match(stringify(getBlock(manonPortrait, "beauty")), /Mascara.*6.*32,00.*65 jours.*Sourcils.*7.*9,99.*57 jours/u);
assert.match(stringify(getBlock(manonPortrait, "vape")), /132,06 €.*21,88 €/u);
assert.match(stringify(getBlock(manonPortrait, "social")), /7.*6/u);
assert.equal(getBlock(adrienPortrait, "permit")?.facts.length, 0);
assert.equal(/payé par|a payé|work.midday|after.work|courses alimentaires|pharmacie/iu.test(stringify(model)), false);
assert.equal(/par mois|\/mois/iu.test(stringify(model)), false);
assert.equal(model.ownerDetailResolutionsInitial, 10);

for (const file of ["persona-view.tsx", "persona-card.tsx"]) {
  const source = fs.readFileSync(path.join(root, "src/features/global-v2/persona", file), "utf8");
  assert.equal(/voir le détail|portrait express|persona-detail-drawer|supabase/iu.test(source), false, file);
}
assert.equal(fs.existsSync(path.join(root, "src/features/global-v2/persona/persona-detail-drawer.tsx")), false);
console.log("Persona direct portrait: PASS");
