import assert from "node:assert/strict";

const {
  MOBILITY_TRIP_CONTEXT_METHOD_VERSION,
  resolveMobilityTripContexts,
} = await import("../src/analytics/global-v2/mobility-trip-context.ts");

const HOUSEHOLD = "10000000-0000-4000-8000-000000000001";
const HOME = "20000000-0000-4000-8000-000000000001";
const WORK = "20000000-0000-4000-8000-000000000002";
const GROCERY = "20000000-0000-4000-8000-000000000003";
const AIRPORT = "20000000-0000-4000-8000-000000000004";
const AWAY = "20000000-0000-4000-8000-000000000005";

const event = (id, overrides = {}) => ({
  lifeEventId: `30000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  householdId: HOUSEHOLD,
  validationStatus: "CONFIRMED",
  principalPlaceIds: [AWAY],
  accessPlaceIds: [],
  evidenceRefs: [`event:${id}`],
  ...overrides,
});

const leg = (id, sequenceIndex, originPlaceId, destinationPlaceId, travelDate = "2026-01-10") => ({
  mobilityLegId: `40000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  sequenceIndex,
  travelDate,
  originPlaceId,
  destinationPlaceId,
});

const trip = (id, legs, overrides = {}) => ({
  mobilityTripId: `50000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  householdId: HOUSEHOLD,
  startDate: legs[0].travelDate,
  endDate: legs.at(-1).travelDate,
  boundaryStatus: "CLOSED_HOME",
  legs,
  ...overrides,
});

const context = (legId, lifeEventId, overrides = {}) => ({
  contextResolutionId: `context:${legId}:${lifeEventId}:${JSON.stringify(overrides)}`,
  mobilityLegId: legId,
  subjectPersonId: "person-1",
  contextKind: "LIFE_EVENT",
  contextRef: lifeEventId,
  purpose: "OTHER",
  scope: "PERSONAL",
  linkState: "LINKED",
  knowledgeState: "CONFIRMED",
  temporalRelation: "ARRIVAL_TO_CONTEXT",
  temporalQuality: "EXACT",
  evidenceRefs: [`m7:${legId}:${lifeEventId}`],
  ...overrides,
});

const moment = (id, linkedLifeEvent, overrides = {}) => ({
  momentId: `60000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  householdId: HOUSEHOLD,
  startDate: "2026-01-10",
  endDate: "2026-01-10",
  hasActiveSemanticAssertion: true,
  linkedLifeEvents: [{
    lifeEventId: linkedLifeEvent.lifeEventId,
    relationType: "PRIMARY_EVENT",
    validationStatus: "CONFIRMED",
    evidenceRefs: [`moment-event:${id}`],
  }],
  evidenceRefs: [`moment:${id}`],
  ...overrides,
});

const resolve = ({ trips, contexts = [], events = [], moments = [] }) => resolveMobilityTripContexts({
  trips,
  mobilityContexts: contexts,
  lifeEvents: events,
  moments,
  sourceRevision: 107,
});

let checks = 0;
const check = (callback) => { callback(); checks += 1; };

// Work + grocery are useful stops, but competing candidates must not manufacture a primary narrative.
const workEvent = event(1, { principalPlaceIds: [WORK] });
const groceryEvent = event(2, { principalPlaceIds: [GROCERY] });
const circuitLegs = [
  leg(1, 0, HOME, WORK),
  leg(2, 1, WORK, GROCERY),
  leg(3, 2, GROCERY, HOME),
];
const circuitTrip = trip(1, circuitLegs);
const circuit = resolve({
  trips: [circuitTrip],
  contexts: [
    context(circuitLegs[0].mobilityLegId, workEvent.lifeEventId),
    context(circuitLegs[1].mobilityLegId, groceryEvent.lifeEventId),
  ],
  events: [workEvent, groceryEvent],
});
check(() => {
  assert.equal(circuit.links.length, 2);
  assert.ok(circuit.links.every(({ relationType }) => relationType === "STOP_CONTEXT"));
  assert.ok(circuit.links.every(({ relationType }) => relationType !== "PRIMARY_CONTEXT"));
});

