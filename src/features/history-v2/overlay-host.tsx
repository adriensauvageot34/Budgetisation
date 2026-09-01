"use client";

import { useRef, useState } from "react";
import type {
  ActivityDetailReadModel,
  BankEconomyBridgeReadModel,
  CategoryDetailReadModel,
  JournalDayReadModel,
  MomentDetailReadModel,
  PlaceDetailReadModel,
  SpendingSegmentDetailReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import type { YearMonth } from "@/core/time";
import { yearMonthOf } from "@/core/time";
import { useQueryRuntime } from "@/components/runtime/query-client";
import { OverlayFrame } from "@/ui";
import {
  expenseDisplayTitle,
  formatCount,
  formatFrenchDate,
  formatFrenchDateRange,
  spendingPresentationLabel,
} from "./presentation";
import { CollectionState, DisplayState, MetricState, MoneyMetric, PartialDataNote, StateBoundary, formatMoney } from "./renderers";
import type { HistoryOverlayTarget } from "./types";
import styles from "./history-v2.module.css";

function scope(month: YearMonth) {
  return { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
}

function overlayTitle(target: HistoryOverlayTarget): string {
  switch (target.kind) {
    case "journal": return "Journal du jour";
    case "bridge": return "Banque → Économie";
    case "category": return "Détail de catégorie";
    case "segment": return "Détail du segment";
    case "activity": return "Détail de l’activité";
    case "moment": return "Détail du moment";
    case "place": return "Détail du lieu";
  }
}

function widthClass(target: HistoryOverlayTarget): string {
  if (target.kind === "journal") return styles.overlayJournal;
  if (target.kind === "moment") return styles.overlayMoment;
  if (target.kind === "place") return styles.overlayPlace;
  return styles.overlayStandard;
}

export function HistoryOverlayHost({
  month,
  stack,
  onClose,
  onBack,
  onReplace,
  onPush,
}: {
  readonly month: YearMonth;
  readonly stack: readonly HistoryOverlayTarget[];
  readonly onClose: () => void;
  readonly onBack: () => void;
  readonly onReplace: (target: HistoryOverlayTarget) => void;
  readonly onPush: (target: HistoryOverlayTarget) => void;
}) {
  const target = stack.at(-1);
  if (target === undefined) return null;
  return (
    <OverlayFrame
      key={`${target.kind}-${stack.length}`}
      title={overlayTitle(target)}
      kind="day_drawer"
      className={widthClass(target)}
      closeOnBackdrop
      closeAction={{ kind: "callback", onAction: onClose }}
      {...(stack.length > 1 ? { backAction: { kind: "callback" as const, onAction: onBack } } : {})}
    >
      <OverlayContent month={month} target={target} onReplace={onReplace} onPush={onPush} />
    </OverlayFrame>
  );
}

function OverlayContent({ month, target, onReplace, onPush }: { readonly month: YearMonth; readonly target: HistoryOverlayTarget; readonly onReplace: (target: HistoryOverlayTarget) => void; readonly onPush: (target: HistoryOverlayTarget) => void }) {
  switch (target.kind) {
    case "journal": return <JournalPanel date={target.date} onReplace={onReplace} onPush={onPush} />;
    case "bridge": return <BridgePanel month={month} />;
    case "category": return <CategoryPanel month={month} categoryId={target.categoryId} />;
    case "segment": return <SegmentPanel month={month} params={target.params} />;
    case "activity": return <ActivityPanel month={month} activityTypeKey={target.activityTypeKey} onPush={onPush} />;
    case "moment": return <MomentPanel month={month} momentId={target.momentId} />;
    case "place": return <PlacePanel month={month} placeId={target.placeId} />;
  }
}

function JournalPanel({ date, onReplace, onPush }: { readonly date: import("@/core/time").LocalDate; readonly onReplace: (target: HistoryOverlayTarget) => void; readonly onPush: (target: HistoryOverlayTarget) => void }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyDayJournal, scope: scope(yearMonthOf(date)), params: { date } });
  return <StateBoundary state={state}>{(model: JournalDayReadModel) => <div className={styles.journal}><header><div><span className="eyebrow">{formatFrenchDate(model.date)}</span><DisplayState node={model.economicAmount}>{(metric) => <><MoneyMetric metric={metric} className={styles.journalAmount} partialDisplay="value-only" /><PartialDataNote metric={metric} /></>}</DisplayState></div><DisplayState node={model.dayParticipants}>{(collection) => <CollectionState collection={collection} showPartialNote={false}>{(items) => <div className={styles.participants}>{items.map((item) => <span key={item.participantId}>{item.label}</span>)}</div>}</CollectionState>}</DisplayState></header><div className={styles.journalNavigation}><button type="button" className="button-secondary" onClick={() => onReplace({ kind: "journal", date: model.navigation.previousDate })}>J−1</button><button type="button" className="button-secondary" onClick={() => onReplace({ kind: "journal", date: model.navigation.nextDate })}>J+1</button></div><JournalTimeline model={model} onPush={onPush} /></div>}</StateBoundary>;
}

