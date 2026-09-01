"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import type {
  ActivityLifeMoneySummary,
  CategoryMonthSummary,
  MonthBalanceSummaryReadModel,
  MonthCategoriesReadModel,
  MonthLifeMoneyReadModel,
  MonthSpendingNatureReadModel,
  MomentLifeMoneySummary,
  PlaceLifeMoneySummary,
} from "@/query-api";
import type { UiTransportState } from "@/ui";
import { publicationMetasAreCoherent } from "./publication-coherence";
import { CollectionState, DisplayState, MetricState, MoneyMetric, StateBoundary, formatMoney } from "./renderers";
import type { HistoryOverlayTarget } from "./types";
import styles from "./history-v2.module.css";

export function BalanceMonthView({
  summary,
  categories,
  spendingNature,
  lifeMoney,
  onOverlay,
  onMinimal,
}: {
  readonly summary: UiTransportState<MonthBalanceSummaryReadModel>;
  readonly categories: UiTransportState<MonthCategoriesReadModel>;
  readonly spendingNature: UiTransportState<MonthSpendingNatureReadModel>;
  readonly lifeMoney: UiTransportState<MonthLifeMoneyReadModel>;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
  readonly onMinimal: () => void;
}) {
  const moduleData = [summary, categories, spendingNature, lifeMoney].flatMap((state) => {
    const data = state.status === "success" ? state.response.data : state.status === "error" ? state.previousData?.data : undefined;
    return data === undefined ? [] : [data];
  });
  const publicationCoherent = publicationMetasAreCoherent(
    moduleData.map((data) => data.publicationMeta),
  );
  if (moduleData.length > 0 && !publicationCoherent) {
    return <div className={styles.errorState} role="alert"><strong>Publication incompatible</strong><p>Les quatre modules du Bilan ne proviennent pas de la même publication History V2. Rechargez la page.</p><button type="button" className="button-secondary" onClick={() => window.location.reload()}>Réessayer</button></div>;
  }
  return (
    <div className={styles.balanceSurface}>
      <section className={styles.balanceModule} aria-labelledby="history-v2-m1"><header><span className="eyebrow">M1</span><h2 id="history-v2-m1">Le mois en un coup d’œil</h2></header><StateBoundary state={summary}>{(model) => <BalanceSummary model={model} onBridge={() => onOverlay({ kind: "bridge" })} onMinimal={onMinimal} />}</StateBoundary></section>
      <section className={styles.balanceModule} aria-labelledby="history-v2-m2"><header><span className="eyebrow">M2</span><h2 id="history-v2-m2">Ce qui explique le mois</h2></header><StateBoundary state={categories}>{(model) => <CategoryAnalysis model={model} onCategory={(categoryId) => onOverlay({ kind: "category", categoryId })} />}</StateBoundary></section>
      <section className={styles.balanceModule} aria-labelledby="history-v2-m3"><header><span className="eyebrow">M3</span><h2 id="history-v2-m3">Nature des dépenses et marges</h2></header><StateBoundary state={spendingNature}>{(model) => <SpendingNature model={model} onSegment={(params) => onOverlay({ kind: "segment", params })} />}</StateBoundary></section>
      <section className={styles.balanceModule} aria-labelledby="history-v2-m4"><header><span className="eyebrow">M4</span><h2 id="history-v2-m4">Vie et argent</h2></header><StateBoundary state={lifeMoney}>{(model) => <LifeMoney model={model} onOverlay={onOverlay} />}</StateBoundary></section>
    </div>
  );
}

