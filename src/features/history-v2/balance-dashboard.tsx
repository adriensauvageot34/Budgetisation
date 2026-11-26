"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChartNoAxesColumn, ChevronDown, Landmark, MapPin, SlidersHorizontal, Sparkles, Wallet, X } from "lucide-react";
import type { YearMonth } from "@/core/time";
import type { MetricValue } from "@/core/history-v2";
import type { Money } from "@/core/money";
import type { MonthBalanceSummaryReadModel, MonthCategoriesReadModel, MonthLifeMoneyReadModel, MonthSpendingNatureReadModel } from "@/query-api";
import { BalanceDetail, type BalanceTarget, type DetailSelection, type OpenDetail } from "./balance-dashboard-details";
import { AmountBar, chartMaximum, metricValue, stateValue, visibleValue } from "./balance-dashboard-widgets";
import { CategoryRing, MonthTimeline, SpendingComparison, categoryColors } from "./balance-dashboard-charts";
import { formatCount, formatFrenchDateRange } from "./presentation";
import { publicationMetasAreCoherent } from "./publication-coherence";
import { MoneyMetric, formatMoney } from "./renderers";
import { overlayTargetKey } from "./route-state";
import type { HistoryOverlayTarget, HistoryV2InitialState } from "./types";
import { useHistoryPageState } from "./use-history-page-state";
import styles from "./balance-dashboard.module.css";

const baseDetailLabels = {
  summary: "Le mois face à vos habitudes",
  categories: "Dépenses par catégorie",
  spending: "Répartition des dépenses",
  life: "Vie et argent",
} as const;

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
    case "summary":
    case "categories":
    case "spending":
    case "minimal":
    case "life":
      return target.kind;
    default:
      return overlayTargetKey(target);
  }
}

