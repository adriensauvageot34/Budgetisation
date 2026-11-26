"use client";

import { Suspense, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChartNoAxesColumn, ChevronDown, Landmark, MapPin, SlidersHorizontal, Sparkles, Wallet, X } from "lucide-react";
import type { YearMonth } from "@/core/time";
import type { MetricValue } from "@/core/history-v2";
import type { Money } from "@/core/money";
import type { HistorySpendingSegmentDetailParams, MonthBalanceSummaryReadModel, MonthCategoriesReadModel, MonthLifeMoneyReadModel, MonthQuickOverviewReadModel, MonthSpendingNatureReadModel } from "@/query-api";
import { BalanceDetail, type BalanceTarget, type DetailSelection, type OpenDetail } from "./balance-dashboard-details";
import { AmountBar, PagedRows, chartMaximum, formatDelta, metricValue, stateValue, visibleValue } from "./balance-dashboard-widgets";
import { CategoryRing, DailySpendingTrend, MonthTimeline, SpendingComparison, categoryColors } from "./balance-dashboard-charts";
import { formatCount, formatFrenchDateRange, formatHistoricalRank, spendingPresentationLabel } from "./presentation";
import { BalanceAtom, useBalanceDensity } from "./balance-density";
import { publicationMetasAreCoherent } from "./publication-coherence";
import { MoneyMetric, formatMoney } from "./renderers";
import { overlayTargetKey } from "./route-state";
import type { BalanceDailySeries, HistoryOverlayTarget, HistoryV2InitialState } from "./types";
import { useHistoryPageState } from "./use-history-page-state";
import styles from "./balance-dashboard.module.css";

type PanelKind = "summary" | "categories" | "spending" | "life";

const linkedDetailLabels: Record<HistoryOverlayTarget["kind"], string> = {
  bridge: "Écart avec mon compte",
  category: "Détail de la catégorie",
  segment: "Détail du poste",
  activity: "Détail de l’activité",
  moment: "Détail du moment",
  place: "Détail du lieu",
  journal: "Détail du jour",
};

function detailKey(target: BalanceTarget) {
  switch (target.kind) {
    case "minimal": return target.kind;
    default:
      return overlayTargetKey(target);
  }
}

function panelFor(target?: BalanceTarget): PanelKind | undefined {
  switch (target?.kind) {
    case "bridge":
    case "journal":
    case "minimal":
      return "summary";
    case "category":
      return "categories";
    case "segment":
      return "spending";
    case undefined:
      return undefined;
    default:
      return "life";
  }
}

