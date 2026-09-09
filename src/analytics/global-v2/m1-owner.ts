import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { MinimalMonthComponent } from "../baseline";
import type { ProducedMoneyMetric } from "../production";
import {
  canonicalSerializeGlobal,
  parseGlobalCoverageSet,
  parseGlobalSupport,
  type GlobalCoverageSet,
  type GlobalDependencyDeclaration,
  type GlobalSupport,
  type GlobalValueProvenance,
} from "../../core/global-v2";
import { addMoney, parseMoney, type Money } from "../../core/money";
import type { Instant, LocalDate, YearMonth } from "../../core/time";
import type { AnalyticsRevision, DataRevision, MethodVersion } from "../../core/versions";
import type {
  GlobalEconomicStructure,
  GlobalMinimalAuthority,
  GlobalTypicalPair,
} from "./economic-function";

const ZERO = parseMoney("0");
export const GLOBAL_M1_OWNER_METHOD_VERSION = "global_m1_owner@v2" as MethodVersion;

function digest(label: string, value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(`${label}\n${canonicalSerializeGlobal(value)}`)));
}

function sum(values: readonly Money[]): Money {
  return values.reduce(addMoney, ZERO);
}

function moneyValue(metric: ProducedMoneyMetric): Money | undefined {
  return metric.availability === "known" ? metric.value : undefined;
}

export type GlobalM1Materiality =
  | { readonly status: "MATERIAL" | "NOT_MATERIAL"; readonly policyRef: string }
  | { readonly status: "UNKNOWN"; readonly reasonCode: string; readonly policyRef: string };

export type GlobalM1QualifiedMoney = {
  readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
  readonly value?: Money;
  readonly unit: "EUR/month" | "EUR/occurrence" | "EUR";
  readonly reasonCode?: string;
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly materiality: GlobalM1Materiality;
  readonly provenance: GlobalValueProvenance;
  readonly methodVersion: MethodVersion;
  readonly inputHash: string;
};

export type GlobalM1HistoryPoint = {
  readonly month: YearMonth;
  readonly actual: GlobalM1QualifiedMoney;
  readonly typicalState: GlobalM1QualifiedMoney;
  readonly minimalState: GlobalM1QualifiedMoney;
  readonly typicalReference?: GlobalM1QualifiedMoney;
  readonly lineage: {
    readonly asOf: Instant;
    readonly certifiedThrough: LocalDate;
    readonly sourceRevision: DataRevision;
    readonly analyticsRevision: AnalyticsRevision;
    readonly dependencyRefs: readonly string[];
  };
};

export type GlobalM1HistoryInput = {
  readonly month: YearMonth;
  readonly actual: { readonly value: import("../../core/global-v2").GlobalKnowledgeValue<Money>; readonly inputHash: string };
  readonly typical: GlobalTypicalPair;
  readonly minimal: GlobalMinimalAuthority;
  readonly dependencyRefs: readonly string[];
};

export type GlobalM1RecurrenceObservation = {
  readonly recurrenceId: string;
  readonly occurrenceId: string;
  readonly economicDate: LocalDate;
  readonly amount: Money;
  readonly evidenceRefs: readonly string[];
};

export type GlobalM1RecurrenceAuthority = {
  readonly recurrenceId: string;
  readonly expectedOccurrenceAmount?: Money;
  readonly expectedOccurrencesPerYear?: number;
  readonly lifecycle?: "ACTIVE" | "ENDED" | "INTERRUPTED" | "RESTARTED";
  readonly change?: "NEW" | "ENDED" | "RESTARTED";
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo?: LocalDate;
  readonly declaredAt: Instant;
  readonly sourceRevision: DataRevision;
  readonly evidenceRefs: readonly string[];
};

export type GlobalM1RecurrenceSeries = {
  readonly recurrenceId: string;
  readonly labelRef: string;
  readonly firstObservedAt: LocalDate;
  readonly lastObservedAt: LocalDate;
  readonly typicalOccurrenceCost: GlobalM1QualifiedMoney;
  readonly cadence: { readonly status: "KNOWN"; readonly expectedOccurrencesPerYear: number } | { readonly status: "UNKNOWN"; readonly reasonCode: string };
  readonly expectedOccurrenceAmount: GlobalM1QualifiedMoney;
  readonly monthlyEquivalent: GlobalM1QualifiedMoney;
  readonly priceEvolution: { readonly status: "UNKNOWN"; readonly reasonCode: string };
  readonly lifecycle: { readonly status: "KNOWN"; readonly value: "ACTIVE" | "ENDED" | "INTERRUPTED" | "RESTARTED" } | { readonly status: "UNKNOWN"; readonly reasonCode: string };
  readonly support: GlobalSupport;
  readonly provenance: GlobalValueProvenance;
  readonly inputHash: string;
};

