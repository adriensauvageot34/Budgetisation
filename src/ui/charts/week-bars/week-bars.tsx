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
import type { LocalDate } from "../../../core/time";
import type { ShowDayNavigationIntent } from "../../../navigation";
import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import type { MetricDisplayValue } from "../../metrics";
import {
  assertChronologicalLabels,
  assertMetricUnit,
  chartTickFormatter,
  toTechnicalChartValue,
  type ChartFrameConfiguration,
} from "../shared";

export type WeekBarPoint<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly date: LocalDate;
  readonly label: string;
  readonly metric: MetricEnvelope<T, U>;
  readonly navigationIntent?: ShowDayNavigationIntent;
};

export type SevenDayPoints<T extends MetricDisplayValue, U extends MetricUnit> = readonly [
  WeekBarPoint<T, U>, WeekBarPoint<T, U>, WeekBarPoint<T, U>,
  WeekBarPoint<T, U>, WeekBarPoint<T, U>, WeekBarPoint<T, U>,
  WeekBarPoint<T, U>,
];

export type WeekBarsProps<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly unit: U;
  readonly points: SevenDayPoints<T, U>;
  readonly onNavigate?: (intent: ShowDayNavigationIntent) => void;
};

export function WeekBars<T extends MetricDisplayValue, U extends MetricUnit>({
  frame,
  unit,
  points,
  onNavigate,
}: WeekBarsProps<T, U>) {
  if (points.length !== 7) throw new TypeError("WeekBars exige exactement 7 jours.");
  assertChronologicalLabels(points.map((point) => point.date), "WeekBars");
  for (const point of points) assertMetricUnit(point.metric.unit, unit, "WeekBars");
  const data = points.map((point) => ({
    date: point.date,
    label: point.label,
    value: toTechnicalChartValue(point.metric).value,
  }));
  const format = chartTickFormatter(unit);

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="week_bars">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex);
              const intent = Number.isInteger(index) ? points[index]?.navigationIntent : undefined;
              if (intent !== undefined && onNavigate) onNavigate(intent);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={format} />
            <Tooltip formatter={(value) => format(Number(value))} />
            <Bar dataKey="value" name="Valeur" fill={designTokens.color.chart.series[0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
