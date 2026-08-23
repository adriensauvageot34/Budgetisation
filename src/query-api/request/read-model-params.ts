import { isActiveMetricId, type ActiveMetricId } from "../../analytics/production";
import { parseLocalDate, type LocalDate } from "../../core/time";
import { parseAnalysisTargetSubject, type AnalysisTargetSubject } from "../../core/scope";
import { parsePersonaTarget, type PersonaTarget } from "./exploration-params";
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

export type AnalysisEvolutionParams = { readonly view?: "money" | "behavior" };
export type NormalizedAnalysisEvolutionParams = { readonly view: "money" | "behavior" };
export type AnalysisGlobalHabitsView = "contexts" | "heatmap" | "relationships" | "patterns";
export type AnalysisGlobalHabitsParams = { readonly view?: AnalysisGlobalHabitsView };
export type NormalizedAnalysisGlobalHabitsParams = { readonly view: AnalysisGlobalHabitsView };
export type AnalysisGlobalProfilesParams = { readonly target: PersonaTarget };

export type AnalysisMonthStructureViewParam = "destination" | "nature" | "life_context";
export type AnalysisMonthStructureDimensionParam = "family" | "category" | "activity" | "merchant" | "place" | "fixed_variable" | "life_context" | "necessity";
export type AnalysisMonthStructureMeasureParam = "amount" | "share" | "occurrences" | "cost_per_occurrence";
export type AnalysisMonthStructureParams = {
  readonly view?: AnalysisMonthStructureViewParam;
  readonly dimension?: AnalysisMonthStructureDimensionParam;
  readonly measure?: AnalysisMonthStructureMeasureParam;
};
export type NormalizedAnalysisMonthStructureParams = {
  readonly view: AnalysisMonthStructureViewParam;
  readonly dimension: AnalysisMonthStructureDimensionParam;
  readonly measure: AnalysisMonthStructureMeasureParam;
};
export type AnalysisTargetParams = { readonly target: AnalysisTargetSubject };

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

export function parseAnalysisEvolutionParams(value: unknown): NormalizedAnalysisEvolutionParams {
  const record = parseStrictRecord(value, ["view"], "AnalysisEvolutionParams");
  return {
    view: hasOwn(record, "view")
      ? parseStringLiteral(record.view, new Set(["money", "behavior"]), "AnalysisEvolutionParams.view")
      : "money",
  };
}

export function parseAnalysisGlobalHabitsParams(value: unknown): NormalizedAnalysisGlobalHabitsParams {
  const record = parseStrictRecord(value, ["view"], "AnalysisGlobalHabitsParams");
  return {
    view: hasOwn(record, "view")
      ? parseStringLiteral(record.view, new Set(["contexts", "heatmap", "relationships", "patterns"]), "AnalysisGlobalHabitsParams.view")
      : "contexts",
  };
}

export function parseAnalysisGlobalProfilesParams(value: unknown): AnalysisGlobalProfilesParams {
  const record = parseStrictRecord(value, ["target"], "AnalysisGlobalProfilesParams");
  return { target: parsePersonaTarget(requireProperty(record, "target", "AnalysisGlobalProfilesParams")) };
}

const structureViews = new Set<AnalysisMonthStructureViewParam>(["destination", "nature", "life_context"]);
const structureDimensions = new Set<AnalysisMonthStructureDimensionParam>(["family", "category", "activity", "merchant", "place", "fixed_variable", "life_context", "necessity"]);
const structureMeasures = new Set<AnalysisMonthStructureMeasureParam>(["amount", "share", "occurrences", "cost_per_occurrence"]);

export function parseAnalysisMonthStructureParams(
  value: unknown,
): NormalizedAnalysisMonthStructureParams {
  const record = parseStrictRecord(value, ["view", "dimension", "measure"], "AnalysisMonthStructureParams");
  return {
    view: hasOwn(record, "view") ? parseStringLiteral(record.view, structureViews, "Structure view") : "destination",
    dimension: hasOwn(record, "dimension") ? parseStringLiteral(record.dimension, structureDimensions, "Structure dimension") : "category",
    measure: hasOwn(record, "measure") ? parseStringLiteral(record.measure, structureMeasures, "Structure measure") : "amount",
  };
}

export function parseAnalysisTargetParams(value: unknown): AnalysisTargetParams {
  const record = parseStrictRecord(value, ["target"], "AnalysisTargetParams");
  return { target: parseAnalysisTargetSubject(requireProperty(record, "target", "AnalysisTargetParams")) };
}
