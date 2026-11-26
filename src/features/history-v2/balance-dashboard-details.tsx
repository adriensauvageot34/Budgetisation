"use client";

import { ChevronRight } from "lucide-react";
import { useQueryRuntime } from "@/components/runtime/query-client";
import type { Money } from "@/core/money";
import { yearMonthOf, type YearMonth } from "@/core/time";
import {
  queryResourceKeys,
  type CategoryMonthSummary,
  type EconomicExpenseSummary,
  type MonthBalanceSummaryReadModel,
  type MonthCategoriesReadModel,
  type MonthLifeMoneyReadModel,
  type MonthSpendingNatureReadModel,
} from "@/query-api";
import { SpendingBreakdown } from "./balance-dashboard-spending";
import { AmountBars, DetailGroup, PagedRows, chartMaximum, formatDelta, metricValue, moneyAmount, visibleValue } from "./balance-dashboard-widgets";
import { expenseDisplayTitle, formatCount, formatFrenchDate, formatFrenchDateRange, formatHistoricalRank, spendingPresentationLabel } from "./presentation";
import { CollectionState, DisplayState, MoneyMetric, StateBoundary, formatMoney } from "./renderers";
import type { HistoryOverlayTarget } from "./types";
import styles from "./balance-dashboard.module.css";

export type BalanceTarget = HistoryOverlayTarget | { readonly kind: "summary" | "minimal" | "categories" | "spending" | "life" };
export type DetailSelection = { readonly target: BalanceTarget; readonly label: string };
export type OpenDetail = (selection: DetailSelection) => void;
type HistoryScope = ReturnType<typeof monthScope>;

function monthScope(month: YearMonth) {
  return { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
}

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
function monthTitle(month: YearMonth) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

export function BalanceDetail({ selection, month, summary, categories, spending, life, subcategoryLabels, onOpen }: {
  readonly selection: DetailSelection;
  readonly month: YearMonth;
  readonly summary?: MonthBalanceSummaryReadModel;
  readonly categories?: MonthCategoriesReadModel;
  readonly spending?: MonthSpendingNatureReadModel;
  readonly life?: MonthLifeMoneyReadModel;
  readonly subcategoryLabels: Readonly<Record<string, string>>;
  readonly onOpen: OpenDetail;
}) {
  const { target } = selection;
  const scope = monthScope(month);
  const missing = <p className={styles.note}>Données indisponibles pour ce mois.</p>;
  switch (target.kind) {
    case "summary": return summary ? <ReferenceDetail model={summary} onOpen={onOpen} /> : missing;
    case "bridge": return <BankDetail scope={scope} />;
    case "minimal": return <MinimalDetail scope={scope} />;
    case "categories": return categories ? <CategoriesDetail model={categories} onOpen={onOpen} /> : missing;
    case "category": return <CategoryDetail scope={scope} id={target.categoryId} labels={subcategoryLabels} />;
    case "spending": return spending ? <SpendingBreakdown model={spending} month={month} /> : missing;
    case "segment": return <SegmentDetail scope={scope} params={target.params} />;
    case "life": return life ? <LifeDetail model={life} onOpen={onOpen} /> : missing;
    case "activity": return <ActivityDetail scope={scope} id={target.activityTypeKey} onOpen={onOpen} />;
    case "moment": return <MomentDetail scope={scope} id={target.momentId} />;
    case "place": return <PlaceDetail scope={scope} id={target.placeId} />;
    case "journal": return <JournalDetail date={target.date} />;
  }
}

function DetailLink({ label, end, onClick }: { readonly label: string; readonly end?: React.ReactNode; readonly onClick: () => void }) {
  return <button type="button" className={styles.detailLink} onClick={onClick}>
    <span title={label}>{label}</span>{end}<ChevronRight size={14} aria-hidden />
  </button>;
}

function DetailRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return <div className={styles.detailRow}><span title={label}>{label}</span><strong>{children}</strong></div>;
}

