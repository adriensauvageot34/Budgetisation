import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { sumMobilityEstimatedFuelCost, type MobilityLegFact } from "../facts";
import { getMetricRegistryEntry } from "../production";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import type {
  MobilityContextResolution,
  MobilityPhysicalTotals,
  MobilityPresenceResolution,
  MobilityPurpose,
  MobilityTemporalQuality,
} from "./mobility-context";
import { aggregateMobilityPhysicalTotals } from "./mobility-context";

export const GLOBAL_M7_PERSONAL_MOBILITY_METHOD_VERSION = "global_m7_personal_mobility@v1" as const;
export const GLOBAL_M7_PERSONAL_MOBILITY_SUPPORT_POLICY = Object.freeze({
  policyRef: "global-m7-personal-mobility-distinct-day-support@v1",
  minimumDistinctDays: 2,
});
export const PERSONAL_MOBILITY_ROLLUP_METRIC_ID = "mobility_usage_estimated_fuel_cost" as const;

export type PersonalMobilityContextKind = "ALL_PERSONAL" | MobilityPurpose;
export type PersonalMobilityCouplePresenceFilter =
  | { readonly state: "ANY" }
  | { readonly state: "OTHER_ELSEWHERE_CONFIRMED"; readonly otherPersonId: string };

export type PersonalMobilitySummary = {
  readonly entityRef: string;
  readonly personId: string;
  readonly contextKind: PersonalMobilityContextKind;
  readonly scope: "PERSONAL";
  readonly couplePresenceFilter: PersonalMobilityCouplePresenceFilter;
  readonly legCount: number;
  readonly distinctDayCount: number;
  readonly eventCount: number;
  readonly distanceKm: string;
  readonly durationSeconds: {
    readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN";
    readonly value: string | null;
    readonly knownLegCount: number;
    readonly eligibleLegCount: number;
  };
  readonly estimatedFuelLiters: string;
  readonly estimatedFuelCost: string;
  readonly mobilityCostMetric: {
    readonly metricId: typeof PERSONAL_MOBILITY_ROLLUP_METRIC_ID;
    readonly methodVersion: string;
    readonly provenance: "estimated";
    readonly monetaryBasis: "estimated_cost";
  };
  readonly grossMobilityUsage: { readonly status: "READY" };
  readonly incrementalMobilityCost: {
    readonly status: "UNAVAILABLE";
    readonly reasonCode: "COUNTERFACTUAL_MODEL_UNAVAILABLE";
  };
  readonly firstObservedDate: string;
  readonly lastObservedDate: string;
  readonly support: {
    readonly status: "SUFFICIENT" | "LIMITED";
    readonly observedLegCount: number;
    readonly distinctDayCount: number;
    readonly minimumDistinctDays: number;
    readonly policyRef: typeof GLOBAL_M7_PERSONAL_MOBILITY_SUPPORT_POLICY.policyRef;
  };
  readonly knowledgeState: "KNOWN" | "PARTIAL";
  readonly temporalQualityDistribution: Readonly<Record<MobilityTemporalQuality, number>>;
  readonly sourceConfidenceDistribution: Readonly<Record<MobilityLegFact["source"]["confidence"], number>>;
  readonly detailRef: {
    readonly resource: "analysis_global_place_mobility_detail";
    readonly entityRef: string;
    readonly role: "PRIMARY";
  };
  readonly evidenceRefs: readonly string[];
  readonly inputHash: string;
};

export type GlobalM7PersonalMobilityAuthority = {
  readonly methodVersion: typeof GLOBAL_M7_PERSONAL_MOBILITY_METHOD_VERSION;
  readonly costMetricId: typeof PERSONAL_MOBILITY_ROLLUP_METRIC_ID;
  readonly physicalTotals: MobilityPhysicalTotals;
  readonly summaries: readonly PersonalMobilitySummary[];
  readonly workMiddaySummaryReady: boolean;
  readonly afterWorkPatternReady: false;
  readonly liveWrites: "NONE";
  readonly inputHash: string;
  readonly outputHash: string;
};

type SummaryCandidate = {
  readonly personId: string;
  readonly contextKind: PersonalMobilityContextKind;
  readonly filter: PersonalMobilityCouplePresenceFilter;
  readonly links: readonly MobilityContextResolution[];
};

const compare = (left: string, right: string) => left.localeCompare(right);
const unique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort(compare);
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const sum = (legs: readonly MobilityLegFact[], pick: (leg: MobilityLegFact) => string) =>
  legs.reduce((total, leg) => total.plus(pick(leg)), new Big(0)).toString();
const count = <T extends string>(values: readonly T[], catalog: readonly T[]) => Object.freeze(Object.fromEntries(
  catalog.map((value) => [value, values.filter((candidate) => candidate === value).length]),
)) as Readonly<Record<T, number>>;

