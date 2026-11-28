"use client";

import { createContext, Suspense, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChevronDown, Landmark, X } from "lucide-react";
import { useLayoutMotion } from "@/components/layout/use-layout-motion";
import { replaceViewSearch } from "@/components/layout/view-search";
import { startDetailTiming } from "@/components/layout/detail-timing";
import { focusCategoryRankingRow, useCategoryRankingScroll } from "@/components/layout/category-ranking";
import { prepareHistoryDetail } from "@/components/runtime/query-client";
import { parseLocalDate, type LocalDate } from "@/core/time";
import { queryResourceKeys } from "@/query-api";
import { ClayIcon, type ClayIconName } from "@/components/layout/clay-icon";
import type { YearMonth } from "@/core/time";
import type { MetricValue } from "@/core/history-v2";
import type { Money } from "@/core/money";
import type { HistorySpendingSegmentDetailParams, MonthBalanceSummaryReadModel, MonthCategoriesReadModel, MonthLifeMoneyReadModel, MonthQuickOverviewReadModel, MonthSpendingNatureReadModel } from "@/query-api";
import { BalanceDetail, type BalanceTarget, type DetailSelection, type OpenDetail } from "./balance-dashboard-details";
import { AmountBar, AmountBars, BalanceCollections, BalancePurchaseReturn, DetailRows, chartMaximum, formatDelta, metricValue, moneyAmount, stateValue, visibleValue } from "./balance-dashboard-widgets";
import { DailySpendingTrend, MonthTimeline, SpendingComparison, categoryColors } from "./balance-dashboard-charts";
import { formatCount, formatFrenchDateRange, formatHistoricalRank, spendingPresentationLabel } from "./presentation";
import { BalanceAtom, BalanceLayout, useBalanceDensity } from "./balance-density";
import { publicationMetasAreCoherent } from "./publication-coherence";
import { MoneyMetric, formatMoney } from "./renderers";
import { historyV2Href, overlayTargetKey, parseHistoryOverlaySearch } from "./route-state";
import type { BalanceDailySeries, HistoryOverlayTarget, HistoryV2InitialState } from "./types";
import { useHistoryPageState } from "./use-history-page-state";
import styles from "./balance-dashboard.module.css";

type PanelKind = "summary" | "categories" | "spending" | "life";
type Placement = "distribution";
const emptyLinks: ReadonlySet<string> = new Set();

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
  return target.kind === "minimal" ? "minimal" : overlayTargetKey(target);
}

function panelFor(selection?: DetailSelection): PanelKind | undefined {
  if (selection?.placement === "distribution") return "categories";
  switch (selection?.target.kind) {
    case "bridge":
    case "journal":
    case "minimal": return "summary";
    case "category": return "categories";
    case "segment": return "spending";
    case undefined: return undefined;
    default: return "life";
  }
}

const BalanceInteraction = createContext<{
  readonly root?: DetailSelection;
  readonly revision: number;
  readonly isActive: (target: BalanceTarget, placement?: Placement) => boolean;
  readonly onOpen: OpenDetail;
  readonly onLayout: (update: () => void) => void;
  readonly prepare: (target?: BalanceTarget) => void;
  readonly reset: () => void;
  readonly detail: ReactNode;
  readonly linkedMoments: ReadonlySet<string>;
  readonly contributors: ReadonlySet<string>;
}>({ revision: 0, isActive: () => false, onOpen: () => {}, onLayout: update => update(), prepare: () => {}, reset: () => {}, detail: null, linkedMoments: emptyLinks, contributors: emptyLinks });

function DetailSlot({ kind, target, placement }: {
  readonly kind?: BalanceTarget["kind"];
  readonly target?: BalanceTarget;
  readonly placement?: Placement;
}) {
  const { root, isActive, detail } = useContext(BalanceInteraction);
  if (root?.placement !== placement) return null;
  return (target ? isActive(target, placement) : root?.target.kind === kind) ? detail : null;
}

