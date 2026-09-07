import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const a = await import("../src/analytics/global-v2/index.ts");
const ids = await import("../src/core/identity/index.ts");
const { parseMoney } = await import("../src/core/money/index.ts");
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const rejects = (fn, pattern) => check(() => assert.throws(fn, pattern));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = ids.parseHouseholdId(uuid(1)), personA = ids.parsePersonId(uuid(2)), personB = ids.parsePersonId(uuid(3));
const resolver = new a.SharedParticipationResolver();
const base = (extra = {}) => ({ unitId: "u1", universeId: "activities", grain: "OCCURRENCE", personIds: [personA, personB], assertions: [], evidenceRefs: ["unit:u1"], ...extra });
const assertion = (personId, state, authority = "EXPLICIT") => ({ personId, state, authority, evidenceRefs: [`assert:${personId}:${state}`] });

// Explicit and Canonical proofs; positive-only lists never prove absence.
const shared = resolver.resolve(base({ assertions: [assertion(personA, "PRESENT"), assertion(personB, "PRESENT")] }));
check(() => assert.equal(shared.resolution, "SHARED"));
check(() => assert.equal(shared.evidenceLevel, "EXPLICIT_SHARED"));
const positiveOnly = resolver.resolve(base({ assertions: [assertion(personA, "PRESENT", "CANONICAL")], roster: { participantPersonIds: [personA], completeness: "POSITIVE_ONLY", externalParticipants: [], evidenceRefs: ["roster"] } }));
check(() => assert.equal(positiveOnly.personStates[personB], "UNKNOWN"));
check(() => assert.equal(positiveOnly.resolution, "UNRESOLVED"));
const exhaustive = resolver.resolve(base({ roster: { participantPersonIds: [personA], completeness: "EXHAUSTIVE", externalParticipants: [], evidenceRefs: ["roster"] } }));
check(() => assert.equal(exhaustive.personStates[personB], "ABSENT"));
check(() => assert.equal(exhaustive.resolution, "PERSON_A_ONLY"));
const conflict = resolver.resolve(base({ assertions: [assertion(personA, "PRESENT"), assertion(personA, "ABSENT"), assertion(personB, "PRESENT")] }));
check(() => assert.equal(conflict.resolution, "CONFLICT"));

const place = (placeId, resolutionLevel, parentPlaceId) => ({ placeId, resolutionLevel, ...(parentPlaceId ? { parentPlaceId } : {}), evidenceRefs: [`place:${placeId}`] });
const visit = (id, personId, placeId, start, end, timePrecision = "exact", visitKind = "STOP") => ({
  fact: { fact: "fct_place_visit", householdId, householdTimeZone: "Europe/Paris", visitKey: `visit:${id}`, personDayId: `day:${id}`, personId, placeId, localDate: "2026-06-10", interval: { kind: "known", startedAt: start, endedAt: end }, timePrecision, sequenceIndex: 1 },
  visitKind, evidenceRefs: [`visit:${id}`],
});
const strongVisits = [visit("a", personA, "venue", "2026-06-10T10:00:00Z", "2026-06-10T11:00:00Z"), visit("b", personB, "venue", "2026-06-10T10:20:00Z", "2026-06-10T11:20:00Z")];
const inferred = resolver.resolve(base({ activityType: "CAFE", visits: strongVisits, places: [place("venue", "VENUE")] }));
check(() => assert.equal(inferred.resolution, "SHARED"));
check(() => assert.equal(inferred.evidenceLevel, "STRONG_COPRESENCE"));
check(() => assert.equal(inferred.overlapMinutes, 40));
check(() => assert.equal(a.requiredSharedOverlapMinutes(60), 30));
check(() => assert.equal(a.requiredSharedOverlapMinutes(200), 60));
check(() => assert.equal(a.requiredSharedOverlapMinutes(20), 15));
const contextual = resolver.resolve(base({ activityType: "CAFE", visits: strongVisits.map((row) => ({ ...row, fact: { ...row.fact, placeId: "city" } })), places: [place("city", "MUNICIPALITY")] }));
check(() => assert.equal(contextual.resolution, "UNRESOLVED"));
check(() => assert.equal(contextual.evidenceLevel, "CONTEXTUAL_ONLY"));
const home = resolver.resolve(base({ activityType: "HOME", visits: strongVisits, places: [place("venue", "VENUE")] }));
check(() => assert.equal(home.resolution, "UNRESOLVED"));
check(() => assert.equal(home.evidenceLevel, "CONTEXTUAL_ONLY"));
const transit = resolver.resolve(base({ activityType: "CAFE", visits: [visit("a", personA, "venue", "2026-06-10T10:00:00Z", "2026-06-10T11:00:00Z", "exact", "TRANSIT"), strongVisits[1]], places: [place("venue", "VENUE")] }));
check(() => assert.equal(transit.resolution, "UNRESOLVED"));
const vague = resolver.resolve(base({ activityType: "CAFE", visits: [visit("a", personA, "venue", "2026-06-10T10:00:00Z", "2026-06-10T11:00:00Z", "unknown"), strongVisits[1]], places: [place("venue", "VENUE")] }));
check(() => assert.equal(vague.resolution, "UNRESOLVED"));
const explicitAbsentVsCopresence = resolver.resolve(base({ activityType: "CAFE", assertions: [assertion(personA, "ABSENT")], visits: strongVisits, places: [place("venue", "VENUE")] }));
check(() => assert.equal(explicitAbsentVsCopresence.resolution, "CONFLICT"));

