import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href : specifier;
  try { return nextResolve(target, context); } catch (error) {
    if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
    for (const candidate of [`${target}.ts`, `${target}/index.ts`]) try { return nextResolve(candidate, context); } catch { /* continue */ }
    throw error;
  }
} });

const { buildTimelineSemanticComparator } = await import("../src/analytics/global-v2/timeline-semantic-comparator.ts");
const { resolveTimelineSemanticClassification } = await import("../src/analytics/global-v2/timeline-semantic-taxonomy.ts");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const known = (value) => ({ authority: "M6_CAUSAL", status: "KNOWN", value: String(value) });
const event = (id, name, close, cost, series) => ({
  eventRef: `moment:${id}`,
  sourceKind: "MOMENT",
  canonicalName: name,
  startDate: "2026-01-01",
  endDate: "2026-01-01",
  visibilityTier: id.endsWith("e") ? "EXTENDED" : "PRINCIPAL",
  semanticClassification: resolveTimelineSemanticClassification(close),
  sourceOntology: { typeKey: "test", typeLabel: "Test", familyKey: "test" },
  eventCost: cost === undefined ? { authority: "NONE", status: "UNKNOWN" } : known(cost),
  ...(series === undefined ? {} : { series: { seriesRef: series, label: "Soirées techno" } }),
  places: [], participants: { count: 0, participantRefs: [] }, momentDetailAvailable: true,
});

const events = [
  event("dieze14", "Dieze 14 juin", "soiree_techno_rave", 20, "series:techno"),
  event("dieze15e", "Dieze 15 août", "soiree_techno_rave", 30, "series:techno"),
  event("fckg", "FCKG Halloween", "soiree_techno_rave", 0, "series:techno"),
  event("dieze20", "Dieze 20 décembre", "soiree_techno_rave", 9, "series:techno"),
  event("milk", "Milk Club", "club_boite_de_nuit", 15),
  event("kayak", "Kayak", "activite_nautique", 40),
  event("feria", "Feria", "feria_fete_populaire", 20),
  event("orelsan", "Orelsan", "concert_spectacle_musical", 159.4),
  event("plage", "Plage", "journee_plage_baignade", 10),
  event("minorque", "Minorque", "voyage_vacances_a_l_etranger", 1000),
  event("valras", "Valras", "sejour_vacances_en_france", undefined),
  event("ski", "Ski", "sejour_ski", 600),
  event("aveyron", "Aveyron", "week_end_escapade_regionale", 300),
  event("clim", "Climatisation", "achat_installation_d_un_equipement_important", 500),
  event("salon", "Salon", "amenagement_interieur", 800),
  event("canape", "Canapé", "recherche_de_mobilier_pour_un_projet", 400),
  event("repair", "Réparation voiture", "reparation", 200),
  event("control", "Contrôle technique", "controle_technique", 90),
];
const contexts = events.map(({ eventRef }, index) => ({ eventRef, facets: { HOUSEHOLD_PARTICIPATION: { status: "KNOWN", value: index % 2 ? "BOTH_HOUSEHOLD" : "PERSON_ONLY:one" } }, requiredFacetKeys: [] }));
const result = buildTimelineSemanticComparator({ projection: { methodVersion: "timeline-semantic-projection@v1", sourceRevision: 4, sortContract: "startDate ASC, eventRef ASC", events, counts: { topLevel: events.length, principal: events.filter(({ visibilityTier }) => visibilityTier === "PRINCIPAL").length, extendedOnly: events.filter(({ visibilityTier }) => visibilityTier === "EXTENDED").length } }, facetContexts: contexts });
const comparison = (name, level) => {
  const ref = events.find((candidate) => candidate.canonicalName === name)?.eventRef;
  return result.comparisons.find((candidate) => candidate.eventRef === ref && candidate.level === level);
};
const peerNames = (entry) => entry?.relatedPeerRefs.map((ref) => events.find((candidate) => candidate.eventRef === ref)?.canonicalName) ?? [];

for (const name of ["Dieze 14 juin", "Dieze 15 août", "FCKG Halloween", "Dieze 20 décembre"]) {
  const series = comparison(name, "SAME_SERIES");
  check(() => assert.equal(series.relatedPeerCount, 3));
  check(() => assert.equal(peerNames(series).includes("Milk Club"), false));
}
check(() => assert.equal(peerNames(comparison("Milk Club", "SAME_INTERMEDIATE_FAMILY")).includes("Dieze 14 juin"), true));
check(() => assert.equal(peerNames(comparison("Kayak", "SAME_CLOSE_FAMILY")).includes("Feria"), false));
check(() => assert.equal(peerNames(comparison("Kayak", "SAME_INTERMEDIATE_FAMILY")).includes("Feria"), false));
check(() => assert.equal(peerNames(comparison("Kayak", "SAME_GRAND_FAMILY")).includes("Feria"), true));
check(() => assert.equal(peerNames(comparison("Orelsan", "SAME_INTERMEDIATE_FAMILY")).some((name) => name === "Kayak" || name === "Plage"), false));
check(() => assert.equal(peerNames(comparison("Orelsan", "SAME_GRAND_FAMILY")).includes("Kayak"), true));
for (const name of ["Valras", "Ski", "Aveyron", "Minorque"]) check(() => assert.equal(comparison(name, "SAME_GRAND_FAMILY").relatedPeerCount, 3));
check(() => assert.equal(comparison("Valras", "SAME_GRAND_FAMILY").costPeerCount, 3));
check(() => assert.equal(comparison("Valras", "SAME_GRAND_FAMILY").median !== undefined, true));
check(() => assert.equal(comparison("Climatisation", "SAME_INTERMEDIATE_FAMILY").supportStatus, "LIMITED"));
check(() => assert.equal(comparison("Réparation voiture", "SAME_INTERMEDIATE_FAMILY").supportStatus, "LIMITED"));
check(() => assert.equal(result.cards.find(({ eventRef }) => eventRef === events.find(({ canonicalName }) => canonicalName === "Kayak").eventRef).defaultComparisonLevel, "SAME_INTERMEDIATE_FAMILY"));
check(() => assert.equal(result.cards.find(({ eventRef }) => eventRef === events.find(({ canonicalName }) => canonicalName === "Ski").eventRef).defaultComparisonLevel, undefined));
check(() => assert.equal(result.comparisons.every(({ relatedPeerCount, peerRefs }) => relatedPeerCount === peerRefs.length), true));
check(() => assert.equal(result.comparisons.every(({ costPeerCount, peerCosts }) => costPeerCount === peerCosts.length), true));
check(() => assert.equal(comparison("FCKG Halloween", "SAME_SERIES").peerCosts.some(({ value }) => value === "0"), false));
check(() => assert.equal(comparison("Dieze 14 juin", "SAME_SERIES").peerCosts.some(({ value }) => value === "0"), true));

console.log(`Global V2 timeline product alignment checks: ${checks}/${checks} PASS`);
