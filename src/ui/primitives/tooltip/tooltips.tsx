import type { ReactNode } from "react";

export type InfoTooltipProps = {
  readonly label: string;
  readonly children: ReactNode;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  return (
    <details className="ui-info-tooltip">
      <summary className="ui-focusable">{label}</summary>
      <div>{children}</div>
    </details>
  );
}

export type ChartTooltipProps = {
  readonly label: string;
  readonly children: ReactNode;
};

export function ChartTooltip({ label, children }: ChartTooltipProps) {
  return (
    <div className="ui-chart-tooltip" role="status" aria-label={label}>
      <strong>{label}</strong>
      <div>{children}</div>
    </div>
  );
}

export function DisabledReason({ children }: { readonly children: ReactNode }) {
  return <p className="ui-disabled-reason">{children}</p>;
}