function ReferenceDetail({ model, onOpen }: { readonly model: MonthBalanceSummaryReadModel; readonly onOpen: OpenDetail }) {
  const actual = visibleValue(model.actualValue);
  const typical = visibleValue(model.typicalValue);
  const minimal = visibleValue(model.minimalValue);
  const zone = metricValue(visibleValue(model.usualZone));
  const rank = metricValue(visibleValue(model.historicalRank));
  return <div className={styles.detailColumns}>
    <DetailGroup title="Les dépenses face aux repères">
      <AmountBars rows={[
        ...(actual ? [{ id: "actual", label: "Dépenses du mois", amount: actual }] : []),
        ...(typical ? [{ id: "typical", label: "Mois habituel", amount: typical, tone: "secondary" as const }] : []),
        ...(metricValue(minimal) !== undefined ? [{ id: "minimum", label: "Minimum estimé", amount: minimal!, tone: "neutral" as const }] : []),
      ]} />
      {metricValue(minimal) !== undefined && <DetailLink label="Voir le détail du minimum estimé" onClick={() => onOpen({ target: { kind: "minimal" }, label: "Minimum estimé" })} />}
    </DetailGroup>
    <DetailGroup title="Ce que dit l’historique">
      {zone ? <DetailRow label="Fourchette habituelle">{formatMoney(zone.lowerBound)} à {formatMoney(zone.upperBound)}</DetailRow> : <p className={styles.note}>Fourchette en cours d’établissement.</p>}
      {rank?.presentation === "RANKED" && <p className={styles.note}>{formatHistoricalRank(rank.rank, rank.universeCount)}</p>}
      <DetailLink label="Comprendre l’écart avec mon compte" onClick={() => onOpen({ target: { kind: "bridge" }, label: "Écart avec mon compte" })} />
    </DetailGroup>
    {model.importedSummary.text && <DetailGroup title={model.importedSummary.freshness === "STALE" ? "Résumé à actualiser" : "Résumé du mois"}>
      <PagedRows size={1} label="Résumé du mois" items={model.importedSummary.text.match(/.{1,210}(?:\s+|$)|\S+/gu) ?? [model.importedSummary.text]}>
        {rows => <p className={styles.longNote}>{rows[0]}</p>}
      </PagedRows>
    </DetailGroup>}
  </div>;
}

function BankDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyBankEconomyBridge, scope, params: {} });
  return <StateBoundary state={state}>{model => <DisplayState node={model.bridge}>{bridge =>
    <div className={styles.detailColumns}>
      <DetailGroup title="Débits et dépenses du mois">
        <AmountBars rows={[
          { id: "bank", label: "Débits du compte", amount: moneyAmount(bridge.bankOutflows), tone: "secondary" },
          { id: "actual", label: "Dépenses du mois", amount: moneyAmount(bridge.actual) },
        ]} />
        <DetailRow label="Écart">{formatDelta(bridge.gap)}</DetailRow>
      </DetailGroup>
      <DetailGroup title="Les mouvements qui expliquent l’écart">
        <PagedRows label="Mouvements" items={bridge.lines}>{rows => rows.map(row =>
          <DetailRow key={row.lineId} label={row.label}>{formatDelta(row.signedAmount)}</DetailRow>
        )}</PagedRows>
      </DetailGroup>
    </div>
  }</DisplayState>}</StateBoundary>;
}

function MinimalDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMinimalPreview, scope, params: {} });
  return <StateBoundary state={state}>{model => <DisplayState node={model.preview}>{preview =>
    <div className={styles.detailColumns}>
      <DetailGroup title="Postes du minimum estimé">
        <AmountBars rows={preview.families.map((family) => ({ id: family.family, label: spendingPresentationLabel(family.family), amount: moneyAmount(family.amount) }))} />
      </DetailGroup>
      <DetailGroup title="Exemples pris en compte">
        <PagedRows label="Exemples" items={preview.families.flatMap(family => family.examples)}>{rows => rows.map(row =>
          <DetailRow key={row.componentId} label={row.label}>{formatMoney(row.amount)}</DetailRow>
        )}</PagedRows>
      </DetailGroup>
    </div>
  }</DisplayState>}</StateBoundary>;
}

