import type { ActiveMetricId } from "../../../analytics/production";
import { compareYearMonth, parseYearMonth } from "../../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import {
  parsePeriodCompleteness,
  parseScopedMetricReadModel,
} from "../../read-models";
import type { AnalysisSeriesPoint } from "./types";
import { parseMoneyComparisonResult } from "./validation";

export function parseAnalysisSeriesPoints(
  value: unknown,
  metricId: ActiveMetricId,
): readonly AnalysisSeriesPoint[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Analysis series points doit être un tableau.");
  }
  const points = value.map((point) => {
    const record = parseStrictRecord(
      point,
      ["period", "metric", "comparison", "periodCompleteness"],
      "AnalysisSeriesPoint",
    );
    const period = parseYearMonth(
      requireProperty(record, "period", "AnalysisSeriesPoint"),
    );
    const metric = parseScopedMetricReadModel(
      requireProperty(record, "metric", "AnalysisSeriesPoint"),
    );
    if (metric.metricId !== metricId) {
      throw new TypeError("AnalysisSeriesPoint MetricId est incohérente.");
    }
    const comparison = hasOwn(record, "comparison")
      ? parseMoneyComparisonResult(record.comparison)
      : undefined;
    if (comparison !== undefined) {
      if (
        comparison.target.metricId !== metric.metricId ||
        comparison.target.scopeHash !== metric.scopeHash ||
        JSON.stringify(comparison.target.envelope) !==
          JSON.stringify(metric.envelope)
      ) {
        throw new TypeError("Series comparison target est incohérente.");
      }
      const reference = comparison.reference.envelope.reference;
      if (
        reference?.family !== "comparison" ||
        reference.target.kind !== "month" ||
        reference.target.month !== period
      ) {
        throw new TypeError(
          "Chaque point historique doit conserver sa référence rolling propre.",
        );
      }
    }
    return {
      period,
      metric,
      ...(comparison === undefined ? {} : { comparison }),
      periodCompleteness: parsePeriodCompleteness(
        requireProperty(record, "periodCompleteness", "AnalysisSeriesPoint"),
      ),
    };
  });
  for (let index = 1; index < points.length; index += 1) {
    if (compareYearMonth(points[index - 1].period, points[index].period) >= 0) {
      throw new TypeError("Analysis series doit être triée et sans doublons.");
    }
  }
  return points;
}

