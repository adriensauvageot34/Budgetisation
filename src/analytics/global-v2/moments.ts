import { Temporal } from "@js-temporal/polyfill";
import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { EconomicComponentFact } from "../facts";
import {
  projectCanonicalMomentRelations,
  resolveMomentFinancialCost,
  type MomentFinancialRelation,
} from "../history-v2/shared-doctrines";
import {
  canonicalSerializeGlobal,
  parseGlobalCoverageSet,
  parseGlobalMaterialityCandidate,
  parseGlobalSupport,
  type GlobalCoverageSet,
  type GlobalKnowledgeValue,
  type GlobalSupport,
} from "../../core/global-v2";
import { addMoney, compareMoney, parseMoney, type Money } from "../../core/money";
import { parseLocalDate, type LocalDate } from "../../core/time";
import { GlobalMaterialityEngine, globalMaterialityPolicies } from "./materiality";
import {
  assertGlobalMomentCatalogExhaustive,
  momentComparisonProfiles,
  resolveGlobalMomentType,
  type GlobalMomentComparisonTier,
  type GlobalMomentFacetKey,
  type GlobalMomentFamily,
} from "./moment-catalog";

export const GLOBAL_M6_METHOD_VERSION = "global_moment_experience@v1" as const;
const zero = parseMoney("0");
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

export type GlobalMomentFacetValue = { readonly status: "KNOWN"; readonly value: string; readonly evidenceRefs: readonly string[] }
  | { readonly status: "UNKNOWN" | "CONFLICT"; readonly evidenceRefs?: readonly string[] };

export type GlobalMomentInput = {
  readonly momentId: string;
  readonly householdId: string;
  readonly type: { readonly status: "KNOWN"; readonly value: string; readonly evidenceRefs: readonly string[] }
    | { readonly status: "UNKNOWN" | "CONFLICT"; readonly evidenceRefs?: readonly string[] };
  readonly seriesId?: string;
  readonly startDate?: LocalDate;
  readonly endDate?: LocalDate;
  readonly temporalPrecision: "DAY" | "INSTANT" | "UNKNOWN";
  readonly startTime?: string;
  readonly endTime?: string;
  readonly householdParticipantIds: readonly string[];
  readonly externalParticipantIds: readonly string[];
  readonly participationEvidenceRefs: readonly string[];
  readonly facets?: Partial<Record<Exclude<GlobalMomentFacetKey, "DURATION_BAND" | "HOUSEHOLD_PARTICIPATION">, GlobalMomentFacetValue>>;
  readonly expectedCausalComponentKeys?: readonly string[];
  readonly lifeEventIds: readonly string[];
  readonly activityCount: number;
  readonly declaredImportance?: { readonly value: true; readonly evidenceRefs: readonly string[] };
  readonly transformationAnchor?: { readonly value: true; readonly evidenceRefs: readonly string[] };
  readonly routineRepresentative?: { readonly value: true; readonly evidenceRefs: readonly string[] };
};

export type GlobalMomentComponentAuthority = {
  readonly componentKey: string;
  readonly momentId: string;
  readonly causalRole?: "PREPARATION" | "CORE_EXPERIENCE" | "AFTER_EFFECT" | "ADJUSTMENT";
  readonly compositionGroup?: "TRANSPORT" | "LODGING" | "FOOD" | "ACTIVITIES" | "PREPARATION" | "OTHER";
  readonly paymentDate?: LocalDate;
  readonly adjustmentPaymentDate?: LocalDate;
  readonly evidenceRefs: readonly string[];
};

