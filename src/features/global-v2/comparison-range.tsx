import type { CSSProperties } from "react";
import type { GlobalTypedMeasure } from "@/query-api/global-v2";
import { buildComparisonRangeModel } from "./comparison-range-model";
import styles from "./global-v2.module.css";

export type ComparisonRangeProps = {
  readonly observed: GlobalTypedMeasure;
  readonly median: GlobalTypedMeasure;
  readonly lower?: GlobalTypedMeasure | undefined;
  readonly upper?: GlobalTypedMeasure | undefined;
  readonly supportCount?: GlobalTypedMeasure | undefined;
  readonly subjectLabel?: string | undefined;
  readonly comparisonLabel?: string | undefined;
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function positioned(left: number): CSSProperties {
  return { left: `${left}%` };
}

export function ComparisonRange(props: ComparisonRangeProps) {
  const model = buildComparisonRangeModel(props);
  if (model === undefined) return null;
  const hasRange = model.mode === "Q1_Q3" && model.lower !== undefined && model.upper !== undefined && model.lowerPosition !== undefined && model.upperPosition !== undefined;

  return <figure className={styles.comparisonRange} role="img" aria-label={model.accessibleLabel} data-comparison-range={model.mode.toLowerCase()}>
    <div className={styles.comparisonRangePlot} aria-hidden="true">
      <span className={styles.comparisonRangeTrack} />
      {hasRange ? <span className={styles.comparisonRangeReference} style={{ left: `${model.lowerPosition}%`, width: `${model.upperPosition - model.lowerPosition}%` }} /> : null}
      <span className={styles.comparisonRangeMedianMarker} style={positioned(model.medianPosition)} />
      <span className={styles.comparisonRangeObservedMarker} style={positioned(model.observedPosition)} />
    </div>
    <figcaption className={styles.comparisonRangeLegend} aria-hidden="true">
      {hasRange ? <span className={styles.comparisonRangeReferenceCopy}>Plage de référence : {moneyFormatter.format(model.lower)} – {moneyFormatter.format(model.upper)}</span> : null}
      <span><i className={styles.comparisonRangeMedianKey} />Médiane · {moneyFormatter.format(model.median)}</span>
      <span><i className={styles.comparisonRangeObservedKey} />Ce moment · {moneyFormatter.format(model.observed)}</span>
    </figcaption>
  </figure>;
}
