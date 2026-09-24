import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import process from "node:process";
import Big from "big.js";
import ts from "typescript";
import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) { return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain); };
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture-dir="));
if (fixtureArg === undefined) throw new TypeError("Usage: --fixture-dir=<private read-only export>");
const fixtureDirectory = fixtureArg.slice("--fixture-dir=".length);
const tables = loadFixtureTables(fixtureDirectory);
const rows = (table) => tables.get(table) ?? [];
const household = rows("households")[0];
assert.ok(household);
const revision = rows("household_revisions").find((row) => row.household_id === household.household_id);
assert.equal(String(revision?.data_revision), "8");
assert.equal(String(revision?.analytics_revision), "107");

const { projectMobilityLegFactFromCanonicalRow } = require(path.resolve("src/server/canonical/mobility.ts"));
const { resolveGlobalM7EventMobilityAuthority } = require(path.resolve("src/server/analytics/global-v2-event-mobility-authority.ts"));
const { buildGlobalM7EventMobilityAuthority } = require(path.resolve("src/analytics/global-v2/event-mobility.ts"));
const { sumMobilityEstimatedFuelCost } = require(path.resolve("src/analytics/facts/mobility.ts"));
const { CanonicalRepository } = require(path.resolve("src/server/canonical/repository.ts"));
const { resolveGlobalM7MobilityContextAuthority } = require(path.resolve("src/server/analytics/global-v2-mobility-context-authority.ts"));
const { buildGlobalM7PersonalMobilityAuthority } = require(path.resolve("src/analytics/global-v2/personal-mobility.ts"));

const facts = rows("mobility_legs").map((row) => projectMobilityLegFactFromCanonicalRow({
  ...row, distance_km_text: String(row.distance_km), duration_seconds_text: row.duration_seconds === null ? null : String(row.duration_seconds),
  duration_no_traffic_seconds_text: row.duration_no_traffic_seconds === null ? null : String(row.duration_no_traffic_seconds),
  estimated_fuel_liters_text: String(row.estimated_fuel_liters), estimated_fuel_cost_text: String(row.estimated_fuel_cost),
  fuel_price_per_liter_text: String(row.fuel_price_per_liter),
}));
const factsById = new Map(facts.map((fact) => [fact.legId, fact]));
const activeLinks = rows("mobility_trip_context_links").filter((row) => row.is_active);
const activeMemberships = rows("mobility_trip_legs").filter((row) => row.is_active);
const repoContext = { householdId: household.household_id, timezone: household.timezone,
  asOf: "2026-09-24T00:00:00Z", periods: [{ month: "2025-08-01" }] };
const resolve = (tableRows = {}, mobilityLegs = facts) => resolveGlobalM7EventMobilityAuthority({
  repository: { client: createFixtureSupabaseClient(fixtureDirectory, { tableRows }), context: repoContext, loadMobilityLegFacts: async () => mobilityLegs },
  certifiedThrough: "2026-07-31",
});
const owner = await resolve();
const summary = (ref, authority = owner) => authority.summaries.find((item) => item.eventRef === ref);
assert.equal(owner.summaries.length, 63);
assert.deepEqual(owner.physicalUnionTotals, { physicalLegCount: 101, distanceKm: "2543.447", estimatedFuelLiters: "202.917655", estimatedFuelCost: "377.89726418" });
assert.deepEqual(Object.fromEntries(["KNOWN", "PARTIAL", "AMBIGUOUS", "UNKNOWN", "NOT_APPLICABLE"].map((status) => [status, owner.summaries.filter((item) => item.status === status).length])),
  { KNOWN: 8, PARTIAL: 55, AMBIGUOUS: 0, UNKNOWN: 0, NOT_APPLICABLE: 0 });

