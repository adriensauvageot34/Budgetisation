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

const projection = await import("../src/analytics/global-v2/timeline-semantic-projection.ts");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const taxonomyVersion = "timeline_semantic_taxonomy@v1";
const quality = { knowledgeState: "KNOWN", limitationCodes: [], evidenceRefs: ["owner:test"] };
const place = { placeRef: "place:one", label: "Lieu", authority: "LIFE_EVENT_PRIMARY_PLACE", evidenceRefs: ["place:one"] };

const moment = (momentId, overrides = {}) => ({
  momentId,
  canonicalName: `Moment ${momentId}`,
  startDate: "2026-01-02",
  endDate: "2026-01-02",
  typeKey: "source-type",
  typeLabel: "Source type",
  familyKey: "source-family",
  participantRefs: ["person:two", "person:one", "person:one"],
  places: [place],
  causalCost: { status: "KNOWN", value: "0" },
  componentCount: 0,
  linkedLifeEventRefs: [],
  quality,
  ...overrides,
});
const lifeEvent = (lifeEventId, overrides = {}) => ({
  lifeEventId,
  canonicalTitle: `Life event ${lifeEventId}`,
  startDate: "2026-01-03",
  endDate: "2026-01-03",
  typeKey: "source-type",
  typeLabel: "Source type",
  familyKey: "source-family",
  participantRefs: [],
  places: [],
  role: "Dominant",
  closed: true,
  template: false,
  ownedByCertifiedMoment: false,
  quality,
  ...overrides,
});
const assertion = (sourceKind, id, visibilityTier, closeFamilyKey) => ({
  eventRef: sourceKind === "MOMENT" ? { sourceKind, momentId: id } : { sourceKind, lifeEventId: id },
  visibilityTier,
  closeFamilyKey,
  taxonomyVersion,
});
const resolvedLifeCost = (lifeEventId, value) => ({
  lifeEventId,
  methodVersion: "timeline-event-cost@v1",
  authority: "CANONICAL_LINKED",
  status: "KNOWN",
  value,
  reasonCode: null,
  componentKeys: [],
});

const synthetic = projection.buildTimelineSemanticProjection({
  sourceRevision: 4,
  moments: [
    moment("b", { startDate: "2026-01-01", endDate: "2026-01-04", seriesRef: "moment-series:techno" }),
    moment("a", { startDate: "2026-01-01", causalCost: { status: "PARTIAL", value: "88" } }),
    moment("unasserted"),
  ],
  lifeEvents: [
    lifeEvent("known-zero"),
    lifeEvent("unknown"),
    lifeEvent("owned", { ownedByCertifiedMoment: true }),
    lifeEvent("child", { parentLifeEventRef: "life-event:unknown" }),
    lifeEvent("series-member", { seriesRef: "life-event-series:visits" }),
  ],
  assertions: [
    assertion("MOMENT", "b", "PRINCIPAL", "soiree_techno_rave"),
    assertion("MOMENT", "a", "EXTENDED", "anniversaire"),
    assertion("LIFE_EVENT", "known-zero", "EXTENDED", "coiffeur_barbier"),
    assertion("LIFE_EVENT", "unknown", "PRINCIPAL", "visite_famille"),
    assertion("LIFE_EVENT", "owned", "PRINCIPAL", "sortie_restaurant"),
    assertion("LIFE_EVENT", "child", "EXTENDED", "activite_de_loisir_a_preciser"),
    assertion("LIFE_EVENT", "series-member", "EXTENDED", "visite_ami"),
  ],
  lifeEventCosts: [resolvedLifeCost("known-zero", "0")],
  seriesLabelsByRef: {
    "moment-series:techno": "Soirées techno",
    "life-event-series:visits": "Visites",
  },
});

