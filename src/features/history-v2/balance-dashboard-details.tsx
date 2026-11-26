"use client";

import { Children, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryRuntime } from "@/components/runtime/query-client";
import type { Money } from "@/core/money";
import { yearMonthOf, type YearMonth } from "@/core/time";
import {
  queryResourceKeys,
  type CategoryMonthSummary,
  type EconomicExpenseSummary,
} from "@/query-api";

import { AmountBars, DetailGroup, PagedRows, chartMaximum, formatDelta, metricValue, moneyAmount, visibleValue } from "./balance-dashboard-widgets";
import { expenseDisplayTitle, formatCount, formatFrenchDate, formatFrenchDateRange, spendingPresentationLabel } from "./presentation";
import { CollectionState, DisplayState, MoneyMetric, StateBoundary, formatMoney } from "./renderers";
import type { HistoryOverlayTarget } from "./types";
import styles from "./balance-dashboard.module.css";

export type BalanceTarget = HistoryOverlayTarget | { readonly kind: "minimal" };
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

export function BalanceDetail({ selection, month, subcategoryLabels, onOpen }: {
  readonly selection: DetailSelection;
  readonly month: YearMonth;

  readonly subcategoryLabels: Readonly<Record<string, string>>;
  readonly onOpen: OpenDetail;
}) {
  const { target } = selection;
  const scope = monthScope(month);

  switch (target.kind) {

    case "bridge": return <BankDetail scope={scope} />;
    case "minimal": return <MinimalDetail scope={scope} />;

    case "category": return <CategoryDetail scope={scope} id={target.categoryId} labels={subcategoryLabels} />;

    case "segment": return <SegmentDetail scope={scope} params={target.params} />;

    case "activity": return <ActivityDetail scope={scope} id={target.activityTypeKey} onOpen={onOpen} />;
    case "moment": return <MomentDetail scope={scope} id={target.momentId} />;
    case "place": return <PlaceDetail scope={scope} id={target.placeId} />;
    case "journal": return <JournalDetail date={target.date} />;
  }
}


function DetailColumns({ children }: { readonly children: ReactNode }) {
  const groups = Children.toArray(children);
  const [offset, setOffset] = useState(0);
  const pageSize = 2;
  const lastPage = Math.max(0, Math.ceil(groups.length / pageSize) - 1);
  const page = Math.min(offset, lastPage);
  return <>
    <div className={styles.detailColumns}>{groups.slice(page * pageSize, (page + 1) * pageSize)}</div>
    {lastPage > 0 && <div className={styles.pagination} aria-label="Informations du détail">
      <button type="button" onClick={() => setOffset(page - 1)} disabled={page === 0} aria-label="Informations précédentes">
        <ChevronLeft size={15} aria-hidden />
      </button>
      <span aria-live="polite">{page + 1} / {lastPage + 1}</span>
      <button type="button" onClick={() => setOffset(page + 1)} disabled={page === lastPage} aria-label="Informations suivantes">
        <ChevronRight size={15} aria-hidden />
      </button>
    </div>}
  </>;
}
function DetailLink({ label, end, onClick }: {
  readonly label: string;
  readonly end?: React.ReactNode;
  readonly onClick: () => void;
}) {
  return <button type="button" className={styles.detailLink} onClick={onClick}>
    <span title={label}>{label}</span>{end}<ChevronRight size={14} aria-hidden />

  </button>;
}

function DetailRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return <div className={styles.detailRow}><span title={label}>{label}</span><strong>{children}</strong></div>;
}

function BankDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyBankEconomyBridge, scope, params: {} });
  return <StateBoundary state={state}>{model => <DisplayState node={model.bridge}>{bridge => {
    const maximum = Math.max(1, ...bridge.lines.map(line => Math.abs(Number(line.signedAmount))));
    return <DetailColumns>
      <DetailGroup title="Du compte au bilan">
        <DetailRow label="Débits du compte">{formatMoney(bridge.bankOutflows)}</DetailRow>
        <DetailRow label="Dépenses du mois">{formatMoney(bridge.actual)}</DetailRow>
        <DetailRow label="Écart">{formatDelta(bridge.gap)}</DetailRow>
      </DetailGroup>
      <DetailGroup title="Les mouvements qui expliquent l’écart">
        {bridge.lines.length ? <PagedRows label="Mouvements" items={bridge.lines}>{rows => <ul className={styles.adjustments}>
          {rows.map(row => <li key={row.lineId}>
            <span title={row.label}>{row.label}</span><strong>{formatDelta(row.signedAmount)}</strong>
            <span className={styles.adjustmentTrack} aria-hidden="true"><i data-negative={Number(row.signedAmount) < 0}
              style={{ width: `${Math.abs(Number(row.signedAmount)) / maximum * 50}%` }} /></span>
          </li>)}
        </ul>}</PagedRows> : <p className={styles.note}>Aucun ajustement détaillé.</p>}
      </DetailGroup>
    </DetailColumns>;
  }}</DisplayState>}</StateBoundary>;
}

function MinimalDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMinimalPreview, scope, params: {} });
  return <StateBoundary state={state}>{model => <DisplayState node={model.preview}>{preview =>
    <DetailColumns>
      <DetailGroup title="Postes du minimum estimé">
        <AmountBars rows={preview.families.map((family) => ({ id: family.family, label: spendingPresentationLabel(family.family), amount: moneyAmount(family.amount) }))} />
      </DetailGroup>
      <DetailGroup title="Exemples pris en compte">
        <PagedRows label="Exemples" items={preview.families.flatMap(family => family.examples)}>{rows => rows.map(row =>
          <DetailRow key={row.componentId} label={row.label}>{formatMoney(row.amount)}</DetailRow>
        )}</PagedRows>
      </DetailGroup>
    </DetailColumns>
  }</DisplayState>}</StateBoundary>;
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
    return <DetailColumns>
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
    </DetailColumns>;
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
    <DetailColumns>
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
    </DetailColumns>
  }</StateBoundary>;
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
    <DetailColumns>
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
    </DetailColumns>
  }</StateBoundary>;
}

function JournalDetail({ date }: { readonly date: Extract<HistoryOverlayTarget, { kind: "journal" }>["date"] }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyDayJournal, scope: monthScope(yearMonthOf(date)), params: { date } });
  return <StateBoundary state={state}>{model =>
    <DetailColumns>
      <DetailGroup title="Dépenses du jour">
        <DisplayState node={model.economicAmount}>{amount => <MoneyMetric metric={amount} className={styles.detailTotal} />}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Autres dépenses du jour" node={model.otherMovements.otherExpenses} />
    </DetailColumns>
  }</StateBoundary>;
}

function MomentDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMomentDetail, scope, params: { momentId: id } });
  return <StateBoundary state={state}>{model =>
    <DetailColumns>
      <DetailGroup title="Budget du moment" note={formatFrenchDateRange(model.moment.startDate, model.moment.endDate)}>
        <DisplayState node={model.causalCost}>{amount => <DetailRow label="Dépenses liées"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
        <DisplayState node={model.spentDuring}>{amount => <DetailRow label="Dépenses sur la période"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Achats liés au moment" node={model.causalExpenses} />
      <ExpenseGroup label="Autres achats sur la période" node={model.spentDuringExpenses} />
    </DetailColumns>
  }</StateBoundary>;
}

function PlaceDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyPlaceDetail, scope, params: { placeId: id } });
  return <StateBoundary state={state}>{model =>
    <DetailColumns>
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
    </DetailColumns>
  }</StateBoundary>;
}