// A: two source context links for one physical leg and one LifeEvent change provenance, not physical measures.
const duplicateLegId = "cdb639a6-9acb-55de-b722-5945b72e4b4d";
const duplicateLeg = factsById.get(duplicateLegId);
assert.equal(duplicateLeg?.distanceKm, "21.362");
assert.equal(duplicateLeg?.estimatedFuelCost, "3.235724412");
const duplicateLinks = activeLinks.filter((link) => link.anchor_leg_id === duplicateLegId);
assert.equal(duplicateLinks.length, 2);
assert.equal(new Set(duplicateLinks.map((link) => link.life_event_id)).size, 1);
const duplicateRef = `life-event:${duplicateLinks[0].life_event_id}`;
const oneLink = await resolve({ mobility_trip_context_links: activeLinks.filter((link) => link.mobility_trip_context_link_id !== duplicateLinks[1].mobility_trip_context_link_id) });
for (const key of ["physicalLegCount", "distanceKm", "estimatedFuelLiters", "estimatedFuelCost"]) assert.equal(summary(duplicateRef)[key], summary(duplicateRef, oneLink)[key]);

// B/C: overlaps between event narratives stay non-additive; the physical union is recomputed from leg IDs.
const sourceLeg = (sourceLegId) => rows("mobility_legs").find((row) => row.source_leg_id === sourceLegId);
for (const sourceLegId of ["AUT-0126", "AUT-0127", "AUT-0128", "AUT-0142"]) {
  const leg = sourceLeg(sourceLegId);
  assert.ok(leg);
  assert.equal(new Set(activeLinks.filter((link) => link.anchor_leg_id === leg.mobility_leg_id).map((link) => link.life_event_id)).size, 2);
}
const byLifeEvent = new Map();
for (const link of activeLinks.filter((row) => row.life_event_id !== null)) {
  const legIds = byLifeEvent.get(link.life_event_id) ?? new Set();
  legIds.add(link.anchor_leg_id);
  byLifeEvent.set(link.life_event_id, legIds);
}
const lifeEventOccurrences = [...byLifeEvent.values()].reduce((total, ids) => total + ids.size, 0);
const lifeEventUnionIds = new Set([...byLifeEvent.values()].flatMap((ids) => [...ids]));
const lifeEventNaive = owner.summaries.filter((item) => item.targetKind === "LIFE_EVENT" && (item.status === "KNOWN" || item.status === "PARTIAL"))
  .reduce((total, item) => total.plus(item.estimatedFuelCost), new Big(0));
const lifeEventUnion = sumMobilityEstimatedFuelCost([...lifeEventUnionIds].map((id) => factsById.get(id)));
assert.equal(lifeEventOccurrences, 68);
assert.equal(lifeEventUnionIds.size, 64);
assert.equal(lifeEventNaive.toFixed(2), "261.49");
assert.equal(new Big(lifeEventUnion).toFixed(2), "254.01");

// D: two participants do not allocate or multiply a shared physical leg.
const familyEventId = "26f655a5-9eb9-59fc-8913-59d580bbdd47";
const familyParticipants = new Set(rows("life_event_participations").filter((row) => row.life_event_id === familyEventId).map((row) => row.person_id));
assert.equal(familyParticipants.size, 2);
const familyLeg = sourceLeg("AUT-0017");
assert.equal(familyLeg.distance_km, 62.909);
assert.equal(familyLeg.estimated_fuel_cost, 8.772477585);
assert.equal(activeLinks.filter((link) => link.life_event_id === familyEventId && link.anchor_leg_id === familyLeg.mobility_leg_id).length, 1);
assert.equal(summary(`life-event:${familyEventId}`).physicalLegCount, new Set(activeLinks.filter((link) => link.life_event_id === familyEventId).map((link) => link.anchor_leg_id)).size);

