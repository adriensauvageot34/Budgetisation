"use client";

import type { CSSProperties, ReactNode } from "react";
import { addDays, type LocalDate, type YearMonth } from "@/core/time";
import type { MonetaryMetricUnit, Money } from "@/core/money";
import type {
  CalendarDayCell,
  CalendarDayMarker,
  CalendarMonthHighlight,
  HistoryCalendarMonthReadModel,
} from "@/query-api";
import type { CalendarWeekRef } from "@/navigation";
import {
  Button,
  DesktopFrame,
  ErrorState,
  MetricDisplay,
  RefreshIndicator,
  SectionSkeleton,
  Surface,
  WeekBars,
  resolveMetricDisplay,
  type SevenDayPoints,
  type UiTransportState,
} from "@/ui";
import { CalendarIcon } from "./calendar-icon";
import {
  adjacentWeek,
  buildMonthGrid,
  calendarWeekRange,
  calendarWeekRefFor,
  knownMonthSpendMaximum,
  layoutCalendarRibbons,
  monthGridWeekRefs,
  selectCalendarWeek,
  spendIntensityLevel,
} from "./model";
import { PersonAvatarCluster } from "./person-avatar";
import type { CalendarNavigation, CalendarPerson } from "./types";
import styles from "./calendar.module.css";

const monthNames = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;
const weekdayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
const visibleMarkerCount = 4;

function monthLabel(month: YearMonth): string {
  const [year, rawMonth] = month.split("-");
  return `${monthNames[Number(rawMonth) - 1]} ${year}`;
}

function dayLabel(date: LocalDate, long = false): string {
  const [year, rawMonth, rawDay] = date.split("-");
  const day = Number(rawDay);
  return long ? `${day} ${monthNames[Number(rawMonth) - 1]} ${year}` : String(day);
}

function MarkerLine({ marker, persons }: { readonly marker: CalendarDayMarker; readonly persons: readonly CalendarPerson[] }) {
  return (
    <span className={styles.markerLine}>
      <CalendarIcon kind={marker.kind} className={styles.markerIcon} />
      <span className={styles.markerLabel}>{marker.label}</span>
      <PersonAvatarCluster participantIds={marker.participantIds} persons={persons} />
    </span>
  );
}

export function CalendarDayCard({
  day,
  persons,
  navigation,
  maximumSpend,
  compact = false,
}: {
  readonly day: CalendarDayCell;
  readonly persons: readonly CalendarPerson[];
  readonly navigation: CalendarNavigation;
  readonly maximumSpend: number;
  readonly compact?: boolean;
}) {
  const metric = resolveMetricDisplay(day.economicAmount, { variant: "compact" });
  const visibleMarkers = day.markers.slice(0, visibleMarkerCount);
  const hiddenCount = day.markers.length - visibleMarkers.length;
  const intensity = spendIntensityLevel(day.economicAmount, maximumSpend);
  const contents = (
    <>
      <span className={styles.dayHeading}>
        <strong>{dayLabel(day.date, compact)}</strong>
        <MetricDisplay metric={day.economicAmount} variant="compact" />
      </span>
      <span className={styles.markerList}>
        {visibleMarkers.map((marker) => <MarkerLine key={marker.id} marker={marker} persons={persons} />)}
        {hiddenCount > 0 ? <span className={styles.moreMarkers}>+{hiddenCount}</span> : null}
      </span>
      <span className={styles.daySummary} aria-hidden="true">
        <strong>{dayLabel(day.date, true)}</strong>
        <span>{metric.accessibleText ?? "Dépense non disponible"}</span>
        {day.markers.map((marker) => <span key={marker.id}>{marker.label}</span>)}
      </span>
    </>
  );
  return (
    <Surface
      variant={day.hasDetail ? "outlined" : "subtle"}
      action={day.hasDetail
        ? { kind: "callback", onAction: () => navigation.openDay(day.date) }
        : { kind: "disabled", reason: "Aucun journal disponible pour ce jour." }}
      className={`${styles.dayCard} ${styles[`intensity${intensity}`]}`}
      ariaLabel={`Ouvrir le journal du ${dayLabel(day.date, true)}, ${metric.accessibleText ?? "dépense non disponible"}${day.markers.length === 0 ? "" : `. Repères : ${day.markers.map(({ label }) => label).join(", ")}`}`}
    >
      {contents}
    </Surface>
  );
}

