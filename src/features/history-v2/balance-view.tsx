"use client";

import { Activity, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, ChartNoAxesColumn, ChevronLeft, ChevronRight, LayoutGrid, SlidersHorizontal, Sparkles } from "lucide-react";
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
import material from "@/app/mois-a-venir/month-material.module.css";
import { publicationMetasAreCoherent } from "./publication-coherence";
import {
  formatCount,
  formatFrenchDateRange,
  formatHistoricalRank,
  spendingPresentationLabel,
} from "./presentation";
import { CollectionState, DisplayState, MetricState, MoneyMetric, PartialDataNote, StateBoundary, formatMoney } from "./renderers";
import { HistorySemanticIcon } from "./semantic-icon";
import type { HistoryOverlayTarget } from "./types";
import styles from "./history-v2.module.css";

const balanceSections = [
  { id: "overview", tab: "Vue d’ensemble", title: "Le mois en un coup d’œil", icon: LayoutGrid },
  { id: "categories", tab: "Catégories", title: "Ce qui explique le mois", icon: ChartNoAxesColumn },
  { id: "margins", tab: "Marges", title: "Nature des dépenses et marges", icon: SlidersHorizontal },
  { id: "life", tab: "Vie et argent", title: "Vie et argent", icon: Sparkles },
] as const;
export function BalanceMonthView({
  summary,
  categories,
  spendingNature,
  lifeMoney,
  onOverlay,
  onMinimal,
  glass = false,
}: {
  readonly summary: UiTransportState<MonthBalanceSummaryReadModel>;
  readonly categories: UiTransportState<MonthCategoriesReadModel>;
  readonly spendingNature: UiTransportState<MonthSpendingNatureReadModel>;
  readonly lifeMoney: UiTransportState<MonthLifeMoneyReadModel>;
  readonly onOverlay: (target: HistoryOverlayTarget) => void;
  readonly onMinimal: () => void;
  readonly glass?: boolean;
}) {
  const id = useId();
  const [activeTab, setActiveTab] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = balanceSections.length;
    let next: number;
    switch (event.key) {
      case "ArrowLeft": next = (index - 1 + count) % count; break;
      case "ArrowRight": next = (index + 1) % count; break;
      case "Home": next = 0; break;
      case "End": next = count - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveTab(next);
    buttons.current[next]?.focus();
  }

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
  const panels = [
    <StateBoundary state={summary}>{(model) => <BalanceSummary model={model} onBridge={() => onOverlay({ kind: "bridge" })} onMinimal={onMinimal} />}</StateBoundary>,
    <StateBoundary state={categories}>{(model) => <CategoryAnalysis model={model} onCategory={(categoryId) => onOverlay({ kind: "category", categoryId })} />}</StateBoundary>,
    <StateBoundary state={spendingNature}>{(model) => <SpendingNature workspace={glass} model={model} onSegment={(params) => onOverlay({ kind: "segment", params })} />}</StateBoundary>,
    <StateBoundary state={lifeMoney}>{(model) => <LifeMoney workspace={glass} model={model} onOverlay={onOverlay} />}</StateBoundary>,
  ];
  return (
    <div className={glass ? styles.glassBalance : styles.balanceSurface}>
      {glass && <div className={styles.balanceTabs} role="tablist" aria-label="Sections du bilan">
        {balanceSections.map(({ id: sectionId, tab, icon: Icon }, index) => (
          <button key={sectionId} type="button" role="tab" id={`${id}-tab-${sectionId}`}
            ref={(element) => { buttons.current[index] = element; }}
            aria-controls={`${id}-panel-${sectionId}`} aria-selected={index === activeTab}
            tabIndex={index === activeTab ? 0 : -1}
            onKeyDown={(event) => handleTabKey(event, index)} onClick={() => setActiveTab(index)}>
            <Icon aria-hidden size={16} />{tab}
          </button>
        ))}
      </div>}
      {balanceSections.map(({ id: sectionId, title }, index) => {
        const headingId = `${id}-heading-${sectionId}`;
        if (!glass) return <section key={sectionId} className={styles.balanceModule} aria-labelledby={headingId}>
          <header><h2 id={headingId}>{title}</h2></header>
          {panels[index]}
        </section>;

        return <Activity key={sectionId} mode={index === activeTab ? "visible" : "hidden"}>
          <section className={`${styles.glassModule} ${material.glassPremium}`} role="tabpanel"
            id={`${id}-panel-${sectionId}`} aria-labelledby={`${id}-tab-${sectionId}`}>
            <header><h2 id={headingId}>{title}</h2></header>
            <div className={styles.balanceContent} role="region" aria-labelledby={headingId} tabIndex={0}>
              {panels[index]}
            </div>
          </section>
        </Activity>;
      })}
    </div>
  );
}

