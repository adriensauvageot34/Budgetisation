import { canonicalSerializeGlobal } from "../../core/global-v2";
import type { GlobalMaterialityEvaluation } from "./materiality";
import type { GlobalPublicationDecision } from "./publication";

export const GLOBAL_INSIGHT_SELECTION_METHOD_VERSION = "global_insight_selection@v1" as const;
export const GLOBAL_INSIGHT_SELECTION_POLICY_VERSION = "global-insight-selection-policy@v1" as const;

export const globalInsightSelectionWeights = Object.freeze({
  materiality: 30,
  robustness: 20,
  persistence: 15,
  humanRelevance: 15,
  supportCoverage: 10,
  novelty: 10,
} as const);

export type GlobalInsightDomain =
  | "ECONOMIC" | "CATEGORIES_NEEDS" | "TRANSFORMATIONS" | "RHYTHM"
  | "RELATIONSHIPS" | "MOMENTS" | "GEO_MOBILITY" | "CONSUMPTION"
  | "PERSONAS" | "TOGETHER";

export type GlobalInsightTemporalClass = "CURRENT" | "RECENT_ONLY" | "HISTORICAL";

export type GlobalInsightSupportingContext = {
  readonly metricRefs: readonly string[];
  readonly comparisonRefs: readonly string[];
  readonly entityRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly limitationCodes: readonly string[];
  readonly coverageRefs: readonly string[];
  readonly supportRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly capabilityRefs: readonly string[];
  readonly detailRefs: readonly string[];
};

export type GlobalInsightCandidate = {
  readonly insightId: string;
  readonly moduleKey: GlobalInsightDomain;
  readonly kind: string;
  readonly subjectRef: string;
  readonly titleKey: string;
  readonly statementKey: string;
  readonly primaryMetricRef?: string;
  readonly comparisonRef?: string;
  readonly redundancyGroup: string;
  readonly monetaryOnly: boolean;
  readonly temporalClass: GlobalInsightTemporalClass;
  readonly materiality: GlobalMaterialityEvaluation;
  readonly publication: GlobalPublicationDecision;
  readonly scores: {
    readonly materiality: number;
    readonly robustness: number;
    readonly persistence: number;
    readonly humanRelevance: number;
    readonly supportCoverage: number;
    readonly novelty: number;
  };
  readonly supportingContext: GlobalInsightSupportingContext;
  readonly methodVersion: string;
};

export type GlobalSelectedInsight = GlobalInsightCandidate & {
  readonly editorialScore: number;
  readonly editorialRank: number;
};

export type GlobalInsightSelectionEntry = {
  readonly insightId: string;
  readonly selected: boolean;
  readonly reasonCode?: "HARD_GATE_REJECTED" | "REDUNDANT_WITH_HIGHER_PRIORITY" | "SURFACE_LIMIT_REACHED";
  readonly supportingContext: GlobalInsightSupportingContext;
};

export type GlobalInsightSelectionResult = {
  readonly selectedInsights: readonly GlobalSelectedInsight[];
  readonly selectionEntries: readonly GlobalInsightSelectionEntry[];
  readonly methodVersion: typeof GLOBAL_INSIGHT_SELECTION_METHOD_VERSION;
  readonly policyVersion: typeof GLOBAL_INSIGHT_SELECTION_POLICY_VERSION;
};

function nonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new TypeError(`${label}_EMPTY`);
}

function canonicalStrings(values: readonly string[], label: string): readonly string[] {
  const sorted = [...values].map((value) => {
    nonEmpty(value, label);
    return value;
  }).sort();
  if (new Set(sorted).size !== sorted.length) throw new TypeError(`${label}_DUPLICATE`);
  return sorted;
}

function normalizeContext(context: GlobalInsightSupportingContext): GlobalInsightSupportingContext {
  return {
    metricRefs: canonicalStrings(context.metricRefs, "GLOBAL_INSIGHT_METRIC_REF"),
    comparisonRefs: canonicalStrings(context.comparisonRefs, "GLOBAL_INSIGHT_COMPARISON_REF"),
    entityRefs: canonicalStrings(context.entityRefs, "GLOBAL_INSIGHT_ENTITY_REF"),
    evidenceRefs: canonicalStrings(context.evidenceRefs, "GLOBAL_INSIGHT_EVIDENCE_REF"),
    limitationCodes: canonicalStrings(context.limitationCodes, "GLOBAL_INSIGHT_LIMITATION"),
    coverageRefs: canonicalStrings(context.coverageRefs, "GLOBAL_INSIGHT_COVERAGE_REF"),
    supportRefs: canonicalStrings(context.supportRefs, "GLOBAL_INSIGHT_SUPPORT_REF"),
    provenanceRefs: canonicalStrings(context.provenanceRefs, "GLOBAL_INSIGHT_PROVENANCE_REF"),
    capabilityRefs: canonicalStrings(context.capabilityRefs, "GLOBAL_INSIGHT_CAPABILITY_REF"),
    detailRefs: canonicalStrings(context.detailRefs, "GLOBAL_INSIGHT_DETAIL_REF"),
  };
}

