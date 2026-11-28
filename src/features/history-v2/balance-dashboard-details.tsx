"use client";

import type { ReactNode } from "react";
import type { UiTransportState } from "@/ui";
import { BalanceMonthRhythm } from "./balance-month-rhythm";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useQueryRuntime } from "@/components/runtime/query-client";
import type { Money } from "@/core/money";
import { yearMonthOf, type YearMonth } from "@/core/time";
import {
  queryResourceKeys,
  type CategoryMonthSummary,
  type EconomicExpenseSummary,
  type JournalTimelineItem,
  type ParticipantSummary,
} from "@/query-api";

import { AmountBars, DetailGroup, DetailRows, chartMaximum, formatDelta, metricValue, moneyAmount, visibleValue } from "./balance-dashboard-widgets";
import { expenseDisplayTitle, formatCount, formatFrenchDate, formatFrenchDateRange, spendingPresentationLabel } from "./presentation";
import { CollectionState, DisplayState, MoneyMetric, StateBoundary, formatMoney } from "./renderers";
import type { HistoryOverlayTarget } from "./types";
import styles from "./balance-dashboard.module.css";

export type BalanceTarget = HistoryOverlayTarget | { readonly kind: "minimal" };
export type DetailSelection = {
  readonly target: BalanceTarget;
  readonly label: string;
  readonly placement?: "distribution";
  readonly anchor?: "matrix" | "timeline";
};
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


function DetailState<T>({ state, children }: { readonly state: UiTransportState<T>; readonly children: (data: T) => ReactNode }) {
  return <StateBoundary state={state} skeleton={<p className={styles.detailLoading} role="status">Chargement du détail…</p>}>{children}</StateBoundary>;
}

function DetailColumns({ children }: { readonly children: ReactNode }) {
  return <div className={styles.detailColumns} tabIndex={0} role="group" aria-label="Informations du détail">{children}</div>;
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
  return <DetailState state={state}>{model => <DisplayState node={model.bridge}>{bridge => {
    const maximum = Math.max(1, ...bridge.lines.map(line => Math.abs(Number(line.signedAmount))));
    return <DetailColumns>
      <DetailGroup title="Du compte au bilan">
        <div className={styles.bankBridge}>
          <span>Débits du compte <strong>{formatMoney(bridge.bankOutflows)}</strong></span>
          <ArrowRight aria-hidden />
          <span>Dépenses du mois <strong>{formatMoney(bridge.actual)}</strong></span>
        </div>
        <DetailRow label="Écart">{formatDelta(bridge.gap)}</DetailRow>
      </DetailGroup>
      <DetailGroup title="Les mouvements qui expliquent l’écart">
        {bridge.lines.length ? <DetailRows label="Mouvements" items={bridge.lines}>{rows => <ul className={styles.adjustments}>
          {rows.map(row => <li key={row.lineId}>
            <span title={row.label}>{row.label}</span><strong>{formatDelta(row.signedAmount)}</strong>
            <span className={styles.adjustmentTrack} aria-hidden="true"><i data-negative={Number(row.signedAmount) < 0}
              style={{ width: `${Math.abs(Number(row.signedAmount)) / maximum * 50}%` }} /></span>
          </li>)}
        </ul>}</DetailRows> : <p className={styles.note}>Aucun ajustement détaillé.</p>}
      </DetailGroup>
    </DetailColumns>;
  }}</DisplayState>}</DetailState>;
}

function MinimalDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMinimalPreview, scope, params: {} });
  return <DetailState state={state}>{model => <DisplayState node={model.preview}>{preview =>
    <DetailColumns>
      <DetailGroup title="Postes du minimum estimé">
        <AmountBars rows={preview.families.map((family) => ({ id: family.family, label: spendingPresentationLabel(family.family), amount: moneyAmount(family.amount) }))} />
      </DetailGroup>
      <DetailGroup title="Exemples pris en compte">
        <DetailRows label="Exemples" items={preview.families.flatMap(family => family.examples)}>{rows => rows.map(row =>
          <DetailRow key={row.componentId} label={row.label}>{formatMoney(row.amount)}</DetailRow>
        )}</DetailRows>
      </DetailGroup>
    </DetailColumns>
  }</DisplayState>}</DetailState>;
}



export function subcategoryLabel(id: string, labels: Readonly<Record<string, string>>): string {
  if (id === "__UNDETERMINED__") return "Non classé";
  return Object.hasOwn(labels, id) && labels[id] !== id ? labels[id]! : "Sous-catégorie non identifiée";
}