// E: Persona and Timeline are projections of the same Canonical leg, not independent physical usage.
const persons = rows("persons").filter((row) => row.household_id === household.household_id);
const repository = new CanonicalRepository(createFixtureSupabaseClient(fixtureDirectory), {
  ...repoContext, userId: "red-team-fixture", persons: persons.map((row) => ({ personId: row.person_id, householdId: row.household_id, displayName: row.display_name, status: row.status })),
  personIds: persons.map((row) => row.person_id), dataRevision: "8", analyticsRevision: "107", contractVersion: "v2",
});
const personaContext = await resolveGlobalM7MobilityContextAuthority({ repository, certifiedThrough: "2026-07-31" });
const personal = buildGlobalM7PersonalMobilityAuthority({ mobilityLegs: facts, contextLinks: personaContext.contextLinks, presenceResolutions: personaContext.presenceResolutions });
const personalLegIds = new Set(personaContext.contextLinks.filter((link) => link.scope === "PERSONAL" && link.linkState === "LINKED").map((link) => link.mobilityLegId));
const timelineLegIds = new Set([...activeLinks.flatMap((link) => link.anchor_leg_id === null ? activeMemberships.filter((row) => row.mobility_trip_id === link.mobility_trip_id).map((row) => row.mobility_leg_id) : [link.anchor_leg_id])]);
const sharedPersonaTimelineIds = [...personalLegIds].filter((id) => timelineLegIds.has(id));
assert.ok(sharedPersonaTimelineIds.length > 0);
assert.equal(personal.physicalTotals.physicalLegCount <= facts.length, true);
assert.equal(new Set([...personalLegIds, ...timelineLegIds]).size < personalLegIds.size + timelineLegIds.size, true);

// F/G/H/I: trip coverage and proxy authority remain explicit in the source and Owner.
const ski = summary("moment:6f966dc4-c4eb-5b8b-985b-5939043fc891");
assert.equal(ski.status, "KNOWN");
assert.deepEqual([ski.coverage.state, ski.coverage.basis, ski.physicalLegCount, ski.distanceKm], ["COMPLETE", "FULL_ENVELOPING_TRIP", 6, "776.81"]);
assert.equal(new Big(ski.estimatedFuelCost).toFixed(2), "105.03");
const skiLink = activeLinks.find((link) => link.moment_id === "6f966dc4-c4eb-5b8b-985b-5939043fc891");
const skiTrip = rows("mobility_trips").find((trip) => trip.mobility_trip_id === skiLink.mobility_trip_id);
assert.deepEqual([skiTrip.knowledge_state, skiTrip.boundary_status], ["KNOWN", "CLOSED_HOME"]);
const marc = summary("moment:4d95a0fb-16c4-5fc4-ba79-01a66e32bb36");
assert.equal(marc.status, "PARTIAL");
assert.equal(marc.coverage.basis, "OPEN_ENVELOPING_TRIP");
assert.equal(marc.physicalLegCount, 3);
assert.equal(marc.distanceKm, "32.589");
assert.equal(new Big(marc.estimatedFuelCost).toFixed(2), "5.37");
const marcLink = activeLinks.find((link) => link.moment_id === "4d95a0fb-16c4-5fc4-ba79-01a66e32bb36");
const marcTrip = rows("mobility_trips").find((trip) => trip.mobility_trip_id === marcLink.mobility_trip_id);
assert.equal(marcTrip.boundary_status, "OPEN_START");
const minorcaId = "c3dc1d17-d561-5807-84a3-183af1810aab";
const minorca = summary(`moment:${minorcaId}`);
const minorcaLink = activeLinks.find((link) => link.moment_id === minorcaId);
assert.equal(minorca.status, "PARTIAL");
assert.equal(minorca.coverage.basis, "ACCESS_LEG");
assert.equal(minorca.physicalLegCount, 1);
assert.equal(minorca.distanceKm, factsById.get(minorcaLink.anchor_leg_id).distanceKm);
assert.equal(factsById.get(minorcaLink.anchor_leg_id).time.authority, "PROXY");
assert.equal(minorcaLink.validation_status, "DERIVED");

