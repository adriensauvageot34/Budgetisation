import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalTimeWindowPolicy, type GlobalValueProvenance, type NormalizedGlobalAnalysisScopeV2 } from "../../core/global-v2";
import { parseLocalDate } from "../../core/time";
import { GlobalTemporalBoundaryResolver, type GlobalTemporalUnitCandidate } from "./temporal-boundary";
import { buildGlobalDailyRelationships } from "./relationships";
import { classifyRelationshipTemporalWindows, type RelationshipTemporalWindowEvidence } from "./relationship-evidence";
import { relationshipAccessPolicy } from "./relationship-access";
import { dailyRelationshipCatalog } from "./relationship-catalog";
import { relationshipDayGroup } from "./relationship-comparators";
import { weeklyRelationshipCatalog } from "./relationship-weekly";
import { buildRelationshipInsights } from "./relationship-insight";

type DailyInput = Parameters<typeof buildGlobalDailyRelationships>[0];
type DailyResult = ReturnType<typeof buildGlobalDailyRelationships>;
const hash = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/** Recompute matching, support, effects, tests, full FDR and LOMO independently
 * in each window. No monthly result/average is used as an analytical input.
 * Explicit temporal candidates carry observable gaps; absent days are not zeros.
 */
export function buildGlobalRelationshipTemporalEvidence(input: {
  readonly analysis: DailyInput;
  readonly scope: NormalizedGlobalAnalysisScopeV2;
  readonly certifiedProvenance: GlobalValueProvenance;
  readonly candidates: readonly GlobalTemporalUnitCandidate[];
}) {
  const { analysis, scope } = input;
  if (scope.time.asOf !== analysis.asOf || scope.time.certifiedThrough !== analysis.certifiedThrough) throw new TypeError("M5_TEMPORAL_SCOPE_MISMATCH");
  if (scope.subject.kind !== "person" || String(scope.subject.personId) !== analysis.personId) throw new TypeError("M5_PERSON_SCOPE_REQUIRED_NO_HOUSEHOLD_POOLING");
  if (Object.values(scope.filters).some((values) => values.length > 0)) throw new TypeError("M5_FILTER_PROVIDER_NOT_RESOLVED");
  if (String(input.certifiedProvenance.dataRevision) !== String(analysis.sourceRevision) || String(input.certifiedProvenance.analyticsRevision) !== String(analysis.analyticsRevision)) throw new TypeError("M5_PROVENANCE_REVISION_MISMATCH");
  const days = new Map(analysis.days.map((day) => [day.id, day]));
  for (const candidate of input.candidates) {
    if (candidate.start !== candidate.end) throw new TypeError("M5_PERSON_DAY_TEMPORAL_GRAIN");
    if (candidate.authority === "CERTIFIED_HISTORY" && candidate.end <= scope.time.certifiedThrough) {
      for (const ref of candidate.dependencyRefs) if (!analysis.dependencyDigests[ref]) throw new TypeError(`M5_TEMPORAL_DEPENDENCY_MISSING:${ref}`);
      const day = days.get(candidate.unitId);
      if (candidate.observed && (!day || day.date !== candidate.start || day.personId !== analysis.personId || day.householdId !== analysis.householdId || day.regimeId !== analysis.regimeId)) throw new TypeError("M5_TEMPORAL_FACT_MISMATCH");
    }
  }
  const resolution = new GlobalTemporalBoundaryResolver().resolve({
    scope,
    policy: parseGlobalTimeWindowPolicy({ policyId: "relationship-comparable-certified-window", policyVersion: "v1", naturalGrain: "PERSON_DAY", corpus: "CERTIFIED_HISTORY", lookback: { kind: "ALL_RELIABLE" }, gapPolicy: "PRESERVE", comparableIntersection: "EXACT_NATURAL_UNIT" }),
    // This is exposure support, not the separate 15 matched-pair test.
    supportPolicy: { policyRef: "relationship-observable-unit@v1", minimumRequired: 1, strongAt: 1 },
    candidates: input.candidates,
    certifiedProvenance: input.certifiedProvenance,
  });
  const retained = new Set(resolution.certifiedUnitIds);
  const resolvedDays = analysis.days.filter((day) => retained.has(day.id));
  const months = [...new Set(resolvedDays.map((day) => day.date.slice(0, 7)))].sort();
  const recentMonths = months.slice(-6), previousMonths = months.slice(-12, -6);
  const eligibleMonthsByDefinition = Object.fromEntries(dailyRelationshipCatalog.map((definition) => [definition.id, [...new Set(resolvedDays.filter((day) => {
    const outcome = analysis.outcomes.find((entry) => entry.dayId === day.id && entry.outcome === definition.outcome);
    return outcome?.status === "KNOWN" && outcome.authority === definition.authority && outcome.coverage.effective === 1 && relationshipDayGroup(definition.exposure, day) !== "INELIGIBLE";
  }).map((day) => day.date.slice(0, 7)))].sort()]));
  const schedules = {
    CURRENT: Object.fromEntries(dailyRelationshipCatalog.map((definition) => [definition.id, months])),
    RECENT_6: Object.fromEntries(Object.entries(eligibleMonthsByDefinition).map(([id, values]) => [id, values.slice(-6)])),
    PREVIOUS_6: Object.fromEntries(Object.entries(eligibleMonthsByDefinition).map(([id, values]) => [id, values.slice(-12, -6)])),
  };
  const run = (role: keyof typeof schedules, selected: readonly string[]): DailyResult => {
    const selectedSet = new Set(selected);
    const union = new Set(Object.values(schedules[role]).flat());
    const selectedDays = resolvedDays.filter((day) => union.has(day.date.slice(0, 7)));
    const ids = new Set(selectedDays.map((day) => day.id));
    const result = buildGlobalDailyRelationships({
      ...analysis,
      windowRole: role,
      definitionMonths: schedules[role],
      days: selectedDays,
      outcomes: analysis.outcomes.filter((outcome) => ids.has(outcome.dayId)),
      ...(analysis.weeklyInputs === undefined ? {} : { weeklyInputs: analysis.weeklyInputs.map((entry) => {
        const proof = role === "CURRENT" ? entry.materialityProof : entry.windowMaterialityProofs?.[role];
        return { definitionId: entry.definitionId, ...(proof === undefined ? {} : { materialityProof: proof }), weeks: entry.weeks.filter((week) => selectedSet.has(week.start.slice(0, 7)) && selectedSet.has(week.end.slice(0, 7)) && week.end <= analysis.certifiedThrough) };
      }) }),
    });
    const gaps = resolution.window.gapDates.filter((date) => union.has(date.slice(0, 7)) || selectedSet.has(date.slice(0, 7)));
    // Preserve estimates and FDR, but missing exposure is not silently certified
    // as full coverage merely because the remaining matched pairs are known.
    return gaps.length === 0 ? result : { ...result, results: result.results.map((entry) => ({ ...entry, evidenceStatus: "REJECTED" as const, reasonCodes: [...entry.reasonCodes, "SOURCE_EXPOSURE_GAPS"] })), weeklyResults: result.weeklyResults.map((entry) => ({ ...entry, evidenceStatus: "REJECTED" as const, reasonCodes: [...entry.reasonCodes, "SOURCE_EXPOSURE_GAPS"] })) };
  };
  const current = run("CURRENT", months), recent = run("RECENT_6", recentMonths), previous = run("PREVIOUS_6", previousMonths);
  const evidence = (result: DailyResult, id: string, eligibleMonths: readonly string[]): RelationshipTemporalWindowEvidence => {
    const relationship = result.results.find((entry) => entry.relationshipId === id)!;
    const effect = "effect" in relationship ? relationship.effect : undefined;
    return {
      eligibleMonths,
      supportPassed: relationship.support.supportStatus === "SUFFICIENT",
      material: !relationship.reasonCodes.includes("SOURCE_EXPOSURE_GAPS") && "materiality" in relationship && relationship.materiality?.status === "MATERIAL",
      statisticalPassed: "qValue" in relationship && relationship.qValue !== undefined && relationship.qValue <= .05,
      robust: "temporal" in relationship && relationship.temporal?.robust === true,
      direction: Math.sign(effect?.absoluteEffect ?? 0) as -1 | 0 | 1,
      confirmedNoDifference: relationship.coverage.status === "KNOWN" && !relationship.reasonCodes.includes("SOURCE_EXPOSURE_GAPS") && effect?.absoluteEffect === 0 && "uncertainty" in relationship && relationship.uncertainty?.interval95.every((value) => value === 0) === true,
    };
  };
  const relationships = current.results.map((result) => {
    const windows = { current: evidence(current, result.relationshipId, eligibleMonthsByDefinition[result.relationshipId]), recent: evidence(recent, result.relationshipId, schedules.RECENT_6[result.relationshipId]), previous: evidence(previous, result.relationshipId, schedules.PREVIOUS_6[result.relationshipId]) };
    const state = classifyRelationshipTemporalWindows(windows);
    const displayed = state === "RECENT_ONLY" ? recent.results.find((entry) => entry.relationshipId === result.relationshipId)! : result;
    return { relationshipId: result.relationshipId, state, windows, access: relationshipAccessPolicy({ evidenceStatus: displayed.evidenceStatus, hasComparison: "effect" in displayed, temporalState: state }) };
  });
  const weeklyEvidence = (result: DailyResult, id: string, selected: readonly string[]): RelationshipTemporalWindowEvidence => {
    const entry = result.weeklyResults.find((value) => value.definition.id === id)!;
    const completeWeeks = analysis.weeklyInputs?.find((value) => value.definitionId === id)?.weeks.filter((week) => week.complete && week.personId === analysis.personId && week.regimeId === analysis.regimeId && week.evidenceRefs.length > 0 && week.end <= analysis.certifiedThrough && selected.includes(week.start.slice(0, 7)) && selected.includes(week.end.slice(0, 7))) ?? [];
    return {
      eligibleMonths: [...new Set(completeWeeks.flatMap((week) => [week.start.slice(0, 7), week.end.slice(0, 7)]))].sort(),
      supportPassed: "eligibleWeeks" in entry && entry.eligibleWeeks >= entry.definition.minimumWeeks,
      material: !entry.reasonCodes.includes("SOURCE_EXPOSURE_GAPS") && "materiality" in entry && entry.materiality.status === "MATERIAL",
      statisticalPassed: "qValue" in entry && entry.qValue !== undefined && entry.qValue <= .05,
      robust: "temporal" in entry && entry.temporal.robust,
      direction: Math.sign("effect" in entry ? entry.effect ?? 0 : 0) as -1 | 0 | 1,
    };
  };
  const weeklyRelationships = weeklyRelationshipCatalog.map((definition) => {
    const windows = { current: weeklyEvidence(current, definition.id, months), recent: weeklyEvidence(recent, definition.id, recentMonths), previous: weeklyEvidence(previous, definition.id, previousMonths) };
    const state = classifyRelationshipTemporalWindows(windows);
    const displayed = (state === "RECENT_ONLY" ? recent : current).weeklyResults.find((entry) => entry.definition.id === definition.id)!;
    return { relationshipId: definition.id, state, windows, access: relationshipAccessPolicy({ evidenceStatus: displayed.evidenceStatus, hasComparison: "effect" in displayed, temporalState: state }) };
  });
  const temporalDependencies = [...new Set(input.candidates.filter((candidate) => candidate.authority === "CERTIFIED_HISTORY" && candidate.end <= scope.time.certifiedThrough).flatMap((candidate) => candidate.dependencyRefs))].sort().map((ref) => ({ ref, digest: analysis.dependencyDigests[ref] }));
  const insights = buildRelationshipInsights({ personId: analysis.personId, current, recent, classifications: [...relationships, ...weeklyRelationships] });
  parseLocalDate(analysis.certifiedThrough);
  return { methodVersion: "global_relationship_window_recompute@v1", scope: { householdId: analysis.householdId, personId: analysis.personId, regimeId: analysis.regimeId, certifiedThrough: analysis.certifiedThrough }, resolution, months, recentMonths, previousMonths, current, recent, previous, relationships: [...relationships, ...weeklyRelationships], insights, temporalDependencies, inputHash: hash({ resolution: resolution.resolutionHash, current: current.inputHash, recent: recent.inputHash, previous: previous.inputHash, temporalDependencies, accessPolicy: "global-relationship-access@v1" }), publicationEligible: false as const };
}