export function ComposerBalanceDashboard({ month, monthName, initialState, initialDetail, subcategoryLabels, dailySeries }: {
  readonly month: YearMonth;
  readonly monthName: string;
  readonly initialState: Extract<HistoryV2InitialState, { kind: "balance" }>;
  readonly initialDetail?: HistoryOverlayTarget;
  readonly subcategoryLabels: Readonly<Record<string, string>>;
  readonly dailySeries: Promise<BalanceDailySeries | null>;
}) {
  const state = useHistoryPageState(month, initialState);
  const [stack, setStack] = useState<readonly DetailSelection[]>(() =>
    initialDetail ? [{ target: initialDetail, label: linkedDetailLabels[initialDetail.kind] }] : []);
  const id = useId();
  const opener = useRef<HTMLElement | null>(null);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const current = stack.at(-1);
  const origin = panelFor(stack[0]?.target);
  const focusRow = origin === undefined ? undefined : origin === "summary" || origin === "categories" ? "top" : "bottom";

  if (state.kind !== "balance") return null;

  const summary = stateValue(state.summary);
  const overview = stateValue(state.overview);
  const categories = stateValue(state.categories);
  const spending = stateValue(state.spendingNature);
  const life = stateValue(state.lifeMoney);
  const publications = [summary, categories, spending, life].flatMap(model => model ? [model.publicationMeta] : []);
  if (publications.length && !publicationMetasAreCoherent(publications)) {
    return <p role="alert" className={styles.unavailable}>Le bilan rassemble des versions de données différentes. Actualise la page pour le consulter.</p>;
  }

  function focusDetail() {
    requestAnimationFrame(() => detailTitle.current?.focus({ preventScroll: true }));
  }

  function closeDetail() {
    setStack([]);
    requestAnimationFrame(() => {
      const source = opener.current;
      const target = source?.isConnected && source.getClientRects().length > 0 ? source : document.getElementById(`${id}-${origin}-heading`);
      target?.focus({ preventScroll: true });
    });
  }

  function previousDetail() {
    if (stack.length <= 1) {
      closeDetail();
      return;
    }
    setStack(items => items.slice(0, -1));
    focusDetail();
  }

  function showDetail(selection: DetailSelection) {
    if (current && detailKey(current.target) === detailKey(selection.target)) {
      closeDetail();
      return;
    }
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    setStack([selection]);
    focusDetail();
  }

  const detailId = `${id}-detail`;
  function renderRegion(kind: PanelKind, title: string, icon: ReactNode, content: ReactNode) {
    return <BalanceRegion kind={kind} headingId={`${id}-${kind}-heading`} title={title} icon={icon}>
      {content}
      {origin === kind && current && <BalanceAtom name="detail" priority={110} minimum={1} key={detailKey(current.target)}>
        <section className={styles.inlineDetail} id={detailId} aria-labelledby={`${detailId}-title`}>
          <div className={styles.detailHeader}>
            {stack.length > 1 && <button type="button" aria-label="Revenir au détail précédent"
              onClick={previousDetail}><ArrowLeft aria-hidden size={16} /></button>}
            <h3 id={`${detailId}-title`} ref={detailTitle} tabIndex={-1}>{current.label}</h3>
            <button type="button" aria-label="Fermer le détail" className={styles.close} onClick={closeDetail}>
              <X aria-hidden size={17} />
            </button>
          </div>
          <BalanceDetail selection={current} month={month} subcategoryLabels={subcategoryLabels}
            onOpen={selection => {
              setStack(items => [...items, selection]);
              focusDetail();
            }} />
        </section>
      </BalanceAtom>}
    </BalanceRegion>;
  }

  return <div className={styles.dashboard} data-focus-row={focusRow}
    onKeyDown={event => {
      if (event.key !== "Escape" || !current) return;
      event.preventDefault();
      previousDetail();
    }}>
    <header className={styles.pageHeader}>
      <h1>Bilan du mois</h1>
      <span>{monthName}</span>
    </header>
    <div className={styles.panelGrid}>
      {renderRegion("summary", "Dépenses du mois", <Wallet size={19} aria-hidden />,
        summary ? <SummaryCard model={summary} dailySeries={dailySeries} overview={overview} onOpen={showDetail} />
          : <DataStatus failed={state.summary.status === "error"} />)}
      {renderRegion("categories", "Dépenses par catégorie", <ChartNoAxesColumn size={19} aria-hidden />,
        categories ? <CategoryCard model={categories} total={metricValue(visibleValue(summary?.actualValue))}
          activeId={current?.target.kind === "category" ? current.target.categoryId : undefined} onOpen={showDetail} detailId={detailId} />
          : <DataStatus failed={state.categories.status === "error"} />)}
      {renderRegion("spending", "Marges du mois", <SlidersHorizontal size={19} aria-hidden />,
        spending ? <MarginCard model={spending} onOpen={showDetail} />
          : <DataStatus failed={state.spendingNature.status === "error"} />)}
      {renderRegion("life", "Vie et argent", <Sparkles size={19} aria-hidden />,
        life ? <LifeCard model={life} month={month} activeId={current?.target.kind === "moment" ? current.target.momentId : undefined}
          onOpen={showDetail} /> : <DataStatus failed={state.lifeMoney.status === "error"} />)}
    </div>
  </div>;
}