function ViewSwitch({ navigation }: { readonly navigation?: CalendarNavigation }) {
  return (
    <div className={styles.viewSwitch} role="group" aria-label="Vue de l’historique">
      <span className={styles.viewSwitchCurrent} aria-current="page">Calendrier</span>
      <Button
        tone="quiet"
        size="sm"
        action={navigation ? { kind: "callback", onAction: () => { void navigation.goToAnalysis(); } } : { kind: "disabled" }}
      >
        Analyse
      </Button>
    </div>
  );
}

function Highlight({ highlight, persons, navigation }: {
  readonly highlight: CalendarMonthHighlight;
  readonly persons: readonly CalendarPerson[];
  readonly navigation?: CalendarNavigation;
}) {
  const contents = (
    <>
      <CalendarIcon kind={highlight.kind} className={styles.highlightIcon} />
      <span>
        <strong>{highlight.label}</strong>
        <small>{highlight.startsOn === highlight.endsOn ? dayLabel(highlight.startsOn, true) : `${dayLabel(highlight.startsOn, true)} — ${dayLabel(highlight.endsOn, true)}`}</small>
      </span>
      <PersonAvatarCluster participantIds={highlight.participantIds} persons={persons} />
    </>
  );
  return highlight.target !== undefined && navigation !== undefined ? (
    <button type="button" className={styles.highlight} onClick={() => navigation.openExploration(highlight.target!)}>{contents}</button>
  ) : <div className={styles.highlight}>{contents}</div>;
}

function MonthlyPulse({ model, persons, navigation }: {
  readonly model: HistoryCalendarMonthReadModel;
  readonly persons: readonly CalendarPerson[];
  readonly navigation?: CalendarNavigation;
}) {
  return (
    <section className={styles.monthPulse} aria-label="Pouls financier et temps forts du mois">
      <div className={styles.financialPulse}>
        <span>Dépense économique</span>
        <MetricDisplay metric={model.summary.economicAmount} />
      </div>
      {model.highlights.length > 0 ? (
        <div className={styles.highlights}>
          <span className={styles.sectionLabel}>Temps forts</span>
          <div className={styles.highlightList}>
            {model.highlights.map((highlight) => <Highlight key={highlight.id} highlight={highlight} persons={persons} navigation={navigation} />)}
          </div>
        </div>
      ) : (
        <p className={styles.dataNote}>Aucun temps fort canonique n’est documenté pour ce mois.</p>
      )}
    </section>
  );
}

