"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { GlobalExpandedReadModel, PersonaOwnerDetailRef } from "@/query-api/global-v2";
import { useGlobalV2Resource } from "../use-global-resource";
import type { GlobalV2VisitRuntime } from "../visit-runtime";
import {
  personaDetailMetricLabel,
  personaOwnerDetailRequest,
  presentPersonaOwnerDetail,
} from "./persona-detail-resolver";
import styles from "../global-v2.module.css";

function OwnerDetailContent({ model }: { readonly model: GlobalExpandedReadModel }) {
  const detail = presentPersonaOwnerDetail(model);
  if (model.visibility !== "VISIBLE" || detail.empty) {
    return <p className={styles.personaDrawerEmpty}>Le détail éditorial n’est pas encore disponible pour ce repère.</p>;
  }
  return <div className={styles.personaDrawerContent}>
    {detail.metrics.length === 0 ? null : <section aria-labelledby="persona-detail-metrics">
      <h3 id="persona-detail-metrics">En bref</h3>
      <dl className={styles.personaDrawerMetrics}>{detail.metrics.map((metric) => <div key={metric.metricId}>
        <dt>{personaDetailMetricLabel(metric)}</dt><dd>{metric.displayValue}</dd>
      </div>)}</dl>
    </section>}
    {detail.rows.length === 0 ? null : <section aria-labelledby="persona-detail-context">
      <h3 id="persona-detail-context">Repères</h3>
      <dl className={styles.personaDrawerRows}>{detail.rows.map((row) => <div key={row.rowId}>
        <dt>{row.labelKey}</dt><dd>{row.displayValue}</dd>
      </div>)}</dl>
    </section>}
    {detail.series.map((series) => <section key={series.seriesId} aria-labelledby={`persona-series-${series.seriesId}`}>
      <h3 id={`persona-series-${series.seriesId}`}>{series.labelKey}</h3>
      <ul className={styles.personaDrawerSeries}>{series.points.map((point) => <li key={point.unitKey}><span>{point.unitKey}</span><strong>{point.displayValue}</strong></li>)}</ul>
    </section>)}
  </div>;
}

export function PersonaDetailDrawer({ runtime, detailRef, title, onClose }: {
  readonly runtime: GlobalV2VisitRuntime;
  readonly detailRef: PersonaOwnerDetailRef;
  readonly title: string;
  readonly onClose: () => void;
}) {
  const request = useMemo(() => personaOwnerDetailRequest(detailRef), [detailRef]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "DIRECT");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className={styles.personaDrawerBackdrop} role="presentation" onMouseDown={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <aside className={styles.personaDrawer} role="dialog" aria-modal="true" aria-labelledby="persona-detail-title">
      <header className={styles.personaDrawerHeader}>
        <div><span>Portrait personnel</span><h2 id="persona-detail-title">{title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Fermer le détail" autoFocus><X aria-hidden size={20} /></button>
      </header>
      {result.state.status === "READY" ? <OwnerDetailContent model={result.state.data} /> : null}
      {result.state.status === "LOADING" || result.state.status === "IDLE" ? <p className={styles.personaDrawerLoading} role="status">Le détail se prépare…</p> : null}
      {result.state.status === "ERROR" ? <div className={styles.personaDrawerError} role="alert"><p>Impossible de charger ce détail pour le moment.</p><button type="button" onClick={result.retry}>Réessayer</button></div> : null}
    </aside>
  </div>;
}
