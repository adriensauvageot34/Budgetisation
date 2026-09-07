import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const path of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return next(path, context); } catch { /* next */ }
    }
    throw error;
  }
} });

const {
  buildGlobalActivityRhythm,
  buildGlobalDayTypeAnalysis,
  buildGlobalM4ActivityTransformations,
  buildGlobalM4RoutineTransformations,
  buildGlobalRoutineCosts,
  buildGlobalSeasonalPattern,
  createGlobalM4DependencyDeclaration,
  discoverGlobalRoutinePatterns,
  globalM4PlaceRoleCapability,
  projectPlaceVisitRoutineRole,
  projectGlobalRoutineDay,
} = await import("../src/analytics/global-v2/index.ts");
const { assertGlobalDependencyClosure } = await import("../src/core/global-v2/index.ts");
const { globalMaterialityPolicies } = await import("../src/analytics/global-v2/materiality.ts");
const { parseMoney } = await import("../src/core/money/index.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2), activityId = uuid(3);
const date = (index) => {
  const value = new Date(Date.UTC(2025, 0, 1 + index));
  return value.toISOString().slice(0, 10);
};
const personDay = (index, state = "observable") => ({ fact: "fct_person_day", householdId, householdTimeZone: "Europe/Paris", personDayId: uuid(1000 + index), personId, localDate: date(index), locationObservability: state });
const occurrence = (index, start = index, end = start) => ({ fact: "fct_activity_occurrence", householdId, householdTimeZone: "Europe/Paris", lifeEventId: uuid(2000 + index), activityId, lifeEventSeriesId: null, parentLifeEventId: null, startDate: date(start), endDate: date(end), validationStatus: "Confirmé", participantIds: [personId] });

const fiveOccurrences = Array.from({ length: 5 }, (_, index) => occurrence(index, index * 2, index === 0 ? 4 : index * 2));
const tenDays = Array.from({ length: 10 }, (_, index) => personDay(index));
const rhythm = buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences, personDays: tenDays });
check(() => assert.equal(rhythm.rawOccurrenceCount, 5));
check(() => assert.equal(rhythm.includedOccurrenceCount, 5));
check(() => assert.equal(rhythm.multiDayOccurrenceCount, 1));
check(() => assert.equal(rhythm.rate.value, "0.5"));
check(() => assert.equal(rhythm.cadence.medianIntervalDays, "2"));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences, personDays: [...tenDays, ...Array.from({ length: 10 }, (_, i) => personDay(10 + i))] }).rate.value, "0.25"));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences.slice(0, 2), personDays: tenDays }).cadence.status, "UNKNOWN"));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences, personDays: [] }).rate.status, "UNKNOWN"));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences, personDays: tenDays.map((day) => ({ ...day, locationObservability: "unknown" })) }).rate.value, "0.5"));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences, personDays: tenDays.filter((_, i) => i !== 5) }).rate.status, "PARTIAL"));
check(() => assert.throws(() => buildGlobalActivityRhythm({ activityId, personId, occurrences: [fiveOccurrences[0], { ...fiveOccurrences[0], endDate: date(9) }], personDays: tenDays }), /contradictoire/));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences.map((fact) => ({ ...fact, participantIds: [] })), personDays: tenDays }).rawOccurrenceCount, 0));

