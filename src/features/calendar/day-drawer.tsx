"use client";

import type { RefObject } from "react";
import type { LocalDate } from "@/core/time";
import type { DayJournalMoment, DayOperationPreviewItem, HistoryDayDetailReadModel } from "@/query-api";
import {
  Button,
  EmptyState,
  ErrorState,
  MetricDisplay,
  OverlayFrame,
  OverlaySkeleton,
  RefreshIndicator,
  Surface,
  formatMetricValue,
  type UiTransportState,
} from "@/ui";
import { CalendarIcon } from "./calendar-icon";
import { PersonAvatarCluster } from "./person-avatar";
import type { CalendarNavigation, CalendarPerson } from "./types";
import styles from "./calendar.module.css";

function fullDateLabel(date: LocalDate): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function timeLabel(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(instant));
}

function OperationLine({ operation, navigation }: { readonly operation: DayOperationPreviewItem; readonly navigation: CalendarNavigation }) {
  const amount = formatMetricValue(operation.amount, "EUR");
  return (
    <li className={styles.operationLine}>
      <button type="button" onClick={() => navigation.openExploration({ kind: "operation", id: operation.operationId })}>
        <span>{operation.label}</span>
        <strong aria-label={amount.accessibleValueText}>{amount.primaryText}</strong>
      </button>
    </li>
  );
}

function MomentCard({ moment, model, persons, navigation }: {
  readonly moment: DayJournalMoment;
  readonly model: HistoryDayDetailReadModel;
  readonly persons: readonly CalendarPerson[];
  readonly navigation: CalendarNavigation;
}) {
  const time = moment.startAt === undefined
    ? null
    : moment.endAt === undefined
      ? timeLabel(moment.startAt, model.timezone)
      : `${timeLabel(moment.startAt, model.timezone)} — ${timeLabel(moment.endAt, model.timezone)}`;
  return (
    <li>
      <Surface variant="outlined" className={styles.momentCard}>
        <div className={styles.momentHeader}>
          <span className={styles.momentIcon}><CalendarIcon kind={moment.kind} /></span>
          <span className={styles.momentIdentity}>
            {time === null ? null : <small>{time}</small>}
            <strong>{moment.label}</strong>
          </span>
          <PersonAvatarCluster participantIds={moment.participantIds} persons={persons} />
        </div>
        <div className={styles.momentMeta}>
          {moment.place ? (
            <button type="button" onClick={() => navigation.openExploration({ kind: "place", id: moment.place!.placeId })}>
              <CalendarIcon kind="place" />
              <span>{moment.place.label}</span>
            </button>
          ) : null}
          {moment.economicAmount ? <MetricDisplay metric={moment.economicAmount} variant="compact" /> : null}
        </div>
        {moment.operations.length > 0 ? (
          <ul className={styles.embeddedOperations} aria-label={`Mouvements liés à ${moment.label}`}>
            {moment.operations.map((operation) => <OperationLine key={operation.operationId} operation={operation} navigation={navigation} />)}
          </ul>
        ) : null}
        {moment.target ? (
          <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.openExploration(moment.target!) }}>
            Explorer ce repère
          </Button>
        ) : null}
      </Surface>
    </li>
  );
}

function Journal({ model, persons, navigation }: {
  readonly model: HistoryDayDetailReadModel;
  readonly persons: readonly CalendarPerson[];
  readonly navigation: CalendarNavigation;
}) {
  if (model.moments.length === 0 && model.unlinkedOperations.length === 0) {
    return <EmptyState title="Journée sans entrée documentée" description="Le journal reste vide lorsqu’aucun fait canonique n’est disponible." />;
  }
  return (
    <div className={styles.journal}>
      {model.moments.length > 0 ? (
        <ol className={styles.journalTimeline}>
          {model.moments.map((moment) => <MomentCard key={moment.id} moment={moment} model={model} persons={persons} navigation={navigation} />)}
        </ol>
      ) : null}
      {model.unlinkedOperations.length > 0 ? (
        <section className={styles.unlinkedMovements}>
          <h3>Mouvements sans moment associé</h3>
          <ul className={styles.embeddedOperations}>
            {model.unlinkedOperations.map((operation) => <OperationLine key={operation.operationId} operation={operation} navigation={navigation} />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function DayDetailDrawer({
  date,
  persons,
  state,
  navigation,
  open = true,
  topmost = true,
  suspended = false,
  backgroundRootRef,
  restoreFocusRef,
  onRetry,
}: {
  readonly date: LocalDate;
  readonly persons: readonly CalendarPerson[];
  readonly state: UiTransportState<HistoryDayDetailReadModel>;
  readonly navigation: CalendarNavigation;
  readonly open?: boolean;
  readonly topmost?: boolean;
  readonly suspended?: boolean;
  readonly backgroundRootRef?: RefObject<HTMLElement | null>;
  readonly restoreFocusRef?: RefObject<HTMLElement | null>;
  readonly onRetry?: () => void;
}) {
  const response = state.status === "success" ? state.response : state.status === "error" ? state.previousData : undefined;
  const model = response?.data;
  let content;
  if (state.status === "idle" || state.status === "loading") content = <OverlaySkeleton />;
  else if (state.status === "error" && model === undefined) content = <ErrorState error={state.error} onRetry={onRetry} />;
  else if (model !== undefined) content = (
    <div className={styles.drawerContent}>
      <section className={styles.dayPulse} aria-label="Pouls financier du jour">
        <span>Dépense économique</span>
        <MetricDisplay metric={model.finance.economicAmount} />
      </section>
      <Journal model={model} persons={persons} navigation={navigation} />
      {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : null}
      {state.status === "error" ? <RefreshIndicator failed announce /> : null}
    </div>
  );
  else throw new TypeError("Réponse Day Detail indisponible.");
  return (
    <OverlayFrame
      title="Journal du jour"
      subtitle={fullDateLabel(model?.date ?? date)}
      kind="day_drawer"
      open={open}
      topmost={topmost}
      suspended={suspended}
      closeAction={{ kind: "callback", onAction: () => navigation.closeDay() }}
      backgroundRootRef={backgroundRootRef}
      restoreFocusRef={restoreFocusRef}
    >
      <div className={styles.drawerContent}>
        <nav className={styles.drawerNavigation} aria-label="Navigation entre les jours">
          <Button tone="secondary" action={{ kind: "callback", onAction: () => navigation.previousDay() }}>Jour précédent</Button>
          <Button tone="secondary" action={{ kind: "callback", onAction: () => navigation.nextDay() }}>Jour suivant</Button>
        </nav>
        {content}
      </div>
    </OverlayFrame>
  );
}
