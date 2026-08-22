import type { MetricUnit } from "../../core/money";
import type { MetricEnvelope } from "../../core/metrics";
import { metricQualifierLabels } from "./metric-presentation";
import { resolveMetricDisplay } from "./resolve-metric-display";
import type {
  MetricDisplayValue,
  ResolveMetricDisplayOptions,
} from "./metric-display.types";

export type MetricDisplayProps<
  T extends MetricDisplayValue,
  U extends MetricUnit,
> = ResolveMetricDisplayOptions & {
  readonly metric: MetricEnvelope<T, U>;
  readonly className?: string;
};

export function MetricDisplay<
  T extends MetricDisplayValue,
  U extends MetricUnit,
>({ metric, className, ...options }: MetricDisplayProps<T, U>) {
  const resolved = resolveMetricDisplay(metric, options);
  if (resolved.state === "not_applicable") return null;

  return (
    <span
      className={className}
      data-metric-display=""
      data-state={resolved.state}
      data-variant={resolved.variant}
      aria-label={resolved.accessibleText ?? undefined}
    >
      <span data-metric-primary="">{resolved.primaryText}</span>
      {resolved.qualifiers.map((qualifier) => (
        <span key={qualifier} data-metric-qualifier={qualifier}>
          {metricQualifierLabels[qualifier]}
        </span>
      ))}
      {resolved.coverageDetailText ? (
        <span data-metric-detail="">{resolved.coverageDetailText}</span>
      ) : null}
    </span>
  );
}
