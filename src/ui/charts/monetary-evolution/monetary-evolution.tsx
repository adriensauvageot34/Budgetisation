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
import type { MonetaryMetricUnit, Money } from "../../../core/money";
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

export type MonetaryEvolutionPoint<U extends MonetaryMetricUnit> = {
  readonly period: string;
  readonly label: string;
  readonly actual: MetricEnvelope<Money, U>;
  readonly typical?: MetricEnvelope<Money, U>;
  readonly minimal?: MetricEnvelope<Money, U>;
};

export type MonetaryEvolutionProps<U extends MonetaryMetricUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly unit: U;
  readonly points: readonly MonetaryEvolutionPoint<U>[];
  readonly onSelectPoint?: (point: MonetaryEvolutionPoint<U>) => void;
};

export type MultiSeriesMonetaryEvolutionSeries = {
  readonly id: string;
  readonly label: string;
  readonly points: readonly { readonly period: string; readonly label: string; readonly metric: MetricEnvelope<Money, MonetaryMetricUnit> }[];
};

export type MultiSeriesMonetaryEvolutionProps = {
  readonly frame: ChartFrameConfiguration;
  readonly unit: "EUR";
  readonly series: readonly MultiSeriesMonetaryEvolutionSeries[];
  readonly selectedPeriod?: string;
  readonly onSelectPeriod?: (period: string) => void;
};

export function MonetaryEvolution<U extends MonetaryMetricUnit>({
  frame,
  unit,
  points,
  onSelectPoint,
}: MonetaryEvolutionProps<U>) {
  assertChronologicalLabels(points.map((point) => point.period), "MonetaryEvolution");
  for (const point of points) {
    assertMetricUnit(point.actual.unit, unit, "MonetaryEvolution");
    if (point.typical) assertMetricUnit(point.typical.unit, unit, "MonetaryEvolution");
    if (point.minimal) assertMetricUnit(point.minimal.unit, unit, "MonetaryEvolution");
  }
  const data = points.map((point) => ({
    period: point.period,
    label: point.label,
    actual: toTechnicalChartValue(point.actual).value,
    typical: point.typical ? toTechnicalChartValue(point.typical).value : null,
    minimal: point.minimal ? toTechnicalChartValue(point.minimal).value : null,
  }));
  const format = chartTickFormatter(unit);

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="monetary_evolution">
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
            <Line dataKey="actual" name="Réel" type="linear" connectNulls={false} stroke={designTokens.color.chart.series[0]} dot />
            <Line dataKey="typical" name="Typique" type="linear" connectNulls={false} stroke={designTokens.color.chart.series[1]} strokeDasharray="6 4" dot />
            <Line dataKey="minimal" name="Minimal" type="linear" connectNulls={false} stroke={designTokens.color.chart.series[2]} strokeDasharray="2 4" dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function MultiSeriesMonetaryEvolution({
  frame,
  unit,
  series,
  selectedPeriod,
  onSelectPeriod,
}: MultiSeriesMonetaryEvolutionProps) {
  const periods = series[0]?.points ?? [];
  assertChronologicalLabels(periods.map(({ period }) => period), "MultiSeriesMonetaryEvolution");
  for (const item of series) {
    if (item.points.length !== periods.length || item.points.some((point, index) => point.period !== periods[index]?.period)) {
      throw new TypeError("Les séries monétaires doivent partager les mêmes périodes explicites.");
    }
    for (const point of item.points) {
      if (!point.metric.unit.startsWith("EUR")) throw new TypeError("Une série monétaire EUR était attendue.");
    }
  }
  const data = periods.map((period, index) => ({
    period: period.period,
    label: period.label,
    ...Object.fromEntries(series.map((item) => [item.id, toTechnicalChartValue(item.points[index]!.metric).value])),
  }));
  const format = chartTickFormatter(unit);
  const selectedLabel = periods.find(({ period }) => period === selectedPeriod)?.label;
  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="monetary_evolution" data-series-count={series.length} data-selected-period={selectedPeriod}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} onClick={(state) => {
            const index = Number(state?.activeTooltipIndex);
            const period = Number.isInteger(index) ? periods[index]?.period : undefined;
            if (period && onSelectPeriod) onSelectPeriod(period);
          }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis domain={["auto", "auto"]} tickFormatter={format} />
            <Tooltip formatter={(value) => format(Number(value))} />
            <ReferenceLine y={0} stroke={designTokens.color.border.strong} />
            {selectedLabel ? <ReferenceLine x={selectedLabel} stroke={designTokens.color.chart.series[0]} strokeDasharray="3 3" /> : null}
            {series.map((item, index) => (
              <Line key={item.id} dataKey={item.id} name={item.label} type="linear" connectNulls={false} stroke={designTokens.color.chart.series[index % designTokens.color.chart.series.length]} dot />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