function BalanceRegion({ kind, title, icon, headingId, children }: {
  readonly kind: PanelKind;
  readonly title: string;
  readonly icon: ReactNode;
  readonly headingId: string;
  readonly children: ReactNode;
}) {
  const { region, flow } = useBalanceDensity();
  return <section ref={region} className={styles.panel} data-panel={kind} aria-labelledby={headingId}>
    <div ref={flow} className={styles.panelBody}>
      <BalanceAtom name="heading" priority={120} minimum={1}>
        <h2 id={headingId} className={styles.headingRow} tabIndex={-1}>
          <span className={styles.panelIcon}>{icon}</span><span>{title}</span>
        </h2>
      </BalanceAtom>
      {children}
    </div>
  </section>;
}

function DataStatus({ failed }: { readonly failed: boolean }) {
  return <BalanceAtom name="status" priority={98}>
    <p role="status" className={styles.note}>{failed ? "Données indisponibles pour ce mois." : "Chargement…"}</p>
  </BalanceAtom>;
}
function SummaryCard({ model, onOpen, dailySeries, overview }: {
  readonly model: MonthBalanceSummaryReadModel;
  readonly onOpen: OpenDetail;
  readonly dailySeries: Promise<BalanceDailySeries | null>;
  readonly overview?: MonthQuickOverviewReadModel;
}) {
  const actual = visibleValue(model.actualValue);
  const typical = visibleValue(model.typicalValue);
  const comparison = metricValue(visibleValue(model.actualVsTypical));
  const delta = comparison?.delta;
  const direction = delta === undefined ? undefined : Math.sign(Number(delta));
  const zone = metricValue(visibleValue(model.usualZone));
  const rank = metricValue(visibleValue(model.historicalRank));
  const minimum = metricValue(visibleValue(model.minimalValue));
  const flows = publicationMetasAreCoherent([model.publicationMeta, overview?.publicationMeta]) ? overview?.flows : undefined;
  const bankInflows = visibleValue(flows?.bankInflows);
  const bankOutflows = visibleValue(flows?.bankOutflows);
  return <>
    <BalanceAtom name="total" priority={100}>
      <div className={styles.spentHeader}>
        {actual ? <MoneyMetric metric={actual} className={styles.bigAmount} /> : <strong>Dépenses à confirmer</strong>}
        {delta !== undefined && <span className={styles.delta} data-direction={direction}>
          {direction === -1 ? <ArrowDownRight size={15} aria-hidden /> : direction === 1 ? <ArrowUpRight size={15} aria-hidden /> : null}
          {direction === 0 ? "Au niveau habituel" : `${formatMoney((Number(delta) < 0 ? delta.slice(1) : delta) as typeof delta)} ${direction === -1 ? "sous" : "au-dessus de"} l’habitude`}
        </span>}
      </div>
    </BalanceAtom>
    {(metricValue(actual) !== undefined || metricValue(typical) !== undefined) && <BalanceAtom name="habit" priority={81}>
      <SpendingComparison actual={metricValue(actual)} typical={metricValue(typical)} range={zone} />
    </BalanceAtom>}
    <BalanceAtom name="days" priority={89}>
      <Suspense fallback={<p className={styles.note} role="status">Chargement des dépenses par jour…</p>}>
        <DailySpendingTrend series={dailySeries} reference={model.publicationMeta} onInspect={(date, label) =>
          onOpen({ target: { kind: "journal", date }, label })} />
      </Suspense>
    </BalanceAtom>
    <BalanceAtom name="bank" priority={65}>
      <div className={styles.panelFoot}>
        <button type="button" className={styles.textButton} onClick={() => onOpen({ target: { kind: "bridge" }, label: "Écart avec mon compte" })}>
          <Landmark size={14} aria-hidden /> Écart avec mon compte
        </button>
        {rank?.presentation === "RANKED" && <span className={styles.zone}>{formatHistoricalRank(rank.rank, rank.universeCount)}</span>}
      </div>
      {(metricValue(bankInflows) !== undefined || metricValue(bankOutflows) !== undefined) && <dl className={styles.bankFlows}>
        {bankInflows && metricValue(bankInflows) !== undefined && <div><dt>Crédits bancaires</dt><dd><MoneyMetric metric={bankInflows} /></dd></div>}
        {bankOutflows && metricValue(bankOutflows) !== undefined && <div><dt>Débits bancaires</dt><dd><MoneyMetric metric={bankOutflows} /></dd></div>}
      </dl>}
    </BalanceAtom>
    {minimum !== undefined && <BalanceAtom name="minimum" priority={44}>
      <button type="button" className={styles.textButton} onClick={() => onOpen({ target: { kind: "minimal" }, label: "Minimum estimé" })}>
        Minimum estimé <strong>{formatMoney(minimum)}</strong>
      </button>
    </BalanceAtom>}
    {model.importedSummary.text && <BalanceAtom name="editorial" priority={27}>
      <PagedRows size={1} label="Résumé du mois" items={model.importedSummary.text.match(/.{1,210}(?:\s+|$)|\S+/gu) ?? [model.importedSummary.text]}>
        {rows => <p className={styles.longNote}>{rows[0]}</p>}
      </PagedRows>
    </BalanceAtom>}
  </>;
}