function BalanceSummary({ model, onBridge, onMinimal }: { readonly model: MonthBalanceSummaryReadModel; readonly onBridge: () => void; readonly onMinimal: () => void }) {
  return (
    <div className={styles.summaryGrid}>
      <DisplayState node={model.actualValue}>{(metric) => <div className={styles.actualCard}><span>Dépenses économiques</span><MoneyMetric metric={metric} className={styles.actualValue} /></div>}</DisplayState>
      <div className={styles.referenceCards}>
        <DisplayState node={model.typicalValue}>{(metric) => <ReferenceMetric label="Typical" metric={metric} />}</DisplayState>
        <DisplayState node={model.minimalValue}>{(metric) => <button type="button" className={styles.referenceButton} onClick={onMinimal}><ReferenceMetric label="Minimal" metric={metric} /><span>Voir la composition</span></button>}</DisplayState>
      </div>
      <div className={styles.comparisonRow}>
        <DisplayState node={model.actualVsTypical}>{(metric) => <MetricState metric={metric} format={(value) => <><strong>{formatMoney(value.delta)}</strong><span>{value.delta.startsWith("-") ? " sous" : " au-dessus de"} l’habitude</span></>} />}</DisplayState>
        <DisplayState node={model.actualVsMinimal}>{(metric) => <MetricState metric={metric} format={(value) => <><strong>{formatMoney(value.delta)}</strong><span>{value.delta.startsWith("-") ? " sous" : " au-dessus du"} Minimal</span></>} />}</DisplayState>
        <DisplayState node={model.usualZone}>{(metric) => <MetricState metric={metric} format={(value) => `${formatMoney(value.lowerBound)} – ${formatMoney(value.upperBound)}`} />}</DisplayState>
        <DisplayState node={model.historicalRank}>{(metric) => <MetricState metric={metric} format={(value) => value.presentation === "RANKED" ? `${value.rank}e sur ${value.universeCount}` : "Position neutre"} />}</DisplayState>
      </div>
      <button type="button" className="button-secondary" onClick={onBridge}>Comprendre Banque → Économie <ArrowRight aria-hidden size={16} /></button>
      <ImportedSummary model={model} />
    </div>
  );
}

function ReferenceMetric({ label, metric }: { readonly label: string; readonly metric: import("@/core/history-v2").MetricValue<import("@/core/money").Money> }) {
  return <div><span>{label}</span><MoneyMetric metric={metric} /></div>;
}

function ImportedSummary({ model }: { readonly model: MonthBalanceSummaryReadModel }) {
  if (model.importedSummary.freshness === "MISSING") return <div className={styles.placeholder}>Aucun résumé IA importé pour ce mois</div>;
  return <div className={styles.importedSummary}><div><strong>Résumé importé</strong>{model.importedSummary.freshness === "STALE" ? <span className="badge" data-tone="warning">À actualiser</span> : null}</div><p>{model.importedSummary.text}</p></div>;
}