export function ComposerBalanceDashboard({ month, initialState, initialDetail, subcategoryLabels, categoryBySubcategory, dailySeries, includeFixed }: {
  readonly month: YearMonth;
  readonly initialState: Extract<HistoryV2InitialState, { kind: "balance" }>;
  readonly initialDetail?: HistoryOverlayTarget;
  readonly subcategoryLabels: Readonly<Record<string, string>>;
  readonly categoryBySubcategory: Readonly<Record<string, string>>;
  readonly dailySeries: Promise<BalanceDailySeries | null>;
  readonly includeFixed?: boolean;
}) {
  const state = useHistoryPageState(month, initialState);
  const { revision, changeLayout } = useLayoutMotion("balance-layout");
  const [stack, setStack] = useState<readonly DetailSelection[]>(() =>
    initialDetail ? [{ target: initialDetail, label: linkedDetailLabels[initialDetail.kind] }] : []);
  const id = useId();
  const opener = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef<PanelKind | undefined>(undefined);
  const restoreCategory = useRef<string>(undefined);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const dashboard = useRef<HTMLDivElement>(null);
  const returnPurchase = useRef<string>(undefined);
  const returnNested = useRef<string>(undefined);
  const restored = useRef(false);
  const timing = useRef<ReturnType<typeof startDetailTiming>>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [journalLinks, setJournalLinks] = useState<{ date: LocalDate; momentIds: ReadonlySet<string> }>();
  const [segmentLinks, setSegmentLinks] = useState<{ key: string; categoryIds: ReadonlySet<string> }>();
  const root = stack[0];
  const current = stack.at(-1);
  const origin = panelFor(root);
  const linkedMoments = root?.target.kind === "journal" && root.target.date === journalLinks?.date ? journalLinks.momentIds : emptyLinks;
  const contributors = root?.anchor === "margin" && segmentLinks?.key === detailKey(root.target) ? segmentLinks.categoryIds : emptyLinks;
  const onJournalLinks = useCallback((date: LocalDate, momentIds: readonly string[]) => setJournalLinks({ date, momentIds: new Set(momentIds) }), []);
  const onContributors = useCallback((key: string, categoryIds: readonly string[]) => setSegmentLinks({ key, categoryIds: new Set(categoryIds) }), []);
  const onDetailReady = useCallback(() => {
    timing.current?.visible("content");
    requestAnimationFrame(() => {
      const purchase = returnPurchase.current;
      const nested = returnNested.current;
      if (!purchase && !nested) return;
      returnPurchase.current = undefined;
      returnNested.current = undefined;
      const selector = purchase ? "[data-balance-purchase]" : "[data-balance-trigger]";
      const source = Array.from(dashboard.current?.querySelectorAll<HTMLElement>(selector) ?? [])
        .find(element => purchase ? element.dataset.balancePurchase === purchase : element.dataset.balanceTrigger === nested);
      (source ?? detailTitle.current)?.focus({ preventScroll: true });
    });
  }, []);
  const rememberPurchase = useCallback((purchase: string) => replaceViewSearch({ achat: purchase }), []);

  useLayoutEffect(() => () => {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    timing.current?.cancel();
  }, []);

  useLayoutEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const search = Object.fromEntries(new URLSearchParams(window.location.search));
      returnPurchase.current = search.achat;
      const target = parseHistoryOverlaySearch(search);
      const parent = search.origine ? parseHistoryOverlaySearch(Object.fromEntries(new URLSearchParams(search.origine))) : undefined;
      if (target && (parent || !current || detailKey(target) !== detailKey(current.target))) {
        setStack([...(parent ? [{ target: parent, label: linkedDetailLabels[parent.kind] }] : []), { target, label: linkedDetailLabels[target.kind] }]);
        return;
      }
    }
    const url = new URL(historyV2Href({
      month, view: "balance", surface: "composer",
      overlay: current?.target.kind === "minimal" ? undefined : current?.target,
    }), window.location.origin);
    const parent = stack.length > 1 && root && root.target.kind !== "minimal" ? new URL(historyV2Href({ month, view: "balance", surface: "composer", overlay: root.target }), window.location.origin).searchParams : undefined;
    parent?.delete("month");
    replaceViewSearch({ ...Object.fromEntries(["journal", "entity", "entityId", "axis", "bucket", "necessity", "behavior"]
      .map(key => [key, url.searchParams.get(key) ?? undefined])), origine: parent?.toString() });
    if (current) {
      timing.current?.visible("structure");
      const heading = detailTitle.current;
      if (!returnPurchase.current && !returnNested.current && !heading?.parentElement?.contains(document.activeElement)) heading?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      const source = opener.current;
      const category = restoreCategory.current;
      if (!category || !focusCategoryRankingRow(dashboard.current, category)) {
        const target = source?.isConnected && source.getClientRects().length > 0 ? source : document.getElementById(id + "-" + restoreFocus.current + "-heading");
        target?.focus({ preventScroll: true });
      }
      restoreFocus.current = undefined;
      restoreCategory.current = undefined;
    }
  }, [current, id, month, root, stack.length]);

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

  function reset() {
    timing.current?.cancel();
    replaceViewSearch({ achat: undefined });
    returnPurchase.current = undefined;
    returnNested.current = undefined;
    restoreFocus.current = origin;
    restoreCategory.current = root?.target.kind === "category" ? root.target.categoryId : undefined;
    setStack([]);
  }

  function closeDetail() {
    changeLayout(reset);
  }

  function previousDetail() {
    if (stack.length <= 1) closeDetail();
    else changeLayout(() => {
      returnNested.current = current && detailKey(current.target);
      replaceViewSearch({ achat: undefined });
      setStack(items => items.slice(0, -1));
    });
  }

  function isActive(target: BalanceTarget, placement?: Placement) {
    return root?.placement === placement && !!root && detailKey(root.target) === detailKey(target);
  }

  function showDetail(selection: DetailSelection) {
    if (isActive(selection.target, selection.placement) && (root?.anchor === selection.anchor || selection.target.kind === "moment")) {
      closeDetail();
      return;
    }
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    timing.current?.cancel();
    timing.current = startDetailTiming("bilan");
    replaceViewSearch({ achat: undefined });
    returnPurchase.current = undefined;
    returnNested.current = undefined;
    changeLayout(() => setStack([selection]));
  }

  function prepare(target?: BalanceTarget) {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    if (target?.kind !== "journal" && target?.kind !== "category") return;
    const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
    previewTimer.current = setTimeout(() => {
      const request = target.kind === "journal"
        ? prepareHistoryDetail({ resource: queryResourceKeys.historyDayJournal, scope, params: { date: target.date } })
        : prepareHistoryDetail({ resource: queryResourceKeys.historyCategoryDetail, scope, params: { categoryId: target.categoryId } });
      void request.catch(() => undefined);
    }, 180);
  }

  const detailId = id + "-detail";
  const detail = current && <section className={styles.inlineDetail} id={detailId} data-detail-kind={current.target.kind} aria-labelledby={detailId + "-title"}>
    <div className={styles.detailHeader}>
      {stack.length > 1 && <button type="button" aria-label="Revenir au détail précédent"
        onClick={previousDetail}><ArrowLeft aria-hidden size={16} /></button>}
      <h3 id={detailId + "-title"} ref={detailTitle} tabIndex={-1}>{current.label}</h3>
      <button type="button" aria-label="Fermer le détail" className={styles.close} onClick={closeDetail}><X aria-hidden size={17} /></button>
    </div>
    <BalanceDetail key={detailKey(current.target)} selection={current} month={month} subcategoryLabels={subcategoryLabels} categoryBySubcategory={categoryBySubcategory} onReady={onDetailReady}
      onJournalLinks={onJournalLinks} onContributors={onContributors} contributorKey={detailKey(current.target)}
      onOpen={selection => {
        timing.current?.cancel();
        timing.current = startDetailTiming("bilan");
        changeLayout(() => setStack(items => [...items, selection]));
      }} />
  </section>;
  const size = root?.target.kind === "journal" || root?.target.kind === "place" || root?.target.kind === "segment" ? "compact" : "large";

  return <BalanceLayout.Provider value={changeLayout}><BalanceInteraction.Provider value={{ root, revision, isActive, onOpen: showDetail, onLayout: changeLayout, prepare, reset, detail, linkedMoments, contributors }}>
    <BalancePurchaseReturn.Provider value={rememberPurchase}>
    <div ref={dashboard} className={styles.dashboard} data-month-balance data-focus={origin} data-detail-size={origin ? size : undefined}
      onKeyDown={event => {
        if (event.key !== "Escape" || !current) return;
        event.preventDefault();
        previousDetail();
      }}>
      <div className={styles.panelGrid}>
        <div className={styles.column} data-side="left">
          <BalanceRegion kind="summary" headingId={id + "-summary-heading"} title="Dépenses du mois" icon="expenses">
            {summary ? <SummaryCard model={summary} dailySeries={dailySeries} overview={overview} onOpen={showDetail} includeFixed={includeFixed}
              onPreview={date => prepare(date ? { kind: "journal", date: parseLocalDate(date) } : undefined)} />
              : <DataStatus failed={state.summary.status === "error"} />}
          </BalanceRegion>
          <BalanceRegion kind="spending" headingId={id + "-spending-heading"} title="Marges du mois" icon="overview">
            {spending ? <MarginCard model={spending} /> : <DataStatus failed={state.spendingNature.status === "error"} />}
          </BalanceRegion>
        </div>
        <div className={styles.column} data-side="right">
          <BalanceRegion kind="categories" headingId={id + "-categories-heading"} title="Répartition des dépenses" icon="categories">
            <CategoryCard model={categories} spending={spending} failed={state.categories.status === "error"} />
          </BalanceRegion>
          <BalanceRegion kind="life" headingId={id + "-life-heading"} title="Vie et argent" icon="events">
            {life ? <LifeCard model={life} month={month} /> : <DataStatus failed={state.lifeMoney.status === "error"} />}
          </BalanceRegion>
        </div>
      </div>
    </div>
  </BalancePurchaseReturn.Provider></BalanceInteraction.Provider></BalanceLayout.Provider>;
}

