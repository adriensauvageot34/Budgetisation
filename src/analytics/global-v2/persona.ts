import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  canonicalSerializeGlobal,
  parseGlobalCoverageSet,
  parseGlobalSupport,
  type GlobalCoverageSet,
  type GlobalSupport,
} from "../../core/global-v2";
import type { PersonId } from "../../core/identity";
import { parseMoney, type Money } from "../../core/money";
import type { YearMonth } from "../../core/time";
import { parseMethodVersion } from "../../core/versions";
import { GlobalMaterialityEngine, globalMaterialityPolicies } from "./materiality";
import type { GlobalPersonalEconomicSelection } from "./economic-function";

export const GLOBAL_M9_METHOD_VERSION = parseMethodVersion("global_persona@v1");

export const globalPersonaPolicies = {
  comparison: "global-persona-comparable-intersection@v1",
  support: "global-persona-support@v1",
  coverage: "global-persona-comparable-coverage@v1",
  exceptional: "global-persona-exceptional-dominance@v1",
  ranking: "global-persona-ranking@v1",
  hysteresis: "global-persona-hysteresis@v1",
  observedCost: "global-persona-observed-cost@v1",
  enrichedReference: "global-persona-enriched-reference@v1",
} as const;

export type GlobalPersonaFamily =
  | "WORK_AND_DAY_CONTEXT"
  | "FOOD_AND_WORK_MEALS"
  | "MOBILITY"
  | "PERSONAL_CARE"
  | "PERSONAL_PURCHASES"
  | "LEISURE_AND_ACTIVITIES"
  | "SOCIAL_AND_FAMILY"
  | "PLACES"
  | "RECURRING_PERSONAL_COSTS"
  | "PRODUCTS_AND_CONSUMPTION";

export const globalPersonaFamilyCatalog: readonly GlobalPersonaFamily[] = Object.freeze([
  "WORK_AND_DAY_CONTEXT",
  "FOOD_AND_WORK_MEALS",
  "MOBILITY",
  "PERSONAL_CARE",
  "PERSONAL_PURCHASES",
  "LEISURE_AND_ACTIVITIES",
  "SOCIAL_AND_FAMILY",
  "PLACES",
  "RECURRING_PERSONAL_COSTS",
  "PRODUCTS_AND_CONSUMPTION",
]);

export type GlobalPersonaComparisonMode = "AMOUNT" | "RATE" | "FREQUENCY" | "PRESENCE" | "STRUCTURAL_EQUIVALENT";
export type GlobalPersonaTemporalStatus = "STABLE_CURRENT_REGIME" | "RECENT_ONLY" | "HISTORICAL_ONLY" | "CHANGED_DIFFERENCE" | "INSUFFICIENT_TEMPORAL_SUPPORT";
export type GlobalPersonaDataNature = "OBSERVED" | "DECLARED_EXACT" | "HYBRID" | "ESTIMATED";

export type GlobalPersonaDefinition = {
  readonly metricId: string;
  readonly family: GlobalPersonaFamily;
  readonly grain: "MONTH" | "DAY" | "OCCURRENCE" | "VISIT" | "PURCHASE_EVENT";
  readonly comparisonMode: GlobalPersonaComparisonMode;
  readonly materialityPolicyId: "PERSONA_MONEY" | "PERSONA_FREQUENCY";
  readonly allowedDataNatures: readonly GlobalPersonaDataNature[];
  readonly exceptionalPolicy: "EXCLUDE" | "SEPARATE" | "ALLOW";
  readonly humanRelevance: "CORE" | "SECONDARY";
  readonly redundancyGroup?: string;
  readonly canAppearInTopDifferences: boolean;
  readonly minimumComparableUnits: number;
  readonly methodVersion: string;
};

export type GlobalPersonaObservation = {
  readonly metricId: string;
  readonly personId: PersonId;
  readonly unitId: string;
  readonly value: string;
  readonly habitualValue: string;
  readonly exceptionalValue: string;
  readonly knowledge: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT" | "NOT_APPLICABLE";
  readonly observable: boolean;
  readonly dataNature: GlobalPersonaDataNature;
  readonly evidenceRefs: readonly string[];
};

export type GlobalPersonaMetric = {
  readonly metricId: string;
  readonly personId: PersonId;
  readonly rawValue: string | null;
  readonly habitualValue: string | null;
  readonly exceptionalValue: string | null;
  readonly observedUnitIds: readonly string[];
  readonly support: GlobalSupport;
  readonly knowledge: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT" | "NOT_APPLICABLE";
};