function CategoryDetail({ scope, id, labels }: { readonly scope: HistoryScope; readonly id: string; readonly labels: Readonly<Record<string, string>> }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyCategoryDetail, scope, params: { categoryId: id } });
  return <DetailState state={state}>{model => {
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
    const kind = category.label.trim().toLocaleLowerCase("fr-FR");
    const rhythm = kind === "alimentation" ? "food" : kind === "transport & voiture" ? "car" : undefined;
    const drivers = explanation ? [...explanation.drivers, ...(explanation.compensator ? [explanation.compensator] : [])] : [];
    return <DetailColumns>
      <DetailGroup title="Ce mois et le mois habituel"><CategoryComparison category={category} /></DetailGroup>
      {rhythm && <BalanceMonthRhythm key={scope.time.month + rhythm} month={scope.time.month} domain={rhythm} />}
      {drivers.length > 0 && <DetailGroup title="Postes qui expliquent l’écart">
        <DetailRows label="Écarts par poste" items={drivers}>{rows => rows.map(row =>
          <DetailRow key={row.stableId} label={subcategoryLabel(row.stableId, resolvedLabels)}>
            {metricValue(row.contribution) === undefined ? "À confirmer" : formatDelta(metricValue(row.contribution)!)}
          </DetailRow>
        )}</DetailRows>
      </DetailGroup>}
      <DetailGroup title="Composition du mois habituel" note={composition?.pivotMonthIds.length ? `Mois de référence · ${composition.pivotMonthIds.map(monthTitle).join(" et ")}` : undefined}>
        {entries.length ? <DetailRows label="Sous-catégories" items={entries}>{rows => <AmountBars rows={rows} maximum={chartMaximum(entries)} />}</DetailRows>
          : <p className={styles.note}>Pas assez de données pour détailler un mois habituel.</p>}
      </DetailGroup>
      <CategoryAxis label="Nécessité" axis={visibleValue(model.classificationViews.necessity)} />
      <CategoryAxis label="Fixes et variables" axis={visibleValue(model.classificationViews.behavior)} />
      <CategoryAxis label="Quotidien et hors quotidien" axis={visibleValue(model.classificationViews.lifeScope)} />
    </DetailColumns>;
  }}</DetailState>;
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
  return <DetailState state={state}>{model =>
    <DetailColumns>
      <DetailGroup title="Montant du poste">
        <DisplayState node={model.amount}>{amount => <MoneyMetric metric={amount} className={styles.detailTotal} />}</DisplayState>
        <DisplayState node={model.otherAmount}>{metric => Number(metricValue(metric)) === 0 ? null :
          <DetailRow label="Autres dépenses du poste"><MoneyMetric metric={metric} /></DetailRow>
        }</DisplayState>
      </DetailGroup>
      <DetailGroup title="Dépenses qui le composent">
        <DisplayState node={model.contributors}>{collection => <CollectionState collection={collection}>{items =>
          <DetailRows label="Dépenses du poste" items={items}>{rows => <AmountBars rows={rows.map(row => ({
            id: row.contributorId,
            label: row.label,
            amount: moneyAmount(row.amount),
          }))} />}</DetailRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
    </DetailColumns>
  }</DetailState>;
}

function ExpenseGroup({ label, node, participants = [], exclude }: {
  readonly label: string;
  readonly node: import("@/core/history-v2").DisplayNode<import("@/core/history-v2").CollectionValue<EconomicExpenseSummary>>;
  readonly participants?: readonly ParticipantSummary[];
  readonly exclude?: ReadonlySet<string>;
}) {
  return <DetailGroup title={label}>
    <DisplayState node={node}>{collection => <CollectionState collection={collection}>{items => {
      const amounts = items.filter(row => !exclude?.has(row.expenseEventId)).map(row => ({
        id: row.expenseEventId,
        label: expenseDisplayTitle(row),
        attribution: participants.find(person => person.participantId === row.narrativeOwnerId)?.label,
        amount: moneyAmount(row.amount),
      }));
      return <DetailRows label={label} items={amounts}>{rows => <AmountBars rows={rows} maximum={chartMaximum(amounts)} />}</DetailRows>;
    }}</CollectionState>}</DisplayState>
  </DetailGroup>;
}

function ActivityDetail({ scope, id, onOpen }: { readonly scope: HistoryScope; readonly id: string; readonly onOpen: OpenDetail }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyActivityDetail, scope, params: { activityTypeKey: id } });
  return <DetailState state={state}>{model =>
    <DetailColumns>
      <DetailGroup title="Dates de l’activité">
        <DisplayState node={model.occurrences}>{collection => <CollectionState collection={collection}>{items =>
          <DetailRows label="Dates" items={items}>{rows => rows.map(row => <DetailLink key={row.occurrenceId}
            label={formatFrenchDate(row.effectiveDate)} end={row.effectiveTime}
            onClick={() => onOpen({ target: { kind: "journal", date: row.effectiveDate }, label: formatFrenchDate(row.effectiveDate) })} />
          )}</DetailRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Dépenses liées" node={model.causalExpenses} />
      <ExpenseGroup label="Dépenses associées" node={model.associatedExpenses} />
    </DetailColumns>
  }</DetailState>;
}

function journalItems<T>(node: import("@/core/history-v2").DisplayNode<import("@/core/history-v2").CollectionValue<T>>) {
  const collection = visibleValue(node);
  return collection?.status === "KNOWN" || collection?.status === "PARTIAL" ? collection.items : [];
}

function PeopleChips({ people }: { readonly people: readonly ParticipantSummary[] }) {
  if (!people.length) return null;
  return <div className={styles.peopleChips} aria-label="Participants">
    {people.map(person => <span key={person.participantId}>{person.label}</span>)}
  </div>;
}

function JournalEvents({ items, label }: { readonly items: readonly JournalTimelineItem[]; readonly label: string }) {
  if (!items.length) return null;
  return <DetailGroup title={label}>
    <DetailRows label={label} items={items}>{rows => rows.map(row => <div key={row.calendarItemId}>
      <DetailRow label={row.title}>
        {row.moment ? <DisplayState node={row.moment.causalCost}>{value => <MoneyMetric metric={value} />}</DisplayState> : row.startTime}
      </DetailRow>
      <PeopleChips people={row.participants} />
    </div>)}</DetailRows>
  </DetailGroup>;
}

function MomentParticipants({ date, momentId }: { readonly date: Extract<HistoryOverlayTarget, { kind: "journal" }>["date"]; readonly momentId: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyDayJournal, scope: monthScope(yearMonthOf(date)), params: { date } });
  if (state.status !== "success") return null;
  const model = state.response.data;
  const people = [...journalItems(model.timedTimeline), ...journalItems(model.untimedEvents)]
    .filter(row => row.moment?.momentId === momentId).flatMap(row => row.participants);
  return <PeopleChips people={[...new Map(people.map(person => [person.participantId, person])).values()]} />;
}

