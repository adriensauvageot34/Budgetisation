"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import type { UiTransportState } from "@/ui";
import { BalanceMonthRhythm } from "./balance-month-rhythm";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useQueryRuntime } from "@/components/runtime/query-client";
import { addMoney, subtractMoney, type Money } from "@/core/money";
import type { ClayIconName } from "@/components/layout/clay-icon";
import { yearMonthOf, type LocalDate, type YearMonth } from "@/core/time";
import { isArchivedRealizedMonth, isImportedRealizedMonth, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import {
  queryResourceKeys,
  type EconomicExpenseSummary,
  type JournalTimelineItem,
  type ParticipantSummary,
} from "@/query-api";

import { BalanceCollections, DetailAmounts, DetailGroup, DetailHero, DetailMetric, DetailRows, formatDelta, metricValue, moneyAmount, visibleValue } from "./balance-dashboard-widgets";
import { expenseDisplayTitle, formatCount, formatFrenchDate, formatFrenchDateRange, spendingPresentationLabel } from "./presentation";
import { CollectionState, DisplayState, MoneyMetric, StateBoundary, formatMoney } from "./renderers";
import type { HistoryOverlayTarget } from "./types";
import { overlayTargetKey } from "./route-state";
import type { BankEconomyBridge } from "@/analytics/history-v2/month-balance";
import type { CSSProperties } from "react";
import styles from "./balance-dashboard.module.css";

export type BalanceTarget = HistoryOverlayTarget | { readonly kind: "minimal" };
export type DetailSelection = {
  readonly target: BalanceTarget;
  readonly label: string;
  readonly placement?: "distribution";
  readonly anchor?: "matrix" | "timeline" | "margin";
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

const DetailReady = createContext(() => {});

export function BalanceDetail({ onReady, ...props }: Parameters<typeof BalanceDetailContent>[0] & { readonly onReady: () => void }) {
  return <DetailReady.Provider value={onReady}><BalanceDetailContent {...props} /></DetailReady.Provider>;
}

function BalanceDetailContent({ selection, month, subcategoryLabels, categoryBySubcategory, onOpen, onJournalLinks, onContributors, contributorKey }: {
  readonly selection: DetailSelection;
  readonly month: YearMonth;

  readonly subcategoryLabels: Readonly<Record<string, string>>;
  readonly categoryBySubcategory: Readonly<Record<string, string>>;
  readonly onOpen: OpenDetail;
  readonly onJournalLinks: (date: LocalDate, momentIds: readonly string[]) => void;
  readonly onContributors: (key: string, ids: readonly string[]) => void;
  readonly contributorKey: string;
}) {
  const { target } = selection;
  const scope = monthScope(month);

  switch (target.kind) {

    case "bridge": return <BankDetail scope={scope} />;
    case "minimal": return <MinimalDetail scope={scope} />;

    case "category": return <CategoryDetail scope={scope} id={target.categoryId} labels={subcategoryLabels} />;

    case "segment": return <SegmentDetail scope={scope} params={target.params} contributorKey={contributorKey} categoryBySubcategory={categoryBySubcategory} onContributors={onContributors} />;

    case "activity": return <ActivityDetail scope={scope} id={target.activityTypeKey} onOpen={onOpen} />;
    case "moment": return <MomentDetail scope={scope} id={target.momentId} />;
    case "place": return <PlaceDetail scope={scope} id={target.placeId} onOpen={onOpen} />;
    case "journal": return <JournalDetail date={target.date} onOpen={onOpen} onJournalLinks={onJournalLinks} />;
  }
}


function DetailState<T>({ state, children }: { readonly state: UiTransportState<T>; readonly children: (data: T) => ReactNode }) {
  return <StateBoundary state={state} skeleton={<div className={styles.detailLoading} role="status" aria-label="Chargement du détail"><i /><i /><i /></div>}>{children}</StateBoundary>;
}

function DetailCanvas({ lead, side = false, categoryGroups, longComposition, children }: {
  readonly lead: ReactNode;
  readonly side?: boolean;
  readonly categoryGroups?: number;
  readonly longComposition?: boolean;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState<string>();
  const ready = useContext(DetailReady);
  useLayoutEffect(ready, [ready]);
  return <BalanceCollections.Provider value={{ open, setOpen }}>
    <div className={styles.detailCanvas} data-side={side || undefined} data-category-groups={categoryGroups}
      data-long-composition={longComposition || undefined} data-budget-reveal>
      {lead}
      <div className={categoryGroups ? styles.detailColumns : `${styles.detailColumns} inline-balance-data`}>{children}</div>
    </div>
  </BalanceCollections.Provider>;
}

function DetailLink({ label, end, trigger, onClick }: {
  readonly label: string;
  readonly end?: React.ReactNode;
  readonly trigger?: HistoryOverlayTarget;
  readonly onClick: () => void;
}) {
  return <button type="button" className={styles.detailLink} data-balance-trigger={trigger && overlayTargetKey(trigger)} onClick={onClick}>
    <span title={label}>{label}</span>{end}<ChevronRight size={14} aria-hidden />

  </button>;
}

function DetailRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return <div className={styles.detailRow}><span title={label}>{label}</span><strong>{children}</strong></div>;
}

function BankDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyBankEconomyBridge, scope, params: {} });
  return <DetailState state={state}>{model => <DisplayState node={model.bridge}>{bridge => <DetailCanvas lead={<DetailHero icon="expenses">
      <DetailMetric label="Débits du compte" secondary>{formatMoney(bridge.bankOutflows)}</DetailMetric>
      <ArrowRight className={styles.bridgeArrow} size={17} aria-hidden />
      <DetailMetric label="Dépenses du mois">{formatMoney(bridge.actual)}</DetailMetric>
      <DetailMetric label="Écart" secondary>{formatDelta(bridge.gap)}</DetailMetric>
    </DetailHero>}>
      <DetailGroup title="Des débits aux dépenses du mois">
        <BankWaterfall bridge={bridge} />
        {bridge.lines.length > 4 && <DetailRows label="Tous les ajustements" items={bridge.lines} size={0}>{rows => <ul className={styles.adjustments}>
          {rows.map(row => <li key={row.lineId}><span title={row.label}>{row.label}</span><strong>{formatDelta(row.signedAmount)}</strong></li>)}
        </ul>}</DetailRows>}
      </DetailGroup>
    </DetailCanvas>}</DisplayState>}</DetailState>;
}

