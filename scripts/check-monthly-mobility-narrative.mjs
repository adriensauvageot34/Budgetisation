import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/u.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const {
  MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION,
  MOBILITY_ROUTINE_GROUP_POLICY,
  MOBILITY_USAGE_BAND_POLICY,
  buildMonthlyMobilityNarrative,
  resolveMobilityNarrativePlaceRole,
  resolveMobilityNarrativeSemanticFamily,
} = await import("../src/analytics/global-v2/monthly-mobility-narrative.ts");

const H = "home";
const W = "work";
const G = "grocery";
const F = "family";
const L = "leisure";
const X = "unknown";
const S = "ski";
const places = [
  { placeId: H, role: "HOME", displayLabel: "Maison", authority: "CONFIRMED" },
  { placeId: W, role: "WORK", displayLabel: "Lieu de travail", authority: "EXPLICIT" },
  { placeId: G, role: "GROCERY", displayLabel: "Supermarché", authority: "CONFIRMED" },
  { placeId: F, role: "FAMILY", displayLabel: "Servian", authority: "CONFIRMED" },
  { placeId: L, role: "LEISURE", displayLabel: "Sortie locale", authority: "CONFIRMED" },
  { placeId: S, role: "TRAVEL", displayLabel: "Les 7 Laux", authority: "CONFIRMED" },
];

let legCounter = 0;
function leg(date, sequenceIndex, originPlaceId, destinationPlaceId, cost = "5") {
  legCounter += 1;
  return {
    mobilityLegId: `leg-${String(legCounter).padStart(3, "0")}`,
    sequenceIndex,
    travelDate: date,
    originPlaceId,
    destinationPlaceId,
    distanceKm: String(Number(cost) * 10),
    estimatedFuelLiters: String(Number(cost) / 2),
    estimatedFuelCost: cost,
  };
}

function trip(id, specs, overrides = {}) {
  const legs = specs.map(([date, origin, destination, cost], index) => leg(date, index, origin, destination, cost));
  return {
    mobilityTripId: id,
    householdId: "household-1",
    startDate: legs[0].travelDate,
    endDate: legs.at(-1).travelDate,
    tripShape: legs[0].travelDate === legs.at(-1).travelDate ? "ROUND_TRIP" : "MULTI_DAY_JOURNEY",
    boundaryStatus: legs[0].originPlaceId === H && legs.at(-1).destinationPlaceId === H ? "CLOSED_HOME" : "OPEN_END",
    knowledgeState: "KNOWN",
    legs,
    ...overrides,
  };
}

let contextCounter = 0;
function context(mobilityTripId, semanticFamily, overrides = {}) {
  contextCounter += 1;
  return {
    mobilityTripContextLinkId: `context-${String(contextCounter).padStart(3, "0")}`,
    mobilityTripId,
    targetKind: "LIFE_EVENT",
    relationType: "STOP_CONTEXT",
    semanticFamily,
    semanticTier: 2,
    validationStatus: "CONFIRMED",
    displayLabel: null,
    anchorPlaceId: null,
    evidenceRefs: [`fixture:${mobilityTripId}`],
    ...overrides,
  };
}

const trips = [
  trip("work-1", [["2026-01-05", H, W, "3"], ["2026-01-05", W, H, "3"]]),
  trip("work-2", [["2026-01-06", H, W, "4"], ["2026-01-06", W, H, "4"]]),
  trip("work-grocery-1", [["2026-01-07", H, W, "3"], ["2026-01-07", W, G, "2"], ["2026-01-07", G, H, "2"]]),
  trip("work-grocery-2", [["2026-01-08", H, W, "3"], ["2026-01-08", W, G, "2"], ["2026-01-08", G, H, "2"]]),
  trip("grocery-1", [["2026-01-09", H, G, "2"], ["2026-01-09", G, H, "2"]]),
  trip("grocery-2", [["2026-01-10", H, G, "2"], ["2026-01-10", G, H, "2"]]),
  trip("family-1", [["2026-01-11", H, F, "3"], ["2026-01-11", F, H, "3"]]),
  trip("family-2", [["2026-01-18", H, F, "3"], ["2026-01-18", F, H, "3"]]),
  trip("family-3", [["2026-02-01", H, F, "3"], ["2026-02-01", F, H, "3"]]),
  trip("unresolved", [["2026-01-12", H, X, "4"], ["2026-01-12", X, H, "4"]]),
  trip("ski", [["2026-02-26", H, S, "11"], ["2026-03-01", S, H, "13"]]),
];