const authority = (key, index) => ({ semanticKey: key, authority: { kind: "ACTIVITY_OCCURRENCE", factRef: `occurrence:${index}`, evidenceRefs: [`fact:${index}`] } });
const routineDay = (index, tokenKeys = ["HOME", "WORK", "RESTAURANT", "WORK", "HOME"], observable = true) => ({
  personDayId: uuid(3000 + index), personId, localDate: date(index), eligibilityContext: "ONSITE", observable,
  tokens: tokenKeys.map((key, position) => authority(key, `${index}:${position}`)),
});
const regularDays = [
  routineDay(0), routineDay(1), routineDay(2, ["HOME", "WORK", "GROCERY", "RESTAURANT", "WORK", "HOME"]), routineDay(3), routineDay(4),
  ...Array.from({ length: 5 }, (_, i) => routineDay(5 + i, ["HOME", "LEISURE", "HOME"])),
];
const patterns = discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: regularDays });
check(() => assert.ok(patterns.patterns.some((pattern) => pattern.certificationStatus === "CERTIFIED" && pattern.coreTokens.join(",") === "HOME,WORK,RESTAURANT,WORK,HOME")));
check(() => assert.equal(patterns.patterns.find((pattern) => pattern.coreTokens.includes("RESTAURANT"))?.prevalence, 0.5));
check(() => assert.equal(patterns.patterns.find((pattern) => pattern.coreTokens.includes("RESTAURANT"))?.evolution.monthlyPrevalence[0].value, "0.5"));
check(() => assert.equal(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: regularDays.slice(0, 2) }).patterns.length, 0));
check(() => assert.ok(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: regularDays.slice(0, 3) }).patterns.every((pattern) => pattern.certificationStatus === "HYPOTHESIS_ONLY")));
const sparse = [...Array.from({ length: 5 }, (_, i) => routineDay(i)), ...Array.from({ length: 162 }, (_, i) => routineDay(10 + i, [], true))];
check(() => assert.ok(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: sparse }).patterns.every((pattern) => pattern.certificationStatus !== "CERTIFIED")));
check(() => assert.throws(() => discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: [routineDay(0, ["PLACE_LABEL:Office", "WORK", "HOME"])] }), /place label/));
check(() => assert.throws(() => discoverGlobalRoutinePatterns({ scope: "SHARED", eligibilityContext: "ONSITE", days: regularDays }), /participation/));
const sharedDays = regularDays.map((day) => ({ ...day, sharedParticipantIds: [personId, uuid(4)], sharedEvidenceRefs: [`participation:${day.personDayId}`] }));
check(() => assert.ok(discoverGlobalRoutinePatterns({ scope: "SHARED", eligibilityContext: "ONSITE", days: sharedDays }).patterns.length > 0));
const missingCore = regularDays.map((day, index) => index === 0 ? routineDay(index, ["HOME", "RESTAURANT", "HOME"]) : day);
check(() => assert.equal(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: missingCore }).patterns.find((pattern) => pattern.coreTokens.join(",") === "HOME,WORK,RESTAURANT,WORK,HOME")?.occurrenceCount, 4));
const visit = { fact: "fct_place_visit", householdId, householdTimeZone: "Europe/Paris", visitKey: uuid(50), personDayId: uuid(51), personId, placeId: uuid(52), localDate: date(0), interval: { kind: "unknown" }, timePrecision: "unknown", sequenceIndex: 0 };
check(() => assert.equal(projectPlaceVisitRoutineRole(visit).status, "UNKNOWN"));
check(() => assert.equal(globalM4PlaceRoleCapability.state, "UNAVAILABLE"));
const projected = projectGlobalRoutineDay({ personDay: tenDays[0], occurrences: [fiveOccurrences[0]], visits: [], eligibilityContext: "ONSITE", elements: [
  { kind: "DAY_CONTEXT", semanticKey: "HOME", authorityRef: "canonical:day:start", sequenceIndex: 0, evidenceRefs: ["person-day:start"] },
  { kind: "ACTIVITY", occurrenceId: fiveOccurrences[0].lifeEventId, sequenceIndex: 1, evidenceRefs: ["participation:explicit"] },
  { kind: "DAY_CONTEXT", semanticKey: "HOME", authorityRef: "canonical:day:end", sequenceIndex: 2, evidenceRefs: ["person-day:end"] },
] });
check(() => assert.equal(projected.tokens[1].semanticKey, `ACTIVITY:${activityId}`));
check(() => assert.equal(projected.tokens.length, 3));
check(() => assert.throws(() => projectGlobalRoutineDay({ personDay: tenDays[1], occurrences: [fiveOccurrences[0]], visits: [], eligibilityContext: "ONSITE", elements: [{ kind: "ACTIVITY", occurrenceId: fiveOccurrences[0].lifeEventId, sequenceIndex: 0, evidenceRefs: ["date-only"] }] }), /same-day participation|multiday/));
check(() => assert.throws(() => projectGlobalRoutineDay({ personDay: tenDays[0], occurrences: [{ ...fiveOccurrences[0], participantIds: [] }], visits: [], eligibilityContext: "ONSITE", elements: [{ kind: "ACTIVITY", occurrenceId: fiveOccurrences[0].lifeEventId, sequenceIndex: 0, evidenceRefs: ["coincidence-only"] }] }), /participation/));
check(() => assert.throws(() => projectGlobalRoutineDay({ personDay: tenDays[0], occurrences: [], visits: [visit], eligibilityContext: "ONSITE", elements: [{ kind: "PLACE_ROLE", visitKey: visit.visitKey, semanticRole: "WORK", roleAssertionRef: "", validFrom: date(0), sequenceIndex: 0, evidenceRefs: ["visit-only"] }] }), /role assertion/));
const timeDays = Array.from({ length: 5 }, (_, index) => ({ ...routineDay(index), tokens: routineDay(index).tokens.map((token) => ({ ...token, dayPart: "MIDDAY" })) }));
check(() => assert.equal(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: timeDays }).patterns[0].timeSensitive, true));
check(() => assert.throws(() => discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: [{ ...timeDays[0], tokens: timeDays[0].tokens.map((token) => ({ ...token, dayPart: "LUNCHISH" })) }] }), /DayPartCatalog/));
const optionalDays = Array.from({ length: 5 }, (_, index) => routineDay(index, index < 3 ? ["HOME", "WORK", "COFFEE", "RESTAURANT", "HOME"] : ["HOME", "WORK", "RESTAURANT", "HOME"]));
check(() => assert.ok(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: optionalDays }).patterns.some((pattern) => pattern.optionalTokens.includes("COFFEE"))));
const promotedDays = Array.from({ length: 5 }, (_, index) => routineDay(index, index < 4 ? ["HOME", "WORK", "CORE80", "RESTAURANT", "HOME"] : ["HOME", "WORK", "RESTAURANT", "HOME"]));
check(() => assert.ok(discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: promotedDays }).patterns.every((pattern) => !pattern.coreTokens.includes("WORK") || pattern.coreTokens.includes("CORE80"))));
const datedRoleDay = { ...routineDay(0), tokens: [
  authority("HOME", "home"),
  { semanticKey: "WORK", authority: { kind: "CANONICAL_PLACE_ROLE", factRef: "person_place_roles:1", validFrom: date(0), validTo: date(5), evidenceRefs: ["canonical:place-role:1"] } },
  authority("HOME", "return"),
] };
check(() => assert.doesNotThrow(() => discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: [datedRoleDay, { ...datedRoleDay, personDayId: uuid(3901), localDate: date(1) }, { ...datedRoleDay, personDayId: uuid(3902), localDate: date(2) }] })));
check(() => assert.throws(() => discoverGlobalRoutinePatterns({ scope: "PERSON", eligibilityContext: "ONSITE", days: [{ ...datedRoleDay, localDate: date(8) }] }), /validity|effective/));

