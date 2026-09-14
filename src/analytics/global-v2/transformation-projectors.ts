import Big from "big.js";

import type { ActivityOccurrenceFact, PersonDayFact } from "../facts";
import {
  canonicalSerializeGlobal,
  parseGlobalCoverageSet,
  parseGlobalSupport,
  type GlobalCoverageSet,
  type GlobalMaterialityCandidate,
  type GlobalSupport,
} from "../../core/global-v2";
import { parseMoney } from "../../core/money";
import { parseYearMonth, type YearMonth } from "../../core/time";
import { parseMethodVersion } from "../../core/versions";
import type {
  GlobalCategoryNeedsResult,
  GlobalM2MonthlyComponent,
} from "./category-needs";
import { globalMaterialityPolicies } from "./materiality";
import type { GlobalM1HistoryPoint, GlobalM1OwnerOutputV2 } from "./m1-owner";
import type { GlobalTemporalPoint } from "./temporal-descriptive";
import type { GlobalTransformationSeries } from "./transformations";

export type GlobalProjectedTransformationSeries<
  Unit extends "EUR/month" | "occurrence/month",
> = GlobalTransformationSeries & {
  readonly grain: "MONTH";
  readonly unit: Unit;
};

export type GlobalCertifiedMonthAuthority = {
  readonly month: YearMonth;
  readonly dependencyRefs: readonly string[];
};