function BalanceSummary({ model, onBridge, onMinimal }: { readonly model: MonthBalanceSummaryReadModel; readonly onBridge: () => void; readonly onMinimal: () => void }) {
  return (
    <div className={styles.summaryGrid}>
      <DisplayState node={model.actualValue}>{(metric) => <div className={styles.actualCard}><span>Dépenses du mois</span><MoneyMetric metric={metric} className={styles.actualValue} /></div>}</DisplayState>
      <div className={styles.referenceCards}>
        <DisplayState node={model.typicalValue}>{(metric) => <ReferenceMetric label="Habituel" metric={metric} />}</DisplayState>
        <DisplayState node={model.minimalValue}>{(metric) => <button type="button" className={styles.referenceButton} onClick={onMinimal}><ReferenceMetric label="Minimum estimé" metric={metric} /><span>Voir la composition</span></button>}</DisplayState>
      </div>
      <div className={styles.comparisonRow}>
        <DisplayState node={model.actualVsTypical}>{(metric) => <MetricState metric={metric} format={(value) => <><strong>{formatMoney(value.delta)}</strong><span>{value.delta.startsWith("-") ? " sous" : " au-dessus de"} l’habitude</span></>} />}</DisplayState>
        <DisplayState node={model.actualVsMinimal}>{(metric) => <MetricState metric={metric} format={(value) => <><strong>{formatMoney(value.delta)}</strong><span>{value.delta.startsWith("-") ? " sous" : " au-dessus du"} minimum estimé</span></>} />}</DisplayState>
        <DisplayState node={model.usualZone}>{(metric) => <div className={styles.comparisonMetric}><span>Zone habituelle</span><MetricState metric={metric} format={(value) => <strong>{formatMoney(value.lowerBound)} – {formatMoney(value.upperBound)}</strong>} /></div>}</DisplayState>
        <DisplayState node={model.historicalRank}>{(metric) => <MetricState metric={metric} format={(value) => value.presentation === "RANKED" ? formatHistoricalRank(value.rank, value.universeCount) : "Position neutre"} />}</DisplayState>
      </div>
      <button type="button" className="button-secondary" onClick={onBridge}>Comprendre l’écart avec mon compte <ArrowRight aria-hidden size={16} /></button>
      <ImportedSummary model={model} />
    </div>
  );
}

function ReferenceMetric({ label, metric }: { readonly label: string; readonly metric: import("@/core/history-v2").MetricValue<import("@/core/money").Money> }) {
  return <div><span>{label}</span><MoneyMetric metric={metric} /></div>;
}

function ImportedSummary({ model }: { readonly model: MonthBalanceSummaryReadModel }) {
  if (model.importedSummary.freshness === "MISSING") return null;
  return <div className={styles.importedSummary}><div><strong>Résumé importé</strong>{model.importedSummary.freshness === "STALE" ? <span className="badge" data-tone="warning">À actualiser</span> : null}</div><p>{model.importedSummary.text}</p></div>;
}