function BankWaterfall({ bridge }: { readonly bridge: BankEconomyBridge }) {
  const debit = Number(bridge.bankOutflows);
  const actual = Number(bridge.actual);
  let position = debit;
  let amountAfterVisible = bridge.bankOutflows;
  const adjustments = bridge.lines.slice(0, 4).map(line => {
    const previous = position;
    amountAfterVisible = addMoney(amountAfterVisible, line.signedAmount);
    position = Number(amountAfterVisible);
    return { key: line.lineId, label: line.label, value: formatDelta(line.signedAmount), previous, next: position };
  });
  const subtotal = Number(bridge.bridgeCalculatedActual);
  if (bridge.lines.length > 4) adjustments.push({ key: "remaining", label: `${bridge.lines.length - 4} autres ajustements`, value: formatDelta(subtractMoney(bridge.bridgeCalculatedActual, amountAfterVisible)), previous: position, next: subtotal });
  if (Math.abs(Number(bridge.residual)) >= .01) adjustments.push({ key: "unexplained", label: "Écart non expliqué", value: formatDelta(bridge.residual), previous: subtotal, next: actual });
  const steps = [{ key: "debits", label: "Débits", value: formatMoney(bridge.bankOutflows), previous: 0, next: debit }, ...adjustments,
    { key: "total", label: "Dépenses du mois", value: formatMoney(bridge.actual), previous: 0, next: actual }];
  const top = Math.max(1, ...steps.flatMap(step => [step.previous, step.next]));
  const bottom = Math.min(0, ...steps.flatMap(step => [step.previous, step.next]));
  const percent = (value: number) => `${(value - bottom) / (top - bottom) * 100}%`;
  return <ol className={styles.waterfall} aria-label="Cascade des ajustements en euros">
    {steps.map((step, index) => <li key={step.key} data-step={step.key === "unexplained" ? "unknown" : index === 0 || index === steps.length - 1 ? "total" : step.next < step.previous ? "less" : "more"}>
      <span className={styles.waterfallTrack} aria-hidden style={{ "--exit": percent(step.next) } as CSSProperties}>
        <i style={{ "--from": percent(Math.min(step.previous, step.next)), "--to": percent(Math.max(step.previous, step.next)) } as CSSProperties} />
      </span>
      <span title={step.label}>{step.label}</span><strong>{step.value}</strong>
    </li>)}
  </ol>;
}

