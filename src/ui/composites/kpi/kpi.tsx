import type { ReactNode } from "react";
import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import {
  MetricDisplay,
  type MetricDisplayValue,
  type MetricDisplayVariant,
  type ResolveMetricDisplayOptions,
} from "../../metrics";
import { Typography } from "../../foundations";

export type KpiProps<T extends MetricDisplayValue, U extends MetricUnit> = {
  readonly label: string;
  readonly metric: MetricEnvelope<T, U>;
  readonly variant?: MetricDisplayVariant;
  readonly description?: ReactNode;
  readonly displayOptions?: Omit<ResolveMetricDisplayOptions, "variant">;
};

export function KPI<T extends MetricDisplayValue, U extends MetricUnit>({
  label,
  metric,
  variant = "standard",
  description,
  displayOptions,
}: KpiProps<T, U>) {
  return (
    <section className="ui-kpi" data-variant={variant} aria-label={label}>
      <Typography variant="metadata">{label}</Typography>
      <Typography variant="metric_value">
        <MetricDisplay metric={metric} variant={variant} {...displayOptions} />
      </Typography>
      {description ? <div className="ui-kpi-description">{description}</div> : null}
    </section>
  );
}