function JournalTimeline({ model, onPush }: { readonly model: JournalDayReadModel; readonly onPush: (target: HistoryOverlayTarget) => void }) {
  return <div className={styles.journalSections}>
    <DisplayState node={model.contexts}>{(collection) => <CollectionState collection={collection} showPartialNote={false}>{(items) => <section><h3>Contextes du jour</h3><div className={styles.participants}>{items.map((item) => <span key={`${item.personId}-${item.contextTypeKey}`}>{item.label}</span>)}</div></section>}</CollectionState>}</DisplayState>
    <DisplayState node={model.activeContinuousEvents}>{(collection) => <CollectionState collection={collection} showPartialNote={false}>{(items) => <section><h3>Événements continus</h3>{items.map((item) => <article key={item.calendarItemId}><strong>{item.title}</strong><span>{formatFrenchDateRange(item.startDate, item.endDate)} · jour {dayOffset(model.date, item.startDate)}/{dayOffset(item.endDate, item.startDate)}</span></article>)}</section>}</CollectionState>}</DisplayState>
    <DisplayState node={model.timedTimeline}>{(collection) => <CollectionState collection={collection} showPartialNote={false}>{(items) => <section><h3>Chronologie</h3>{items.map((item) => <article key={item.calendarItemId}><time>{item.startTime}</time><div><strong>{item.title}</strong>{item.placeLabel ? <span>{item.placeLabel}</span> : null}{item.moment ? <><span>Dépenses liées : <DisplayState node={item.moment.causalCost}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></span><span>Dépensé pendant : <DisplayState node={item.moment.spentDuring}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></span><button type="button" className="button-ghost" onClick={() => onPush({ kind: "moment", momentId: item.moment!.momentId })}>Ouvrir le moment</button></> : null}</div></article>)}</section>}</CollectionState>}</DisplayState>
    <DisplayState node={model.untimedEvents}>{(collection) => <CollectionState collection={collection} showPartialNote={false}>{(items) => <section><h3>Sans horaire précisé</h3>{items.map((item) => <article key={item.calendarItemId}><div><strong>{item.title}</strong>{item.placeLabel ? <span>{item.placeLabel}</span> : null}{item.moment ? <><span>Dépenses liées : <DisplayState node={item.moment.causalCost}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></span><span>Dépensé pendant : <DisplayState node={item.moment.spentDuring}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></span><button type="button" className="button-ghost" onClick={() => onPush({ kind: "moment", momentId: item.moment!.momentId })}>Ouvrir le moment</button></> : null}</div></article>)}</section>}</CollectionState>}</DisplayState>
    <details><summary>Dépenses et autres mouvements</summary><div className={styles.otherMovements}><ExpenseCollection title="Dépenses du jour" node={model.otherMovements.otherExpenses} showPartialNote={false} /><MoneyCollection title="Remboursements et ajustements" node={model.otherMovements.refundsAndAdjustments} showPartialNote={false} /><MoneyCollection title="Entrées" node={model.otherMovements.inflows} showPartialNote={false} /><MoneyCollection title="Mouvements techniques" node={model.otherMovements.technicalMovements} showPartialNote={false} /></div></details>
  </div>;
}

function dayOffset(date: import("@/core/time").LocalDate, start: import("@/core/time").LocalDate): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

