import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const {
  MOBILITY_TRIP_METHOD_VERSION,
  reconstructMobilityTrips,
} = await import("../src/server/canonical/mobility-trips.ts");

const HOUSEHOLD = "10000000-0000-4000-8000-000000000001";
const VEHICLE = "20000000-0000-4000-8000-000000000001";
const HOME = "30000000-0000-4000-8000-000000000001";
const WORK = "30000000-0000-4000-8000-000000000002";
const GROCERY = "30000000-0000-4000-8000-000000000003";
const OTHER = "30000000-0000-4000-8000-000000000004";

function leg(id, origin, destination, time, overrides = {}) {
  return {
    legId: `40000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    householdId: HOUSEHOLD,
    vehicleId: VEHICLE,
    date: "2026-01-10",
    observedTime: time,
    timeAuthority: time === null ? "PROXY" : "OBSERVED",
    timeType: "DEPARTURE",
    origin: { placeId: origin, sourceLabel: null },
    destination: { placeId: destination, sourceLabel: null },
    estimatedFuelCost: String(id),
    sourceLegId: `AUT-${String(id).padStart(4, "0")}`,
    evidenceRefs: [`fixture:${id}`],
    ...overrides,
  };
}

function build(legs, bridges = []) {
  return reconstructMobilityTrips({ legs, homePlaceIds: [HOME], bridges, sourceRevision: 106 });
}

const circuit = build([
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
  leg(2, WORK, GROCERY, "2026-01-10T17:00:00"),
  leg(3, GROCERY, HOME, "2026-01-10T18:00:00"),
]);
assert.equal(circuit.trips.length, 1);
assert.equal(circuit.trips[0].memberships.length, 3);
assert.equal(circuit.trips[0].tripShape, "MULTI_STOP_CIRCUIT");
assert.equal(circuit.trips[0].boundaryStatus, "CLOSED_HOME");
assert.equal(circuit.trips[0].estimatedFuelCost, "6");

const twoTrips = build([
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
  leg(2, WORK, HOME, "2026-01-10T12:00:00"),
  leg(3, HOME, GROCERY, "2026-01-10T15:00:00"),
  leg(4, GROCERY, HOME, "2026-01-10T16:00:00"),
]);
assert.equal(twoTrips.trips.length, 2, "Le retour HOME ferme immédiatement le Trip.");
assert.deepEqual(twoTrips.trips.map(({ memberships }) => memberships.length), [2, 2]);

const workLoop = build([
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
  leg(2, WORK, GROCERY, "2026-01-10T12:00:00"),
  leg(3, GROCERY, WORK, "2026-01-10T13:00:00"),
  leg(4, WORK, HOME, "2026-01-10T18:00:00"),
]);
assert.equal(workLoop.trips.length, 1, "WORK n'est pas une frontière de Trip.");
assert.equal(workLoop.trips[0].memberships.length, 4);

const orphan = build([leg(1, OTHER, WORK, null)]);
assert.equal(orphan.trips.length, 1);
assert.equal(orphan.trips[0].knowledgeState, "PARTIAL");

const ambiguous = build([
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
  leg(2, WORK, GROCERY, null),
  leg(3, WORK, OTHER, null),
]);
assert.equal(ambiguous.trips[0].memberships.length, 1);
assert.ok(ambiguous.trips[0].reasonCodes.includes("TRIP_AMBIGUOUS_NEXT_LEG"));
assert.equal(ambiguous.trips[0].knowledgeState, "CONFLICT");
assert.equal(ambiguous.memberships.length, 3, "Les branches ambiguës restent couvertes sans choix arbitraire.");

const proxyCannotBreakTie = build([
  leg(1, HOME, WORK, null),
  leg(2, WORK, GROCERY, null, { sourceLegId: "AUT-0002" }),
  leg(3, WORK, OTHER, null, { sourceLegId: "AUT-0003" }),
]);
assert.ok(proxyCannotBreakTie.trips[0].reasonCodes.includes("TRIP_AMBIGUOUS_NEXT_LEG"));

const contextFreeA = build(circuit.trips[0].memberships.map(({ mobilityLegId }, index) => [
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
  leg(2, WORK, GROCERY, "2026-01-10T17:00:00"),
  leg(3, GROCERY, HOME, "2026-01-10T18:00:00"),
][index]));
const contextFreeB = build([
  leg(1, HOME, WORK, "2026-01-10T08:00:00", { ignoredContext: "family" }),
  leg(2, WORK, GROCERY, "2026-01-10T17:00:00", { ignoredContext: "food" }),
  leg(3, GROCERY, HOME, "2026-01-10T18:00:00", { ignoredContext: "leisure" }),
]);
assert.equal(contextFreeA.trips[0].mobilityTripId, contextFreeB.trips[0].mobilityTripId);
assert.deepEqual(contextFreeA.trips[0].memberships, contextFreeB.trips[0].memberships);

const multiDayLegs = [
  leg(1, HOME, OTHER, "2026-02-26T18:00:00"),
  leg(2, OTHER, GROCERY, "2026-02-28T12:00:00", { date: "2026-02-28" }),
  leg(3, GROCERY, HOME, "2026-03-01T10:00:00", { date: "2026-03-01" }),
];
const multiDay = build(multiDayLegs, [
  { fromLegId: multiDayLegs[0].legId, toLegId: multiDayLegs[1].legId, authority: "DIRECT_SOURCE_CHAIN", evidenceRefs: ["fixture:lineage:1"] },
  { fromLegId: multiDayLegs[1].legId, toLegId: multiDayLegs[2].legId, authority: "AUTHORITATIVE_MULTI_DAY_BRIDGE", evidenceRefs: ["fixture:stay:1"] },
]);
assert.equal(multiDay.trips.length, 1);
assert.equal(multiDay.trips[0].tripShape, "MULTI_DAY_JOURNEY");
assert.equal(multiDay.trips[0].boundaryStatus, "CLOSED_HOME");

const first = build([...workLoop.trips[0].memberships].reverse().map(({ mobilityLegId }, index) => [
  leg(4, WORK, HOME, "2026-01-10T18:00:00"),
  leg(3, GROCERY, WORK, "2026-01-10T13:00:00"),
  leg(2, WORK, GROCERY, "2026-01-10T12:00:00"),
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
][index]));
const second = build([
  leg(1, HOME, WORK, "2026-01-10T08:00:00"),
  leg(2, WORK, GROCERY, "2026-01-10T12:00:00"),
  leg(3, GROCERY, WORK, "2026-01-10T13:00:00"),
  leg(4, WORK, HOME, "2026-01-10T18:00:00"),
]);
assert.equal(first.buildHash, second.buildHash);
assert.deepEqual(first.trips, second.trips);

for (const result of [circuit, twoTrips, workLoop, orphan, ambiguous, proxyCannotBreakTie, multiDay, first, second]) {
  assert.equal(result.unassignedLegIds.length, 0);
  assert.equal(result.duplicateMembershipLegIds.length, 0);
  assert.equal(new Set(result.memberships.map(({ mobilityLegId }) => mobilityLegId)).size, result.memberships.length);
}

console.log(JSON.stringify({
  status: "PASS",
  methodVersion: MOBILITY_TRIP_METHOD_VERSION,
  fixtures: 9,
  assertions: "boundaries, ambiguity, proxy, context independence, multi-day, exact sums, coverage, determinism",
}));