export type GlobalPersonaDifference = {
  readonly differenceId: string;
  readonly metricId: string;
  readonly family: GlobalPersonaFamily;
  readonly personAId: PersonId;
  readonly personBId: PersonId;
  readonly rawDifference: string | null;
  readonly habitualDifference: string | null;
  readonly exceptionalContributionShare: string | null;
  readonly comparableUnitIds: readonly string[];
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly temporalStatus: GlobalPersonaTemporalStatus;
  readonly materialityStatus: "MATERIAL" | "NOT_MATERIAL" | "INELIGIBLE";
  readonly headlineEligible: boolean;
  readonly reasonCodes: readonly string[];
  readonly score: number | null;
  readonly redundancyGroup?: string;
  readonly dataNature: GlobalPersonaDataNature;
  readonly evidenceRefs: readonly string[];
};

function canonical(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function mean(values: readonly string[]): Big {
  return values.reduce((sum, value) => sum.plus(value), new Big(0)).div(values.length);
}

function support(definition: GlobalPersonaDefinition, eligible: number, observed: number, included: number): GlobalSupport {
  return parseGlobalSupport({
    naturalGrain: definition.grain,
    eligibleUnits: eligible,
    observedUnits: observed,
    includedUnits: included,
    excludedObservedUnits: observed - included,
    minimumRequired: definition.minimumComparableUnits,
    supportStatus: included < definition.minimumComparableUnits ? "INSUFFICIENT" : included >= definition.minimumComparableUnits * 2 ? "STRONG" : "SUFFICIENT",
    policyRef: globalPersonaPolicies.support,
  });
}

function comparableCoverage(ratio: number, refs: readonly string[]): GlobalCoverageSet {
  const quotient = ratio === 0 ? {} : { numerator: ratio, denominator: 1, ratio };
  return parseGlobalCoverageSet({
    dimensions: [{
      dimension: "COMPARABLE_PERSON_SUPPORT",
      status: ratio === 1 ? "KNOWN" : ratio > 0 ? "PARTIAL" : "UNKNOWN",
      ...quotient,
      unit: "comparable-natural-unit-ratio",
      basis: "exact-intersection-over-largest-person-observable-universe",
      evidenceRefs: canonical(refs),
      policyRef: globalPersonaPolicies.coverage,
    }],
    requiredDimensions: ["COMPARABLE_PERSON_SUPPORT"],
    ...(ratio === 0 ? {} : { effective: ratio }),
    aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
}

function materialityCoverage(refs: readonly string[]): GlobalCoverageSet {
  return parseGlobalCoverageSet({
    dimensions: [{
      dimension: "COMPARABLE_PERSON_SUPPORT",
      status: "KNOWN",
      numerator: 1,
      denominator: 1,
      ratio: 1,
      unit: "closed-comparable-intersection",
      basis: "materiality-is-evaluated-only-inside-the-proven-intersection",
      evidenceRefs: canonical(refs),
      policyRef: globalPersonaPolicies.coverage,
    }],
    requiredDimensions: ["COMPARABLE_PERSON_SUPPORT"],
    effective: 1,
    aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
}

function weakestNature(values: readonly GlobalPersonaDataNature[]): GlobalPersonaDataNature {
  const rank: Record<GlobalPersonaDataNature, number> = { OBSERVED: 0, DECLARED_EXACT: 1, HYBRID: 2, ESTIMATED: 3 };
  return [...values].sort((a, b) => rank[b] - rank[a] || a.localeCompare(b))[0] ?? "ESTIMATED";
}

function scoreOf(input: {
  readonly effectRatio: number;
  readonly temporalStatus: GlobalPersonaTemporalStatus;
  readonly support: GlobalSupport;
  readonly coverage: number;
  readonly dataNature: GlobalPersonaDataNature;
  readonly relevance: "CORE" | "SECONDARY";
}): number {
  const effect = Math.min(Math.max(input.effectRatio, 0), 2) / 2;
  const persistence = input.temporalStatus === "STABLE_CURRENT_REGIME" ? 1 : input.temporalStatus === "RECENT_ONLY" ? 0.6 : 0;
  const support = input.support.supportStatus === "STRONG" ? 1 : input.support.supportStatus === "SUFFICIENT" ? 0.75 : 0;
  const coverage = Math.min(Math.max((input.coverage - 0.85) / 0.1, 0), 1);
  const authority = { OBSERVED: 1, DECLARED_EXACT: 0.9, HYBRID: 0.8, ESTIMATED: 0.65 }[input.dataNature];
  return Number((0.35 * effect + 0.2 * persistence + 0.15 * support + 0.1 * coverage + 0.1 * authority + 0.1 * (input.relevance === "CORE" ? 1 : 0.6)).toFixed(9));
}

function assertDefinitions(definitions: readonly GlobalPersonaDefinition[]): void {
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.metricId)) throw new TypeError(`P11_DUPLICATE_PERSONA_METRIC:${definition.metricId}`);
    ids.add(definition.metricId);
    if (definition.minimumComparableUnits < 1) throw new TypeError(`P11_INVALID_SUPPORT:${definition.metricId}`);
    if (definition.allowedDataNatures.length === 0) throw new TypeError(`P11_EMPTY_DATA_NATURES:${definition.metricId}`);
  }
}

function canonicalObservations(observations: readonly GlobalPersonaObservation[]): readonly GlobalPersonaObservation[] {
  const identities = new Map<string, GlobalPersonaObservation>();
  for (const row of observations) {
    const identity = `${row.metricId}\u0000${row.personId}\u0000${row.unitId}`;
    const previous = identities.get(identity);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(row)) {
      throw new TypeError(`P11_CONTRADICTORY_OBSERVATION:${row.metricId}:${row.unitId}`);
    }
    identities.set(identity, row);
  }
  return [...identities.values()].sort((a, b) => a.metricId.localeCompare(b.metricId) || a.personId.localeCompare(b.personId) || a.unitId.localeCompare(b.unitId));
}

export function buildGlobalPersonaMetrics(input: {
  readonly definitions: readonly GlobalPersonaDefinition[];
  readonly personIds: readonly PersonId[];
  readonly observations: readonly GlobalPersonaObservation[];
}): readonly GlobalPersonaMetric[] {
  assertDefinitions(input.definitions);
  const observations = canonicalObservations(input.observations);
  const authorized = new Set(input.personIds);
  if (authorized.size !== input.personIds.length || authorized.size < 2) throw new TypeError("P11_PERSON_SCOPE_INVALID");
  for (const row of input.observations) if (!authorized.has(row.personId)) throw new TypeError("P11_PERSON_OUTSIDE_SCOPE");
  return input.definitions.flatMap((definition) => [...authorized].sort().map((personId) => {
    const rows = observations.filter((row) => row.metricId === definition.metricId && row.personId === personId);
    const known = rows.filter((row) => row.observable && row.knowledge === "KNOWN" && definition.allowedDataNatures.includes(row.dataNature));
    const conflict = rows.some((row) => row.knowledge === "CONFLICT");
    const observedIds = canonical(known.map(({ unitId }) => unitId));
    return {
      metricId: definition.metricId,
      personId,
      rawValue: known.length === 0 ? null : mean(known.map(({ value }) => value)).toFixed(),
      habitualValue: known.length === 0 ? null : mean(known.map(({ habitualValue }) => habitualValue)).toFixed(),
      exceptionalValue: known.length === 0 ? null : mean(known.map(({ exceptionalValue }) => exceptionalValue)).toFixed(),
      observedUnitIds: observedIds,
      support: support(definition, rows.length, rows.filter(({ observable }) => observable).length, known.length),
      knowledge: conflict ? "CONFLICT" : known.length === 0 ? "UNKNOWN" : known.length < rows.length ? "PARTIAL" : "KNOWN",
    } satisfies GlobalPersonaMetric;
  }));
}

export function buildGlobalPersonaDifferences(input: {
  readonly definitions: readonly GlobalPersonaDefinition[];
  readonly personAId: PersonId;
  readonly personBId: PersonId;
  readonly observations: readonly GlobalPersonaObservation[];
  readonly temporalStatusByMetric: Readonly<Record<string, GlobalPersonaTemporalStatus>>;
}): readonly GlobalPersonaDifference[] {
  assertDefinitions(input.definitions);
  const observations = canonicalObservations(input.observations);
  if (input.personAId === input.personBId) throw new TypeError("P11_COMPARISON_REQUIRES_DISTINCT_PERSONS");
  const materiality = new GlobalMaterialityEngine();
  return [...input.definitions].sort((a, b) => a.metricId.localeCompare(b.metricId)).map((definition) => {
    const rows = observations.filter(({ metricId }) => metricId === definition.metricId);
    const byPerson = (personId: PersonId) => new Map(rows.filter((row) => row.personId === personId && row.observable).map((row) => [row.unitId, row]));
    const a = byPerson(input.personAId);
    const b = byPerson(input.personBId);
    const commonIds = canonical([...a.keys()].filter((unitId) => b.has(unitId)));
    const validPairs = commonIds.map((unitId) => [a.get(unitId)!, b.get(unitId)!] as const).filter(([left, right]) =>
      left.knowledge === "KNOWN" && right.knowledge === "KNOWN" &&
      definition.allowedDataNatures.includes(left.dataNature) && definition.allowedDataNatures.includes(right.dataNature));
    const refs = canonical(validPairs.flatMap(([left, right]) => [...left.evidenceRefs, ...right.evidenceRefs]));
    const largestUniverse = Math.max(a.size, b.size);
    const coverageRatio = largestUniverse === 0 ? 0 : validPairs.length / largestUniverse;
    const comparableSupport = support(definition, largestUniverse, commonIds.length, validPairs.length);
    const coverage = comparableCoverage(coverageRatio, refs);
    const raw = validPairs.length === 0 ? null : mean(validPairs.map(([left, right]) => new Big(left.value).minus(right.value).toFixed()));
    const habitual = validPairs.length === 0 ? null : mean(validPairs.map(([left, right]) => new Big(left.habitualValue).minus(right.habitualValue).toFixed()));
    const exceptional = validPairs.length === 0 ? null : mean(validPairs.map(([left, right]) => new Big(left.exceptionalValue).minus(right.exceptionalValue).toFixed()));
    const exceptionalShare = raw === null || raw.eq(0) || exceptional === null ? null : exceptional.abs().div(raw.abs()).toFixed();
    const effective = definition.exceptionalPolicy === "ALLOW" ? raw : habitual;
    const absolute = effective?.abs().toFixed();
    const baseline = validPairs.length === 0 ? null : mean(validPairs.map(([, right]) => right.habitualValue)).abs();
    const relative = absolute === undefined || baseline === null || baseline.eq(0) ? undefined : new Big(absolute).div(baseline).toFixed();
    const policy = globalMaterialityPolicies[definition.materialityPolicyId];
    const evaluation = materiality.evaluate({
      candidate: {
        candidateId: `persona:${definition.metricId}:${input.personAId}:${input.personBId}`,
        phenomenonId: `persona:${definition.metricId}`,
        metricRef: definition.metricId,
        effect: { ...(absolute === undefined ? {} : { absolute }), ...(relative === undefined ? {} : { relative }) },
        knowledgeState: effective === null ? "UNKNOWN" : "KNOWN",
        support: comparableSupport,
        coverage: materialityCoverage(refs),
        evidenceRefs: refs,
        entityRefs: [input.personAId, input.personBId],
        methodVersion: GLOBAL_M9_METHOD_VERSION,
        materialityPolicy: policy.ref,
      },
      policyId: definition.materialityPolicyId,
      structuralEquivalent: definition.comparisonMode === "STRUCTURAL_EQUIVALENT",
      zeroBaseline: baseline?.eq(0) === true,
    });
    const temporalStatus = input.temporalStatusByMetric[definition.metricId] ?? "INSUFFICIENT_TEMPORAL_SUPPORT";
    const dominated = exceptionalShare !== null && new Big(exceptionalShare).gte("0.5") && evaluation.status !== "MATERIAL";
    const nature = weakestNature(validPairs.flatMap(([left, right]) => [left.dataNature, right.dataNature]));
    const headlineEligible = definition.canAppearInTopDifferences && evaluation.status === "MATERIAL" && coverageRatio >= 0.85 &&
      (temporalStatus === "STABLE_CURRENT_REGIME" || temporalStatus === "RECENT_ONLY") && !dominated;
    const threshold = policy.minimumAbsolute;
    const effectRatio = absolute === undefined ? 0 : Number(new Big(absolute).div(threshold).toFixed());
    const reasonCodes = canonical([
      ...(validPairs.length < definition.minimumComparableUnits ? ["INSUFFICIENT_COMPARABLE_SUPPORT"] : []),
      ...(coverageRatio < 0.85 ? [coverageRatio >= 0.6 ? "DETAIL_ONLY_PARTIAL_COVERAGE" : "INSUFFICIENT_COMPARABLE_COVERAGE"] : []),
      ...(evaluation.status !== "MATERIAL" ? ["NOT_MATERIAL"] : []),
      ...(dominated ? ["DOMINANT_EXCEPTIONAL_WITHOUT_HABITUAL_MATERIALITY"] : []),
      ...(!["STABLE_CURRENT_REGIME", "RECENT_ONLY"].includes(temporalStatus) ? [temporalStatus] : []),
    ]);
    return {
      differenceId: `persona:${definition.metricId}:${input.personAId}:${input.personBId}`,
      metricId: definition.metricId,
      family: definition.family,
      personAId: input.personAId,
      personBId: input.personBId,
      rawDifference: raw?.toFixed() ?? null,
      habitualDifference: habitual?.toFixed() ?? null,
      exceptionalContributionShare: exceptionalShare,
      comparableUnitIds: validPairs.map(([left]) => left.unitId),
      support: comparableSupport,
      coverage,
      temporalStatus,
      materialityStatus: evaluation.status === "MATERIAL" ? "MATERIAL" : evaluation.status === "NOT_MATERIAL" ? "NOT_MATERIAL" : "INELIGIBLE",
      headlineEligible,
      reasonCodes,
      score: headlineEligible ? scoreOf({ effectRatio, temporalStatus, support: comparableSupport, coverage: coverageRatio, dataNature: nature, relevance: definition.humanRelevance }) : null,
      ...(definition.redundancyGroup === undefined ? {} : { redundancyGroup: definition.redundancyGroup }),
      dataNature: nature,
      evidenceRefs: refs,
    } satisfies GlobalPersonaDifference;
  });
}

export function selectGlobalPersonaTopDifferences(input: {
  readonly candidates: readonly GlobalPersonaDifference[];
  readonly previousSelection?: Readonly<Record<string, number>>;
}): readonly GlobalPersonaDifference[] {
  const deduped = new Map<string, GlobalPersonaDifference>();
  for (const candidate of input.candidates) {
    const previous = deduped.get(candidate.differenceId);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(candidate)) throw new TypeError("P11_CONTRADICTORY_CANDIDATE");
    deduped.set(candidate.differenceId, candidate);
  }
  const eligible = [...deduped.values()].filter(({ headlineEligible, score }) => headlineEligible && score !== null);
  const adjusted = eligible.map((candidate) => {
    const oldScore = input.previousSelection?.[candidate.differenceId];
    const strongestChallenger = Math.max(0, ...eligible.filter(({ differenceId }) => differenceId !== candidate.differenceId).map(({ score }) => score ?? 0));
    const protectedByHysteresis = oldScore !== undefined && strongestChallenger < oldScore * 1.1;
    return { candidate, priority: protectedByHysteresis ? oldScore + 1 : candidate.score! };
  }).sort((a, b) => b.priority - a.priority || a.candidate.differenceId.localeCompare(b.candidate.differenceId));
  const selected: GlobalPersonaDifference[] = [];
  const familyCount = new Map<GlobalPersonaFamily, number>();
  const redundancy = new Set<string>();
  let recent = 0;
  let nonObserved = 0;
  const observedAvailable = adjusted.filter(({ candidate }) => candidate.dataNature === "OBSERVED").length;
  const enforceNatureCap = observedAvailable >= Math.min(4, adjusted.length);
  for (const { candidate } of adjusted) {
    if (selected.length === 6) break;
    if ((familyCount.get(candidate.family) ?? 0) >= 2) continue;
    if (candidate.redundancyGroup !== undefined && redundancy.has(candidate.redundancyGroup)) continue;
    if (candidate.temporalStatus === "RECENT_ONLY" && recent >= 1) continue;
    if (enforceNatureCap && candidate.dataNature !== "OBSERVED" && nonObserved >= 2) continue;
    selected.push(candidate);
    familyCount.set(candidate.family, (familyCount.get(candidate.family) ?? 0) + 1);
    if (candidate.redundancyGroup !== undefined) redundancy.add(candidate.redundancyGroup);
    if (candidate.temporalStatus === "RECENT_ONLY") recent += 1;
    if (candidate.dataNature !== "OBSERVED") nonObserved += 1;
  }
  return selected;
}

