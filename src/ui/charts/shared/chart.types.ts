import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import type { ChartFrameProps } from "../../composites";
import type { MetricDisplayValue } from "../../metrics";
import type { ExplorationNode, ShowDayNavigationIntent } from "../../../navigation";

export const chartKinds = [
  "monetary_evolution",
  "behavior_evolution",
  "week_bars",
  "ranking_bar",
  "exhaustive_stack",
  "frequency_cost_scatter",
  "heatmap",
  "dot_strip",
] as const;
export type ChartKind = (typeof chartKinds)[number];

export type ChartFrameConfiguration = Omit<ChartFrameProps, "children">;

export type ChartMetric<
  T extends MetricDisplayValue,
  U extends MetricUnit,
> = MetricEnvelope<T, U>;

export type ChartNavigation<Intent> = {
  readonly intent: Intent;
  readonly onNavigate: (intent: Intent) => void;
};

export type ChartEntityNavigationIntent = ExplorationNode;
export type ChartDayNavigationIntent = ShowDayNavigationIntent;

export type TechnicalChartValue = {
  readonly state: "known" | "unknown" | "not_applicable" | "conflict";
  readonly value: number | null;
};
