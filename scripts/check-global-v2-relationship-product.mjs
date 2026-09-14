import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const path of [`${specifier}.ts`, `${specifier}/index.ts`]) { try { return next(path, context); } catch {} }
    throw error;
  }
} });

const {
  GLOBAL_M5_PR03_GATE_ORDER,
  GLOBAL_M5_PR03_PRODUCT_UNIVERSE,
  buildGlobalM5Pr03Product,
  buildGlobalM5Pr03ProductPlan,
} = await import("../src/analytics/global-v2/relationship-product.ts");

const adrien = "1778a648-dfa9-5172-9474-1cb9bac32cc6";
const manon = "e44e806e-703c-5f29-bdd1-7861ebfd9bc3";
const personIds = [adrien, manon];
const coverage = { dimensions: [{ dimension: "PERSON_DAY", status: "KNOWN", numerator: 1, denominator: 1, ratio: 1, unit: "PERSON_DAY", basis: "fixture-authority", evidenceRefs: ["fact:person-day"], policyRef: "fixture@v1" }], requiredDimensions: ["PERSON_DAY"], effective: 1, aggregation: "MIN_REQUIRED_DIMENSIONS" };

function analysis(personId, mode = "POSITIVE", reverse = false) {
  const regimeId = `regime:${personId}`;
  const days = [];
  const outcomes = [];
  for (let month = 1; month <= 12; month++) {
    const prefix = `2025-${String(month).padStart(2, "0")}`;
    for (let pair = 1; pair <= 3; pair++) {
      for (const [role, dayNumber] of [["ONSITE", pair], ["REMOTE", pair + 7]]) {
        const id = `${personId}:${prefix}:${dayNumber}`;
        const day = { id, date: `${prefix}-${String(dayNumber).padStart(2, "0")}`, context: role, calendarClass: "WEEKDAY", householdId: "household", personId, regimeId, personDayObservable: true, contextEvidenceRefs: ["authority:work-context"], calendarEvidenceRefs: ["authority:calendar"], evidenceRefs: ["fact:person-day"], excludedReasons: [] };
        const positive = Number(role === "ONSITE"), negative = Number(role === "REMOTE");
        const value = mode === "NEUTRAL" ? 0
          : mode === "POSITIVE" ? positive
          : mode === "NEGATIVE" ? negative
          : mode === "RECENT_ONLY" ? month <= 6 ? 0 : positive
          : mode === "CHANGED" ? month <= 6 ? positive : negative
          : mode === "HISTORICAL_ONLY" ? month <= 6 ? positive : month === 7 && pair === 1 ? positive : 0
          : 0;
        days.push(day);
        outcomes.push({ dayId: id, outcome: "RESTAURANT", value, status: "KNOWN", authority: "ACTIVITY_OCCURRENCE", coverage, evidenceRefs: ["authority:restaurant"], dependencyRefs: ["authority:restaurant"] });
      }
    }
  }
  const normalizedDays = reverse ? [...days].reverse() : days;
  const normalizedOutcomes = reverse ? [...outcomes].reverse() : outcomes;
  return { householdId: "household", personId, regimeId, householdTimeZone: "Europe/Paris", asOf: "2026-01-01T00:00:00Z", certifiedThrough: "2025-12-31", analyticsRevision: 7, sourceRevision: 11, days: normalizedDays, outcomes: normalizedOutcomes, dependencyDigests: { "authority:work-context": "digest:work", "authority:calendar": "digest:calendar", "fact:person-day": "digest:day", "authority:restaurant": "digest:restaurant", [regimeId]: `digest:${regimeId}` } };
}