check(() => assert.equal(projection.TIMELINE_SEMANTIC_PROJECTION_VERSION, "timeline-semantic-projection@v1"));
check(() => assert.deepEqual(synthetic.events.map(({ eventRef }) => eventRef), [
  "moment:a",
  "moment:b",
  "life-event:known-zero",
  "life-event:series-member",
  "life-event:unknown",
]));
check(() => assert.equal(synthetic.events.some(({ eventRef }) => eventRef === "life-event:owned"), false));
check(() => assert.equal(synthetic.events.some(({ eventRef }) => eventRef === "life-event:child"), false));
check(() => assert.equal(synthetic.events.find(({ eventRef }) => eventRef === "moment:b").endDate, "2026-01-04"));
check(() => assert.deepEqual(synthetic.events.find(({ eventRef }) => eventRef === "moment:b").series, { seriesRef: "moment-series:techno", label: "Soirées techno" }));
check(() => assert.equal(synthetic.events.filter(({ eventRef }) => eventRef.startsWith("moment-series:")).length, 0));
check(() => assert.equal(synthetic.events.find(({ eventRef }) => eventRef === "moment:a").semanticClassification.grand.key, "relations_fetes_et_evenements_de_vie"));
check(() => assert.deepEqual(synthetic.events.find(({ eventRef }) => eventRef === "moment:b").eventCost, { authority: "M6_CAUSAL", status: "KNOWN", value: "0" }));
check(() => assert.deepEqual(synthetic.events.find(({ eventRef }) => eventRef === "moment:a").eventCost, { authority: "M6_CAUSAL", status: "PARTIAL" }));
check(() => assert.deepEqual(synthetic.events.find(({ eventRef }) => eventRef === "life-event:known-zero").eventCost, { authority: "CANONICAL_LINKED", status: "KNOWN", value: "0" }));
check(() => assert.deepEqual(synthetic.events.find(({ eventRef }) => eventRef === "life-event:unknown").eventCost, { authority: "NONE", status: "UNKNOWN" }));
check(() => assert.equal("value" in synthetic.events.find(({ eventRef }) => eventRef === "life-event:unknown").eventCost, false));
check(() => assert.deepEqual(synthetic.events.find(({ eventRef }) => eventRef === "moment:b").participants, { count: 2, participantRefs: ["person:one", "person:two"] }));
check(() => assert.equal(synthetic.events.some(({ eventRef }) => eventRef === "moment:unasserted"), false));
check(() => assert.equal(JSON.stringify(synthetic).includes("evidenceRefs"), false));
check(() => assert.equal(JSON.stringify(synthetic).includes("causalComponents"), false));
check(() => assert.equal(fs.readFileSync(path.join(root, "src", "analytics", "global-v2", "timeline-semantic-projection.ts"), "utf8").includes("spentDuring"), false));
check(() => assert.throws(() => projection.buildTimelineSemanticProjection({
  sourceRevision: 4,
  moments: [],
  lifeEvents: [],
  assertions: [assertion("LIFE_EVENT", "missing", "EXTENDED", "visite_ami")],
  lifeEventCosts: [],
}), /ASSERTED_OWNER_MISSING/));

function fixtureArgument() {
  const explicit = process.argv.find((argument) => argument.startsWith("--fixture="));
  return explicit?.slice("--fixture=".length) ?? process.env.TIMELINE_IMPLEMENTATION_FIXTURE_PATH;
}