function BalanceRegion({ kind, title, icon, headingId, children }: {
  readonly kind: PanelKind;
  readonly title: string;
  readonly icon: ClayIconName;
  readonly headingId: string;
  readonly children: ReactNode;
}) {
  const { revision, root } = useContext(BalanceInteraction);
  const fitToContent = kind === "summary" || (kind === "categories" && root?.target.kind === "category");
  const { region, flow } = useBalanceDensity(".inline-balance-data", revision, fitToContent);
  return <section ref={region} className={styles.panel} data-panel={kind} aria-labelledby={headingId}>
    <div ref={flow} className={styles.panelBody}>
      <BalanceAtom name="heading" priority={120} minimum={1}>
        <h2 id={headingId} className={styles.headingRow} tabIndex={-1}>
          <ClayIcon name={icon} size={34} className={styles.clayHeading} /><span>{title}</span>
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
function SummaryCard({ model, onOpen, dailySeries, overview, onPreview, includeFixed }: {
  readonly model: MonthBalanceSummaryReadModel;
  readonly onOpen: OpenDetail;
  readonly dailySeries: Promise<BalanceDailySeries | null>;
  readonly includeFixed?: boolean;
  readonly overview?: MonthQuickOverviewReadModel;
  readonly onPreview: (date?: string) => void;
}) {
  const { root, isActive, linkedMoments } = useContext(BalanceInteraction);
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
    <BalanceAtom name="total" priority={100} minimum={1}>
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
    <BalanceAtom name="days" priority={89} minimum={root?.target.kind === "journal" ? 1 : 0}>
      <Suspense fallback={<div className={styles.dailyPlaceholder} role="status"><h3>Dépenses par jour</h3><span className="sr-only">Chargement du graphique…</span></div>}>
        <DailySpendingTrend series={dailySeries} reference={model.publicationMeta} activeDate={root?.target.kind === "journal" ? root.target.date : undefined} linked={linkedMoments.size > 0} includeFixed={includeFixed} onPreview={onPreview} onInspect={(date, label) =>
          onOpen({ target: { kind: "journal", date }, label })} />
      </Suspense>
      <DetailSlot kind="journal" />
    </BalanceAtom>
    <BalanceAtom name="bank" priority={65} minimum={root?.target.kind === "bridge" ? 1 : 0}>
      <div className={styles.panelFoot}>
        <button type="button" className={styles.textButton} aria-expanded={isActive({ kind: "bridge" })} onClick={() => onOpen({ target: { kind: "bridge" }, label: "Écart avec mon compte" })}>
          <Landmark size={14} aria-hidden /> Écart avec mon compte
        </button>
        {rank?.presentation === "RANKED" && <span className={styles.zone}>{formatHistoricalRank(rank.rank, rank.universeCount)}</span>}
      </div>
      {(metricValue(bankInflows) !== undefined || metricValue(bankOutflows) !== undefined) && <dl className={styles.bankFlows}>
        {bankInflows && metricValue(bankInflows) !== undefined && <div><dt>Crédits bancaires</dt><dd><MoneyMetric metric={bankInflows} /></dd></div>}
        {bankOutflows && metricValue(bankOutflows) !== undefined && <div><dt>Débits bancaires</dt><dd><MoneyMetric metric={bankOutflows} /></dd></div>}
      </dl>}
      <DetailSlot kind="bridge" />
    </BalanceAtom>
    {minimum !== undefined && <BalanceAtom name="minimum" priority={44} minimum={root?.target.kind === "minimal" ? 1 : 0}>
      <button type="button" className={styles.textButton} aria-expanded={isActive({ kind: "minimal" })} onClick={() => onOpen({ target: { kind: "minimal" }, label: "Minimum estimé" })}>
        Minimum estimé <strong>{formatMoney(minimum)}</strong>
      </button>
      <DetailSlot kind="minimal" />
    </BalanceAtom>}
    {model.importedSummary.text && <BalanceAtom name="editorial" priority={27}>
      <p className={styles.longNote} title={model.importedSummary.text}>{model.importedSummary.text}</p>
    </BalanceAtom>}
  </>;
}


const distributionModes = {
  categories: "Catégories",
  behavior: "Fixes et variables",
  necessity: "Degré de nécessité",
  lifeScope: "Quotidien et hors quotidien",
} as const;
type DistributionMode = keyof typeof distributionModes;

function CategoryCard({ model, spending, failed }: {
  readonly model?: MonthCategoriesReadModel;
  readonly spending?: MonthSpendingNatureReadModel;
  readonly failed: boolean;
}) {
  const { root, isActive, onOpen, onLayout, prepare, reset, contributors } = useContext(BalanceInteraction);
  const [mode, setMode] = useState<DistributionMode>("categories");
  const collection = visibleValue(model?.categories);
  const categories = collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : [];
  const axis = mode === "categories" ? undefined : visibleValue(spending?.[mode]);
  const rows = (mode === "categories" ? categories.map(item => ({
    id: item.categoryId, label: item.label, amount: item.actual, share: metricValue(item.shareOfActual),
    target: { kind: "category", categoryId: item.categoryId } as const,
  })) : (metricValue(axis?.result) ?? []).map(bucket => ({
    id: bucket.key, label: spendingPresentationLabel(bucket.key), amount: moneyAmount(bucket.amount), share: bucket.shareOfActual,
    target: { kind: "segment", params: { axis: mode, bucket: bucket.key } } as const,
  }))).toSorted((a, b) => Number(metricValue(b.amount) ?? 0) - Number(metricValue(a.amount) ?? 0));
  const segments = mode !== "categories" && spending && "segments" in spending ? visibleValue(spending.segments) : undefined;
  const segmentPreviews = segments?.status === "KNOWN" || segments?.status === "PARTIAL" ? segments.items.flatMap(item => {
    if (item.segment.axis !== mode || !item.segment.bucket) return [];
    const contributors = visibleValue(item.contributors);
    if (contributors?.status !== "KNOWN" && contributors?.status !== "PARTIAL") return [];
    return contributors.items.length ? [{
      key: item.segment.bucket,
      label: spendingPresentationLabel(item.segment.bucket),
      rows: contributors.items.slice(0, 3).map(row => ({
        id: row.contributorId, label: row.label, amount: moneyAmount(row.amount),
      })),
    }] : [];
  }) : [];
  const placement = mode === "categories" ? undefined : "distribution";
  const expanded = rows.some(row => isActive(row.target, placement));
  const selectedIndex = mode === "categories" ? rows.findIndex(row => isActive(row.target)) : -1;
  const selected = selectedIndex === -1 ? undefined : rows[selectedIndex];
  const selectedId = selected?.id;
  const rankingScroll = useCategoryRankingScroll(selectedId, mode);
  const maximum = chartMaximum(rows);
  const previewMaximum = chartMaximum(segmentPreviews.flatMap(preview => preview.rows));
  const deviations = categories.flatMap(row => {
    const delta = metricValue(row.delta);
    return delta === undefined || Number(delta) === 0 ? [] : [{ id: row.categoryId, label: row.label, delta }];
  }).toSorted((a, b) => Math.abs(Number(b.delta)) - Math.abs(Number(a.delta))).slice(0, 3);
  const maximumDeviation = Math.max(1, ...deviations.map(row => Math.abs(Number(row.delta))));
  const other = mode === "categories" ? visibleValue(model?.otherAmount) : undefined;
  const unclassified = mode === "categories" ? visibleValue(model?.unclassifiedAmount)
    : axis ? moneyAmount(axis.unclassifiedAmount) : undefined;
  const marginLabel = root?.anchor === "margin" ? root.label : undefined;
  const contributingCategories = marginLabel ? categories.filter(category => contributors.has(category.categoryId)) : [];

  function categoryRow(row: (typeof rows)[number], index: number, active = false) {
    const contributes = contributors.has(row.id);
    return <li key={row.id} data-expanded={active || undefined} data-contributor={contributes || undefined}
      style={{ "--category-color": categoryColors[index % categoryColors.length] } as CSSProperties}>
      <button type="button" data-category-trigger={row.id} aria-label={contributes ? `${row.label} · contribue à ${marginLabel?.toLocaleLowerCase("fr-FR")}` : undefined}
        onFocus={() => prepare(row.target)} onBlur={() => prepare()}
        onPointerEnter={event => { if (event.pointerType === "mouse") prepare(row.target); }} onPointerLeave={() => prepare()}
        onClick={() => onOpen({ target: row.target, label: row.label, placement })} aria-expanded={active}>
        <i aria-hidden /><AmountBar row={row} maximum={maximum} /><ChevronDown size={14} aria-hidden />
      </button>
      {active && <DetailSlot target={row.target} placement={placement} />}
    </li>;
  }

  return <>
    <BalanceAtom name="distributionModes" priority={105} minimum={1}>
      <div className={styles.distributionModes} role="group" aria-label="Mode de répartition"
        data-distribution-mode={mode} data-has-previews={segmentPreviews.length > 0}>
        {(Object.keys(distributionModes) as DistributionMode[]).map(value => <button key={value} type="button"
          aria-pressed={value === mode} onClick={() => {
            if (value === mode) return;
            onLayout(() => {
              if (root?.target.kind === "category" || root?.placement === "distribution") reset();
              setMode(value);
            });
          }}>{distributionModes[value]}</button>)}
      </div>
    </BalanceAtom>
    {marginLabel && contributingCategories.length > 0 && <BalanceAtom name="contributions" priority={96}>
      <p className={styles.contributionIntro}><strong>{marginLabel}</strong> · {contributingCategories.slice(0, 3).map(category => category.label).join(" · ")}
        {contributingCategories.length > 3 && ` · +${contributingCategories.length - 3}`}</p>
    </BalanceAtom>}
    {rows.length === 0 ? (mode === "categories" && !model ? <DataStatus failed={failed} />
      : <BalanceAtom name="status" priority={95}><p className={styles.note}>Aucun montant détaillé pour cette répartition.</p></BalanceAtom>) :
      mode === "categories" ? <>
        {selected && <BalanceAtom name="selectedCategory" priority={115} minimum={1}>
          <ul className={`${styles.categoryPlot} ${styles.categoryPinned}`} data-open-category aria-label="Catégorie ouverte">
            {categoryRow(selected, selectedIndex, true)}
          </ul>
        </BalanceAtom>}
        {(!selected || rows.length > 1) && <BalanceAtom name="categories" priority={selected ? 56 : 100} minimum={selected ? 0 : 1}>
          <ul {...rankingScroll} className={styles.categoryPlot} data-category-list data-compact-list={selected ? "" : undefined}
            aria-label={selected ? "Autres catégories" : "Catégories · parts des dépenses du mois"}>
            {rows.map((row, index) => row.id === selectedId ? null : categoryRow(row, index))}
          </ul>
        </BalanceAtom>}
      </> : <BalanceAtom name="distribution" priority={100} minimum={1}>
        <CompositionSegments key={mode} axis={mode} label={distributionModes[mode]} buckets={metricValue(axis?.result) ?? []} coverage={axis?.coverageRatio} unclassified={axis?.unclassifiedAmount} placement="distribution" />
        {expanded && <DetailSlot kind="segment" placement="distribution" />}
      </BalanceAtom>}
    {mode === "categories" && [other, unclassified].some(value => Number(metricValue(value) ?? 0) !== 0) && <BalanceAtom name="coverage" priority={97} minimum={1}>
      <div className={styles.panelFoot}>
        {other && Number(metricValue(other) ?? 0) !== 0 && <span className={styles.zone}>Autres catégories <strong><MoneyMetric metric={other} /></strong></span>}
        {unclassified && Number(metricValue(unclassified) ?? 0) !== 0 && <span className={styles.zone}>Non classé <strong><MoneyMetric metric={unclassified} /></strong></span>}
      </div>
    </BalanceAtom>}
    {mode !== "categories" && !expanded && segmentPreviews.length > 0 && <BalanceAtom name="contributors" priority={75}>
      <section className={styles.distributionPreview}>
        <h3>Principaux postes</h3>
        <div>{segmentPreviews.map(group => <section key={group.key}>
          <h4>{group.label}</h4>
          <AmountBars rows={group.rows} maximum={previewMaximum} />
        </section>)}</div>
      </section>
    </BalanceAtom>}
    {mode === "categories" && !expanded && deviations.length > 0 && <BalanceAtom name="deviations" priority={36}>
      <div className={styles.deviationPreview}>
        <h3>Plus grands écarts à l’habitude</h3>
        <ul className={styles.adjustments}>
          {deviations.map(row => <li key={row.id}>
            <button type="button" className={styles.deviationButton}
              onClick={() => onOpen({ target: { kind: "category", categoryId: row.id }, label: row.label })}>
              <span>{row.label}</span><strong>{formatDelta(row.delta)}</strong>
              <span className={styles.adjustmentTrack} aria-hidden><i data-negative={Number(row.delta) < 0}
                style={{ width: String(Math.abs(Number(row.delta)) / maximumDeviation * 50) + "%" }} /></span>
            </button>
          </li>)}
        </ul>
      </div>
    </BalanceAtom>}
  </>;
}

const spendingAxes = [
  { name: "behavior", priority: 88 },
  { name: "necessity", priority: 77 },
  { name: "lifeScope", priority: 70 },
] as const;
const necessityRows = [
  { key: "CONSTRAINED", label: "Contraintes" },
  { key: "INDISPENSABLE", label: "Essentiel" },
  { key: "OPTIONAL", label: "Optionnel" },
] as const;
const behaviors = ["FIXED", "VARIABLE"] as const;
const necessityColors: Record<string, string> = { CONSTRAINED: "#7650b5", INDISPENSABLE: "#798cc1", OPTIONAL: "#be73a1" };

function SegmentButton({ params, label, selected, children }: {
  readonly params: HistorySpendingSegmentDetailParams;
  readonly label: string;
  readonly selected?: boolean;
  readonly children: ReactNode;
}) {
  const { onOpen, isActive } = useContext(BalanceInteraction);
  const target = { kind: "segment", params } as const;
  return <button type="button" aria-expanded={selected ?? isActive(target)}
    onClick={() => onOpen({ target, label, anchor: "margin" })}>{children}</button>;
}

function CompositionSegments({ axis, label, buckets, coverage, unclassified, placement }: {
  readonly axis: "behavior" | "necessity" | "lifeScope";
  readonly label: string;
  readonly buckets: readonly { readonly key: string; readonly amount: Money; readonly shareOfActual?: number }[];
  readonly coverage?: number;
  readonly unclassified?: Money;
  readonly placement?: Placement;
}) {
  const { isActive, onOpen } = useContext(BalanceInteraction);
  const [hovered, setHovered] = useState<string>();
  const [focused, setFocused] = useState<string>();
  const entries = buckets.map((bucket, index) => {
    const target = { kind: "segment", params: { axis, bucket: bucket.key } } as const;
    return { ...bucket, target, label: spendingPresentationLabel(bucket.key), color: necessityColors[bucket.key] ?? categoryColors[index % categoryColors.length], active: isActive(target, placement) };
  });
  const highlight = hovered ?? focused;
  const hasUnclassified = unclassified !== undefined && Number(unclassified) !== 0;
  const shareOfUnclassified = coverage !== undefined && hasUnclassified ? Math.max(0, 1 - coverage) : 0;

  return <div className={styles.composition} data-composition={axis} data-distribution={placement || undefined} data-budget-reveal={placement || undefined}
    onPointerLeave={() => setHovered(undefined)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(undefined); }}>
    <div className={styles.stack} role="group" aria-label={label}>
      {entries.map(entry => entry.shareOfActual === undefined || entry.shareOfActual <= 0 ? null : <button key={entry.key}
        type="button" tabIndex={-1} aria-label={entry.label} aria-expanded={entry.active} data-highlight={highlight === entry.key}
        style={{ width: `${Math.min(1, entry.shareOfActual) * 100}%`, background: entry.color }}
        onPointerEnter={() => setHovered(entry.key)} onFocus={() => setFocused(entry.key)}
        onClick={() => onOpen({ target: entry.target, label: entry.label, placement })} />)}
      {shareOfUnclassified > 0 && <span className={styles.unclassified} style={{ width: `${shareOfUnclassified * 100}%` }} aria-hidden />}
    </div>
    <div className={styles.legend}>
      {entries.map(entry => <button key={entry.key} type="button" aria-expanded={entry.active} data-highlight={highlight === entry.key}
        onPointerEnter={() => setHovered(entry.key)} onFocus={() => setFocused(entry.key)}
        onClick={() => onOpen({ target: entry.target, label: entry.label, placement })}>
        <i style={{ background: entry.color }} aria-hidden />{entry.label} <strong>{formatMoney(entry.amount)}</strong>
        {entry.shareOfActual !== undefined && <small>{Math.round(entry.shareOfActual * 100)} %</small>}
      </button>)}
      {hasUnclassified && <span className={styles.unclassifiedLabel}><i className={styles.unclassified} aria-hidden />Non classé <strong>{formatMoney(unclassified)}</strong></span>}
    </div>
  </div>;
}

