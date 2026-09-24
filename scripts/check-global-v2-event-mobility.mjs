import assert from "node:assert/strict";
import process from "node:process";
import { registerHooks } from "node:module";
import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
      for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
    }
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/u.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const { buildGlobalM7EventMobilityAuthority, GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION } = await import("../src/analytics/global-v2/event-mobility.ts");
const { resolveGlobalM7EventMobilityAuthority } = await import("../src/server/analytics/global-v2-event-mobility-authority.ts");
const { projectMobilityLegFactFromCanonicalRow } = await import("../src/server/canonical/mobility.ts");

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = id(1), vehicleId = id(2), datasetId = id(3), placeId = id(4);
const leg = (n, { cost = String(n), proxy = false } = {}) => ({
  fact: "fct_mobility_leg", legId: id(100 + n), householdId, vehicleId, date: "2026-06-01",
  origin: { placeId, sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  destination: { placeId, sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  distanceKm: String(n * 10), durationSeconds: "600", durationNoTrafficSeconds: "540",
  estimatedFuelLiters: String(n), estimatedFuelCost: cost,
  fuel: { fuelType: "SP95", pricePerLiter: "2", pricePeriod: "2026-06", geoScope: "NATIONAL", source: "fixture", quality: "P4_NATIONAL_FALLBACK", observationId: null },
  time: { observedTime: proxy ? null : "2026-06-01T08:00:00", authority: proxy ? "PROXY" : "OBSERVED", type: "ARRIVAL", routeTimeBasis: null, routeProxyTimes: [] },
  consumptionModelRef: "fixture@v1", routeMethodRef: "fixture@v1",
  source: { datasetId, sourceLegId: `NAV-${id(100 + n).slice(-4)}`, group: "NAV", sheet: "fixture", reconstruction: "fixture", quality: "fixture", status: "CERTIFIED_SOURCE", confidence: "HIGH", sourceRowHash: id(100 + n).replaceAll("-", "").repeat(2) },
  methodVersion: "mobility@v1", evidenceRefs: [`mobility:${n}`], provenance: "estimated",
});
const trip = (n, knowledgeState = "KNOWN", boundaryStatus = "CLOSED_HOME") => ({ mobilityTripId: id(200 + n), householdId, knowledgeState, boundaryStatus });
const link = (n, tripId, target, relationType, anchorLegId = null, validationStatus = "CONFIRMED") => ({
  mobilityTripContextLinkId: id(300 + n), mobilityTripId: tripId,
  lifeEventId: target.kind === "LIFE_EVENT" ? target.id : null,
  momentId: target.kind === "MOMENT" ? target.id : null,
  relationType, anchorLegId, validationStatus,
});
const event = (n) => ({ kind: "LIFE_EVENT", id: id(400 + n) });
const moment = (n) => ({ kind: "MOMENT", id: id(500 + n) });
const mainTrips = [trip(1), trip(2, "PARTIAL", "OPEN_START"), trip(3)];
const mainLegs = [1, 2, 3, 4, 5, 6].map((n) => leg(n, { proxy: n === 6 }));
const memberships = [1, 2, 3].map((n) => ({ mobilityTripId: mainTrips[0].mobilityTripId, mobilityLegId: id(100 + n) }))
  .concat([4, 5].map((n) => ({ mobilityTripId: mainTrips[1].mobilityTripId, mobilityLegId: id(100 + n) })),
    [{ mobilityTripId: mainTrips[2].mobilityTripId, mobilityLegId: id(106) }]);
const contextLinks = [
  link(1, mainTrips[0].mobilityTripId, event(1), "STOP_CONTEXT", id(101)),
  link(2, mainTrips[0].mobilityTripId, event(1), "STOP_CONTEXT", id(101), "DERIVED"),
  link(3, mainTrips[0].mobilityTripId, event(1), "STOP_CONTEXT", id(102)),
  link(4, mainTrips[0].mobilityTripId, event(2), "STOP_CONTEXT", id(101)),
  link(5, mainTrips[0].mobilityTripId, moment(1), "ENVELOPING_CONTEXT"),
  link(6, mainTrips[1].mobilityTripId, moment(2), "ENVELOPING_CONTEXT"),
  link(7, mainTrips[2].mobilityTripId, moment(3), "ACCESS_CONTEXT", id(106), "DERIVED"),
  link(8, mainTrips[0].mobilityTripId, event(3), "PRIMARY_CONTEXT", id(103)),
  link(9, mainTrips[0].mobilityTripId, event(4), "DESTINATION_CONTEXT", id(102)),
  link(10, mainTrips[0].mobilityTripId, event(5), "ORIGIN_CONTEXT", id(103)),
  link(11, mainTrips[0].mobilityTripId, event(6), "ASSOCIATED_CONTEXT"),
];
const baseInput = { mobilityLegs: mainLegs, trips: mainTrips, memberships, contextLinks,
  contextResolutions: mainTrips.map((row) => ({ mobilityTripId: row.mobilityTripId, status: "RESOLVED" })) };
const result = buildGlobalM7EventMobilityAuthority(baseInput);
const summary = (kind, n) => result.summaries.find((entry) => entry.eventRef === `${kind}:${id((kind === "moment" ? 500 : 400) + n)}`);
assert.equal(result.summaries.length, 9);
assert.equal(summary("life-event", 1).status, "PARTIAL");
assert.equal(summary("life-event", 1).coverage.basis, "ANCHORED_STOP_LEGS");
assert.equal(summary("life-event", 1).physicalLegCount, 2, "Duplicate links to one event contribute one leg.");
assert.equal(summary("life-event", 1).validationStatus, "MIXED");
assert.equal(summary("life-event", 2).physicalLegCount, 1, "One leg may support another event.");
assert.equal(summary("moment", 1).status, "KNOWN");
assert.equal(summary("moment", 1).coverage.state, "COMPLETE");
assert.equal(summary("moment", 1).coverage.basis, "FULL_ENVELOPING_TRIP");
assert.equal(summary("moment", 1).physicalLegCount, 3);
assert.equal(summary("moment", 2).status, "PARTIAL");
assert.equal(summary("moment", 2).coverage.basis, "OPEN_ENVELOPING_TRIP");
assert.equal(summary("moment", 2).physicalLegCount, 2);
assert.equal(summary("moment", 3).coverage.basis, "ACCESS_LEG");
assert.equal(summary("moment", 3).physicalLegCount, 1);
assert.equal(mainLegs[5].time.authority, "PROXY", "Access projection does not promote proxy time.");
for (const n of [3, 4, 5]) {
  assert.equal(summary("life-event", n).status, "PARTIAL");
  assert.equal(summary("life-event", n).physicalLegCount, 1);
}
const ambiguous = summary("life-event", 6);
assert.equal(ambiguous.status, "AMBIGUOUS");
assert.equal(ambiguous.coverage.state, "AMBIGUOUS");
for (const key of ["physicalLegCount", "distanceKm", "estimatedFuelLiters", "estimatedFuelCost"]) assert.equal(key in ambiguous, false);
assert.equal(result.physicalUnionTotals.physicalLegCount, 6);
assert.equal(result.physicalUnionTotals.distanceKm, "210");
assert.equal(result.physicalUnionTotals.estimatedFuelLiters, "21");
assert.equal(result.physicalUnionTotals.estimatedFuelCost, "21");
assert.equal(result.summaries.filter((item) => item.status === "UNKNOWN" || item.status === "NOT_APPLICABLE").length, 0);
assert.equal(result.summaries.every((item) => item.additivity.acrossSummaries === "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP"), true);
assert.equal(result.summaries.every((item) => item.policyVersion === GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION), true);
const mixedEnvelope = buildGlobalM7EventMobilityAuthority({ ...baseInput, contextLinks: [...contextLinks, link(12, mainTrips[1].mobilityTripId, moment(1), "ENVELOPING_CONTEXT")] });
const mixedEnvelopeSummary = mixedEnvelope.summaries.find((item) => item.eventRef === summary("moment", 1).eventRef);
assert.equal(mixedEnvelopeSummary.status, "PARTIAL");
assert.equal(mixedEnvelopeSummary.coverage.basis, "OPEN_ENVELOPING_TRIP");
assert.equal(mixedEnvelopeSummary.physicalLegCount, 5);
const reordered = buildGlobalM7EventMobilityAuthority({ ...baseInput, mobilityLegs: [...mainLegs].reverse(), trips: [...mainTrips].reverse(), memberships: [...memberships].reverse(), contextLinks: [...contextLinks].reverse(), contextResolutions: [...baseInput.contextResolutions].reverse() });
assert.equal(reordered.outputHash, result.outputHash);
assert.deepEqual(reordered.summaries, result.summaries);
const changed = buildGlobalM7EventMobilityAuthority({ ...baseInput, mobilityLegs: mainLegs.map((item) => item.legId === id(101) ? { ...item, estimatedFuelCost: "9" } : item) });
assert.notEqual(changed.outputHash, result.outputHash);
assert.notEqual(changed.summaries.find((item) => item.eventRef === summary("life-event", 1).eventRef).inputHash, summary("life-event", 1).inputHash);
const contaminated = buildGlobalM7EventMobilityAuthority({ ...baseInput, fuelPaidAmount: "999", bankFuelPayment: "999", fuel_trip_estimate: "999", contextLinks: contextLinks.map((item) => ({ ...item, participantCount: 3 })) });
assert.equal(contaminated.outputHash, result.outputHash, "Bank fuel, legacy estimates and participant counts cannot influence the owner.");
assert.throws(() => buildGlobalM7EventMobilityAuthority({ ...baseInput, contextResolutions: [{ mobilityTripId: mainTrips[0].mobilityTripId, status: "UNRESOLVED" }, ...baseInput.contextResolutions.slice(1)] }), /LINK_NOT_RESOLVED/);
assert.throws(() => buildGlobalM7EventMobilityAuthority({ ...baseInput, contextLinks: [{ ...contextLinks[0], anchorLegId: id(999) }, ...contextLinks.slice(1)] }), /INVALID_ANCHOR/);
assert.throws(() => buildGlobalM7EventMobilityAuthority({ ...baseInput, contextLinks: [{ ...contextLinks[0], lifeEventId: "invalid" }, ...contextLinks.slice(1)] }), /TARGET_ID_INVALID/);

const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture-dir="));
if (fixtureArg !== undefined) {
  const fixtureDirectory = fixtureArg.slice("--fixture-dir=".length);
  const tables = loadFixtureTables(fixtureDirectory);
  const household = (tables.get("households") ?? [])[0];
  assert.ok(household);
  const revision = (tables.get("household_revisions") ?? []).find((row) => row.household_id === household.household_id);
  assert.equal(String(revision?.data_revision), "8");
  const facts = (tables.get("mobility_legs") ?? []).map((row) => projectMobilityLegFactFromCanonicalRow({
    ...row, distance_km_text: String(row.distance_km), duration_seconds_text: row.duration_seconds === null ? null : String(row.duration_seconds),
    duration_no_traffic_seconds_text: row.duration_no_traffic_seconds === null ? null : String(row.duration_no_traffic_seconds),
    estimated_fuel_liters_text: String(row.estimated_fuel_liters), estimated_fuel_cost_text: String(row.estimated_fuel_cost),
    fuel_price_per_liter_text: String(row.fuel_price_per_liter),
  }));
  const authority = await resolveGlobalM7EventMobilityAuthority({
    repository: {
      client: createFixtureSupabaseClient(fixtureDirectory),
      context: { householdId: household.household_id, asOf: "2026-09-24T00:00:00Z", timezone: household.timezone, periods: [{ month: "2025-08-01" }] },
      loadMobilityLegFacts: async () => facts,
    },
    certifiedThrough: "2026-07-31",
  });
  const valued = authority.summaries.filter((item) => item.status === "KNOWN" || item.status === "PARTIAL");
  const report = {
    summaryCount: authority.summaries.length,
    KNOWN: authority.summaries.filter((item) => item.status === "KNOWN").length,
    PARTIAL: authority.summaries.filter((item) => item.status === "PARTIAL").length,
    AMBIGUOUS: authority.summaries.filter((item) => item.status === "AMBIGUOUS").length,
    UNKNOWN: authority.summaries.filter((item) => item.status === "UNKNOWN").length,
    NOT_APPLICABLE: authority.summaries.filter((item) => item.status === "NOT_APPLICABLE").length,
    lifeEvents: authority.summaries.filter((item) => item.targetKind === "LIFE_EVENT").length,
    moments: authority.summaries.filter((item) => item.targetKind === "MOMENT").length,
    perSummaryLegOccurrences: valued.reduce((count, item) => count + item.physicalLegCount, 0),
    uniquePhysicalLegs: authority.physicalUnionTotals.physicalLegCount,
    physicalUnionTotals: authority.physicalUnionTotals,
    validation: Object.fromEntries(["CONFIRMED", "DERIVED", "MIXED"].map((status) => [status, authority.summaries.filter((item) => item.validationStatus === status).length])),
    relations: Object.fromEntries(["STOP_CONTEXT", "ACCESS_CONTEXT", "ENVELOPING_CONTEXT", "PRIMARY_CONTEXT", "DESTINATION_CONTEXT", "ORIGIN_CONTEXT", "ASSOCIATED_CONTEXT"].map((relation) => [relation, authority.summaries.filter((item) => item.relationTypes.includes(relation)).length])),
    relationLinks: Object.fromEntries(["STOP_CONTEXT", "ACCESS_CONTEXT", "ENVELOPING_CONTEXT", "PRIMARY_CONTEXT", "DESTINATION_CONTEXT", "ORIGIN_CONTEXT", "ASSOCIATED_CONTEXT"].map((relation) => [relation, (tables.get("mobility_trip_context_links") ?? []).filter((row) => row.is_active && row.relation_type === relation).length])),
    outputHash: authority.outputHash,
  };
  assert.equal(authority.summaries.length, 63);
  assert.equal(report.KNOWN, 8);
  assert.equal(report.PARTIAL, 55);
  assert.equal(report.perSummaryLegOccurrences > report.uniquePhysicalLegs, true);
  const realSummary = (ref) => authority.summaries.find((item) => item.eventRef === ref);
  const funeral = realSummary("life-event:3e8633e9-191c-504e-965e-61c7407de6ff");
  assert.equal(funeral.status, "PARTIAL");
  assert.equal(funeral.physicalLegCount, 6, "Seven funeral context links contain six physical legs.");
  const duplicateLegLinks = (tables.get("mobility_trip_context_links") ?? []).filter((row) => row.is_active && row.anchor_leg_id === "cdb639a6-9acb-55de-b722-5945b72e4b4d");
  assert.equal(duplicateLegLinks.length, 2);
  assert.equal(new Set(duplicateLegLinks.map((row) => row.life_event_id)).size, 1);
  const ski = realSummary("moment:6f966dc4-c4eb-5b8b-985b-5939043fc891");
  assert.equal(ski.status, "KNOWN");
  assert.equal(ski.coverage.state, "COMPLETE");
  assert.equal(ski.physicalLegCount, 6);
  assert.equal(ski.distanceKm, "776.81");
  for (const ref of ["moment:4d95a0fb-16c4-5fc4-ba79-01a66e32bb36", "moment:fa0736c6-3562-5683-ba15-4ee4b8cdb5cd"]) {
    assert.equal(realSummary(ref).status, "PARTIAL");
    assert.equal(realSummary(ref).coverage.basis, "OPEN_ENVELOPING_TRIP");
  }
  const minorca = realSummary("moment:c3dc1d17-d561-5807-84a3-183af1810aab");
  assert.equal(minorca.status, "PARTIAL");
  assert.equal(minorca.coverage.basis, "ACCESS_LEG");
  assert.equal(minorca.physicalLegCount, 1);
  const minorcaLink = (tables.get("mobility_trip_context_links") ?? []).find((row) => row.is_active && row.moment_id === "c3dc1d17-d561-5807-84a3-183af1810aab");
  assert.equal((tables.get("mobility_legs") ?? []).find((row) => row.mobility_leg_id === minorcaLink.anchor_leg_id).time_authority, "PROXY");
  const marchTripLinks = (tables.get("mobility_trip_context_links") ?? []).filter((row) => row.is_active && row.mobility_trip_id === "cba6a3b3-93f9-5612-ba92-c8441152ef31");
  const funeralMarchLegs = new Set(marchTripLinks.filter((row) => row.life_event_id === "3e8633e9-191c-504e-965e-61c7407de6ff").map((row) => row.anchor_leg_id));
  const servianMarchLegs = new Set(marchTripLinks.filter((row) => row.life_event_id === "ac542b1f-d019-5baa-934b-306ee0f4a02a").map((row) => row.anchor_leg_id));
  assert.equal([...funeralMarchLegs].filter((id) => servianMarchLegs.has(id)).length, 3, "One trip can support overlapping events.");
  const lifeEventLinks = (tables.get("mobility_trip_context_links") ?? []).filter((row) => row.is_active && row.life_event_id !== null);
  const byLifeEvent = new Map();
  for (const row of lifeEventLinks) {
    const ids = byLifeEvent.get(row.life_event_id) ?? new Set();
    ids.add(row.anchor_leg_id);
    byLifeEvent.set(row.life_event_id, ids);
  }
  const lifeEventOccurrences = [...byLifeEvent.values()].reduce((count, ids) => count + ids.size, 0);
  const lifeEventUnion = new Set([...byLifeEvent.values()].flatMap((ids) => [...ids]));
  assert.equal(lifeEventOccurrences > lifeEventUnion.size, true);
  const { sumMobilityEstimatedFuelCost } = await import("../src/analytics/facts/mobility.ts");
  const factsById = new Map(facts.map((item) => [item.legId, item]));
  const lifeEventNaiveCost = authority.summaries.filter((item) => item.targetKind === "LIFE_EVENT" && (item.status === "KNOWN" || item.status === "PARTIAL"))
    .reduce((sum, item) => sum + Number(item.estimatedFuelCost), 0);
  const lifeEventUnionCost = sumMobilityEstimatedFuelCost([...lifeEventUnion].map((id) => factsById.get(id)));
  assert.equal(lifeEventNaiveCost > Number(lifeEventUnionCost), true);
  console.log(`LifeEvent audit comparison: ${lifeEventOccurrences} occurrences / ${lifeEventUnion.size} unique physical legs; naive EUR ${lifeEventNaiveCost.toFixed(2)} / union EUR ${Number(lifeEventUnionCost).toFixed(2)}.`);
  console.log(JSON.stringify(report));
}
console.log("Global M7 Event Mobility authority: PASS");
