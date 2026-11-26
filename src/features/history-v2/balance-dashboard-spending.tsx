"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SpendingBucket } from "@/analytics/history-v2/month-balance";
import { useQueryRuntime } from "@/components/runtime/query-client";
import type { Money } from "@/core/money";
import type { YearMonth } from "@/core/time";
import {
  queryResourceKeys,
  type HistorySpendingSegmentDetailParams,
  type MonthSpendingNatureReadModel,
  type SpendingContributor,
  type SpendingNatureBucketProjection,
  type SpendingSegment,
} from "@/query-api";
import { AmountBar, chartMaximum, metricValue, moneyAmount, visibleValue } from "./balance-dashboard-widgets";
import { spendingPresentationLabel } from "./presentation";
import { DisplayState, StateBoundary, formatMoney } from "./renderers";
import styles from "./balance-dashboard.module.css";

const axes = [
  { id: "necessity", label: "Nécessité des dépenses" },
  { id: "behavior", label: "Fixes et variables" },
  { id: "lifeScope", label: "Quotidien et hors quotidien" },
] as const;

function segmentKey(segment: SpendingSegment) {
  return segment.axis === undefined
    ? `${segment.necessity}__${segment.behavior}`
    : `${segment.axis}:${segment.bucket}`;
}

function matrixSegment(key: string): HistorySpendingSegmentDetailParams | undefined {
  const [necessity, behavior] = key.split("__");
  if (
    (necessity === "INDISPENSABLE" || necessity === "CONSTRAINED" || necessity === "OPTIONAL")
    && (behavior === "FIXED" || behavior === "VARIABLE")
  ) return { necessity, behavior };
}

function itemsOf(projection: SpendingNatureBucketProjection) {
  const collection = visibleValue(projection.contributors);
  return collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : undefined;
}

export function SpendingBreakdown({ model, month }: {
  readonly model: MonthSpendingNatureReadModel;
  readonly month: YearMonth;
}) {
  const [openKey, setOpenKey] = useState<string>();
  const collection = "segments" in model ? visibleValue(model.segments) : undefined;
  const projections = new Map(collection?.status === "KNOWN" || collection?.status === "PARTIAL"
    ? collection.items.map(projection => [segmentKey(projection.segment), projection])
    : []);
  const matrix = visibleValue(model.matrix);

  function renderBucket(bucket: SpendingBucket, params: HistorySpendingSegmentDetailParams, maximum: number, showPreview = true) {
    const key = segmentKey(params);
    return <BreakdownBucket key={key} bucket={bucket} maximum={maximum} projection={projections.get(key)}
      params={params} month={month} showPreview={showPreview} open={openKey === key}
      onToggle={() => setOpenKey(current => current === key ? undefined : key)} />;
  }

  return <div className={styles.spendingGrid} data-spending-expanded={openKey !== undefined}>
    {axes.map(({ id, label }) => <section key={id} className={styles.spendingAxis} aria-label={label}>
      <h3>{label}</h3>
      <DisplayState node={model[id]}>{axis => {
        const buckets = metricValue(axis.result);
        if (!buckets?.length) return <p className={styles.note}>Données indisponibles.</p>;
        const maximum = chartMaximum(buckets.map(bucket => ({
          id: bucket.key, label: bucket.key, amount: moneyAmount(bucket.amount),
        })));
        return <>
          {buckets.map(bucket => renderBucket(bucket, { axis: id, bucket: bucket.key }, maximum))}
          {Number(axis.unclassifiedAmount) !== 0 && <p className={styles.note}>{formatMoney(axis.unclassifiedAmount)} non classés</p>}
        </>;
      }}</DisplayState>
    </section>)}
    {matrix?.cells.length ? <section className={`${styles.spendingAxis} ${styles.spendingMatrix}`} aria-label="Nécessité et type de dépense">
      <h3>Nécessité et type de dépense</h3>
      {matrix.cells.map(bucket => {
        const params = matrixSegment(bucket.key);
        return params ? renderBucket(bucket, params, Math.max(1, Math.abs(Number(matrix.classifiedAmount))), false) : null;
      })}
    </section> : null}
  </div>;
}

function BreakdownBucket({ bucket, maximum, projection, params, month, showPreview, open, onToggle }: {
  readonly bucket: SpendingBucket;
  readonly maximum: number;
  readonly projection?: SpendingNatureBucketProjection;
  readonly params: HistorySpendingSegmentDetailParams;
  readonly month: YearMonth;
  readonly showPreview: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const id = useId();
  const label = spendingPresentationLabel(bucket.key);
  const items = projection ? itemsOf(projection) : undefined;
  const other = metricValue(visibleValue(projection?.otherAmount));
  const preview = showPreview ? items?.slice(0, 2) ?? [] : [];
  const remaining = items?.slice(preview.length) ?? [];
  const hasMore = items === undefined || remaining.length > 0 || (other !== undefined && Number(other) !== 0);
  return <div className={styles.spendingBucket} data-expanded={open}>
    <AmountBar row={{ id, label, amount: moneyAmount(bucket.amount), share: bucket.shareOfActual }} maximum={maximum} />
    {preview.length > 0 && <ContributorRows items={preview} />}
    {hasMore && <button type="button" className={styles.spendingToggle} aria-expanded={open} aria-controls={id}
      aria-label={`${open ? "Replier" : "Développer"} · ${label}`} onClick={onToggle}>
      <ChevronDown size={13} aria-hidden />{open ? "Replier" : showPreview ? "Voir le reste" : "Voir les postes"}
    </button>}
    <div className={styles.spendingFold} id={id} data-open={open} inert={!open} aria-hidden={!open}>
      <div>
        {items !== undefined
          ? <ContributorRows items={remaining} other={other} />
          : open && <DeferredContributors month={month} params={params} />}
      </div>
    </div>
  </div>;
}

function ContributorRows({ items, other }: { readonly items: readonly SpendingContributor[]; readonly other?: Money }) {
  return <ul className={styles.spendingContributors}>
    {items.map(item => <li key={`${item.grain}:${item.contributorId}`}>
      <span title={item.label}>{item.label}</span><strong>{formatMoney(item.amount)}</strong>
    </li>)}
    {other !== undefined && Number(other) !== 0 && <li><span>Autres dépenses</span><strong>{formatMoney(other)}</strong></li>}
  </ul>;
}

function DeferredContributors({ month, params }: {
  readonly month: YearMonth;
  readonly params: HistorySpendingSegmentDetailParams;
}) {
  const state = useQueryRuntime({
    resource: queryResourceKeys.historySpendingSegmentDetail,
    scope: { subject: { kind: "household" }, time: { kind: "month", month } },
    params,
  });
  return <StateBoundary state={state}>{model => {
    const collection = visibleValue(model.contributors);
    const items = collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : [];
    const other = metricValue(visibleValue(model.otherAmount));
    return items.length || (other !== undefined && Number(other) !== 0)
      ? <ContributorRows items={items} other={other} />
      : <p className={styles.note}>Aucun poste détaillé.</p>;
  }}</StateBoundary>;
}