function CategoriesDetail({ model, onOpen }: { readonly model: MonthCategoriesReadModel; readonly onOpen: OpenDetail }) {
  const other = visibleValue(model.otherAmount);
  const unclassified = visibleValue(model.unclassifiedAmount);
  return <div className={styles.detailColumns}>
    <DetailGroup title="Postes détaillés">
      <DisplayState node={model.categories}>{collection => <CollectionState collection={collection}>{items =>
        <PagedRows label="Catégories" items={items}>{rows => rows.map(item =>
          <DetailLink key={item.categoryId} label={item.label} end={<MoneyMetric metric={item.actual} />}
            onClick={() => onOpen({ target: { kind: "category", categoryId: item.categoryId }, label: item.label })} />
        )}</PagedRows>
      }</CollectionState>}</DisplayState>
    </DetailGroup>
    <DetailGroup title="Écarts à l’habitude" note="Différence entre ce mois et le montant habituel.">
      <DisplayState node={model.categories}>{collection => <CollectionState collection={collection}>{items =>
        <PagedRows label="Écarts à l’habitude" items={items}>{rows => rows.map(item => {
          const delta = metricValue(item.delta);
          return <DetailLink key={item.categoryId} label={item.label} end={delta === undefined ? "Sans repère" : formatDelta(delta)}
            onClick={() => onOpen({ target: { kind: "category", categoryId: item.categoryId }, label: item.label })} />;
        })}</PagedRows>
      }</CollectionState>}</DisplayState>
    </DetailGroup>
    <DetailGroup title="Lecture des dépenses">
      {other && Number(metricValue(other) ?? 0) !== 0 && <DetailRow label="Autres catégories"><MoneyMetric metric={other} /></DetailRow>}
      {unclassified && Number(metricValue(unclassified) ?? 0) !== 0 && <DetailRow label="Non classé"><MoneyMetric metric={unclassified} /></DetailRow>}
      <p className={styles.note}>Ouvre un poste pour le comparer à son montant habituel et voir le détail.</p>
    </DetailGroup>
  </div>;
}

export function subcategoryLabel(id: string, labels: Readonly<Record<string, string>>): string {
  if (id === "__UNDETERMINED__") return "Non classé";
  return Object.hasOwn(labels, id) && labels[id] !== id ? labels[id]! : "Sous-catégorie non identifiée";
}

function CategoryDetail({ scope, id, labels }: { readonly scope: HistoryScope; readonly id: string; readonly labels: Readonly<Record<string, string>> }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyCategoryDetail, scope, params: { categoryId: id } });
  return <StateBoundary state={state}>{model => {
    const category = model.category;
    const composition = visibleValue(model.typicalComposition);
    const explanation = visibleValue(model.explanation);
    const resolvedLabels = {
      ...labels,
      ...Object.fromEntries([...(explanation?.drivers ?? []), ...(explanation?.compensator ? [explanation.compensator] : [])]
        .filter(row => row.label && row.label !== row.stableId).map(row => [row.stableId, row.label])),
    };
    const entries = Object.entries(composition?.amountsByStableId ?? {}).map(([key, amount]) => ({
      id: key,
      label: subcategoryLabel(key, resolvedLabels),
      amount,
    })).toSorted((a, b) => Number(metricValue(b.amount) ?? 0) - Number(metricValue(a.amount) ?? 0));
    return <div className={styles.detailColumns}>
      <DetailGroup title={category.label}>
        <CategoryComparison category={category} />
        {explanation && <PagedRows size={2} label="Écarts par poste" items={explanation.drivers}>{rows => rows.map(row =>
          <DetailRow key={row.stableId} label={subcategoryLabel(row.stableId, resolvedLabels)}>
            {metricValue(row.contribution) === undefined ? "À confirmer" : formatDelta(metricValue(row.contribution)!)}
          </DetailRow>
        )}</PagedRows>}
      </DetailGroup>
      <DetailGroup title="Ce qui compose le mois habituel" note={composition?.pivotMonthIds.length ? `Mois de référence · ${composition.pivotMonthIds.map(monthTitle).join(" et ")}` : undefined}>
        {entries.length ? <PagedRows label="Sous-catégories" items={entries}>{rows => <AmountBars rows={rows} maximum={chartMaximum(entries)} />}</PagedRows>
          : <p className={styles.note}>Pas assez de données pour détailler un mois habituel.</p>}
      </DetailGroup>
      <CategoryAxis label="Nécessité" axis={visibleValue(model.classificationViews.necessity)} />
      <CategoryAxis label="Fixes et variables" axis={visibleValue(model.classificationViews.behavior)} />
      <CategoryAxis label="Quotidien et hors quotidien" axis={visibleValue(model.classificationViews.lifeScope)} />
    </div>;
  }}</StateBoundary>;
}