export type GlobalM1Contributor = {
  readonly contributorId: string;
  readonly source: "RECURRENCE_CHANGE" | "STRUCTURE_CHANGE" | "M2_QUALIFIED" | "CONTRACTED_MODULE";
  readonly typedDelta: GlobalM1QualifiedMoney;
  readonly additiveDecomposition: boolean;
  readonly publicationEligible: boolean;
  readonly evidenceRefs: readonly string[];
};

type QualifiedConditional<Value> =
  | { readonly status: "KNOWN"; readonly value: Value; readonly methodVersion: MethodVersion; readonly inputHash: string }
  | { readonly status: "UNKNOWN"; readonly reasonCode: string; readonly methodVersion: MethodVersion; readonly inputHash: string };

export type GlobalM1OwnerOutputV2 = {
  readonly moduleKey: "ECONOMIC";
  readonly targetMonth: YearMonth;
  readonly certifiedThrough: LocalDate;
  readonly state: {
    readonly actual: GlobalM1QualifiedMoney;
    readonly typicalReference: GlobalM1QualifiedMoney;
    readonly typicalReferenceMonths: readonly YearMonth[];
    readonly typicalState: GlobalM1QualifiedMoney;
    readonly typicalStateMonths: readonly YearMonth[];
    readonly minimalState: GlobalM1QualifiedMoney;
    readonly comparisons: {
      readonly actualVsTypicalReference: GlobalM1QualifiedMoney;
      readonly typicalStateVsMinimalState: GlobalM1QualifiedMoney;
    };
  };
  readonly history: { readonly points: readonly GlobalM1HistoryPoint[]; readonly inputHash: string };
  readonly structure: {
    readonly semanticBase: "ACTUAL_TARGET_MONTH";
    readonly necessity: GlobalM1StructureAxis;
    readonly behavior: GlobalM1StructureAxis;
    readonly lifeScope: GlobalM1StructureAxis;
    readonly inputHash: string;
  };
  readonly temporal: Readonly<Record<string, unknown>> & {
    readonly currentRegimeReference: QualifiedConditional<unknown>;
    readonly longTermEvolution: QualifiedConditional<unknown>;
  };
  readonly recurrences: {
    readonly series: readonly GlobalM1RecurrenceSeries[];
    readonly structuralRecurringCost: GlobalM1QualifiedMoney;
    readonly newRecurringEquivalent: GlobalM1QualifiedMoney;
    readonly endedRecurringEquivalent: GlobalM1QualifiedMoney;
    readonly restartedRecurringEquivalent: GlobalM1QualifiedMoney;
    readonly priceChangeExistingRecurrences: GlobalM1QualifiedMoney;
    readonly inputHash: string;
  };
  readonly contributors: readonly GlobalM1Contributor[];
  readonly conditional: {
    readonly longTerm: QualifiedConditional<unknown>;
    readonly currentRegime: QualifiedConditional<unknown>;
    readonly periodicity: QualifiedConditional<unknown>;
  };
  readonly methodology: {
    readonly asOf: Instant;
    readonly certifiedThrough: LocalDate;
    readonly methods: readonly MethodVersion[];
    readonly support: GlobalSupport;
    readonly coverage: GlobalCoverageSet;
    readonly limitations: readonly string[];
    readonly revisions: { readonly dataRevision: DataRevision; readonly analyticsRevision: AnalyticsRevision };
    readonly evidenceRefs: readonly string[];
    readonly dependencyDeclaration: GlobalDependencyDeclaration;
  };
  readonly factsDigest: string;
  readonly classificationsDigest: string;
  readonly dependencyDeclaration: GlobalDependencyDeclaration;
  readonly inputHash: string;
};