function canonicalRefs(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function coverageIsComplete(coverage: GlobalCoverageSet): boolean {
  if (coverage.effective !== 1) return false;
  return coverage.requiredDimensions.every((dimension) => {
    const measure = coverage.dimensions.find((candidate) => candidate.dimension === dimension);
    return measure?.status === "KNOWN" && (measure.ratio === undefined || measure.ratio === 1);
  });
}

function supportIsEligible(support: GlobalSupport): boolean {
  return support.supportStatus === "SUFFICIENT" || support.supportStatus === "STRONG";
}

function pointRefs(point: GlobalM1HistoryPoint): readonly string[] {
  return canonicalRefs([
    ...point.lineage.dependencyRefs,
    ...point.actual.provenance.sourceRefs,
    ...point.actual.provenance.factRefs,
    ...point.actual.provenance.evidenceRefs,
    ...point.actual.provenance.upstreamMetricRefs,
  ]);
}

function projectM1Point(point: GlobalM1HistoryPoint): GlobalTemporalPoint {
  if (point.actual.unit !== "EUR/month") {
    throw new TypeError(`M1 Actual ${point.month} doit être exprimé en EUR/month.`);
  }
  const refs = pointRefs(point);
  if (refs.length === 0) throw new TypeError(`M1 Actual ${point.month} ne porte aucune provenance autoritaire.`);
  const hasValue = point.actual.value !== undefined;
  const eligible = hasValue
    && (point.actual.status === "KNOWN" || point.actual.status === "PARTIAL")
    && point.actual.coverage.effective !== undefined
    && point.actual.coverage.effective > 0
    && point.actual.support.supportStatus !== "INSUFFICIENT";
  const complete = point.actual.status === "KNOWN"
    && supportIsEligible(point.actual.support)
    && coverageIsComplete(point.actual.coverage);
  return {
    month: parseYearMonth(point.month),
    corpus: "CERTIFIED_HISTORY",
    status: point.actual.status,
    ...(hasValue ? { value: parseMoney(point.actual.value!) } : {}),
    eligible,
    complete,
    dependencyRefs: refs,
  };
}

/** Pure M1 Actual -> M3 adapter. Typical and Minimal are deliberately absent. */
export function projectGlobalM1ActualTransformationSeries(input: {
  readonly householdId: string;
  readonly authority: Pick<GlobalM1OwnerOutputV2, "targetMonth" | "history">;
}): GlobalProjectedTransformationSeries<"EUR/month"> {
  if (!input.householdId.trim()) throw new TypeError("M1 transformation projector requires a Household identity.");
  const certifiedThroughMonth = parseYearMonth(input.authority.targetMonth);
  const history = [...input.authority.history.points]
    .filter(({ month }) => month <= certifiedThroughMonth)
    .sort((left, right) => left.month.localeCompare(right.month));
  if (new Set(history.map(({ month }) => month)).size !== history.length) {
    throw new TypeError("M1 transformation projector received duplicate months.");
  }
  const points = history.map(projectM1Point);
  if (points.length === 0) throw new TypeError("M1 transformation projector requires certified Actual history.");
  const actuals = history.map(({ actual }) => actual);
  const referenceSupport = actuals[0]!.support;
  const referenceCoverage = actuals[0]!.coverage;
  const referenceMethod = actuals[0]!.methodVersion;
  if (actuals.some((actual) =>
    canonicalSerializeGlobal(actual.support) !== canonicalSerializeGlobal(referenceSupport)
    || canonicalSerializeGlobal(actual.coverage) !== canonicalSerializeGlobal(referenceCoverage)
    || actual.methodVersion !== referenceMethod)) {
    throw new TypeError("M1 Actual history carries incompatible monthly authority contracts.");
  }
  const knowledgeState = points.every(({ status }) => status === "KNOWN")
    ? "KNOWN" as const
    : points.some(({ status }) => status === "KNOWN" || status === "PARTIAL")
      ? "PARTIAL" as const
      : "UNKNOWN" as const;
  const evidenceRefs = canonicalRefs(points.flatMap(({ dependencyRefs }) => dependencyRefs));
  return {
    signalId: "m1:household:actual",
    subjectRef: `household:${input.householdId}`,
    catalogKey: "ECONOMIC_TOTAL",
    certifiedThroughMonth,
    points,
    evidence: {
      phenomenonId: "m1:household:actual",
      metricRef: "economic_consumption_net_attributable",
      knowledgeState,
      support: referenceSupport,
      coverage: referenceCoverage,
      evidenceRefs,
      entityRefs: [],
      methodVersion: referenceMethod,
      materialityPolicy: globalMaterialityPolicies.HOUSEHOLD_TOTAL.ref,
    },
    policyId: "HOUSEHOLD_TOTAL",
    semanticRefs: [],
    structuralAuthorityRefs: [],
    grain: "MONTH",
    unit: "EUR/month",
  };
}

function m2AuthorityPoint(input: {
  readonly categoryId: string;
  readonly expectedValue: string;
  readonly month: YearMonth;
  readonly components: readonly GlobalM2MonthlyComponent[];
  readonly certification: GlobalM1HistoryPoint;
}): GlobalTemporalPoint {
  const monthComponents = input.components.filter(({ month }) => month === input.month);
  const categoryComponents = monthComponents.filter(({ category }) =>
    category.status === "KNOWN" && String(category.id) === input.categoryId);
  const categoryValue = categoryComponents.reduce((total, component) => total.plus(component.amount), new Big(0));
  if (!categoryValue.eq(input.expectedValue)) {
    throw new TypeError(`M2 category:${input.categoryId} ${input.month} ne réconcilie pas historicalSeries.`);
  }
  const actual = input.certification.actual;
  if (actual.value !== undefined) {
    const componentTotal = monthComponents.reduce((total, component) => total.plus(component.amount), new Big(0));
    if (!componentTotal.eq(actual.value)) {
      throw new TypeError(`M2 ${input.month} ne réconcilie pas l'Actual mensuel autoritaire.`);
    }
  }
  const dimensionsComplete = monthComponents.every(({ category }) => category.status === "KNOWN");
  const refs = canonicalRefs([
    ...pointRefs(input.certification),
    ...monthComponents.flatMap(({ economicIdentityRefs, evidenceRefs, category }) => [
      ...economicIdentityRefs,
      ...evidenceRefs,
      ...category.evidenceRefs,
    ]),
  ]);
  if (refs.length === 0) throw new TypeError(`M2 category:${input.categoryId} ${input.month} ne porte aucune provenance.`);
  const actualHasValue = actual.value !== undefined;
  const actualEligible = actualHasValue
    && (actual.status === "KNOWN" || actual.status === "PARTIAL")
    && actual.coverage.effective !== undefined
    && actual.coverage.effective > 0
    && actual.support.supportStatus !== "INSUFFICIENT";
  const complete = actual.status === "KNOWN"
    && supportIsEligible(actual.support)
    && coverageIsComplete(actual.coverage)
    && dimensionsComplete;
  const carriesTemporalValue = actualHasValue && (actual.status === "KNOWN" || actual.status === "PARTIAL");
  const status = actual.status === "KNOWN" || actual.status === "PARTIAL"
    ? complete ? "KNOWN" as const : "PARTIAL" as const
    : actual.status;
  return {
    month: input.month,
    corpus: "CERTIFIED_HISTORY",
    status,
    ...(carriesTemporalValue ? { value: parseMoney(categoryValue.toFixed()) } : {}),
    eligible: actualEligible,
    complete,
    dependencyRefs: refs,
  };
}

function m2AxisIsAuthoritative(result: GlobalCategoryNeedsResult): boolean {
  return supportIsEligible(result.categories.support) && coverageIsComplete(result.categories.coverage);
}

/**
 * Pure M2 Category -> M3 adapter. Numeric historicalSeries values are accepted
 * only after exact reconciliation with M2 monthly components and M1 certified
 * month authority.
 */
export function projectGlobalM2CategoryTransformationSeries(input: {
  readonly householdId: string;
  readonly result: GlobalCategoryNeedsResult;
  readonly monthlyComponents: readonly GlobalM2MonthlyComponent[];
  readonly certifiedMonths: readonly GlobalM1HistoryPoint[];
}): readonly GlobalProjectedTransformationSeries<"EUR/month">[] {
  if (!input.householdId.trim()) throw new TypeError("M2 transformation projector requires a Household identity.");
  if (!m2AxisIsAuthoritative(input.result)) return [];
  const certifiedThroughMonth = parseYearMonth(input.result.targetMonth);
  const certifications = new Map(input.certifiedMonths.map((point) => [point.month, point]));
  if (certifications.size !== input.certifiedMonths.length) throw new TypeError("M2 received duplicate certified months.");
  const candidates = input.result.categories.groups.flatMap((group) => {
    if (group.dimension.status !== "KNOWN") return [];
    const categoryId = String(group.dimension.id);
    const historicalSeries = [...group.historicalSeries].sort((left, right) => left.month.localeCompare(right.month));
    if (new Set(historicalSeries.map(({ month }) => month)).size !== historicalSeries.length) {
      throw new TypeError(`M2 category:${categoryId} received duplicate historical months.`);
    }
    if (historicalSeries.some(({ month }) => month > certifiedThroughMonth)) {
      throw new TypeError(`M2 category:${categoryId} contains a non-certified live tail.`);
    }
    const points = historicalSeries.map(({ month, amount }) => {
      const certification = certifications.get(month);
      if (certification === undefined) {
        throw new TypeError(`M2 category:${categoryId} lacks certified authority for ${month}.`);
      }
      return m2AuthorityPoint({
        categoryId,
        expectedValue: amount,
        month: parseYearMonth(month),
        components: input.monthlyComponents,
        certification,
      });
    });
    const computedAnnual = points.reduce((total, point) => total.plus(point.value ?? 0), new Big(0));
    if (!computedAnnual.eq(group.annualAmount)) {
      throw new TypeError(`M2 category:${categoryId} ne réconcilie pas annualAmount.`);
    }
    if (points.length !== 12 || points.some((point) => point.status !== "KNOWN" || !point.complete || !point.eligible)) return [];
    const evidenceRefs = canonicalRefs(points.flatMap(({ dependencyRefs }) => dependencyRefs));
    const evidence: Omit<GlobalMaterialityCandidate, "candidateId" | "effect"> = {
      phenomenonId: `m2:category:${categoryId}`,
      metricRef: "category_amount",
      knowledgeState: "KNOWN",
      support: input.result.categories.support,
      coverage: input.result.categories.coverage,
      evidenceRefs,
      entityRefs: [`category:${categoryId}`],
      methodVersion: parseMethodVersion("global_category_need@v2"),
      materialityPolicy: globalMaterialityPolicies.CATEGORY_NEED.ref,
    };
    return [{
      annualAmount: group.annualAmount,
      series: {
        signalId: `m2:category:${categoryId}`,
        subjectRef: `household:${input.householdId}`,
        catalogKey: "CATEGORY" as const,
        certifiedThroughMonth,
        points,
        evidence,
        policyId: "CATEGORY_NEED" as const,
        semanticRefs: [],
        structuralAuthorityRefs: [],
        grain: "MONTH" as const,
        unit: "EUR/month" as const,
      },
    }];
  });
  return candidates
    .sort((left, right) => new Big(right.annualAmount).cmp(left.annualAmount)
      || left.series.signalId.localeCompare(right.series.signalId))
    .slice(0, 5)
    .map(({ series }) => series);
}

function daysInMonth(month: YearMonth): number {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

function assertUniqueConsistent<T>(
  values: readonly T[],
  identity: (value: T) => string,
  label: string,
): readonly T[] {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = identity(value);
    const previous = result.get(id);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(value)) {
      throw new TypeError(`${label}: identité contradictoire ${id}.`);
    }
    result.set(id, value);
  }
  return [...result.values()];
}

