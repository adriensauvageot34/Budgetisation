"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import { MetricDisplay, type MetricDisplayValue } from "../../metrics";
import {
  assertMetricUnit,
  chartTickFormatter,
  toTechnicalChartValue,
  type ChartFrameConfiguration,
} from "../shared";

export type DotStripPoint<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly identity: string;
  readonly label: string;
  readonly metric: MetricEnvelope<T, U>;
};

export type DotStripMarkers<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly q1?: MetricEnvelope<T, U>;
  readonly q3?: MetricEnvelope<T, U>;
};

export type DotStripProps<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly unit: U;
  readonly points: readonly DotStripPoint<T, U>[];
  readonly markers?: DotStripMarkers<T, U>;
};

export function DotStrip<T extends MetricDisplayValue, U extends MetricUnit>({
  frame,
  unit,
  points,
  markers,
}: DotStripProps<T, U>) {
  for (const point of points) assertMetricUnit(point.metric.unit, unit, "DotStrip");
  if (markers?.q1) assertMetricUnit(markers.q1.unit, unit, "DotStrip");
  if (markers?.q3) assertMetricUnit(markers.q3.unit, unit, "DotStrip");
  const data = points.flatMap((point) => {
    const value = toTechnicalChartValue(point.metric).value;
    return value === null ? [] : [{ identity: point.identity, label: point.label, x: value, y: 1 }];
  });
  const q1 = markers?.q1 ? toTechnicalChartValue(markers.q1).value : null;
  const q3 = markers?.q3 ? toTechnicalChartValue(markers.q3).value : null;
  const format = chartTickFormatter(unit);

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="dot_strip">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid vertical horizontal={false} />
            <XAxis type="number" dataKey="x" tickFormatter={format} />
            <YAxis type="number" dataKey="y" domain={[0, 2]} hide />
            <Tooltip formatter={(value, name) => name === "x" ? format(Number(value)) : ""} />
            {q1 === null ? null : <ReferenceLine x={q1} stroke={designTokens.color.chart.series[1]} strokeDasharray="4 4" />}
            {q3 === null ? null : <ReferenceLine x={q3} stroke={designTokens.color.chart.series[2]} strokeDasharray="4 4" />}
            <Scatter data={data} fill={designTokens.color.chart.series[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="ui-chart-values" aria-label="Valeurs individuelles">
        {points.map((point) => (
          <li key={point.identity}>
            <span>{point.label}</span>
            <MetricDisplay metric={point.metric} variant="compact" />
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
