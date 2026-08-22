import type { ReactNode } from "react";
import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import { MetricDisplay, type MetricDisplayValue } from "../../metrics";
import { Surface, type UiAction } from "../../primitives";

export type RankingBarPresentation = {
  readonly widthPercent: number;
  readonly accessibleText: string;
};

export type RankingRowProps<
  T extends MetricDisplayValue,
  U extends MetricUnit,
  NavigationIntent = never,
> = {
  readonly identity: string;
  readonly label: string;
  readonly metric: MetricEnvelope<T, U>;
  readonly rankLabel?: string;
  readonly bar?: RankingBarPresentation;
  readonly reference?: ReactNode;
  readonly badge?: ReactNode;
  readonly secondary?: ReactNode;
  readonly action?: UiAction<NavigationIntent>;
};

export function RankingRow<
  T extends MetricDisplayValue,
  U extends MetricUnit,
  NavigationIntent = never,
>({
  identity,
  label,
  metric,
  rankLabel,
  bar,
  reference,
  badge,
  secondary,
  action,
}: RankingRowProps<T, U, NavigationIntent>) {
  if (
    bar &&
    (!Number.isFinite(bar.widthPercent) ||
      bar.widthPercent < 0 ||
      bar.widthPercent > 100)
  ) {
    throw new TypeError("RankingRow reçoit un widthPercent déjà résolu entre 0 et 100.");
  }
  return (
    <Surface variant="plain" action={action} className="ui-ranking-row" ariaLabel={label}>
      <span data-ranking-identity={identity} className="ui-ranking-label">
        {rankLabel ? <span>{rankLabel}</span> : null}
        <strong>{label}</strong>
      </span>
      <MetricDisplay metric={metric} variant="compact" />
      {bar ? (
        <span className="ui-ranking-track" aria-label={bar.accessibleText}>
          <span className="ui-ranking-bar" style={{ width: `${bar.widthPercent}%` }} />
        </span>
      ) : null}
      {reference}
      {badge}
      {secondary ? <span className="ui-ranking-secondary">{secondary}</span> : null}
    </Surface>
  );
}

export function RankingList({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return <div className="ui-ranking-list" role="list" aria-label={label}>{children}</div>;
}
