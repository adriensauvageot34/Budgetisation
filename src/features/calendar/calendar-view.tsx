"use client";

import { addDays, addMonths, type LocalDate, type YearMonth } from "@/core/time";
import type { MonetaryMetricUnit, Money } from "@/core/money";
import type {
  CalendarDayCell,
  HistoryCalendarMonthReadModel,
  HistoryCalendarMonthSummaryReadModel,
} from "@/query-api";
import type { CalendarWeekRef } from "@/navigation";
import {
  Button,
  CardSurface,
  DesktopFrame,
  EmptyState,
  ErrorState,
  MetricDisplay,
  QualityBadge,
  RefreshIndicator,
  ResponsiveCardGrid,
  SectionLayout,
  SectionSkeleton,
  Surface,
  WeekBars,
  resolveMetricDisplay,
  type UiTransportState,
  type SevenDayPoints,
} from "@/ui";
import {
  adjacentWeek,
  buildMonthGrid,
  calendarWeekRange,
  calendarWeekRefFor,
  monthGridWeekRefs,
  selectCalendarWeek,
  selectTwelveCompleteMonthSummaries,
} from "./model";
import type { CalendarNavigation } from "./types";
import styles from "./calendar.module.css";

const monthNames = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;
const weekdayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

function monthLabel(month: YearMonth): string {
  const [year, rawMonth] = month.split("-");
  return `${monthNames[Number(rawMonth) - 1]} ${year}`;
}

function dayLabel(date: LocalDate, long = false): string {
  const plain = date.split("-");
  const day = Number(plain[2]);
  const month = monthNames[Number(plain[1]) - 1];
  return long ? `${day} ${month} ${plain[0]}` : String(day);
}

function dayContextLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    work_onsite: "Travail sur site",
    remote: "Télétravail",
    weekend_home: "Week-end à domicile",
    leave_home: "Congé à domicile",
  };
  return labels[value] ?? value;
}

function PeriodQuality({ day }: { readonly day: CalendarDayCell }) {
  const partial = day.flags.includes("partial_data");
  const incomplete = day.flags.includes("incomplete_period");
  const conflict = day.flags.includes("conflict");
  return (
    <span className={styles.badges}>
      {partial ? <QualityBadge state="partial" /> : null}
      {incomplete ? <QualityBadge state="incomplete" /> : null}
      {conflict ? <QualityBadge state="conflict" /> : null}
    </span>
  );
}

export function CalendarDayCard({
  day,
  navigation,
  compact = false,
}: {
  readonly day: CalendarDayCell;
  readonly navigation: CalendarNavigation;
  readonly compact?: boolean;
}) {
  const metric = resolveMetricDisplay(day.economicAmount, { variant: "compact" });
  const contextLabel = day.dayContext.kind === "known"
    ? day.dayContext.values.map(dayContextLabel).join(" · ") || null
    : day.dayContext.kind === "conflict"
      ? "Contexte à vérifier"
      : null;
  const contents = (
    <>
      <span className={styles.dayHeading}>
        <strong>{dayLabel(day.date, compact)}</strong>
        <PeriodQuality day={day} />
      </span>
      {contextLabel === null ? null : <span className={styles.dayMeta}>{contextLabel}</span>}
      <MetricDisplay metric={day.economicAmount} variant="compact" />
      <span className={styles.counts}>
        {day.activityOccurrenceCount ? (
          <span>Activités <MetricDisplay metric={day.activityOccurrenceCount} variant="compact" /></span>
        ) : null}
        {day.placeVisitCount ? (
          <span>Lieux <MetricDisplay metric={day.placeVisitCount} variant="compact" /></span>
        ) : null}
        {day.operationCount ? (
          <span>Opérations <MetricDisplay metric={day.operationCount} variant="compact" /></span>
        ) : null}
      </span>
    </>
  );
  if (!day.hasDetail) {
    return (
      <Surface variant="subtle" action={{ kind: "disabled", reason: "Aucun détail disponible pour ce jour." }} className={styles.dayCard}>
        {contents}
      </Surface>
    );
  }
  return (
    <Surface
      variant="outlined"
      action={{ kind: "callback", onAction: () => navigation.openDay(day.date) }}
      className={styles.dayCard}
      ariaLabel={`Ouvrir le ${dayLabel(day.date, true)}, ${metric.accessibleText ?? "montant non disponible"}`}
    >
      {contents}
    </Surface>
  );
}

