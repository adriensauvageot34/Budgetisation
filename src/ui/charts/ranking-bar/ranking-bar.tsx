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
import type { MetricId } from "../../../core/identity";
import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import type { ExplorationNode } from "../../../navigation";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import { MetricDisplay, type MetricDisplayValue } from "../../metrics";
import {
  assertMetricUnit,
  chartTickFormatter,
  toTechnicalChartValue,
  type ChartFrameConfiguration,
} from "../shared";

export type RankingBarRow<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly identity: string;
  readonly label: string;
  readonly rank: number;
  readonly metricId: MetricId;
  readonly metric: MetricEnvelope<T, U>;
  readonly navigationIntent?: ExplorationNode;
};

export type RankingBarProps<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly activeMeasure: { readonly metricId: MetricId; readonly unit: U };
  readonly sort: { readonly metricId: MetricId; readonly direction: "asc" | "desc" };
  readonly rows: readonly RankingBarRow<T, U>[];
  readonly onNavigate?: (intent: ExplorationNode) => void;
};

export function RankingBar<T extends MetricDisplayValue, U extends MetricUnit>({
  frame,
  activeMeasure,
  sort,
  rows,
  onNavigate,
}: RankingBarProps<T, U>) {
  if (sort.metricId !== activeMeasure.metricId) {
    throw new TypeError("RankingBar exige active measure = sort measure.");
  }
  for (const row of rows) {
    if (row.metricId !== activeMeasure.metricId) {
      throw new TypeError("RankingBar exige une métrique principale unique.");
    }
    assertMetricUnit(row.metric.unit, activeMeasure.unit, "RankingBar");
  }
  const data = rows.map((row) => ({
    identity: row.identity,
    label: row.label,
    rank: row.rank,
    value: toTechnicalChartValue(row.metric).value,
  }));
  const format = chartTickFormatter(activeMeasure.unit);

  return (
    <ChartFrame {...frame}>
      <div className="ui-chart-renderer" data-chart-kind="ranking_bar">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex);
              const intent = Number.isInteger(index) ? rows[index]?.navigationIntent : undefined;
              if (intent && onNavigate) onNavigate(intent);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={format} />
            <YAxis type="category" dataKey="label" width={120} />
            <Tooltip formatter={(value) => format(Number(value))} />
            <Bar dataKey="value" name="Mesure active" fill={designTokens.color.chart.series[0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ol className="ui-chart-values" aria-label="Valeurs du classement">
        {rows.map((row) => (
          <li key={row.identity} value={row.rank}>
            <span>{row.label}</span>
            <MetricDisplay metric={row.metric} variant="compact" />
          </li>
        ))}
      </ol>
    </ChartFrame>
  );
}
