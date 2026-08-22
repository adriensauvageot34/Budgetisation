import { designTokens } from "../../foundations";

export type ChartLegendItem = {
  readonly id: string;
  readonly label: string;
  readonly colorIndex: 0 | 1 | 2 | 3 | 4;
};

export function ChartLegend({ items }: { readonly items: readonly ChartLegendItem[] }) {
  return (
    <ul className="ui-chart-legend-list" aria-label="Légende">
      {items.map((item) => (
        <li key={item.id}>
          <span aria-hidden="true" style={{ background: designTokens.color.chart.series[item.colorIndex] }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
