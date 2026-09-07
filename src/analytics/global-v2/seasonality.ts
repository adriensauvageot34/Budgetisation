import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalMaterialityCandidate, type GlobalMaterialityCandidate } from "../../core/global-v2";
import { parseMoney } from "../../core/money";
import { GlobalMaterialityEngine, type GlobalMaterialityPolicyId } from "./materiality";

export const globalCycleSeasonalityPolicy = Object.freeze({
  version: "global-cycle-seasonality@v1",
  weeklyMinimumCycles: 8,
  annualMinimumCycles: 3,
  anchoredMinimumCycles: 3,
  recurringLifeMinimumCycles: 3,
  replicationRate: 0.75,
  statusLifecycle: "ACTIVE_ONLY_WITH_CURRENT_REPLICATION;WEAKENED_LOST_REQUIRE_FUTURE_EXPLICIT_POLICY",
});

export type GlobalSeasonalKind =
  | "WEEKLY_CYCLE"
  | "ANNUAL_SEASONALITY"
  | "ANCHORED_CALENDAR_EVENT"
  | "RECURRING_LIFE_PERIOD";

export type GlobalCycleObservation = {
  readonly cycleId: string;
  readonly phase: string;
  readonly numerator: string;
  readonly observableDenominator: string;
  readonly regimeId: string;
  readonly complete: boolean;
  readonly dependencyRefs: readonly string[];
  readonly ordinaryAuthority?: { readonly classification: "ORDINARY" | "EXCEPTIONAL"; readonly evidenceRef: string };
};

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

function minimumCycles(kind: GlobalSeasonalKind): number {
  if (kind === "WEEKLY_CYCLE") return globalCycleSeasonalityPolicy.weeklyMinimumCycles;
  if (kind === "ANNUAL_SEASONALITY") return globalCycleSeasonalityPolicy.annualMinimumCycles;
  if (kind === "ANCHORED_CALENDAR_EVENT") return globalCycleSeasonalityPolicy.anchoredMinimumCycles;
  return globalCycleSeasonalityPolicy.recurringLifeMinimumCycles;
}

