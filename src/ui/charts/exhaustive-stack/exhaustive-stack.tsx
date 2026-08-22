"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CountMetricUnit,
  MonetaryMetricUnit,
  Money,
} from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import {
  assertMetricUnit,
  chartTickFormatter,
  toTechnicalChartValue,
  type ChartFrameConfiguration,
} from "../shared";

export type ExhaustiveStackUnit = MonetaryMetricUnit | CountMetricUnit;
export type ExhaustiveStackValue<U extends ExhaustiveStackUnit> =
  U extends MonetaryMetricUnit ? Money : number;

export type ExhaustiveStackCategory = {
  readonly id: string;
  readonly label: string;
  readonly kind: "canonical" | "undetermined" | "remainder";
};

export type ExhaustiveStackSegment<U extends ExhaustiveStackUnit> = {
  readonly categoryId: string;
  readonly metric: MetricEnvelope<ExhaustiveStackValue<U>, U>;
};

export type ExhaustiveStackPoint<U extends ExhaustiveStackUnit> = {
  readonly id: string;
  readonly label: string;
  readonly segments: readonly ExhaustiveStackSegment<U>[];
};

export type ExhaustiveStackProps<U extends ExhaustiveStackUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly unit: U;
  readonly proof: {
    readonly mutuallyExclusive: true;
    readonly exhaustive: true;
    readonly additiveMeasure: true;
    readonly reconciliation: "exact";
  };
  readonly categories: readonly ExhaustiveStackCategory[];
  readonly points: readonly ExhaustiveStackPoint<U>[];
};

export function ExhaustiveStack<U extends ExhaustiveStackUnit>({
  frame,
  unit,
  proof,
  categories,
  points,
}: ExhaustiveStackProps<U>) {
  if (
    proof.mutuallyExclusive !== true ||
    proof.exhaustive !== true ||
    proof.additiveMeasure !== true ||
    proof.reconciliation !== "exact"
  ) {
    throw new TypeError("ExhaustiveStack exige une preuve additive exhaustive exacte.");
  }
  const categoryIds = new Set(categories.map((category) => category.id));
  if (categoryIds.size !== categories.length) {
    throw new TypeError("ExhaustiveStack refuse les catégories dupliquées.");
  }
  const data = points.map((point) => {
    const segments = new Map(point.segments.map((segment) => [segment.categoryId, segment]));
    if (segments.size !== categories.length || point.segments.length !== categories.length) {
      throw new TypeError("ExhaustiveStack exige chaque catégorie exactement une fois.");
    }
    const row: Record<string, string | number | null> = {
      id: point.id,
      label: point.label,
    };
    for (const category of categories) {
      const segment = segments.get(category.id);
      if (!segment || !categoryIds.has(segment.categoryId)) {
        throw new TypeError("ExhaustiveStack contient une catégorie inconnue.");
      }
      assertMetricUnit(segment.metric.unit, unit, "ExhaustiveStack");
      row[category.id] = toTechnicalChartValue(segment.metric).value;
    }
    return row;
  });
  const format = chartTickFormatter(unit);

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="exhaustive_stack">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={format} />
            <Tooltip formatter={(value) => format(Number(value))} />
            {categories.map((category, index) => (
              <Bar
                key={category.id}
                dataKey={category.id}
                name={category.label}
                stackId="exhaustive"
                fill={designTokens.color.chart.series[index % designTokens.color.chart.series.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