function ExpenseCollection({ title, node, showPartialNote = true }: { readonly title: string; readonly node: JournalDayReadModel["otherMovements"]["otherExpenses"]; readonly showPartialNote?: boolean }) {
  return <DisplayState node={node}>{(collection) => <CollectionState collection={collection} showPartialNote={showPartialNote}>{(items) => <section><h4>{title}</h4>{items.map((item) => { const displayTitle = expenseDisplayTitle(item); return <div className={styles.expenseRow} key={item.expenseEventId}><div className={styles.expenseIdentity}><strong>{displayTitle}</strong>{displayTitle === item.label ? null : <details className={styles.rawLabelDisclosure}><summary>Voir le libellé bancaire</summary><p>{item.label}</p></details>}</div><strong>{formatMoney(item.amount)}</strong></div>; })}</section>}</CollectionState>}</DisplayState>;
}

function MoneyCollection<T extends { readonly movementId: string; readonly label: string; readonly amount: import("@/core/money").Money }>({ title, node, showPartialNote = true }: { readonly title: string; readonly node: import("@/core/history-v2").DisplayNode<import("@/core/history-v2").CollectionValue<T>>; readonly showPartialNote?: boolean }) {
  return <DisplayState node={node}>{(collection) => <CollectionState collection={collection} showPartialNote={showPartialNote}>{(items) => <section><h4>{title}</h4>{items.map((item) => <div key={item.movementId}><span>{item.label}</span><strong>{formatMoney(item.amount)}</strong></div>)}</section>}</CollectionState>}</DisplayState>;
}

function BridgePanel({ month }: { readonly month: YearMonth }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyBankEconomyBridge, scope: scope(month), params: {} });
  return <StateBoundary state={state}>{(model: BankEconomyBridgeReadModel) => <DisplayState node={model.bridge}>{(bridge) => <div className={styles.bridge}><div className={styles.bridgeEquation}><span>Débits du compte <strong>{formatMoney(bridge.bankOutflows)}</strong></span><span>Dépenses du mois <strong>{formatMoney(bridge.actual)}</strong></span><span>Écart <strong>{formatMoney(bridge.gap)}</strong></span></div><ol>{bridge.lines.map((line) => <li key={line.lineId}><span>{line.label}</span><strong>{formatMoney(line.signedAmount)}</strong></li>)}</ol><div className={styles.reconciliationRow}><span>Résiduel</span><MoneyMetric metric={bridge.result} /></div></div>}</DisplayState>}</StateBoundary>;
}

const categoryTabs = ["explanation", "composition", "necessity", "behavior", "lifeScope"] as const;
type CategoryTab = (typeof categoryTabs)[number];
const categoryTabLabels: Readonly<Record<CategoryTab, string>> = {
  explanation: "Explication",
  composition: "Composition",
  necessity: "Nécessité",
  behavior: "Fixe-Variable",
  lifeScope: "Contexte",
};