const contexts = [
  context("work-1", "WORK"),
  context("work-2", "WORK"),
  context("work-grocery-1", "WORK"),
  context("work-grocery-2", "WORK"),
  context("family-1", "FAMILY"),
  context("family-2", "FAMILY"),
  context("family-3", "FAMILY"),
  context("ski", "TRAVEL", {
    targetKind: "MOMENT",
    relationType: "ENVELOPING_CONTEXT",
    semanticTier: 1,
    displayLabel: "Séjour ski",
  }),
];

const result = buildMonthlyMobilityNarrative({ trips, contexts, places });
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

check(() => {
  assert.equal(result.methodVersion, MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION);
  assert.equal(result.routineGroupPolicy.policyRef, MOBILITY_ROUTINE_GROUP_POLICY.policyRef);
  assert.equal(result.usageBandPolicy.policyRef, MOBILITY_USAGE_BAND_POLICY.policyRef);
});

check(() => {
  assert.equal(resolveMobilityNarrativeSemanticFamily("deplacement_pro"), "WORK");
  assert.equal(resolveMobilityNarrativeSemanticFamily("voyage_sejour"), "TRAVEL");
  assert.equal(resolveMobilityNarrativeSemanticFamily("unknown_type"), "OTHER");
  assert.equal(resolveMobilityNarrativePlaceRole({ usagePrincipal: null, explicitRoles: ["PRIMARY_WORK"] }), "WORK");
  assert.equal(resolveMobilityNarrativePlaceRole({ usagePrincipal: "Courses", explicitRoles: [] }), "GROCERY");
});

for (const month of result.months) {
  check(() => {
    const expectedTrips = trips.filter((candidate) => candidate.legs.some(({ travelDate }) => travelDate.startsWith(month.month)));
    assert.equal(month.partition.length, expectedTrips.length);
    assert.equal(new Set(month.partition.map(({ mobilityTripId }) => mobilityTripId)).size, expectedTrips.length);
    assert.ok(month.partition.every(({ destination }) => ["ROUTINE_GROUP", "TRIP_SUMMARY", "SUPPRESSED"].includes(destination)));
  });
  check(() => {
    const routine = new Set(month.partition.filter(({ destination }) => destination === "ROUTINE_GROUP").map(({ mobilityTripId }) => mobilityTripId));
    const summary = new Set(month.partition.filter(({ destination }) => destination === "TRIP_SUMMARY").map(({ mobilityTripId }) => mobilityTripId));
    const suppressed = new Set(month.partition.filter(({ destination }) => destination === "SUPPRESSED").map(({ mobilityTripId }) => mobilityTripId));
    assert.equal([...routine].some((id) => summary.has(id) || suppressed.has(id)), false);
    assert.equal([...summary].some((id) => suppressed.has(id)), false);
  });
  check(() => {
    assert.ok(month.routineGroups.length <= 3);
    assert.ok(month.tripSummaries.length <= 12);
    assert.ok(month.contextOnly.length <= 4);
    assert.ok(month.initialSurface.length <= 5);
  });
  check(() => {
    for (const item of month.contextOnly) {
      assert.equal("monthContribution" in item, false);
      assert.equal("estimatedFuelCost" in item, false);
    }
  });
  check(() => {
    const visible = JSON.stringify({
      routines: month.routineGroups.map(({ title }) => title),
      summaries: month.tripSummaries.map(({ title }) => title),
      contexts: month.contextOnly.map(({ title }) => title),
      remainder: month.suppressedRemainder.displayText,
    });
    assert.doesNotMatch(visible, /(^|[^A-Z0-9])(NAV|JOUR|AUT|MobilityLeg)([^A-Z0-9]|$)/u);
    assert.doesNotMatch(month.suppressedRemainder.displayText, /Autres déplacements\s*[—-]\s*\d/u);
    assert.doesNotMatch(month.suppressedRemainder.displayText, /€/u);
  });
  check(() => {
    const add = (key) => ["aroundWork", "outsideWork", "unresolved"].reduce(
      (total, band) => total + Number(month.usageBands[band][key]), 0);
    assert.equal(add("estimatedFuelCost"), Number(month.usageBands.modeledUsage.estimatedFuelCost));
    assert.equal(add("distanceKm"), Number(month.usageBands.modeledUsage.distanceKm));
    assert.equal(add("estimatedFuelLiters"), Number(month.usageBands.modeledUsage.estimatedFuelLiters));
  });
}

