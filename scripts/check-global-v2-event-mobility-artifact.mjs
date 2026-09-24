import assert from "node:assert/strict";
import process from "node:process";
import { registerHooks } from "node:module";
import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

registerHooks({ resolve(specifier, context, nextResolve) {
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
} });

const { buildGlobalM7EventMobilityAuthority } = await import("../src/analytics/global-v2/event-mobility.ts");
const { buildGlobalEventMobilityArtifactDefinition, globalEventMobilityArtifactVersion } = await import("../src/server/analytics/global-v2-event-mobility-artifact.ts");
const { buildGlobalV2CandidateFromOwnerOutputs, GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES } = await import("../src/server/analytics/global-v2-candidate.ts");
const { globalPrimaryModuleCatalog } = await import("../src/query-api/global-v2/index.ts");
const { normalizeGlobalAnalysisScopeV2, computeGlobalAnalysisScopeV2Hash } = await import("../src/core/global-v2/index.ts");
const { serializeGlobalV2PublicationManifest } = await import("../src/server/analytics/materialization/global-v2.ts");

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = id(1);
const leg = (n, cost = String(n)) => ({
  fact: "fct_mobility_leg", legId: id(100 + n), householdId, vehicleId: id(2), date: "2026-06-01",
  origin: { placeId: id(3), sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  destination: { placeId: id(3), sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  distanceKm: String(n * 10), durationSeconds: "600", durationNoTrafficSeconds: "540",
  estimatedFuelLiters: String(n), estimatedFuelCost: cost,
  fuel: { fuelType: "SP95", pricePerLiter: "2", pricePeriod: "2026-06", geoScope: "NATIONAL", source: "fixture", quality: "P4_NATIONAL_FALLBACK", observationId: null },
  time: { observedTime: "2026-06-01T08:00:00", authority: "OBSERVED", type: "ARRIVAL", routeTimeBasis: null, routeProxyTimes: [] },
  consumptionModelRef: "fixture@v1", routeMethodRef: "fixture@v1",
  source: { datasetId: id(4), sourceLegId: `NAV-${id(100 + n).slice(-4)}`, group: "NAV", sheet: "fixture", reconstruction: "fixture", quality: "fixture", status: "CERTIFIED_SOURCE", confidence: "HIGH", sourceRowHash: "a".repeat(64) },
  methodVersion: "mobility@v1", evidenceRefs: [`mobility:${n}`], provenance: "estimated",
});
const trip = (n) => ({ mobilityTripId: id(200 + n), householdId, knowledgeState: "KNOWN", boundaryStatus: "CLOSED_HOME" });
const trips = [trip(1), trip(2)];
const legs = [leg(1), leg(2), leg(3)];
const memberships = [
  { mobilityTripId: trips[0].mobilityTripId, mobilityLegId: legs[0].legId },
  { mobilityTripId: trips[0].mobilityTripId, mobilityLegId: legs[1].legId },
  { mobilityTripId: trips[1].mobilityTripId, mobilityLegId: legs[2].legId },
];
const links = [
  { mobilityTripContextLinkId: id(301), mobilityTripId: trips[0].mobilityTripId, lifeEventId: id(401), momentId: null, relationType: "STOP_CONTEXT", anchorLegId: legs[0].legId, validationStatus: "CONFIRMED" },
  { mobilityTripContextLinkId: id(302), mobilityTripId: trips[1].mobilityTripId, lifeEventId: null, momentId: id(501), relationType: "ENVELOPING_CONTEXT", anchorLegId: null, validationStatus: "CONFIRMED" },
];
const baseInput = { mobilityLegs: legs, trips, memberships, contextLinks: links, contextResolutions: trips.map(({ mobilityTripId }) => ({ mobilityTripId, status: "RESOLVED" })) };
const owner = buildGlobalM7EventMobilityAuthority(baseInput);
const scope = normalizeGlobalAnalysisScopeV2({ subject: { kind: "household" }, time: { kind: "global_v2", asOf: "2026-09-24T00:00:00Z", certifiedThrough: "2026-07-31" } }, { householdTimeZone: "Europe/Paris", authorizedPersonIds: [] });
const scopeHash = computeGlobalAnalysisScopeV2Hash(scope);
const definition = (value) => buildGlobalEventMobilityArtifactDefinition({ scope, scopeHash, owner: value });
const ownerOutputs = globalPrimaryModuleCatalog.map(({ moduleKey }) => ({ moduleKey, owner: `Fixture${moduleKey}`, output: {}, knowledge: "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: [], evidenceRefs: [] }));
const candidateInput = { project: "event-mobility-fixture", householdId, householdTimeZone: "Europe/Paris", personIds: [], asOf: "2026-09-24T00:00:00Z", certifiedThrough: "2026-07-31", dataRevision: "8", analyticsRevision: "107", implementationIdentity: "f".repeat(40), ownerOutputs, eventMobilityAuthority: owner,
  candidateAdapters: { timeline: { adapterVersion: "fixture-timeline@v1", inputHash: "a".repeat(64), events: [] } },
  momentComponentPresentation: { version: "fixture-components@v1", inputHash: "b".repeat(64), rows: [] } };
const build = (value) => buildGlobalV2CandidateFromOwnerOutputs({ ...candidateInput, eventMobilityAuthority: value });
const first = build(owner);
const second = build(buildGlobalM7EventMobilityAuthority({ ...baseInput, mobilityLegs: [...legs].reverse(), trips: [...trips].reverse(), memberships: [...memberships].reverse(), contextLinks: [...links].reverse() }));
const artifactOf = (candidate) => candidate.artifacts.find(({ version }) => version.family === "global_event_mobility");
const artifact = artifactOf(first);
assert.ok(artifact);
assert.equal(first.requiredKeys.artifacts.filter((key) => key === artifact.key).length, 1);
assert.equal(first.versions.artifacts.filter(({ key }) => key === artifact.key).length, 1);
assert.equal(first.manifest.closures.filter(({ outputKey }) => outputKey === artifact.key).length, 1);
assert.equal(artifact.key, `global-artifact:event-mobility:${scopeHash}`);
assert.equal(artifact.version.contractVersion, "global-event-mobility@v1");
assert.equal(artifact.version.family, "global_event_mobility");
assert.equal(artifact.payload.methodVersion, "global_m7_event_mobility@v1");
assert.equal(artifact.payload.policyVersion, "global-m7-event-mobility-physical-attribution@v1");
assert.equal(artifact.payload.costMetricId, "mobility_usage_estimated_fuel_cost@v1");
assert.equal(artifact.payload.liveWrites, "NONE");
assert.deepEqual(artifact.dependencies, [{ authority: "METRIC", family: "global_event_mobility_owner_output", identity: "GlobalM7EventMobilityAuthority:EVENT_MOBILITY", digest: owner.outputHash, required: true }]);
const { publicationMeta: _publicationMeta, resourceMeta: _resourceMeta, ...body } = artifact.payload;
assert.deepEqual(body, owner);
assert.equal(Buffer.byteLength(JSON.stringify(artifact.payload), "utf8") <= GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES, true);
assert.equal(JSON.stringify(artifact.payload).includes('"mobilityLegs"'), false);
for (const raw of ["mobilityTrips", "mobilityTripLegs", "mobilityTripContextLinks", "mobilityTripContextResolutions", "sourceRowHash", "fuelPricePerLiter"]) assert.equal(JSON.stringify(artifact.payload).includes(`"${raw}"`), false);
assert.equal(first.candidateId, second.candidateId);
assert.deepEqual(artifact, artifactOf(second));
assert.deepEqual(first.manifest.closures.find(({ outputKey }) => outputKey === artifact.key), second.manifest.closures.find(({ outputKey }) => outputKey === artifact.key));
const wire = serializeGlobalV2PublicationManifest(first.manifest);
assert.equal(wire.dependencyCatalog.filter(({ family }) => family === "global_event_mobility_owner_output").length, 1);
assert.equal(wire.dependencyCatalog.find(({ family }) => family === "global_event_mobility_owner_output").digest, owner.outputHash);
assert.equal(artifact.dependencies.some(({ family }) => /timeline|persona|rhythm/iu.test(family)), false);
assert.throws(() => definition({ ...owner, summaries: owner.summaries.map((summary) => ({ ...summary, mobilityLegs: legs })), outputHash: owner.outputHash }), /SUMMARY_INVALID/u);
assert.throws(() => definition({ ...owner, mobilityLegs: legs }), /OWNER_INVALID/u);

const assertInvalidation = (changedOwner) => {
  assert.notEqual(changedOwner.outputHash, owner.outputHash);
  const changedCandidate = build(changedOwner);
  const changedArtifact = artifactOf(changedCandidate);
  assert.notEqual(changedArtifact.dependencies[0].digest, artifact.dependencies[0].digest);
  assert.notEqual(changedArtifact.version.resourceInputHash, artifact.version.resourceInputHash);
  assert.notEqual(changedCandidate.manifest.closures.find(({ outputKey }) => outputKey === artifact.key).inputDigest, first.manifest.closures.find(({ outputKey }) => outputKey === artifact.key).inputDigest);
  assert.notEqual(changedCandidate.candidateId, first.candidateId);
  assert.deepEqual(changedCandidate.artifacts.filter(({ key }) => key !== artifact.key).map(({ key, version }) => [key, version.resourceInputHash]),
    first.artifacts.filter(({ key }) => key !== artifact.key).map(({ key, version }) => [key, version.resourceInputHash]),
    "L’Owner Event Mobility ne doit pas invalider les broad outputs ou les artifacts Persona, Rythmes et Timeline.");
};
assertInvalidation(buildGlobalM7EventMobilityAuthority({ ...baseInput, mobilityLegs: legs.map((item) => item.legId === legs[0].legId ? { ...item, estimatedFuelCost: "19" } : item) }));
assertInvalidation(buildGlobalM7EventMobilityAuthority({ ...baseInput, memberships: memberships.map((item) => item.mobilityLegId === legs[1].legId ? { ...item, mobilityTripId: trips[1].mobilityTripId } : item) }));
assertInvalidation(buildGlobalM7EventMobilityAuthority({ ...baseInput, contextLinks: [{ ...links[0], anchorLegId: legs[1].legId }, links[1]] }));
const syntheticPolicyVersion = globalEventMobilityArtifactVersion({ key: artifact.key, scope, ownerInputHash: owner.inputHash, ownerOutputHash: owner.outputHash, methodVersion: owner.methodVersion, policyVersion: "global-m7-event-mobility-physical-attribution@v2", costMetricId: owner.costMetricId });
assert.notEqual(syntheticPolicyVersion.resourceInputHash, artifact.version.resourceInputHash);
assert.notDeepEqual(syntheticPolicyVersion.policyVersions, artifact.version.policyVersions);

const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture-dir="));
if (fixtureArg !== undefined) {
  const fixtureDirectory = fixtureArg.slice("--fixture-dir=".length);
  const { resolveGlobalM7EventMobilityAuthority } = await import("../src/server/analytics/global-v2-event-mobility-authority.ts");
  const { projectMobilityLegFactFromCanonicalRow } = await import("../src/server/canonical/mobility.ts");
  const tables = loadFixtureTables(fixtureDirectory);
  const household = tables.get("households")[0];
  const revision = tables.get("household_revisions").find((row) => row.household_id === household.household_id);
  assert.equal(String(revision.data_revision), "8");
  assert.equal(String(revision.analytics_revision), "107");
  const facts = (tables.get("mobility_legs") ?? []).map((row) => projectMobilityLegFactFromCanonicalRow({
    ...row, distance_km_text: String(row.distance_km), duration_seconds_text: row.duration_seconds === null ? null : String(row.duration_seconds),
    duration_no_traffic_seconds_text: row.duration_no_traffic_seconds === null ? null : String(row.duration_no_traffic_seconds),
    estimated_fuel_liters_text: String(row.estimated_fuel_liters), estimated_fuel_cost_text: String(row.estimated_fuel_cost), fuel_price_per_liter_text: String(row.fuel_price_per_liter),
  }));
  const realOwner = await resolveGlobalM7EventMobilityAuthority({ repository: {
    client: createFixtureSupabaseClient(fixtureDirectory),
    context: { householdId: household.household_id, asOf: "2026-09-24T00:00:00Z", timezone: household.timezone, periods: [{ month: "2025-08-01" }] },
    loadMobilityLegFacts: async () => facts,
  }, certifiedThrough: "2026-07-31" });
  const realCandidate = buildGlobalV2CandidateFromOwnerOutputs({ ...candidateInput, householdId: household.household_id, eventMobilityAuthority: realOwner });
  const realArtifact = artifactOf(realCandidate);
  const { publicationMeta: _meta, resourceMeta: _resource, ...realBody } = realArtifact.payload;
  assert.deepEqual(realBody, realOwner);
  assert.equal(realBody.summaries.length, 63);
  assert.deepEqual(Object.fromEntries(["KNOWN", "PARTIAL", "AMBIGUOUS", "UNKNOWN", "NOT_APPLICABLE"].map((status) => [status, realBody.summaries.filter((summary) => summary.status === status).length])), { KNOWN: 8, PARTIAL: 55, AMBIGUOUS: 0, UNKNOWN: 0, NOT_APPLICABLE: 0 });
  assert.deepEqual(realBody.physicalUnionTotals, { physicalLegCount: 101, distanceKm: "2543.447", estimatedFuelLiters: "202.917655", estimatedFuelCost: "377.89726418" });
  const payloadBytes = Buffer.byteLength(JSON.stringify(realArtifact.payload), "utf8");
  assert.ok(payloadBytes < GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES);
  assert.equal(JSON.stringify(realArtifact.payload).includes('"sourceRowHash"'), false);
  console.log(JSON.stringify({ result: "PASS", fixture: "source-revision-8", artifactKey: realArtifact.key, payloadBytes, inputHash: realBody.inputHash, outputHash: realBody.outputHash, dependencyDigest: realArtifact.dependencies[0].digest,
    summaries: realBody.summaries.length, statusCounts: { KNOWN: 8, PARTIAL: 55, AMBIGUOUS: 0, UNKNOWN: 0, NOT_APPLICABLE: 0 }, physicalUnionTotals: realBody.physicalUnionTotals }));
} else {
  console.log(JSON.stringify({ result: "PASS", fixture: "synthetic", artifactKey: artifact.key, payloadBytes: Buffer.byteLength(JSON.stringify(artifact.payload), "utf8") }));
}
