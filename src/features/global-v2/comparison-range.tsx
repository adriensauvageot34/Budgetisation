import { useState, type CSSProperties, type ReactNode } from "react";
import type { GlobalTypedMeasure } from "@/query-api/global-v2";
import { buildComparisonRangeModel, comparisonRangePeerRef, type ComparisonRangePeerObservation } from "./comparison-range-model";
import styles from "./global-v2.module.css";

export type ComparisonRangeProps<Peer extends ComparisonRangePeerObservation = ComparisonRangePeerObservation> = {
  readonly observed: GlobalTypedMeasure;
  readonly median: GlobalTypedMeasure;
  readonly lower?: GlobalTypedMeasure | undefined;
  readonly upper?: GlobalTypedMeasure | undefined;
  readonly supportCount?: GlobalTypedMeasure | undefined;
  readonly subjectLabel?: string | undefined;
  readonly comparisonLabel?: string | undefined;
  readonly peers?: readonly Peer[] | undefined;
  readonly onOpenPeer?: ((peer: Peer) => void) | undefined;
  readonly onSelectPeer?: ((peer: Peer) => void) | undefined;
  readonly selectedPeerDetails?: ReactNode;
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const peerDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function positioned(left: number): CSSProperties {
  return { left: `${left}%` };
}

function peerDate(peer: ComparisonRangePeerObservation): string {
  const start = new Date(`${peer.startDate}T00:00:00Z`);
  const end = new Date(`${peer.endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return `${peer.startDate} – ${peer.endDate}`;
  if (peer.startDate === peer.endDate) return peerDateFormatter.format(start);
  return `${peerDateFormatter.format(start)} – ${peerDateFormatter.format(end)}`;
}

export function ComparisonRange<Peer extends ComparisonRangePeerObservation>(props: ComparisonRangeProps<Peer>) {
  const [previewPeerRef, setPreviewPeerRef] = useState<string | undefined>(undefined);
  const [selectedPeerRef, setSelectedPeerRef] = useState<string | undefined>(undefined);
  const model = buildComparisonRangeModel(props);
  if (model === undefined) return null;
  const hasRange = model.mode === "Q1_Q3" && model.lower !== undefined && model.upper !== undefined && model.lowerPosition !== undefined && model.upperPosition !== undefined;
  const hovered = model.peers.find(({ observation }) => comparisonRangePeerRef(observation) === previewPeerRef);
  const selected = model.peers.find(({ observation }) => comparisonRangePeerRef(observation) === selectedPeerRef);

  return <figure className={styles.comparisonRange} data-comparison-range={model.mode.toLowerCase()}>
    <div className={styles.comparisonRangePlot} role="group" aria-label={model.accessibleLabel}>
      <span className={styles.comparisonRangeTrack} aria-hidden />
      {hasRange ? <span className={styles.comparisonRangeReference} style={{ left: `${model.lowerPosition}%`, width: `${model.upperPosition - model.lowerPosition}%` }} aria-hidden /> : null}
      <span className={styles.comparisonRangeBoundaryLabel} style={positioned(7)}>{moneyFormatter.format(model.minimum)}</span>
      <span className={`${styles.comparisonRangeBoundaryLabel} ${styles.comparisonRangeBoundaryEnd}`} style={positioned(93)}>{moneyFormatter.format(model.maximum)}</span>
      {hasRange ? <><span className={styles.comparisonRangeQuartileLabel} style={positioned(model.lowerPosition)}>Q1 · {moneyFormatter.format(model.lower)}</span><span className={`${styles.comparisonRangeQuartileLabel} ${styles.comparisonRangeQuartileEnd}`} style={positioned(model.upperPosition)}>Q3 · {moneyFormatter.format(model.upper)}</span></> : null}
      <span className={styles.comparisonRangeMedianMarker} style={positioned(model.medianPosition)} aria-hidden />
      {model.peers.map((peer) => <button
        key={comparisonRangePeerRef(peer.observation)}
        type="button"
        className={styles.comparisonRangePeerMarker}
        style={{ ...positioned(peer.position), top: `${50 + peer.lane * 24}%` }}
        data-peer-ref={comparisonRangePeerRef(peer.observation)}
        aria-label={`${peer.observation.canonicalName}, ${peerDate(peer.observation)}, ${moneyFormatter.format(peer.value)}`}
        aria-pressed={selectedPeerRef === comparisonRangePeerRef(peer.observation)}
        onPointerEnter={() => setPreviewPeerRef(comparisonRangePeerRef(peer.observation))}
        onPointerLeave={() => setPreviewPeerRef(undefined)}
        onFocus={() => setPreviewPeerRef(comparisonRangePeerRef(peer.observation))}
        onBlur={() => setPreviewPeerRef(undefined)}
        onClick={() => { setSelectedPeerRef(comparisonRangePeerRef(peer.observation)); props.onSelectPeer?.(peer.observation); }}
      />)}
      <span className={styles.comparisonRangeObservedMarker} style={positioned(model.observedPosition)} aria-hidden />
      <span className={styles.comparisonRangeMedianLabel} style={positioned(model.medianPosition)}>{moneyFormatter.format(model.median)}<small>Médiane</small></span>
      <span className={styles.comparisonRangeObservedLabel} style={positioned(model.observedPosition)}>{moneyFormatter.format(model.observed)}<small>Vous</small></span>
      {hovered === undefined ? null : <span className={styles.comparisonRangeTooltip} style={positioned(hovered.position)} role="tooltip"><strong>{hovered.observation.canonicalName}</strong><span>{peerDate(hovered.observation)}</span><b>{moneyFormatter.format(hovered.value)}</b></span>}
    </div>
    {selected === undefined ? null : <article className={styles.comparisonRangePreview} aria-live="polite">
      <div><strong>{selected.observation.canonicalName}</strong><span>{peerDate(selected.observation)}</span><b>{moneyFormatter.format(selected.value)}</b>{props.selectedPeerDetails}</div>
      {props.onOpenPeer === undefined ? null : <button type="button" data-peer-ref={comparisonRangePeerRef(selected.observation)} onClick={() => props.onOpenPeer?.(selected.observation)}>Voir dans la Timeline <span aria-hidden>→</span></button>}
    </article>}
  </figure>;
}