const gated = (personId) => ({ evaluationStatus: "AUTHORITY_GATED", scope: { personId }, reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"] });
const ready = (personId, mode = "POSITIVE", reverse = false) => ({ evaluationStatus: "READY_FOR_PRODUCT", scope: { personId }, reasonCodes: [], analysis: analysis(personId, mode, reverse), missingPersonDayDates: [], exceptionPolicy: "NOT_USED_V1", seasonPolicy: "NOT_REQUIRED" });

let checks = 0;
const check = (fn) => { fn(); checks++; };
const plan = buildGlobalM5Pr03ProductPlan({ authorizedPersonIds: [manon, adrien], displayNamesByPersonId: { [adrien]: "Adrien", [manon]: "Manon" } });
check(() => assert.deepEqual(plan.hypotheses.map(({ id }) => id), [`onsite-restaurant:person:${adrien}`, `onsite-restaurant:person:${manon}`]));
check(() => assert.equal(plan.universeId, "m5-v1-pr03-person"));
check(() => assert.equal(plan.familyId, "PR03_PERSON"));
check(() => assert.equal(plan.version, "m5-product-fdr-pr03-person@v1"));
// The audit report exposes its digest but not the byte-exact canonical payload.
// Lock the generic implementation payload here rather than importing fixture
// UUIDs or a reported digest into product logic.
check(() => assert.equal(plan.planDigest, "73f7bf5528b0f2444b16af3bdbf92b74d7f79e7a137f5e9fd3eac2a59f4a7cec"));
check(() => assert.deepEqual(GLOBAL_M5_PR03_GATE_ORDER, ["G0_PRODUCT_MEMBERSHIP", "G1_AUTHORIZED_PERSON", "G2_CURRENT_REGIME_D2", "G3_WORK_CONTEXT_AUTHORITY", "G4_RESTAURANT_OUTCOME_AUTHORITY_AND_COVERAGE", "G5_CALENDAR_AUTHORITY", "G6_E1_EXCEPTION_AND_SEASON_POLICY", "G7_MATCHING", "G8_SUPPORT_15_MATCHED_PAIRS", "G9_RAW_STATISTIC_RAW_P", "G10_BH"]));
check(() => assert.equal(GLOBAL_M5_PR03_PRODUCT_UNIVERSE.canonicalDirection, "ONSITE_MINUS_REMOTE"));

// E-T19: gated hypotheses remain in each closed family without pseudo-p/q.
const bothGated = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: personIds.map(gated) });
for (const window of bothGated.windows) {
  check(() => assert.equal(window.expectedHypothesisCount, 2));
  check(() => assert.equal(window.eligibleHypothesisCount, 0));
  check(() => assert.equal(window.fdr.exclusions.length, 2));
  check(() => assert.ok(window.hypotheses.every((hypothesis) => !("rawPValue" in hypothesis) && !("qValue" in hypothesis))));
}
check(() => assert.ok(bothGated.ownerResults.every((result) => result.evaluationStatus === "AUTHORITY_GATED" && result.insights.length === 0)));
check(() => assert.deepEqual(bothGated.relationshipEvolution, []));

// E-T20: one eligible person closes m=1; q is derived from that raw p.
const oneEligible = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [ready(adrien), gated(manon)] });
for (const window of oneEligible.windows) {
  const hypothesis = window.hypotheses.find((entry) => entry.personId === adrien);
  check(() => assert.equal(window.eligibleHypothesisCount, 1));
  check(() => assert.equal(hypothesis.qValue, hypothesis.rawPValue));
}
const oneEligibleOwner = oneEligible.ownerResults.find((entry) => entry.scope.personId === adrien);
const oneEligibleInsight = oneEligibleOwner.insights.find((entry) => entry.relationshipId === "onsite-restaurant");
check(() => assert.equal(oneEligibleOwner.evaluationStatus, "EVALUATED"));
check(() => assert.equal(oneEligibleInsight.evidence.adjustedQValue, oneEligible.current.hypotheses.find((entry) => entry.personId === adrien).qValue));
check(() => assert.equal(oneEligibleInsight.evidence.evidenceStatus, "PUBLISHED"));
check(() => assert.equal(oneEligibleInsight.access.aiEligible, true));
check(() => assert.deepEqual(oneEligible.relationshipEvolution, []));