function MinimalDetail({ scope }: { readonly scope: HistoryScope }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMinimalPreview, scope, params: {} });
  return <DetailState state={state}>{model => <DisplayState node={model.preview}>{preview =>
    <DetailCanvas side lead={<DetailHero icon="overview">
      <DisplayState node={model.minimalValue}>{amount => <DetailMetric label="Minimum estimé"><MoneyMetric metric={amount} /></DetailMetric>}</DisplayState>
    </DetailHero>}>
      <DetailGroup title="Postes du minimum estimé">
        <DetailAmounts rows={preview.families.map((family) => ({ id: family.family, label: spendingPresentationLabel(family.family), amount: moneyAmount(family.amount) }))} />
      </DetailGroup>
      <DetailGroup title="Exemples pris en compte">
        <DetailRows label="Exemples" items={preview.families.flatMap(family => family.examples)}>{rows => rows.map(row =>
          <DetailRow key={row.componentId} label={row.label}>{formatMoney(row.amount)}</DetailRow>
        )}</DetailRows>
      </DetailGroup>
    </DetailCanvas>
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
    return <DetailCanvas categoryGroups={1 + Number(Boolean(rhythm)) + Number(drivers.length > 0)} longComposition={entries.length > 10} lead={<DetailHero icon="categories">
      <DetailMetric label="Ce mois"><MoneyMetric metric={category.actual} /></DetailMetric>
      <DetailMetric label="Mois habituel" secondary><MoneyMetric metric={category.typical} /></DetailMetric>
      {metricValue(category.delta) !== undefined && <DetailMetric label="Écart à l’habitude" secondary>{formatDelta(metricValue(category.delta)!)}</DetailMetric>}
    </DetailHero>}>
      {rhythm && <BalanceMonthRhythm key={scope.time.month + rhythm} month={scope.time.month} domain={rhythm} />}
      {drivers.length > 0 && <DetailGroup title="Postes qui expliquent l’écart">
        {drivers.map(row =>
          <DetailRow key={row.stableId} label={subcategoryLabel(row.stableId, resolvedLabels)}>
            {metricValue(row.contribution) === undefined ? "À confirmer" : formatDelta(metricValue(row.contribution)!)}
          </DetailRow>
        )}
      </DetailGroup>}
      <DetailGroup title="Composition du mois habituel" note={composition?.pivotMonthIds.length ? `Mois de référence · ${composition.pivotMonthIds.map(monthTitle).join(" et ")}` : undefined}>
        {entries.length ? <div className={styles.categoryItems}><DetailAmounts rows={entries} /></div>
          : <p className={styles.note}>Pas assez de données pour détailler un mois habituel.</p>}
      </DetailGroup>
      <CategoryProfile axes={[
        { label: "Nécessité", axis: visibleValue(model.classificationViews.necessity) },
        { label: "Fixes et variables", axis: visibleValue(model.classificationViews.behavior) },
        { label: "Quotidien et hors quotidien", axis: visibleValue(model.classificationViews.lifeScope) },
      ]} />
    </DetailCanvas>;
  }}</DetailState>;
}

type PublishedAxis = import("@/analytics/history-v2/month-balance").SpendingAxis;

function CategoryProfile({ axes }: { readonly axes: readonly { readonly label: string; readonly axis?: PublishedAxis }[] }) {
  const visibleAxes = axes.flatMap(({ label, axis }) => {
    const buckets = metricValue(axis?.result);
    return axis && buckets?.length ? [{ label, axis, buckets }] : [];
  });
  if (!visibleAxes.length) return null;

  return <DetailGroup title="Profil des dépenses" wide>
    <div className={styles.categoryAxes}>
      {visibleAxes.map(({ label, axis, buckets }) => <div key={label} className={styles.categoryAxis}>
        <strong>{label}</strong>
        <div className={styles.axisTrack} aria-hidden="true">
          {buckets.map((bucket, index) => bucket.shareOfActual === undefined ? null :
            <span key={bucket.key} data-series={index} style={{ width: String(Math.max(0, Math.min(100, bucket.shareOfActual * 100))) + "%" }} />)}
        </div>
        <ul className={styles.axisLegend}>{buckets.map((bucket, index) => <li key={bucket.key}>
          <i data-series={index} aria-hidden /><span>{spendingPresentationLabel(bucket.key)}</span>
          <strong>{bucket.shareOfActual === undefined ? formatMoney(bucket.amount) : String(Math.round(bucket.shareOfActual * 100)) + " %"}</strong>
        </li>)}</ul>
        {Number(axis.unclassifiedAmount) !== 0 && <small className={styles.note}>{formatMoney(axis.unclassifiedAmount)} non classés</small>}
      </div>)}
    </div>
  </DetailGroup>;
}

