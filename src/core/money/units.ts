import type {
  CountMetricUnit,
  MetricUnit,
  MonetaryMetricUnit,
} from "./types";

const metricUnits: ReadonlySet<string> = new Set<MetricUnit>([
  "EUR",
  "EUR/day",
  "EUR/week",
  "EUR/month",
  "EUR/occurrence",
  "count",
  "count/month",
  "ratio",
]);
const monetaryUnits: ReadonlySet<string> = new Set<MonetaryMetricUnit>([
  "EUR",
  "EUR/day",
  "EUR/week",
  "EUR/month",
  "EUR/occurrence",
]);
const countUnits: ReadonlySet<string> = new Set<CountMetricUnit>([
  "count",
  "count/month",
]);

export function parseMetricUnit(value: unknown): MetricUnit {
  if (typeof value !== "string" || !metricUnits.has(value)) {
    throw new TypeError("MetricUnit doit être une unité canonique valide.");
  }
  return value as MetricUnit;
}

export function isMonetaryMetricUnit(
  unit: MetricUnit,
): unit is MonetaryMetricUnit {
  return monetaryUnits.has(unit);
}

export function isCountMetricUnit(unit: MetricUnit): unit is CountMetricUnit {
  return countUnits.has(unit);
}

export function isRatioMetricUnit(unit: MetricUnit): unit is "ratio" {
  return unit === "ratio";
}
