"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountMetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import {
  assertChronologicalLabels,
  assertMetricUnit,
  chartTickFormatter,
  toTechnicalChartValue,
  type ChartFrameConfiguration,
} from "../shared";

export type BehaviorMetricUnit = CountMetricUnit | "ratio";

export type BehaviorEvolutionPoint<U extends BehaviorMetricUnit> = {
  readonly period: string;
  readonly label: string;
  readonly metric: MetricEnvelope<number, U>;
  readonly reference?: MetricEnvelope<number, U>;
};

export type BehaviorEvolutionProps<U extends BehaviorMetricUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly unit: U;
  readonly points: readonly BehaviorEvolutionPoint<U>[];
  readonly onSelectPoint?: (point: BehaviorEvolutionPoint<U>) => void;
};

export function BehaviorEvolution<U extends BehaviorMetricUnit>({
  frame,
  unit,
  points,
  onSelectPoint,
}: BehaviorEvolutionProps<U>) {
  assertChronologicalLabels(points.map((point) => point.period), "BehaviorEvolution");
  for (const point of points) {
    assertMetricUnit(point.metric.unit, unit, "BehaviorEvolution");
    if (point.reference) assertMetricUnit(point.reference.unit, unit, "BehaviorEvolution");
  }
  const data = points.map((point) => ({
    period: point.period,
    label: point.label,
    value: toTechnicalChartValue(point.metric).value,
    reference: point.reference ? toTechnicalChartValue(point.reference).value : null,
  }));
  const format = chartTickFormatter(unit);

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="behavior_evolution">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex);
              if (onSelectPoint && Number.isInteger(index) && points[index]) onSelectPoint(points[index]);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis domain={["auto", "auto"]} tickFormatter={format} />
            <Tooltip formatter={(value) => format(Number(value))} />
            <ReferenceLine y={0} stroke={designTokens.color.border.strong} />
            <Line dataKey="value" name="Valeur" type="linear" connectNulls={false} stroke={designTokens.color.chart.series[0]} dot />
            <Line dataKey="reference" name="Référence" type="linear" connectNulls={false} stroke={designTokens.color.chart.series[1]} strokeDasharray="6 4" dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