function normalizeCandidate(candidate: GlobalInsightCandidate): GlobalInsightCandidate {
  for (const [label, value] of Object.entries({
    insightId: candidate.insightId,
    kind: candidate.kind,
    subjectRef: candidate.subjectRef,
    titleKey: candidate.titleKey,
    statementKey: candidate.statementKey,
    redundancyGroup: candidate.redundancyGroup,
    methodVersion: candidate.methodVersion,
  })) nonEmpty(value, `GLOBAL_INSIGHT_${label.toUpperCase()}`);
  if (candidate.publication.sectionKey !== candidate.insightId) throw new TypeError("GLOBAL_INSIGHT_PUBLICATION_IDENTITY_MISMATCH");
  if (candidate.materiality.candidateId !== candidate.insightId) throw new TypeError("GLOBAL_INSIGHT_MATERIALITY_IDENTITY_MISMATCH");
  for (const [dimension, value] of Object.entries(candidate.scores)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`GLOBAL_INSIGHT_SCORE_INVALID:${dimension}`);
  }
  return { ...candidate, supportingContext: normalizeContext(candidate.supportingContext) };
}

function editorialScore(candidate: GlobalInsightCandidate): number {
  return Object.entries(globalInsightSelectionWeights).reduce(
    (total, [dimension, weight]) => total + candidate.scores[dimension as keyof GlobalInsightCandidate["scores"]] * weight,
    0,
  );
}

function passesHardGates(candidate: GlobalInsightCandidate): boolean {
  if (candidate.publication.visibility !== "VISIBLE") return false;
  if (candidate.publication.sectionClass === "OPPORTUNISTIC_INSIGHT" && candidate.materiality.status !== "MATERIAL") return false;
  return candidate.materiality.status === "MATERIAL" || candidate.materiality.status === "QUALIFIED_PARTIAL";
}

function compareCandidates(left: GlobalInsightCandidate, right: GlobalInsightCandidate): number {
  return editorialScore(right) - editorialScore(left) || left.insightId.localeCompare(right.insightId);
}

/**
 * Editorial selection only. Analytical gates and materiality must already have
 * been evaluated by their owners; this engine cannot turn a rejected result
 * into a publishable insight.
 */
export class InsightSelectionEngine {
  select(input: { readonly candidates: readonly GlobalInsightCandidate[]; readonly limit?: number }): GlobalInsightSelectionResult {
    const limit = input.limit ?? 5;
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 5) throw new TypeError("GLOBAL_INSIGHT_SURFACE_LIMIT_INVALID");
    const byId = new Map<string, GlobalInsightCandidate>();
    for (const raw of input.candidates) {
      const candidate = normalizeCandidate(raw);
      const previous = byId.get(candidate.insightId);
      if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(candidate)) {
        throw new TypeError("GLOBAL_INSIGHT_CONTRADICTORY_DUPLICATE");
      }
      byId.set(candidate.insightId, candidate);
    }
    const all = [...byId.values()].sort((a, b) => a.insightId.localeCompare(b.insightId));
    const eligible = all.filter(passesHardGates).sort(compareCandidates);
    const nonMonetaryDomains = new Set(eligible.filter((item) => !item.monetaryOnly).map((item) => item.moduleKey));
    const monetaryLimit = nonMonetaryDomains.size >= 2 ? 2 : limit;
    const selected: GlobalInsightCandidate[] = [];
    const selectedGroups = new Set<string>();
    const moduleCounts = new Map<GlobalInsightDomain, number>();
    let monetaryCount = 0;
    let recentOnlyCount = 0;

    const canSelect = (candidate: GlobalInsightCandidate) =>
      !selectedGroups.has(candidate.redundancyGroup)
      && (moduleCounts.get(candidate.moduleKey) ?? 0) < 2
      && (!candidate.monetaryOnly || monetaryCount < monetaryLimit)
      && (candidate.temporalClass !== "RECENT_ONLY" || recentOnlyCount < 1);
    const add = (candidate: GlobalInsightCandidate) => {
      selected.push(candidate);
      selectedGroups.add(candidate.redundancyGroup);
      moduleCounts.set(candidate.moduleKey, (moduleCounts.get(candidate.moduleKey) ?? 0) + 1);
      if (candidate.monetaryOnly) monetaryCount += 1;
      if (candidate.temporalClass === "RECENT_ONLY") recentOnlyCount += 1;
    };

    // First pass gives each represented domain its strongest admissible voice.
    for (const candidate of eligible) {
      if (selected.length >= limit) break;
      if (selected.some((item) => item.moduleKey === candidate.moduleKey) || !canSelect(candidate)) continue;
      add(candidate);
    }
    // Second pass fills remaining slots by the deterministic editorial score.
    for (const candidate of eligible) {
      if (selected.length >= limit) break;
      if (selected.some((item) => item.insightId === candidate.insightId) || !canSelect(candidate)) continue;
      add(candidate);
    }

    const selectedIds = new Set(selected.map((item) => item.insightId));
    const selectedByGroup = new Set(selected.map((item) => item.redundancyGroup));
    const selectionEntries = all.map((candidate): GlobalInsightSelectionEntry => {
      if (selectedIds.has(candidate.insightId)) return { insightId: candidate.insightId, selected: true, supportingContext: candidate.supportingContext };
      const reasonCode = !passesHardGates(candidate)
        ? "HARD_GATE_REJECTED" as const
        : selectedByGroup.has(candidate.redundancyGroup)
          ? "REDUNDANT_WITH_HIGHER_PRIORITY" as const
          : "SURFACE_LIMIT_REACHED" as const;
      return { insightId: candidate.insightId, selected: false, reasonCode, supportingContext: candidate.supportingContext };
    });
    return {
      selectedInsights: selected.map((candidate, index) => ({ ...candidate, editorialScore: editorialScore(candidate), editorialRank: index + 1 })),
      selectionEntries,
      methodVersion: GLOBAL_INSIGHT_SELECTION_METHOD_VERSION,
      policyVersion: GLOBAL_INSIGHT_SELECTION_POLICY_VERSION,
    };
  }
}