export type GlobalObservedPersonalMonth = {
  readonly month: YearMonth;
  readonly amount: Money;
  readonly financialSourceCoverage: number;
  readonly personalAttributionCoverage: number;
  readonly knowledge: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT" | "NOT_APPLICABLE";
  readonly evidenceRefs: readonly string[];
};

export type GlobalObservedPersonalTypicalCost = {
  readonly status: "HEADLINE_READY" | "QUALIFIED_DETAIL" | "UNAVAILABLE";
  readonly value: Money | null;
  readonly supportMonths: number;
  readonly financialSourceCoverage: number | null;
  readonly personalAttributionCoverage: number | null;
  readonly evidenceRefs: readonly string[];
};

export function buildObservedPersonalTypicalCost(months: readonly GlobalObservedPersonalMonth[]): GlobalObservedPersonalTypicalCost {
  const canonicalMonths = [...months].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  if (new Set(canonicalMonths.map(({ month }) => month)).size !== canonicalMonths.length) throw new TypeError("P11_DUPLICATE_PERSON_MONTH");
  const known = canonicalMonths.filter(({ knowledge }) => knowledge === "KNOWN");
  const financial = known.length === 0 ? null : Math.min(...known.map(({ financialSourceCoverage }) => financialSourceCoverage));
  const attribution = known.length === 0 ? null : Math.min(...known.map(({ personalAttributionCoverage }) => personalAttributionCoverage));
  const sorted = known.map(({ amount }) => new Big(amount)).sort((a, b) => a.cmp(b));
  const middle = sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : sorted[sorted.length / 2 - 1].plus(sorted[sorted.length / 2]).div(2);
  const status = known.length < 6 || financial === null || attribution === null || attribution < 0.6
    ? "UNAVAILABLE"
    : financial === 1 && attribution >= 0.85 ? "HEADLINE_READY" : "QUALIFIED_DETAIL";
  return {
    status,
    value: middle === null || status === "UNAVAILABLE" ? null : parseMoney(middle.toFixed()),
    supportMonths: known.length,
    financialSourceCoverage: financial,
    personalAttributionCoverage: attribution,
    evidenceRefs: canonical(known.flatMap(({ evidenceRefs }) => evidenceRefs)),
  };
}