function panelFor(target?: BalanceTarget) {
  switch (target?.kind) {
    case "summary":
    case "bridge":
    case "minimal":
      return "summary";
    case "categories":
    case "category":
      return "categories";
    case "spending":
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
  const initialPanel = panelFor(initialDetail);
  const initialLane = initialPanel === "summary" || initialPanel === "categories" ? "top" : "bottom";
  const [openLane, setOpenLane] = useState<"top" | "bottom" | null>(initialDetail ? initialLane : null);
  const [stacks, setStacks] = useState<Readonly<Record<"top" | "bottom", readonly DetailSelection[]>>>(() => {
    const initial = initialDetail ? [{ label: linkedDetailLabels[initialDetail.kind], target: initialDetail }] : [];
    return { top: initialLane === "top" ? initial : [], bottom: initialLane === "bottom" ? initial : [] };
  });
  const detailId = useId();
  const detailHeaders = useRef<Partial<Record<"top" | "bottom", HTMLHeadingElement>>>({});
  const opener = useRef<HTMLElement | null>(null);
  const activePanel = panelFor(openLane === null ? undefined : stacks[openLane].at(-1)?.target);
  if (state.kind !== "balance") return null;

  const summary = stateValue(state.summary);
  const categories = stateValue(state.categories);
  const spending = stateValue(state.spendingNature);
  const life = stateValue(state.lifeMoney);
  const publications = [summary, categories, spending, life].flatMap(model => model ? [model.publicationMeta] : []);
  if (publications.length && !publicationMetasAreCoherent(publications)) {
    return <p role="alert" className={styles.unavailable}>Le bilan rassemble des versions de données différentes. Actualise la page pour le consulter.</p>;
  }

  function close() {
    setOpenLane(null);
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  }

  function focusDetail(lane: "top" | "bottom") {
    requestAnimationFrame(() => detailHeaders.current[lane]?.focus({ preventScroll: true }));
  }

  function togglePanel(selection: DetailSelection) {
    const panel = panelFor(selection.target);
    const lane = panel === "summary" || panel === "categories" ? "top" : "bottom";
    const current = stacks[lane].at(-1);
    if (openLane === lane && current && detailKey(current.target) === detailKey(selection.target)) {
      close();
      return;
    }
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    setStacks(views => ({ ...views, [lane]: [selection] }));
    setOpenLane(lane);
    focusDetail(lane);
  }

  function renderDetail(lane: "top" | "bottom") {
    const stack = stacks[lane];
    const current = stack.at(-1);
    const panel = panelFor(current?.target);
    const open = openLane === lane;
    return <div className={styles.disclosure} data-open={open} data-anchor={panel} inert={!open} aria-hidden={!open}
      id={`${detailId}-${lane}`}>
      <div className={styles.disclosureClip}>
        {current && <section className={styles.detail} aria-labelledby={`${detailId}-${lane}-title`}>
          <div className={styles.detailHeader}>
            {stack.length > 1 && <button type="button" aria-label="Revenir au détail précédent" onClick={() => {
              setStacks(views => ({ ...views, [lane]: views[lane].slice(0, -1) }));
              focusDetail(lane);
            }}><ArrowLeft aria-hidden size={17} /></button>}
            <h2 id={`${detailId}-${lane}-title`} ref={node => {
              if (node) detailHeaders.current[lane] = node;
              else delete detailHeaders.current[lane];
            }} tabIndex={-1}>{current.label}</h2>
            <button type="button" className={styles.close} aria-label="Replier le détail" onClick={close}><X aria-hidden size={18} /></button>
          </div>
          <BalanceDetail key={detailKey(current.target)} selection={current} month={month}
            summary={summary} categories={categories} spending={spending} life={life}
            subcategoryLabels={subcategoryLabels} onOpen={selection => {
              setStacks(views => ({ ...views, [lane]: [...views[lane], selection] }));
              focusDetail(lane);
            }} />
        </section>}
      </div>
    </div>;
  }

  const topId = `${detailId}-top`;
  const bottomId = `${detailId}-bottom`;
  const activeTarget = openLane === null ? undefined : stacks[openLane].at(-1)?.target;
  return <div className={styles.dashboard} data-detail-open={openLane !== null}
    data-detail-deep={openLane !== null && stacks[openLane].length > 1} onKeyDown={event => {
    if (event.key === "Escape" && openLane !== null) {
      event.preventDefault();
      close();
    }
  }}>
    <header className={styles.pageHeader}>
      <h1>Bilan du mois</h1>
      <span>{monthName}</span>
    </header>

    <div className={styles.pair}>
      <Panel kind="summary" title="Dépenses du mois" icon={<Wallet size={19} aria-hidden />} selected={activePanel === "summary"} collapsed={activePanel !== undefined && activePanel !== "summary"}
        detailId={topId} onOpen={() => activePanel === "summary" ? close() : togglePanel({ target: { kind: "summary" }, label: baseDetailLabels.summary })}>
        {summary ? <SummaryCard model={summary} onOpen={togglePanel} /> : <DataStatus failed={state.summary.status === "error"} />}
      </Panel>

      <Panel kind="categories" title="Dépenses par catégorie" icon={<ChartNoAxesColumn size={19} aria-hidden />} selected={activePanel === "categories"} collapsed={activePanel !== undefined && activePanel !== "categories"}
        detailId={topId} onOpen={() => activePanel === "categories" ? close() : togglePanel({ target: { kind: "categories" }, label: baseDetailLabels.categories })}>
        {categories ? <CategoryCard model={categories} total={metricValue(visibleValue(summary?.actualValue))}
          activeId={activeTarget?.kind === "category" ? activeTarget.categoryId : undefined}
          onOpen={togglePanel} detailId={topId} /> : <DataStatus failed={state.categories.status === "error"} />}
      </Panel>
      {renderDetail("top")}
    </div>

    <div className={styles.pair}>
      <Panel kind="spending" title="Marges du mois" icon={<SlidersHorizontal size={19} aria-hidden />} selected={activePanel === "spending"} collapsed={activePanel !== undefined && activePanel !== "spending"}
        detailId={bottomId} onOpen={() => activePanel === "spending" ? close() : togglePanel({ target: { kind: "spending" }, label: baseDetailLabels.spending })}>
        {spending ? <MarginCard model={spending} /> : <DataStatus failed={state.spendingNature.status === "error"} />}
      </Panel>

      <Panel kind="life" title="Vie et argent" icon={<Sparkles size={19} aria-hidden />} selected={activePanel === "life"} collapsed={activePanel !== undefined && activePanel !== "life"}
        detailId={bottomId} onOpen={() => activePanel === "life" ? close() : togglePanel({ target: { kind: "life" }, label: baseDetailLabels.life })}>
        {life ? <LifeCard model={life} month={month} activeId={activeTarget?.kind === "moment" ? activeTarget.momentId : undefined} onOpen={togglePanel} /> : <DataStatus failed={state.lifeMoney.status === "error"} />}
      </Panel>
      {renderDetail("bottom")}
    </div>
  </div>;
}

function Panel({ kind, title, icon, selected, collapsed, onOpen, detailId, children }: {
  readonly kind: string;
  readonly title: string;
  readonly icon: ReactNode;
  readonly selected: boolean;
  readonly collapsed: boolean;
  readonly onOpen: () => void;
  readonly detailId: string;
  readonly children: ReactNode;
}) {
  return <section className={styles.panel} data-panel={kind} data-selected={selected} data-collapsed={collapsed}>
    <h2><button type="button" className={styles.panelHeading} onClick={onOpen} aria-controls={detailId} aria-expanded={selected}>
      <span className={styles.panelIcon}>{icon}</span><span>{title}</span>
      <ChevronDown className={styles.chevron} size={16} aria-hidden />
    </button></h2>
    <div className={styles.panelSummary} aria-hidden={collapsed} inert={collapsed}>
      <div className={styles.panelSummaryClip}><div className={styles.panelBody}>{children}</div></div>
    </div>
  </section>;
}

function DataStatus({ failed }: { readonly failed: boolean }) {
  return <p role="status" className={styles.note}>{failed ? "Données indisponibles pour ce mois." : "Chargement…"}</p>;
}

function SummaryCard({ model, onOpen }: { readonly model: MonthBalanceSummaryReadModel; readonly onOpen: OpenDetail }) {
  const actual = visibleValue(model.actualValue);
  const typical = visibleValue(model.typicalValue);
  const comparison = metricValue(visibleValue(model.actualVsTypical));
  const delta = comparison?.delta;
  const direction = delta === undefined ? undefined : Math.sign(Number(delta));
  const zone = metricValue(visibleValue(model.usualZone));
  return <>
    <div className={styles.spentHeader}>
      {actual ? <MoneyMetric metric={actual} className={styles.bigAmount} /> : <strong>Dépenses à confirmer</strong>}
      {delta !== undefined && <span className={styles.delta} data-direction={direction}>
        {direction === -1 ? <ArrowDownRight size={15} aria-hidden /> : direction === 1 ? <ArrowUpRight size={15} aria-hidden /> : null}
        {direction === 0 ? "Au niveau habituel" : `${formatMoney((Number(delta) < 0 ? delta.slice(1) : delta) as typeof delta)} ${direction === -1 ? "sous" : "au-dessus de"} l’habitude`}
      </span>}
    </div>
    <SpendingComparison actual={metricValue(actual)} typical={metricValue(typical)} range={zone} />
    <div className={styles.panelFoot}>
      {zone && <span className={styles.zone}>Fourchette habituelle <strong>{formatMoney(zone.lowerBound)} – {formatMoney(zone.upperBound)}</strong></span>}
      <button type="button" className={styles.textButton} onClick={() => onOpen({ target: { kind: "bridge" }, label: "Écart avec mon compte" })}>
        <Landmark size={14} aria-hidden /> Écart avec mon compte
      </button>
    </div>
  </>;
}

function CategoryCard({ model, total, activeId, onOpen, detailId }: {
  readonly model: MonthCategoriesReadModel;
  readonly total?: Money;
  readonly activeId?: string;
  readonly onOpen: OpenDetail;
  readonly detailId: string;
}) {
  const collection = visibleValue(model.categories);
  const items = collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : [];
  const rows = items.slice(0, 4).map(item => ({
    id: item.categoryId, label: item.label, amount: item.actual, share: metricValue(item.shareOfActual),
  }));
  const maximum = chartMaximum(rows);
  const other = visibleValue(model.otherAmount);
  return <>
    {!rows.length && <p className={styles.note}>Aucun poste détaillé pour ce mois.</p>}
    {rows.length > 0 && <div className={styles.categoryChart}>
      {Number(total) > 0 && <CategoryRing shares={rows.map(row => {
        const amount = metricValue(row.amount);
        return amount === undefined ? undefined : Number(amount) / Number(total);
      })} />}
      <ul className={styles.categoryPlot}>
        {rows.map((row, index) => <li key={row.id}>
          <button type="button" onClick={() => onOpen({ target: { kind: "category", categoryId: row.id }, label: row.label })}
            aria-controls={detailId} aria-expanded={activeId === row.id}>
            <i style={{ backgroundColor: categoryColors[index] }} aria-hidden />
            <AmountBar row={row} maximum={maximum} /><ChevronDown size={14} aria-hidden />
          </button>
        </li>)}
      </ul>
    </div>}
    <div className={styles.panelFoot}>
      {other && Number(metricValue(other) ?? 0) !== 0 && <span className={styles.zone}>Autres catégories <strong><MoneyMetric metric={other} /></strong></span>}
      {items.length > rows.length && <button type="button" className={styles.textButton} onClick={() => onOpen({ target: { kind: "categories" }, label: baseDetailLabels.categories })}>
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

function LifeCard({ model, month, activeId, onOpen }: {
  readonly model: MonthLifeMoneyReadModel;
  readonly month: YearMonth;
  readonly activeId?: string;
  readonly onOpen: OpenDetail;
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
    <ul className={styles.lifeRows}>
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
    </ul>
  </>;
}