const fixturePath = fixtureArgument();
if (fixturePath !== undefined) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const eventByFixtureId = new Map(fixture.events.map((event) => [event.fixtureEntryId, event]));
  const fixtureIdentity = (entry) => {
    if (typeof entry.eventIdentityRef === "string") return entry.eventIdentityRef;
    const event = eventByFixtureId.get(entry.fixtureEntryId);
    if (typeof event?.currentIdentity?.ref === "string") return event.currentIdentity.ref;
    return `life-event:fixture-${entry.fixtureEntryId.toLowerCase()}`;
  };
  const semanticAssertions = fixture.semanticAssertions.map((entry) => {
    const [prefix, id] = fixtureIdentity(entry).split(":", 2);
    assert.ok(id, `Missing fixture identity for ${entry.fixtureEntryId}`);
    return {
      eventRef: prefix === "moment"
        ? { sourceKind: "MOMENT", momentId: id }
        : { sourceKind: "LIFE_EVENT", lifeEventId: id },
      visibilityTier: entry.visibilityTier,
      closeFamilyKey: entry.closeFamilyKey,
      taxonomyVersion: entry.taxonomyVersion,
    };
  });
  const moments = [];
  const lifeEvents = [];
  for (const entry of fixture.semanticAssertions) {
    const event = eventByFixtureId.get(entry.fixtureEntryId);
    assert.ok(event, `Missing event row for ${entry.fixtureEntryId}`);
    const [prefix, id] = fixtureIdentity(entry).split(":", 2);
    const seriesRef = typeof event.series === "string" ? event.series.split(" ", 1)[0] : undefined;
    if (prefix === "moment") {
      moments.push(moment(id, {
        canonicalName: entry.canonicalName,
        startDate: event.startDate,
        endDate: event.endDate,
        causalCost: event.cost.targetState === "KNOWN"
          ? { status: "KNOWN", value: String(event.cost.targetValueEur) }
          : { status: "UNKNOWN" },
        ...(seriesRef === undefined ? {} : { seriesRef }),
      }));
    } else {
      const parentMatch = typeof event.parentRelation === "string"
        ? event.parentRelation.match(/life-event:[0-9a-f-]+/u)
        : null;
      lifeEvents.push(lifeEvent(id, {
        canonicalTitle: entry.canonicalName,
        startDate: event.startDate,
        endDate: event.endDate,
        ...(parentMatch === null ? {} : { parentLifeEventRef: parentMatch[0] }),
        ...(seriesRef === undefined ? {} : { seriesRef }),
      }));
    }
  }
  const lifeEventCosts = fixture.costAssertions.map((entry) => {
    const id = fixtureIdentity(entry).split(":", 2)[1];
    if (entry.targetCostAuthority === "NONE") {
      return { lifeEventId: id, methodVersion: "timeline-event-cost@v1", authority: "NONE", status: "UNKNOWN", value: null, reasonCode: "NO_ACTIVE_ASSERTION", componentKeys: [] };
    }
    return {
      lifeEventId: id,
      methodVersion: "timeline-event-cost@v1",
      authority: "CANONICAL_LINKED",
      status: entry.targetCostState,
      value: entry.targetCostState === "KNOWN" ? String(entry.targetCostValueEur) : null,
      reasonCode: null,
      componentKeys: entry.expectedComponentKeys,
    };
  });
  const accepted = projection.buildTimelineSemanticProjection({
    sourceRevision: 4,
    moments,
    lifeEvents,
    assertions: semanticAssertions,
    lifeEventCosts,
    seriesLabelsByRef: { "moment-series:56c3698c-89b7-57d4-940f-34cb6e5e2362": "Soirées techno" },
  });
  const byFixtureId = (fixtureEntryId) => {
    const assertionEntry = fixture.semanticAssertions.find((entry) => entry.fixtureEntryId === fixtureEntryId);
    return assertionEntry === undefined ? undefined : accepted.events.find(({ eventRef }) => eventRef === fixtureIdentity(assertionEntry));
  };

  check(() => assert.equal(accepted.sourceRevision, 4));
  check(() => assert.deepEqual(accepted.counts, { topLevel: 172, principal: 31, extendedOnly: 141 }));
  check(() => assert.equal(new Set(accepted.events.map(({ eventRef }) => eventRef)).size, 172));
  check(() => assertPartial(byFixtureId("FX-0178"), {
    startDate: "2025-12-20",
    visibilityTier: "PRINCIPAL",
    eventCost: { authority: "M6_CAUSAL", status: "KNOWN", value: "9" },
    series: { seriesRef: "moment-series:56c3698c-89b7-57d4-940f-34cb6e5e2362", label: "Soirées techno" },
  }));
  check(() => assert.deepEqual(byFixtureId("FX-0056").eventCost, { authority: "CANONICAL_LINKED", status: "KNOWN", value: "520.36" }));
  check(() => assert.deepEqual(byFixtureId("FX-0001").eventCost, { authority: "M6_CAUSAL", status: "KNOWN", value: "983.32" }));
  check(() => assert.deepEqual(byFixtureId("FX-0048").eventCost, { authority: "CANONICAL_LINKED", status: "KNOWN", value: "20" }));
  check(() => assert.equal(byFixtureId("FX-0151"), undefined));
  const noClosure = accepted.events.find((event) => event.sourceKind === "LIFE_EVENT" && event.eventCost.authority === "NONE");
  check(() => assert.ok(noClosure));
  check(() => assert.deepEqual(noClosure.eventCost, { authority: "NONE", status: "UNKNOWN" }));
}

function assertPartial(actual, expected) {
  assert.ok(actual);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
  return actual;
}

console.log(`Global V2 timeline semantic projection checks: ${checks} passed${fixturePath === undefined ? " (fixture acceptance not requested)." : "."}`);