// J/K/L: conflicting attributions produce no amount; no proof does not authorize NOT_APPLICABLE.
const syntheticTrip = rows("mobility_trips").find((trip) => trip.is_active && activeMemberships.filter((row) => row.mobility_trip_id === trip.mobility_trip_id).length >= 2);
const twoMembers = activeMemberships.filter((row) => row.mobility_trip_id === syntheticTrip.mobility_trip_id).slice(0, 2);
const syntheticTarget = familyEventId;
const ambiguous = buildGlobalM7EventMobilityAuthority({
  mobilityLegs: twoMembers.map((row) => factsById.get(row.mobility_leg_id)),
  trips: [{ mobilityTripId: syntheticTrip.mobility_trip_id, householdId: syntheticTrip.household_id, boundaryStatus: syntheticTrip.boundary_status, knowledgeState: syntheticTrip.knowledge_state }],
  memberships: twoMembers.map((row) => ({ mobilityTripId: row.mobility_trip_id, mobilityLegId: row.mobility_leg_id })),
  contextLinks: [
    { mobilityTripContextLinkId: "00000000-0000-4000-8000-000000000001", mobilityTripId: syntheticTrip.mobility_trip_id, lifeEventId: syntheticTarget, momentId: null, relationType: "STOP_CONTEXT", anchorLegId: twoMembers[0].mobility_leg_id, validationStatus: "CONFIRMED" },
    { mobilityTripContextLinkId: "00000000-0000-4000-8000-000000000002", mobilityTripId: syntheticTrip.mobility_trip_id, lifeEventId: syntheticTarget, momentId: null, relationType: "ACCESS_CONTEXT", anchorLegId: twoMembers[1].mobility_leg_id, validationStatus: "CONFIRMED" },
  ],
  contextResolutions: [{ mobilityTripId: syntheticTrip.mobility_trip_id, status: "RESOLVED" }],
}).summaries[0];
assert.equal(ambiguous.status, "AMBIGUOUS");
assert.equal(ambiguous.coverage.basis, "INCOMPATIBLE_ATTRIBUTIONS");
for (const key of ["distanceKm", "estimatedFuelLiters", "estimatedFuelCost"]) assert.equal(key in ambiguous, false);
const noProof = buildGlobalM7EventMobilityAuthority({ mobilityLegs: [], trips: [], memberships: [], contextLinks: [], contextResolutions: [] });
assert.equal(noProof.summaries.length, 0);

// P: a same-day bank fuel payment cannot contaminate physical cost or its hash.
const eni = rows("operations").find((row) => row.marchand === "Eni" && row.date_transaction_reelle === "2026-01-22" && Number(row.montant) === -75.59);
const amandineLeg = sourceLeg("AUT-0097");
assert.ok(eni);
assert.equal(amandineLeg.travel_date, "2026-01-22");
assert.equal(amandineLeg.distance_km, 1.412);
assert.equal(amandineLeg.estimated_fuel_cost, 0.271321575);
const changedBank = await resolve({ operations: rows("operations").map((row) => row.operation_id === eni.operation_id
  ? { ...row, montant: -7559, montant_bancaire_depense: 7559, valeur_economique_brute: 7559 } : row) });
assert.deepEqual(changedBank, owner);
const changedFact = facts.map((fact) => fact.legId === amandineLeg.mobility_leg_id
  ? { ...fact, estimatedFuelCost: new Big(fact.estimatedFuelCost).plus(1).toString() } : fact);
const changedMobility = await resolve({}, changedFact);
assert.notEqual(changedMobility.outputHash, owner.outputHash);
assert.notEqual(summary("life-event:793736f7-3af4-53f2-93d7-fb0f00e23010", changedMobility).estimatedFuelCost,
  summary("life-event:793736f7-3af4-53f2-93d7-fb0f00e23010").estimatedFuelCost);
const reordered = await resolve({
  mobility_trips: [...rows("mobility_trips")].reverse(), mobility_trip_legs: [...rows("mobility_trip_legs")].reverse(),
  mobility_trip_context_links: [...rows("mobility_trip_context_links")].reverse(), mobility_trip_context_resolutions: [...rows("mobility_trip_context_resolutions")].reverse(),
}, [...facts].reverse());
assert.deepEqual(reordered, owner);

console.log(JSON.stringify({ result: "PASS", fixture: "source-revision-8", summaries: owner.summaries.length,
  physicalUnion: owner.physicalUnionTotals, lifeEventOccurrences, lifeEventUniqueLegs: lifeEventUnionIds.size,
  lifeEventNaiveCost: lifeEventNaive.toFixed(2), lifeEventUnionCost: new Big(lifeEventUnion).toFixed(2),
  sharedPersonaTimelineLegs: sharedPersonaTimelineIds.length, sameDayFuelPayment: "ISOLATED",
  bankMutation: "UNCHANGED", mobilityMutation: "CHANGED", reordered: "DETERMINISTIC", ambiguous: "NO_AMOUNT" }));