function SegmentDetail({ scope, params, contributorKey, categoryBySubcategory, onContributors }: {
  readonly scope: HistoryScope;
  readonly params: Extract<HistoryOverlayTarget, { kind: "segment" }>["params"];
  readonly contributorKey: string;
  readonly categoryBySubcategory: Readonly<Record<string, string>>;
  readonly onContributors: (key: string, ids: readonly string[]) => void;
}) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historySpendingSegmentDetail, scope, params });
  const model = state.status === "success" ? state.response.data : undefined;
  useLayoutEffect(() => {
    if (!model) return;
    const categories = journalItems(model.contributors).flatMap(row => {
      if (row.grain === "CATEGORY") return [row.contributorId];
      return Object.hasOwn(categoryBySubcategory, row.contributorId) ? [categoryBySubcategory[row.contributorId]!] : [];
    });
    onContributors(contributorKey, categories);
  }, [model, contributorKey, categoryBySubcategory, onContributors]);
  return <DetailState state={state}>{model =>
    <DetailCanvas side lead={<DetailHero icon="categories">
      <DisplayState node={model.amount}>{amount => <DetailMetric label="Montant du poste"><MoneyMetric metric={amount} /></DetailMetric>}</DisplayState>
      <DisplayState node={model.otherAmount}>{metric => Number(metricValue(metric)) === 0 ? null :
        <DetailMetric label="Autres dépenses du poste" secondary><MoneyMetric metric={metric} /></DetailMetric>
      }</DisplayState>
    </DetailHero>}>
      <DetailGroup title="Dépenses qui le composent">
        <DisplayState node={model.contributors}>{collection => <CollectionState collection={collection}>{items =>
          <DetailRows label="Dépenses du poste" items={items} cards>{rows => <DetailAmounts rows={rows.map(row => ({
            id: row.contributorId,
            label: row.label,
            amount: moneyAmount(row.amount),
          }))} />}</DetailRows>
        }</CollectionState>}</DisplayState>
      </DetailGroup>
    </DetailCanvas>
  }</DetailState>;
}