/** P01 attribution adapter. It never substitutes payer or Household money for a beneficiary. */
export function adaptObservedPersonalMonthsFromP01(input: readonly {
  readonly month: YearMonth;
  readonly selection: GlobalPersonalEconomicSelection;
  readonly financialSourceCoverage: number;
  readonly evidenceRefs: readonly string[];
}[]): readonly GlobalObservedPersonalMonth[] {
  return [...input].sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
    month: row.month,
    amount: row.selection.attributableAmount,
    financialSourceCoverage: row.financialSourceCoverage,
    personalAttributionCoverage: row.selection.amountCoverage ?? 0,
    knowledge: row.selection.value.status,
    evidenceRefs: canonical([...row.evidenceRefs, `p01-selection:${row.selection.inputHash}`]),
  }));
}

export type GlobalPersonalReferenceContribution = {
  readonly contributionId: string;
  readonly amount: Money;
  readonly nature: GlobalPersonaDataNature;
  readonly integrationMode: "OBSERVED" | "SUPPLEMENT_UNOBSERVED" | "INFORMATIONAL_ONLY";
  readonly economicIdentityRefs: readonly string[];
  readonly structurallyApplicable: boolean;
  readonly evidenceRefs: readonly string[];
};

export type GlobalPersonalReferenceCost = {
  readonly status: "HEADLINE_READY" | "QUALIFIED_REFERENCE" | "COMPONENTS_ONLY" | "AUTHORITY_GATED";
  readonly value: Money | null;
  readonly groundedShare: number | null;
  readonly estimatedShare: number | null;
  readonly includedContributionIds: readonly string[];
  readonly excludedContributionIds: readonly string[];
  readonly reasonCodes: readonly string[];
};

