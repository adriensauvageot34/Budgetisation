import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export default {};", shortCircuit: true };
    const target = specifier.startsWith("@/")
      ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href
      : specifier;
    try { return nextResolve(target, context); } catch (originalError) {
      if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw originalError;
      for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const comparator = await import("../src/analytics/global-v2/timeline-semantic-comparator.ts");
const policyModule = await import("../src/analytics/global-v2/timeline-semantic-comparator-policy.ts");
const taxonomy = await import("../src/analytics/global-v2/timeline-semantic-taxonomy.ts");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const arg = (name, envName) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? process.env[envName];

const fixturePath = arg("fixture", "TIMELINE_IMPLEMENTATION_FIXTURE_PATH");
if (fixturePath !== undefined) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  check(() => assert.equal(fixture.comparatorPolicies.length, 53));
  for (const fixturePolicy of fixture.comparatorPolicies) {
    const actual = policyModule.resolveTimelineSemanticComparatorPolicy(fixturePolicy.closeFamilyKey);
    check(() => assert.equal(actual.policyVersion, fixturePolicy.policyVersion));
    check(() => assert.equal(actual.closePolicy, fixturePolicy.closePolicy));
    check(() => assert.equal(actual.intermediatePolicy, fixturePolicy.intermediatePolicy));
    check(() => assert.equal(actual.intermediateRequiredFacets.includes("HOUSEHOLD_PARTICIPATION"), fixturePolicy.intermediatePolicy === "YES_WITH_FACET_GATE"));
    check(() => assert.equal(fixturePolicy.grandFamilyComparatorAllowed, false));
    check(() => assert.equal(fixturePolicy.grandPolicy, "NO"));
  }
}