/** Pure person x activity monthly count adapter. M4 daily rates are not read. */
export function projectGlobalM4ActivityFrequencyTransformationSeries(input: {
  readonly personId: string;
  readonly activityId: string;
  readonly certifiedThroughMonth: YearMonth;
  readonly certifiedMonths: readonly GlobalCertifiedMonthAuthority[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly personDays: readonly PersonDayFact[];
}): GlobalProjectedTransformationSeries<"occurrence/month"> {
  if (!input.personId.trim() || !input.activityId.trim()) throw new TypeError("M4 transformation projector requires person and activity identities.");
  const certifiedThroughMonth = parseYearMonth(input.certifiedThroughMonth);
  const certifiedMonths = [...input.certifiedMonths].map(({ month, dependencyRefs }) => ({
    month: parseYearMonth(month),
    dependencyRefs: canonicalRefs(dependencyRefs),
  })).sort((left, right) => left.month.localeCompare(right.month));
  if (new Set(certifiedMonths.map(({ month }) => month)).size !== certifiedMonths.length
    || certifiedMonths.some(({ month }) => month > certifiedThroughMonth)) {
    throw new TypeError("M4 certified month universe is duplicate or beyond its boundary.");
  }
  if (certifiedMonths.some(({ dependencyRefs }) => dependencyRefs.length === 0)) {
    throw new TypeError("M4 certified months require real authority references.");
  }
  if (certifiedMonths.length === 0) throw new TypeError("M4 transformation projector requires a certified month universe.");
  const certifiedMonthSet = new Set(certifiedMonths.map(({ month }) => month));
  const occurrences = assertUniqueConsistent(input.occurrences, (fact) => String(fact.lifeEventId), "ActivityOccurrenceFact")
    .filter((fact) => String(fact.activityId) === input.activityId
      && fact.participantIds.some((personId) => String(personId) === input.personId)
      && certifiedMonthSet.has(parseYearMonth(fact.startDate.slice(0, 7))));
  const personDays = assertUniqueConsistent(input.personDays, (fact) => `${fact.personId}:${fact.localDate}`, "PersonDayFact")
    .filter((fact) => String(fact.personId) === input.personId
      && certifiedMonthSet.has(parseYearMonth(fact.localDate.slice(0, 7))));
  const householdIds = new Set([...occurrences, ...personDays].map(({ householdId }) => String(householdId)));
  if (householdIds.size > 1) throw new TypeError("M4 transformation projector cannot mix Households.");
  const points = certifiedMonths.map(({ month, dependencyRefs }): GlobalTemporalPoint => {
    const monthDays = personDays.filter(({ localDate }) => localDate.startsWith(month));
    const observedDates = new Set(monthDays.map(({ localDate }) => String(localDate)));
    const monthOccurrences = occurrences.filter(({ startDate }) => startDate.startsWith(month));
    const includedOccurrences = monthOccurrences.filter(({ startDate }) => observedDates.has(String(startDate)));
    const expectedDays = daysInMonth(month);
    const fullNaturalMonth = observedDates.size === expectedDays
      && [...observedDates].every((date) => Number(date.slice(8, 10)) >= 1 && Number(date.slice(8, 10)) <= expectedDays)
      && observedDates.has(`${month}-01`)
      && observedDates.has(`${month}-${String(expectedDays).padStart(2, "0")}`);
    const complete = fullNaturalMonth && includedOccurrences.length === monthOccurrences.length;
    const hasExposure = observedDates.size > 0;
    return {
      month,
      corpus: "CERTIFIED_HISTORY",
      status: !hasExposure ? "UNKNOWN" : complete ? "KNOWN" : "PARTIAL",
      ...(hasExposure ? { value: String(includedOccurrences.length) } : {}),
      eligible: hasExposure,
      complete,
      dependencyRefs: canonicalRefs([
        ...dependencyRefs,
        ...monthDays.map(({ personDayId }) => `fct_person_day:${personDayId}`),
        ...monthOccurrences.map(({ lifeEventId }) => `fct_activity_occurrence:${lifeEventId}`),
      ]),
    };
  });
  const observedMonths = points.filter(({ status }) => status !== "UNKNOWN").length;
  const completeMonths = points.filter(({ status, complete }) => status === "KNOWN" && complete).length;
  const totalExpectedDays = certifiedMonths.reduce((total, { month }) => total + daysInMonth(month), 0);
  const observedDayCount = personDays.filter(({ localDate }) => certifiedMonths.some(({ month }) => localDate.startsWith(month))).length;
  const support = parseGlobalSupport({
    naturalGrain: "MONTH",
    eligibleUnits: certifiedMonths.length,
    observedUnits: observedMonths,
    includedUnits: completeMonths,
    excludedObservedUnits: observedMonths - completeMonths,
    minimumRequired: 12,
    supportStatus: completeMonths >= 12 ? "SUFFICIENT" : observedMonths > 0 ? "PARTIAL_SUPPORT" : "INSUFFICIENT",
    occurrenceCount: occurrences.length,
    gapCount: totalExpectedDays - observedDayCount,
    policyRef: "global-m4-activity-frequency-month-support@v1",
  });
  const coverage = parseGlobalCoverageSet({
    dimensions: [{
      dimension: "PERSON_DAY",
      status: observedDayCount === 0 ? "UNKNOWN" : observedDayCount === totalExpectedDays ? "KNOWN" : "PARTIAL",
      ...(observedDayCount === 0 || totalExpectedDays === 0 ? {} : {
        numerator: observedDayCount,
        denominator: totalExpectedDays,
        ratio: observedDayCount / totalExpectedDays,
      }),
      unit: "person-day",
      basis: "same-person-natural-month-exposure",
      evidenceRefs: canonicalRefs(personDays.map(({ personDayId }) => `fct_person_day:${personDayId}`)),
      policyRef: "global-m4-activity-frequency-person-day-coverage@v1",
    }],
    requiredDimensions: ["PERSON_DAY"],
    ...(observedDayCount === 0 || totalExpectedDays === 0 ? {} : { effective: observedDayCount / totalExpectedDays }),
    aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
  const knowledgeState = points.every(({ status }) => status === "KNOWN")
    ? "KNOWN" as const
    : points.some(({ status }) => status === "KNOWN" || status === "PARTIAL")
      ? "PARTIAL" as const
      : "UNKNOWN" as const;
  return {
    signalId: `m4:person:${input.personId}:activity:${input.activityId}:frequency`,
    subjectRef: `person:${input.personId}`,
    catalogKey: "ACTIVITY_FREQUENCY",
    certifiedThroughMonth,
    points,
    evidence: {
      phenomenonId: `m4:person:${input.personId}:activity:${input.activityId}:frequency`,
      metricRef: "activity_frequency",
      knowledgeState,
      support,
      coverage,
      evidenceRefs: canonicalRefs(points.flatMap(({ dependencyRefs }) => dependencyRefs)),
      entityRefs: [`activity:${input.activityId}`, `person:${input.personId}`],
      methodVersion: parseMethodVersion("global_m4_activity_frequency_projection@v1"),
      materialityPolicy: globalMaterialityPolicies.ACTIVITY_FREQUENCY.ref,
    },
    policyId: "ACTIVITY_FREQUENCY",
    semanticRefs: [],
    structuralAuthorityRefs: [],
    grain: "MONTH",
    unit: "occurrence/month",
  };
}

/** D1 BASE M3 selection for M4. Product rhythm remains daily-rate based; this
 * adapter only admits complete, supported person x activity count/month series.
 */
export function projectGlobalM4ActivityFrequencyTransformationUniverse(input: {
  readonly certifiedThroughMonth: YearMonth;
  readonly certifiedMonths: readonly GlobalCertifiedMonthAuthority[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly personDays: readonly PersonDayFact[];
  readonly rhythms: readonly {
    readonly personId: string;
    readonly activityId: string;
    readonly rawOccurrenceCount: number;
    readonly rate: { readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" };
    readonly support: Pick<GlobalSupport, "supportStatus">;
  }[];
}): readonly GlobalProjectedTransformationSeries<"occurrence/month">[] {
  if (input.certifiedMonths.length !== 12) return [];
  return [...input.rhythms]
    .sort((left, right) => left.personId.localeCompare(right.personId)
      || left.activityId.localeCompare(right.activityId))
    .filter((rhythm) => rhythm.rate.status === "KNOWN"
      && (rhythm.support.supportStatus === "SUFFICIENT" || rhythm.support.supportStatus === "STRONG")
      && rhythm.rawOccurrenceCount >= 12)
    .map((rhythm) => projectGlobalM4ActivityFrequencyTransformationSeries({
      personId: rhythm.personId,
      activityId: rhythm.activityId,
      certifiedThroughMonth: input.certifiedThroughMonth,
      certifiedMonths: input.certifiedMonths,
      occurrences: input.occurrences,
      personDays: input.personDays,
    }))
    .filter((series) => series.points.length === 12
      && series.points.every((point) => point.status === "KNOWN" && point.complete && point.eligible));
}
