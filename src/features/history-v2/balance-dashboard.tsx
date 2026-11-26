"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChartNoAxesColumn, ChevronDown, Landmark, MapPin, SlidersHorizontal, Sparkles, Wallet, X } from "lucide-react";
import type { YearMonth } from "@/core/time";
import type { MetricValue } from "@/core/history-v2";
import type { Money } from "@/core/money";
import type { MonthBalanceSummaryReadModel, MonthCategoriesReadModel, MonthLifeMoneyReadModel, MonthSpendingNatureReadModel } from "@/query-api";
import { BalanceBankDetail, BalanceDetail, BalanceLifeDetails, type BalanceTarget, type DetailSelection, type OpenDetail } from "./balance-dashboard-details";
import { AmountBar, PagedRows, chartMaximum, formatDelta, metricValue, stateValue, visibleValue } from "./balance-dashboard-widgets";
import { CategoryRing, MonthTimeline, SpendingComparison, categoryColors } from "./balance-dashboard-charts";
import { formatCount, formatFrenchDateRange, formatHistoricalRank } from "./presentation";
import { SpendingBreakdown } from "./balance-dashboard-spending";
import { publicationMetasAreCoherent } from "./publication-coherence";
import { MoneyMetric, formatMoney } from "./renderers";
import { overlayTargetKey } from "./route-state";
import type { HistoryOverlayTarget, HistoryV2InitialState } from "./types";
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