function MarginCard({ model }: { readonly model: MonthSpendingNatureReadModel }) {
  const { root, isActive } = useContext(BalanceInteraction);
  const matrix = visibleValue(model.matrix);
  const immediate = { necessity: "OPTIONAL", behavior: "VARIABLE" } as const;
  const medium = { necessity: "OPTIONAL", behavior: "FIXED" } as const;
  const optionActive = root?.anchor !== "matrix" && (isActive({ kind: "segment", params: immediate }) || isActive({ kind: "segment", params: medium }));
  const marginChoices = [
    { params: immediate, label: "Ajustable maintenant", metric: matrix?.immediateMargin },
    { params: medium, label: "Ajustable à moyen terme", metric: matrix?.mediumMargin },
  ];
  const matrixActive = root?.target.kind === "segment" && !("axis" in root.target.params) && !optionActive && !root.placement;
  const matrixSelection = matrixActive && root?.target.kind === "segment" && !("axis" in root.target.params) ? root.target.params : undefined;
  const matrixMaximum = Math.max(1, ...(matrix?.cells ?? []).map(cell => Math.abs(Number(cell.amount))));

  return <>
    <BalanceAtom name="margins" priority={100} minimum={1}>
      <div className={styles.marginStats}>
        {marginChoices.map(({ params, label, metric }) => <SegmentButton key={label} params={params} label={label} selected={optionActive && isActive({ kind: "segment", params })}>
          <span>{label}</span><MarginAmount metric={metric} />
        </SegmentButton>)}
      </div>
      {optionActive && <DetailSlot kind="segment" />}
    </BalanceAtom>
    {spendingAxes.map(({ name, priority }) => {
      const axis = visibleValue(model[name]);
      const buckets = metricValue(axis?.result);
      if (!buckets?.length) return null;
      const active = root?.placement === undefined && root?.target.kind === "segment" && "axis" in root.target.params && root.target.params.axis === name;
      return <BalanceAtom key={name} name={name} priority={priority} minimum={active ? 1 : 0}>
        <div className={styles.breakdown}>
          <h3>{distributionModes[name]}</h3>
          <CompositionSegments axis={name} label={distributionModes[name]} buckets={buckets} coverage={axis?.coverageRatio} unclassified={axis?.unclassifiedAmount} />
          {active && <DetailSlot kind="segment" />}
        </div>
      </BalanceAtom>;
    })}
    {matrix && matrix.cells.length > 0 && <BalanceAtom name="matrix" priority={68} minimum={matrixActive ? 1 : 0}>
      <section className={styles.matrix} data-column={matrixSelection?.behavior} aria-label="Dépenses fixes et variables par nécessité">
        <header><h3>Nécessité × type de dépense</h3>
          <span data-behavior="FIXED">Fixe</span><span data-behavior="VARIABLE">Variable</span>
        </header>
        <ul>{necessityRows.map(({ key, label }) => <MatrixRow key={key} rowKey={key} label={label}
          cells={matrix.cells} maximum={matrixMaximum}
          rowActive={matrixActive && behaviors.some(behavior => isActive({ kind: "segment", params: { necessity: key, behavior } }))} />)}</ul>
      </section>
    </BalanceAtom>}
  </>;
}