// E-T21..E-T28: one cross-person closure per window, no preselection by
// materiality/significance, locked technical execution and canonical sign.
const bothEligible = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [ready(adrien, "NEUTRAL"), ready(manon, "POSITIVE")] });
for (const window of bothEligible.windows) {
  const neutral = window.hypotheses.find((entry) => entry.personId === adrien);
  const positive = window.hypotheses.find((entry) => entry.personId === manon);
  check(() => assert.equal(window.eligibleHypothesisCount, 2));
  check(() => assert.equal(window.fdr.tests.length, 2));
  check(() => assert.equal(neutral.materiality.status, "NOT_MATERIAL"));
  check(() => assert.equal(neutral.rawPValue, 1));
  check(() => assert.equal(neutral.qValue, 1));
  check(() => assert.ok(positive.effect.absoluteEffect > 0));
  check(() => assert.deepEqual(window.executedTechnicalDefinitionIds, ["onsite-restaurant"]));
  check(() => assert.ok(window.hypotheses.every((entry) => entry.executedTechnicalDefinitionIds.every((id) => id === "onsite-restaurant"))));
}
check(() => assert.equal(new Set(bothEligible.windows.map(({ fdr }) => fdr.universeId)).size, 3));
const crossPersonInsight = bothEligible.ownerResults.find((entry) => entry.scope.personId === manon).insights.find((entry) => entry.relationshipId === "onsite-restaurant");
check(() => assert.equal(crossPersonInsight.evidence.adjustedQValue, bothEligible.current.hypotheses.find((entry) => entry.personId === manon).qValue));
check(() => assert.equal(crossPersonInsight.evidence.rawPValue, bothEligible.current.hypotheses.find((entry) => entry.personId === manon).rawPValue));

const recentOnly = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [ready(adrien, "RECENT_ONLY"), gated(manon)] });
check(() => assert.equal(recentOnly.ownerResults.find((entry) => entry.scope.personId === adrien).relationships[0].state, "RECENT_ONLY"));
check(() => assert.deepEqual(recentOnly.relationshipEvolution, []));
const changed = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [ready(adrien, "CHANGED"), gated(manon)] });
check(() => assert.equal(changed.ownerResults.find((entry) => entry.scope.personId === adrien).relationships[0].state, "CHANGED_RELATIONSHIP"));
check(() => assert.deepEqual(changed.relationshipEvolution.map(({ relationshipId, state }) => ({ relationshipId, state })), [{ relationshipId: "onsite-restaurant", state: "CHANGED_RELATIONSHIP" }]));
const historical = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [ready(adrien, "HISTORICAL_ONLY"), gated(manon)] });
check(() => assert.equal(historical.ownerResults.find((entry) => entry.scope.personId === adrien).relationships[0].state, "HISTORICAL_ONLY"));
check(() => assert.deepEqual(historical.relationshipEvolution.map(({ relationshipId, state }) => ({ relationshipId, state })), [{ relationshipId: "onsite-restaurant", state: "HISTORICAL_ONLY" }]));

const negative = buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [ready(adrien, "NEGATIVE"), gated(manon)] });
check(() => assert.ok(negative.current.hypotheses.find((entry) => entry.personId === adrien).effect.absoluteEffect < 0));

const reordered = buildGlobalM5Pr03Product({ authorizedPersonIds: [manon, adrien], providers: [ready(manon, "POSITIVE", true), ready(adrien, "NEUTRAL", true)] });
check(() => assert.deepEqual(reordered, bothEligible));
check(() => assert.throws(() => buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [gated(adrien)] }), /INCOMPLETE_PERSON_CLOSURE/));
check(() => assert.throws(() => buildGlobalM5Pr03Product({ authorizedPersonIds: personIds, providers: [gated(adrien), gated("other")] }), /UNAUTHORIZED_PERSON_PROVIDER/));
check(() => assert.equal(bothEligible.liveWrites, "NONE"));

console.log(`RUN E locked PR-03 product / cross-person per-window FDR: PASS ${checks}/${checks}. planDigest=${plan.planDigest}`);