export function ComposerBalanceDashboard({ month, monthName, initialState, initialDetail, subcategoryLabels }: {
  readonly month: YearMonth;
  readonly monthName: string;
  readonly initialState: Extract<HistoryV2InitialState, { kind: "balance" }>;
  readonly initialDetail?: HistoryOverlayTarget;
  readonly subcategoryLabels: Readonly<Record<string, string>>;
}) {
  const state = useHistoryPageState(month, initialState);
  const [activePanel, setActivePanel] = useState<PanelKind | undefined>(() => panelFor(initialDetail));
  const [stack, setStack] = useState<readonly DetailSelection[]>(() =>
    initialDetail && initialDetail.kind !== "bridge" ? [{ target: initialDetail, label: linkedDetailLabels[initialDetail.kind] }] : []);
  const id = useId();
  const dashboard = useRef<HTMLDivElement>(null);
  const previousHeadings = useRef<Map<HTMLElement, DOMRect> | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const nestedTitle = useRef<HTMLHeadingElement>(null);
  const current = stack.at(-1);

  useLayoutEffect(() => {
    const headings = previousHeadings.current;
    previousHeadings.current = null;
    headings?.forEach((before, element) => {
      element.getAnimations().forEach(animation => animation.cancel());
      const after = element.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (Math.abs(x) + Math.abs(y) < 2) return;
      element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }],
        { duration: 280, easing: "cubic-bezier(.22,.75,.22,1)" });
    });
  }, [activePanel]);

  if (state.kind !== "balance") return null;

  const summary = stateValue(state.summary);
  const categories = stateValue(state.categories);
  const spending = stateValue(state.spendingNature);
  const life = stateValue(state.lifeMoney);
  const publications = [summary, categories, spending, life].flatMap(model => model ? [model.publicationMeta] : []);
  if (publications.length && !publicationMetasAreCoherent(publications)) {
    return <p role="alert" className={styles.unavailable}>Le bilan rassemble des versions de données différentes. Actualise la page pour le consulter.</p>;
  }

  function captureHeadingPositions() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !dashboard.current) return;
    previousHeadings.current = new Map(
      [...dashboard.current.querySelectorAll<HTMLElement>(`.${styles.headingRow}`)].map(element => [element, element.getBoundingClientRect()]),
    );
  }

  function close() {
    captureHeadingPositions();
    setActivePanel(undefined);
    setStack([]);
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected ? opener.current : document.getElementById(`${id}-${activePanel}-heading`);
      target?.focus({ preventScroll: true });
    });
  }

  function selectPanel(panel: PanelKind) {
    if (activePanel === panel) {
      close();
      return;
    }
    captureHeadingPositions();
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    setActivePanel(panel);
    setStack([]);
  }

  function showDetail(selection: DetailSelection) {
    const panel = panelFor(selection.target);
    if (!panel) return;
    if (activePanel !== panel) {
      captureHeadingPositions();
      if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
      setActivePanel(panel);
    }
    if (selection.target.kind === "bridge") {
      setStack([]);
      requestAnimationFrame(() => document.getElementById(`${id}-bank-heading`)?.focus({ preventScroll: true }));
      return;
    }
    if (current && detailKey(current.target) === detailKey(selection.target)) {
      setStack([]);
      return;
    }
    setStack([selection]);
    requestAnimationFrame(() => nestedTitle.current?.focus({ preventScroll: true }));
  }

  const actual = visibleValue(summary?.actualValue);
  const categoryCollection = visibleValue(categories?.categories);
  const momentCollection = visibleValue(life?.moments);
  const momentCount = momentCollection?.status === "KNOWN" || momentCollection?.status === "PARTIAL" ? momentCollection.items.length : 0;
  const immediateMargin = visibleValue(spending?.matrix)?.immediateMargin;
  const compact: Record<PanelKind, ReactNode> = {
    summary: actual && <MoneyMetric metric={actual} partialDisplay="value-only" />,
    categories: categoryCollection?.status === "KNOWN" || categoryCollection?.status === "PARTIAL"
      ? formatCount(categoryCollection.items.length, "poste") : null,
    spending: metricValue(immediateMargin) === undefined ? null : <MarginAmount metric={immediateMargin} />,
    life: momentCount ? formatCount(momentCount, "moment") : null,
  };

  function renderPanel(panel: PanelKind, title: string, icon: ReactNode, body: ReactNode, extra?: ReactNode) {
    const selected = activePanel === panel;
    const detailId = `${id}-${panel}`;
    return <Panel kind={panel} title={title} icon={icon} selected={selected} collapsed={activePanel !== undefined && !selected}
      detailId={detailId} compact={compact[panel]} onOpen={() => selectPanel(panel)}>
      {body}
      {selected && extra && <div className={styles.reveal}><div>{extra}</div></div>}
      {selected && current && <div className={styles.reveal} key={detailKey(current.target)}>
        <div>
          <div id={`${detailId}-specific`} className={styles.inlineDetail} aria-labelledby={`${detailId}-item-title`}>
            <div className={styles.detailHeader}>
              {stack.length > 1 && <button type="button" aria-label="Revenir au détail précédent"
                onClick={() => setStack(items => items.slice(0, -1))}><ArrowLeft aria-hidden size={16} /></button>}
              <h3 id={`${detailId}-item-title`} ref={nestedTitle} tabIndex={-1}>{current.label}</h3>
              <button type="button" aria-label="Replier ce détail" className={styles.close} onClick={() => {
                setStack([]);
                requestAnimationFrame(() => document.getElementById(`${detailId}-heading`)?.focus({ preventScroll: true }));
              }}><X aria-hidden size={17} /></button>
            </div>
            <BalanceDetail selection={current} month={month} subcategoryLabels={subcategoryLabels}
              onOpen={selection => {
                setStack(items => [...items, selection]);
                requestAnimationFrame(() => nestedTitle.current?.focus({ preventScroll: true }));
              }} />
        </div>
        </div>
      </div>}
    </Panel>;
  }

  return <div ref={dashboard} className={styles.dashboard} data-detail-open={activePanel !== undefined} data-detail-deep={current !== undefined}
    onKeyDown={event => {
      if (event.key !== "Escape" || activePanel === undefined) return;
      event.preventDefault();
      if (current) {
        setStack(items => items.slice(0, -1));
        requestAnimationFrame(() => document.getElementById(`${id}-${activePanel}-heading`)?.focus({ preventScroll: true }));
      } else close();
    }}>
    <header className={styles.pageHeader}>
      <h1>Bilan du mois</h1>
      <span>{monthName}</span>
    </header>

    <div className={styles.panelGrid}>
      <div className={styles.band} data-active={activePanel === "summary" || activePanel === "categories"}>
        {renderPanel("summary", "Dépenses du mois", <Wallet size={19} aria-hidden />,
          summary ? <SummaryCard model={summary} expanded={activePanel === "summary"} onOpen={showDetail} /> : <DataStatus failed={state.summary.status === "error"} />,
          summary && <div className={styles.summaryDetails}>
            <BalanceBankDetail month={month} headingId={`${id}-bank-heading`} />
            {summary.importedSummary.text && <section className={styles.panelExtension} aria-labelledby={`${id}-editorial-heading`}>
              <h3 id={`${id}-editorial-heading`}>{summary.importedSummary.freshness === "STALE" ? "Résumé à actualiser" : "Résumé du mois"}</h3>
              <PagedRows size={1} label="Résumé du mois" items={summary.importedSummary.text.match(/.{1,210}(?:\s+|$)|\S+/gu) ?? [summary.importedSummary.text]}>
                {rows => <p className={styles.longNote}>{rows[0]}</p>}
              </PagedRows>
            </section>}
          </div>)}
        {renderPanel("categories", "Dépenses par catégorie", <ChartNoAxesColumn size={19} aria-hidden />,
          categories ? <CategoryCard model={categories} total={metricValue(actual)}
            expanded={activePanel === "categories"} activeId={current?.target.kind === "category" ? current.target.categoryId : undefined}
            onOpen={showDetail} onExpand={() => selectPanel("categories")} detailId={`${id}-categories-specific`} />
            : <DataStatus failed={state.categories.status === "error"} />)}
      </div>
      <div className={styles.band} data-active={activePanel === "spending" || activePanel === "life"}>
        {renderPanel("spending", "Marges du mois", <SlidersHorizontal size={19} aria-hidden />,
          spending ? <MarginCard model={spending} /> : <DataStatus failed={state.spendingNature.status === "error"} />,
          spending && <section className={styles.panelExtension} aria-labelledby={`${id}-spending-breakdown`}>
            <h3 id={`${id}-spending-breakdown`}>Répartition des dépenses</h3>
            <SpendingBreakdown model={spending} month={month} />
          </section>)}
        {renderPanel("life", "Vie et argent", <Sparkles size={19} aria-hidden />,
          life ? <LifeCard model={life} month={month} expanded={activePanel === "life"}
            activeId={current?.target.kind === "moment" ? current.target.momentId : undefined}
            onOpen={showDetail} /> : <DataStatus failed={state.lifeMoney.status === "error"} />,
          life && <BalanceLifeDetails model={life} onOpen={showDetail} />)}
      </div>
    </div>
  </div>;
}