function CategoryCard({ model, total, activeId, onOpen, detailId }:  {
  readonly model: MonthCategoriesReadModel;
  readonly total?: Money;
  readonly activeId?: string;
  readonly onOpen: OpenDetail;
  readonly detailId: string;
}) {
  const collection = visibleValue(model.categories);
  const items = collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : [];
  const rows = items.map(item => ({
    id: item.categoryId, label: item.label, amount: item.actual, share: metricValue(item.shareOfActual), delta: metricValue(item.delta),
  }));
  const maximum = chartMaximum(rows);
  const deviations = rows.flatMap(row => row.delta !== undefined && Number(row.delta) !== 0 ? [{ label: row.label, delta: row.delta, id: row.id }] : [])
    .sort((left, right) => Math.abs(Number(right.delta)) - Math.abs(Number(left.delta))).slice(0, 3);
  const maximumDeviation = Math.max(1, ...deviations.map(row => Math.abs(Number(row.delta))));
  const other = visibleValue(model.otherAmount);
  const unclassified = visibleValue(model.unclassifiedAmount);
  return <>
    {!rows.length && <BalanceAtom name="status" priority={90}><p className={styles.note}>Aucun poste détaillé pour ce mois.</p></BalanceAtom>}
    {rows.length > 0 && <BalanceAtom name="categories" priority={100}>
    <div className={styles.categoryChart}>
      {Number(total) > 0 && <CategoryRing shares={rows.map(row => {
        const amount = metricValue(row.amount);
        return amount === undefined ? undefined : Number(amount) / Number(total);
      })} />}
      <div className={styles.categoryLedger}>

        <ul className={styles.categoryPlot}>
          {rows.map((row, index) => <li key={row.id}>
            <button type="button" style={{ "--category-color": categoryColors[index % categoryColors.length] } as CSSProperties}
              onClick={() => onOpen({ target: { kind: "category", categoryId: row.id }, label: row.label })}
              aria-controls={activeId === row.id ? detailId : undefined} aria-expanded={activeId === row.id}>
              <i aria-hidden />
              <AmountBar row={row} maximum={maximum} />

              <ChevronDown size={14} aria-hidden />
            </button>
          </li>)}
        </ul>
      </div>
    </div>
    <div className={styles.panelFoot}>
      {other && Number(metricValue(other) ?? 0) !== 0 && <span className={styles.zone}>Autres catégories <strong><MoneyMetric metric={other} /></strong></span>}
      {unclassified && Number(metricValue(unclassified) ?? 0) !== 0 && <span className={styles.zone}>Non classé <strong><MoneyMetric metric={unclassified} /></strong></span>}
      {rows.length > 2 && <ContentPicker label="Choisir une catégorie" rows={rows} onChoose={row =>
        onOpen({ target: { kind: "category", categoryId: row.id }, label: row.label })} />}
    </div>
    </BalanceAtom>}
    {deviations.length > 0 && <BalanceAtom name="deviations" priority={36}><div className={styles.deviationPreview}>
      <h3>Plus grands écarts à l’habitude</h3>
      <ul className={styles.adjustments}>
        {deviations.map(row => <li key={row.id}>
          <button type="button" className={styles.deviationButton} onClick={() => onOpen({ target: { kind: "category", categoryId: row.id }, label: row.label })}>
            <span>{row.label}</span><strong>{formatDelta(row.delta)}</strong>
            <span className={styles.adjustmentTrack} aria-hidden><i data-negative={Number(row.delta) < 0}
              style={{ width: `${Math.abs(Number(row.delta)) / maximumDeviation * 50}%` }} /></span>
          </button>
        </li>)}
      </ul>
    </div></BalanceAtom>}
  </>;
}