export function CalendarTwelveMonths({
  state,
  navigation,
  onRetry,
}: {
  readonly state: UiTransportState<readonly HistoryCalendarMonthSummaryReadModel[]>;
  readonly navigation?: Pick<CalendarNavigation, "openCalendarMonth">;
  readonly onRetry?: () => void;
}) {
  let content;
  if (state.status === "idle" || state.status === "loading") content = <SectionSkeleton />;
  else if (state.status === "error" && state.previousData === undefined) {
    content = <ErrorState error={state.error} onRetry={onRetry} />;
  } else {
    const response = state.status === "success" ? state.response : state.previousData;
    const months = selectTwelveCompleteMonthSummaries(response?.data ?? []);
    content = months.length === 0 ? (
      <EmptyState
        title="Aucun mois complet disponible"
        description="La vue annuelle n’invente aucune période manquante."
      />
    ) : (
      <>
        {months.length < 12 ? <p className={styles.dayMeta}>Seuls {months.length} mois complets sont actuellement disponibles.</p> : null}
        <ResponsiveCardGrid label="Douze derniers mois complets">
          {months.map((model) => (
            <CardSurface
              key={model.month}
              variant="outlined"
              action={navigation
                ? { kind: "callback", onAction: () => navigation.openCalendarMonth(model.month) }
                : { kind: "disabled", reason: "Navigation Calendar indisponible." }}
              ariaLabel={`Ouvrir ${monthLabel(model.month)}`}
              className={styles.monthCard}
            >
              <span className={styles.eyebrow}>Mois complet</span>
              <strong>{monthLabel(model.month)}</strong>
              <MetricDisplay metric={model.summary.economicAmount} />
              <span className={styles.monthFacts}>
                {model.summary.daysWithActivity ? (
                  <span>Jours avec activité <MetricDisplay metric={model.summary.daysWithActivity} variant="compact" /></span>
                ) : null}
                {model.summary.daysWithPlaceVisit ? (
                  <span>Jours avec lieu <MetricDisplay metric={model.summary.daysWithPlaceVisit} variant="compact" /></span>
                ) : null}
              </span>
            </CardSurface>
          ))}
        </ResponsiveCardGrid>
        {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : null}
        {state.status === "error" ? <RefreshIndicator failed announce /> : null}
      </>
    );
  }
  return (
    <DesktopFrame label="Historique Calendar" className={styles.frame}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Historique</span>
        <h1>Calendar</h1>
        <p>Les douze derniers mois complets, sans recomposition locale des métriques.</p>
      </header>
      <SectionLayout title="12 mois" description="Synthèses fournies par history_calendar_month_summary.">
        {content}
      </SectionLayout>
    </DesktopFrame>
  );
}

export function CalendarMonth({
  month,
  state,
  navigation,
  onRetry,
}: {
  readonly month: YearMonth;
  readonly state: UiTransportState<HistoryCalendarMonthReadModel>;
  readonly navigation?: CalendarNavigation;
  readonly onRetry?: () => void;
}) {
  const response = state.status === "success"
    ? state.response
    : state.status === "error"
      ? state.previousData
      : undefined;
  const model = response?.data;
  if (model !== undefined && model.month !== month) {
    throw new TypeError("Le read model Calendar ne correspond pas au mois de la route.");
  }
  let content: React.ReactNode;
  if (state.status === "idle" || state.status === "loading") {
    content = <SectionSkeleton />;
  } else if (state.status === "error" && model === undefined) {
    content = <ErrorState error={state.error} onRetry={onRetry} />;
  } else if (model === undefined) {
    throw new TypeError("Réponse mensuelle Calendar indisponible.");
  } else {
    const slots = buildMonthGrid(model);
    const weeks = monthGridWeekRefs(model);
    content = (
      <>
        <div className={styles.calendarGrid} role="grid" aria-label={`Jours de ${monthLabel(month)}`}>
          <span className={styles.weekHeading}>Sem.</span>
          {weekdayNames.map((name) => <span key={name} className={styles.weekday} role="columnheader">{name}</span>)}
          {Array.from({ length: slots.length / 7 }, (_, row) => {
            const firstSlot = slots[row * 7];
            const week = weeks[row] ?? (firstSlot?.kind === "day" ? calendarWeekRefFor(firstSlot.day.date) : undefined);
            return [
              <Button key={`week-${row}`} tone="quiet" size="sm" action={navigation && week ? { kind: "callback", onAction: () => navigation.openCalendarWeek(month, week) } : { kind: "disabled" }} className={styles.weekButton}>{week?.replace("semaine-", "S") ?? "—"}</Button>,
              ...slots.slice(row * 7, row * 7 + 7).map((slot) => slot.kind === "padding"
                ? <span key={slot.key} className={styles.padding} aria-hidden="true" />
                : <CalendarDayCard key={slot.key} day={slot.day} navigation={navigation ?? disabledNavigation} />),
            ];
          })}
        </div>
        {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : null}
        {state.status === "error" ? <RefreshIndicator failed announce /> : null}
      </>
    );
  }
  return (
    <DesktopFrame label={`Calendrier ${monthLabel(month)}`} className={styles.frame}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Calendar · mois</span>
        <div className={styles.titleRow}>
          <Button tone="secondary" action={navigation ? { kind: "callback", onAction: () => navigation.openCalendarMonth(addMonths(month, -1)) } : { kind: "disabled" }}>Mois précédent</Button>
          <h1>{monthLabel(month)}</h1>
          <Button tone="secondary" action={navigation ? { kind: "callback", onAction: () => navigation.openCalendarMonth(addMonths(month, 1)) } : { kind: "disabled" }}>Mois suivant</Button>
        </div>
        <div className={styles.headerActions}>
          {model === undefined ? null : <span className={styles.dayMeta}>Sujet : {model.subject.kind === "household" ? "foyer" : "personne"}</span>}
          <Button tone="quiet" size="sm" action={navigation ? { kind: "callback", onAction: () => { void navigation.goToAnalysis(); } } : { kind: "disabled" }}>Passer à l’analyse</Button>
        </div>
        {model === undefined ? null : <div className={styles.monthTotal}><span>Dépense économique</span><MetricDisplay metric={model.summary.economicAmount} /></div>}
      </header>
      {content}
    </DesktopFrame>
  );
}