function Panel({ kind, title, icon, selected, collapsed, onOpen, detailId, compact, children }: {
  readonly kind: PanelKind;
  readonly title: string;
  readonly icon: ReactNode;
  readonly selected: boolean;
  readonly collapsed: boolean;
  readonly onOpen: () => void;
  readonly detailId: string;
  readonly compact: ReactNode;
  readonly children: ReactNode;
}) {
  return <section key={kind} className={styles.panel} data-panel={kind} data-selected={selected} data-collapsed={collapsed}>
    <h2 className={styles.headingRow}><button type="button" className={styles.panelHeading} id={`${detailId}-heading`} onClick={onOpen}
      aria-label={title} aria-controls={detailId} aria-expanded={selected}>
      <span className={styles.panelIcon}>{icon}</span><span className={styles.headingLabel}>{title}</span>
      <ChevronDown className={styles.chevron} size={16} aria-hidden />
    </button>{collapsed && compact && <span className={styles.compactFigure}>{compact}</span>}</h2>
    <div className={styles.panelSummary} id={detailId} aria-hidden={collapsed} inert={collapsed}>
      <div className={styles.panelSummaryClip}><div className={styles.panelBody}>{children}</div></div>
    </div>
  </section>;
}

function DataStatus({ failed }: { readonly failed: boolean }) {
  return <p role="status" className={styles.note}>{failed ? "Données indisponibles pour ce mois." : "Chargement…"}</p>;
}

