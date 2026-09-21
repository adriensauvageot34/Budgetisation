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

const presentation = await import("../src/features/global-v2/persona/persona-presentation.ts");
let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };

const adrien = "00000000-0000-0000-0000-000000000001";
const manon = "00000000-0000-0000-0000-000000000002";
const personalSubject = (personId) => ({ subject: { kind: "PERSON", personId }, scope: "PERSONAL" });
const trait = (traitId, semanticKey, kind, personId, overrides = {}) => ({ traitId, semanticKey, kind, ...personalSubject(personId), ...overrides });
const child = (traitId, semanticKey, kind, overrides = {}) => ({ traitId, semanticKey, kind, ...overrides });
const profile = (personId, featuredTraits) => ({ ...personalSubject(personId), featuredTraits });
const expanded = (profiles, overrides = {}) => ({
  resource: "analysis_global_personas_expanded",
  moduleKey: "PERSONAS",
  sectionKey: "OVERVIEW",
  profile: { contractVersion: "persona-published-profile@v1", methodVersion: "global_persona_profile@v1", profiles },
  rows: [
    { rowId: "persona-adrien", labelKey: "Adrien · Travail", entityRef: `person:${adrien}` },
    { rowId: "persona-manon", labelKey: "Manon · Travail", entityRef: `person:${manon}` },
  ],
  ...overrides,
});

const creative = trait("creative-parent", "universe.creative_projects", "UNIVERSE", adrien, {
  temporalStatus: "PROJECT",
  qualifications: ["HOME_STUDIO", "MUSIC", "PHOTO", "PROJECT"],
  metrics: { childCount: 2 },
  children: [
    child("photo", "creative.photo.adrien", "PROJECT", { temporalStatus: "PROJECT" }),
    child("creative-support", "creative.projects.adrien", "UNIVERSE", { temporalStatus: "UNKNOWN" }),
  ],
});
const unknownProject = trait("unknown-project", "project.opaque", "PROJECT", adrien, { temporalStatus: "PROJECT" });
const licence = trait("licence", "driving_license.adrien", "PROJECT", adrien, { temporalStatus: "PROJECT", metrics: { observedAmount: "UNKNOWN" } });
const mobilityAdrien = trait("mobility-a", "mobility.work.adrien", "MOBILITY", adrien, { metrics: { directCost: 0, distanceKm: "UNKNOWN" } });
const chatgpt = trait("chatgpt", "subscription.chatgpt.adrien", "HABIT", adrien);
const rhythmAdrien = trait("rhythm-a", "routine:work-meal", "ROUTINE", adrien, { metrics: { occurrenceCount: 61, medianIntervalDays: 4 } });

const beauty = trait("beauty-parent", "universe.beauty_and_care", "UNIVERSE", manon, {
  children: [
    child("mascara", "product-need:maquillage_manon_mascara", "HABIT", { metrics: { occurrenceCount: 6, typicalPrice: 32 } }),
    child("brows", "product-need:maquillage_manon_sourcils", "HABIT", { metrics: { occurrenceCount: 7 } }),
    child("skincare", "product-need:skincare_manon_masque", "HABIT"),
    child("unknown-child", "product-need:opaque", "HABIT", { metrics: { occurrenceCount: 99 } }),
  ],
});
const mobilityManon = trait("mobility-m", "mobility.work.manon", "MOBILITY", manon);
const rhythmManon = trait("rhythm-m", "activity:work", "ROUTINE", manon, { metrics: { occurrenceCount: 12 } });
const unknownHabit = trait("unknown-habit", "habit.opaque", "HABIT", manon);
const nonFeatured = trait("not-featured", "routine:not-featured", "ROUTINE", adrien, { metrics: { occurrenceCount: 88 } });
const sharedGaming = { traitId: "gaming", semanticKey: "gaming", kind: "UNIVERSE", scope: "SHARED", subject: { kind: "SHARED", personIds: [adrien, manon] } };

const model = presentation.buildPersonaPresentationModel(expanded([
  profile(manon, [beauty, mobilityManon, rhythmManon, unknownHabit]),
  profile(adrien, [creative, unknownProject, licence, mobilityAdrien, chatgpt, rhythmAdrien]),
  { scope: "SHARED", subject: { kind: "SHARED", personIds: [adrien, manon] }, featuredTraits: [sharedGaming] },
]));
const adrienProfile = model.profiles[0];
const manonProfile = model.profiles[1];
const blocks = (profileValue) => [...profileValue.dailyRhythms, ...profileValue.recurringLife, ...profileValue.phasedProjects];

