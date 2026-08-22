import { parseMetricId, type MetricId } from "../../core/identity";
import {
  averageMoney,
  compareMoney,
  parseMoney,
  type Money,
} from "../../core/money";
import {
  createMetricEnvelopeParser,
  parseCoverage,
  parseReferenceMeta,
  type Coverage,
  type MetricEnvelope,
} from "../../core/metrics";
import { compareYearMonth, parseYearMonth, type YearMonth } from "../../core/time";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";
import { supportForPolicy } from "../support";
import type {
  MonthReferenceWindow,
  ReferencePeriodCandidate,
  ReferenceWindowRequest,
} from "./types";
import {
  assertMonthReferenceWindow,
  selectComparisonReferenceWindow,
} from "./windows";

export const TYPICAL_MONTH_REQUESTED_PERIOD_COUNT = 12;
export const TYPICAL_MONTH_METRIC_ID: MetricId = parseMetricId(
  "typical_month_cost",
);
export const TYPICAL_MONTH_METHOD_VERSION: MethodVersion = parseMethodVersion(
  "typical_month_cost@v1",
);
const parseTypicalMonthEnvelope = createMetricEnvelopeParser<
  Money,
  "EUR/month"
>({
  parseValue: parseMoney,
  allowedUnits: ["EUR/month"],
});

export type TypicalMonthSemantic =
  | "NO_REFERENCE"
  | "AVAILABLE_MONTH_MEDIAN"
  | "TYPICAL_MONTH";

export type MonthlyEconomicObservation = {
  readonly period: YearMonth;
  readonly value: Money;
};

export type TypicalMonthMetric = MonthReferenceWindow &
  MetricEnvelope<Money, "EUR/month"> & {
    readonly metricId: MetricId;
    readonly semantic: TypicalMonthSemantic;
  };

export function medianMoney(values: readonly Money[]): Money {
  if (values.length === 0) {
    throw new TypeError("La médiane Money exige au moins une observation.");
  }
  const ordered = values.map(parseMoney).sort(compareMoney);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : averageMoney(ordered[middle - 1], ordered[middle]);
}

function normalizeMonthlyObservations(
  values: readonly MonthlyEconomicObservation[],
): ReadonlyMap<YearMonth, Money> {
  const byPeriod = new Map<YearMonth, Money>();
  for (const observation of values) {
    const period = parseYearMonth(observation.period);
    if (byPeriod.has(period)) {
      throw new TypeError(
        "Une seule observation économique mensuelle est autorisée par période.",
      );
    }
    byPeriod.set(period, parseMoney(observation.value));
  }
  return byPeriod;
}

function referenceMetaFromWindow(window: MonthReferenceWindow) {
  return parseReferenceMeta(
    window.family === "comparison"
      ? {
          family: window.family,
          asOf: window.asOf,
          target: { kind: "month", month: window.targetPeriod },
        }
      : { family: window.family, asOf: window.asOf },
  );
}

export function calculateTypicalMonthCost(input: {
  readonly window: MonthReferenceWindow;
  readonly monthlyObservations: readonly MonthlyEconomicObservation[];
  readonly coverage?: Coverage;
}): TypicalMonthMetric {
  assertMonthReferenceWindow(input.window);
  if (
    input.window.requestedPeriodCount !==
    TYPICAL_MONTH_REQUESTED_PERIOD_COUNT
  ) {
    throw new TypeError(
      "typical_month_cost exige sa fenêtre contractuelle de 12 mois.",
    );
  }
  if (
    input.window.effectivePeriodCount >
    TYPICAL_MONTH_REQUESTED_PERIOD_COUNT
  ) {
    throw new TypeError("typical_month_cost ne peut utiliser plus de 12 mois.");
  }

  const byPeriod = normalizeMonthlyObservations(input.monthlyObservations);
  const values = input.window.includedPeriods.map((period) => {
    const value = byPeriod.get(period);
    if (value === undefined) {
      throw new TypeError(
        `L'observation économique mensuelle ${period} est absente.`,
      );
    }
    return value;
  });
  const n = input.window.effectivePeriodCount;
  const support = supportForPolicy("typical_month", n);
  const semantic: TypicalMonthSemantic =
    n <= 2
      ? "NO_REFERENCE"
      : n <= 5
        ? "AVAILABLE_MONTH_MEDIAN"
        : "TYPICAL_MONTH";
  const envelope = parseTypicalMonthEnvelope({
    availability: n <= 2 ? "unknown" : "known",
    value: n <= 2 ? null : medianMoney(values),
    unit: "EUR/month",
    support,
    provenance: "derived",
    reference: referenceMetaFromWindow(input.window),
    methodVersion: TYPICAL_MONTH_METHOD_VERSION,
    ...(input.coverage === undefined
      ? {}
      : { coverage: parseCoverage(input.coverage) }),
  });

  return {
    ...input.window,
    metricId: TYPICAL_MONTH_METRIC_ID,
    semantic,
    ...envelope,
  };
}

export function calculateRollingComparisonTypicalMonths(input: {
  readonly householdId: ReferenceWindowRequest["householdId"];
  readonly householdTimeZone: ReferenceWindowRequest["householdTimeZone"];
  readonly targetPeriods: readonly YearMonth[];
  readonly candidates: readonly ReferencePeriodCandidate[];
  readonly monthlyObservations: readonly MonthlyEconomicObservation[];
}): readonly TypicalMonthMetric[] {
  const targets = [...new Set(input.targetPeriods.map(parseYearMonth))].sort(
    compareYearMonth,
  );
  return targets.map((targetPeriod) =>
    calculateTypicalMonthCost({
      window: selectComparisonReferenceWindow({
        householdId: input.householdId,
        householdTimeZone: input.householdTimeZone,
        targetPeriod,
        requestedPeriodCount: TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
        candidates: input.candidates,
      }),
      monthlyObservations: input.monthlyObservations,
    }),
  );
}