export type GlobalM1StructureAxis = {
  readonly buckets: readonly { readonly key: string; readonly amount: Money; readonly share?: string }[];
  readonly total: Money;
  readonly unknownAmount: Money;
  readonly conflictAmount: Money;
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly evolution: { readonly status: "UNKNOWN"; readonly reasonCode: "COMPATIBLE_STRUCTURE_REFERENCE_UNAVAILABLE" };
};

function support(grain: "MONTH" | "ECONOMIC_COMPONENT" | "OCCURRENCE", eligible: number, included: number, minimum: number, policyRef: string): GlobalSupport {
  return parseGlobalSupport({
    naturalGrain: grain,
    eligibleUnits: eligible,
    observedUnits: eligible,
    includedUnits: included,
    excludedObservedUnits: eligible - included,
    minimumRequired: minimum,
    supportStatus: included < minimum ? "INSUFFICIENT" : included >= Math.max(minimum * 2, 12) ? "STRONG" : "SUFFICIENT",
    ...(grain === "OCCURRENCE" ? { occurrenceCount: included } : {}),
    policyRef,
  });
}

function coverage(dimension: "FINANCIAL_SOURCE" | "CLASSIFICATION", included: number, eligible: number, basis: string, evidenceRefs: readonly string[]): GlobalCoverageSet {
  const known = eligible > 0;
  const ratio = known ? included / eligible : undefined;
  return parseGlobalCoverageSet({
    dimensions: [{
      dimension,
      status: !known ? "UNKNOWN" : included === eligible ? "KNOWN" : "PARTIAL",
      ...(ratio === undefined ? {} : { numerator: included, denominator: eligible, ratio }),
      unit: dimension === "CLASSIFICATION" ? "economic-component" : "natural-unit",
      basis,
      evidenceRefs: [...new Set(evidenceRefs)].sort(),
      policyRef: `global-m1-${dimension.toLowerCase()}-coverage@v1`,
    }],
    requiredDimensions: [dimension],
    ...(ratio === undefined ? {} : { effective: ratio }),
    aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
}

function provenance(input: {
  readonly nature: GlobalValueProvenance["resultNature"];
  readonly sourceRefs: readonly string[];
  readonly factRefs?: readonly string[];
  readonly upstreamMetricRefs?: readonly string[];
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
}): GlobalValueProvenance {
  return {
    resultNature: input.nature,
    precision: "EXACT",
    integrationMode: "DERIVED_FROM_OBSERVED",
    monetaryBasis: "AUTHORITATIVE_ECONOMIC",
    sourceRefs: [...new Set(input.sourceRefs)].sort(),
    factRefs: [...new Set(input.factRefs ?? [])].sort(),
    evidenceRefs: [...new Set(input.sourceRefs)].sort(),
    entityRefs: [],
    upstreamMetricRefs: [...new Set(input.upstreamMetricRefs ?? [])].sort(),
    methodVersion: GLOBAL_M1_OWNER_METHOD_VERSION,
    policyVersions: {
      qualification: "v1" as import("../../core/versions").PolicyVersion,
      localUnknown: "v1" as import("../../core/versions").PolicyVersion,
    },
    dataRevision: input.dataRevision,
    analyticsRevision: input.analyticsRevision,
  };
}

function qualified(input: {
  readonly status: GlobalM1QualifiedMoney["status"];
  readonly value?: Money;
  readonly unit: GlobalM1QualifiedMoney["unit"];
  readonly reasonCode?: string;
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly provenance: GlobalValueProvenance;
  readonly methodVersion?: MethodVersion;
  readonly input: unknown;
}): GlobalM1QualifiedMoney {
  return {
    status: input.status,
    ...(input.value === undefined ? {} : { value: parseMoney(input.value) }),
    unit: input.unit,
    ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
    support: input.support,
    coverage: input.coverage,
    materiality: { status: "UNKNOWN", reasonCode: "MATERIALITY_NOT_REQUIRED_FOR_VALUE", policyRef: "global-m1-value-materiality@v1" },
    provenance: input.provenance,
    methodVersion: input.methodVersion ?? GLOBAL_M1_OWNER_METHOD_VERSION,
    inputHash: digest("global-m1-qualified-value@v2", input.input),
  };
}

function fromKnowledge(input: {
  readonly knowledge: import("../../core/global-v2").GlobalKnowledgeValue<Money>;
  readonly unit: GlobalM1QualifiedMoney["unit"];
  readonly fallbackSupport: GlobalSupport;
  readonly fallbackCoverage: GlobalCoverageSet;
  readonly provenance: GlobalValueProvenance;
  readonly inputHash: string;
  readonly unknownReason: string;
}): GlobalM1QualifiedMoney {
  const value = "value" in input.knowledge ? input.knowledge.value : undefined;
  return qualified({
    status: input.knowledge.status,
    ...(value === undefined ? {} : { value }),
    unit: input.unit,
    ...(value === undefined ? { reasonCode: input.unknownReason } : {}),
    support: input.knowledge.support ?? input.fallbackSupport,
    coverage: input.knowledge.coverage ?? input.fallbackCoverage,
    provenance: input.knowledge.provenance ?? input.provenance,
    input: input.inputHash,
  });
}

function fromMetric(input: {
  readonly metric: ProducedMoneyMetric;
  readonly inputHash: string;
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly provenance: GlobalValueProvenance;
  readonly unknownReason: string;
}): GlobalM1QualifiedMoney {
  const value = moneyValue(input.metric);
  const status = input.metric.availability === "known"
    ? input.metric.coverage?.level === "partial" ? "PARTIAL" : "KNOWN"
    : input.metric.availability === "conflict" ? "CONFLICT"
      : input.metric.availability === "not_applicable" ? "NOT_APPLICABLE" : "UNKNOWN";
  return qualified({
    status,
    ...(value === undefined ? {} : { value }),
    unit: "EUR/month",
    ...(value === undefined ? { reasonCode: input.unknownReason } : {}),
    support: input.support,
    coverage: input.coverage,
    provenance: input.provenance,
    input: input.inputHash,
  });
}

function comparison(left: GlobalM1QualifiedMoney, right: GlobalM1QualifiedMoney, id: string): GlobalM1QualifiedMoney {
  if (left.value === undefined || right.value === undefined) {
    return qualified({
      status: "UNKNOWN", unit: "EUR/month", reasonCode: "COMPARISON_OPERAND_UNKNOWN",
      support: left.support, coverage: left.coverage, provenance: left.provenance,
      input: { id, left: left.inputHash, right: right.inputHash },
    });
  }
  return qualified({
    status: left.status === "KNOWN" && right.status === "KNOWN" ? "KNOWN" : "PARTIAL",
    value: parseMoney(new Big(left.value).minus(right.value).toFixed()), unit: "EUR/month",
    support: left.support, coverage: left.coverage, provenance: left.provenance,
    input: { id, left: left.inputHash, right: right.inputHash },
  });
}

function structureAxis(raw: GlobalEconomicStructure["necessity"], evidenceRefs: readonly string[]): GlobalM1StructureAxis {
  const amounts = Object.entries(raw.amounts).sort(([left], [right]) => left.localeCompare(right));
  const total = sum([...amounts.map(([, amount]) => amount), raw.unknownAmount, raw.conflictAmount]);
  return {
    buckets: amounts.map(([key, amount]) => ({ key, amount, ...(new Big(total).eq(0) ? {} : { share: new Big(amount).div(total).toFixed() }) })),
    total,
    unknownAmount: raw.unknownAmount,
    conflictAmount: raw.conflictAmount,
    support: support("ECONOMIC_COMPONENT", raw.eligibleComponentCount, raw.classifiedComponentCount, 1, "global-m1-structure-support@v1"),
    coverage: coverage("CLASSIFICATION", raw.classifiedComponentCount, raw.eligibleComponentCount, "classified-components-over-eligible-components", evidenceRefs),
    evolution: { status: "UNKNOWN", reasonCode: "COMPATIBLE_STRUCTURE_REFERENCE_UNAVAILABLE" },
  };
}

function buildRecurrences(input: {
  readonly observations: readonly GlobalM1RecurrenceObservation[];
  readonly authorities: readonly GlobalM1RecurrenceAuthority[];
  readonly targetDate: LocalDate;
  readonly asOf: Instant;
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
}) {
  const bySeries = new Map<string, GlobalM1RecurrenceObservation[]>();
  for (const observation of input.observations) {
    if (observation.economicDate > input.targetDate) continue;
    bySeries.set(observation.recurrenceId, [...(bySeries.get(observation.recurrenceId) ?? []), observation]);
  }
  const series = [...bySeries.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([recurrenceId, raw]) => {
    const observations = [...new Map(raw.map((entry) => [entry.occurrenceId, entry])).values()].sort((a, b) => a.economicDate.localeCompare(b.economicDate) || a.occurrenceId.localeCompare(b.occurrenceId));
    const applicable = input.authorities.filter((authority) => authority.recurrenceId === recurrenceId && authority.effectiveFrom <= input.targetDate && (authority.effectiveTo === undefined || authority.effectiveTo >= input.targetDate) && authority.declaredAt <= input.asOf);
    if (applicable.length > 1 && canonicalSerializeGlobal(applicable[0]) !== canonicalSerializeGlobal(applicable[1])) throw new TypeError(`Autorités récurrence contradictoires pour ${recurrenceId}.`);
    const authority = applicable[0];
    const refs = [...new Set([...observations.flatMap(({ evidenceRefs }) => evidenceRefs), ...(authority?.evidenceRefs ?? [])])].sort();
    const p = provenance({ nature: authority === undefined ? "OBSERVED" : "HYBRID", sourceRefs: refs, factRefs: refs, dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision });
    const occurrenceSupport = support("OCCURRENCE", observations.length, observations.length, 1, "global-typical-occurrence-cost@v1");
    const occurrenceCoverage = coverage("FINANCIAL_SOURCE", observations.length, observations.length, "economically-timed-recurrence-occurrences", refs);
    const costs = observations.map(({ amount }) => amount).sort((left, right) => new Big(left).cmp(right));
    const midpoint = Math.floor(costs.length / 2);
    const typical = costs.length === 0 ? undefined : costs.length % 2 === 1 ? costs[midpoint] : parseMoney(new Big(costs[midpoint - 1]).plus(costs[midpoint]).div(2).toFixed());
    const expectedAmount = authority?.expectedOccurrenceAmount;
    const expectedPerYear = authority?.expectedOccurrencesPerYear;
    const monthly = expectedAmount === undefined || expectedPerYear === undefined ? undefined : parseMoney(new Big(expectedAmount).times(expectedPerYear).div(12).toFixed());
    const q = (value: Money | undefined, unit: GlobalM1QualifiedMoney["unit"], reason: string, key: string) => qualified({ status: value === undefined ? "UNKNOWN" : "KNOWN", ...(value === undefined ? {} : { value }), unit, ...(value === undefined ? { reasonCode: reason } : {}), support: occurrenceSupport, coverage: occurrenceCoverage, provenance: p, input: { recurrenceId, key, ...(value === undefined ? {} : { value }), refs } });
    return {
      recurrenceId,
      labelRef: `recurrence:${recurrenceId}`,
      firstObservedAt: observations[0]!.economicDate,
      lastObservedAt: observations.at(-1)!.economicDate,
      typicalOccurrenceCost: q(typical, "EUR/occurrence", "NO_ELIGIBLE_OCCURRENCE", "typical"),
      cadence: expectedPerYear === undefined ? { status: "UNKNOWN" as const, reasonCode: "QUALIFIED_CADENCE_AUTHORITY_UNAVAILABLE" } : { status: "KNOWN" as const, expectedOccurrencesPerYear: expectedPerYear },
      expectedOccurrenceAmount: q(expectedAmount, "EUR/occurrence", "EXPECTED_AMOUNT_AUTHORITY_UNAVAILABLE", "expected"),
      monthlyEquivalent: q(monthly, "EUR/month", "MONTHLY_EQUIVALENT_INPUT_UNAVAILABLE", "monthly"),
      priceEvolution: { status: "UNKNOWN" as const, reasonCode: "COMPARABLE_PRICE_SERIES_UNAVAILABLE" },
      lifecycle: authority?.lifecycle === undefined ? { status: "UNKNOWN" as const, reasonCode: "BITEMPORAL_LIFECYCLE_AUTHORITY_UNAVAILABLE" } : { status: "KNOWN" as const, value: authority.lifecycle },
      support: occurrenceSupport,
      provenance: p,
      inputHash: digest("global-m1-recurrence-series@v2", { recurrenceId, observations, ...(authority === undefined ? {} : { authority }) }),
    } satisfies GlobalM1RecurrenceSeries;
  });
  const knownMonthly = series.filter(({ monthlyEquivalent }) => monthlyEquivalent.value !== undefined);
  const recurrenceRefs = series.flatMap(({ provenance: p }) => p.evidenceRefs);
  const p = provenance({ nature: "HYBRID", sourceRefs: recurrenceRefs, factRefs: recurrenceRefs, dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision });
  const aggregateSupport = support("OCCURRENCE", series.length, knownMonthly.length, 1, "global-m1-recurrence-aggregate@v2");
  const aggregateCoverage = coverage("FINANCIAL_SOURCE", knownMonthly.length, series.length, "qualified-monthly-equivalents-over-observed-series", recurrenceRefs);
  const aggregate = (value: Money | undefined, status: GlobalM1QualifiedMoney["status"], reason: string, id: string) => qualified({ status, ...(value === undefined ? {} : { value }), unit: "EUR/month", ...(value === undefined ? { reasonCode: reason } : {}), support: aggregateSupport, coverage: aggregateCoverage, provenance: p, input: { id, series: series.map(({ inputHash }) => inputHash) } });
  const structuralValue = knownMonthly.length === 0 ? undefined : sum(knownMonthly.map(({ monthlyEquivalent }) => monthlyEquivalent.value!));
  const structuralStatus = structuralValue === undefined ? "UNKNOWN" : knownMonthly.length === series.length ? "KNOWN" : "PARTIAL";
  const changeSum = (state: "NEW" | "ENDED" | "RESTARTED") => {
    const selected = knownMonthly.filter(({ recurrenceId }) => input.authorities.some((authority) =>
      authority.recurrenceId === recurrenceId && authority.change === state &&
      authority.effectiveFrom <= input.targetDate &&
      (authority.effectiveTo === undefined || authority.effectiveTo >= input.targetDate) &&
      authority.declaredAt <= input.asOf));
    return selected.length === 0 ? undefined : sum(selected.map(({ monthlyEquivalent }) => monthlyEquivalent.value!));
  };
  const newValue = changeSum("NEW");
  const endedValue = changeSum("ENDED");
  const restartedValue = changeSum("RESTARTED");
  return {
    series,
    structuralRecurringCost: aggregate(structuralValue, structuralStatus, "NO_QUALIFIED_MONTHLY_EQUIVALENT", "structural"),
    newRecurringEquivalent: aggregate(newValue, newValue === undefined ? "UNKNOWN" : "KNOWN", "NEW_LIFECYCLE_AUTHORITY_UNAVAILABLE", "new"),
    endedRecurringEquivalent: aggregate(endedValue, endedValue === undefined ? "UNKNOWN" : "KNOWN", "ENDED_LIFECYCLE_AUTHORITY_UNAVAILABLE", "ended"),
    restartedRecurringEquivalent: aggregate(restartedValue, restartedValue === undefined ? "UNKNOWN" : "KNOWN", "RESTARTED_LIFECYCLE_AUTHORITY_UNAVAILABLE", "restarted"),
    priceChangeExistingRecurrences: aggregate(undefined, "UNKNOWN", "COMPARABLE_EXPECTED_AMOUNT_HISTORY_UNAVAILABLE", "price-change"),
    inputHash: digest("global-m1-recurrences@v2", { series: series.map(({ inputHash }) => inputHash) }),
  };
}

export function buildGlobalM1OwnerV2(input: {
  readonly targetMonth: YearMonth;
  readonly certifiedThrough: LocalDate;
  readonly asOf: Instant;
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
  readonly history: readonly GlobalM1HistoryInput[];
  readonly periodMinimal?: GlobalMinimalAuthority;
  readonly structure: GlobalEconomicStructure;
  readonly temporal: Readonly<Record<string, unknown>>;
  readonly recurrenceObservations?: readonly GlobalM1RecurrenceObservation[];
  readonly recurrenceAuthorities?: readonly GlobalM1RecurrenceAuthority[];
  readonly contributors?: readonly GlobalM1Contributor[];
  readonly dependencyDeclaration: GlobalDependencyDeclaration;
  readonly factsDigest: string;
  readonly classificationsDigest: string;
}): GlobalM1OwnerOutputV2 {
  const ordered = [...input.history].filter(({ month }) => month <= input.targetMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  if (new Set(ordered.map(({ month }) => month)).size !== ordered.length) throw new TypeError("M1 refuse deux points pour un même mois.");
  const baseRefs = [...new Set(ordered.flatMap(({ dependencyRefs }) => dependencyRefs))].sort();
  const p = provenance({ nature: "HYBRID", sourceRefs: baseRefs, factRefs: baseRefs, upstreamMetricRefs: ["economic_consumption_net_attributable", "typical_month_cost", "minimal_month_cost"], dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision });
  const monthSupport = support("MONTH", ordered.length, ordered.length, 1, "global-m1-month-value@v2");
  const monthCoverage = coverage("FINANCIAL_SOURCE", ordered.length, ordered.length, "certified-monthly-authorities", baseRefs);
  const points = ordered.map((entry): GlobalM1HistoryPoint => {
    const actual = fromKnowledge({ knowledge: entry.actual.value, unit: "EUR/month", fallbackSupport: monthSupport, fallbackCoverage: monthCoverage, provenance: p, inputHash: entry.actual.inputHash, unknownReason: "ACTUAL_AUTHORITY_UNAVAILABLE" });
    const typicalState = fromKnowledge({ knowledge: entry.typical.state, unit: "EUR/month", fallbackSupport: monthSupport, fallbackCoverage: monthCoverage, provenance: p, inputHash: entry.typical.inputHash, unknownReason: "TYPICAL_STATE_SUPPORT_INSUFFICIENT" });
    const typicalReference = fromKnowledge({ knowledge: entry.typical.reference, unit: "EUR/month", fallbackSupport: monthSupport, fallbackCoverage: monthCoverage, provenance: p, inputHash: entry.typical.inputHash, unknownReason: "TYPICAL_REFERENCE_SUPPORT_INSUFFICIENT" });
    const minimalState = fromMetric({ metric: entry.minimal.metric, inputHash: entry.minimal.inputHash, support: monthSupport, coverage: monthCoverage, provenance: p, unknownReason: "HISTORICAL_MINIMAL_AUTHORITY_UNAVAILABLE" });
    return {
      month: entry.month, actual, typicalState, minimalState,
      ...(typicalReference.status === "UNKNOWN" ? {} : { typicalReference }),
      lineage: { asOf: input.asOf, certifiedThrough: input.certifiedThrough, sourceRevision: input.dataRevision, analyticsRevision: input.analyticsRevision, dependencyRefs: [...new Set(entry.dependencyRefs)].sort() },
    };
  });
  const target = points.find(({ month }) => month === input.targetMonth);
  if (target === undefined) throw new TypeError("Le mois cible M1 est absent de l'historique certifié.");
  const targetInput = ordered.find(({ month }) => month === input.targetMonth)!;
  const periodMinimalState = input.periodMinimal === undefined
    ? target.minimalState
    : fromMetric({
        metric: input.periodMinimal.metric,
        inputHash: input.periodMinimal.inputHash,
        support: monthSupport,
        coverage: monthCoverage,
        provenance: p,
        unknownReason: "GLOBAL_RETROSPECTIVE_MINIMAL_UNAVAILABLE",
      });
  const typicalReference = fromKnowledge({ knowledge: targetInput.typical.reference, unit: "EUR/month", fallbackSupport: monthSupport, fallbackCoverage: monthCoverage, provenance: p, inputHash: targetInput.typical.inputHash, unknownReason: "TYPICAL_REFERENCE_SUPPORT_INSUFFICIENT" });
  const necessity = structureAxis(input.structure.necessity, baseRefs);
  const behavior = structureAxis(input.structure.behavior, baseRefs);
  const lifeScope = structureAxis(input.structure.lifeScope, baseRefs);
  const recurrences = buildRecurrences({ observations: input.recurrenceObservations ?? [], authorities: input.recurrenceAuthorities ?? [], targetDate: input.certifiedThrough, asOf: input.asOf, dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision });
  const conditional = (id: string, reasonCode: string): QualifiedConditional<unknown> => ({ status: "UNKNOWN", reasonCode, methodVersion: GLOBAL_M1_OWNER_METHOD_VERSION, inputHash: digest(`global-m1-${id}@v1`, { targetMonth: input.targetMonth, reasonCode }) });
  const limitations = [
    ...(periodMinimalState.status === "UNKNOWN" ? ["GLOBAL_RETROSPECTIVE_MINIMAL_UNAVAILABLE"] : []),
    ...(recurrences.series.some(({ lifecycle }) => lifecycle.status === "UNKNOWN") ? ["HISTORICAL_RECURRENCE_LIFECYCLE_AUTHORITY_UNAVAILABLE"] : []),
    "STABILITY_CLASS_REQUIRES_APPROVED_POLICY",
    "STRUCTURE_EVOLUTION_REQUIRES_COMPATIBLE_REFERENCE",
  ];
  const methods = [...new Set([GLOBAL_M1_OWNER_METHOD_VERSION, "global_temporal_analysis@v2" as MethodVersion, ...points.flatMap((point) => [point.actual.methodVersion, point.typicalState.methodVersion, point.minimalState.methodVersion])])].sort();
  const historyHash = digest("global-m1-history@v2", points);
  const owner = {
    moduleKey: "ECONOMIC" as const,
    targetMonth: input.targetMonth,
    certifiedThrough: input.certifiedThrough,
    state: {
      actual: target.actual,
      typicalReference,
      typicalReferenceMonths: targetInput.typical.referenceMonths,
      typicalState: target.typicalState,
      typicalStateMonths: targetInput.typical.stateMonths,
      minimalState: periodMinimalState,
      comparisons: {
        actualVsTypicalReference: comparison(target.actual, typicalReference, "actual-vs-typical-reference"),
        typicalStateVsMinimalState: comparison(target.typicalState, periodMinimalState, "typical-state-vs-minimal-state"),
      },
    },
    history: { points, inputHash: historyHash },
    structure: { semanticBase: "ACTUAL_TARGET_MONTH" as const, necessity, behavior, lifeScope, inputHash: input.structure.inputHash },
    temporal: {
      ...input.temporal,
      currentRegimeReference: conditional("current-regime-reference", "NO_CONFIRMED_ONGOING_REGIME"),
      longTermEvolution: conditional("long-term-evolution", "LONG_TERM_SUPPORT_OR_AUTHORITY_UNAVAILABLE"),
    },
    recurrences,
    contributors: [
      ...(input.contributors ?? []),
      ...([
        ["new", recurrences.newRecurringEquivalent],
        ["ended", recurrences.endedRecurringEquivalent],
        ["restarted", recurrences.restartedRecurringEquivalent],
        ["price-change", recurrences.priceChangeExistingRecurrences],
      ] as const).flatMap(([kind, typedDelta]) => typedDelta.value === undefined ? [] : [{
        contributorId: `recurrence:${kind}`,
        source: "RECURRENCE_CHANGE" as const,
        typedDelta,
        additiveDecomposition: true,
        publicationEligible: typedDelta.status === "KNOWN" && typedDelta.materiality.status === "MATERIAL",
        evidenceRefs: typedDelta.provenance.evidenceRefs,
      }]),
    ].sort((a, b) => a.contributorId.localeCompare(b.contributorId)),
    conditional: {
      longTerm: conditional("long-term", "LONG_TERM_SUPPORT_OR_AUTHORITY_UNAVAILABLE"),
      currentRegime: conditional("current-regime", "NO_CONFIRMED_ONGOING_REGIME"),
      periodicity: conditional("periodicity", "QUALIFIED_CADENCE_SUPPORT_UNAVAILABLE"),
    },
    methodology: {
      asOf: input.asOf,
      certifiedThrough: input.certifiedThrough,
      methods,
      support: monthSupport,
      coverage: monthCoverage,
      limitations: [...new Set(limitations)].sort(),
      revisions: { dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision },
      evidenceRefs: baseRefs,
      dependencyDeclaration: input.dependencyDeclaration,
    },
    factsDigest: input.factsDigest,
    classificationsDigest: input.classificationsDigest,
    dependencyDeclaration: input.dependencyDeclaration,
    inputHash: "",
  };
  return { ...owner, inputHash: digest("global-m1-owner@v2", owner) };
}

export function minimalComponentsForOwner(minimal: GlobalMinimalAuthority): readonly MinimalMonthComponent[] {
  return [...minimal.neutralVariableComponents, ...minimal.mandatoryMonthlyObligationsAndProvisions];
}