function MatrixRow({ rowKey, label, cells, maximum, rowActive }: {
  readonly rowKey: (typeof necessityRows)[number]["key"];
  readonly label: string;
  readonly cells: readonly { readonly key: string; readonly amount: Money }[];
  readonly maximum: number;
  readonly rowActive: boolean;
}) {
  const { onOpen, isActive } = useContext(BalanceInteraction);
  return <li data-matrix-current={rowActive || undefined}>
    <div className={styles.matrixRow}><strong>{label}</strong>{behaviors.map(behavior => {
      const key = rowKey + "__" + behavior;
      const cell = cells.find(value => value.key === key);
      const target = { kind: "segment", params: { necessity: rowKey, behavior } } as const;
      return cell ? <button key={key} type="button" aria-expanded={rowActive && isActive(target)} data-behavior={behavior}
        aria-label={spendingPresentationLabel(key) + " · " + formatMoney(cell.amount)}
        style={{ "--bar-share": String(Math.abs(Number(cell.amount)) / maximum * 100) + "%" } as CSSProperties}
        onClick={() => onOpen({ target, label: spendingPresentationLabel(key), anchor: "matrix" })}>{formatMoney(cell.amount)}</button>
        : <span key={key} aria-label="Montant indisponible">—</span>;
    })}</div>
    {rowActive && <DetailSlot kind="segment" />}
  </li>;
}