// An enclosing, asserted Moment is the narrative owner (Aveyron pattern).
const aveyronEvent = event(3, { principalPlaceIds: [AWAY] });
const aveyronLegs = [leg(4, 0, HOME, AWAY), leg(5, 1, AWAY, HOME)];
const aveyronTrip = trip(2, aveyronLegs);
const aveyronMoment = moment(1, aveyronEvent);
const aveyron = resolve({
  trips: [aveyronTrip],
  contexts: [context(aveyronLegs[0].mobilityLegId, aveyronEvent.lifeEventId)],
  events: [aveyronEvent],
  moments: [aveyronMoment],
});
check(() => {
  assert.equal(aveyron.links.length, 1);
  assert.equal(aveyron.links[0].momentId, aveyronMoment.momentId);
  assert.equal(aveyron.links[0].relationType, "ENVELOPING_CONTEXT");
  assert.equal(aveyron.links[0].lifeEventId, null);
});

// Ski: the same confirmed story is not narrated twice as Moment + LifeEvent.
const skiEvent = event(4, { principalPlaceIds: [AWAY] });
const skiLegs = [
  leg(6, 0, HOME, AWAY, "2026-02-26"),
  leg(7, 1, AWAY, HOME, "2026-03-01"),
];
const skiTrip = trip(3, skiLegs);
const skiMoment = moment(2, skiEvent, { startDate: "2026-02-26", endDate: "2026-03-01" });
const ski = resolve({
  trips: [skiTrip],
  contexts: [context(skiLegs[0].mobilityLegId, skiEvent.lifeEventId)],
  events: [skiEvent],
  moments: [skiMoment],
});
check(() => {
  assert.equal(ski.links.length, 1);
  assert.equal(ski.links.filter(({ momentId }) => momentId !== null).length, 1);
  assert.equal(ski.links.filter(({ lifeEventId }) => lifeEventId !== null).length, 0);
});

// Minorque: the airport localization is access to the Moment, never a physical merge.
const minorqueEvent = event(5, { principalPlaceIds: [AWAY], accessPlaceIds: [AIRPORT] });
const accessLegs = [leg(8, 0, HOME, AIRPORT, "2025-09-08")];
const accessTrip = trip(4, accessLegs, { startDate: "2025-09-08", endDate: "2025-09-08", boundaryStatus: "OPEN_END" });
const minorqueMoment = moment(3, minorqueEvent, { startDate: "2025-09-08", endDate: "2025-09-14" });
const access = resolve({
  trips: [accessTrip],
  contexts: [context(accessLegs[0].mobilityLegId, minorqueEvent.lifeEventId, {
    linkState: "AMBIGUOUS",
    knowledgeState: "AMBIGUOUS",
    temporalRelation: "DATE_ONLY_CANDIDATE",
    temporalQuality: "PROXY",
  })],
  events: [minorqueEvent],
  moments: [minorqueMoment],
});
check(() => {
  assert.equal(access.links.length, 1);
  assert.equal(access.links[0].relationType, "ACCESS_CONTEXT");
  assert.equal(access.links[0].linkMethod, "ACCESS_TO_MOMENT");
  assert.equal(access.links[0].anchorLegId, accessLegs[0].mobilityLegId);
  assert.deepEqual(accessTrip.legs, accessLegs);
});

// A title-like string is not part of the resolver contract and cannot create a link.
const titleOnly = resolve({ trips: [trip(5, [leg(9, 0, HOME, AWAY)])] });
check(() => {
  assert.equal(titleOnly.links.length, 0);
  assert.equal(titleOnly.resolutions[0].status, "UNRESOLVED");
  assert.ok(titleOnly.resolutions[0].reasonCodes.includes("NO_SEMANTIC_CONTEXT_CANDIDATE"));
});

