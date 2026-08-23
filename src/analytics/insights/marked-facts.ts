import Big from "big.js";
import type { ComparisonQualification } from "../comparisons";

export const MARKED_FACTS_METHOD_VERSION = "marked_facts_materiality_v1" as const;

export type MarkedFactCandidateKind = "total" | "category" | "unsupported";

export type MarkedFactCandidate = {
  readonly id: string;
  readonly kind: MarkedFactCandidateKind;
  readonly absoluteDelta: string;
  readonly relativeDelta: string | null;
  readonly robustZ?: number | null;
  readonly supportLevel?: "sufficient" | "limited" | "insufficient";
  readonly phenomenonKey: string;
  readonly evidenceKeys: readonly string[];
  readonly parentId?: string;
};

export type SelectedMarkedFact = MarkedFactCandidate & {
  readonly qualification: ComparisonQualification;
  readonly materiality: "material" | "very_unusual";
};

type MaterialityThreshold = {
  readonly absolute: string;
  readonly relative: string;
};

export const markedFactsMaterialityPolicy = Object.freeze({
  methodVersion: MARKED_FACTS_METHOD_VERSION,
  total: Object.freeze({ absolute: "50", relative: "0.10" }),
  category: Object.freeze({ absolute: "25", relative: "0.20" }),
  robustZ: Object.freeze({ contributes: 2, veryUnusual: 3.5 }),
  defaultLimit: 3,
  maximumLimit: 5,
});

function thresholdFor(kind: MarkedFactCandidateKind): MaterialityThreshold | null {
  return kind === "total"
    ? markedFactsMaterialityPolicy.total
    : kind === "category"
      ? markedFactsMaterialityPolicy.category
      : null;
}

function finiteAbsolute(value: string): Big {
  const parsed = new Big(value).abs();
  if (!parsed.c) throw new TypeError("Delta matériel invalide.");
  return parsed;
}

export function robustZScore(input: {
  readonly value: string;
  readonly median: string;
  readonly mad: string;
}): number | null {
  const mad = new Big(input.mad).abs();
  if (mad.eq(0)) return null;
  const score = new Big(input.value).minus(input.median).abs().div(mad.times(1.4826));
  const result = Number(score.toFixed(8));
  return Number.isFinite(result) ? result : null;
}

export function isMaterialMarkedFactCandidate(candidate: MarkedFactCandidate): boolean {
  const threshold = thresholdFor(candidate.kind);
  if (threshold === null || candidate.relativeDelta === null) return false;
  const absolutePass = finiteAbsolute(candidate.absoluteDelta).gte(threshold.absolute);
  const relativePass = finiteAbsolute(candidate.relativeDelta).gte(threshold.relative);
  if (absolutePass && relativePass) return true;
  return candidate.supportLevel === "sufficient" &&
    candidate.robustZ !== null &&
    candidate.robustZ !== undefined &&
    Number.isFinite(candidate.robustZ) &&
    Math.abs(candidate.robustZ) >= markedFactsMaterialityPolicy.robustZ.contributes &&
    absolutePass;
}

function overlaps(left: readonly string[], right: readonly string[]): boolean {
  const rightKeys = new Set(right);
  return left.some((key) => rightKeys.has(key));
}

function samePhenomenon(left: MarkedFactCandidate, right: MarkedFactCandidate): boolean {
  const taxonomyOverlap = left.parentId === right.id || right.parentId === left.id;
  return left.phenomenonKey === right.phenomenonKey ||
    (taxonomyOverlap && overlaps(left.evidenceKeys, right.evidenceKeys));
}

function compareCandidates(left: MarkedFactCandidate, right: MarkedFactCandidate): number {
  const absolute = finiteAbsolute(right.absoluteDelta).cmp(finiteAbsolute(left.absoluteDelta));
  if (absolute !== 0) return absolute;
  const leftRelative = left.relativeDelta === null ? new Big(0) : finiteAbsolute(left.relativeDelta);
  const rightRelative = right.relativeDelta === null ? new Big(0) : finiteAbsolute(right.relativeDelta);
  const relative = rightRelative.cmp(leftRelative);
  if (relative !== 0) return relative;
  const kindPriority = { category: 0, total: 1, unsupported: 2 } as const;
  const kind = kindPriority[left.kind] - kindPriority[right.kind];
  return kind !== 0 ? kind : left.id.localeCompare(right.id);
}

export function selectMarkedFacts(
  candidates: readonly MarkedFactCandidate[],
  requestedLimit = markedFactsMaterialityPolicy.defaultLimit,
): readonly SelectedMarkedFact[] {
  const limit = Math.min(
    markedFactsMaterialityPolicy.maximumLimit,
    Math.max(0, Math.trunc(requestedLimit)),
  );
  const ranked = candidates.filter(isMaterialMarkedFactCandidate).sort(compareCandidates);
  const selected: SelectedMarkedFact[] = [];
  for (const candidate of ranked) {
    if (selected.some((existing) => samePhenomenon(existing, candidate))) continue;
    selected.push({
      ...candidate,
      qualification: candidate.supportLevel === "sufficient"
        ? "statistically_qualified"
        : "descriptive_only",
      materiality: candidate.supportLevel === "sufficient" &&
        candidate.robustZ !== null &&
        candidate.robustZ !== undefined &&
        Math.abs(candidate.robustZ) >= markedFactsMaterialityPolicy.robustZ.veryUnusual
        ? "very_unusual"
        : "material",
    });
    if (selected.length === limit) break;
  }
  return selected;
}