const disabledNavigation: CalendarNavigation = {
  openCalendarMonth: () => ({ kind: "noop", reason: "not_started" }),
  openCalendarWeek: () => ({ kind: "noop", reason: "not_started" }),
  openDay: () => ({ kind: "noop", reason: "not_started" }),
  closeDay: () => ({ kind: "noop", reason: "not_started" }),
  previousDay: () => ({ kind: "noop", reason: "not_started" }),
  nextDay: () => ({ kind: "noop", reason: "not_started" }),
  openExploration: () => ({ kind: "noop", reason: "not_started" }),
  goToAnalysis: async () => ({ kind: "noop", reason: "not_started" }),
};

export function CalendarWeek({
  month,
  week,
  state,
  navigation,
  onRetry,
}: {
  readonly month: YearMonth;
  readonly week: CalendarWeekRef;
  readonly state: UiTransportState<readonly HistoryCalendarMonthReadModel[]>;
  readonly navigation?: CalendarNavigation;
  readonly onRetry?: () => void;
}) {
  const range = calendarWeekRange(month, week);
  const previous = adjacentWeek(range.start, -1);
  const next = adjacentWeek(range.start, 1);
  const controller = navigation ?? disabledNavigation;
  const response = state.status === "success"
    ? state.response
    : state.status === "error"
      ? state.previousData
      : undefined;
  let content: React.ReactNode;
  if (state.status === "idle" || state.status === "loading") {
    content = <SectionSkeleton />;
  } else if (state.status === "error" && response === undefined) {
    content = <ErrorState error={state.error} onRetry={onRetry} />;
  } else if (response === undefined) {
    throw new TypeError("Réponse hebdomadaire Calendar indisponible.");
  } else {
    const selection = selectCalendarWeek(month, week, response.data);
    const point = (day: CalendarDayCell) => ({
      date: day.date,
      label: dayLabel(day.date),
      metric: day.economicAmount,
    });
    const points: SevenDayPoints<Money, MonetaryMetricUnit> = [
      point(selection.days[0]),
      point(selection.days[1]),
      point(selection.days[2]),
      point(selection.days[3]),
      point(selection.days[4]),
      point(selection.days[5]),
      point(selection.days[6]),
    ];
    content = (
      <>
        <WeekBars
          unit={selection.days[0].economicAmount.unit}
          points={points}
          frame={{ title: "Dépense économique par jour", state: { kind: "ready", refreshing: state.status === "success" && state.refreshing }, summary: "Sept jours civils, sans total recalculé côté UI." }}
        />
        <div className={styles.weekCards}>
          {selection.days.map((day) => <CalendarDayCard key={day.date} day={day} navigation={controller} compact />)}
        </div>
        {state.status === "error" ? <RefreshIndicator failed announce /> : null}
      </>
    );
  }
  return (
    <DesktopFrame label={`Semaine ${week}`} className={styles.frame}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Calendar · semaine</span>
        <div className={styles.titleRow}>
          <Button tone="secondary" action={{ kind: "callback", onAction: () => controller.openCalendarWeek(previous.month, previous.week) }}>Semaine précédente</Button>
          <h1>{week.replace("semaine-", "Semaine ")}</h1>
          <Button tone="secondary" action={{ kind: "callback", onAction: () => controller.openCalendarWeek(next.month, next.week) }}>Semaine suivante</Button>
        </div>
        <div className={styles.headerActions}>
          <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => controller.openCalendarMonth(month) }}>Retour au mois</Button>
        </div>
        <p>Du {dayLabel(range.start, true)} au {dayLabel(range.end, true)}</p>
      </header>
      {content}
    </DesktopFrame>
  );
}

export function adjacentDayForDisplay(date: LocalDate, offset: -1 | 1): LocalDate {
  return addDays(date, offset);
}