// Exact place and time can produce a unique primary context.
const certainEvent = event(6, { principalPlaceIds: [AWAY] });
const certainLeg = leg(10, 0, HOME, AWAY);
const certain = resolve({
  trips: [trip(6, [certainLeg])],
  contexts: [context(certainLeg.mobilityLegId, certainEvent.lifeEventId)],
  events: [certainEvent],
});
check(() => {
  assert.equal(certain.links.length, 1);
  assert.equal(certain.links[0].relationType, "PRIMARY_CONTEXT");
  assert.equal(certain.links[0].linkMethod, "EXACT_PLACE_TIME");
});

// A trip without context remains a valid resolved input, with an explicit audit reason.
check(() => {
  assert.equal(titleOnly.resolutions.length, 1);
  assert.equal(titleOnly.resolutions[0].mobilityTripId, titleOnly.resolutions[0].mobilityTripId);
});

// Context links are orthogonal to physical Trip identity and membership.
check(() => {
  const before = JSON.stringify({ id: certain.links[0].mobilityTripId, legs: [certainLeg.mobilityLegId] });
  const without = resolve({ trips: [trip(6, [certainLeg])] });
  const after = JSON.stringify({ id: without.resolutions[0].mobilityTripId, legs: [certainLeg.mobilityLegId] });
  assert.equal(before, after);
});

// The context contract cannot carry allocation or money semantics.
check(() => {
  const forbidden = ["amount", "allocationPercentage", "allocatedDistance", "allocatedFuel", "explainedCost", "estimatedFuelCost"];
  for (const link of [...circuit.links, ...access.links, ...certain.links]) {
    for (const key of forbidden) assert.equal(Object.hasOwn(link, key), false);
  }
});

// M7 rows are candidates: weak time evidence does not become a TripContext by itself.
const weakCandidate = resolve({
  trips: [trip(7, [certainLeg])],
  contexts: [context(certainLeg.mobilityLegId, certainEvent.lifeEventId, { linkState: "AMBIGUOUS", temporalQuality: "PROXY" })],
  events: [certainEvent],
});
check(() => {
  assert.equal(weakCandidate.links.length, 0);
  assert.ok(weakCandidate.resolutions[0].reasonCodes.includes("CONTEXT_TIME_MISMATCH"));
});

// Stable ordering of every input produces the same links and digest.
const deterministicA = resolve({
  trips: [circuitTrip, aveyronTrip],
  contexts: [
    context(circuitLegs[0].mobilityLegId, workEvent.lifeEventId),
    context(circuitLegs[1].mobilityLegId, groceryEvent.lifeEventId),
    context(aveyronLegs[0].mobilityLegId, aveyronEvent.lifeEventId),
  ],
  events: [workEvent, groceryEvent, aveyronEvent],
  moments: [aveyronMoment],
});
const deterministicB = resolve({
  trips: [aveyronTrip, circuitTrip],
  contexts: [
    context(aveyronLegs[0].mobilityLegId, aveyronEvent.lifeEventId),
    context(circuitLegs[1].mobilityLegId, groceryEvent.lifeEventId),
    context(circuitLegs[0].mobilityLegId, workEvent.lifeEventId),
  ],
  events: [aveyronEvent, groceryEvent, workEvent],
  moments: [aveyronMoment],
});
check(() => {
  assert.equal(deterministicA.buildHash, deterministicB.buildHash);
  assert.deepEqual(deterministicA.links, deterministicB.links);
  assert.deepEqual(deterministicA.resolutions, deterministicB.resolutions);
});

console.log(JSON.stringify({
  status: "PASS",
  methodVersion: MOBILITY_TRIP_CONTEXT_METHOD_VERSION,
  checks,
  assertions: "trip-level resolution, Moment precedence, access, no title inference, physical independence, no money/allocation, M7 candidate boundary, determinism",
}));