function CategoryPanel({ month, categoryId }: { readonly month: YearMonth; readonly categoryId: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyCategoryDetail, scope: scope(month), params: { categoryId } });
  const [tab, setTab] = useState<CategoryTab>("explanation");
  const [expanded, setExpanded] = useState(false);
  const tabRefs = useRef<Partial<Record<CategoryTab, HTMLButtonElement>>>({});
  const moveTab = (current: CategoryTab, direction: -1 | 1) => {
    const index = categoryTabs.indexOf(current);
    const next = categoryTabs[(index + direction + categoryTabs.length) % categoryTabs.length]!;
    setTab(next);
    tabRefs.current[next]?.focus();
  };
  return <StateBoundary state={state}>{(model: CategoryDetailReadModel) => <div><header className={styles.detailHeader}><h3>{model.category.label}</h3><MoneyMetric metric={model.category.actual} /></header><div className={`${styles.localTabs} ${styles.categoryTabs}`} role="tablist" aria-label="Détail catégorie">{categoryTabs.map((value) => <button ref={(node) => { if (node === null) delete tabRefs.current[value]; else tabRefs.current[value] = node; }} key={value} type="button" role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); moveTab(value, 1); } if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(value, -1); } }} onClick={() => setTab(value)}>{categoryTabLabels[value]}</button>)}</div>{tab === "explanation" ? <><DisplayState node={model.explanation}>{(explanation) => <section className={styles.detailSection}><h4>Facteurs</h4>{explanation.drivers.map((driver) => <div key={driver.stableId} className={styles.reconciliationRow}><span>{driver.label}</span><MoneyMetric metric={driver.contribution} /></div>)}{explanation.compensator ? <div className={styles.reconciliationRow}><span>Compensateur · {explanation.compensator.label}</span><MoneyMetric metric={explanation.compensator.contribution} /></div> : null}<div className={styles.reconciliationRow}><span>Résiduel</span><MoneyMetric metric={explanation.residual} /></div></section>}</DisplayState><DisplayState node={model.frequencyTicket}>{(diagnostic) => diagnostic.availability === "KNOWN" ? <p>Diagnostic fréquence × ticket : {diagnostic.dominantFactor}</p> : null}</DisplayState><DisplayState node={model.merchantAndPurchaseDrivers}>{(collection) => <CollectionState collection={collection}>{(items) => <section><h4>Marchands et achats</h4>{items.map((item) => <div key={item.explanationId} className={styles.reconciliationRow}><span>{item.label}{item.rankBadge ? ` · #${item.rankBadge}` : ""}</span><strong>{formatMoney(item.contribution)}</strong></div>)}</section>}</CollectionState>}</DisplayState></> : tab === "composition" ? <DisplayState node={model.typicalComposition}>{(composition) => { const entries = Object.entries(composition.amountsByStableId); return <section><p>Mois pivots : {composition.pivotMonthIds.join(", ")}</p>{entries.slice(0, expanded ? entries.length : 8).map(([key, metric]) => <div className={styles.reconciliationRow} key={key}><span>{key}</span><MoneyMetric metric={metric} /></div>)}{entries.length > 8 && !expanded ? <button type="button" className="button-secondary" onClick={() => setExpanded(true)}>Afficher les {entries.length} composantes</button> : null}</section>; }}</DisplayState> : <DisplayState node={model.classificationViews[tab]}>{(axis) => <CategoryAxisView axis={axis} />}</DisplayState>}{model.lifecycleBadges.length > 0 ? <div className={styles.badgeRow}>{model.lifecycleBadges.map((badge) => <span className="badge" key={badge.stableId}>{badge.lifecycle === "NEW" ? "Nouveau" : "Réapparu"}</span>)}</div> : null}</div>}</StateBoundary>;
}

function CategoryAxisView({ axis }: { readonly axis: import("@/analytics/history-v2/month-balance").SpendingAxis }) {
  const result = axis.result;
  const buckets = result.status === "KNOWN" || result.status === "PARTIAL" ? result.value : [];
  return <section className={styles.detailSection} aria-label="Classification de la catégorie">{result.status === "PARTIAL" ? <p className={styles.inlineStatus}>Classification partielle · les inconnus ne sont pas renormalisés.</p> : result.status === "UNKNOWN" || result.status === "CONFLICT" ? <p className={styles.placeholder}>{result.status === "CONFLICT" ? "Classification à vérifier" : "Classification indisponible"}</p> : null}{buckets.map((bucket) => <div key={bucket.key} className={styles.reconciliationRow}><span>{spendingPresentationLabel(bucket.key)}{bucket.shareOfActual === undefined ? "" : ` · ${new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(bucket.shareOfActual)}`}</span><strong>{formatMoney(bucket.amount)}</strong></div>)}<div className={styles.reconciliationRow}><span>Total classé</span><strong>{formatMoney(axis.classifiedAmount)}</strong></div>{Number(axis.unclassifiedAmount) === 0 ? null : <div className={styles.reconciliationRow} data-quality="partial"><span>Non classé</span><strong>{formatMoney(axis.unclassifiedAmount)}</strong></div>}{axis.coverageRatio === undefined ? null : <p>Couverture publiée : {new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(axis.coverageRatio)}</p>}</section>;
}