export function buildGlobalPersonalReferenceCost(input: {
  readonly authority: "AG022_CLOSED" | "EXPLICIT_ENRICHMENT_AUTHORITY";
  readonly personalAttributionCoverage: number;
  readonly supportMonths: number;
  readonly contributions: readonly GlobalPersonalReferenceContribution[];
}): GlobalPersonalReferenceCost {
  if (input.authority === "AG022_CLOSED") return { status: "AUTHORITY_GATED", value: null, groundedShare: null, estimatedShare: null, includedContributionIds: [], excludedContributionIds: input.contributions.map(({ contributionId }) => contributionId).sort(), reasonCodes: ["AG022_PERSONAL_REFERENCE_AUTHORITY_ABSENT"] };
  const seenIdentities = new Set<string>();
  const included: GlobalPersonalReferenceContribution[] = [];
  const excluded: GlobalPersonalReferenceContribution[] = [];
  const integrationRank = { OBSERVED: 0, SUPPLEMENT_UNOBSERVED: 1, INFORMATIONAL_ONLY: 2 } as const;
  for (const contribution of [...input.contributions].sort((a, b) => integrationRank[a.integrationMode] - integrationRank[b.integrationMode] || a.contributionId.localeCompare(b.contributionId))) {
    if (new Big(contribution.amount).lt(0)) throw new TypeError(`P11_NEGATIVE_PERSONAL_REFERENCE_COST:${contribution.contributionId}`);
    const overlaps = contribution.economicIdentityRefs.some((ref) => seenIdentities.has(ref));
    if (contribution.integrationMode === "INFORMATIONAL_ONLY" || overlaps) excluded.push(contribution);
    else {
      included.push(contribution);
      contribution.economicIdentityRefs.forEach((ref) => seenIdentities.add(ref));
    }
  }
  const total = included.reduce((sum, row) => sum.plus(row.amount), new Big(0));
  const grounded = included.filter(({ nature }) => nature === "OBSERVED" || nature === "DECLARED_EXACT").reduce((sum, row) => sum.plus(row.amount), new Big(0));
  const estimated = included.filter(({ nature }) => nature === "ESTIMATED" || nature === "HYBRID").reduce((sum, row) => sum.plus(row.amount), new Big(0));
  const groundedShare = total.eq(0) ? null : Number(grounded.div(total).toFixed());
  const estimatedShare = total.eq(0) ? null : Number(estimated.div(total).toFixed());
  const supplements = included.filter(({ integrationMode }) => integrationMode === "SUPPLEMENT_UNOBSERVED");
  const supplement = supplements.reduce((sum, row) => sum.plus(row.amount), new Big(0));
  const supplementAllowed = total.eq(0) || supplement.div(total).lte(0.25) || supplements.every(({ nature, structurallyApplicable }) => nature === "DECLARED_EXACT" && structurallyApplicable);
  const headline = input.personalAttributionCoverage >= 0.85 && input.supportMonths >= 6 && groundedShare !== null && groundedShare >= 0.7 && (estimatedShare ?? 1) <= 0.3 && supplementAllowed;
  const qualified = input.personalAttributionCoverage >= 0.6 && input.supportMonths >= 6 && groundedShare !== null && groundedShare >= 0.5;
  return {
    status: headline ? "HEADLINE_READY" : qualified ? "QUALIFIED_REFERENCE" : "COMPONENTS_ONLY",
    value: total.eq(0) || (!headline && !qualified) ? null : parseMoney(total.toFixed()),
    groundedShare,
    estimatedShare,
    includedContributionIds: included.map(({ contributionId }) => contributionId),
    excludedContributionIds: excluded.map(({ contributionId }) => contributionId),
    reasonCodes: canonical([
      ...(input.personalAttributionCoverage < 0.85 ? ["PERSON_ATTRIBUTION_COVERAGE_BELOW_HEADLINE"] : []),
      ...(input.supportMonths < 6 ? ["INSUFFICIENT_MONTH_SUPPORT"] : []),
      ...(groundedShare === null || groundedShare < 0.7 ? ["GROUNDED_SHARE_BELOW_HEADLINE"] : []),
      ...((estimatedShare ?? 1) > 0.3 ? ["ESTIMATED_SHARE_ABOVE_HEADLINE"] : []),
      ...(!supplementAllowed ? ["SUPPLEMENT_SHARE_ABOVE_LIMIT"] : []),
      ...(excluded.length > 0 ? ["OVERLAP_OR_INFORMATIONAL_EXCLUDED"] : []),
    ]),
  };
}

export function computeGlobalPersonaInputHash(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(`global-persona-input@v1\n${canonicalSerializeGlobal(value)}`)));
}