// Multi-day Moment: observable coverage, 60%, >=2 shared days and structural proof.
const moment = resolver.resolve(base({ unitId: "m1", grain: "MOMENT", moment: { startDate: "2026-06-01", endDate: "2026-06-03", inferenceAllowed: true, structuralProofRefs: ["same-stay"], dayEvidence: [1,2,3].map((day) => ({ date: `2026-06-0${day}`, observable: true, shared: day <= 2, evidenceRefs: [`day:${day}`] })) } }));
check(() => assert.equal(moment.resolution, "SHARED"));
const weakMoment = resolver.resolve(base({ unitId: "m2", grain: "MOMENT", moment: { startDate: "2026-06-01", endDate: "2026-06-03", inferenceAllowed: true, structuralProofRefs: [], dayEvidence: [1,2,3].map((day) => ({ date: `2026-06-0${day}`, observable: true, shared: true, evidenceRefs: [`day:${day}`] })) } }));
check(() => assert.equal(weakMoment.resolution, "UNRESOLVED"));

// Economic context remains independent: no participation or 50/50 is inferred.
const economic = resolver.resolve(base({ economicContext: { causalEconomicCost: { status: "KNOWN", value: parseMoney("100"), evidenceRefs: ["cost"] }, contextualEstimatedCost: { status: "UNKNOWN" }, personalAttribution: { [personA]: { status: "KNOWN", value: parseMoney("100"), evidenceRefs: ["beneficiary:a"] }, [personB]: { status: "UNKNOWN" } }, economicIdentityRefs: ["component:1"] } }));
check(() => assert.equal(economic.resolution, "UNRESOLVED"));
check(() => assert.equal(economic.economicContext.personalAttribution[personA].value, "100"));
check(() => assert.equal(economic.economicContext.personalAttribution[personB].status, "UNKNOWN"));
rejects(() => resolver.resolve(base({ economicContext: { causalEconomicCost: { status: "UNKNOWN" }, contextualEstimatedCost: { status: "UNKNOWN" }, personalAttribution: { outsider: { status: "UNKNOWN" } }, economicIdentityRefs: [] } })), /M10_ECONOMIC_ATTRIBUTION_OUTSIDE_SHARED_SCOPE/);

// Denominators: UNKNOWN counts for coverage, only resolved units count for rate.
const units = [];
for (let i = 0; i < 10; i++) units.push(resolver.resolve(base({ unitId: `s${i}`, assertions: i < 6 ? [assertion(personA, "PRESENT"), assertion(personB, "PRESENT")] : i < 8 ? [assertion(personA, "PRESENT"), assertion(personB, "ABSENT")] : [] })));
const support = a.buildGlobalSharedObservableSupport({ universeId: "activities", grain: "OCCURRENCE", units });
check(() => assert.equal(support.sharedObservableCoverage, 0.8));
check(() => assert.equal(support.sharedRate, 0.75));
check(() => assert.equal(support.knowledgeState, "PARTIAL"));
check(() => assert.equal(support.support.eligibleUnits, 10));
check(() => assert.equal(support.support.includedUnits, 8));

