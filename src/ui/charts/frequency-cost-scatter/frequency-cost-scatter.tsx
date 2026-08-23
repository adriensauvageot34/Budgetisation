"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Money } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import type { ExplorationNode } from "../../../navigation";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import { MetricDisplay } from "../../metrics";
import {
  chartTickFormatter,
  toTechnicalChartValue,
  type ChartFrameConfiguration,
} from "../shared";

export type FrequencyCostScatterPoint = {
  readonly identity: string;
  readonly label: string;
  readonly occurrences: MetricEnvelope<number, "count" | "count/month">;
  readonly medianCausalCostPerOccurrence: MetricEnvelope<Money, "EUR/occurrence">;
  readonly totalCausalCost?: MetricEnvelope<Money, "EUR">;
  readonly navigationIntent?: ExplorationNode;
};

export type FrequencyCostScatterProps = {
  readonly frame: ChartFrameConfiguration;
  readonly points: readonly FrequencyCostScatterPoint[];
  readonly onNavigate?: (intent: ExplorationNode) => void;
};

export function FrequencyCostScatter({
  frame,
  points,
  onNavigate,
}: FrequencyCostScatterProps) {
  const data = points.flatMap((point) => {
    const x = toTechnicalChartValue(point.occurrences);
    const y = toTechnicalChartValue(point.medianCausalCostPerOccurrence);
    return x.value === null || y.value === null
      ? []
      : [{ identity: point.identity, label: point.label, x: x.value, y: y.value }];
  });
  const formatX = chartTickFormatter("count");
  const formatY = chartTickFormatter("EUR/occurrence");

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="frequency_cost_scatter">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex);
              const plotted = Number.isInteger(index) ? data[index] : undefined;
              const intent = plotted
                ? points.find((point) => point.identity === plotted.identity)?.navigationIntent
                : undefined;
              if (intent && onNavigate) onNavigate(intent);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="Occurrences" tickFormatter={formatX} />
            <YAxis type="number" dataKey="y" name="Coût médian par occurrence" tickFormatter={formatY} />
            <Tooltip formatter={(value, name) => name === "Occurrences" ? formatX(Number(value)) : formatY(Number(value))} />
            <Scatter data={data} fill={designTokens.color.chart.series[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="ui-chart-values" aria-label="Valeurs fréquence et coût">
        {points.map((point) => (
          <li key={point.identity}>
            <strong>{point.label}</strong>
            <MetricDisplay metric={point.occurrences} variant="compact" />
            <MetricDisplay metric={point.medianCausalCostPerOccurrence} variant="compact" />
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