const replayPath = arg("replay-json", "TIMELINE_SEMANTIC_REPLAY_JSON_PATH");
if (replayPath !== undefined) {
  const workbook = JSON.parse(fs.readFileSync(replayPath, "utf8"));
  const sheet = (name) => workbook.sheets.find((candidate) => candidate.name === name);
  const rows = (name) => {
    const values = sheet(name).values;
    return values.slice(1).map((row) => Object.fromEntries(values[0].map((header, index) => [header, row[index]])));
  };
  const eventReplay = rows("Event_Replay");
  const facetReplay = rows("Facet_Sensitivity");
  const fixture = fixturePath === undefined ? undefined : JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assert.ok(fixture, "The replay requires --fixture to resolve semantic keys.");
  const policyByCloseLabel = new Map(fixture.comparatorPolicies.map((entry) => [entry.closeFamilyLabel, entry]));
  const replayRowsByEvent = new Map();
  for (const row of eventReplay) {
    const existing = replayRowsByEvent.get(row["Event ref"]) ?? [];
    existing.push(row);
    replayRowsByEvent.set(row["Event ref"], existing);
  }
  const events = [...replayRowsByEvent].map(([eventRef, eventRows]) => {
    const row = eventRows[0];
    const policy = policyByCloseLabel.get(row["Famille proche"]);
    assert.ok(policy, `Missing policy for ${row["Famille proche"]}`);
    const seriesRow = eventRows.find((candidate) => candidate.Depth === "SAME_SERIES" && candidate["Policy allowed"] === "YES");
    const knownCost = typeof row["Subject cost €"] === "number";
    return {
      eventRef,
      sourceKind: row["Source kind"],
      canonicalName: row.Event,
      startDate: row.Date,
      endDate: row.Date,
      visibilityTier: row.Visibility,
      semanticClassification: taxonomy.resolveTimelineSemanticClassification(policy.closeFamilyKey),
      sourceOntology: { typeKey: "replay", typeLabel: "Replay", familyKey: "replay" },
      eventCost: knownCost
        ? { authority: row["Cost authority (replay)"] === "M6_CAUSAL" ? "M6_CAUSAL" : "CANONICAL_LINKED", status: "KNOWN", value: String(row["Subject cost €"]) }
        : { authority: "NONE", status: "UNKNOWN" },
      ...(seriesRow === undefined ? {} : { series: { seriesRef: `replay-series:${seriesRow["Cohort label"]}`, label: seriesRow["Cohort label"] } }),
      places: [],
      participants: { count: 0, participantRefs: [] },
      momentDetailAvailable: row["Source kind"] === "MOMENT",
    };
  });
  const facetByEvent = new Map(facetReplay.map((row) => [row["Event ref"], row]));
  const facetContexts = events.map((event) => {
    const replay = facetByEvent.get(event.eventRef);
    const isNightlife = event.semanticClassification.intermediate.key === "sorties_festives_et_nocturnes";
    return {
      eventRef: event.eventRef,
      facets: {
        HOUSEHOLD_PARTICIPATION: typeof replay?.HOUSEHOLD_PARTICIPATION === "string"
          ? { status: "KNOWN", value: replay.HOUSEHOLD_PARTICIPATION }
          : { status: "UNKNOWN" },
      },
      requiredFacetKeys: isNightlife ? ["HOUSEHOLD_PARTICIPATION"] : [],
    };
  });
  const result = comparator.buildTimelineSemanticComparator({
    projection: {
      methodVersion: "timeline-semantic-projection@v1",
      sourceRevision: 4,
      sortContract: "startDate ASC, eventRef ASC",
      events,
      counts: { topLevel: events.length, principal: events.filter(({ visibilityTier }) => visibilityTier === "PRINCIPAL").length, extendedOnly: events.filter(({ visibilityTier }) => visibilityTier === "EXTENDED").length },
    },
    facetContexts,
  });
  const comparison = (eventRef, level) => result.comparisons.find((candidate) => candidate.eventRef === eventRef && candidate.level === level);
  const card = (eventRef) => result.cards.find((candidate) => candidate.eventRef === eventRef);
  const eventByRef = new Map(events.map((event) => [event.eventRef, event]));
  const technoEvents = events.filter((event) => event.semanticClassification.close.key === "soiree_techno_rave");
  check(() => assert.equal(technoEvents.length, 4));
  check(() => assert.equal(technoEvents.every(({ series }) => series?.label === "Soirées techno"), true));
  for (const event of technoEvents) {
    const expected = facetByEvent.get(event.eventRef)["Techno close/series peerCount after facet"];
    check(() => assert.equal(comparison(event.eventRef, "SAME_SERIES").peerCount, expected));
    check(() => assert.equal(comparison(event.eventRef, "SAME_CLOSE_FAMILY").peerCount, expected));
    check(() => assert.equal(comparison(event.eventRef, "SAME_SERIES").supportStatus, "UNKNOWN"));
    check(() => assert.equal(comparison(event.eventRef, "SAME_CLOSE_FAMILY").supportStatus, "UNKNOWN"));
  }
  const closeEnough = (actual, expected) => expected === null || expected === undefined || expected === ""
    ? actual === undefined
    : Math.abs(Number(actual) - Number(expected)) < 1e-9;
  for (const expected of facetReplay) {
    const actual = comparison(expected["Event ref"], "SAME_INTERMEDIATE_FAMILY");
    check(() => assert.ok(actual));
    check(() => assert.equal(actual.peerCount, expected["Nightlife intermediate peerCount after facet"]));
    check(() => assert.equal(actual.supportStatus, expected["Nightlife support after facet"]));
    check(() => assert.equal(closeEnough(actual.median, expected["Median €"]), true));
    check(() => assert.equal(closeEnough(actual.q1, expected["Q1 €"]), true));
    check(() => assert.equal(closeEnough(actual.q3, expected["Q3 €"]), true));
    check(() => assert.equal(closeEnough(actual.mad, expected["MAD €"]), true));
    check(() => assert.equal(closeEnough(actual.absoluteDelta, expected["Absolute delta €"]), true));
    check(() => assert.equal(closeEnough(actual.relativeDelta, expected["Relative delta"]), true));
    check(() => assert.equal(actual.materiality.status, expected["Replay materiality"]));
    const subjectFacet = expected.HOUSEHOLD_PARTICIPATION;
    check(() => assert.equal(actual.peerRefs.every((peerRef) => facetByEvent.get(peerRef).HOUSEHOLD_PARTICIPATION === subjectFacet), true));
  }
  const both = facetReplay.filter((row) => row.HOUSEHOLD_PARTICIPATION === "BOTH_HOUSEHOLD");
  check(() => assert.equal(both.length, 8));
  check(() => assert.equal(both.every((row) => comparison(row["Event ref"], "SAME_INTERMEDIATE_FAMILY").peerCount === 7), true));
  check(() => assert.equal(result.comparisons.some((entry) => entry.peerRefs.some((peerRef) => eventByRef.get(peerRef).visibilityTier !== eventByRef.get(entry.eventRef).visibilityTier)), true));
  const fckg = events.find(({ canonicalName }) => canonicalName.includes("FCKG"));
  check(() => assert.equal(fckg.eventCost.value, "0"));
  check(() => assert.equal(comparison(fckg.eventRef, "SAME_INTERMEDIATE_FAMILY").materiality.status, "MATERIAL"));
  check(() => assert.equal(card(fckg.eventRef).defaultComparisonLevel, "SAME_INTERMEDIATE_FAMILY"));
  check(() => assert.equal(card(fckg.eventRef).distinctiveComparisonLevel, "SAME_INTERMEDIATE_FAMILY"));
  const forbiddenIntermediates = new Set([
    "culture_et_evenements_publics",
    "loisirs_et_activites",
    "sorties_restauration_et_gourmandes",
    "vehicule",
    "sante_medicale",
    "celebrations_privees",
  ]);
  check(() => assert.equal(result.comparisons.some(({ level, eventRef }) => level === "SAME_INTERMEDIATE_FAMILY" && forbiddenIntermediates.has(events.find((event) => event.eventRef === eventRef).semanticClassification.intermediate.key)), false));
  check(() => assert.equal(result.comparisons.some(({ level }) => level === "SAME_TYPE" || level === "SAME_FAMILY" || level.includes("GRAND")), false));
  check(() => assert.equal(result.cards.every(({ eventRef, comparisonLevels }) => comparisonLevels.every((level) => comparison(eventRef, level)?.peerCount >= 3)), true));
  check(() => assert.equal(result.comparisons.every(({ peerRefs }) => peerRefs.every((peerRef, index) => index === 0 || peerRefs[index - 1].localeCompare(peerRef) <= 0)), true));
  const partial = result.comparisons.find(({ supportStatus }) => supportStatus === "PARTIAL");
  check(() => assert.ok(partial));
  check(() => assert.notEqual(card(partial.eventRef).distinctiveComparisonLevel, partial.level));
}

check(() => assert.equal(policyModule.TIMELINE_SEMANTIC_COMPARATOR_VERSION, "timeline-semantic-comparator@v2"));
check(() => assert.equal(policyModule.timelineSemanticComparatorPolicies.length, 53));
check(() => assert.equal(policyModule.resolveTimelineSemanticComparatorPolicy("activite_de_loisir_a_preciser").closePolicy, "NO_UNRESOLVED"));
check(() => assert.equal(policyModule.timelineSemanticComparatorPolicies.every(({ intermediatePolicy }) => intermediatePolicy === "YES"), true));
check(() => assert.equal(policyModule.timelineSemanticComparatorPolicies.every(({ grandPolicy }) => grandPolicy === "YES_OPT_IN"), true));
const comparatorSource = fs.readFileSync(path.join(root, "src", "analytics", "global-v2", "timeline-semantic-comparator.ts"), "utf8");
check(() => assert.equal(["canonicalName", "startDate", "visibilityTier", "places", "participants", "sourceOntology"].some((field) => comparatorSource.includes(`.${field}`)), false));

console.log(`Global V2 timeline semantic comparator checks: ${checks} passed.`);
