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
const workSite = trait("work-site", "activity:travail_site", "ROUTINE", adrien, { metrics: { occurrenceCount: 115, medianIntervalDays: 2 } });
const remoteWork = trait("remote-work", "activity:teletravail", "ROUTINE", manon, { metrics: { occurrenceCount: 24 } });
const familyVisit = trait("family-visit", "activity:visite_famille", "ROUTINE", manon, { metrics: { occurrenceCount: 8 } });
const groceries = trait("groceries", "activity:courses_alimentaires", "ROUTINE", adrien, { metrics: { occurrenceCount: 15 } });
const pharmacy = trait("pharmacy", "activity:pharmacie", "ROUTINE", adrien, { metrics: { occurrenceCount: 4 } });
const restaurant = trait("restaurant", "activity:repas_restaurant", "ROUTINE", manon, { metrics: { occurrenceCount: 11 } });
const friendVisit = trait("friend-visit", "activity:visite_ami", "ROUTINE", manon, { metrics: { occurrenceCount: 6 } });
const professionalTrip = trait("professional-trip", "activity:deplacement_pro", "ROUTINE", manon, { metrics: { occurrenceCount: 5 } });
const unknownActivity = trait("unknown-activity", "activity:unknown_activity", "ROUTINE", adrien, { metrics: { occurrenceCount: 99 } });

const beauty = trait("beauty-parent", "universe.beauty_and_care", "UNIVERSE", manon, {
  children: [
    child("mascara", "product-need:maquillage_manon_mascara", "HABIT", { metrics: { occurrenceCount: 6, typicalPrice: 32 } }),
    child("brows", "product-need:maquillage_manon_sourcils", "HABIT", { metrics: { occurrenceCount: 7 } }),
    child("skincare", "product-need:skincare_manon_masque", "HABIT"),
    child("unknown-child", "product-need:opaque", "HABIT", { metrics: { occurrenceCount: 99 } }),
  ],
});
const mobilityManon = trait("mobility-m", "mobility.work.manon", "MOBILITY", manon);
const rhythmManon = remoteWork;
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

// Canonical activity labels are resolved from the existing Life Event catalog.
check(() => assert.equal(presentation.presentPersonaTrait(workSite, 0)?.title, "Travail sur site"));
check(() => assert.equal(presentation.presentPersonaTrait(remoteWork, 0)?.title, "Télétravail"));
check(() => assert.equal(presentation.presentPersonaTrait(familyVisit, 0)?.title, "Visite familiale"));
check(() => assert.equal(presentation.presentPersonaTrait(unknownActivity, 0), undefined));
check(() => assert.equal(blocks(adrienProfile).some(({ title }) => title === "Activité récurrente"), false));
check(() => assert.equal(blocks(manonProfile).some(({ title }) => title === "Activité récurrente"), false));

// Activity groups are semantic and person-agnostic.
check(() => assert.equal(presentation.presentPersonaTrait(groceries, 0)?.editorialGroup, "RECURRING_LIFE"));
check(() => assert.equal(presentation.presentPersonaTrait(pharmacy, 0)?.editorialGroup, "RECURRING_LIFE"));
check(() => assert.equal(presentation.presentPersonaTrait(restaurant, 0)?.editorialGroup, "RECURRING_LIFE"));
check(() => assert.equal(presentation.presentPersonaTrait(friendVisit, 0)?.editorialGroup, "RECURRING_LIFE"));
check(() => assert.equal(presentation.presentPersonaTrait(professionalTrip, 0)?.editorialGroup, "RECURRING_LIFE"));
check(() => assert.equal(presentation.presentPersonaTrait(workSite, 0)?.editorialGroup, "DAILY_RHYTHM"));
check(() => assert.equal(presentation.presentPersonaTrait(remoteWork, 0)?.editorialGroup, "DAILY_RHYTHM"));
check(() => assert.equal(presentation.presentPersonaTrait(rhythmAdrien, 0)?.editorialGroup, "DAILY_RHYTHM"));

// D: one creative block aggregates its known examples and children.
check(() => assert.equal(adrienProfile.phasedProjects[0].renderer, "CREATIVE_UNIVERSE"));
check(() => assert.equal(adrienProfile.phasedProjects[0].title, "Projets créatifs"));
check(() => assert.deepEqual(adrienProfile.phasedProjects[0].examples, ["Home studio", "Musique", "Photo"]));
check(() => assert.deepEqual(adrienProfile.phasedProjects[0].children.map(({ title }) => title), []));
check(() => assert.equal(adrienProfile.phasedProjects[0].children.some(({ title }) => adrienProfile.phasedProjects[0].examples.includes(title)), false));

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