function SegmentPanel({ month, params }: { readonly month: YearMonth; readonly params: import("@/query-api").HistorySpendingSegmentDetailParams }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historySpendingSegmentDetail, scope: scope(month), params });
  return <StateBoundary state={state}>{(model: SpendingSegmentDetailReadModel) => <div><header className={styles.detailHeader}><h3>{"axis" in model.segment ? spendingPresentationLabel(model.segment.bucket ?? "") : spendingPresentationLabel(`${model.segment.necessity}__${model.segment.behavior}`)}</h3><DisplayState node={model.amount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></header><DisplayState node={model.contributors}>{(collection) => <CollectionState collection={collection}>{(items) => <section>{items.map((item) => <div key={item.contributorId} className={styles.reconciliationRow}><span>{item.label}</span><strong>{formatMoney(item.amount)}</strong></div>)}</section>}</CollectionState>}</DisplayState><div className={styles.reconciliationRow}><span>Autres</span><DisplayState node={model.otherAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div></div>}</StateBoundary>;
}

function ActivityPanel({ month, activityTypeKey, onPush }: { readonly month: YearMonth; readonly activityTypeKey: string; readonly onPush: (target: HistoryOverlayTarget) => void }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyActivityDetail, scope: scope(month), params: { activityTypeKey } });
  return <StateBoundary state={state}>{(model: ActivityDetailReadModel) => <div><header className={styles.detailHeader}><h3>{model.activity.label}</h3>{model.activity.costKind === "NONE" ? null : <MoneyMetric metric={model.activity.cost} />}</header><DisplayState node={model.frequencyTicket}>{(diagnostic) => diagnostic.availability === "KNOWN" ? <p>Diagnostic fréquence × ticket : {diagnostic.dominantFactor}</p> : null}</DisplayState><DisplayState node={model.occurrences}>{(collection) => <CollectionState collection={collection}>{(items) => <section><h4>Occurrences</h4>{items.map((item) => <div className={styles.activityOccurrence} key={item.occurrenceId}><button type="button" className="button-ghost" onClick={() => onPush({ kind: "journal", date: item.effectiveDate })}><span>{formatFrenchDate(item.effectiveDate)}{item.effectiveTime ? ` · ${item.effectiveTime}` : ""}</span><span>Ouvrir le Journal</span></button><div className={styles.relatedTargets}>{item.momentIds.map((momentId) => <button type="button" className="button-ghost" key={momentId} onClick={() => onPush({ kind: "moment", momentId })}>Moment lié</button>)}{item.placeIds.map((placeId) => <button type="button" className="button-ghost" key={placeId} onClick={() => onPush({ kind: "place", placeId })}>Lieu lié</button>)}{item.categoryIds.map((categoryId) => <button type="button" className="button-ghost" key={categoryId} onClick={() => onPush({ kind: "category", categoryId })}>Catégorie liée</button>)}</div></div>)}</section>}</CollectionState>}</DisplayState><ExpenseCollection title="Dépenses liées" node={model.causalExpenses} /><ExpenseCollection title="Dépenses associées" node={model.associatedExpenses} /></div>}</StateBoundary>;
}

function MomentPanel({ month, momentId }: { readonly month: YearMonth; readonly momentId: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyMomentDetail, scope: scope(month), params: { momentId } });
  return <StateBoundary state={state}>{(model: MomentDetailReadModel) => <div><header className={styles.detailHeader}><h3>{model.moment.title}</h3><span>{formatFrenchDateRange(model.moment.startDate, model.moment.endDate)}</span></header><div className={styles.dualMetrics}><div><span>Dépenses liées</span><DisplayState node={model.causalCost}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div><div><span>Dépensé pendant</span><DisplayState node={model.spentDuring}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></div></div><ExpenseCollection title="Dépenses liées" node={model.causalExpenses} /><ExpenseCollection title="Dépenses dans la fenêtre" node={model.spentDuringExpenses} /></div>}</StateBoundary>;
}

function PlacePanel({ month, placeId }: { readonly month: YearMonth; readonly placeId: string }) {
  const state = useQueryRuntime({ resource: queryResourceKeys.historyPlaceDetail, scope: scope(month), params: { placeId } });
  return <StateBoundary state={state}>{(model: PlaceDetailReadModel) => <div><header className={styles.detailHeader}><h3>{model.place.label}</h3><DisplayState node={model.localizedAmount}>{(metric) => <MoneyMetric metric={metric} />}</DisplayState></header><MetricState metric={model.localizedCoverage} format={(value) => `${Math.round(value * 100)} % de couverture localisée`} /><DisplayState node={model.presenceDays}>{(collection) => <CollectionState collection={collection}>{(items) => <section><h4>Jours de présence</h4>{items.map((item) => <div key={item.date} className={styles.reconciliationRow}><span>{formatFrenchDate(item.date)}</span><span>{formatCount(item.presenceCount, "présence")}</span></div>)}</section>}</CollectionState>}</DisplayState></div>}</StateBoundary>;
}
