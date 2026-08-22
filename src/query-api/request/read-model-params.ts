import {
  getMetricRegistryEntry,
  isActiveMetricId,
  type ActiveMetricId,
} from "../../analytics/production";
import { parseLocalDate, type LocalDate } from "../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";

export type EmptyQueryParams = {
  readonly [key: string]: never;
};

export type HistoryDayDetailParams = {
  readonly date: LocalDate;
};

export type AnalysisBreakdownDimension =
  | "category"
  | "activity"
  | "merchant"
  | "place"
  | "necessity"
  | "fixed_variable"
  | "life_scope"
  | "day_context";

export type AnalysisBreakdownParams = {
  readonly dimension: AnalysisBreakdownDimension;
  readonly measure: ActiveMetricId;
  readonly limit?: number;
};

export type NormalizedAnalysisBreakdownParams = {
  readonly dimension: AnalysisBreakdownDimension;
  readonly measure: ActiveMetricId;
  readonly limit: number;
};

export type AnalysisEvolutionParams = {
  readonly metricId: ActiveMetricId;
};

const dimensions: ReadonlySet<string> = new Set<AnalysisBreakdownDimension>([
  "category",
  "activity",
  "merchant",
  "place",
  "necessity",
  "fixed_variable",
  "life_scope",
  "day_context",
]);

export const analysisMeasuresByDimension = Object.freeze({
  category: Object.freeze(["category_amount"]),
  activity: Object.freeze(["activity_frequency"]),
  merchant: Object.freeze(["merchant_net_amount"]),
  place: Object.freeze([
    "localized_spend",
    "place_visit_count",
    "distinct_visit_days",
  ]),
  necessity: Object.freeze([]),
  fixed_variable: Object.freeze([]),
  life_scope: Object.freeze(["life_scope_amount"]),
  day_context: Object.freeze([]),
} as const satisfies Record<
  AnalysisBreakdownDimension,
  readonly ActiveMetricId[]
>);

export function parseEmptyQueryParams(
  value: unknown,
  typeName = "EmptyQueryParams",
): EmptyQueryParams {
  parseStrictRecord(value, [], typeName);
  return Object.freeze({});
}

export function parseHistoryDayDetailParams(
  value: unknown,
): HistoryDayDetailParams {
  const record = parseStrictRecord(
    value,
    ["date"],
    "HistoryDayDetailParams",
  );
  return {
    date: parseLocalDate(
      requireProperty(record, "date", "HistoryDayDetailParams"),
    ),
  };
}

export function parseAnalysisBreakdownParams(
  value: unknown,
): NormalizedAnalysisBreakdownParams {
  const record = parseStrictRecord(
    value,
    ["dimension", "measure", "limit"],
    "AnalysisBreakdownParams",
  );
  const dimension = parseStringLiteral<AnalysisBreakdownDimension>(
    requireProperty(record, "dimension", "AnalysisBreakdownParams"),
    dimensions,
    "AnalysisBreakdownParams.dimension",
  );
  const measure = requireProperty(
    record,
    "measure",
    "AnalysisBreakdownParams",
  );
  if (!isActiveMetricId(measure)) {
    throw new TypeError("AnalysisBreakdownParams.measure n'est pas actif.");
  }
  if (!analysisMeasuresByDimension[dimension].includes(measure as never)) {
    throw new TypeError("Dimension et MetricId ne sont pas compatibles.");
  }
  const limit = hasOwn(record, "limit") ? record.limit : 10;
  if (
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    throw new TypeError("AnalysisBreakdownParams.limit est invalide.");
  }
  return { dimension, measure, limit };
}

export function parseAnalysisEvolutionParams(
  value: unknown,
): AnalysisEvolutionParams {
  const record = parseStrictRecord(
    value,
    ["metricId"],
    "AnalysisEvolutionParams",
  );
  const metricId = requireProperty(
    record,
    "metricId",
    "AnalysisEvolutionParams",
  );
  if (!isActiveMetricId(metricId)) {
    throw new TypeError("AnalysisEvolutionParams.metricId n'est pas actif.");
  }
  getMetricRegistryEntry(metricId);
  return { metricId };
}