// Non-positive day intervals are editorially meaningless; explicit zero money is not.
const dayMetricBlock = (value) => presentation.presentPersonaTrait(trait(`days-${value}`, "activity:travail_site", "ROUTINE", adrien, { metrics: { occurrenceCount: 1, medianIntervalDays: value } }), 0);
check(() => assert.equal(dayMetricBlock(0).metrics.some(({ format }) => format === "DAYS"), false));
check(() => assert.equal(dayMetricBlock(-1).metrics.some(({ format }) => format === "DAYS"), false));
check(() => assert.deepEqual(dayMetricBlock(57).metrics.find(({ format }) => format === "DAYS")?.value, 57));
check(() => assert.equal(adrienProfile.dailyRhythms[0].metrics.find(({ format }) => format === "MONEY_EUR")?.value, 0));

// J, M, N: no balancing card or marker is fabricated.
check(() => assert.equal(adrienProfile.markers.length, 4));
check(() => assert.equal(manonProfile.markers.length, 3));
check(() => assert.notEqual(blocks(adrienProfile).length, blocks(manonProfile).length));
const onlyMobility = presentation.buildPersonaPresentationModel(expanded([profile(adrien, [mobilityAdrien])]));
check(() => assert.equal(onlyMobility.profiles[0].markers.length, 1));
check(() => assert.equal(onlyMobility.profiles[0].recurringLife.length, 0));
check(() => assert.equal(onlyMobility.profiles[0].phasedProjects.length, 0));

// Marker identity is icon + normalized title; detail blocks remain exhaustive.
const duplicateMarkers = presentation.buildPersonaPresentationModel(expanded([profile(adrien, [workSite, { ...workSite, traitId: "work-site-again" }])]));
check(() => assert.equal(duplicateMarkers.profiles[0].markers.length, 1));
check(() => assert.equal(duplicateMarkers.profiles[0].dailyRhythms.length, 2));
check(() => assert.deepEqual(duplicateMarkers.profiles[0].dailyRhythms.map(({ engineRank }) => engineRank), [0, 1]));

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
check(() => assert.equal(presentation.formatPersonaDate("2025-07-31"), "31 juil. 2025"));
check(() => assert.equal(presentation.formatPersonaDate("not-a-date"), "not-a-date"));
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
check(() => assert.match(source, /LIFE_EVENT_ACTIVITY_CATALOG[\s\S]*@\/analytics\/history-v2\/calendar\/catalog/u));
check(() => assert.doesNotMatch(source, /@\/analytics\/production|from\s+["']@\/server|@supabase/u));
check(() => assert.doesNotMatch(source, /["'](?:Routine|Projet|Habitude|Univers|Mobilité)["']/u));
check(() => assert.doesNotMatch(source, /["'](?:Adrien|Manon)["']/u));
check(() => assert.match(source, /editorialGroup[\s\S]*renderer[\s\S]*metricsPolicy[\s\S]*childrenStrategy[\s\S]*temporalTreatment/u));
check(() => assert.match(source, /markers\.length < 4/u));
check(() => assert.match(source, /markerIdentities\.has\(markerIdentity\)/u));
check(() => assert.doesNotMatch(source, /title:\s*"Activité récurrente"/u));
check(() => assert.match(source, /dailyActivityIds[\s\S]*travail_site[\s\S]*teletravail[\s\S]*journee_maison/u));
check(() => assert.match(source, /exampleTitles\.has\(normalizedEditorialTitle\(presented\.title\)\)/u));
check(() => assert.match(viewSource, /Portraits express[\s\S]*Vos rythmes du quotidien[\s\S]*Ce qui revient chez chacun[\s\S]*Ce qui vit par phases/u));
check(() => assert.match(viewSource, /<h2 id=\{headingId\}>Nos profils<\/h2>[\s\S]*Deux quotidiens, deux façons de dépenser/u));
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
check(() => assert.match(cssSource, /\.personaMarkers\s*\{[^}]*grid-template-columns:\s*repeat\(2/u));
check(() => assert.match(cssSource, /\.personaMarker\s*\{[^}]*background:\s*rgb\(232 237 229 \/ \.26\)/u));
check(() => assert.match(cssSource, /data-persona-section="dailyRhythms"[\s\S]*data-persona-renderer="RHYTHM"/u));
check(() => assert.match(viewSource, /data-persona-layout=\{visibleProfiles\.length === 1 \? "single" : "paired"\}/u));
check(() => assert.match(cssSource, /data-persona-section="phasedProjects"[\s\S]*data-persona-layout="single"[\s\S]*64%/u));
check(() => assert.match(cssSource, /\.module\[data-module="PERSONAS"\]\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none/u));
check(() => assert.match(cssSource, /data-persona-renderer="BEAUTY_UNIVERSE"/u));

console.log(`Global V2 Persona editorial presentation: ${checks}/${checks} PASS`);
console.log("Published featured traits only; editorial grouping preserves engine order; invented placeholders: 0.");