function CategoryComparison({ category }: { readonly category: CategoryMonthSummary }) {
  const delta = metricValue(category.delta);
  return <>
    <AmountBars rows={[
      { id: "actual", label: "Ce mois", amount: category.actual },
      { id: "typical", label: "Mois habituel", amount: category.typical, tone: "secondary" },
    ]} />
    {delta !== undefined && <DetailRow label="Écart à l’habitude">{formatDelta(delta)}</DetailRow>}
  </>;
}

type PublishedAxis = import("@/analytics/history-v2/month-balance").SpendingAxis;
function CategoryAxis({ label, axis }: { readonly label: string; readonly axis?: PublishedAxis }) {
  const buckets = metricValue(axis?.result);
  if (!buckets?.length) return null;
  return <DetailGroup title={label}>
    <div className={styles.axisTrack} aria-hidden="true">
      {buckets.map((bucket, index) => bucket.shareOfActual === undefined ? null :
        <span key={bucket.key} data-series={index} style={{ width: `${Math.max(0, Math.min(100, bucket.shareOfActual * 100))}%` }} />)}
    </div>
    <ul className={styles.axisLegend}>{buckets.map((bucket, index) => <li key={bucket.key}>
      <i data-series={index} aria-hidden /><span>{spendingPresentationLabel(bucket.key)}</span>
      <strong>{bucket.shareOfActual === undefined ? formatMoney(bucket.amount) : `${Math.round(bucket.shareOfActual * 100)} %`}</strong>
    </li>)}</ul>
    {axis && Number(axis.unclassifiedAmount) !== 0 && <small className={styles.note}>{formatMoney(axis.unclassifiedAmount)} non classés</small>}
  </DetailGroup>;
}