function SummaryCard({ model, expanded, onOpen }: {
  readonly model: MonthBalanceSummaryReadModel;
  readonly expanded: boolean;
  readonly onOpen: OpenDetail;
}) {
  const actual = visibleValue(model.actualValue);
  const typical = visibleValue(model.typicalValue);
  const comparison = metricValue(visibleValue(model.actualVsTypical));
  const delta = comparison?.delta;
  const direction = delta === undefined ? undefined : Math.sign(Number(delta));
  const zone = metricValue(visibleValue(model.usualZone));
  const rank = metricValue(visibleValue(model.historicalRank));
  const minimum = metricValue(visibleValue(model.minimalValue));
  return <div className={styles.overviewLayout}>
    <div className={styles.overviewGraph}>
      <div className={styles.spentHeader}>
        {actual ? <MoneyMetric metric={actual} className={styles.bigAmount} /> : <strong>Dépenses à confirmer</strong>}
        {delta !== undefined && <span className={styles.delta} data-direction={direction}>
          {direction === -1 ? <ArrowDownRight size={15} aria-hidden /> : direction === 1 ? <ArrowUpRight size={15} aria-hidden /> : null}
          {direction === 0 ? "Au niveau habituel" : `${formatMoney((Number(delta) < 0 ? delta.slice(1) : delta) as typeof delta)} ${direction === -1 ? "sous" : "au-dessus de"} l’habitude`}
        </span>}
      </div>
      <SpendingComparison actual={metricValue(actual)} typical={metricValue(typical)} range={zone} />
      {!expanded && <div className={styles.panelFoot}>
        <div className={styles.summaryReferences}>
          {zone && <span className={styles.zone}>Fourchette habituelle <strong>{formatMoney(zone.lowerBound)} – {formatMoney(zone.upperBound)}</strong></span>}
          {rank?.presentation === "RANKED" && <span className={styles.zone}>{formatHistoricalRank(rank.rank, rank.universeCount)}</span>}
        </div>
        <button type="button" className={styles.textButton} onClick={() => onOpen({ target: { kind: "bridge" }, label: "Écart avec mon compte" })}>
          <Landmark size={14} aria-hidden /> Écart avec mon compte
        </button>
      </div>}
    </div>
    {expanded && (zone || rank?.presentation === "RANKED" || minimum !== undefined) && <dl className={styles.overviewFacts}>
      {zone && <div><dt>Fourchette habituelle</dt><dd>{formatMoney(zone.lowerBound)} à {formatMoney(zone.upperBound)}</dd></div>}
      {rank?.presentation === "RANKED" && <div><dt>Place dans l’historique</dt><dd>{formatHistoricalRank(rank.rank, rank.universeCount)}</dd>
        <div className={styles.rankTicks} aria-hidden="true">
          {Array.from({ length: rank.universeCount }, (_, index) => <span key={index} data-current={index + 1 === rank.rank} />)}
        </div>
      </div>}
      {minimum !== undefined && <div><dt>Minimum estimé</dt><dd>{formatMoney(minimum)}
        <button type="button" className={styles.textButton} onClick={() => onOpen({ target: { kind: "minimal" }, label: "Minimum estimé" })}>Voir les postes</button>
      </dd></div>}
    </dl>}
  </div>;
}

function CategoryCard({ model, total, expanded, activeId, onOpen, onExpand, detailId }: {
  readonly model: MonthCategoriesReadModel;
  readonly total?: Money;
  readonly expanded: boolean;
  readonly activeId?: string;
  readonly onOpen: OpenDetail;
  readonly onExpand: () => void;
  readonly detailId: string;
}) {
  const collection = visibleValue(model.categories);
  const items = collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : [];
  const rows = (expanded ? items : items.slice(0, 4)).map(item => ({
    id: item.categoryId, label: item.label, amount: item.actual, share: metricValue(item.shareOfActual), delta: metricValue(item.delta),
  }));
  const maximum = chartMaximum(rows);
  const other = visibleValue(model.otherAmount);
  const unclassified = visibleValue(model.unclassifiedAmount);
  return <>
    {!rows.length && <p className={styles.note}>Aucun poste détaillé pour ce mois.</p>}
    {rows.length > 0 && <div className={styles.categoryChart}>
      {Number(total) > 0 && <CategoryRing shares={rows.map(row => {
        const amount = metricValue(row.amount);
        return amount === undefined ? undefined : Number(amount) / Number(total);
      })} />}
      <div className={styles.categoryLedger}>
        {expanded && rows.some(row => row.delta !== undefined) && <p className={styles.note}>Les écarts signés comparent les dépenses au mois habituel.</p>}
        <ul className={styles.categoryPlot}>
          {rows.map((row, index) => <li key={row.id}>
            <button type="button" style={{ "--category-color": categoryColors[index % categoryColors.length] } as CSSProperties}
              onClick={() => onOpen({ target: { kind: "category", categoryId: row.id }, label: row.label })}
              aria-controls={activeId === row.id ? detailId : undefined} aria-expanded={activeId === row.id}>
              <i aria-hidden />
              <AmountBar row={row} maximum={maximum} />
              {expanded && row.delta !== undefined && <small className={styles.categoryDelta} data-above={Number(row.delta) > 0}>{formatDelta(row.delta)}</small>}
              <ChevronDown size={14} aria-hidden />
            </button>
          </li>)}
        </ul>
      </div>
    </div>}
    <div className={styles.panelFoot}>
      {other && Number(metricValue(other) ?? 0) !== 0 && <span className={styles.zone}>Autres catégories <strong><MoneyMetric metric={other} /></strong></span>}
      {expanded && unclassified && Number(metricValue(unclassified) ?? 0) !== 0 && <span className={styles.zone}>Non classé <strong><MoneyMetric metric={unclassified} /></strong></span>}
      {!expanded && items.length > rows.length && <button type="button" className={styles.textButton} onClick={onExpand}>
        Voir les {items.length} postes détaillés
      </button>}
    </div>
  </>;
}

