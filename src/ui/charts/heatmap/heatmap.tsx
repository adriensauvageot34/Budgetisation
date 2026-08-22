import type { MetricUnit } from "../../../core/money";
import { ChartFrame } from "../../composites";
import { designTokens } from "../../foundations";
import type { ResolvedMetricDisplay } from "../../metrics";
import type { ChartFrameConfiguration } from "../shared";

export type HeatmapContract =
  | {
      readonly dimension: "activity_month";
      readonly measure: "activity_frequency" | "causal_amount" | "ticket";
    }
  | {
      readonly dimension: "activity_weekday";
      readonly measure: "activity_frequency";
    }
  | {
      readonly dimension: "merchant_month";
      readonly measure: "purchase_count" | "merchant_net_amount" | "ticket";
    }
  | {
      readonly dimension: "place_month";
      readonly measure: "place_visit_count" | "localized_spend";
    };

export type HeatmapPalette =
  | { readonly kind: "sequential" }
  | { readonly kind: "diverging"; readonly center: 0 };

export type HeatmapIntensity = "low" | "medium" | "high";

export type HeatmapCell<U extends MetricUnit> = {
  readonly rowId: string;
  readonly rowLabel: string;
  readonly columnId: string;
  readonly columnLabel: string;
  readonly display: ResolvedMetricDisplay<U>;
  readonly rendererValue: number | null;
  readonly intensity: HeatmapIntensity;
};

export type HeatmapCellState =
  | "value"
  | "unknown"
  | "not_applicable"
  | "insufficient_support"
  | "conflict";

export const heatmapContractKeys: readonly string[] = [
  "activity_month:activity_frequency",
  "activity_month:causal_amount",
  "activity_month:ticket",
  "activity_weekday:activity_frequency",
  "merchant_month:purchase_count",
  "merchant_month:merchant_net_amount",
  "merchant_month:ticket",
  "place_month:place_visit_count",
  "place_month:localized_spend",
];

export function assertHeatmapContract(contract: HeatmapContract): void {
  if (!heatmapContractKeys.includes(`${contract.dimension}:${contract.measure}`)) {
    throw new TypeError("Heatmap refuse cette combinaison dimension × mesure.");
  }
}

export function resolveHeatmapCellState<U extends MetricUnit>(
  cell: HeatmapCell<U>,
): HeatmapCellState {
  if (cell.display.state === "not_applicable") return "not_applicable";
  if (cell.display.state === "unknown") return "unknown";
  if (cell.display.state === "conflict") return "conflict";
  if (cell.display.qualifiers.includes("insufficient_support")) {
    return "insufficient_support";
  }
  return "value";
}

export function heatmapCellColor<U extends MetricUnit>(
  cell: HeatmapCell<U>,
  palette: HeatmapPalette,
): string {
  const state = resolveHeatmapCellState(cell);
  if (state === "unknown" || state === "conflict") return designTokens.color.chart.unknown;
  if (state === "not_applicable") return designTokens.color.chart.notApplicable;
  if (state === "insufficient_support") return designTokens.color.chart.insufficient;
  if (cell.rendererValue === null || !Number.isFinite(cell.rendererValue)) {
    throw new TypeError("Une cellule Heatmap connue exige rendererValue fini.");
  }
  if (palette.kind === "diverging") {
    if (palette.center !== 0) throw new TypeError("La palette divergente doit être centrée sur 0.");
    if (cell.rendererValue === 0) return designTokens.color.chart.diverging.center;
    return cell.rendererValue < 0
      ? designTokens.color.chart.diverging.low
      : designTokens.color.chart.diverging.high;
  }
  return designTokens.color.chart.sequential[cell.intensity];
}

export type HeatmapProps<U extends MetricUnit> = {
  readonly frame: ChartFrameConfiguration;
  readonly contract: HeatmapContract;
  readonly unit: U;
  readonly palette: HeatmapPalette;
  readonly rowIds: readonly string[];
  readonly columnIds: readonly string[];
  readonly cells: readonly HeatmapCell<U>[];
};

export function Heatmap<U extends MetricUnit>({
  frame,
  contract,
  unit,
  palette,
  rowIds,
  columnIds,
  cells,
}: HeatmapProps<U>) {
  assertHeatmapContract(contract);
  if (palette.kind === "diverging" && palette.center !== 0) {
    throw new TypeError("Heatmap divergente exige center: 0.");
  }
  const byPosition = new Map(cells.map((cell) => [`${cell.rowId}\u0000${cell.columnId}`, cell]));
  if (byPosition.size !== cells.length || cells.length !== rowIds.length * columnIds.length) {
    throw new TypeError("Heatmap exige exactement une cellule par position whitelistée.");
  }
  for (const cell of cells) {
    if (cell.display.unit !== unit) throw new TypeError("Heatmap refuse les unités incompatibles.");
    const state = resolveHeatmapCellState(cell);
    if (state !== "value" && cell.rendererValue !== null) {
      throw new TypeError("Heatmap ne trace pas unknown/not_applicable comme zéro.");
    }
  }

  return (
    <ChartFrame {...frame}>
      <div
        className="ui-heatmap"
        data-chart-kind="heatmap"
        role="grid"
        style={{ gridTemplateColumns: `minmax(8rem, auto) repeat(${columnIds.length}, minmax(3rem, 1fr))` }}
      >
        <span aria-hidden="true" />
        {columnIds.map((columnId) => {
          const label = cells.find((cell) => cell.columnId === columnId)?.columnLabel ?? columnId;
          return <strong key={columnId} role="columnheader">{label}</strong>;
        })}
        {rowIds.flatMap((rowId) => {
          const rowLabel = cells.find((cell) => cell.rowId === rowId)?.rowLabel ?? rowId;
          return [
            <strong key={`${rowId}-label`} role="rowheader">{rowLabel}</strong>,
            ...columnIds.map((columnId) => {
              const cell = byPosition.get(`${rowId}\u0000${columnId}`);
              if (!cell) throw new TypeError("Cellule Heatmap manquante.");
              const state = resolveHeatmapCellState(cell);
              const accessible = `${rowLabel}, ${cell.columnLabel}, ${cell.display.accessibleText ?? state}`;
              return (
                <span
                  key={`${rowId}-${columnId}`}
                  role="gridcell"
                  className="ui-heatmap-cell ui-focusable"
                  tabIndex={0}
                  data-state={state}
                  aria-label={accessible}
                  style={{ background: heatmapCellColor(cell, palette) }}
                >
                  {cell.display.primaryText}
                </span>
              );
            }),
          ];
        })}
      </div>
    </ChartFrame>
  );
}