function summaryIdentity(candidate: Pick<SummaryCandidate, "personId" | "contextKind" | "filter">): string {
  return `personal-mobility:${digest([
    candidate.personId,
    candidate.contextKind,
    candidate.filter.state,
    candidate.filter.state === "OTHER_ELSEWHERE_CONFIRMED" ? candidate.filter.otherPersonId : null,
  ]).slice(0, 32)}`;
}

function uniqueLegs(links: readonly MobilityContextResolution[], legById: ReadonlyMap<string, MobilityLegFact>): readonly MobilityLegFact[] {
  return unique(links.map(({ mobilityLegId }) => mobilityLegId)).map((legId) => {
    const leg = legById.get(legId);
    if (leg === undefined) throw new TypeError(`PERSONAL_MOBILITY_ORPHAN_CONTEXT_LINK:${legId}`);
    return leg;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.legId.localeCompare(right.legId));
}

function buildSummary(candidate: SummaryCandidate, legById: ReadonlyMap<string, MobilityLegFact>): PersonalMobilitySummary {
  const links = [...candidate.links].sort((left, right) => left.contextResolutionId.localeCompare(right.contextResolutionId));
  const legs = uniqueLegs(links, legById);
  if (legs.length === 0) throw new TypeError("PERSONAL_MOBILITY_EMPTY_SUMMARY");
  const metric = getMetricRegistryEntry(PERSONAL_MOBILITY_ROLLUP_METRIC_ID);
  if (metric.productionStrategy !== "sum_mobility_usage_estimated_fuel_cost"
    || metric.additivity.kind !== "additive"
    || metric.provenanceRule !== "estimated"
    || !metric.sourceFact.includes("fct_mobility_leg")) {
    throw new TypeError("PERSONAL_MOBILITY_ROLLUP_METRIC_CONTRACT_MISMATCH");
  }
  const distinctDates = unique(legs.map(({ date }) => date));
  const events = unique(links.flatMap((link) => link.contextKind === "LIFE_EVENT" && link.contextRef !== null ? [link.contextRef] : []));
  const knownDurations = legs.flatMap((leg) => leg.durationSeconds === null ? [] : [leg.durationSeconds]);
  const durationStatus = knownDurations.length === 0 ? "UNKNOWN" : knownDurations.length === legs.length ? "KNOWN" : "PARTIAL";
  const entityRef = summaryIdentity(candidate);
  const inputHash = digest({
    personId: candidate.personId,
    contextKind: candidate.contextKind,
    filter: candidate.filter,
    legIds: legs.map(({ legId }) => legId),
    contextResolutionIds: links.map(({ contextResolutionId }) => contextResolutionId),
  });
  const temporalCatalog: readonly MobilityTemporalQuality[] = ["EXACT", "APPROXIMATE", "DATE_ONLY", "PROXY", "UNKNOWN"];
  const confidenceCatalog: readonly MobilityLegFact["source"]["confidence"][] = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];
  return {
    entityRef,
    personId: candidate.personId,
    contextKind: candidate.contextKind,
    scope: "PERSONAL",
    couplePresenceFilter: candidate.filter,
    legCount: legs.length,
    distinctDayCount: distinctDates.length,
    eventCount: events.length,
    distanceKm: sum(legs, (leg) => leg.distanceKm),
    durationSeconds: {
      status: durationStatus,
      value: knownDurations.length === 0 ? null : knownDurations.reduce((total, value) => total.plus(value), new Big(0)).toString(),
      knownLegCount: knownDurations.length,
      eligibleLegCount: legs.length,
    },
    estimatedFuelLiters: sum(legs, (leg) => leg.estimatedFuelLiters),
    estimatedFuelCost: sumMobilityEstimatedFuelCost(legs),
    mobilityCostMetric: {
      metricId: PERSONAL_MOBILITY_ROLLUP_METRIC_ID,
      methodVersion: String(metric.methodVersion),
      provenance: "estimated",
      monetaryBasis: "estimated_cost",
    },
    grossMobilityUsage: { status: "READY" },
    incrementalMobilityCost: { status: "UNAVAILABLE", reasonCode: "COUNTERFACTUAL_MODEL_UNAVAILABLE" },
    firstObservedDate: distinctDates[0]!,
    lastObservedDate: distinctDates.at(-1)!,
    support: {
      status: distinctDates.length >= GLOBAL_M7_PERSONAL_MOBILITY_SUPPORT_POLICY.minimumDistinctDays ? "SUFFICIENT" : "LIMITED",
      observedLegCount: legs.length,
      distinctDayCount: distinctDates.length,
      minimumDistinctDays: GLOBAL_M7_PERSONAL_MOBILITY_SUPPORT_POLICY.minimumDistinctDays,
      policyRef: GLOBAL_M7_PERSONAL_MOBILITY_SUPPORT_POLICY.policyRef,
    },
    knowledgeState: links.every(({ temporalQuality }) => temporalQuality === "EXACT") ? "KNOWN" : "PARTIAL",
    temporalQualityDistribution: count(links.map(({ temporalQuality }) => temporalQuality), temporalCatalog),
    sourceConfidenceDistribution: count(legs.map(({ source }) => source.confidence), confidenceCatalog),
    detailRef: { resource: "analysis_global_place_mobility_detail", entityRef, role: "PRIMARY" },
    evidenceRefs: [`mobility-summary-input:${inputHash}`, `metric:${PERSONAL_MOBILITY_ROLLUP_METRIC_ID}@${String(metric.methodVersion)}`].sort(compare),
    inputHash,
  };
}