function ContentPicker<T extends { readonly id: string; readonly label: string }>({ label, rows, onChoose, hasExtra }: {
  readonly label: string;
  readonly rows: readonly T[];
  readonly onChoose: (row: T) => void;
  readonly hasExtra?: boolean;
}) {
  return <select aria-label={label} className={styles.contentPicker} data-extra={hasExtra} value="" onChange={event => {
    const row = rows.find(candidate => candidate.id === event.target.value);
    if (row) onChoose(row);
  }}>
    <option value="">{label}</option>
    {rows.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
  </select>;
}

const necessityColors: Record<string, string> = { CONSTRAINED: "#7650b5", INDISPENSABLE: "#798cc1", OPTIONAL: "#c279a0" };

function MarginCard({ model, onOpen }: { readonly model: MonthSpendingNatureReadModel; readonly onOpen: OpenDetail }) {
  const matrix = visibleValue(model.matrix);
  const necessity = visibleValue(model.necessity);
  const buckets = metricValue(necessity?.result);

  function openSegment(params: HistorySpendingSegmentDetailParams, label: string) {
    onOpen({ target: { kind: "segment", params }, label });
  }

  const matrixRows = (matrix?.cells ?? []).flatMap(bucket => {
    const [necessity, behavior] = bucket.key.split("__");
    if ((necessity !== "CONSTRAINED" && necessity !== "INDISPENSABLE" && necessity !== "OPTIONAL")
      || (behavior !== "FIXED" && behavior !== "VARIABLE")) return [];
    return [{ id: bucket.key, label: spendingPresentationLabel(bucket.key), necessity, behavior } as const];
  });

  return <>
    <BalanceAtom name="margins" priority={100}>
      <div className={styles.marginStats}>
        <button type="button" onClick={() => openSegment({ necessity: "OPTIONAL", behavior: "VARIABLE" }, "Ajustable maintenant")}>
          <span>Ajustable maintenant</span><MarginAmount metric={matrix?.immediateMargin} />
        </button>
        <button type="button" onClick={() => openSegment({ necessity: "OPTIONAL", behavior: "FIXED" }, "Ajustable à moyen terme")}>
          <span>Ajustable à moyen terme</span><MarginAmount metric={matrix?.mediumMargin} />
        </button>
      </div>
    </BalanceAtom>
    <SpendingStack name="behavior" priority={88} buckets={metricValue(visibleValue(model.behavior)?.result)}
      onOpen={bucket => openSegment({ axis: "behavior", bucket }, spendingPresentationLabel(bucket))} />
    {buckets && buckets.length > 0 && <BalanceAtom name="necessity" priority={77}><div className={styles.necessityPreview}>
      <h3>Degré de nécessité</h3>
      <ul>
        {buckets.map(bucket => <li key={bucket.key} style={{ "--bucket-color": necessityColors[bucket.key] ?? "#807995" } as CSSProperties}>
          <button type="button" onClick={() => openSegment({ axis: "necessity", bucket: bucket.key }, spendingPresentationLabel(bucket.key))}>
            <span>{spendingPresentationLabel(bucket.key)}</span><strong>{formatMoney(bucket.amount)}</strong>
            {bucket.shareOfActual !== undefined && <>
              <small>{Math.round(bucket.shareOfActual * 100)} %</small>
              <span className={styles.necessityMeter} aria-hidden><i style={{ width: `${Math.max(0, Math.min(1, bucket.shareOfActual)) * 100}%` }} /></span>
            </>}
          </button>
        </li>)}
      </ul>
      {necessity && Number(necessity.unclassifiedAmount) !== 0 && <p className={styles.note}>{formatMoney(necessity.unclassifiedAmount)} non classés</p>}
    </div></BalanceAtom>}
    <SpendingStack name="scope" priority={59} title="Quotidien et hors quotidien"
      buckets={metricValue(visibleValue(model.lifeScope)?.result)}
      onOpen={bucket => openSegment({ axis: "lifeScope", bucket }, spendingPresentationLabel(bucket))} />
    {matrixRows.length > 0 && <BalanceAtom name="matrix" priority={32}>
      <ContentPicker label="Nécessité et type de dépense" rows={matrixRows}
        onChoose={row => openSegment({ necessity: row.necessity, behavior: row.behavior }, row.label)} />
    </BalanceAtom>}
  </>;
}

function SpendingStack({ name, priority, title, buckets, onOpen }: {
  readonly name: string;
  readonly priority: number;
  readonly title?: string;
  readonly buckets?: readonly { readonly key: string; readonly amount: Money; readonly shareOfActual?: number }[];
  readonly onOpen: (key: string) => void;
}) {
  if (!buckets?.length) return null;
  return <BalanceAtom name={name} priority={priority}><div className={styles.breakdown}>
    {title && <h3>{title}</h3>}
    <div className={styles.stack} role="group" aria-label={title ?? "Fixes et variables"}>
      {buckets.map((bucket, index) => bucket.shareOfActual === undefined ? null : <button key={bucket.key}
        type="button" tabIndex={-1} aria-label={spendingPresentationLabel(bucket.key)} data-variable={index === 1}
        onClick={() => onOpen(bucket.key)} style={{ width: `${Math.max(0, Math.min(1, bucket.shareOfActual)) * 100}%` }} />)}
    </div>
    <div className={styles.legend}>
      {buckets.map((bucket, index) => <button key={bucket.key} type="button" data-variable={index === 1} onClick={() => onOpen(bucket.key)}>
        <i aria-hidden /> {spendingPresentationLabel(bucket.key)} <strong>{formatMoney(bucket.amount)}</strong>
        {bucket.shareOfActual !== undefined && <small>{Math.round(bucket.shareOfActual * 100)} %</small>}
      </button>)}
    </div>
  </div></BalanceAtom>;
}
function MarginAmount({ metric }: { readonly metric?: MetricValue<Money> }) {
  if (!metric) return <strong>À établir</strong>;
  if (metric.status !== "PARTIAL" || metric.partialMeaning !== "LOWER_BOUND") return <MoneyMetric metric={metric} />;
  return <span>
    <span className={styles.marginFull}><MoneyMetric metric={metric} /></span>
    <span className={styles.marginCompact}>
      <span aria-hidden="true">≥ </span><span className="sr-only">Au moins </span>
      <MoneyMetric metric={metric} partialDisplay="value-only" />
    </span>
  </span>;
}

function LifeCard({ model, month, activeId, onOpen }: {
  readonly model: MonthLifeMoneyReadModel;
  readonly month: YearMonth;
  readonly activeId?: string;
  readonly onOpen: OpenDetail;
}) {
  const activities = visibleValue(model.activities);
  const moments = visibleValue(model.moments);
  const places = visibleValue(model.places);
  const activityList = activities?.status === "KNOWN" || activities?.status === "PARTIAL" ? activities.items : [];
  const momentList = moments?.status === "KNOWN" || moments?.status === "PARTIAL" ? moments.items : [];
  const placeList = places?.status === "KNOWN" || places?.status === "PARTIAL" ? places.items : [];
  const visibleMoments = momentList.slice(0, 5);

  function openMoment(moment: (typeof momentList)[number]) {
    onOpen({ target: { kind: "moment", momentId: moment.momentId }, label: moment.title });
  }

  return <>
    {momentList.length > 0 && <BalanceAtom name="timeline" priority={84}>
      <MonthTimeline month={month} moments={momentList} activeId={activeId} onOpen={openMoment} />
    </BalanceAtom>}
    {visibleMoments.length > 0 && <BalanceAtom name="moments" priority={100}><div className={styles.lifeMoments}>
      <h3>Moments marquants</h3>
      <ul className={styles.lifeRows}>
        {visibleMoments.map(moment => <li key={moment.momentId}>
          <button type="button" aria-expanded={activeId === moment.momentId} onClick={() => openMoment(moment)}>
            <span className={styles.dateChip}>{formatFrenchDateRange(moment.startDate, moment.endDate, false)}</span>
            <strong title={moment.title}>{moment.title}</strong>
            {metricValue(moment.causalCost) !== undefined && <MoneyMetric metric={moment.causalCost} partialDisplay="value-only" />}
          </button>
        </li>)}
      </ul>
      {momentList.length > 1 && <ContentPicker label="Choisir un moment" hasExtra={momentList.length > visibleMoments.length}
        rows={momentList.map(moment => ({ id: moment.momentId, label: moment.title, moment }))} onChoose={row => openMoment(row.moment)} />}
    </div></BalanceAtom>}
    {(activityList.length > 0 || placeList.length > 0) && <BalanceAtom name="lifeFacts" priority={78}>
      <ul className={`${styles.lifeRows} ${styles.lifeFacts}`}>
        {activityList.slice(0, 1).map(activity => <li key={activity.activityTypeKey}>
          <button type="button" onClick={() => onOpen({ target: { kind: "activity", activityTypeKey: activity.activityTypeKey }, label: activity.label })}>
            <ChartNoAxesColumn size={16} aria-hidden /><span><small>Activité du mois</small><strong title={activity.label}>{activity.label}</strong></span>
            <span>{formatCount(activity.occurrences, "fois", "fois")}</span>
          </button>
        </li>)}
        {placeList.slice(0, 3).map(place => <li key={place.placeId}>
          <button type="button" onClick={() => onOpen({ target: { kind: "place", placeId: place.placeId }, label: place.label })}>
            <MapPin size={16} aria-hidden /><span><small>Lieu fréquenté</small><strong title={place.label}>{place.label}</strong></span>
            <span>{formatCount(place.presenceDays, "jour")}</span>
          </button>
        </li>)}
      </ul>
      {(activityList.length > 1 || placeList.length > 1) && <div className={styles.lifePickers}>
        {activityList.length > 1 && <ContentPicker label="Choisir une activité"
          rows={activityList.map(activity => ({ id: activity.activityTypeKey, label: activity.label }))}
          onChoose={row => onOpen({ target: { kind: "activity", activityTypeKey: row.id }, label: row.label })} />}
        {placeList.length > 1 && <ContentPicker label="Choisir un lieu"
          rows={placeList.map(place => ({ id: place.placeId, label: place.label }))}
          onChoose={row => onOpen({ target: { kind: "place", placeId: row.id }, label: row.label })} />}
      </div>}
    </BalanceAtom>}
    {!momentList.length && !activityList.length && !placeList.length && <BalanceAtom name="status" priority={80}>
      <p className={styles.note}>Aucune activité, aucun moment ni lieu renseigné.</p>
    </BalanceAtom>}
  </>;
}