function MonthGrid({ model, persons, navigation }: {
  readonly model: HistoryCalendarMonthReadModel;
  readonly persons: readonly CalendarPerson[];
  readonly navigation?: CalendarNavigation;
}) {
  const slots = buildMonthGrid(model);
  const weeks = monthGridWeekRefs(model);
  const ribbons = layoutCalendarRibbons(model.month, model.spanningEvents);
  const maximumSpend = knownMonthSpendMaximum(model.days);
  const controller = navigation ?? disabledNavigation;
  const rows: ReactNode[] = [];
  for (let row = 0; row < slots.length / 7; row += 1) {
    const weekSlots = slots.slice(row * 7, row * 7 + 7);
    const firstDay = weekSlots.find((slot) => slot.kind === "day");
    const week = weeks[row] ?? (firstDay?.kind === "day" ? calendarWeekRefFor(firstDay.day.date) : undefined);
    const weekSegments = ribbons.segments.filter(({ weekIndex }) => weekIndex === row);
    const hidden = ribbons.hiddenByWeek.get(row) ?? 0;
    rows.push(
      <div className={styles.calendarWeekRow} key={`week-${row}`}>
        <Button
          tone="quiet"
          size="sm"
          action={navigation && week ? { kind: "callback", onAction: () => navigation.openCalendarWeek(model.month, week) } : { kind: "disabled" }}
          className={styles.weekButton}
        >
          {week?.replace("semaine-", "S") ?? "—"}
        </Button>
        <div className={styles.weekCanvas}>
          {weekSegments.length > 0 || hidden > 0 ? (
            <div className={styles.ribbonGrid} style={{ "--ribbon-lanes": ribbons.laneCount } as CSSProperties}>
              {weekSegments.map((segment) => (
                <button
                  type="button"
                  key={segment.id}
                  className={styles.ribbon}
                  data-kind={segment.event.kind}
                  style={{ gridColumn: `${segment.startColumn} / span ${segment.span}`, gridRow: segment.lane + 1 }}
                  onClick={() => navigation?.openExploration(segment.event.target!)}
                  disabled={navigation === undefined || segment.event.target === undefined}
                  aria-label={`${segment.event.label}, du ${dayLabel(segment.event.startsOn, true)} au ${dayLabel(segment.event.endsOn, true)}`}
                >
                  {segment.continuesBefore ? <span aria-hidden="true">‹</span> : null}
                  <CalendarIcon kind={segment.event.kind} />
                  <span>{segment.event.label}</span>
                  {segment.continuesAfter ? <span aria-hidden="true">›</span> : null}
                </button>
              ))}
              {hidden > 0 ? <span className={styles.ribbonOverflow} style={{ gridRow: ribbons.laneCount + 1 }}>+{hidden} repère{hidden > 1 ? "s" : ""}</span> : null}
            </div>
          ) : null}
          <div className={styles.weekDayGrid}>
            {weekSlots.map((slot) => slot.kind === "padding"
              ? <span key={slot.key} className={styles.padding} aria-hidden="true" />
              : <CalendarDayCard key={slot.key} day={slot.day} persons={persons} navigation={controller} maximumSpend={maximumSpend} />)}
          </div>
        </div>
      </div>,
    );
  }
  return (
    <div className={styles.calendarTable} role="grid" aria-label={`Jours de ${monthLabel(model.month)}`}>
      <div className={styles.calendarHead}>
        <span className={styles.weekHeading}>Sem.</span>
        <div className={styles.weekdayGrid}>
          {weekdayNames.map((name) => <span key={name} className={styles.weekday} role="columnheader">{name}</span>)}
        </div>
      </div>
      {rows}
    </div>
  );
}

