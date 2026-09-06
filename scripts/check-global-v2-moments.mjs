import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const path of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(path, context); } catch { /* next */ }
    throw error;
  }
} });

const {
  assertGlobalMomentCatalogExhaustive,
  buildGlobalMomentExperiences,
  createGlobalM6DependencyDeclaration,
  momentComparisonCatalogV1,
  momentComparisonProfiles,
} = await import("../src/analytics/global-v2/index.ts");
const { assertGlobalDependencyClosure } = await import("../src/core/global-v2/index.ts");
const { parseMoney } = await import("../src/core/money/index.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), p1 = uuid(2), p2 = uuid(3);
const knownFacet = (value, ref = value) => ({ status: "KNOWN", value, evidenceRefs: [`facet:${ref}`] });
const moment = (id, type = "Week-end / escapade", extra = {}) => ({
  momentId: `moment:${id}`, householdId,
  type: { status: "KNOWN", value: type, evidenceRefs: [`moment:${id}:type`] },
  startDate: "2026-01-10", endDate: "2026-01-12", temporalPrecision: "DAY",
  householdParticipantIds: [p1, p2], externalParticipantIds: [], participationEvidenceRefs: [`moment:${id}:participant:${p1}`, `moment:${id}:participant:${p2}`],
  facets: { LODGING_MODE: knownFacet("PAID_LODGING", `${id}:lodging`), GEOGRAPHIC_SCOPE: knownFacet("DOMESTIC_AWAY", `${id}:geo`) },
  expectedCausalComponentKeys: [`component:${id}`], lifeEventIds: [`life:${id}`], activityCount: 1,
  ...extra,
});
const fact = (id, amount, momentId = `moment:${id}`, date = "2026-01-11", extra = {}) => ({
  fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris", canonicalComponentKey: `component:${id}`,
  sourceOperation: { kind: "resolved", id: uuid(1000 + Number(String(id).replace(/\D/g, "") || 0)) },
  gross: parseMoney(String(amount)), refundApplied: parseMoney("0"), net: parseMoney(String(amount)),
  bankDate: { kind: "known", date },
  economicTiming: { kind: "known", segments: [{ segmentKey: `segment:${id}`, timingState: "known", periodStart: date, periodEnd: date, economicMonth: date.slice(0, 7), amount: parseMoney(String(amount)) }] },
  person: { kind: "unknown" }, category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: { kind: "unknown" },
  moment: momentId === undefined ? { kind: "unknown" } : { kind: "resolved", id: momentId }, canonicalPlace: { kind: "unknown" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
  ...extra,
});
const deps = (moments, facts) => Object.fromEntries([
  ...moments.flatMap((m) => [
    [`moment:${m.momentId}`, `digest:${m.momentId}`],
    ...(m.type.status === "KNOWN" ? m.type.evidenceRefs.map((ref) => [ref, `digest:${ref}`]) : []),
    ...m.participationEvidenceRefs.map((ref) => [ref, `digest:${ref}`]),
    ...Object.values(m.facets ?? {}).flatMap((facet) => (facet?.evidenceRefs ?? []).map((ref) => [ref, `digest:${ref}`])),
    ...[m.declaredImportance, m.transformationAnchor, m.routineRepresentative].flatMap((proof) => (proof?.evidenceRefs ?? []).map((ref) => [ref, `digest:${ref}`])),
  ]),
  ...facts.map((f) => [`economic-component:${f.canonicalComponentKey}`, `digest:${f.canonicalComponentKey}`]),
  ...facts.flatMap((f) => f.moment.kind === "resolved" ? [[`financial_economic_cost_canonical:${f.canonicalComponentKey}:moment_id:${f.moment.id}`, `digest:relation:${f.canonicalComponentKey}`]] : []),
]);
const build = (moments, facts, extra = {}) => {
  const dependencyDigests = { ...deps(moments, facts), ...Object.fromEntries([
    ...(extra.financialRelations ?? []).flatMap((relation) => (relation.evidenceRefs ?? []).map((ref) => [ref, `digest:${ref}`])),
    ...(extra.componentAuthorities ?? []).flatMap((authority) => authority.evidenceRefs.map((ref) => [ref, `digest:${ref}`])),
    ...(extra.unitCostAuthorities ?? []).flatMap((authority) => authority.evidenceRefs.map((ref) => [ref, `digest:${ref}`])),
  ]) };
  return buildGlobalMomentExperiences({ householdId, householdMemberIds: [p1, p2], moments, economicFacts: facts, dependencyDigests, ...extra });
};
const cohort = (peerCount, subjectAmount = 100) => {
  const moments = [moment("0", "Week-end / escapade", { declaredImportance: { value: true, evidenceRefs: ["declared:0"] } }), ...Array.from({ length: peerCount }, (_, i) => moment(String(i + 1)))];
  const facts = [fact("0", subjectAmount), ...Array.from({ length: peerCount }, (_, i) => fact(String(i + 1), 200 + i * 10))];
  return build(moments, facts);
};

check(() => assert.doesNotThrow(assertGlobalMomentCatalogExhaustive));
check(() => assert.equal(Object.keys(momentComparisonCatalogV1).length, 20));
check(() => assert.equal(new Set(Object.values(momentComparisonCatalogV1).map((entry) => entry.normalizedKey)).size, 20));
check(() => assert.equal(momentComparisonProfiles.OTHER_MOMENT.comparisonLadder.length, 0));
check(() => assert.equal(momentComparisonProfiles.PROJECT_MILESTONE.comparisonLadder.includes("SAME_FAMILY"), false));
check(() => assert.equal(momentComparisonProfiles.TRAVEL_AND_STAY.requiredFacets.includes("DURATION_BAND"), true));
check(() => assert.equal(momentComparisonProfiles.TRAVEL_AND_STAY.requiredFacets.includes("LODGING_MODE"), true));
check(() => assert.equal(momentComparisonProfiles.CELEBRATION.requiredFacets.includes("ORGANIZER_ROLE"), true));
check(() => assert.equal(momentComparisonProfiles.TRAVEL_AND_STAY.allowGenericCostPerParticipant, false));

for (const [n, status] of [[2, "INSUFFICIENT"], [3, "PARTIAL_SUPPORT"], [5, "SUFFICIENT"], [8, "STRONG"]]) {
  const result = cohort(n);
  const comparison = result.comparisons.find(({ momentId }) => momentId === "moment:0");
  check(() => assert.equal(comparison.support.supportStatus, status));
  check(() => assert.equal(comparison.peerCount, n));
  check(() => assert.equal(comparison.peerIds.includes("moment:0"), false));
}

const seriesMoments = [moment("s", undefined, { seriesId: "series:1" }), ...Array.from({ length: 3 }, (_, i) => moment(`s${i}`, undefined, { seriesId: "series:1" })), ...Array.from({ length: 5 }, (_, i) => moment(`t${i}`))];
const seriesFacts = seriesMoments.map((m, i) => fact(m.momentId.slice(7), 100 + i));
const seriesResult = build(seriesMoments, seriesFacts);
check(() => assert.equal(seriesResult.comparisons.find(({ momentId }) => momentId === "moment:s").comparisonTier, "SAME_TYPE"));
check(() => assert.equal(seriesResult.comparisons.find(({ momentId }) => momentId === "moment:s").peerCount, 8));

const conflictMoments = [moment("a", "Voyage", { seriesId: "series:x" }), moment("b", "Soirée", { seriesId: "series:x", expectedCausalComponentKeys: ["component:b"] })];
const conflict = build(conflictMoments, [fact("a", 10), fact("b", 10)]);
check(() => assert.equal(conflict.comparisons[0].status, "CONFLICT"));
check(() => assert.equal(conflict.comparisons[1].status, "CONFLICT"));
const unknownType = build([moment("u", "Voyage", { type: { status: "UNKNOWN" } })], [fact("u", 10)]);
check(() => assert.equal(unknownType.comparisons[0].status, "NOT_APPLICABLE"));

const incompatibleDuration = [moment("short"), ...Array.from({ length: 5 }, (_, i) => moment(`long${i}`, undefined, { endDate: "2026-01-23" }))];
const incompatibleDurationResult = build(incompatibleDuration, incompatibleDuration.map((m, i) => fact(m.momentId.slice(7), 100 + i)));
check(() => assert.equal(incompatibleDurationResult.comparisons.find(({ momentId }) => momentId === "moment:short").status, "UNKNOWN"));
const incompatibleLodging = [moment("hotel"), ...Array.from({ length: 5 }, (_, i) => moment(`hosted${i}`, undefined, { facets: { LODGING_MODE: knownFacet("HOSTED_FREE", `${i}:hosted`) } }))];
const incompatibleLodgingResult = build(incompatibleLodging, incompatibleLodging.map((m, i) => fact(m.momentId.slice(7), 100 + i)));
check(() => assert.equal(incompatibleLodgingResult.comparisons.find(({ momentId }) => momentId === "moment:hotel").status, "UNKNOWN"));
const missingLodging = build([moment("missing", undefined, { facets: {} })], [fact("missing", 10)]);
check(() => assert.equal(missingLodging.comparisons[0].status, "UNKNOWN"));
check(() => assert.ok(missingLodging.comparisons[0].reasonCodes.includes("REQUIRED_FACET_UNRESOLVED:LODGING_MODE")));

const causalMoment = moment("causal", "Voyage", { expectedCausalComponentKeys: ["component:before", "component:during"] });
const before = fact("before", 80, "moment:causal", "2026-01-01", { gross: parseMoney("100"), refundApplied: parseMoney("20"), net: parseMoney("80") });
const during = fact("during", 40, "moment:causal", "2026-01-12");
const concomitant = fact("concomitant", 30, undefined, "2026-01-11");
const costResult = build([causalMoment], [before, during, concomitant], { componentAuthorities: [
  { componentKey: "component:before", momentId: "moment:causal", causalRole: "CORE_EXPERIENCE", compositionGroup: "TRANSPORT", paymentDate: "2026-01-01", evidenceRefs: ["canonical:before"] },
  { componentKey: "component:during", momentId: "moment:causal", causalRole: "CORE_EXPERIENCE", compositionGroup: "ACTIVITIES", paymentDate: "2026-01-12", evidenceRefs: ["canonical:during"] },
] });
const cost = costResult.summaries[0];
check(() => assert.equal(cost.causalCost.value, "120"));
check(() => assert.equal(cost.grossCausalOutflow.value, "140"));
check(() => assert.equal(cost.refundsAndAdjustments.value, "20"));
check(() => assert.equal(cost.spentDuring.value, "70"));
check(() => assert.equal(cost.spentDuring.status, "KNOWN"));
check(() => assert.equal(cost.paymentTimeline.find(({ paymentPhase }) => paymentPhase === "PAID_BEFORE").amount, "100"));
check(() => assert.equal(cost.paymentTimeline.find(({ paymentPhase }) => paymentPhase === "PAID_DURING").amount, "40"));
check(() => assert.equal(cost.paymentTimeline.find(({ paymentPhase }) => paymentPhase === "UNKNOWN_PAYMENT_PHASE").amount, "-20"));
check(() => assert.equal(cost.causalRoles.find(({ role }) => role === "CORE_EXPERIENCE").amount, "120"));
check(() => assert.equal(cost.composition.reduce((sum, entry) => sum + Number(entry.amount), 0), 120));
check(() => assert.equal(cost.costPerExperienceDay.value, "40"));
check(() => assert.equal(cost.genericCostPerParticipant.status, "NOT_APPLICABLE"));
const attributedFact = fact("attributed", 70, "moment:attributed", "2026-01-11", { person: { kind: "resolved", id: p1, attribution: "explicit_beneficiary", evidenceRefs: ["beneficiary:p1"] } });
const attributedMoment = moment("attributed", "Concert / spectacle", { startDate: "2026-01-11", endDate: "2026-01-11", temporalPrecision: "INSTANT" });
const attributed = build([attributedMoment], [attributedFact], { unitCostAuthorities: [{ momentId: "moment:attributed", componentKey: "component:attributed", unitAmount: parseMoney("35"), quantity: 2, beneficiaryIds: [p1, p2], evidenceRefs: ["item:ticket:quantity"] }] }).summaries[0];
check(() => assert.deepEqual(attributed.attributedCostByPerson.map(({ personId, amount }) => [personId, amount]), [[p1, "70"]]));
check(() => assert.equal(attributed.naturallyUnitPricedCosts[0].unitAmount, "35"));
check(() => assert.throws(() => build([attributedMoment], [attributedFact], { unitCostAuthorities: [{ momentId: "moment:attributed", componentKey: "component:attributed", unitAmount: parseMoney("35"), quantity: 2, beneficiaryIds: [p1], evidenceRefs: ["item:bad"] }] }), /NATURAL_UNIT/));

const unassigned = fact("unassigned", 50, undefined, "2026-01-11", { economicTiming: { kind: "unknown" } });
const partialSpent = build([causalMoment], [before, during, concomitant, unassigned], { componentAuthorities: [] }).summaries[0].spentDuring;
check(() => assert.equal(partialSpent.status, "PARTIAL"));
check(() => assert.equal(partialSpent.value, "70"));
const punctual = moment("point", "Concert / spectacle", { startDate: "2026-01-11", endDate: "2026-01-11", expectedCausalComponentKeys: ["component:point"] });
check(() => assert.equal(build([punctual], [fact("point", 20)]).summaries[0].spentDuring.status, "NOT_APPLICABLE"));
check(() => assert.equal(build([{ ...punctual, temporalPrecision: "INSTANT", startTime: "20:00", endTime: "23:00" }], [fact("point", 20)]).summaries[0].spentDuring.status, "UNKNOWN"));
const freeKnown = moment("free", "Visite familiale", { expectedCausalComponentKeys: [], facets: { LODGING_MODE: knownFacet("HOSTED_FREE", "free:lodging") } });
check(() => assert.equal(build([freeKnown], []).summaries[0].causalCost.value, "0"));
const { expectedCausalComponentKeys: _expected, ...freeUnknown } = moment("free-unknown", "Visite familiale", { facets: { LODGING_MODE: knownFacet("HOSTED_FREE", "free-unknown:lodging") } });
check(() => assert.equal(build([freeUnknown], []).summaries[0].causalCost.status, "UNKNOWN"));

const multiRelations = [
  { householdId, momentId: "moment:m1", componentKey: "component:shared", kind: "CAUSAL", authority: "EXPLICIT_CANONICAL_CAUSAL_LINK", evidenceRefs: ["allocation:1"], amount: parseMoney("20"), sourceEconomicAmount: parseMoney("60") },
  { householdId, momentId: "moment:m2", componentKey: "component:shared", kind: "CAUSAL", authority: "EXPLICIT_CANONICAL_CAUSAL_LINK", evidenceRefs: ["allocation:2"], amount: parseMoney("40"), sourceEconomicAmount: parseMoney("60") },
];
const sharedFact = fact("shared", 60, undefined);
const multiMoments = [moment("m1", "Soirée", { expectedCausalComponentKeys: ["component:shared"], startDate: "2026-01-11", endDate: "2026-01-11", temporalPrecision: "INSTANT" }), moment("m2", "Soirée", { expectedCausalComponentKeys: ["component:shared"], startDate: "2026-01-11", endDate: "2026-01-11", temporalPrecision: "INSTANT" })];
const multi = build(multiMoments, [sharedFact], { financialRelations: multiRelations });
check(() => assert.equal(multi.summaries[0].causalCost.value, "20"));
check(() => assert.equal(multi.summaries[1].causalCost.value, "40"));
check(() => assert.equal(Number(multi.summaries[0].causalCost.value) + Number(multi.summaries[1].causalCost.value), 60));
check(() => assert.equal(build(multiMoments, [sharedFact], { financialRelations: multiRelations.map((relation) => ({ ...relation, amount: parseMoney("60") })) }).summaries[0].causalCost.status, "CONFLICT"));

const lowCost = cohort(5, 100);
check(() => assert.ok(lowCost.comparisons[0].narrativeFlags.includes("RELATIVELY_LOW_COST")));
check(() => assert.equal(lowCost.comparisons[0].primaryDrivers.reduce((sum, entry) => sum + Number(entry.delta), 0), Number(lowCost.comparisons[0].absoluteDelta)));
check(() => assert.equal(lowCost.narrative[0].eligible, true));
check(() => assert.equal(lowCost.narrative[0].costUsedAsPositiveImportanceSignal, false));
const expensiveBanalMoments = [moment("expensive"), ...Array.from({ length: 5 }, (_, i) => moment(`plain${i}`))];
const expensiveBanal = build(expensiveBanalMoments, [fact("expensive", 1000), ...Array.from({ length: 5 }, (_, i) => fact(`plain${i}`, 100))]);
check(() => assert.equal(expensiveBanal.narrative[0].eligible, true)); // composed LifeEvent/activity is a non-cost signal
const noNarrative = moment("empty", undefined, { lifeEventIds: [], activityCount: 0, householdParticipantIds: [p1], participationEvidenceRefs: [`moment:empty:participant:${p1}`] });
check(() => assert.equal(build([noNarrative], [fact("empty", 1000)]).narrative[0].eligible, false));

check(() => assert.equal(lowCost.series.length, 0));
const repeated = build([moment("r1", undefined, { seriesId: "series:r" }), moment("r2", undefined, { seriesId: "series:r" }), moment("r3", undefined, { seriesId: "series:r" })], [fact("r1", 10), fact("r2", 20), fact("r3", 30)]);
check(() => assert.equal(repeated.series[0].occurrenceCount, 3));
check(() => assert.equal(repeated.series[0].medianCausalCost, "20"));
check(() => assert.equal(repeated.series[0].transformationInputEligible, true));
check(() => assert.equal(repeated.crossModuleSignals.replayOwner, "P08"));
check(() => assert.equal(repeated.crossModuleSignals.replayExecuted, false));

check(() => assert.equal(cohort(5).inputHash, build([...cohort(5).summaries].map(({ moment }) => moment).reverse(), [...Array.from({ length: 6 }, (_, i) => fact(String(i), i === 0 ? 100 : 200 + (i - 1) * 10))].reverse()).inputHash));
check(() => assert.notEqual(build([moment("hash")], [fact("hash", 10)]).inputHash, build([moment("hash")], [fact("hash", 11)]).inputHash));
check(() => assert.throws(() => build([moment("missing-dep")], [fact("missing-dep", 1)], { dependencyDigests: {} }), /DEPENDENCY_CLOSURE_MISSING/));
check(() => assert.throws(() => build([moment("dup"), { ...moment("dup"), activityCount: 2 }], [fact("dup", 1)]), /CONTRADICTORY_MOMENT/));

const declaration = createGlobalM6DependencyDeclaration({ personScope: { kind: "HOUSEHOLD" }, authorizedPersonIds: [p1, p2], momentIds: ["moment:1"] });
check(() => assert.doesNotThrow(() => assertGlobalDependencyClosure(declaration, { factDependencyIds: ["fct_economic_component", "fct_activity_occurrence_cost"], entityDependencyIds: ["moments", "moment_life_events", "life_event_participations"], upstreamAnalyticsIds: ["history_shared_doctrines"], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["global-moment-certified-cohort", "global-moment-peer-support", "global-moment-metadata-participant-financial", "global-materiality-moment-family", "comparisonCatalog", "peerSupport", "causalCost", "spentDuring", "paymentTimeline", "momentComposition", "narrativeImportance", "robustStatistics"] })));
check(() => assert.throws(() => assertGlobalDependencyClosure(declaration, { factDependencyIds: ["undeclared"], entityDependencyIds: [], upstreamAnalyticsIds: [], otherModuleDependencyIds: [], policyIds: [] }), /missing consumed/));

const index = JSON.parse(fs.readFileSync(new URL("../docs/global-v2/GLOBAL_MASTER_INDEX.json", import.meta.url), "utf8"));
const p07Requirements = index.requirements.filter(({ owner }) => owner === "P07").map(({ id }) => id).sort();
const mapped = Array.from({ length: 135 }, (_, i) => i + 1).filter((id) => id !== 41 && id !== 81).map((id) => `GLO-M06-${String(id).padStart(3, "0")}`).sort();
check(() => assert.equal(p07Requirements.length, 133));
check(() => assert.deepEqual(p07Requirements, mapped));

console.log(`P07 M6 Moments/experiences: ${checks}/${checks} PASS`);
