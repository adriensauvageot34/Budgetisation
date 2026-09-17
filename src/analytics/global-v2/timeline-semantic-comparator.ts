import Big from "big.js";

import {
  parseGlobalCoverageSet,
  parseGlobalMaterialityCandidate,
  parseGlobalSupport,
} from "../../core/global-v2";
import { compareMoney, parseMoney, type Money } from "../../core/money";
import { GlobalMaterialityEngine, globalMaterialityPolicies, type GlobalMaterialityStatus } from "./materiality";
import { medianMoney, moneyMedianAbsoluteDeviation, moneyQuartiles } from "./robust-money-statistics";
import {
  TIMELINE_SEMANTIC_COMPARATOR_VERSION,
  resolveTimelineSemanticComparatorPolicy,
} from "./timeline-semantic-comparator-policy";
import type { TimelineSemanticProjection, TimelineSemanticProjectionEvent } from "./timeline-semantic-projection";

export type TimelineSemanticComparisonLevel = "SAME_SERIES" | "SAME_CLOSE_FAMILY" | "SAME_INTERMEDIATE_FAMILY";
export type TimelineSemanticComparisonSupport = "UNKNOWN" | "PARTIAL" | "KNOWN";

export type TimelineSemanticComparatorFacetValue =
  | Readonly<{ status: "KNOWN"; value: string }>
  | Readonly<{ status: "UNKNOWN" | "CONFLICT" }>;

export type TimelineSemanticComparatorFacetContext = Readonly<{
  eventRef: TimelineSemanticProjectionEvent["eventRef"];
  facets: Readonly<Record<string, TimelineSemanticComparatorFacetValue>>;
  requiredFacetKeys: readonly string[];
}>;

export type TimelineSemanticComparisonResult = Readonly<{
  eventRef: TimelineSemanticProjectionEvent["eventRef"];
  level: TimelineSemanticComparisonLevel;
  cohortKey: string;
  cohortLabel?: string;
  requiredFacets: readonly Readonly<{
    key: string;
    status: "KNOWN" | "UNKNOWN" | "CONFLICT";
    value?: string;
  }>[];
  peerRefs: readonly TimelineSemanticProjectionEvent["eventRef"][];
  peerCosts: readonly Readonly<{
    eventRef: TimelineSemanticProjectionEvent["eventRef"];
    authority: "M6_CAUSAL" | "CANONICAL_LINKED";
    value: Money;
  }>[];
  peerCount: number;
  supportStatus: TimelineSemanticComparisonSupport;
  median?: Money;
  q1?: Money;
  q3?: Money;
  mad?: Money;
  absoluteDelta?: Money;
  relativeDelta?: string;
  materiality: Readonly<{
    status: GlobalMaterialityStatus | "NOT_APPLICABLE";
    policyRef: Readonly<{ id: string; version: string }>;
  }>;
  policyVersion: typeof TIMELINE_SEMANTIC_COMPARATOR_VERSION;
}>;

export type TimelineSemanticComparisonCard = Readonly<{
  eventRef: TimelineSemanticProjectionEvent["eventRef"];
  comparisonLevels: readonly TimelineSemanticComparisonLevel[];
  defaultComparisonLevel?: TimelineSemanticComparisonLevel;
  distinctiveComparisonLevel?: TimelineSemanticComparisonLevel;
}>;

export type TimelineSemanticComparatorProjection = Readonly<{
  methodVersion: typeof TIMELINE_SEMANTIC_COMPARATOR_VERSION;
  sourceRevision: number;
  comparisons: readonly TimelineSemanticComparisonResult[];
  cards: readonly TimelineSemanticComparisonCard[];
}>;

const levelOrder: readonly TimelineSemanticComparisonLevel[] = [
  "SAME_SERIES",
  "SAME_CLOSE_FAMILY",
  "SAME_INTERMEDIATE_FAMILY",
];
const materialityMethodVersion = "timeline_semantic_comparator@v1" as const;

function supportStatus(peerCount: number): TimelineSemanticComparisonSupport {
  return peerCount <= 2 ? "UNKNOWN" : peerCount <= 4 ? "PARTIAL" : "KNOWN";
}

function materialitySupport(peerCount: number) {
  return parseGlobalSupport({
    naturalGrain: "MOMENT",
    eligibleUnits: peerCount,
    observedUnits: peerCount,
    includedUnits: peerCount,
    excludedObservedUnits: 0,
    minimumRequired: 3,
    comparableEntityCount: peerCount,
    supportStatus: peerCount <= 2 ? "INSUFFICIENT" : peerCount <= 4 ? "PARTIAL_SUPPORT" : peerCount <= 7 ? "SUFFICIENT" : "STRONG",
    policyRef: "timeline-semantic-comparator-support@v1",
  });
}

