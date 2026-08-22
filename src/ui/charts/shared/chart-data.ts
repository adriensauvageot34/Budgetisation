import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import type { MetricDisplayValue } from "../../metrics";
import { formatMetricValue } from "../../metrics";
import type { TechnicalChartValue } from "./chart.types";

export function toTechnicalChartValue<
  T extends MetricDisplayValue,
  U extends MetricUnit,
>(metric: MetricEnvelope<T, U>): TechnicalChartValue {
  if (metric.availability !== "known") {
    return { state: metric.availability, value: null };
  }
  const value = Number(metric.value);
  if (!Number.isFinite(value)) {
    throw new TypeError("La représentation technique du chart doit être finie.");
  }
  return { state: "known", value };
}

export function assertMetricUnit(
  actual: MetricUnit,
  expected: MetricUnit,
  contract: string,
): void {
  if (actual !== expected) {
    throw new TypeError(`${contract} refuse des unités incompatibles.`);
  }
}

export function assertChronologicalLabels(
  labels: readonly string[],
  contract: string,
): void {
  for (let index = 1; index < labels.length; index += 1) {
    if (labels[index - 1] >= labels[index]) {
      throw new TypeError(`${contract} exige des points chronologiques sans doublon.`);
    }
  }
}

export function chartTickFormatter(unit: MetricUnit): (value: number) => string {
  return (value) => formatMetricValue(value, unit).primaryText;
}