export type GlobalMomentUnitCostAuthority = {
  readonly momentId: string;
  readonly componentKey: string;
  readonly unitAmount: Money;
  readonly quantity: number;
  readonly beneficiaryIds: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalMomentExperienceInput = {
  readonly householdId: string;
  readonly householdMemberIds: readonly string[];
  readonly moments: readonly GlobalMomentInput[];
  readonly economicFacts: readonly EconomicComponentFact[];
  readonly financialRelations?: readonly MomentFinancialRelation[];
  readonly componentAuthorities?: readonly GlobalMomentComponentAuthority[];
  readonly unitCostAuthorities?: readonly GlobalMomentUnitCostAuthority[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
};

const moneySum = (values: readonly Money[]): Money => values.reduce(addMoney, zero);
const sortedMoney = (values: readonly Money[]) => [...values].sort((a, b) => compareMoney(a, b));
const midpoint = (a: Money, b: Money) => parseMoney(new Big(a).plus(b).div(2).toFixed());
const medianMoney = (values: readonly Money[]): Money | undefined => {
  if (!values.length) return undefined;
  const valuesSorted = sortedMoney(values), middle = Math.floor(valuesSorted.length / 2);
  return valuesSorted.length % 2 ? valuesSorted[middle] : midpoint(valuesSorted[middle - 1], valuesSorted[middle]);
};
const quartiles = (values: readonly Money[]) => {
  const sorted = sortedMoney(values);
  if (!sorted.length) return {};
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, middle), upper = sorted.slice(sorted.length % 2 ? middle + 1 : middle);
  return { q1: medianMoney(lower.length ? lower : sorted), q3: medianMoney(upper.length ? upper : sorted) };
};
const madMoney = (values: readonly Money[], median: Money) => medianMoney(values.map((value) => parseMoney(new Big(value).minus(median).abs().toFixed())));

function normalizeMoment(input: GlobalMomentInput): GlobalMomentInput {
  if (!input.momentId.trim() || !input.householdId.trim()) throw new TypeError("M6_MOMENT_IDENTITY_REQUIRED");
  if (input.startDate !== undefined) parseLocalDate(input.startDate);
  if (input.endDate !== undefined) parseLocalDate(input.endDate);
  if ((input.startDate === undefined) !== (input.endDate === undefined) || (input.startDate !== undefined && input.startDate > input.endDate!)) throw new TypeError("M6_INVALID_MOMENT_INTERVAL");
  if (!Number.isSafeInteger(input.activityCount) || input.activityCount < 0) throw new TypeError("M6_INVALID_ACTIVITY_COUNT");
  const unique = (values: readonly string[], name: string) => {
    if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new TypeError(`M6_INVALID_${name}`);
    return [...values].sort();
  };
  if (input.type.status === "KNOWN" && (!input.type.value.trim() || input.type.evidenceRefs.length === 0)) throw new TypeError("M6_KNOWN_TYPE_REQUIRES_AUTHORITY");
  return {
    ...input,
    householdParticipantIds: unique(input.householdParticipantIds, "HOUSEHOLD_PARTICIPANTS"),
    externalParticipantIds: unique(input.externalParticipantIds, "EXTERNAL_PARTICIPANTS"),
    participationEvidenceRefs: unique(input.participationEvidenceRefs, "PARTICIPATION_EVIDENCE"),
    lifeEventIds: unique(input.lifeEventIds, "LIFE_EVENTS"),
    ...(input.expectedCausalComponentKeys === undefined ? {} : { expectedCausalComponentKeys: unique(input.expectedCausalComponentKeys, "EXPECTED_COMPONENTS") }),
  };
}

function experienceDayCount(moment: GlobalMomentInput): number | undefined {
  if (moment.startDate === undefined || moment.endDate === undefined || moment.temporalPrecision === "UNKNOWN") return undefined;
  return Temporal.PlainDate.from(moment.startDate).until(Temporal.PlainDate.from(moment.endDate), { largestUnit: "day" }).days + 1;
}

function durationBand(moment: GlobalMomentInput): GlobalMomentFacetValue {
  const days = experienceDayCount(moment);
  if (days === undefined) return { status: "UNKNOWN" };
  const value = days === 1 ? "SAME_DAY" : days === 2 ? "ONE_NIGHT" : days <= 4 ? "TWO_TO_THREE_NIGHTS" : days <= 8 ? "FOUR_TO_SEVEN_NIGHTS" : "EIGHT_PLUS_NIGHTS";
  return { status: "KNOWN", value, evidenceRefs: [`moment:${moment.momentId}`] };
}

function householdParticipation(moment: GlobalMomentInput, householdMemberIds: readonly string[]): GlobalMomentFacetValue {
  if (moment.participationEvidenceRefs.length === 0) return { status: "UNKNOWN" };
  const members = new Set(householdMemberIds), participants = moment.householdParticipantIds.filter((id) => members.has(id));
  if (participants.length !== moment.householdParticipantIds.length) return { status: "CONFLICT", evidenceRefs: moment.participationEvidenceRefs };
  const external = moment.externalParticipantIds.length;
  const value = participants.length === 1 && external === 0 ? "HOUSEHOLD_SOLO"
    : participants.length === members.size && external === 0 ? "BOTH_HOUSEHOLD"
      : participants.length === 1 ? "ONE_HOUSEHOLD_PLUS_EXTERNALS"
        : participants.length === members.size ? "BOTH_PLUS_EXTERNALS" : "UNKNOWN";
  return value === "UNKNOWN" ? { status: "UNKNOWN", evidenceRefs: moment.participationEvidenceRefs } : { status: "KNOWN", value, evidenceRefs: moment.participationEvidenceRefs };
}

function facets(moment: GlobalMomentInput, householdMemberIds: readonly string[]): Readonly<Record<GlobalMomentFacetKey, GlobalMomentFacetValue>> {
  return {
    DURATION_BAND: durationBand(moment),
    HOUSEHOLD_PARTICIPATION: householdParticipation(moment, householdMemberIds),
    LODGING_MODE: moment.facets?.LODGING_MODE ?? { status: "UNKNOWN" },
    ORGANIZER_ROLE: moment.facets?.ORGANIZER_ROLE ?? { status: "UNKNOWN" },
    GEOGRAPHIC_SCOPE: moment.facets?.GEOGRAPHIC_SCOPE ?? { status: "UNKNOWN" },
  };
}

function financialCoverage(moment: GlobalMomentInput, resolvedKeys: readonly string[]): GlobalCoverageSet {
  const expected = moment.expectedCausalComponentKeys;
  const evidenceRefs = [...new Set(resolvedKeys.map((key) => `economic-component:${key}`))].sort();
  if (expected === undefined) return parseGlobalCoverageSet({
    dimensions: [{ dimension: "MOMENT_FINANCIAL", status: "UNKNOWN", unit: "canonical-component", basis: "expected-causal-universe-not-established", evidenceRefs, policyRef: "global-moment-financial-coverage@v1" }],
    requiredDimensions: ["MOMENT_FINANCIAL"], aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
  if (expected.length === 0) return parseGlobalCoverageSet({
    dimensions: [{ dimension: "MOMENT_FINANCIAL", status: "NOT_APPLICABLE", unit: "canonical-component", basis: "explicit-empty-expected-causal-universe", evidenceRefs, policyRef: "global-moment-financial-coverage@v1" }],
    requiredDimensions: ["MOMENT_FINANCIAL"], aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
  const numerator = expected.filter((key) => resolvedKeys.includes(key)).length, denominator = expected.length;
  const ratio = numerator / denominator;
  const status = ratio === 1 ? "KNOWN" as const : ratio >= .6 ? "PARTIAL" as const : "UNKNOWN" as const;
  return parseGlobalCoverageSet({
    dimensions: [{ dimension: "MOMENT_FINANCIAL", status, ...(status === "UNKNOWN" ? {} : { numerator, denominator, ratio }), unit: "canonical-component", basis: "resolved-over-expected-causal-components", evidenceRefs, policyRef: "global-moment-financial-coverage@v1" }],
    requiredDimensions: ["MOMENT_FINANCIAL"], ...(status === "UNKNOWN" ? {} : { effective: ratio }), aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
}

function spentDuring(moment: GlobalMomentInput, facts: readonly EconomicComponentFact[]): GlobalKnowledgeValue<Money> {
  if (moment.startDate === undefined || moment.endDate === undefined || moment.temporalPrecision === "UNKNOWN") return { status: "UNKNOWN" };
  if (moment.startDate === moment.endDate && moment.temporalPrecision !== "INSTANT") return { status: "NOT_APPLICABLE" };
  if (moment.temporalPrecision === "INSTANT") {
    // EconomicComponentFact currently has day precision only. Never treat the whole day as an hourly interval.
    return { status: "UNKNOWN" };
  }
  const included: Money[] = [];
  let unresolved = false;
  for (const fact of facts) {
    if (fact.householdId !== moment.householdId) continue;
    if (fact.economicTiming.kind === "unknown" || fact.economicTiming.kind === "conflict") { unresolved = true; continue; }
    if (fact.economicTiming.kind === "partial") unresolved = true;
    for (const segment of fact.economicTiming.segments) {
      if (segment.timingState !== "known" || segment.periodStart === null || segment.periodEnd === null) { unresolved = true; continue; }
      const intersects = segment.periodStart <= moment.endDate && segment.periodEnd >= moment.startDate;
      if (!intersects) continue;
      if (segment.periodStart < moment.startDate || segment.periodEnd > moment.endDate) { unresolved = true; continue; }
      included.push(segment.amount);
    }
  }
  const value = moneySum(included);
  if (!unresolved) return { status: "KNOWN", value };
  return included.length ? { status: "PARTIAL", value, partialMeaning: "OBSERVED_ONLY", partialReasons: ["MISSING_INTERVALS"] } : { status: "UNKNOWN" };
}

function phase(date: LocalDate | undefined, moment: GlobalMomentInput): "PAID_BEFORE" | "PAID_DURING" | "PAID_AFTER" | "UNKNOWN_PAYMENT_PHASE" {
  if (date === undefined || moment.startDate === undefined || moment.endDate === undefined) return "UNKNOWN_PAYMENT_PHASE";
  return date < moment.startDate ? "PAID_BEFORE" : date > moment.endDate ? "PAID_AFTER" : "PAID_DURING";
}

function support(peerCount: number): GlobalSupport {
  return parseGlobalSupport({
    naturalGrain: "MOMENT", eligibleUnits: peerCount, observedUnits: peerCount, includedUnits: peerCount,
    excludedObservedUnits: 0, minimumRequired: 3, comparableEntityCount: peerCount,
    supportStatus: peerCount <= 2 ? "INSUFFICIENT" : peerCount <= 4 ? "PARTIAL_SUPPORT" : peerCount <= 7 ? "SUFFICIENT" : "STRONG",
    policyRef: "global-moment-peer-support@v1",
  });
}

function facetCompatible(a: Readonly<Record<GlobalMomentFacetKey, GlobalMomentFacetValue>>, b: Readonly<Record<GlobalMomentFacetKey, GlobalMomentFacetValue>>, required: readonly GlobalMomentFacetKey[]): boolean {
  return required.every((key) => a[key].status === "KNOWN" && b[key].status === "KNOWN" && a[key].value === b[key].value);
}

export function buildGlobalMomentExperiences(input: GlobalMomentExperienceInput) {
  assertGlobalMomentCatalogExhaustive();
  const momentsById = new Map<string, GlobalMomentInput>();
  for (const raw of input.moments) {
    const moment = normalizeMoment(raw);
    if (moment.householdId !== input.householdId) throw new TypeError("M6_CROSS_HOUSEHOLD_MOMENT");
    const previous = momentsById.get(moment.momentId);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(moment)) throw new TypeError("M6_CONTRADICTORY_MOMENT");
    momentsById.set(moment.momentId, moment);
  }
  const moments = [...momentsById.values()].sort((a, b) => a.momentId.localeCompare(b.momentId));
  const facts = [...input.economicFacts].sort((a, b) => String(a.canonicalComponentKey).localeCompare(String(b.canonicalComponentKey)));
  const factByKey = new Map(facts.map((fact) => [String(fact.canonicalComponentKey), fact]));
  if (factByKey.size !== facts.length) throw new TypeError("M6_DUPLICATE_ECONOMIC_COMPONENT");
  const relations = input.financialRelations ?? projectCanonicalMomentRelations(facts);
  const authorityByKey = new Map((input.componentAuthorities ?? []).map((authority) => [`${authority.momentId}:${authority.componentKey}`, authority]));
  if (authorityByKey.size !== (input.componentAuthorities ?? []).length) throw new TypeError("M6_DUPLICATE_COMPONENT_AUTHORITY");
  const types = new Map(moments.map((moment) => [moment.momentId, moment.type.status === "KNOWN" ? resolveGlobalMomentType(moment.type.value) : undefined]));
  const seriesTypes = new Map<string, Set<string>>();
  for (const moment of moments) if (moment.seriesId !== undefined && moment.type.status === "KNOWN") {
    const set = seriesTypes.get(moment.seriesId) ?? new Set<string>(); set.add(moment.type.value); seriesTypes.set(moment.seriesId, set);
  }
  const seriesConflicts = new Set([...seriesTypes].filter(([, values]) => values.size > 1).map(([id]) => id));
  const allFacets = new Map(moments.map((moment) => [moment.momentId, facets(moment, input.householdMemberIds)]));

  const summaries = moments.map((moment) => {
    const resolvedType = types.get(moment.momentId), profile = resolvedType === undefined ? undefined : momentComparisonProfiles[resolvedType.family];
    const resolved = resolveMomentFinancialCost({ householdId: input.householdId, momentId: moment.momentId, relations });
    const coverage = financialCoverage(moment, resolved.causalComponentKeys);
    const resolvedFacts = resolved.causalComponentKeys.map((key) => factByKey.get(key)).filter((fact): fact is EconomicComponentFact => fact !== undefined);
    let causalCost: GlobalKnowledgeValue<Money>;
    if (resolved.causalCost.status === "KNOWN") causalCost = { status: "KNOWN", value: resolved.causalCost.value, coverage };
    else if (resolved.causalCost.status === "PARTIAL") causalCost = { status: "PARTIAL", value: resolved.causalCost.value, partialMeaning: "OBSERVED_ONLY", partialReasons: ["MISSING_LINKAGE"], coverage };
    else if (resolved.causalCost.status === "CONFLICT") causalCost = { status: "CONFLICT", coverage };
    else if (moment.expectedCausalComponentKeys?.length === 0) causalCost = { status: "KNOWN", value: zero, coverage };
    else causalCost = { status: "UNKNOWN", coverage };
    const fullFacts = resolvedFacts.filter((fact) => compareMoney(resolved.causalAmounts.get(String(fact.canonicalComponentKey))!, fact.net) === 0);
    const gross = moneySum(fullFacts.map((fact) => fact.gross));
    const refunds = moneySum(fullFacts.map((fact) => fact.refundApplied));
    const composition = new Map<string, Money>();
    const causalRoles = new Map<string, Money>();
    const paymentTimeline = new Map<string, Money>();
    const personAmounts = new Map<string, Money>();
    for (const [key, amount] of resolved.causalAmounts) {
      const fact = factByKey.get(key), authority = authorityByKey.get(`${moment.momentId}:${key}`);
      const group = authority?.compositionGroup ?? "OTHER";
      composition.set(group, addMoney(composition.get(group) ?? zero, amount));
      if (authority?.causalRole !== undefined) causalRoles.set(authority.causalRole, addMoney(causalRoles.get(authority.causalRole) ?? zero, amount));
      const date = authority?.paymentDate ?? (fact?.bankDate.kind === "known" ? fact.bankDate.date : undefined);
      const paymentPhase = phase(date, moment);
      const fullFact = fact !== undefined && compareMoney(fact.net, amount) === 0;
      const paidAmount = fullFact ? fact.gross : amount;
      paymentTimeline.set(paymentPhase, addMoney(paymentTimeline.get(paymentPhase) ?? zero, paidAmount));
      if (fullFact && compareMoney(fact.refundApplied, zero) > 0) {
        const adjustmentPhase = phase(authority?.adjustmentPaymentDate, moment);
        paymentTimeline.set(adjustmentPhase, addMoney(paymentTimeline.get(adjustmentPhase) ?? zero, parseMoney(new Big(fact.refundApplied).times(-1).toFixed())));
      }
      if (fact?.person.kind === "resolved") personAmounts.set(String(fact.person.id), addMoney(personAmounts.get(String(fact.person.id)) ?? zero, amount));
      if (fact?.person.kind === "shared" || fact?.person.kind === "partial") for (const share of fact.person.shares) {
        const attributed = parseMoney(new Big(amount).times(share.share).toFixed());
        personAmounts.set(String(share.personId), addMoney(personAmounts.get(String(share.personId)) ?? zero, attributed));
      }
    }
    const dayCount = experienceDayCount(moment);
    const costPerExperienceDay = profile?.allowCostPerDay && dayCount !== undefined && (causalCost.status === "KNOWN" || causalCost.status === "PARTIAL")
      ? { status: causalCost.status, value: parseMoney(new Big(causalCost.value).div(dayCount).toFixed()), ...(causalCost.status === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const, partialReasons: ["MISSING_LINKAGE" as const] } : {}) }
      : { status: "NOT_APPLICABLE" as const };
    return {
      moment, resolvedType, profile, subjectFacets: allFacets.get(moment.momentId)!,
      causalCost,
      grossCausalOutflow: causalCost.status === "UNKNOWN" || causalCost.status === "CONFLICT"
        ? { status: causalCost.status }
        : fullFacts.length === resolvedFacts.length ? { status: "KNOWN" as const, value: gross } : { status: "PARTIAL" as const, value: gross, partialMeaning: "OBSERVED_ONLY" as const, partialReasons: ["MISSING_LINKAGE" as const] },
      refundsAndAdjustments: causalCost.status === "UNKNOWN" || causalCost.status === "CONFLICT"
        ? { status: causalCost.status }
        : fullFacts.length === resolvedFacts.length ? { status: "KNOWN" as const, value: refunds } : { status: "PARTIAL" as const, value: refunds, partialMeaning: "OBSERVED_ONLY" as const, partialReasons: ["MISSING_LINKAGE" as const] },
      composition: [...composition].sort(([a], [b]) => a.localeCompare(b)).map(([key, amount]) => ({ key, amount })),
      causalRoles: [...causalRoles].sort(([a], [b]) => a.localeCompare(b)).map(([role, amount]) => ({ role, amount })),
      paymentTimeline: [...paymentTimeline].sort(([a], [b]) => a.localeCompare(b)).map(([paymentPhase, amount]) => ({ paymentPhase, amount })),
      spentDuring: spentDuring(moment, facts), experienceDayCount: dayCount, costPerExperienceDay,
      genericCostPerParticipant: { status: "NOT_APPLICABLE" as const },
      attributedCostByPerson: [...personAmounts].sort(([a], [b]) => a.localeCompare(b)).map(([personId, amount]) => ({ personId, amount, authority: "ECONOMIC_COMPONENT_PERSON_ATTRIBUTION" as const })),
      naturallyUnitPricedCosts: (input.unitCostAuthorities ?? []).filter((authority) => authority.momentId === moment.momentId).map((authority) => {
        if (!Number.isSafeInteger(authority.quantity) || authority.quantity <= 0 || authority.beneficiaryIds.length !== authority.quantity || authority.evidenceRefs.length === 0) throw new TypeError("M6_INVALID_NATURAL_UNIT_COST_AUTHORITY");
        if (!resolved.causalComponentKeys.includes(authority.componentKey)) throw new TypeError("M6_UNIT_COST_OUTSIDE_CAUSAL_COMPONENTS");
        return { componentKey: authority.componentKey, unitAmount: parseMoney(authority.unitAmount), quantity: authority.quantity, beneficiaryIds: [...authority.beneficiaryIds].sort(), evidenceRefs: [...authority.evidenceRefs].sort() };
      }),
      sourceRefs: [...new Set([`moment:${moment.momentId}`, ...resolved.causalComponentKeys.map((key) => `economic-component:${key}`)])].sort(),
    };
  });
  const summaryById = new Map(summaries.map((summary) => [summary.moment.momentId, summary]));

  const comparisons = summaries.map((subject) => {
    const { moment, resolvedType, profile } = subject;
    if (moment.type.status === "CONFLICT" || moment.seriesId !== undefined && seriesConflicts.has(moment.seriesId)) return { momentId: moment.momentId, status: "CONFLICT" as const, reasonCodes: ["INCOMPATIBLE_SERIES_TYPES"] };
    if (resolvedType === undefined || profile === undefined || !profile.allowTotalCostComparison || subject.causalCost.status !== "KNOWN") return { momentId: moment.momentId, status: "NOT_APPLICABLE" as const, reasonCodes: [resolvedType === undefined ? "MOMENT_TYPE_UNRESOLVED" : "COMPARISON_NOT_AUTHORIZED"] };
    const missingFacets = profile.requiredFacets.filter((key) => subject.subjectFacets[key].status !== "KNOWN");
    if (missingFacets.length) return { momentId: moment.momentId, status: "UNKNOWN" as const, reasonCodes: missingFacets.map((key) => `REQUIRED_FACET_UNRESOLVED:${key}`) };
    const candidatesByTier = new Map<GlobalMomentComparisonTier, typeof summaries>();
    for (const tier of profile.comparisonLadder) candidatesByTier.set(tier, summaries.filter((peer) => {
      if (peer.moment.momentId === moment.momentId || peer.resolvedType === undefined || peer.causalCost.status !== "KNOWN") return false;
      if (!facetCompatible(subject.subjectFacets, peer.subjectFacets, profile.requiredFacets)) return false;
      if (tier === "SAME_SERIES") return moment.seriesId !== undefined && peer.moment.seriesId === moment.seriesId && peer.resolvedType.normalizedKey === resolvedType.normalizedKey;
      if (tier === "SAME_TYPE") return peer.resolvedType.normalizedKey === resolvedType.normalizedKey;
      return peer.resolvedType.family === resolvedType.family;
    }));
    let tier: GlobalMomentComparisonTier | undefined, peers: typeof summaries = [];
    for (const candidateTier of profile.comparisonLadder) {
      const candidate = candidatesByTier.get(candidateTier)!;
      if (!peers.length || candidate.length > peers.length) { tier = candidateTier; peers = candidate; }
      if (candidate.length >= 5) { tier = candidateTier; peers = candidate; break; }
    }
    if (tier === undefined || peers.length === 0) return { momentId: moment.momentId, status: "UNKNOWN" as const, reasonCodes: ["NO_COMPARABLE_PEERS"] };
    const peerSupport = support(peers.length);
    if (peers.length <= 2) return { momentId: moment.momentId, status: "UNKNOWN" as const, comparisonTier: tier, comparisonProfileId: profile.profileId, peerIds: peers.map((peer) => peer.moment.momentId), peerCount: peers.length, support: peerSupport, reasonCodes: ["INSUFFICIENT_COMPARABLE_PEERS"] };
    const peerCosts = peers.map((peer) => peer.causalCost.status === "KNOWN" ? peer.causalCost.value : zero);
    const peerMedianCost = medianMoney(peerCosts)!;
    const { q1, q3 } = quartiles(peerCosts), mad = madMoney(peerCosts, peerMedianCost);
    const absoluteDelta = parseMoney(new Big(subject.causalCost.value).minus(peerMedianCost).toFixed());
    const relativeDelta = compareMoney(peerMedianCost, zero) === 0 ? undefined : new Big(absoluteDelta).div(new Big(peerMedianCost).abs()).toFixed();
    const materialityCandidate = parseGlobalMaterialityCandidate({
      candidateId: `moment:${moment.momentId}:cost`, phenomenonId: `moment:${moment.momentId}`, metricRef: "netCausalCost",
      effect: { absolute: absoluteDelta, ...(relativeDelta === undefined ? {} : { relative: relativeDelta }) }, knowledgeState: "KNOWN",
      support: peerSupport, coverage: subject.causalCost.coverage!, evidenceRefs: subject.sourceRefs,
      entityRefs: [moment.momentId], methodVersion: GLOBAL_M6_METHOD_VERSION,
      materialityPolicy: globalMaterialityPolicies[profile.materialityPolicyId].ref,
    });
    const materiality = new GlobalMaterialityEngine().evaluate({ policyId: profile.materialityPolicyId, candidate: materialityCandidate, zeroBaseline: compareMoney(peerMedianCost, zero) === 0 });
    const relativelyLowCost = peers.length >= 5 && q1 !== undefined && compareMoney(subject.causalCost.value, q1) <= 0 && compareMoney(absoluteDelta, zero) < 0 && materiality.status === "MATERIAL";
    const componentKeys = [...new Set([subject, ...peers].flatMap((entry) => entry.composition.map(({ key }) => key)))].sort();
    const componentDeltas = componentKeys.map((key) => {
      const subjectAmount = subject.composition.find((entry) => entry.key === key)?.amount ?? zero;
      const peerMedianAmount = medianMoney(peers.map((peer) => peer.composition.find((entry) => entry.key === key)?.amount ?? zero))!;
      return { key, subjectAmount, peerMedianAmount, delta: parseMoney(new Big(subjectAmount).minus(peerMedianAmount).toFixed()) };
    });
    const componentDeltaTotal = moneySum(componentDeltas.map(({ delta }) => delta));
    const residual = parseMoney(new Big(absoluteDelta).minus(componentDeltaTotal).toFixed());
    const primaryDrivers = [
      ...componentDeltas,
      ...(compareMoney(residual, zero) === 0 ? [] : [{ key: "REFERENCE_COMPOSITION_RESIDUAL", subjectAmount: zero, peerMedianAmount: zero, delta: residual }]),
    ].filter(({ delta }) => compareMoney(delta, zero) !== 0).sort((a, b) => new Big(b.delta).abs().cmp(new Big(a.delta).abs()) || a.key.localeCompare(b.key));
    const narrativeFlags = [
      ...(materiality.status === "MATERIAL" ? ["UNUSUAL" as const] : peerSupport.supportStatus !== "INSUFFICIENT" ? ["REPRESENTATIVE" as const] : []),
      ...(relativelyLowCost ? ["RELATIVELY_LOW_COST" as const] : []),
      ...(moment.transformationAnchor?.value ? ["TRANSFORMATION_ANCHOR" as const] : []),
      ...(moment.declaredImportance?.value ? ["DECLARED_IMPORTANCE" as const] : []),
      ...(moment.householdParticipantIds.length > 1 ? ["SHARED" as const] : []),
    ];
    return {
      momentId: moment.momentId, status: peers.length <= 4 ? "PARTIAL" as const : "KNOWN" as const,
      family: resolvedType.family, type: resolvedType.normalizedKey, ...(moment.seriesId === undefined ? {} : { seriesId: moment.seriesId }),
      comparisonTier: tier, comparisonProfileId: profile.profileId, subjectFacets: subject.subjectFacets,
      peerIds: peers.map((peer) => peer.moment.momentId), peerCount: peers.length, support: peerSupport,
      subjectCost: subject.causalCost.value, peerMedianCost, absoluteDelta, ...(relativeDelta === undefined ? {} : { relativeDelta }),
      ...(q1 === undefined ? {} : { q1 }), ...(q3 === undefined ? {} : { q3 }), ...(mad === undefined ? {} : { mad }),
      componentDeltas, componentDeltaResidual: residual, primaryDrivers, materiality, narrativeFlags,
      evidenceRefs: [...new Set([...subject.sourceRefs, ...peers.flatMap((peer) => peer.sourceRefs)])].sort(),
      methodVersion: GLOBAL_M6_METHOD_VERSION,
    };
  });

  const comparisonById = new Map(comparisons.map((comparison) => [comparison.momentId, comparison]));
  const narrative = summaries.map((summary) => {
    const comparison = comparisonById.get(summary.moment.momentId)!;
    const explicitSignals = [
      ...(summary.moment.declaredImportance?.value ? ["DECLARED_IMPORTANCE"] : []),
      ...(summary.moment.transformationAnchor?.value ? ["TRANSFORMATION_ANCHOR"] : []),
      ...(summary.moment.routineRepresentative?.value ? ["ROUTINE_REPRESENTATIVE"] : []),
      ...(summary.moment.householdParticipantIds.length > 1 && summary.moment.participationEvidenceRefs.length ? ["SHARED"] : []),
      ...(summary.moment.lifeEventIds.length ? ["COMPOSED_LIFE_EVENTS"] : []),
      ...(summary.moment.activityCount > 0 ? ["ACTIVITY_RICHNESS"] : []),
    ];
    const comparisonFlags = "narrativeFlags" in comparison ? comparison.narrativeFlags : [];
    return { momentId: summary.moment.momentId, eligible: explicitSignals.length > 0, signals: [...new Set([...explicitSignals, ...comparisonFlags])].sort(), costUsedAsPositiveImportanceSignal: false };
  });

  const series = [...new Set(moments.flatMap((moment) => moment.seriesId === undefined ? [] : [moment.seriesId]))].sort().map((seriesId) => {
    const entries = summaries.filter((summary) => summary.moment.seriesId === seriesId);
    const costs = entries.flatMap((summary) => summary.causalCost.status === "KNOWN" ? [summary.causalCost.value] : []);
    return { seriesId, status: seriesConflicts.has(seriesId) ? "CONFLICT" as const : "KNOWN" as const, occurrenceCount: entries.length, durationDays: entries.flatMap((entry) => entry.experienceDayCount === undefined ? [] : [entry.experienceDayCount]), causalCosts: costs, ...(medianMoney(costs) === undefined ? {} : { medianCausalCost: medianMoney(costs) }), transformationInputEligible: !seriesConflicts.has(seriesId) && entries.length >= 3 };
  });

  const dependencies = new Set<string>();
  for (const summary of summaries) for (const ref of summary.sourceRefs) dependencies.add(ref);
  for (const fact of facts) dependencies.add(`economic-component:${fact.canonicalComponentKey}`);
  for (const moment of moments) for (const ref of [...moment.participationEvidenceRefs, ...(moment.type.evidenceRefs ?? [])]) dependencies.add(ref);
  for (const moment of moments) {
    for (const facet of Object.values(facets(moment, input.householdMemberIds))) for (const ref of facet.evidenceRefs ?? []) dependencies.add(ref);
    for (const proof of [moment.declaredImportance, moment.transformationAnchor, moment.routineRepresentative]) for (const ref of proof?.evidenceRefs ?? []) dependencies.add(ref);
  }
  for (const relation of relations) if (relation.kind !== "UNDEFINED") for (const ref of relation.evidenceRefs) dependencies.add(ref);
  for (const authority of input.componentAuthorities ?? []) for (const ref of authority.evidenceRefs) dependencies.add(ref);
  for (const authority of input.unitCostAuthorities ?? []) for (const ref of authority.evidenceRefs) dependencies.add(ref);
  const dependencyClosure = [...dependencies].sort().map((ref) => {
    const value = input.dependencyDigests[ref];
    if (!value) throw new TypeError(`M6_DEPENDENCY_CLOSURE_MISSING:${ref}`);
    return { ref, digest: value };
  });
  const policies = { catalog: "moment_comparison_catalog@v1", support: "global-moment-peer-support@v1", causal: "history_shared_doctrines@v3", spentDuring: "global-moment-spent-during@v1", robustStatistics: "median-iqr-mad@v1", narrative: "global-moment-narrative-importance@v1" };
  return {
    methodVersion: GLOBAL_M6_METHOD_VERSION, policies, summaries, comparisons, narrative, series, dependencyClosure,
    inputHash: digest({ moments, facts, relations, componentAuthorities: input.componentAuthorities ?? [], unitCostAuthorities: input.unitCostAuthorities ?? [], policies, dependencyClosure }),
    crossModuleSignals: { m3SeriesEvolution: series.filter((entry) => entry.transformationInputEligible).map((entry) => entry.seriesId), m5MomentRelationships: moments.map((moment) => moment.momentId), replayOwner: "P08" as const, replayExecuted: false as const },
    publicationEligible: false as const,
  };
}