export function buildGlobalSeasonalPattern(input: {
  readonly patternId: string;
  readonly kind: GlobalSeasonalKind;
  readonly subjectRef: string;
  readonly highPhases: readonly string[];
  readonly observations: readonly GlobalCycleObservation[];
  readonly currentRegimeId: string;
  readonly evidence: Omit<GlobalMaterialityCandidate, "candidateId" | "effect">;
  readonly materialityPolicyId: GlobalMaterialityPolicyId;
  readonly calendarWindowRef?: string;
  readonly lifecycleAssertion?: {
    readonly status: "WEAKENED" | "LOST";
    readonly authorityRef: string;
    readonly evidenceRefs: readonly string[];
  };
}) {
  if (Object.hasOwn(input, "calendarWindowRef") && input.calendarWindowRef === undefined) throw new TypeError("calendarWindowRef absent must be omitted.");
  if (Object.hasOwn(input, "lifecycleAssertion") && input.lifecycleAssertion === undefined) throw new TypeError("lifecycleAssertion absent must be omitted.");
  if (!input.patternId || !input.subjectRef || input.highPhases.length === 0 || new Set(input.highPhases).size !== input.highPhases.length) throw new TypeError("Seasonal pattern identity/high phases invalid.");
  if (input.kind === "ANCHORED_CALENDAR_EVENT" && !input.calendarWindowRef?.startsWith("CalendarEventWindowCatalog@")) throw new TypeError("Anchored calendar event requires a versioned CalendarEventWindowCatalog ref.");
  const observations = [...input.observations].map((observation) => {
    if (Object.values(observation).some((value) => value === undefined) || !observation.cycleId || !observation.phase || !observation.regimeId || observation.dependencyRefs.length === 0) throw new TypeError("Cycle observation requires complete authority.");
    const numerator = parseMoney(observation.numerator);
    const denominator = parseMoney(observation.observableDenominator);
    if (new Big(numerator).lt(0) || new Big(denominator).lte(0)) throw new TypeError("Cycle observations must be normalized over positive observable exposure.");
    if (observation.ordinaryAuthority !== undefined && (!observation.ordinaryAuthority.evidenceRef || !["ORDINARY", "EXCEPTIONAL"].includes(observation.ordinaryAuthority.classification))) throw new TypeError("Exceptional-cycle exclusion requires authority.");
    return { ...observation, numerator, observableDenominator: denominator };
  }).sort((a, b) => a.cycleId.localeCompare(b.cycleId) || a.phase.localeCompare(b.phase));
  const identities = new Set<string>();
  for (const observation of observations) {
    const identity = `${observation.cycleId}:${observation.phase}`;
    if (identities.has(identity)) throw new TypeError("Duplicate cycle/phase observation.");
    identities.add(identity);
  }
  const current = observations.filter((observation) => observation.regimeId === input.currentRegimeId && observation.complete && observation.ordinaryAuthority?.classification !== "EXCEPTIONAL");
  const cycleIds = [...new Set(current.map((observation) => observation.cycleId))].sort();
  const effects = cycleIds.flatMap((cycleId) => {
    const cycle = current.filter((observation) => observation.cycleId === cycleId);
    const high = cycle.filter((observation) => input.highPhases.includes(observation.phase));
    const low = cycle.filter((observation) => !input.highPhases.includes(observation.phase));
    if (high.length === 0 || low.length === 0) return [];
    const highNumerator = high.reduce((sum, value) => sum.plus(value.numerator), new Big(0));
    const highDenominator = high.reduce((sum, value) => sum.plus(value.observableDenominator), new Big(0));
    const lowNumerator = low.reduce((sum, value) => sum.plus(value.numerator), new Big(0));
    const lowDenominator = low.reduce((sum, value) => sum.plus(value.observableDenominator), new Big(0));
    const highRate = highNumerator.div(highDenominator);
    const lowRate = lowNumerator.div(lowDenominator);
    return [{ cycleId, highRate: highRate.toFixed(), lowRate: lowRate.toFixed(), effect: highRate.minus(lowRate).toFixed(), dependencyRefs: [...new Set(cycle.flatMap((value) => value.dependencyRefs))].sort() }];
  });
  const positive = effects.filter((effect) => new Big(effect.effect).gt(0)).length;
  const negative = effects.filter((effect) => new Big(effect.effect).lt(0)).length;
  const dominantSign = positive === negative ? 0 : positive > negative ? 1 : -1;
  const replicated = dominantSign === 0 ? 0 : effects.filter((effect) => new Big(effect.effect).cmp(0) === dominantSign).length;
  const replicationRate = effects.length === 0 ? 0 : replicated / effects.length;
  const averageEffect = effects.length === 0 ? "0" : new Big(effects.reduce((sum, effect) => sum.plus(effect.effect), new Big(0))).div(effects.length).toFixed();
  const averageComparator = effects.length === 0 ? new Big(0) : effects.reduce((sum, effect) => sum.plus(new Big(effect.lowRate).abs()), new Big(0)).div(effects.length);
  const supportMinimum = minimumCycles(input.kind);
  const supportStatus = effects.length >= supportMinimum ? "SUFFICIENT" as const : effects.length >= 2 ? "PARTIAL_SUPPORT" as const : "INSUFFICIENT" as const;
  const candidate = parseGlobalMaterialityCandidate({
    ...input.evidence,
    candidateId: `${input.patternId}:seasonality`,
    effect: {
      absolute: averageEffect,
      ...(averageComparator.eq(0) ? {} : { relative: new Big(averageEffect).div(averageComparator).toFixed() }),
    },
    support: {
      naturalGrain: input.kind === "WEEKLY_CYCLE" ? "WEEK" : "MONTH",
      eligibleUnits: cycleIds.length,
      observedUnits: cycleIds.length,
      includedUnits: effects.length,
      excludedObservedUnits: cycleIds.length - effects.length,
      minimumRequired: supportMinimum,
      supportStatus,
      policyRef: globalCycleSeasonalityPolicy.version,
    },
  });
  const materiality = new GlobalMaterialityEngine().evaluate({ candidate, policyId: input.materialityPolicyId });
  const active = effects.length >= supportMinimum && replicationRate >= 0.75 && materiality.status === "MATERIAL";
  const hypothesis = effects.length >= 2 && effects.length < supportMinimum && replicationRate >= 0.75;
  if (input.lifecycleAssertion !== undefined && (!input.lifecycleAssertion.authorityRef || input.lifecycleAssertion.evidenceRefs.length === 0)) throw new TypeError("Seasonal lifecycle requires explicit longitudinal authority.");
  const result = {
    patternId: input.patternId,
    kind: input.kind,
    subject: input.subjectRef,
    cycleCount: effects.length,
    replicationRate,
    highPhases: [...input.highPhases].sort(),
    lowPhases: [...new Set(current.map((value) => value.phase).filter((phase) => !input.highPhases.includes(phase)))].sort(),
    effect: averageEffect,
    materiality,
    status: active ? "ACTIVE" as const : input.lifecycleAssertion?.status ?? "HYPOTHESIS_ONLY" as const,
    publicationEligibility: active || input.lifecycleAssertion !== undefined ? "ELIGIBLE" as const : hypothesis ? "INTERNAL_ONLY" as const : "REJECTED" as const,
    reasonCodes: [
      ...(effects.length < supportMinimum ? ["INSUFFICIENT_CYCLES"] : []),
      ...(replicationRate < 0.75 ? ["INSUFFICIENT_REPLICATION"] : []),
      ...(materiality.status !== "MATERIAL" ? [`MATERIALITY_${materiality.status}`] : []),
      ...(observations.some((value) => value.regimeId !== input.currentRegimeId) ? ["OTHER_REGIMES_EXCLUDED"] : []),
      ...(observations.some((value) => value.ordinaryAuthority?.classification === "EXCEPTIONAL") ? ["CANONICAL_EXCEPTIONALS_EXCLUDED"] : []),
    ].sort(),
    support: candidate.support,
    dependencyRefs: [...new Set([
      ...effects.flatMap((effect) => effect.dependencyRefs),
      ...input.evidence.evidenceRefs,
      ...(input.calendarWindowRef ? [input.calendarWindowRef] : []),
      ...(input.lifecycleAssertion === undefined ? [] : [input.lifecycleAssertion.authorityRef, ...input.lifecycleAssertion.evidenceRefs]),
      `policy:${globalCycleSeasonalityPolicy.version}`,
    ])].sort(),
    methodVersion: "global_cycle_seasonality@v1" as const,
  };
  return { ...result, inputHash: digest({ result, observations, currentRegimeId: input.currentRegimeId }) };
}