function JournalDetail({ date }: { readonly date: Extract<HistoryOverlayTarget, { kind: "journal" }>["date"] }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyDayJournal, scope: monthScope(yearMonthOf(date)), params: { date } });
  return <DetailState state={state}>{model =>
    <DetailColumns>
      <DetailGroup title="Total des dépenses du jour">
        <DisplayState node={model.economicAmount}>{amount => <MoneyMetric metric={amount} className={styles.detailTotal} />}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Autres dépenses du jour" node={model.otherMovements.otherExpenses} participants={journalItems(model.dayParticipants)} />
      <JournalEvents label="Événements du jour" items={[...journalItems(model.timedTimeline), ...journalItems(model.untimedEvents)]} />
      {[...journalItems(model.timedTimeline), ...journalItems(model.untimedEvents)].map(event =>
        event.moment && journalItems(event.moment.causalExpenses).length > 0
          ? <ExpenseGroup key={event.calendarItemId} label={event.title} node={event.moment.causalExpenses} participants={event.participants} />
          : null)}
    </DetailColumns>
  }</DetailState>;
}

function MomentDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMomentDetail, scope, params: { momentId: id } });
  return <DetailState state={state}>{model =>
    <DetailColumns>
      <DetailGroup title="Budget du moment" note={formatFrenchDateRange(model.moment.startDate, model.moment.endDate)}>
        <DisplayState node={model.causalCost}>{amount => <DetailRow label="Dépenses liées"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
        <DisplayState node={model.spentDuring}>{amount => <DetailRow label="Dépenses sur la période"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
        <MomentParticipants date={model.moment.startDate} momentId={id} />
      </DetailGroup>
      <ExpenseGroup label="Achats liés au moment" node={model.causalExpenses} />
      <ExpenseGroup label="Autres achats sur la période" node={model.spentDuringExpenses}
        exclude={new Set(journalItems(model.causalExpenses).map(expense => expense.expenseEventId))} />
    </DetailColumns>
  }</DetailState>;
}

function PlaceDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyPlaceDetail, scope, params: { placeId: id } });
  return <DetailState state={state}>{model =>
    <DetailColumns>
      <DetailGroup title={model.place.label}>
        <DetailRow label="Jours de présence">{model.place.presenceDays}</DetailRow>
        <DisplayState node={model.localizedAmount}>{amount => <DetailRow label="Dépenses localisées"><MoneyMetric metric={amount} /></DetailRow>}</DisplayState>
      </DetailGroup>
      <DetailGroup title="Dates de présence">
        <DisplayState node={model.presenceDays}>{collection => <CollectionState collection={collection}>{items =>
          <DetailRows label="Présences" items={items}>{rows => rows.map(row =>
            <DetailRow key={row.date} label={formatFrenchDate(row.date)}>{formatCount(row.presenceCount, "présence")}</DetailRow>
          )}</DetailRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
    </DetailColumns>
  }</DetailState>;
}