function SegmentDetail({ scope, params }: { readonly scope: HistoryScope; readonly params: Extract<HistoryOverlayTarget, { kind: "segment" }>["params"] }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historySpendingSegmentDetail, scope, params });
  return <StateBoundary state={state}>{model =>
    <div className={styles.detailColumns}>
      <DetailGroup title="Montant du poste">
        <DisplayState node={model.amount}>{amount => <MoneyMetric metric={amount} className={styles.detailTotal} />}</DisplayState>
        <DisplayState node={model.otherAmount}>{metric => Number(metricValue(metric)) === 0 ? null :
          <DetailRow label="Autres dépenses du poste"><MoneyMetric metric={metric} /></DetailRow>
        }</DisplayState>
      </DetailGroup>
      <DetailGroup title="Dépenses qui le composent">
        <DisplayState node={model.contributors}>{collection => <CollectionState collection={collection}>{items =>
          <PagedRows label="Dépenses du poste" items={items}>{rows => <AmountBars rows={rows.map(row => ({
            id: row.contributorId,
            label: row.label,
            amount: moneyAmount(row.amount),
          }))} />}</PagedRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
    </div>
  }</StateBoundary>;
}

function LifeDetail({ model, onOpen }: { readonly model: MonthLifeMoneyReadModel; readonly onOpen: OpenDetail }) {
  return <div className={styles.detailColumns}>
    <DetailGroup title="Activités du mois">
      <DisplayState node={model.activities}>{collection => <CollectionState collection={collection}>{items =>
        <PagedRows label="Activités" items={items}>{rows => rows.map(row =>
          <DetailLink key={row.activityTypeKey} label={row.label} end={formatCount(row.occurrences, "fois", "fois")}
            onClick={() => onOpen({ target: { kind: "activity", activityTypeKey: row.activityTypeKey }, label: row.label })} />
        )}</PagedRows>
      }</CollectionState>}</DisplayState>
    </DetailGroup>
    <DetailGroup title="Moments marquants">
      <DisplayState node={model.moments}>{collection => <CollectionState collection={collection}>{items =>
        <PagedRows label="Moments" items={items}>{rows => rows.map(row =>
          <DetailLink key={row.momentId} label={row.title} end={formatFrenchDateRange(row.startDate, row.endDate, false)}
            onClick={() => onOpen({ target: { kind: "moment", momentId: row.momentId }, label: row.title })} />
        )}</PagedRows>
      }</CollectionState>}</DisplayState>
    </DetailGroup>
    <DetailGroup title="Lieux fréquentés">
      <DisplayState node={model.places}>{collection => <CollectionState collection={collection}>{items =>
        <PagedRows label="Lieux" items={items}>{rows => rows.map(row =>
          <DetailLink key={row.placeId} label={row.label} end={formatCount(row.presenceDays, "jour")}
            onClick={() => onOpen({ target: { kind: "place", placeId: row.placeId }, label: row.label })} />
        )}</PagedRows>
      }</CollectionState>}</DisplayState>
    </DetailGroup>
  </div>;
}

function ExpenseGroup({ label, node }: { readonly label: string; readonly node: import("@/core/history-v2").DisplayNode<import("@/core/history-v2").CollectionValue<EconomicExpenseSummary>> }) {
  return <DetailGroup title={label}>
    <DisplayState node={node}>{collection => <CollectionState collection={collection}>{items => {
      const amounts = items.map(row => ({
        id: row.expenseEventId,
        label: expenseDisplayTitle(row),
        amount: moneyAmount(row.amount),
      }));
      return <PagedRows label={label} items={amounts}>{rows => <AmountBars rows={rows} maximum={chartMaximum(amounts)} />}</PagedRows>;
    }}</CollectionState>}</DisplayState>
  </DetailGroup>;
}

function ActivityDetail({ scope, id, onOpen }: { readonly scope: HistoryScope; readonly id: string; readonly onOpen: OpenDetail }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyActivityDetail, scope, params: { activityTypeKey: id } });
  return <StateBoundary state={state}>{model =>
    <div className={styles.detailColumns}>
      <DetailGroup title="Dates de l’activité">
        <DisplayState node={model.occurrences}>{collection => <CollectionState collection={collection}>{items =>
          <PagedRows label="Dates" items={items}>{rows => rows.map(row => <DetailLink key={row.occurrenceId}
            label={formatFrenchDate(row.effectiveDate)} end={row.effectiveTime}
            onClick={() => onOpen({ target: { kind: "journal", date: row.effectiveDate }, label: formatFrenchDate(row.effectiveDate) })} />
          )}</PagedRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Dépenses liées" node={model.causalExpenses} />
      <ExpenseGroup label="Dépenses associées" node={model.associatedExpenses} />
    </div>
  }</StateBoundary>;
}

function JournalDetail({ date }: { readonly date: Extract<HistoryOverlayTarget, { kind: "journal" }>["date"] }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyDayJournal, scope: monthScope(yearMonthOf(date)), params: { date } });
  return <StateBoundary state={state}>{model =>
    <div className={styles.detailColumns}>
      <DetailGroup title="Dépenses du jour">
        <DisplayState node={model.economicAmount}>{amount => <MoneyMetric metric={amount} className={styles.detailTotal} />}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Autres dépenses du jour" node={model.otherMovements.otherExpenses} />
    </div>
  }</StateBoundary>;
}

function MomentDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMomentDetail, scope, params: { momentId: id } });
  return <StateBoundary state={state}>{model =>
    <div className={styles.detailColumns}>
      <DetailGroup title="Budget du moment" note={formatFrenchDateRange(model.moment.startDate, model.moment.endDate)}>
        <DisplayState node={model.causalCost}>{amount => <DetailRow label="Dépenses liées"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
        <DisplayState node={model.spentDuring}>{amount => <DetailRow label="Dépenses sur la période"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Achats liés au moment" node={model.causalExpenses} />
      <ExpenseGroup label="Autres achats sur la période" node={model.spentDuringExpenses} />
    </div>
  }</StateBoundary>;
}

function PlaceDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyPlaceDetail, scope, params: { placeId: id } });
  return <StateBoundary state={state}>{model =>
    <div className={styles.detailColumns}>
      <DetailGroup title={model.place.label}>
        <DetailRow label="Jours de présence">{model.place.presenceDays}</DetailRow>
        <DisplayState node={model.localizedAmount}>{amount => <DetailRow label="Dépenses localisées"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
      </DetailGroup>
      <DetailGroup title="Dates de présence">
        <DisplayState node={model.presenceDays}>{collection => <CollectionState collection={collection}>{items =>
          <PagedRows label="Présences" items={items}>{rows => rows.map(row =>
            <DetailRow key={row.date} label={formatFrenchDate(row.date)}>{formatCount(row.presenceCount, "présence")}</DetailRow>
          )}</PagedRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
    </div>
  }</StateBoundary>;
}