const dayType = buildGlobalDayTypeAnalysis({
  personId, personDays: tenDays,
  contexts: tenDays.slice(0, 5).map((day) => ({ personDayId: day.personDayId, dayType: "ONSITE", authorityRef: `canonical:day:${day.personDayId}`, evidenceRefs: [`fact:${day.personDayId}`] })),
  dayCosts: tenDays.slice(0, 5).map((day, index) => ({ personDayId: day.personDayId, status: "KNOWN", amount: parseMoney(String(10 + index)), componentKeys: [`component:${index}`], evidenceRefs: [`ledger:${index}`] })),
});
check(() => assert.equal(dayType.dayTypes[0].rate.value, "0.5"));
check(() => assert.equal(dayType.status, "PARTIAL"));
check(() => assert.equal(dayType.unclassifiedObservableDays.length, 5));
check(() => assert.throws(() => buildGlobalDayTypeAnalysis({ personId, personDays: tenDays, contexts: [{ personDayId: uuid(9999), dayType: "ONSITE", authorityRef: "canonical:missing", evidenceRefs: ["fact:missing"] }], dayCosts: [] }), /scoped PersonDay/));

const activityCost = (index, amount = "10", component = index) => ({
  fact: "fct_activity_occurrence_cost", householdId, householdTimeZone: "Europe/Paris", occurrenceId: uuid(4000 + index), activityId,
  causalCost: { availability: "known", value: parseMoney(amount) }, coverage: { level: "complete" },
  support: { n: 1, eligibleN: 1, observableN: 1, excludedN: 0, unit: "occurrence", level: "insufficient" },
  evidence: [{ financialLinkId: uuid(5000 + index), canonicalComponentKey: `operation:${uuid(6000 + component)}`, relationType: "Paiement_activite" }], provenance: "derived",
});
const routineInstances = Array.from({ length: 7 }, (_, index) => ({ routineId: "routine:one", instanceId: `instance:${index}`, personDayId: uuid(3000 + index), occurrenceIds: [uuid(4000 + index)] }));
const associatedDays = routineInstances.map((instance, index) => ({ personDayId: instance.personDayId, status: "KNOWN", amount: parseMoney(String(110 + index)), componentKeys: [`domestic:${index}`, `routine:${index}`], evidenceRefs: [`daily-ledger:${index}`] }));
const costs = buildGlobalRoutineCosts({ routineId: "routine:one", instances: routineInstances, activityCosts: routineInstances.map((_, i) => activityCost(i)), dayCosts: associatedDays, monthlyFrequency: "4.2" });
check(() => assert.equal(costs.causalRoutineCost.value, "10"));
check(() => assert.equal(costs.associatedDayCost.value, "113"));
check(() => assert.notEqual(costs.causalRoutineCost.value, costs.associatedDayCost.value));
check(() => assert.equal(costs.monthlyEquivalent.value, "42"));
check(() => assert.equal(costs.nonAdditiveAcrossRoutines, true));
check(() => assert.equal(buildGlobalRoutineCosts({ routineId: "routine:one", instances: routineInstances.slice(0, 4), activityCosts: routineInstances.slice(0, 4).map((_, i) => activityCost(i)), dayCosts: associatedDays.slice(0, 4) }).causalRoutineCost.status, "PARTIAL"));
check(() => assert.equal(buildGlobalRoutineCosts({ routineId: "routine:one", instances: routineInstances.slice(0, 3), activityCosts: routineInstances.slice(0, 3).map((_, i) => activityCost(i)), dayCosts: associatedDays.slice(0, 3) }).causalRoutineCost.status, "UNKNOWN"));
const sharedComponent = buildGlobalRoutineCosts({ routineId: "routine:one", instances: [{ routineId: "routine:one", instanceId: "overlap", personDayId: uuid(3000), occurrenceIds: [uuid(4000), uuid(4001)] }], activityCosts: [activityCost(0, "10", 99), activityCost(1, "10", 99)], dayCosts: associatedDays.slice(0, 1) });
check(() => assert.equal(sharedComponent.perInstance[0].causalCost.status, "CONFLICT"));