function MarginCard({ model }: { readonly model: MonthSpendingNatureReadModel }) {
  const matrix = visibleValue(model.matrix);
  const fixedVariable = metricValue(visibleValue(model.behavior)?.result);
  return <>
    <div className={styles.marginStats}>
      <div><span>Ajustable maintenant</span><MarginAmount metric={matrix?.immediateMargin} /></div>
      <div><span>Ajustable à moyen terme</span><MarginAmount metric={matrix?.mediumMargin} /></div>
    </div>
    {fixedVariable?.length ? <div className={styles.breakdown}>
      <div className={styles.stack} aria-hidden="true">
        {fixedVariable.map(bucket => bucket.shareOfActual === undefined ? null :
          <span key={bucket.key} data-variable={bucket.key === "VARIABLE"} style={{ width: `${Math.max(0, Math.min(100, bucket.shareOfActual * 100))}%` }} />)}
      </div>
      <div className={styles.legend}>
        {fixedVariable.map(bucket => <span key={bucket.key} data-variable={bucket.key === "VARIABLE"}>
          <i aria-hidden /> {bucket.key === "FIXED" ? "Fixes" : "Variables"} <strong className={styles.legendAmount}>{formatMoney(bucket.amount)}</strong>{bucket.shareOfActual !== undefined && <small>{Math.round(bucket.shareOfActual * 100)} %</small>}
        </span>)}
      </div>
    </div> : <p className={styles.note}>Répartition fixe et variable indisponible.</p>}
  </>;
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

function LifeCard({ model, month, activeId, onOpen, expanded }: {
  readonly model: MonthLifeMoneyReadModel;
  readonly month: YearMonth;
  readonly activeId?: string;
  readonly onOpen: OpenDetail;
  readonly expanded: boolean;
}) {
  const activities = visibleValue(model.activities);
  const moments = visibleValue(model.moments);
  const places = visibleValue(model.places);
  const activity = activities?.status === "KNOWN" || activities?.status === "PARTIAL" ? activities.items[0] : undefined;
  const momentList = moments?.status === "KNOWN" || moments?.status === "PARTIAL" ? moments.items : [];
  const moment = momentList[0];
  const place = places?.status === "KNOWN" || places?.status === "PARTIAL" ? places.items[0] : undefined;
  return <>
    <MonthTimeline month={month} moments={momentList} activeId={activeId}
      onOpen={item => onOpen({ target: { kind: "moment", momentId: item.momentId }, label: item.title })} />
    {!expanded && <ul className={styles.lifeRows}>
    {moment && <li><button type="button" onClick={() => onOpen({ target: { kind: "moment", momentId: moment.momentId }, label: moment.title })}>
      <Sparkles size={16} aria-hidden /><span><small>Moment marquant</small><strong title={moment.title}>{moment.title}</strong></span>
      <span>{metricValue(moment.causalCost) === undefined ? formatFrenchDateRange(moment.startDate, moment.endDate, false) : <MoneyMetric metric={moment.causalCost} />}</span>
    </button></li>}
    {activity && <li><button type="button" onClick={() => onOpen({ target: { kind: "activity", activityTypeKey: activity.activityTypeKey }, label: activity.label })}>
      <ChartNoAxesColumn size={16} aria-hidden /><span><small>Activité du mois</small><strong title={activity.label}>{activity.label}</strong></span>
      <span>{metricValue(activity.cost) === undefined ? formatCount(activity.occurrences, "fois", "fois") : <MoneyMetric metric={activity.cost} />}</span>
    </button></li>}
    {place && <li><button type="button" onClick={() => onOpen({ target: { kind: "place", placeId: place.placeId }, label: place.label })}>
      <MapPin size={16} aria-hidden /><span><small>Lieu fréquenté</small><strong title={place.label}>{place.label}</strong></span>
      <span>{formatCount(place.presenceDays, "jour")}</span>
    </button></li>}
    {!moment && !activity && !place && <li className={styles.note}>Aucune activité, aucun moment ni lieu renseigné.</li>}
    </ul>}
  </>;
}
