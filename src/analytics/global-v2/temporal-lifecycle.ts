import Big from "big.js";
import { canonicalSerializeGlobal, parseGlobalMaterialityCandidate } from "../../core/global-v2";
import { parseMoney } from "../../core/money";
import type { YearMonth } from "../../core/time";
import { medianMoney } from "../references";
import { GlobalMaterialityEngine } from "./materiality";
import { normalizeGlobalTemporalPoints, temporalMonthIndex, type GlobalTemporalPoint } from "./temporal-descriptive";
import type { GlobalTemporalChangeInput } from "./temporal-change";

export const globalTemporalLifecyclePolicy = Object.freeze({
  version: "global-temporal-lifecycle@v1", chapterMinimum: 3, returnMinimum: 3,
  currentRegimeMinimum: 6, currentRegimeMaximum: 12,
});
type Point = GlobalTemporalPoint & { readonly value: string };
const median = (points: readonly Point[]) => medianMoney(points.map((p) => parseMoney(p.value)));
const constant = (points: readonly Point[]) => points.length > 0 && points.every((p) => new Big(p.value).eq(points[0].value));
const consecutive = (points: readonly Point[]) => points.every((p, i) => i === 0 || temporalMonthIndex(p.month) - temporalMonthIndex(points[i - 1].month) === 1);

export function evaluateTemporalLevelDifference(input: GlobalTemporalChangeInput, before: string, after: string) {
  const delta = new Big(after).minus(before).toFixed();
  return new GlobalMaterialityEngine().evaluate({
    policyId: input.policyId,
    candidate: parseGlobalMaterialityCandidate({
      ...input.evidence, candidateId: `${input.evidence.phenomenonId}:level`,
      effect: { absolute: delta, ...(new Big(before).eq(0) ? {} : { relative: new Big(delta).div(new Big(before).abs()).toFixed() }) },
    }),
  });
}

/** A sufficient exact proof: two six-month plateaus joined by an observed
 * monotone transition. No dispersion tolerance or slope threshold is invented.
 * The transition belongs to the change interval, not either reference plateau. */
export function buildGlobalGradualTransitions(input: GlobalTemporalChangeInput) {
  const points = normalizeGlobalTemporalPoints(input).filter((p): p is Point => p.status === "KNOWN" && p.complete && p.eligible && p.value !== undefined);
  const transitions = [];
  for (let start = 6; start < points.length - 6; start += 1) {
    const before = points.slice(start - 6, start);
    if (!constant(before)) continue;
    for (let settled = start + 1; settled <= points.length - 6; settled += 1) {
      const after = points.slice(settled, settled + 6);
      const middle = points.slice(start, settled);
      const observed = [...before, ...middle, ...after];
      if (!constant(after) || !consecutive(observed)) continue;
      const beforeLevel = median(before), afterLevel = median(after);
      const direction = new Big(afterLevel).cmp(beforeLevel);
      if (direction === 0) continue;
      const bounded = middle.every((p) => new Big(p.value).cmp(beforeLevel) === direction && new Big(afterLevel).cmp(p.value) === direction);
      const monotone = middle.every((p, i) => i === 0 || new Big(p.value).minus(middle[i - 1].value).times(direction).gte(0));
      if (!bounded || !monotone) continue;
      const materiality = evaluateTemporalLevelDifference(input, beforeLevel, afterLevel);
      if (materiality.status !== "MATERIAL") continue;
      transitions.push({
        start: points[start].month, settled: points[settled].month, beforeLevel, afterLevel,
        beforeMonths: before.map((p) => p.month), afterMonths: after.map((p) => p.month),
        transitionMonths: middle.map((p) => p.month),
        shape: "GRADUAL_TRANSITION" as const, proof: "EXACT_PLATEAUS_OBSERVED_MONOTONE_PATH" as const,
        materiality,
        dependencyRefs: [...new Set(observed.flatMap((p) => p.dependencyRefs))].sort(),
      });
      break;
    }
  }
  return transitions;
}