function CategoryAnalysis({ model, onCategory }: { readonly model: MonthCategoriesReadModel; readonly onCategory: (id: string) => void }) {
  const [mode, setMode] = useState<"amount" | "delta">("amount");
  return (
    <div>
      <div className={styles.localTabs} role="tablist" aria-label="Présentation des catégories"><button role="tab" aria-selected={mode === "amount"} onKeyDown={(event) => { if (event.key === "ArrowRight") setMode("delta"); }} onClick={() => setMode("amount")}>Montant & part</button><button role="tab" aria-selected={mode === "delta"} onKeyDown={(event) => { if (event.key === "ArrowLeft") setMode("amount"); }} onClick={() => setMode("delta")}>Écart à l’habitude</button></div>
      <DisplayState node={model.categories}>{(collection) => <CollectionState collection={collection}>{(items) => <div className={styles.categoryList}>{items.map((category) => <CategoryRow key={category.categoryId} category={category} mode={mode} onClick={() => onCategory(category.categoryId)} />)}</div>}</CollectionState>}</DisplayState>
      <div className={styles.reconciliationRow}><span>Autres catégories</span><DisplayState node={model.otherAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div>
      <div className={styles.reconciliationRow}><span>Non classé</span><DisplayState node={model.unclassifiedAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div>
    </div>
  );
}

function CategoryRow({ category, mode, onClick }: { readonly category: CategoryMonthSummary; readonly mode: "amount" | "delta"; readonly onClick: () => void }) {
  return <button type="button" className={styles.categoryRow} onClick={onClick}><span><strong>{category.label}</strong>{category.material ? <small>Significatif</small> : null}</span>{mode === "amount" ? <><MoneyMetric metric={category.actual} /><MetricState metric={category.shareOfActual} format={(value) => `${Math.round(value * 100)} %`} /></> : <MoneyMetric metric={category.delta} />}<ArrowRight aria-hidden size={16} /></button>;
}

function spendingSegmentKey(segment: import("@/query-api").HistorySpendingSegmentDetailParams): string {
  return "axis" in segment
    ? `${segment.axis}:${segment.bucket}`
    : `matrix:${segment.necessity}:${segment.behavior}`;
}

function SpendingNature({ model, onSegment }: { readonly model: MonthSpendingNatureReadModel; readonly onSegment: (params: import("@/query-api").HistorySpendingSegmentDetailParams) => void }) {
  const axes = [["Nécessité", "necessity", model.necessity], ["Comportement", "behavior", model.behavior], ["Périmètre de vie", "lifeScope", model.lifeScope]] as const;
  const projections = "segments" in model
    && model.segments.visibility === "VISIBLE"
    && (model.segments.data.status === "KNOWN" || model.segments.data.status === "PARTIAL")
    ? new Map(model.segments.data.items.map((projection) => [spendingSegmentKey(projection.segment as import("@/query-api").HistorySpendingSegmentDetailParams), projection]))
    : new Map();
  return (
    <div className={styles.spendingNature}>
      <div className={styles.axisCards}>{axes.map(([label, axis, node]) => <DisplayState key={axis} node={node}>{(data) => <article className={styles.axisCard}><h3>{label}</h3><MetricState metric={data.result} format={(buckets) => <div>{buckets.map((bucket) => { const segment = { axis, bucket: bucket.key } as const; const projection = projections.get(spendingSegmentKey(segment)); return <div key={bucket.key} className={styles.spendingBucket}><button type="button" onClick={() => onSegment(segment)}><span>{bucket.key}</span><span><strong>{formatMoney(bucket.amount)}</strong><small>{bucket.shareOfActual === undefined ? "Part indisponible" : `${Math.round(bucket.shareOfActual * 100)} % d’Actual`}</small></span></button><SpendingContributors projection={projection} /></div>; })}</div>} /><p>{formatMoney(data.unclassifiedAmount)} non classés</p></article>}</DisplayState>)}</div>
      <DisplayState node={model.matrix}>{(matrix) => <article className={styles.marginMatrix}><h3>Nécessité × comportement</h3><div>{matrix.cells.map((cell) => { const [necessity, behavior] = cell.key.split("__"); const segment = { necessity: necessity as "INDISPENSABLE" | "CONSTRAINED" | "OPTIONAL", behavior: behavior as "FIXED" | "VARIABLE" }; const projection = projections.get(spendingSegmentKey(segment)); return <div key={cell.key} className={styles.spendingBucket}><button type="button" onClick={() => onSegment(segment)}><span>{cell.key}</span><span><strong>{formatMoney(cell.amount)}</strong><small>{cell.shareOfActual === undefined ? "Part indisponible" : `${Math.round(cell.shareOfActual * 100)} % d’Actual`}</small></span></button><SpendingContributors projection={projection} /></div>; })}</div><div className={styles.marginValues}><span>Marge immédiate <MoneyMetric metric={matrix.immediateMargin} /></span><span>Marge à moyen terme <MoneyMetric metric={matrix.mediumMargin} /></span></div></article>}</DisplayState>
    </div>
  );
}

function SpendingContributors({ projection }: { readonly projection?: import("@/query-api").SpendingNatureBucketProjection }) {
  if (projection === undefined) return null;
  return <DisplayState node={projection.contributors}>{(collection) => <CollectionState collection={collection}>{(items) => <div className={styles.contributorList}>{items.map((contributor) => <span key={`${contributor.grain}-${contributor.contributorId}`}>{contributor.label} · {formatMoney(contributor.amount)}</span>)}<DisplayState node={projection.otherAmount}>{(metric) => metric.status === "KNOWN" && Number(metric.value) !== 0 ? <span>Autres · {formatMoney(metric.value)}</span> : null}</DisplayState></div>}</CollectionState>}</DisplayState>;
}

function LifeMoney({ model, onOverlay }: { readonly model: MonthLifeMoneyReadModel; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
  return (
    <div className={styles.lifeMoney}>
      <DisplayState node={model.activities}>{(collection) => <CollectionState collection={collection}>{(items) => <section><h3>Activités</h3><div className={styles.activityGrid}>{items.map((activity) => <ActivityCard key={activity.activityTypeKey} item={activity} onClick={() => onOverlay({ kind: "activity", activityTypeKey: activity.activityTypeKey })} />)}</div></section>}</CollectionState>}</DisplayState>
      <DisplayState node={model.moments}>{(collection) => <CollectionState collection={collection}>{(items) => <MomentSection items={items} onOpen={(momentId) => onOverlay({ kind: "moment", momentId })} />}</CollectionState>}</DisplayState>
      <DisplayState node={model.places}>{(collection) => <CollectionState collection={collection}>{(items) => <PlaceSection items={items} onOpen={(placeId) => onOverlay({ kind: "place", placeId })} />}</CollectionState>}</DisplayState>
    </div>
  );
}

function ActivityCard({ item, onClick }: { readonly item: ActivityLifeMoneySummary; readonly onClick: () => void }) {
  return <button type="button" className={styles.activityCard} onClick={onClick}><span className="eyebrow">{item.occurrences} occurrence(s) · intérêt {item.score}</span><strong>{item.label}</strong><span>{item.costKind === "CAUSAL" ? "Coût causal" : item.costKind === "ASSOCIATED" ? "Coût associé" : "Aucun coût qualifié"}</span>{item.costKind === "NONE" ? null : <MoneyMetric metric={item.cost} />}</button>;
}

function MomentSection({ items, onOpen }: { readonly items: readonly MomentLifeMoneySummary[]; readonly onOpen: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  if (items.length === 0) return null;
  const visible = items.length < 4 ? items : items.slice(offset, offset + 3).concat(offset + 3 > items.length ? items.slice(0, offset + 3 - items.length) : []);
  return <section><div className={styles.railHeader}><h3>Moments</h3>{items.length >= 4 ? <div><button className={styles.iconButton} aria-label="Moments précédents" onClick={() => setOffset((value) => (value - 1 + items.length) % items.length)}><ChevronLeft aria-hidden size={18} /></button><button className={styles.iconButton} aria-label="Moments suivants" onClick={() => setOffset((value) => (value + 1) % items.length)}><ChevronRight aria-hidden size={18} /></button></div> : null}</div><div className={items.length === 1 ? styles.singleMoment : styles.momentRow}>{visible.map((moment) => <button type="button" className={styles.momentCard} key={moment.momentId} onClick={() => onOpen(moment.momentId)}><div className={styles.momentMedia} {...(moment.imageRef === undefined ? {} : { role: "img", "aria-label": `Média canonique de ${moment.title}`, style: { backgroundImage: `url(${JSON.stringify(moment.imageRef)})` } })}>{moment.imageRef === undefined ? <ImageIcon aria-hidden size={30} /> : null}</div><strong>{moment.title}</strong><span>{moment.startDate}{moment.endDate ? ` → ${moment.endDate}` : ""}{moment.highlightRank ? ` · rang ${moment.highlightRank}` : ""}</span><MoneyMetric metric={moment.causalCost} /></button>)}</div></section>;
}

function PlaceSection({ items, onOpen }: { readonly items: readonly PlaceLifeMoneySummary[]; readonly onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, 6);
  return <section><h3>Lieux</h3><div className={items.length <= 3 ? styles.placeRow : styles.placeRail}>{shown.map((place) => <button type="button" className={styles.placeCard} key={place.placeId} onClick={() => onOpen(place.placeId)}><strong>{place.label}</strong><span>{place.presenceDays} jour(s) · {place.momentCount} moment(s) · intérêt {place.score}</span><MoneyMetric metric={place.localizedAmount} /></button>)}</div>{items.length > 6 && !expanded ? <button type="button" className="button-secondary" onClick={() => setExpanded(true)}>Voir tous les lieux</button> : null}</section>;
}