check(() => assert.equal(model.version, "persona_presentation@v1"));
check(() => assert.deepEqual(model.profiles.map(({ personId }) => personId), [adrien, manon]));
check(() => assert.deepEqual(model.profiles.map(({ displayName }) => displayName), ["Adrien", "Manon"]));
check(() => assert.equal(model.profiles.length, 2));
check(() => assert.equal(blocks(adrienProfile).some(({ traitId }) => traitId === nonFeatured.traitId), false));
check(() => assert.equal(model.profiles.some(({ personId }) => personId === undefined), false));

// A-C, I: no kind-only fallback survives the composer.
for (const kind of ["ROUTINE", "HABIT", "UNIVERSE", "PROJECT", "MOBILITY", "HOUSEHOLD_ORGANIZATION"]) {
  check(() => assert.equal(presentation.presentPersonaTrait(trait(`generic-${kind}`, `generic.${kind.toLowerCase()}`, kind, adrien), 0), undefined));
}
check(() => assert.equal(blocks(adrienProfile).some(({ title }) => ["Routine", "Projet", "Habitude", "Univers", "Mobilité"].includes(title)), false));
check(() => assert.equal(blocks(manonProfile).some(({ title }) => ["Routine", "Projet", "Habitude", "Univers", "Mobilité"].includes(title)), false));
check(() => assert.equal(blocks(adrienProfile).some(({ traitId }) => traitId === unknownProject.traitId), false));
check(() => assert.equal(blocks(manonProfile).some(({ traitId }) => traitId === unknownHabit.traitId), false));
check(() => assert.equal(presentation.presentPersonaTrait(trait("metricless-rhythm", "routine:opaque", "ROUTINE", adrien), 0), undefined));

// D: one creative block aggregates its known examples and children.
check(() => assert.equal(adrienProfile.phasedProjects[0].renderer, "CREATIVE_UNIVERSE"));
check(() => assert.equal(adrienProfile.phasedProjects[0].title, "Projets créatifs"));
check(() => assert.deepEqual(adrienProfile.phasedProjects[0].examples, ["Home studio", "Musique", "Photo"]));
check(() => assert.deepEqual(adrienProfile.phasedProjects[0].children.map(({ title }) => title), ["Photo", "Pratiques créatives"]));
check(() => assert.equal(adrienProfile.phasedProjects[0].children[0].statusLabel, "En cours"));

// E-F: Beauty is one block; known children stay compact within it.
check(() => assert.equal(manonProfile.recurringLife.length, 1));
check(() => assert.equal(manonProfile.recurringLife[0].renderer, "BEAUTY_UNIVERSE"));
check(() => assert.deepEqual(manonProfile.recurringLife[0].children.map(({ title }) => title), ["Mascara", "Sourcils", "Soin de la peau"]));
check(() => assert.equal(manonProfile.recurringLife[0].children.some(({ traitId }) => traitId === "unknown-child"), false));
check(() => assert.deepEqual(manonProfile.recurringLife[0].children[0].metrics, [
  { metricKey: "typicalPrice", label: "Prix typique", value: 32, format: "MONEY_EUR" },
  { metricKey: "occurrenceCount", label: "Occurrences", value: 6, format: "COUNT" },
]));

// G-H: specialized human title and explicit zero both survive.
check(() => assert.equal(adrienProfile.phasedProjects[1].title, "Permis de conduire"));
check(() => assert.equal(adrienProfile.phasedProjects[1].statusLabel, "En cours"));
check(() => assert.deepEqual(adrienProfile.dailyRhythms[0].metrics, [{ metricKey: "directCost", label: "Coût direct", value: 0, format: "MONEY_EUR" }]));
check(() => assert.equal(adrienProfile.dailyRhythms[0].metrics.some(({ value }) => value === "UNKNOWN"), false));

// J, M, N: no balancing card or marker is fabricated.
check(() => assert.equal(adrienProfile.markers.length, 4));
check(() => assert.equal(manonProfile.markers.length, 3));
check(() => assert.notEqual(blocks(adrienProfile).length, blocks(manonProfile).length));
const onlyMobility = presentation.buildPersonaPresentationModel(expanded([profile(adrien, [mobilityAdrien])]));
check(() => assert.equal(onlyMobility.profiles[0].markers.length, 1));
check(() => assert.equal(onlyMobility.profiles[0].recurringLife.length, 0));
check(() => assert.equal(onlyMobility.profiles[0].phasedProjects.length, 0));

