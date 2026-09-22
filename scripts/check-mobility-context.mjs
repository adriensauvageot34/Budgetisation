import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

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
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const {
  aggregateMobilityPhysicalTotals,
  buildGlobalM7MobilityContextAuthority,
  resolveMobilityPurposeFromTypeKey,
} = await import("../src/analytics/global-v2/mobility-context.ts");
const { resolveGlobalM7MobilityContextAuthority } = await import("../src/server/analytics/global-v2-mobility-context-authority.ts");

const householdId = "00000000-0000-4000-8000-000000000001";
const personA = "00000000-0000-4000-8000-000000000002";
const personB = "00000000-0000-4000-8000-000000000003";
const eventPlace = "00000000-0000-4000-8000-000000000010";
const elsewherePlace = "00000000-0000-4000-8000-000000000011";
const timezone = "Europe/Paris";
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

const leg = (id = "leg-1", overrides = {}) => ({
  fact: "fct_mobility_leg",
  legId: id,
  householdId,
  vehicleId: "vehicle-1",
  date: "2026-06-10",
  origin: { placeId: elsewherePlace, sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  destination: { placeId: eventPlace, sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  distanceKm: "10",
  durationSeconds: "1200",
  durationNoTrafficSeconds: "1100",
  estimatedFuelLiters: "1",
  estimatedFuelCost: "2",
  fuel: { fuelType: "SP95", pricePerLiter: "2", pricePeriod: "2026-06", geoScope: "NATIONAL", source: "fixture", quality: "P4_NATIONAL_FALLBACK", observationId: null },
  time: { observedTime: "2026-06-10T10:00:00", authority: "OBSERVED", type: "ARRIVAL", routeTimeBasis: null, routeProxyTimes: [] },
  consumptionModelRef: "fixture@v1",
  routeMethodRef: "fixture@v1",
  source: { datasetId: "dataset-1", sourceLegId: id, group: "AUT", sheet: "fixture", reconstruction: "fixture", quality: "fixture", status: "CERTIFIED_SOURCE", confidence: "HIGH", sourceRowHash: `hash-${id}` },
  methodVersion: "mobility@v1",
  evidenceRefs: [`mobility:${id}`],
  provenance: "estimated",
  ...overrides,
});

const participation = (personId, overrides = {}) => ({
  personId,
  status: "CONFIRMED",
  startAt: "2026-06-10T08:30:00Z",
  endAt: "2026-06-10T11:00:00Z",
  timePrecision: "EXACT",
  evidenceRef: `participation:${personId}:${JSON.stringify(overrides)}`,
  ...overrides,
});

const event = (id, typeKey, participations, overrides = {}) => ({
  lifeEventId: id,
  typeKey,
  startDate: "2026-06-10",
  endDate: "2026-06-10",
  validationStatus: "CONFIRMED",
  placeIds: [eventPlace],
  participations,
  evidenceRefs: [`event:${id}`, `type:${typeKey}`],
  ...overrides,
});

const visit = (id, personId, placeId, startAt = "2026-06-10T08:00:00Z", endAt = "2026-06-10T10:30:00Z", overrides = {}) => ({
  fact: "fct_place_visit",
  householdId,
  householdTimeZone: timezone,
  visitKey: id,
  personDayId: `day-${personId}`,
  personId,
  placeId,
  localDate: "2026-06-10",
  interval: { kind: "known", startedAt: startAt, endedAt: endAt },
  timePrecision: "exact",
  sequenceIndex: 1,
  ...overrides,
});

const day = (personId, observability = "observable") => ({
  fact: "fct_person_day",
  householdId,
  householdTimeZone: timezone,
  personDayId: `day-${personId}`,
  personId,
  localDate: "2026-06-10",
  locationObservability: observability,
});

const build = (overrides = {}) => buildGlobalM7MobilityContextAuthority({
  householdId,
  householdTimeZone: timezone,
  householdPersonIds: [personA, personB],
  mobilityLegs: [leg()],
  lifeEventContexts: [],
  placeVisits: [],
  personDays: [day(personA), day(personB)],
  ...overrides,
});

// A. A linked subject plus positive exact evidence elsewhere proves only the pairwise separation.
const separated = build({
  lifeEventContexts: [event("event-friend", "visite_ami", [participation(personA)])],
  placeVisits: [visit("visit-elsewhere", personB, elsewherePlace)],
});
const separatedEventLink = separated.contextLinks.find(({ contextRef }) => contextRef === "event-friend");
check(() => assert.equal(separatedEventLink.linkState, "LINKED"));
check(() => assert.equal(separatedEventLink.purpose, "FRIEND_VISIT"));
check(() => assert.equal(separated.presenceResolutions.find(({ contextResolutionId }) => contextResolutionId === separatedEventLink.contextResolutionId).state, "OTHER_ELSEWHERE_CONFIRMED"));
check(() => assert.equal(separated.presenceResolutions.some(({ state }) => state === "SOLO_PERSON"), false));

// B-C-F. Missing data, missing coverage, or a personal purpose never proves the other person absent.
const noOtherEvidence = build({ lifeEventContexts: [event("event-family", "visite_famille", [participation(personA)])] });
check(() => assert.equal(noOtherEvidence.presenceResolutions[0].state, "UNKNOWN"));
const absentCoverage = build({ lifeEventContexts: [event("event-family", "visite_famille", [participation(personA)])], personDays: [day(personA), day(personB, "unknown")] });
check(() => assert.equal(absentCoverage.presenceResolutions[0].state, "UNKNOWN"));
check(() => assert.equal(noOtherEvidence.contextLinks.find(({ contextRef }) => contextRef === "event-family").purpose, "FAMILY_VISIT"));

// D. Certified participation by both people is positive common evidence.
const together = build({ lifeEventContexts: [event("event-shared", "visite_famille", [participation(personA), participation(personB)])] });
check(() => assert.equal(together.contextLinks.filter(({ contextRef }) => contextRef === "event-shared").every(({ scope }) => scope === "SHARED"), true));
check(() => assert.equal(together.presenceResolutions.every(({ state }) => state === "CO_PRESENT_CONFIRMED"), true));
const sameEventNonOverlap = build({ lifeEventContexts: [event("event-shared-non-overlap", "visite_famille", [
  participation(personA),
  participation(personB, { startAt: "2026-06-10T15:00:00Z", endAt: "2026-06-10T16:00:00Z" }),
])] });
check(() => assert.equal(sameEventNonOverlap.presenceResolutions.find(({ subjectPersonId }) => subjectPersonId === personA).state, "UNKNOWN"));

// E. Household/event/vehicle scope without positive participation does not imply co-presence.
const householdOnly = build({ lifeEventContexts: [event("event-household", "visite_famille", [])] });
check(() => assert.equal(householdOnly.contextLinks.length, 1));
check(() => assert.equal(householdOnly.contextLinks[0].linkState, "UNLINKED"));
check(() => assert.equal(householdOnly.presenceResolutions.length, 0));

// G. The pairwise policy is symmetric.
const reverseSeparated = build({
  lifeEventContexts: [event("event-reverse", "visite_ami", [participation(personB)])],
  placeVisits: [visit("visit-a-elsewhere", personA, elsewherePlace)],
});
check(() => assert.equal(reverseSeparated.presenceResolutions.find(({ subjectPersonId }) => subjectPersonId === personB).state, "OTHER_ELSEWHERE_CONFIRMED"));

// Temporal policy: exact compatibility links, exact non-overlap rejects, weaker clocks remain ambiguous.
check(() => assert.equal(noOtherEvidence.contextLinks.find(({ contextRef }) => contextRef === "event-family").temporalQuality, "EXACT"));
const nonOverlap = build({ lifeEventContexts: [event("event-late", "visite_ami", [participation(personA, { startAt: "2026-06-10T15:00:00Z", endAt: "2026-06-10T16:00:00Z" })])] });
check(() => assert.equal(nonOverlap.contextLinks.some(({ contextRef }) => contextRef === "event-late"), false));
const approximate = build({ lifeEventContexts: [event("event-approx", "visite_ami", [participation(personA, { timePrecision: "APPROXIMATE" })])] });
check(() => assert.equal(approximate.contextLinks.find(({ contextRef }) => contextRef === "event-approx").linkState, "AMBIGUOUS"));
const proxy = build({
  mobilityLegs: [leg("leg-proxy", { time: { observedTime: null, authority: "PROXY", type: "ARRIVAL", routeTimeBasis: "fixture", routeProxyTimes: ["10:00"] } })],
  lifeEventContexts: [event("event-proxy", "visite_ami", [participation(personA)])],
});
check(() => assert.equal(proxy.contextLinks.find(({ contextRef }) => contextRef === "event-proxy").temporalQuality, "PROXY"));
check(() => assert.equal(proxy.contextLinks.find(({ contextRef }) => contextRef === "event-proxy").linkState, "AMBIGUOUS"));
const dateOnly = build({ lifeEventContexts: [event("event-date", "visite_ami", [participation(personA, { startAt: null, endAt: null, timePrecision: "UNKNOWN" })])] });
check(() => assert.equal(dateOnly.contextLinks.find(({ contextRef }) => contextRef === "event-date").temporalRelation, "DATE_ONLY_CANDIDATE"));
const preciseBeatsDateOnly = build({ lifeEventContexts: [event("event-precision", "visite_ami", [
  participation(personA, { evidenceRef: "participation:exact", startAt: "2026-06-10T15:00:00Z", endAt: "2026-06-10T16:00:00Z" }),
  participation(personA, { evidenceRef: "participation:date-only", startAt: null, endAt: null, timePrecision: "UNKNOWN" }),
])] });
check(() => assert.equal(preciseBeatsDateOnly.contextLinks.some(({ contextRef }) => contextRef === "event-precision"), false));

// Structured keys classify; labels and technical source groups are not semantic inputs.
check(() => assert.equal(resolveMobilityPurposeFromTypeKey("visite_ami"), "FRIEND_VISIT"));
check(() => assert.equal(resolveMobilityPurposeFromTypeKey("visite_famille"), "FAMILY_VISIT"));
check(() => assert.equal(resolveMobilityPurposeFromTypeKey("rdv_medical"), "HEALTH"));
check(() => assert.equal(resolveMobilityPurposeFromTypeKey("shopping_commerce"), "SHOPPING"));
check(() => assert.equal(resolveMobilityPurposeFromTypeKey("Chez Amandine"), "UNKNOWN"));
for (const group of ["NAV", "JOUR"]) {
  const lineageOnly = build({ mobilityLegs: [leg(`leg-${group}`, { source: { ...leg().source, sourceLegId: `leg-${group}`, group } })] });
  check(() => assert.equal(lineageOnly.contextLinks[0].purpose, "UNKNOWN"));
}

// One physical leg may have N contexts; additive quantities remain on the unique leg.
const multiContext = build({
  lifeEventContexts: [
    event("event-1", "visite_ami", [participation(personA)]),
    event("event-2", "visite_famille", [participation(personA)]),
    event("event-3", "rdv_medical", [participation(personA)]),
  ],
});
const linkedContexts = multiContext.contextLinks.filter(({ linkState }) => linkState === "LINKED");
check(() => assert.equal(linkedContexts.length, 3));
check(() => assert.equal(new Set(linkedContexts.map(({ mobilityLegId }) => mobilityLegId)).size, 1));
check(() => assert.equal(linkedContexts.some((link) => "estimatedFuelCost" in link || "distanceKm" in link || "estimatedFuelLiters" in link), false));
check(() => assert.deepEqual(aggregateMobilityPhysicalTotals([leg()], linkedContexts), { physicalLegCount: 1, distanceKm: "10", estimatedFuelLiters: "1", estimatedFuelCost: "2" }));
check(() => assert.deepEqual(multiContext.physicalTotals, { physicalLegCount: 1, distanceKm: "10", estimatedFuelLiters: "1", estimatedFuelCost: "2" }));

// Identity and output are deterministic across input order and display-only changes cannot enter the key.
const reordered = build({ lifeEventContexts: [...multiContext.contextLinks].length ? [
  event("event-3", "rdv_medical", [participation(personA)]),
  event("event-2", "visite_famille", [participation(personA)]),
  event("event-1", "visite_ami", [participation(personA)]),
] : [] });
check(() => assert.deepEqual(reordered.contextLinks.map(({ contextResolutionId }) => contextResolutionId).sort(), multiContext.contextLinks.map(({ contextResolutionId }) => contextResolutionId).sort()));
check(() => assert.equal(reordered.outputHash, multiContext.outputHash));
const source = fs.readFileSync(new URL("../src/analytics/global-v2/mobility-context.ts", import.meta.url), "utf8");
check(() => assert.doesNotMatch(source, /sourceLabel.*purpose|displayName.*purpose|fuzzy|substring|SOLO_PERSON/u));
check(() => assert.doesNotMatch(source, /group\s*===\s*["'](?:NAV|JOUR)["']/u));

// The M7 owner adapter consumes CanonicalRepository authorities read-only.
const ownerRepository = {
  context: {
    householdId,
    timezone,
    personIds: [personA, personB],
    periods: [{ householdId, month: "2026-06-01" }],
    asOf: "2026-06-30T21:59:59Z",
  },
  loadMobilityLegFacts: async () => [leg()],
  loadPlaceVisits: async () => [visit("owner-elsewhere", personB, elsewherePlace)],
  loadPersonDays: async () => [day(personA), day(personB)],
  loadActivityOccurrences: async () => [{
    fact: "fct_activity_occurrence",
    householdId,
    householdTimeZone: timezone,
    lifeEventId: "owner-event",
    activityId: "visite_ami",
    lifeEventSeriesId: null,
    parentLifeEventId: null,
    startDate: "2026-06-10",
    endDate: "2026-06-10",
    validationStatus: "Confirmé",
    participantIds: [personA],
  }],
  loadLifeEventRecords: async () => [{ life_event_id: "owner-event", primary_place_id: eventPlace }],
  loadLifeEventParticipationRows: async () => [
    {
      life_event_id: "owner-event",
      person_day_id: `day-${personA}`,
      person_id: personA,
      start_at: "2026-06-10T08:30:00Z",
      end_at: "2026-06-10T11:00:00Z",
      time_precision: "Exact",
      participation_status: "Confirmée",
    },
    {
      life_event_id: "owner-event",
      person_day_id: "day-outside-household",
      person_id: "00000000-0000-4000-8000-000000000099",
      start_at: "2026-06-10T08:30:00Z",
      end_at: "2026-06-10T11:00:00Z",
      time_precision: "Exact",
      participation_status: "Confirmée",
    },
  ],
  loadLifeEventLocalizationRows: async () => [{ life_event_id: "owner-event", place_id: eventPlace }],
};
const ownerAuthority = await resolveGlobalM7MobilityContextAuthority({ repository: ownerRepository, certifiedThrough: "2026-06-30" });
check(() => assert.equal(ownerAuthority.contextLinks.find(({ contextRef }) => contextRef === "owner-event").purpose, "FRIEND_VISIT"));
check(() => assert.equal(ownerAuthority.presenceResolutions.find(({ contextResolutionId }) => contextResolutionId === ownerAuthority.contextLinks.find(({ contextRef }) => contextRef === "owner-event").contextResolutionId).state, "OTHER_ELSEWHERE_CONFIRMED"));
check(() => assert.equal(ownerAuthority.liveWrites, "NONE"));

console.log(`P4.5-C mobility context: ${checks}/${checks} PASS`);
