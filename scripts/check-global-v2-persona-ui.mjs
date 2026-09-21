import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1))), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/")
      ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href
      : specifier;
    try {
      return nextResolve(target, context);
    } catch (error) {
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
const trait = (traitId, semanticKey, kind, personId, overrides = {}) => ({
  traitId,
  semanticKey,
  kind,
  family: kind === "MOBILITY" || semanticKey === "driving_license.adrien" ? "MOBILITY" : "LEISURE_AND_ACTIVITIES",
  ...personalSubject(personId),
  ...overrides,
});
const child = (traitId, semanticKey, kind, overrides = {}) => ({
  traitId,
  semanticKey,
  kind,
  family: "LEISURE_AND_ACTIVITIES",
  authorities: [],
  sourceModules: [],
  evidenceRefs: [],
  limitations: [],
  ...overrides,
});
const profile = (personId, featuredTraits, allTraits = featuredTraits) => ({ ...personalSubject(personId), allTraits, featuredTraits });
const expanded = (profiles, overrides = {}) => ({
  resource: "analysis_global_personas_expanded",
  moduleKey: "PERSONAS",
  sectionKey: "OVERVIEW",
  profile: { contractVersion: "v1", methodVersion: "global_persona_profile@v1", profiles },
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
const licence = trait("licence", "driving_license.adrien", "PROJECT", adrien, {
  temporalStatus: "PROJECT",
  qualifications: ["IN_PROGRESS"],
  metrics: { observedAmount: "UNKNOWN" },
});
const mobilityAdrien = trait("mobility-a", "mobility.work.adrien", "MOBILITY", adrien, { metrics: { directCost: 0, distanceKm: "UNKNOWN" } });
const chatgpt = trait("chatgpt", "subscription.chatgpt.adrien", "HABIT", adrien);
const beauty = trait("beauty-parent", "universe.beauty_and_care", "UNIVERSE", manon, {
  children: [
    child("mascara", "product-need:maquillage_manon_mascara", "HABIT", { metrics: { occurrenceCount: 6, typicalPrice: 32 } }),
    child("brows", "product-need:maquillage_manon_sourcils", "HABIT", { metrics: { occurrenceCount: 7 } }),
    child("skincare", "product-need:skincare_manon_masque", "HABIT"),
  ],
});
const mobilityManon = trait("mobility-m", "mobility.work.manon", "MOBILITY", manon);
const nonFeatured = trait("not-featured", "routine.not_featured", "ROUTINE", adrien);
const sharedGaming = {
  traitId: "gaming",
  semanticKey: "gaming",
  kind: "UNIVERSE",
  family: "LEISURE_AND_ACTIVITIES",
  scope: "SHARED",
  subject: { kind: "SHARED", personIds: [adrien, manon] },
};

const mappedModel = presentation.buildPersonaPresentationModel(expanded([
  profile(manon, [beauty, mobilityManon]),
  profile(adrien, [creative, licence, mobilityAdrien, chatgpt], [creative, licence, mobilityAdrien, chatgpt, nonFeatured]),
  { scope: "SHARED", subject: { kind: "SHARED", personIds: [adrien, manon] }, allTraits: [sharedGaming], featuredTraits: [sharedGaming] },
]));
const model = { ...mappedModel, profiles: presentation.orderPersonaPresentationProfiles(mappedModel.profiles) };

check(() => assert.equal(model.version, "persona_presentation@v1"));
check(() => assert.deepEqual(model.profiles.map(({ personId }) => personId), [adrien, manon]));
check(() => assert.deepEqual(model.profiles.map(({ displayName }) => displayName), ["Adrien", "Manon"]));
check(() => assert.deepEqual(model.profiles[0].cards.map(({ traitId }) => traitId), ["creative-parent", "licence", "mobility-a", "chatgpt"]));
check(() => assert.equal(model.profiles[0].cards.some(({ traitId }) => traitId === "not-featured"), false));
check(() => assert.equal(model.profiles.flatMap(({ cards }) => cards).some(({ semanticKey }) => semanticKey === "gaming"), false));
check(() => assert.deepEqual(model.profiles[0].cards.map(({ engineRank }) => engineRank), [0, 1, 2, 3]));

const creativeCard = model.profiles[0].cards[0];
check(() => assert.equal(creativeCard.component, "CreativeProjectsCard"));
check(() => assert.equal(creativeCard.title, "Projets créatifs"));
check(() => assert.deepEqual(creativeCard.examples, ["Home studio", "Musique", "Photo"]));
check(() => assert.deepEqual(creativeCard.children.map(({ title }) => title), ["Photo", "Pratiques créatives"]));
check(() => assert.equal(creativeCard.children[0].statusLabel, "En cours"));
check(() => assert.equal(Object.hasOwn(creativeCard.children[1], "statusLabel"), false));
check(() => assert.equal(creativeCard.metrics.length, 0));

const licenceCard = model.profiles[0].cards[1];
check(() => assert.equal(licenceCard.component, "DrivingLicenseCard"));
check(() => assert.equal(licenceCard.statusLabel, "En cours"));
check(() => assert.deepEqual(licenceCard.metrics, []));
check(() => assert.equal(licenceCard.title, "Permis de conduire"));

const adrienMobilityCard = model.profiles[0].cards[2];
check(() => assert.equal(adrienMobilityCard.component, "WorkMobilityCard"));
check(() => assert.deepEqual(adrienMobilityCard.metrics, [{ metricKey: "directCost", label: "Coût direct", value: 0, format: "MONEY_EUR" }]));
check(() => assert.equal(adrienMobilityCard.metrics.some(({ value }) => value === "UNKNOWN"), false));
check(() => assert.equal(model.profiles[0].cards[3].component, "HabitCard"));

const beautyCard = model.profiles[1].cards[0];
check(() => assert.equal(beautyCard.component, "BeautyUniverseCard"));
check(() => assert.deepEqual(beautyCard.children.map(({ title }) => title), ["Mascara", "Sourcils", "Soin de la peau"]));
check(() => assert.equal(beautyCard.children.some(({ title }) => title === "Épilation"), false));
check(() => assert.deepEqual(beautyCard.children[0].metrics, [
  { metricKey: "typicalPrice", label: "Prix typique", value: 32, format: "MONEY_EUR" },
  { metricKey: "occurrenceCount", label: "Occurrences", value: 6, format: "COUNT" },
]));
check(() => assert.equal(model.profiles[1].cards[1].component, "WorkMobilityCard"));

const genericKinds = [
  ["ROUTINE", "RoutineCard"],
  ["HABIT", "HabitCard"],
  ["UNIVERSE", "UniverseCard"],
  ["PROJECT", "ProjectCard"],
  ["MOBILITY", "MobilityCard"],
  ["HOUSEHOLD_ORGANIZATION", "HouseholdOrganizationCard"],
];
for (const [kind, component] of genericKinds) {
  const card = presentation.presentPersonaTrait(trait(`generic-${kind}`, `generic.${kind.toLowerCase()}`, kind, adrien), 0);
  check(() => assert.equal(card.component, component));
}
check(() => assert.equal(presentation.personaTemporalStatusLabel("HISTORICAL"), "Utilisé auparavant"));
check(() => assert.equal(presentation.personaTemporalStatusLabel("STABLE"), undefined));
check(() => assert.equal(presentation.personaTemporalStatusLabel("UNKNOWN"), undefined));
check(() => assert.equal(presentation.presentPersonaTrait(sharedGaming, 0), undefined));

const onlyThree = presentation.buildPersonaPresentationModel(expanded([profile(adrien, [creative, licence, mobilityAdrien])]));
check(() => assert.equal(onlyThree.profiles[0].cards.length, 3));
check(() => assert.equal(presentation.buildPersonaPresentationModel(expanded([], { profile: undefined })).profiles.length, 0));
check(() => assert.equal(presentation.buildPersonaPresentationModel(expanded([], { sectionKey: "PATTERNS" })).profiles.length, 0));
check(() => assert.equal(presentation.PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1["universe.beauty_and_care"].component, "BeautyUniverseCard"));
check(() => assert.equal(presentation.PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1["mobility.work.manon"].component, "WorkMobilityCard"));

const source = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-presentation.ts"), "utf8");
const viewSource = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-view.tsx"), "utf8");
const cardSource = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-card.tsx"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-page.tsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
check(() => assert.doesNotMatch(source, /\.sort\(|\.reduce\(|characteristicScore|selectFeatured|promotePersona|buildPersonaProfile/u));
check(() => assert.doesNotMatch(source, /from\s+["']@\/analytics|from\s+["']@\/server|@supabase/u));
check(() => assert.doesNotMatch(source, /import\s+(?:React|\{[^}]*use(?:State|Effect|Memo))/u));
check(() => assert.match(viewSource, /orderPersonaPresentationProfiles\(presentation\.profiles\)\.slice\(0, 2\)/u));
check(() => assert.match(viewSource, /Adrien \+ Manon[\s\S]*♡ Nous deux/u));
check(() => assert.match(viewSource, /personaColumns[\s\S]*profile\.cards\.map/u));
check(() => assert.doesNotMatch(viewSource, /compare|comparison|différence|gagnant|perdant/iu));
check(() => assert.match(cardSource, /card\.children\.length === 0 \? null/u));
check(() => assert.match(cardSource, /card\.metrics[\s\S]*card\.examples[\s\S]*card\.children/u));
check(() => assert.doesNotMatch(cardSource, /\.reduce\(|\.sort\(|USER_VALIDATED|evidenceRefs|sourceModules/u));
check(() => assert.match(pageSource, /moduleKey === "PERSONAS"\) return <PersonaPanel runtime=\{runtime\}/u));
check(() => assert.doesNotMatch(pageSource, /Aucune différence nette à mettre en avant entre vos profils/u));
check(() => assert.doesNotMatch(pageSource, /function PersonaColumns/u));
check(() => assert.match(cssSource, /\.module\[data-module="PERSONAS"\]\s*\{[^}]*grid-column:\s*span 12/u));
check(() => assert.match(cssSource, /\.personaColumns\s*\{[^}]*grid-template-columns:\s*repeat\(2/u));
check(() => assert.match(cssSource, /\.personaPersonHeader\s*\{[^}]*position:\s*sticky/u));

console.log(`Global V2 Persona presentation: ${checks}/${checks} PASS`);
console.log("Expanded profile only; featured order preserved; client analytics recalculation: 0.");