export function buildGlobalM7PersonalMobilityAuthority(input: {
  readonly mobilityLegs: readonly MobilityLegFact[];
  readonly contextLinks: readonly MobilityContextResolution[];
  readonly presenceResolutions: readonly MobilityPresenceResolution[];
}): GlobalM7PersonalMobilityAuthority {
  const legById = new Map<string, MobilityLegFact>();
  for (const leg of input.mobilityLegs) {
    if (legById.has(leg.legId)) throw new TypeError(`PERSONAL_MOBILITY_DUPLICATE_LEG:${leg.legId}`);
    legById.set(leg.legId, leg);
  }
  const personalLinks = input.contextLinks.filter((link) =>
    link.scope === "PERSONAL" && link.subjectPersonId !== null && link.linkState === "LINKED");
  const candidates: SummaryCandidate[] = [];
  for (const personId of unique(personalLinks.map((link) => link.subjectPersonId!))) {
    const personLinks = personalLinks.filter((link) => link.subjectPersonId === personId);
    candidates.push({ personId, contextKind: "ALL_PERSONAL", filter: { state: "ANY" }, links: personLinks });
    for (const purpose of unique(personLinks.map(({ purpose }) => purpose)).filter((purpose) => purpose !== "UNKNOWN")) {
      const purposeLinks = personLinks.filter((link) => link.purpose === purpose);
      candidates.push({ personId, contextKind: purpose, filter: { state: "ANY" }, links: purposeLinks });
      const otherPersonIds = unique(input.presenceResolutions.flatMap((resolution) =>
        resolution.subjectPersonId === personId
        && resolution.state === "OTHER_ELSEWHERE_CONFIRMED"
        && purposeLinks.some((link) => link.contextResolutionId === resolution.contextResolutionId)
          ? [resolution.otherPersonId]
          : []));
      for (const otherPersonId of otherPersonIds) {
        const qualifyingContextIds = new Set(input.presenceResolutions.flatMap((resolution) =>
          resolution.subjectPersonId === personId
          && resolution.otherPersonId === otherPersonId
          && resolution.state === "OTHER_ELSEWHERE_CONFIRMED"
            ? [resolution.contextResolutionId]
            : []));
        const filteredLinks = purposeLinks.filter((link) => qualifyingContextIds.has(link.contextResolutionId));
        if (filteredLinks.length > 0) candidates.push({
          personId,
          contextKind: purpose,
          filter: { state: "OTHER_ELSEWHERE_CONFIRMED", otherPersonId },
          links: filteredLinks,
        });
      }
    }
  }
  const summaries = candidates.map((candidate) => buildSummary(candidate, legById))
    .sort((left, right) => left.personId.localeCompare(right.personId)
      || left.contextKind.localeCompare(right.contextKind)
      || left.couplePresenceFilter.state.localeCompare(right.couplePresenceFilter.state)
      || left.entityRef.localeCompare(right.entityRef));
  if (new Set(summaries.map(({ entityRef }) => entityRef)).size !== summaries.length) throw new TypeError("PERSONAL_MOBILITY_DUPLICATE_SUMMARY_ID");
  const physicalTotals = aggregateMobilityPhysicalTotals(input.mobilityLegs, input.contextLinks);
  const semanticInput = {
    mobilityLegs: [...input.mobilityLegs].sort((left, right) => left.legId.localeCompare(right.legId)),
    contextLinks: [...input.contextLinks].sort((left, right) => left.contextResolutionId.localeCompare(right.contextResolutionId)),
    presenceResolutions: [...input.presenceResolutions].sort((left, right) => left.presenceResolutionId.localeCompare(right.presenceResolutionId)),
  };
  const output = {
    methodVersion: GLOBAL_M7_PERSONAL_MOBILITY_METHOD_VERSION,
    costMetricId: PERSONAL_MOBILITY_ROLLUP_METRIC_ID,
    physicalTotals,
    summaries,
    workMiddaySummaryReady: summaries.some(({ contextKind }) => contextKind === "WORK_MIDDAY"),
    afterWorkPatternReady: false as const,
    liveWrites: "NONE" as const,
  };
  return { ...output, inputHash: digest(semanticInput), outputHash: digest(output) };
}