function CategoryAnalysis({ model, onCategory }: { readonly model: MonthCategoriesReadModel; readonly onCategory: (id: string) => void }) {
  const [mode, setMode] = useState<"amount" | "delta">("amount");
  return (
    <div>
      <div className={styles.localTabs} role="tablist" aria-label="Présentation des catégories"><button role="tab" aria-selected={mode === "amount"} onKeyDown={(event) => { if (event.key === "ArrowRight") setMode("delta"); }} onClick={() => setMode("amount")}>Montant & part</button><button role="tab" aria-selected={mode === "delta"} onKeyDown={(event) => { if (event.key === "ArrowLeft") setMode("amount"); }} onClick={() => setMode("delta")}>Écart à l’habitude</button></div>
      <DisplayState node={model.categories}>{(collection) => <CollectionState collection={collection}>{(items) => <div className={styles.categoryList}>{items.map((category) => <CategoryRow key={category.categoryId} category={category} mode={mode} onClick={() => onCategory(category.categoryId)} />)}</div>}</CollectionState>}</DisplayState>
      {shouldShowMoneyNode(model.otherAmount) ? <div className={styles.reconciliationRow}><span>Autres catégories</span><DisplayState node={model.otherAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div> : null}
      {shouldShowMoneyNode(model.unclassifiedAmount) ? <div className={styles.reconciliationRow}><span>Non classé</span><DisplayState node={model.unclassifiedAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div> : null}
    </div>
  );
}

function CategoryRow({ category, mode, onClick }: { readonly category: CategoryMonthSummary; readonly mode: "amount" | "delta"; readonly onClick: () => void }) {
  return <button type="button" className={styles.categoryRow} onClick={onClick}><span><strong>{category.label}</strong></span>{mode === "amount" ? <><MoneyMetric metric={category.actual} /><MetricState metric={category.shareOfActual} format={(value) => `${Math.round(value * 100)} %`} /></> : <MoneyMetric metric={category.delta} />}<ArrowRight aria-hidden size={16} /></button>;
}

function shouldShowMoneyNode(node: MonthCategoriesReadModel["unclassifiedAmount"]): boolean {
  return node.visibility !== "VISIBLE" || node.data.status !== "KNOWN" || Number(node.data.value) !== 0;
}

function spendingSegmentKey(segment: import("@/query-api").HistorySpendingSegmentDetailParams): string {
  return "axis" in segment
    ? `${segment.axis}:${segment.bucket}`
    : `matrix:${segment.necessity}:${segment.behavior}`;
}

function SpendingNature({ model, onSegment, workspace }: { readonly model: MonthSpendingNatureReadModel; readonly workspace: boolean; readonly onSegment: (params: import("@/query-api").HistorySpendingSegmentDetailParams) => void }) {
  const [matrixOpen, setMatrixOpen] = useState(false);
  const axes = [["Nécessité", "necessity", model.necessity], ["Comportement", "behavior", model.behavior], ["Périmètre de vie", "lifeScope", model.lifeScope]] as const;
  const projections = "segments" in model
    && model.segments.visibility === "VISIBLE"
    && (model.segments.data.status === "KNOWN" || model.segments.data.status === "PARTIAL")
    ? new Map(model.segments.data.items.map((projection) => [spendingSegmentKey(projection.segment as import("@/query-api").HistorySpendingSegmentDetailParams), projection]))
    : new Map();
  const breakdown = <div className={styles.axisCards}>
    {axes.map(([label, axis, node]) => <DisplayState key={axis} node={node}>{(data) => <article className={styles.axisCard}>
      <h3>{label}</h3>
      <MetricState metric={data.result} format={(buckets) => <div>{buckets.map((bucket) => {
        const segment = { axis, bucket: bucket.key } as const;
        const projection = projections.get(spendingSegmentKey(segment));
        return <div key={bucket.key} className={styles.spendingBucket}>
          <button type="button" onClick={() => onSegment(segment)}>
            <span>{spendingPresentationLabel(bucket.key)}</span>
            <span><strong>{formatMoney(bucket.amount)}</strong><small>{bucket.shareOfActual === undefined ? "Part indisponible" : `${Math.round(bucket.shareOfActual * 100)} % du mois`}</small></span>
          </button>
          <SpendingContributors projection={projection} />
        </div>;
      })}</div>} />
      {Number(data.unclassifiedAmount) === 0 ? null : <p>{formatMoney(data.unclassifiedAmount)} non classés</p>}
    </article>}</DisplayState>)}
  </div>;

  return (
    <div className={styles.spendingNature}>
      {!workspace && breakdown}
      <DisplayState node={model.matrix}>{(matrix) => <article className={styles.marginMatrix}>
        <div className={styles.marginValues}>
          <MarginMetric label="Marge ajustable maintenant" metric={matrix.immediateMargin} />
          <MarginMetric label="Marge ajustable à moyen terme" metric={matrix.mediumMargin} />
        </div>
        <button type="button" className={styles.matrixToggle} aria-expanded={matrixOpen} onClick={() => setMatrixOpen((open) => !open)}>
          {matrixOpen ? (workspace ? "Revenir à la répartition" : "Masquer le détail des combinaisons") : "Voir le détail des combinaisons"}
        </button>
        {matrixOpen && <div className={styles.matrixGrid} aria-label="Détail nécessité et comportement">
          {matrix.cells.map((cell) => {
            const [necessity, behavior] = cell.key.split("__");
            const segment = { necessity: necessity as "INDISPENSABLE" | "CONSTRAINED" | "OPTIONAL", behavior: behavior as "FIXED" | "VARIABLE" };
            const projection = projections.get(spendingSegmentKey(segment));
            return <div key={cell.key} className={styles.spendingBucket}>
              <button type="button" onClick={() => onSegment(segment)}>
                <span>{spendingPresentationLabel(cell.key)}</span>
                <span><strong>{formatMoney(cell.amount)}</strong><small>{cell.shareOfActual === undefined ? "Part indisponible" : `${Math.round(cell.shareOfActual * 100)} % du mois`}</small></span>
              </button>
              <SpendingContributors projection={projection} />
            </div>;
          })}
        </div>}
      </article>}</DisplayState>
      {workspace && !matrixOpen && breakdown}
    </div>
  );
}

function SpendingContributors({ projection }: { readonly projection?: import("@/query-api").SpendingNatureBucketProjection }) {
  if (projection === undefined) return null;
  return <DisplayState node={projection.contributors}>{(collection) => <CollectionState collection={collection}>{(items) => <div className={styles.contributorList}>{items.map((contributor) => <div key={`${contributor.grain}-${contributor.contributorId}`}><span>{contributor.label}</span><strong>{formatMoney(contributor.amount)}</strong></div>)}<DisplayState node={projection.otherAmount}>{(metric) => metric.status === "KNOWN" && Number(metric.value) !== 0 ? <div><span>Autres</span><strong>{formatMoney(metric.value)}</strong></div> : null}</DisplayState></div>}</CollectionState>}</DisplayState>;
}

function MarginMetric({ label, metric }: { readonly label: string; readonly metric: import("@/core/history-v2").MetricValue<import("@/core/money").Money> }) {
  return <div className={styles.marginMetric}><span>{label}</span><MetricState metric={metric} partialDisplay="value-only" format={(value) => <strong>Au moins {formatMoney(value)}</strong>} /><PartialDataNote metric={metric} /></div>;
}

function LifeMoney({ model, onOverlay, workspace }: { readonly model: MonthLifeMoneyReadModel; readonly workspace: boolean; readonly onOverlay: (target: HistoryOverlayTarget) => void }) {
  return (
    <div className={styles.lifeMoney}>
      <DisplayState node={model.activities}>{(collection) => <CollectionState collection={collection}>{(items) => <section><h3>Activités</h3><div className={workspace ? styles.lifeRail : styles.activityGrid}>{items.map((activity) => <ActivityCard key={activity.activityTypeKey} item={activity} onClick={() => onOverlay({ kind: "activity", activityTypeKey: activity.activityTypeKey })} />)}</div></section>}</CollectionState>}</DisplayState>
      <DisplayState node={model.moments}>{(collection) => <CollectionState collection={collection}>{(items) => <MomentSection workspace={workspace} items={items} onOpen={(momentId) => onOverlay({ kind: "moment", momentId })} />}</CollectionState>}</DisplayState>
      <DisplayState node={model.places}>{(collection) => <CollectionState collection={collection}>{(items) => <PlaceSection workspace={workspace} items={items} onOpen={(placeId) => onOverlay({ kind: "place", placeId })} />}</CollectionState>}</DisplayState>
    </div>
  );
}

function ActivityCard({ item, onClick }: { readonly item: ActivityLifeMoneySummary; readonly onClick: () => void }) {
  return <button type="button" className={styles.activityCard} onClick={onClick}><span className="eyebrow">{item.occurrences} fois ce mois</span><strong>{item.label}</strong>{item.costKind === "NONE" ? null : <><span>{item.costKind === "CAUSAL" ? "Dépenses liées" : "Dépenses associées"}</span><MoneyMetric metric={item.cost} /></>}</button>;
}

function MomentSection({ items, onOpen, workspace }: { readonly workspace: boolean; readonly items: readonly MomentLifeMoneySummary[]; readonly onOpen: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  if (items.length === 0) return null;
  const visible = items.length < 4 ? items : items.slice(offset, offset + 3).concat(offset + 3 > items.length ? items.slice(0, offset + 3 - items.length) : []);
  return <section><div className={styles.railHeader}><h3>Moments</h3>{items.length >= 4 ? <div><button className={styles.iconButton} aria-label="Moments précédents" onClick={() => setOffset((value) => (value - 1 + items.length) % items.length)}><ChevronLeft aria-hidden size={18} /></button><button className={styles.iconButton} aria-label="Moments suivants" onClick={() => setOffset((value) => (value + 1) % items.length)}><ChevronRight aria-hidden size={18} /></button></div> : null}</div><div className={workspace ? styles.lifeRail : items.length === 1 ? styles.singleMoment : styles.momentRow}>{visible.map((moment) => <button type="button" className={styles.momentCard} key={moment.momentId} onClick={() => onOpen(moment.momentId)}><div className={styles.momentMedia} {...(moment.imageRef === undefined ? { "data-fallback": true } : { role: "img", "aria-label": `Média canonique de ${moment.title}`, style: { backgroundImage: `url(${JSON.stringify(moment.imageRef)})` } })}>{moment.imageRef === undefined ? <HistorySemanticIcon iconKey={moment.fallbackIconKey} size={32} /> : null}</div><strong>{moment.title}</strong><span>{formatFrenchDateRange(moment.startDate, moment.endDate, false)}</span><MoneyMetric metric={moment.causalCost} /></button>)}</div></section>;
}

function PlaceSection({ items, onOpen, workspace }: { readonly workspace: boolean; readonly items: readonly PlaceLifeMoneySummary[]; readonly onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = workspace || expanded ? items : items.slice(0, 6);
  return <section><h3>Lieux</h3><div className={workspace ? styles.lifeRail : items.length <= 3 ? styles.placeRow : styles.placeRail}>{shown.map((place) => <button type="button" className={styles.placeCard} key={place.placeId} onClick={() => onOpen(place.placeId)}><strong>{place.label}</strong><span>{formatCount(place.presenceDays, "jour")}</span><MoneyMetric metric={place.localizedAmount} /></button>)}</div>{!workspace && items.length > 6 && !expanded ? <button type="button" className="button-secondary" onClick={() => setExpanded(true)}>Voir tous les lieux</button> : null}</section>;
}