const january = result.months.find(({ month }) => month === "2026-01");
const february = result.months.find(({ month }) => month === "2026-02");
const march = result.months.find(({ month }) => month === "2026-03");
assert.ok(january && february && march);

check(() => {
  assert.ok(january.routineGroups.some(({ pattern, title }) => pattern === "WORK_ONLY" && title === "Trajets travail"));
  assert.ok(january.routineGroups.some(({ pattern, title }) => pattern === "WORK_GROCERY" && title === "Travail + courses"));
  assert.ok(january.routineGroups.some(({ pattern, title }) => pattern === "FAMILY_DESTINATION" && title === "Visites famille — Servian"));
});

check(() => {
  const unresolved = january.partition.find(({ mobilityTripId }) => mobilityTripId === "unresolved");
  assert.equal(unresolved?.usageBand, "UNRESOLVED");
  assert.notEqual(unresolved?.usageBand, "OUTSIDE_WORK");
  assert.ok(Number(january.usageBands.classificationCoverage) < 1);
});

check(() => {
  const skiFebruary = february.tripSummaries.find(({ mobilityTripId }) => mobilityTripId === "ski");
  const skiMarch = march.tripSummaries.find(({ mobilityTripId }) => mobilityTripId === "ski");
  assert.ok(skiFebruary && skiMarch);
  assert.equal(skiFebruary.crossMonth, true);
  assert.equal(Number(skiFebruary.monthContribution.estimatedFuelCost) + Number(skiMarch.monthContribution.estimatedFuelCost), Number(skiFebruary.fullTrip.estimatedFuelCost));
  assert.equal(february.partition.find(({ mobilityTripId }) => mobilityTripId === "ski")?.destination, "TRIP_SUMMARY");
  assert.equal(march.partition.find(({ mobilityTripId }) => mobilityTripId === "ski")?.destination, "TRIP_SUMMARY");
});

check(() => {
  assert.equal(february.usageBands.classificationCoverage, "1.000000");
  assert.equal(march.usageBands.classificationCoverage, "1.000000");
  assert.ok(result.annualNarrativeCandidates.length <= 5);
});

// Explicit workday outing pattern.
const outings = [
  trip("outing-1", [["2026-04-01", W, L, "2"], ["2026-04-01", L, W, "2"], ["2026-04-01", W, H, "2"]], { boundaryStatus: "CLOSED_HOME" }),
  trip("outing-2", [["2026-04-02", W, L, "2"], ["2026-04-02", L, W, "2"], ["2026-04-02", W, H, "2"]], { boundaryStatus: "CLOSED_HOME" }),
];
const outingResult = buildMonthlyMobilityNarrative({ trips: outings, contexts: [], places });
check(() => assert.equal(outingResult.months[0].routineGroups[0].pattern, "WORKDAY_OUTING"));

// Narrative caps remain strict even when every Trip is important.
const cappedTrips = Array.from({ length: 15 }, (_, index) => trip(
  `important-${String(index).padStart(2, "0")}`,
  [[`2026-05-${String(index + 1).padStart(2, "0")}`, H, L, "1"]],
));
const cappedContexts = cappedTrips.map(({ mobilityTripId }, index) => context(mobilityTripId, "LEISURE", {
  relationType: "PRIMARY_CONTEXT",
  displayLabel: `Sortie personnelle ${index + 1}`,
}));
const capped = buildMonthlyMobilityNarrative({ trips: cappedTrips, contexts: cappedContexts, places }).months[0];
check(() => {
  assert.equal(capped.tripSummaries.length, 12);
  assert.equal(capped.contextOnly.length, 3);
  assert.equal(capped.suppressedRemainder.tripCount, 3);
  assert.equal(capped.initialSurface.length, 5);
});

const reversed = buildMonthlyMobilityNarrative({
  trips: [...trips].reverse().map((value) => ({ ...value, legs: [...value.legs].reverse() })),
  contexts: [...contexts].reverse(),
  places: [...places].reverse(),
});
check(() => {
  assert.equal(result.inputHash, reversed.inputHash);
  assert.equal(result.outputHash, reversed.outputHash);
  assert.deepEqual(result.months, reversed.months);
});

console.log(JSON.stringify({
  status: "PASS",
  methodVersion: MONTHLY_MOBILITY_NARRATIVE_METHOD_VERSION,
  checks,
  months: result.months.length,
  assertions: "exclusive partition, routine thresholds, usage bands, coverage, cross-month contribution, caps, hidden technical labels, deterministic output",
}));