function expenseSourceHref(expense: EconomicExpenseSummary) {
  const month = yearMonthOf(expense.economicDate);
  if (!isArchivedRealizedMonth(month) && !isImportedRealizedMonth(month)) return undefined;
  const operationPattern = /^(?:operation:)?([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/iu;
  const ids = new Set(expense.sourceRefs.flatMap(ref => {
    if (ref.kind !== "operation" && (ref.kind !== "economic_component" || !ref.id.startsWith("operation:"))) return [];
    const match = operationPattern.exec(ref.id);
    return match ? [match[1]!] : [];
  }));
  const [id] = ids;
  return ids.size === 1 ? realizedComposerHref(month, `payment-${id}`) : undefined;
}

function ExpenseGroup({ label, node, participants = [], exclude, tone = "linked", sharedPartial = false }: {
  readonly label: string;
  readonly node: import("@/core/history-v2").DisplayNode<import("@/core/history-v2").CollectionValue<EconomicExpenseSummary>>;
  readonly participants?: readonly ParticipantSummary[];
  readonly exclude?: ReadonlySet<string>;
  readonly tone?: "linked" | "context";
  readonly sharedPartial?: boolean;
}) {
  if (node.visibility === "HIDDEN") return null;
  const partial = visibleValue(node)?.status === "PARTIAL";
  return <DetailGroup title={label} tone={tone} note={partial && !sharedPartial ? "Données partielles" : undefined}>
    <DisplayState node={node}>{collection => <CollectionState collection={collection} showPartialNote={false}>{items => {
      const amounts = items.filter(row => !exclude?.has(row.expenseEventId)).map(row => ({
        id: row.expenseEventId,
        label: expenseDisplayTitle(row),
        href: expenseSourceHref(row),
        attribution: participants.find(person => person.participantId === row.narrativeOwnerId)?.label,
        amount: moneyAmount(row.amount),
      }));
      return <DetailRows label={label} items={amounts} cards>{rows => <DetailAmounts rows={rows} />}</DetailRows>;
    }}</CollectionState>}</DisplayState>
  </DetailGroup>;
}

function ActivityDetail({ scope, id, onOpen }: { readonly scope: HistoryScope; readonly id: string; readonly onOpen: OpenDetail }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyActivityDetail, scope, params: { activityTypeKey: id } });
  return <DetailState state={state}>{model =>
    <DetailCanvas side lead={<DetailHero icon="activity">
      <DetailMetric label="Occurrences">{formatCount(model.activity.occurrences, "fois", "fois")}</DetailMetric>
      {model.activity.costKind !== "NONE" && <DetailMetric label={model.activity.costKind === "CAUSAL" ? "Dépenses liées" : "Dépenses associées"} secondary>
        <MoneyMetric metric={model.activity.cost} />
      </DetailMetric>}
    </DetailHero>}>
      <DetailGroup title="Dates de l’activité">
        <DisplayState node={model.occurrences}>{collection => <CollectionState collection={collection}>{items =>
          <DateStrip observations={items.map(row => ({ date: row.effectiveDate, note: row.effectiveTime }))} onOpen={onOpen} />
        }</CollectionState>}</DisplayState>
      </DetailGroup>
      <ExpenseGroup label="Dépenses liées" node={model.causalExpenses} />
      <ExpenseGroup label="Dépenses associées" node={model.associatedExpenses} tone="context" />
    </DetailCanvas>
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

function JournalEvents({ items, label, onOpen }: { readonly items: readonly JournalTimelineItem[]; readonly label: string; readonly onOpen: OpenDetail }) {
  if (!items.length) return null;
  return <DetailGroup title={label}>
    <DetailRows label={label} items={items}>{rows => <ol className={styles.dayTimeline}>{rows.map(row => <li key={row.calendarItemId}>
      {row.moment ? <DetailLink label={row.title}
        trigger={{ kind: "moment", momentId: row.moment.momentId }}
        end={<DisplayState node={row.moment.causalCost}>{value => <MoneyMetric metric={value} />}</DisplayState>}
        onClick={() => onOpen({ target: { kind: "moment", momentId: row.moment!.momentId }, label: row.title })} />
        : <DetailRow label={row.title}>{row.startTime}</DetailRow>}
      <PeopleChips people={row.participants} />
    </li>)}</ol>}</DetailRows>
  </DetailGroup>;
}

function JournalEventExpenses({ items }: { readonly items: readonly JournalTimelineItem[] }) {
  const groups = items.flatMap(event => {
    if (!event.moment) return [];
    const node = event.moment.causalExpenses;
    return [{ event, expenses: journalItems(node), partial: visibleValue(node)?.status === "PARTIAL" }];
  });
  const expenses = groups.flatMap(({ event, expenses }) => expenses.map(row => ({
    id: event.calendarItemId + ":" + row.expenseEventId,
    label: expenseDisplayTitle(row),
    href: expenseSourceHref(row),
    attribution: [groups.length > 1 ? event.title : undefined, event.participants.find(person => person.participantId === row.narrativeOwnerId)?.label].filter(Boolean).join(" · ") || undefined,
    amount: moneyAmount(row.amount),
  })));
  if (!expenses.length) return null;
  return <DetailGroup title="Dépenses liées aux événements" note={groups.some(group => group.partial) ? "Données partielles" : undefined}>
    <DetailRows label="Dépenses liées aux événements" items={expenses} cards>{rows =>
      <DetailAmounts rows={rows} />
    }</DetailRows>
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

function JournalDetail({ date, onOpen, onJournalLinks }: { readonly date: LocalDate; readonly onOpen: OpenDetail; readonly onJournalLinks: (date: LocalDate, momentIds: readonly string[]) => void }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyDayJournal, scope: monthScope(yearMonthOf(date)), params: { date } });
  const model = state.status === "success" ? state.response.data : undefined;
  useLayoutEffect(() => {
    if (!model) return;
    const events = [...journalItems(model.timedTimeline), ...journalItems(model.untimedEvents)];
    onJournalLinks(date, events.flatMap(row => row.moment && journalItems(row.moment.causalExpenses).some(expense => expense.economicDate === date) ? [row.moment.momentId] : []));
  }, [model, date, onJournalLinks]);
  return <DetailState state={state}>{model =>
    <DetailCanvas side lead={<DetailHero icon="events" context={<PeopleChips people={journalItems(model.dayParticipants)} />}>
      <DisplayState node={model.economicAmount}>{amount => <DetailMetric label="Total des dépenses du jour"><MoneyMetric metric={amount} /></DetailMetric>}</DisplayState>
    </DetailHero>}>
      <ExpenseGroup label="Autres dépenses du jour" node={model.otherMovements.otherExpenses} tone="context" participants={journalItems(model.dayParticipants)} />
      <JournalEvents label="Événements du jour" onOpen={onOpen} items={[...journalItems(model.timedTimeline), ...journalItems(model.untimedEvents)]} />
      <JournalEventExpenses items={[...journalItems(model.timedTimeline), ...journalItems(model.untimedEvents)]} />
    </DetailCanvas>
  }</DetailState>;
}

const momentIcons = new Map<string, ClayIconName>([
  ["beach", "beach"], ["family", "family"], ["travel", "travel"], ["night", "night"],
  ["concert", "concert"], ["restaurant", "restaurant"], ["celebration", "celebration"], ["sport", "activity"],
]);

function MomentDetail({ scope, id }: { readonly scope: HistoryScope; readonly id: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMomentDetail, scope, params: { momentId: id } });
  return <DetailState state={state}>{model => {
    const linkedIds = new Set(journalItems(model.causalExpenses).map(expense => expense.expenseEventId));
    const sharedPartial = visibleValue(model.causalExpenses)?.status === "PARTIAL"
      && visibleValue(model.spentDuringExpenses)?.status === "PARTIAL";
    const icon = momentIcons.get(model.moment.fallbackIconKey) ?? "events";
    return <DetailCanvas side lead={<DetailHero icon={icon} context={<>
      <span>{formatFrenchDateRange(model.moment.startDate, model.moment.endDate)}</span>
      <MomentParticipants date={model.moment.startDate} momentId={id} />
    </>} note={sharedPartial ? "Achats recensés partiellement" : undefined}>
      <DisplayState node={model.causalCost}>{amount => <DetailMetric label="Dépenses liées"><MoneyMetric metric={amount} /></DetailMetric>}</DisplayState>
      <DisplayState node={model.spentDuring}>{amount => <DetailMetric label="Dépenses sur la période" secondary><MoneyMetric metric={amount} /></DetailMetric>}</DisplayState>
    </DetailHero>}>
      <ExpenseGroup label="Achats liés au moment" node={model.causalExpenses} sharedPartial={sharedPartial} />
      <ExpenseGroup label="Autres achats sur la période" node={model.spentDuringExpenses}
        tone="context" exclude={linkedIds} sharedPartial={sharedPartial} />
    </DetailCanvas>;
  }}</DetailState>;
}

