import { designTokens } from "../../foundations";

export type ChartLegendItem = {
  readonly id: string;
  readonly label: string;
  readonly colorIndex: 0 | 1 | 2 | 3 | 4;
  readonly strokeStyle?: "solid" | "dashed" | "dotted";
};

export function ChartLegend({ items }: { readonly items: readonly ChartLegendItem[] }) {
  return (
    <ul className="ui-chart-legend-list" aria-label="Légende du graphique">
      {items.map((item) => {
        const color = designTokens.color.chart.series[item.colorIndex];
        return <li key={item.id}>
          <span aria-hidden="true" style={item.strokeStyle === undefined ? { background: color } : { height: 0, borderTop: `2px ${item.strokeStyle} ${color}`, borderRadius: 0, background: "transparent" }} />
          {item.label}
        </li>;
      })}
    </ul>
  );
}