function materialityCoverage(event: TimelineSemanticProjectionEvent) {
  return parseGlobalCoverageSet({
    dimensions: [{
      dimension: "MOMENT_FINANCIAL",
      status: "KNOWN",
      numerator: 1,
      denominator: 1,
      ratio: 1,
      unit: "event",
      basis: event.eventCost.authority,
      evidenceRefs: [event.eventRef],
      policyRef: "timeline-semantic-comparator-cost-authority@v1",
    }],
    requiredDimensions: ["MOMENT_FINANCIAL"],
    effective: 1,
    aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function facetRequirements(
  context: TimelineSemanticComparatorFacetContext,
  policyRequired: readonly string[],
): readonly string[] {
  return uniqueSorted([...context.requiredFacetKeys, ...policyRequired]);
}

function requiredFacetContext(
  context: TimelineSemanticComparatorFacetContext,
  required: readonly string[],
): TimelineSemanticComparisonResult["requiredFacets"] {
  return required.map((key) => {
    const facet = context.facets[key] ?? { status: "UNKNOWN" as const };
    return facet.status === "KNOWN"
      ? { key, status: facet.status, value: facet.value }
      : { key, status: facet.status };
  });
}

function facetsMatch(
  subject: TimelineSemanticComparatorFacetContext,
  peer: TimelineSemanticComparatorFacetContext,
  required: readonly string[],
): boolean {
  return required.every((key) => {
    const subjectFacet = subject.facets[key];
    const peerFacet = peer.facets[key];
    return subjectFacet?.status === "KNOWN" && peerFacet?.status === "KNOWN" && subjectFacet.value === peerFacet.value;
  });
}

function cohort(
  event: TimelineSemanticProjectionEvent,
  level: TimelineSemanticComparisonLevel,
): Readonly<{ key: string; label?: string }> | undefined {
  if (level === "SAME_SERIES") {
    if (event.series === undefined) return undefined;
    return { key: `series:${event.series.seriesRef}`, ...(event.series.label === undefined ? {} : { label: event.series.label }) };
  }
  if (level === "SAME_CLOSE_FAMILY") {
    return { key: `close:${event.semanticClassification.close.key}`, label: event.semanticClassification.close.label };
  }
  return { key: `intermediate:${event.semanticClassification.intermediate.key}`, label: event.semanticClassification.intermediate.label };
}

function sameCohort(
  subject: TimelineSemanticProjectionEvent,
  peer: TimelineSemanticProjectionEvent,
  level: TimelineSemanticComparisonLevel,
): boolean {
  if (level === "SAME_SERIES") return subject.series !== undefined && peer.series?.seriesRef === subject.series.seriesRef;
  if (level === "SAME_CLOSE_FAMILY") return peer.semanticClassification.close.key === subject.semanticClassification.close.key;
  return peer.semanticClassification.intermediate.key === subject.semanticClassification.intermediate.key;
}

function isLevelAllowed(
  event: TimelineSemanticProjectionEvent,
  level: TimelineSemanticComparisonLevel,
): boolean {
  const policy = resolveTimelineSemanticComparatorPolicy(event.semanticClassification.close.key);
  if (level === "SAME_SERIES") return event.series !== undefined;
  if (level === "SAME_CLOSE_FAMILY") return policy.closePolicy === "YES";
  return policy.intermediatePolicy === "YES_WITH_FACET_GATE";
}

function compareLevel(
  subject: TimelineSemanticProjectionEvent,
  level: TimelineSemanticComparisonLevel,
  events: readonly TimelineSemanticProjectionEvent[],
  contexts: ReadonlyMap<string, TimelineSemanticComparatorFacetContext>,
): TimelineSemanticComparisonResult | undefined {
  if (!isLevelAllowed(subject, level) || subject.eventCost.status !== "KNOWN") return undefined;
  const policy = resolveTimelineSemanticComparatorPolicy(subject.semanticClassification.close.key);
  const cohortIdentity = cohort(subject, level);
  if (cohortIdentity === undefined) return undefined;
  const subjectContext = contexts.get(subject.eventRef)!;
  const required = facetRequirements(
    subjectContext,
    level === "SAME_INTERMEDIATE_FAMILY" ? policy.intermediateRequiredFacets : [],
  );
  const peers = events.filter((peer) =>
    peer.eventRef !== subject.eventRef
    && peer.eventCost.status === "KNOWN"
    && sameCohort(subject, peer, level)
    && facetsMatch(subjectContext, contexts.get(peer.eventRef)!, required));
  const peerCosts = peers
    .map((peer) => {
      if (peer.eventCost.status !== "KNOWN") throw new TypeError("TIMELINE_SEMANTIC_COMPARATOR_PEER_COST_STATE_INVALID");
      return {
        eventRef: peer.eventRef,
        authority: peer.eventCost.authority as "M6_CAUSAL" | "CANONICAL_LINKED",
        value: parseMoney(peer.eventCost.value),
      };
    })
    .sort((left, right) => left.eventRef.localeCompare(right.eventRef));
  const count = peerCosts.length;
  const materialityPolicy = globalMaterialityPolicies[policy.materialityPolicyId].ref;
  const base = {
    eventRef: subject.eventRef,
    level,
    cohortKey: cohortIdentity.key,
    ...(cohortIdentity.label === undefined ? {} : { cohortLabel: cohortIdentity.label }),
    requiredFacets: requiredFacetContext(subjectContext, required),
    peerRefs: peerCosts.map(({ eventRef }) => eventRef),
    peerCosts,
    peerCount: count,
    supportStatus: supportStatus(count),
    policyVersion: TIMELINE_SEMANTIC_COMPARATOR_VERSION,
  } as const;
  const median = medianMoney(peerCosts.map(({ value }) => value));
  if (median === undefined) {
    return { ...base, materiality: { status: "NOT_APPLICABLE", policyRef: materialityPolicy } };
  }
  const { q1, q3 } = moneyQuartiles(peerCosts.map(({ value }) => value));
  const mad = moneyMedianAbsoluteDeviation(peerCosts.map(({ value }) => value), median);
  const subjectCost = parseMoney(subject.eventCost.value);
  const absoluteDelta = parseMoney(new Big(subjectCost).minus(median).toFixed());
  const relativeDelta = compareMoney(median, parseMoney("0")) === 0
    ? undefined
    : new Big(absoluteDelta).div(new Big(median).abs()).toFixed();
  const materiality = new GlobalMaterialityEngine().evaluate({
    policyId: policy.materialityPolicyId,
    candidate: parseGlobalMaterialityCandidate({
      candidateId: `${subject.eventRef}:${level}:cost`,
      phenomenonId: subject.eventRef,
      metricRef: "eventCost",
      effect: { absolute: absoluteDelta, ...(relativeDelta === undefined ? {} : { relative: relativeDelta }) },
      knowledgeState: "KNOWN",
      support: materialitySupport(count),
      coverage: materialityCoverage(subject),
      evidenceRefs: [subject.eventRef, ...peerCosts.map(({ eventRef }) => eventRef)],
      entityRefs: [subject.eventRef],
      methodVersion: materialityMethodVersion,
      materialityPolicy,
    }),
    zeroBaseline: compareMoney(median, parseMoney("0")) === 0,
  });
  return {
    ...base,
    median,
    ...(q1 === undefined ? {} : { q1 }),
    ...(q3 === undefined ? {} : { q3 }),
    ...(mad === undefined ? {} : { mad }),
    absoluteDelta,
    ...(relativeDelta === undefined ? {} : { relativeDelta }),
    materiality: { status: materiality.status, policyRef: materiality.policy },
  };
}

/**
 * Computes every authorized semantic depth independently. Visibility is
 * deliberately absent from peer eligibility and GRAND is absent from the API.
 */
export function buildTimelineSemanticComparator(input: Readonly<{
  projection: TimelineSemanticProjection;
  facetContexts?: readonly TimelineSemanticComparatorFacetContext[];
}>): TimelineSemanticComparatorProjection {
  const eventRefs = new Set(input.projection.events.map(({ eventRef }) => eventRef));
  const contexts = new Map<string, TimelineSemanticComparatorFacetContext>();
  for (const context of input.facetContexts ?? []) {
    if (!eventRefs.has(context.eventRef)) throw new TypeError(`TIMELINE_SEMANTIC_COMPARATOR_FACET_EVENT_UNKNOWN:${context.eventRef}`);
    if (contexts.has(context.eventRef)) throw new TypeError(`TIMELINE_SEMANTIC_COMPARATOR_DUPLICATE_FACET_CONTEXT:${context.eventRef}`);
    contexts.set(context.eventRef, {
      eventRef: context.eventRef,
      facets: context.facets,
      requiredFacetKeys: uniqueSorted(context.requiredFacetKeys),
    });
  }
  for (const { eventRef } of input.projection.events) {
    if (!contexts.has(eventRef)) contexts.set(eventRef, { eventRef, facets: {}, requiredFacetKeys: [] });
  }

  const comparisons = input.projection.events.flatMap((event) => levelOrder.flatMap((level) => {
    const result = compareLevel(event, level, input.projection.events, contexts);
    return result === undefined ? [] : [result];
  }));
  const comparisonsByEvent = new Map<string, TimelineSemanticComparisonResult[]>();
  for (const comparison of comparisons) {
    const current = comparisonsByEvent.get(comparison.eventRef) ?? [];
    current.push(comparison);
    comparisonsByEvent.set(comparison.eventRef, current);
  }
  const cards = input.projection.events.map(({ eventRef }): TimelineSemanticComparisonCard => {
    const available = (comparisonsByEvent.get(eventRef) ?? []).filter(({ supportStatus }) => supportStatus !== "UNKNOWN");
    const comparisonLevels = available.map(({ level }) => level);
    const distinctive = available.find(({ supportStatus, materiality }) => supportStatus === "KNOWN" && materiality.status === "MATERIAL");
    return {
      eventRef,
      comparisonLevels,
      ...(comparisonLevels[0] === undefined ? {} : { defaultComparisonLevel: comparisonLevels[0] }),
      ...(distinctive === undefined ? {} : { distinctiveComparisonLevel: distinctive.level }),
    };
  });
  return {
    methodVersion: TIMELINE_SEMANTIC_COMPARATOR_VERSION,
    sourceRevision: input.projection.sourceRevision,
    comparisons,
    cards,
  };
}