function DateStrip({ observations, onOpen }: { readonly observations: readonly { readonly date: LocalDate; readonly note?: string }[]; readonly onOpen: OpenDetail }) {
  const grouped = Map.groupBy(observations, observation => observation.date);
  const ordered = [...grouped.keys()].toSorted();
  return <DetailRows label="Jours" items={ordered} size={7} cards>{rows => <ul className={styles.dateStrip}>
    {rows.map((date, index) => {
      const notes = grouped.get(date)?.flatMap(item => item.note ? [item.note] : []) ?? [];
      const label = [`Ouvrir le ${formatFrenchDate(date)}`, ...notes].join(" · ");
      return <li key={date}>
      <button type="button" title={label} aria-label={label} data-balance-trigger={overlayTargetKey({ kind: "journal", date })}
        onClick={() => onOpen({ target: { kind: "journal", date }, label: formatFrenchDate(date) })}>
        {(index === 0 || rows[index - 1]?.slice(0, 7) !== date.slice(0, 7)) && <small>{formatFrenchDate(date, false).split(" ").slice(1).join(" ")}</small>}
        <time dateTime={date}>{Number(date.slice(-2))}</time>
      </button>
    </li>;
    })}
  </ul>}</DetailRows>;
}

function PlaceDetail({ scope, id, onOpen }: { readonly scope: HistoryScope; readonly id: string; readonly onOpen: OpenDetail }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyPlaceDetail, scope, params: { placeId: id } });
  return <DetailState state={state}>{model =>
    <DetailCanvas side lead={<DetailHero icon="travel">
      <DetailMetric label="Jours de présence">{model.place.presenceDays}</DetailMetric>
      <DisplayState node={model.localizedAmount}>{amount => <DetailMetric label="Dépenses localisées" secondary><MoneyMetric metric={amount} /></DetailMetric>}</DisplayState>
    </DetailHero>}>
      <DetailGroup title="Dates de présence">
        <DisplayState node={model.presenceDays}>{collection => <CollectionState collection={collection}>{items =>
          <DateStrip observations={items.map(row => ({ date: row.date, note: formatCount(row.presenceCount, "présence") }))} onOpen={onOpen} />
        }</CollectionState>}</DisplayState>
      </DetailGroup>
    </DetailCanvas>
  }</DetailState>;
}