// K: only PERSONAL profiles and traits are admitted.
check(() => assert.equal(presentation.presentPersonaTrait(sharedGaming, 0), undefined));
check(() => assert.equal(model.profiles.some(({ personId }) => personId === manon || personId === adrien), true));
check(() => assert.equal(blocks(adrienProfile).some(({ semanticKey }) => semanticKey === "gaming"), false));

// L: grouping preserves relative engine order and original rank.
check(() => assert.deepEqual(adrienProfile.dailyRhythms.map(({ traitId }) => traitId), ["mobility-a", "rhythm-a"]));
check(() => assert.deepEqual(adrienProfile.dailyRhythms.map(({ engineRank }) => engineRank), [3, 5]));
check(() => assert.deepEqual(adrienProfile.phasedProjects.map(({ traitId }) => traitId), ["creative-parent", "licence"]));
check(() => assert.deepEqual(adrienProfile.phasedProjects.map(({ engineRank }) => engineRank), [0, 2]));

check(() => assert.equal(presentation.personaTemporalStatusLabel("HISTORICAL"), "Utilisé auparavant"));
check(() => assert.equal(presentation.personaTemporalStatusLabel("STABLE"), undefined));
check(() => assert.equal(presentation.buildPersonaPresentationModel(expanded([], { profile: undefined })).profiles.length, 0));
check(() => assert.equal(presentation.buildPersonaPresentationModel(expanded([], { sectionKey: "PATTERNS" })).profiles.length, 0));
check(() => assert.equal(presentation.PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1["universe.beauty_and_care"].editorialGroup, "RECURRING_LIFE"));
check(() => assert.equal(presentation.PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1["universe.creative_projects"].childrenStrategy, "KNOWN_CHILDREN"));

const source = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-presentation.ts"), "utf8");
const viewSource = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-view.tsx"), "utf8");
const cardSource = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-card.tsx"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-page.tsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
check(() => assert.doesNotMatch(source, /\.sort\(|\.reduce\(|characteristicScore|selectFeatured|promotePersona|buildPersonaProfile/u));
check(() => assert.doesNotMatch(source, /from\s+["']@\/analytics|from\s+["']@\/server|@supabase/u));
check(() => assert.doesNotMatch(source, /["'](?:Routine|Projet|Habitude|Univers|Mobilité)["']/u));
check(() => assert.doesNotMatch(source, /["'](?:Adrien|Manon)["']/u));
check(() => assert.match(source, /editorialGroup[\s\S]*renderer[\s\S]*metricsPolicy[\s\S]*childrenStrategy[\s\S]*temporalTreatment/u));
check(() => assert.match(source, /markers\.length < 4/u));
check(() => assert.match(viewSource, /Portraits express[\s\S]*Vos rythmes du quotidien[\s\S]*Ce qui revient chez chacun[\s\S]*Ce qui vit par phases/u));
check(() => assert.match(viewSource, /presentation\.profiles\.slice\(0, 2\)/u));
check(() => assert.match(viewSource, /Adrien \+ Manon[\s\S]*♡ Nous deux/u));
check(() => assert.doesNotMatch(viewSource, /useState|onClick|sharedGaming|scope === "SHARED"/u));
check(() => assert.doesNotMatch(viewSource, /compare|comparison|différence|gagnant|perdant/iu));
check(() => assert.doesNotMatch(cardSource, /kindLabels|data-persona-kind|>Routine<|>Projet<|>Habitude</u));
check(() => assert.match(cardSource, /block\.children\.length === 0 \? null/u));
check(() => assert.match(cardSource, /block\.metrics[\s\S]*block\.examples[\s\S]*block\.children/u));
check(() => assert.match(pageSource, /moduleKey === "PERSONAS"\) return <PersonaPanel runtime=\{runtime\}/u));
check(() => assert.doesNotMatch(pageSource, /Aucune différence nette à mettre en avant entre vos profils/u));
check(() => assert.match(cssSource, /\.personaEditorialColumns\s*\{[^}]*grid-template-columns:\s*repeat\(2/u));
check(() => assert.match(cssSource, /\.personaMarker\s*\{/u));
check(() => assert.match(cssSource, /data-persona-renderer="BEAUTY_UNIVERSE"/u));

console.log(`Global V2 Persona editorial presentation: ${checks}/${checks} PASS`);
console.log("Published featured traits only; editorial grouping preserves engine order; invented placeholders: 0.");
