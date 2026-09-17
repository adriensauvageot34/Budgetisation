import { useState, type CSSProperties } from "react";
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
  const preview = model.peers.find(({ observation }) => comparisonRangePeerRef(observation) === (selectedPeerRef ?? previewPeerRef));

  return <figure className={styles.comparisonRange} data-comparison-range={model.mode.toLowerCase()}>
    <div className={styles.comparisonRangePlot} role="group" aria-label={model.accessibleLabel}>
      <span className={styles.comparisonRangeTrack} aria-hidden />
      {hasRange ? <span className={styles.comparisonRangeReference} style={{ left: `${model.lowerPosition}%`, width: `${model.upperPosition - model.lowerPosition}%` }} aria-hidden /> : null}
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
        onFocus={() => setPreviewPeerRef(comparisonRangePeerRef(peer.observation))}
        onClick={() => setSelectedPeerRef(comparisonRangePeerRef(peer.observation))}
      />)}
      <span className={styles.comparisonRangeObservedMarker} style={positioned(model.observedPosition)} aria-hidden />
    </div>
    <figcaption className={styles.comparisonRangeLegend}>
      {hasRange ? <span className={styles.comparisonRangeReferenceCopy}>Plage de référence : {moneyFormatter.format(model.lower)} – {moneyFormatter.format(model.upper)}</span> : null}
      <span><i className={styles.comparisonRangeMedianKey} />Médiane · {moneyFormatter.format(model.median)}</span>
      <span><i className={styles.comparisonRangeObservedKey} />{props.subjectLabel ?? "Cet événement"} · {moneyFormatter.format(model.observed)}</span>
    </figcaption>
    {model.peers.length === 0 ? null : preview === undefined ? <p className={styles.comparisonRangeHint}>Sélectionnez un point pour identifier le moment comparable.</p> : <article className={styles.comparisonRangePreview} aria-live="polite">
      <div><strong>{preview.observation.canonicalName}</strong><span>{peerDate(preview.observation)}</span><b>{moneyFormatter.format(preview.value)}</b></div>
      {props.onOpenPeer === undefined ? null : <button type="button" data-peer-ref={comparisonRangePeerRef(preview.observation)} onClick={() => props.onOpenPeer?.(preview.observation)}>{"sourceKind" in preview.observation && preview.observation.sourceKind === "LIFE_EVENT" ? "Afficher cet événement" : "Ouvrir ce moment"} <span aria-hidden>→</span></button>}
    </article>}
  </figure>;
}
