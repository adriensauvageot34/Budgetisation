import type { MetricUnit } from "../../../core/money";
import type { MetricEnvelope } from "../../../core/metrics";
import { MetricDisplay, type MetricDisplayValue } from "../../metrics";

export type ReferenceMarkerProps<
  T extends MetricDisplayValue,
  U extends MetricUnit,
> = {
  readonly label: string;
  readonly reference: MetricEnvelope<T, U>;
};

export function ReferenceMarker<
  T extends MetricDisplayValue,
  U extends MetricUnit,
>({ label, reference }: ReferenceMarkerProps<T, U>) {
  return (
    <span className="ui-reference-marker">
      <span>{label}</span>
      <MetricDisplay metric={reference} variant="reference" />
    </span>
  );
}