/** Closed chapters need a supported end; the last dataset date is never an end. */
export function buildGlobalTemporalChapters(input: GlobalTemporalChangeInput) {
  const points = normalizeGlobalTemporalPoints(input).filter((p): p is Point => p.status === "KNOWN" && p.complete && p.eligible && p.value !== undefined);
  const chapters = [];
  for (let start = 6; start <= points.length - 6; start += 1) {
    const before = points.slice(start - 6, start);
    if (!constant(before) || temporalMonthIndex(before.at(-1)!.month) - temporalMonthIndex(before[0].month) > 6 ||
      temporalMonthIndex(points[start].month) - temporalMonthIndex(before.at(-1)!.month) !== 1) continue;
    for (let end = start + 3; end <= points.length - 3; end += 1) {
      const during = points.slice(start, end);
      const returning = points.slice(end, end + 3);
      // Exact plateaus are sufficient factual proofs, not a numerical noise threshold.
      if (!constant(during) || !constant(returning) || !consecutive([...during, ...returning])) continue;
      const beforeLevel = median(before), chapterLevel = median(during), endLevel = median(returning);
      const onset = evaluateTemporalLevelDifference(input, beforeLevel, chapterLevel);
      const versusChapter = evaluateTemporalLevelDifference(input, chapterLevel, endLevel);
      const versusBefore = evaluateTemporalLevelDifference(input, beforeLevel, endLevel);
      if (onset.status !== "MATERIAL" || versusChapter.status !== "MATERIAL") continue;
      if (versusBefore.status !== "NOT_MATERIAL" && versusBefore.status !== "MATERIAL") continue;
      chapters.push({
        id: `${input.evidence.phenomenonId}:${points[start].month}`,
        kind: "TEMPORARY_CHAPTER" as const, status: "CONFIRMED_CLOSED" as const,
        start: points[start].month, end: points[end].month,
        endSemantics: "EXCLUSIVE_START_OF_NEXT_REGIME" as const,
        precision: "MONTH" as const,
        endReason: versusBefore.status === "NOT_MATERIAL" ? "RETURN_TO_PREVIOUS" as const : "THIRD_REGIME" as const,
        beforeLevel, chapterLevel, endLevel,
        chapterMonths: during.map((p) => p.month), returnMonths: returning.map((p) => p.month),
        evidence: { onset, versusChapter, versusBefore },
        dependencyRefs: [...new Set([...before, ...during, ...returning].flatMap((p) => p.dependencyRefs))].sort(),
      });
      break;
    }
  }
  return { chapters, methodVersion: "global_temporal_lifecycle@v1" };
}

/** Current-regime authority is an explicitly confirmed, still ongoing durable change. */
export function buildGlobalCurrentRegime(input: {
  readonly points: readonly GlobalTemporalPoint[];
  readonly certifiedThroughMonth: YearMonth;
  readonly regime: {
    readonly kind: "DURABLE_CHANGE" | "NEW_PHASE" | "TEMPORARY_CHAPTER";
    readonly status: "CONFIRMED_ONGOING" | "CONFIRMED_CLOSED" | "CANDIDATE";
    readonly start: YearMonth;
    readonly evidenceRefs: readonly string[];
  };
}) {
  const ordered = normalizeGlobalTemporalPoints(input);
  const eligible = ordered.filter((p): p is Point => p.month >= input.regime.start && p.status === "KNOWN" && p.complete && p.eligible && p.value !== undefined);
  const included = eligible.slice(-12);
  const structural = input.regime.kind === "DURABLE_CHANGE" && input.regime.status === "CONFIRMED_ONGOING";
  const supported = included.length >= 6 && input.regime.evidenceRefs.length > 0;
  const valueAvailable = input.regime.status === "CONFIRMED_ONGOING" && included.length > 0 && input.regime.evidenceRefs.length > 0;
  return {
    status: !valueAvailable ? "UNKNOWN" as const : structural && supported ? "KNOWN" as const : "PARTIAL" as const,
    ...(valueAvailable ? { value: median(included) } : {}),
    supportStatus: supported ? "SUFFICIENT" as const : "PARTIAL_SUPPORT" as const,
    structuralReferenceEligible: structural && supported,
    replacesTypicalAutomatically: false,
    includedMonths: included.map((p) => p.month),
    reasonCode: !valueAvailable ? "NO_CONFIRMED_ONGOING_REGIME" : !structural ? "NON_STRUCTURAL_PHASE" : !supported ? "INSUFFICIENT_REGIME_SUPPORT" : "SUPPORTED_DURABLE_REGIME",
    dependencyRefs: [...new Set([...included.flatMap((p) => p.dependencyRefs), ...input.regime.evidenceRefs])].sort(),
    methodVersion: "global_temporal_lifecycle@v1",
    // Canonical input serialization is provided for the enclosing closure, not a second source of values.
    closure: canonicalSerializeGlobal({ regime: input.regime, boundary: input.certifiedThroughMonth, included, policy: globalTemporalLifecyclePolicy }),
  };
}