export function CalendarMonth({
  month,
  persons,
  adjacentMonths,
  state,
  navigation,
  onRetry,
}: {
  readonly month: YearMonth;
  readonly persons: readonly CalendarPerson[];
  readonly adjacentMonths: { readonly previous?: YearMonth; readonly next?: YearMonth };
  readonly state: UiTransportState<HistoryCalendarMonthReadModel>;
  readonly navigation?: CalendarNavigation;
  readonly onRetry?: () => void;
}) {
  const response = state.status === "success" ? state.response : state.status === "error" ? state.previousData : undefined;
  const model = response?.data;
  if (model !== undefined && model.month !== month) throw new TypeError("Le read model Calendar ne correspond pas au mois de la route.");
  let content: ReactNode;
  if (state.status === "idle" || state.status === "loading") content = <SectionSkeleton />;
  else if (state.status === "error" && model === undefined) content = <ErrorState error={state.error} onRetry={onRetry} />;
  else if (model === undefined) throw new TypeError("Réponse mensuelle Calendar indisponible.");
  else content = (
    <>
      <MonthlyPulse model={model} persons={persons} navigation={navigation} />
      <MonthGrid model={model} persons={persons} navigation={navigation} />
      {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : null}
      {state.status === "error" ? <RefreshIndicator failed announce /> : null}
    </>
  );
  return (
    <DesktopFrame label={`Calendrier ${monthLabel(month)}`} className={styles.frame}>
      <header className={styles.pageHeader}>
        <div className={styles.historyIdentity}>
          <span className={styles.eyebrow}>Historique</span>
          <ViewSwitch navigation={navigation} />
        </div>
        <div className={styles.titleRow}>
          <Button tone="secondary" action={navigation && adjacentMonths.previous ? { kind: "callback", onAction: () => navigation.openCalendarMonth(adjacentMonths.previous!) } : { kind: "disabled", reason: "Aucun mois historique précédent." }}>Mois précédent</Button>
          <h1>{monthLabel(month)}</h1>
          <Button tone="secondary" action={navigation && adjacentMonths.next ? { kind: "callback", onAction: () => navigation.openCalendarMonth(adjacentMonths.next!) } : { kind: "disabled", reason: "Aucun mois historique suivant." }}>Mois suivant</Button>
        </div>
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

export function CalendarWeek({ month, week, persons, state, navigation, onRetry }: {
  readonly month: YearMonth;
  readonly week: CalendarWeekRef;
  readonly persons: readonly CalendarPerson[];
  readonly state: UiTransportState<readonly HistoryCalendarMonthReadModel[]>;
  readonly navigation?: CalendarNavigation;
  readonly onRetry?: () => void;
}) {
  const range = calendarWeekRange(month, week);
  const previous = adjacentWeek(range.start, -1);
  const next = adjacentWeek(range.start, 1);
  const controller = navigation ?? disabledNavigation;
  const response = state.status === "success" ? state.response : state.status === "error" ? state.previousData : undefined;
  let content: ReactNode;
  if (state.status === "idle" || state.status === "loading") content = <SectionSkeleton />;
  else if (state.status === "error" && response === undefined) content = <ErrorState error={state.error} onRetry={onRetry} />;
  else if (response === undefined) throw new TypeError("Réponse hebdomadaire Calendar indisponible.");
  else {
    const selection = selectCalendarWeek(month, week, response.data);
    const point = (day: CalendarDayCell) => ({ date: day.date, label: dayLabel(day.date), metric: day.economicAmount });
    const points: SevenDayPoints<Money, MonetaryMetricUnit> = [
      point(selection.days[0]), point(selection.days[1]), point(selection.days[2]), point(selection.days[3]),
      point(selection.days[4]), point(selection.days[5]), point(selection.days[6]),
    ];
    const maximumSpend = knownMonthSpendMaximum(selection.days);
    content = (
      <>
        <WeekBars unit={selection.days[0].economicAmount.unit} points={points} frame={{ title: "Dépense économique par jour", state: { kind: "ready", refreshing: state.status === "success" && state.refreshing }, summary: "Sept jours civils." }} />
        <div className={styles.weekCards}>
          {selection.days.map((day) => <CalendarDayCard key={day.date} day={day} persons={persons} navigation={controller} maximumSpend={maximumSpend} compact />)}
        </div>
        {state.status === "error" ? <RefreshIndicator failed announce /> : null}
      </>
    );
  }
  return (
    <DesktopFrame label={`Semaine ${week}`} className={styles.frame}>
      <header className={styles.pageHeader}>
        <div className={styles.historyIdentity}><span className={styles.eyebrow}>Historique · semaine</span></div>
        <div className={styles.titleRow}>
          <Button tone="secondary" action={{ kind: "callback", onAction: () => controller.openCalendarWeek(previous.month, previous.week) }}>Semaine précédente</Button>
          <h1>{week.replace("semaine-", "Semaine ")}</h1>
          <Button tone="secondary" action={{ kind: "callback", onAction: () => controller.openCalendarWeek(next.month, next.week) }}>Semaine suivante</Button>
        </div>
        <div className={styles.weekSubhead}>
          <p>Du {dayLabel(range.start, true)} au {dayLabel(range.end, true)}</p>
          <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => controller.openCalendarMonth(month) }}>Retour au mois</Button>
        </div>
      </header>
      {content}
    </DesktopFrame>
  );
}

export function adjacentDayForDisplay(date: LocalDate, offset: -1 | 1): LocalDate {
  return addDays(date, offset);
}
