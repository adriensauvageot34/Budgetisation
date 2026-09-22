import assert from "node:assert/strict";
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
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/u.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const {
  buildGlobalM7PersonalMobilityAuthority,
  PERSONAL_MOBILITY_ROLLUP_METRIC_ID,
} = await import("../src/analytics/global-v2/personal-mobility.ts");

const householdId = "00000000-0000-4000-8000-000000000001";
const personA = "00000000-0000-4000-8000-000000000002";
const personB = "00000000-0000-4000-8000-000000000003";
const vehicleId = "00000000-0000-4000-8000-000000000004";
const placeA = "00000000-0000-4000-8000-000000000005";
const placeB = "00000000-0000-4000-8000-000000000006";
const datasetId = "00000000-0000-4000-8000-000000000007";
const legIds = Object.freeze({
  work1: "00000000-0000-4000-8000-000000000101",
  work2: "00000000-0000-4000-8000-000000000102",
  work3: "00000000-0000-4000-8000-000000000103",
  friendOut: "00000000-0000-4000-8000-000000000104",
  friendBack: "00000000-0000-4000-8000-000000000105",
  sharedWork: "00000000-0000-4000-8000-000000000106",
  jourPattern: "00000000-0000-4000-8000-000000000107",
});
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

const leg = (legId, date, estimatedFuelCost, overrides = {}) => ({
  fact: "fct_mobility_leg",
  legId,
  householdId,
  vehicleId,
  date,
  origin: { placeId: placeA, sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  destination: { placeId: placeB, sourceLabel: null, resolutionState: "EXPLICIT_MAPPING" },
  distanceKm: String(Number(estimatedFuelCost) * 5),
  durationSeconds: "600",
  durationNoTrafficSeconds: "540",
  estimatedFuelLiters: String(Number(estimatedFuelCost) / 2),
  estimatedFuelCost,
  fuel: { fuelType: "SP95", pricePerLiter: "2", pricePeriod: date.slice(0, 7), geoScope: "NATIONAL", source: "fixture", quality: "P4_NATIONAL_FALLBACK", observationId: null },
  time: { observedTime: `${date}T08:00:00`, authority: "OBSERVED", type: "ARRIVAL", routeTimeBasis: null, routeProxyTimes: [] },
  consumptionModelRef: "fixture@v1",
  routeMethodRef: "fixture@v1",
  source: { datasetId, sourceLegId: `NAV-${legId.slice(-4)}`, group: "NAV", sheet: "fixture", reconstruction: "fixture", quality: "fixture", status: "CERTIFIED_SOURCE", confidence: "HIGH", sourceRowHash: legId.replaceAll("-", "").repeat(2) },
  methodVersion: "mobility@v1",
  evidenceRefs: [`mobility:${legId}`],
  provenance: "estimated",
  ...overrides,
});

const context = (contextResolutionId, mobilityLegId, purpose, overrides = {}) => ({
  contextResolutionId,
  mobilityLegId,
  subjectPersonId: personA,
  contextKind: "LIFE_EVENT",
  contextRef: `event:${contextResolutionId}`,
  purpose,
  scope: "PERSONAL",
  linkState: "LINKED",
  knowledgeState: "CONFIRMED",
  temporalRelation: "ARRIVAL_TO_CONTEXT",
  temporalQuality: "EXACT",
  evidenceRefs: [`context:${contextResolutionId}`],
  ...overrides,
});

const presence = (presenceResolutionId, contextResolutionId, mobilityLegId, state) => ({
  presenceResolutionId,
  contextResolutionId,
  mobilityLegId,
  subjectPersonId: personA,
  otherPersonId: personB,
  state,
  temporalQuality: "EXACT",
  evidenceRefs: [`presence:${presenceResolutionId}`],
});

const mobilityLegs = [
  leg(legIds.work1, "2026-06-01", "2"),
  leg(legIds.work2, "2026-06-01", "3"),
  leg(legIds.work3, "2026-06-02", "4"),
  leg(legIds.friendOut, "2026-06-03", "5"),
  leg(legIds.friendBack, "2026-06-04", "6"),
  leg(legIds.sharedWork, "2026-06-05", "8"),
  leg(legIds.jourPattern, "2026-06-06", "9", { source: { datasetId, sourceLegId: "JOUR-0107", group: "JOUR", sheet: "fixture", reconstruction: "fixture", quality: "fixture", status: "CERTIFIED_SOURCE", confidence: "HIGH", sourceRowHash: legIds.jourPattern.replaceAll("-", "").repeat(2) } }),
];

const contextLinks = [
  context("work:1", legIds.work1, "WORK_COMMUTE", { contextKind: "PERSON_PLACE_PRESENCE", contextRef: "workplace:arrival" }),
  context("work:1:duplicate-context", legIds.work1, "WORK_COMMUTE", { contextRef: "event:work-shift" }),
  context("work:2", legIds.work2, "WORK_COMMUTE"),
  context("work:3", legIds.work3, "WORK_COMMUTE"),
  context("friend:out", legIds.friendOut, "FRIEND_VISIT", { contextRef: "event:friend-visit" }),
  context("friend:back", legIds.friendBack, "FRIEND_VISIT", { contextRef: "event:friend-visit" }),
  context("family:same-leg", legIds.friendOut, "FAMILY_VISIT", { contextRef: "event:family-visit" }),
  context("shared:work", legIds.sharedWork, "WORK_COMMUTE", { subjectPersonId: null, scope: "SHARED" }),
];

const presenceResolutions = [
  presence("presence:friend-out", "friend:out", legIds.friendOut, "OTHER_ELSEWHERE_CONFIRMED"),
  presence("presence:friend-back", "friend:back", legIds.friendBack, "UNKNOWN"),
  presence("presence:family-both", "family:same-leg", legIds.friendOut, "CO_PRESENT_CONFIRMED"),
];

const authority = buildGlobalM7PersonalMobilityAuthority({ mobilityLegs, contextLinks, presenceResolutions });
const summary = (contextKind, state = "ANY") => authority.summaries.find((candidate) =>
  candidate.personId === personA && candidate.contextKind === contextKind && candidate.couplePresenceFilter.state === state);
const work = summary("WORK_COMMUTE");
const friend = summary("FRIEND_VISIT");
const family = summary("FAMILY_VISIT");
const allPersonal = summary("ALL_PERSONAL");
const friendWithoutPartner = summary("FRIEND_VISIT", "OTHER_ELSEWHERE_CONFIRMED");

check(() => assert.equal(work.distinctDayCount, 2));
check(() => assert.equal(work.legCount, 3));
check(() => assert.equal(work.estimatedFuelCost, "9"));
check(() => assert.equal(work.distanceKm, "45"));
check(() => assert.equal(work.mobilityCostMetric.metricId, PERSONAL_MOBILITY_ROLLUP_METRIC_ID));
check(() => assert.equal(work.mobilityCostMetric.methodVersion, "mobility_usage_estimated_fuel_cost@v1"));
check(() => assert.equal(work.mobilityCostMetric.provenance, "estimated"));
check(() => assert.equal(work.grossMobilityUsage.status, "READY"));
check(() => assert.equal(work.incrementalMobilityCost.status, "UNAVAILABLE"));
check(() => assert.equal(friend.eventCount, 1));
check(() => assert.equal(friend.legCount, 2));
check(() => assert.equal(friendWithoutPartner.legCount, 1));
check(() => assert.equal(friendWithoutPartner.estimatedFuelCost, "5"));
check(() => assert.equal(authority.summaries.some((candidate) => candidate.contextKind === "FRIEND_VISIT" && candidate.couplePresenceFilter.state === "OTHER_ELSEWHERE_CONFIRMED" && candidate.legCount === 2), false));
check(() => assert.equal(authority.summaries.some((candidate) => candidate.contextKind === "FAMILY_VISIT" && candidate.couplePresenceFilter.state === "OTHER_ELSEWHERE_CONFIRMED"), false));
check(() => assert.equal(family.legCount, 1));
check(() => assert.equal(allPersonal.legCount, 5));
check(() => assert.equal(allPersonal.estimatedFuelCost, "20"));
check(() => assert.equal(authority.physicalTotals.physicalLegCount, mobilityLegs.length));
check(() => assert.equal(authority.physicalTotals.estimatedFuelCost, "37"));
check(() => assert.equal(authority.summaries.some((candidate) => candidate.contextKind === "WORK_MIDDAY"), false));
check(() => assert.equal(authority.workMiddaySummaryReady, false));
check(() => assert.equal(authority.afterWorkPatternReady, false));
check(() => assert.equal(authority.summaries.some((candidate) => candidate.entityRef.includes(personA) || candidate.entityRef.includes(personB)), false));
check(() => assert.equal(authority.summaries.some((candidate) => candidate.personId === personB), false));
check(() => assert.equal(JSON.stringify(authority).includes("fuelPaid"), false));
check(() => assert.equal(JSON.stringify(authority).includes("EconomicPayment"), false));
check(() => assert.equal(JSON.stringify(authority).includes("Operation"), false));
check(() => assert.equal(allPersonal.estimatedFuelCost, "20"));
check(() => assert.equal(authority.liveWrites, "NONE"));

const reversed = buildGlobalM7PersonalMobilityAuthority({
  mobilityLegs: [...mobilityLegs].reverse(),
  contextLinks: [...contextLinks].reverse(),
  presenceResolutions: [...presenceResolutions].reverse(),
});
check(() => assert.deepEqual(reversed, authority));

console.log(`Personal mobility checks passed (${checks})`);