const evidence = {
  phenomenonId: "activity:restaurant", metricRef: "activity-rate", knowledgeState: "KNOWN",
  support: { naturalGrain: "WEEK", eligibleUnits: 8, observedUnits: 8, includedUnits: 8, excludedObservedUnits: 0, minimumRequired: 8, supportStatus: "SUFFICIENT", policyRef: "global-cycle-seasonality@v1" },
  coverage: { dimensions: [{ dimension: "PERSON_DAY", status: "KNOWN", numerator: 8, denominator: 8, ratio: 1, unit: "week", basis: "observable", evidenceRefs: ["person-days"], policyRef: "global-routine-observable-exposure@v1" }], requiredDimensions: ["PERSON_DAY"], effective: 1, aggregation: "MIN_REQUIRED_DIMENSIONS" },
  evidenceRefs: ["activity-facts"], entityRefs: [activityId], methodVersion: "global_cycle_seasonality@v1", materialityPolicy: globalMaterialityPolicies.ACTIVITY_FREQUENCY.ref,
};
const cycle = (id, high = 4, regimeId = "current", extra = {}) => [
  { cycleId: id, phase: "SAT", numerator: String(high), observableDenominator: "1", regimeId, complete: true, dependencyRefs: [`cycle:${id}:sat`], ...extra },
  { cycleId: id, phase: "MON", numerator: "1", observableDenominator: "1", regimeId, complete: true, dependencyRefs: [`cycle:${id}:mon`] },
];
const seasonal = (kind, observations, extra = {}) => buildGlobalSeasonalPattern({ patternId: `pattern:${kind}`, kind, subjectRef: "person:test", highPhases: ["SAT"], observations, currentRegimeId: "current", evidence, materialityPolicyId: "ACTIVITY_FREQUENCY", ...extra });
check(() => assert.equal(seasonal("WEEKLY_CYCLE", Array.from({ length: 8 }, (_, i) => cycle(`w${i}`)).flat()).status, "ACTIVE"));
check(() => assert.equal(seasonal("ANNUAL_SEASONALITY", cycle("y1")).publicationEligibility, "REJECTED"));
check(() => assert.equal(seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2")].flat()).status, "HYPOTHESIS_ONLY"));
check(() => assert.equal(seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2"), cycle("y3")].flat()).status, "ACTIVE"));
check(() => assert.equal(seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2"), cycle("y3", 0)].flat()).publicationEligibility, "REJECTED"));
check(() => assert.equal(seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2"), cycle("y3", 4, "past")].flat()).status, "HYPOTHESIS_ONLY"));
check(() => assert.equal(seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2"), cycle("y3", 40, "current", { ordinaryAuthority: { classification: "EXCEPTIONAL", evidenceRef: "moment:exceptional" } })].flat()).status, "HYPOTHESIS_ONLY"));
check(() => assert.throws(() => seasonal("ANCHORED_CALENDAR_EVENT", [cycle("y1"), cycle("y2"), cycle("y3")].flat()), /CalendarEventWindowCatalog/));
check(() => assert.equal(seasonal("ANCHORED_CALENDAR_EVENT", [cycle("y1"), cycle("y2"), cycle("y3")].flat(), { calendarWindowRef: "CalendarEventWindowCatalog@v1:christmas" }).status, "ACTIVE"));
const lost = seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2"), cycle("y3", 0)].flat(), { lifecycleAssertion: { status: "LOST", authorityRef: "seasonal-lifecycle:certified", evidenceRefs: ["cycles:additional"] } });
check(() => assert.equal(lost.status, "LOST"));
check(() => assert.equal(lost.publicationEligibility, "ELIGIBLE"));
check(() => assert.throws(() => seasonal("ANNUAL_SEASONALITY", [cycle("y1"), cycle("y2"), cycle("y3", 0)].flat(), { lifecycleAssertion: { status: "LOST", authorityRef: "", evidenceRefs: [] } }), /longitudinal authority/));

const months = Array.from({ length: 12 }, (_, month) => {
  const first = new Date(Date.UTC(2025, month, 1));
  const monthText = first.toISOString().slice(0, 7);
  const daysInMonth = new Date(Date.UTC(2025, month + 1, 0)).getUTCDate();
  const count = month < 6 ? daysInMonth : daysInMonth * 2;
  const days = Array.from({ length: daysInMonth }, (_, day) => ({ ...personDay(8000 + month * 31 + day), localDate: `${monthText}-${String(day + 1).padStart(2, "0")}` }));
  const occurrences = Array.from({ length: count }, (_, i) => ({ ...occurrence(8000 + month * 100 + i), startDate: days[i % days.length].localDate, endDate: days[i % days.length].localDate }));
  return { days, occurrences };
});
const longRhythm = buildGlobalActivityRhythm({ activityId, personId, occurrences: months.flatMap((m) => m.occurrences), personDays: months.flatMap((m) => m.days) });
const transformed = buildGlobalM4ActivityTransformations({ rhythm: longRhythm, certifiedThroughMonth: "2025-12", subjectRef: `person:${personId}`, evidence: { ...evidence, support: { ...evidence.support, naturalGrain: "MONTH", minimumRequired: 6, eligibleUnits: 12, observedUnits: 12, includedUnits: 12 } }, policyId: "ACTIVITY_FREQUENCY", semanticRefs: [], structuralAuthorityRefs: ["canonical:activity-structure"] });
check(() => assert.equal(transformed.transformations[0].kind, "DURABLE_CHANGE"));
check(() => assert.equal(transformed.transformations[0].status, "CONFIRMED_ONGOING"));
check(() => assert.equal(transformed.transformations[0].affectedDomains[0], "ACTIVITY_BEHAVIOR"));
const routineTransformed = buildGlobalM4RoutineTransformations({ pattern: { ...patterns.patterns[0], evolution: { monthlyPrevalence: longRhythm.monthlyRates } }, certifiedThroughMonth: "2025-12", subjectRef: `person:${personId}`, evidence: { ...evidence, support: { ...evidence.support, naturalGrain: "MONTH", minimumRequired: 6, eligibleUnits: 12, observedUnits: 12, includedUnits: 12 } }, policyId: "ACTIVITY_FREQUENCY", semanticRefs: [], structuralAuthorityRefs: ["canonical:routine-structure"] });
check(() => assert.equal(routineTransformed.transformations[0].affectedDomains[0], "ACTIVITY_BEHAVIOR"));

const declaration = createGlobalM4DependencyDeclaration({ personScope: { kind: "PERSON", personId }, authorizedPersonIds: [personId] });
check(() => assert.doesNotThrow(() => assertGlobalDependencyClosure(declaration, { factDependencyIds: ["fct_activity_occurrence", "fct_person_day", "fct_activity_occurrence_cost"], entityDependencyIds: ["person_place_roles"], upstreamAnalyticsIds: [], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["global-routine-natural-window", "global-routine-pattern", "global-routine-observable-exposure", "global-materiality-activity-frequency", "routinePattern", "cycleSeasonality", "routineCost", "observableExposure", "semanticTokenAuthority"] })));
check(() => assert.throws(() => assertGlobalDependencyClosure(declaration, { factDependencyIds: ["undeclared"], entityDependencyIds: [], upstreamAnalyticsIds: [], otherModuleDependencyIds: [], policyIds: [] }), /missing consumed/));
check(() => assert.equal(buildGlobalActivityRhythm({ activityId, personId, occurrences: [...fiveOccurrences].reverse(), personDays: [...tenDays].reverse() }).inputHash, rhythm.inputHash));
check(() => assert.notEqual(buildGlobalActivityRhythm({ activityId, personId, occurrences: fiveOccurrences, personDays: tenDays.slice(0, 9) }).inputHash, rhythm.inputHash));

console.log(`P05 M4 routines/cadence/costs/seasonality: ${checks}/${checks} PASS`);