function MarginAmount({ metric }: { readonly metric?: MetricValue<Money> }) {
  if (!metric) return <strong>À établir</strong>;
  if (metric.status !== "PARTIAL" || metric.partialMeaning !== "LOWER_BOUND") return <MoneyMetric metric={metric} />;
  return <span>Au moins <MoneyMetric metric={metric} partialDisplay="value-only" /> <small>Partiel</small></span>;
}

function LifeCard({ model, month }: { readonly model: MonthLifeMoneyReadModel; readonly month: YearMonth }) {
  const { onOpen, isActive, root, linkedMoments } = useContext(BalanceInteraction);
  const [open, setOpen] = useState<string>();
  const [previewMoment, setPreviewMoment] = useState<string>();
  const activities = visibleValue(model.activities);
  const moments = visibleValue(model.moments);
  const places = visibleValue(model.places);
  const activityList = activities?.status === "KNOWN" || activities?.status === "PARTIAL" ? activities.items : [];
  const momentList = moments?.status === "KNOWN" || moments?.status === "PARTIAL" ? moments.items.toSorted((a, b) => a.startDate.localeCompare(b.startDate)) : [];
  const placeList = places?.status === "KNOWN" || places?.status === "PARTIAL" ? places.items : [];
  const activeMoment = root?.target.kind === "moment" ? root.target.momentId : undefined;

  return <BalanceCollections.Provider value={{ open, setOpen }}>
    {momentList.length > 0 && <BalanceAtom name="moments" priority={100} minimum={1}>
      <MonthTimeline month={month} moments={momentList} activeId={activeMoment} previewId={previewMoment} linkedIds={linkedMoments} onPreview={setPreviewMoment}
        onOpen={moment => onOpen({ target: { kind: "moment", momentId: moment.momentId }, label: moment.title, anchor: "timeline" })} />
      {root?.anchor === "timeline" && <DetailSlot kind="moment" />}
      <DetailRows items={momentList} label="Moments marquants" listKey="moments" cards>{items =>
      <ul className={styles.lifeCards} aria-label="Moments marquants">
        {items.map(moment => {
          const target = { kind: "moment", momentId: moment.momentId } as const;
          return <li key={moment.momentId}><button type="button" aria-expanded={isActive(target)}
            data-previewed={previewMoment === moment.momentId || undefined} data-linked={linkedMoments.has(moment.momentId) || undefined}
            onPointerEnter={() => setPreviewMoment(moment.momentId)} onPointerLeave={() => setPreviewMoment(undefined)}
            onFocus={() => setPreviewMoment(moment.momentId)} onBlur={() => setPreviewMoment(undefined)} onClick={() => onOpen({ target, label: moment.title })}>
            <span><ClayIcon name="events" size={22} />{formatFrenchDateRange(moment.startDate, moment.endDate, false)}</span>
            <strong title={moment.title}>{moment.title}</strong>
            {metricValue(moment.causalCost) === undefined ? <small>Coût non établi</small> : <MoneyMetric metric={moment.causalCost} />}
          </button></li>;
        })}
      </ul>}</DetailRows>
      {root?.anchor !== "timeline" && <DetailSlot kind="moment" />}
    </BalanceAtom>}
    {activityList.length > 0 && <BalanceAtom name="activities" priority={82} minimum={root?.target.kind === "activity" || open === "activities" ? 1 : 0}>
      <h3 className={styles.railTitle}>Activités du mois</h3>
      <DetailRows items={activityList} label="Activités du mois" listKey="activities" cards>{items =>
      <ul className={styles.lifeCards} aria-label="Activités du mois">
        {items.map(activity => {
          const target = { kind: "activity", activityTypeKey: activity.activityTypeKey } as const;
          return <li key={activity.activityTypeKey}><button type="button" aria-expanded={isActive(target)} onClick={() => onOpen({ target, label: activity.label })}>
            <span><ClayIcon name="activity" size={22} />{formatCount(activity.occurrences, "fois", "fois")}</span>
            <strong title={activity.label}>{activity.label}</strong>
            {metricValue(activity.cost) !== undefined && <small>{activity.costKind === "CAUSAL" ? "Lié" : "Associé"} · <MoneyMetric metric={activity.cost} /></small>}
          </button></li>;
        })}
      </ul>}</DetailRows>
      <DetailSlot kind="activity" />
    </BalanceAtom>}
    {placeList.length > 0 && <BalanceAtom name="places" priority={76} minimum={root?.target.kind === "place" || open === "places" ? 1 : 0}>
      <h3 className={styles.railTitle}>Lieux fréquentés</h3>
      <DetailRows items={placeList} label="Lieux fréquentés" listKey="places" cards>{items =>
      <ul className={styles.lifeCards} aria-label="Lieux fréquentés">
        {items.map(place => {
          const target = { kind: "place", placeId: place.placeId } as const;
          return <li key={place.placeId}><button type="button" aria-expanded={isActive(target)} onClick={() => onOpen({ target, label: place.label })}>
            <span><ClayIcon name="travel" size={22} />{formatCount(place.presenceDays, "jour")}</span>
            <strong title={place.label}>{place.label}</strong>
          </button></li>;
        })}
      </ul>}</DetailRows>
      <DetailSlot kind="place" />
    </BalanceAtom>}
    {!momentList.length && !activityList.length && !placeList.length && <BalanceAtom name="status" priority={80}>
      <p className={styles.note}>Aucune activité, aucun moment ni lieu renseigné.</p>
    </BalanceAtom>}
  </BalanceCollections.Provider>;
}