// Canonical Facts adapter: missing participant is UNKNOWN, not ABSENT.
const fact = (id, participantIds) => ({ fact: "fct_activity_occurrence", householdId, householdTimeZone: "Europe/Paris", lifeEventId: id, activityId: "repas_restaurant", lifeEventSeriesId: null, parentLifeEventId: null, startDate: "2026-06-10", endDate: "2026-06-10", validationStatus: "Confirmé", participantIds });
const projected = a.projectGlobalSharedActivitiesFromFacts({ occurrences: [fact("life:1", [personA, personB]), fact("life:2", [personA])], personIds: [personA, personB], activityTypeByActivityId: { repas_restaurant: "RESTAURANT" } });
check(() => assert.equal(projected[0].resolution, "SHARED"));
check(() => assert.equal(projected[0].evidenceLevel, "CANONICAL_SHARED"));
check(() => assert.equal(projected[1].personStates[personB], "UNKNOWN"));
check(() => assert.equal(projected[1].resolution, "UNRESOLVED"));
check(() => assert.deepEqual(a.projectGlobalSharedActivitiesFromFacts({ occurrences: [fact("life:2", [personA]), fact("life:1", [personA, personB])], personIds: [personA, personB], activityTypeByActivityId: { repas_restaurant: "RESTAURANT" } }).map((row) => row.inputHash), projected.map((row) => row.inputHash)));

// External participants and Contact gates remain separate.
const externals = resolver.resolve(base({ roster: { participantPersonIds: [personA, personB], completeness: "EXHAUSTIVE", externalParticipants: [{ kind: "CANONICAL_CONTACT", ref: "contact:1" }, { kind: "UNRESOLVED_EXTERNAL", ref: "external:1" }], evidenceRefs: ["roster"] } }));
check(() => assert.equal(externals.exclusivity, "WITH_EXTERNALS"));
check(() => assert.equal(externals.unresolvedExternalParticipantCount, 1));
const social = a.buildGlobalSocialContextSummary([{ occurrenceId: "social:1", resolvedInternalParticipantIds: [personA, personB], knownExternalContactIds: ["contact:1"], unresolvedExternalParticipantCount: 1, rosterCompleteness: "EXHAUSTIVE", evidenceRefs: ["social:1"] }, { occurrenceId: "social:2", resolvedInternalParticipantIds: [personA], knownExternalContactIds: [], unresolvedExternalParticipantCount: 0, rosterCompleteness: "POSITIVE_ONLY", evidenceRefs: ["social:2"] }]);
check(() => assert.equal(social.participantCoverage, 1));
check(() => assert.equal(social.contactIdentityCoverage, 0.5));
check(() => assert.equal(social.contactCapabilities, "AUTHORITY_GATED"));
check(() => assert.ok(social.unavailableCapabilities.includes("RELATIONSHIP_SCORE")));
check(() => assert.ok(social.unavailableCapabilities.includes("COST_PER_CONTACT")));

// Dependency closure is explicit and pair-scoped; no Couple PersonId exists.
const declaration = a.createGlobalM10DependencyDeclaration([personA, personB]);
check(() => assert.equal(declaration.resourceId, "global-v2:m10-shared-participation"));
check(() => assert.equal(declaration.personScope.kind, "COMPARABLE_PERSONS"));
check(() => assert.equal(declaration.factDependencies.some(({ id }) => id === "fct_economic_component"), true));
check(() => assert.equal(declaration.entityDependencies.some(({ id }) => id === "contacts" && id), true));
check(() => assert.equal(declaration.upstreamAnalytics.some(({ id }) => id === "global-v2:m9-persona"), false));
check(() => assert.equal(a.globalSharedInferenceCatalog.COPRESENCE_ALLOWED.length, 14));
check(() => assert.equal(a.globalSharedInferenceCatalog.EXPLICIT_ONLY.length, 12));
const downstream = a.recertifyGlobalSharedDownstreamClosure();
check(() => assert.deepEqual(Object.values(downstream), ["NO_DECLARED_INPUT_EDGE", "NO_DECLARED_INPUT_EDGE", "NO_DECLARED_INPUT_EDGE", "NO_DECLARED_INPUT_EDGE"]));
check(() => assert.equal(a.globalM10CapabilityStates.sharedRoutine, "DATA_GATED"));
check(() => assert.equal(a.globalM10CapabilityStates.sharedMobilityLeg, "AUTHORITY_GATED"));
check(() => assert.equal(a.globalM10CapabilityStates.socialGraph, "FORBIDDEN"));

console.log(`Global V2 shared participation checks: ${checks}/${checks} passed.`);
