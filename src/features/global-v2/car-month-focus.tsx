import type { GlobalBackgroundRhythmMonthDetailReadModel, GlobalBackgroundCarMonthSummary } from "@/query-api/global-v2";
import { dayLabel, formatInteger, formatMoney, monthLabel } from "./annual-month-focus";
import { RhythmMonthFocusRegion } from "./rhythm-month-focus-region";
import styles from "./background-rhythms.module.css";

type DetailItem = GlobalBackgroundRhythmMonthDetailReadModel["tripSummaries"][number];
type RoutineItem = GlobalBackgroundRhythmMonthDetailReadModel["routineGroups"][number];
type ContextItem = GlobalBackgroundRhythmMonthDetailReadModel["contextOnly"][number];

const occurrenceLabels = Object.freeze({
  WORK_ONLY: "journées",
  WORKDAY_OUTING: "sorties",
  WORK_GROCERY: "circuits",
  GROCERY_ONLY: "trajets",
  FAMILY_DESTINATION: "visites",
  FAMILY_CIRCUIT: "circuits",
  GENERIC: "trajets",
} as const);

const semanticFamilyLabels = Object.freeze({
  WORK: "travail",
  GROCERY: "courses",
  FAMILY: "famille",
  FRIEND: "amis",
  HEALTH: "santé",
  LEISURE: "loisirs",
  TRAVEL: "séjour / voyage",
  PERSONAL: "quotidien personnel",
  OTHER: "autre déplacement",
} as const);

function Metrics({ distanceKm, estimatedFuelCost }: { readonly distanceKm: string; readonly estimatedFuelCost: string }) {
  return <span>{formatInteger(distanceKm)} km · ≈{formatMoney(estimatedFuelCost)}</span>;
}

function RoutineRow({ item }: { readonly item: RoutineItem }) {
  return <li><div><strong>{item.title}</strong><p>{formatInteger(item.occurrenceCount)} {occurrenceLabels[item.pattern]} · <Metrics {...item.monthContribution} /></p></div></li>;
}

function TripRow({ item, onTimelineDestination }: { readonly item: DetailItem; readonly onTimelineDestination: (eventRef: string) => void }) {
  const period = item.startDate === item.endDate ? dayLabel(item.startDate) : `${dayLabel(item.startDate)} → ${dayLabel(item.endDate)}`;
  const contextLabel = item.multiDay ? `séjour / ${semanticFamilyLabels[item.semanticFamily]}` : semanticFamilyLabels[item.semanticFamily];
  const destinationLabel = item.multiDay ? "Voir le séjour dans notre Timeline" : "Voir dans notre Timeline";
  return <li><div><strong>{item.title}</strong><p>{period} · {contextLabel}</p><p><Metrics {...item.monthContribution} /></p>{item.multiDay || item.crossMonth ? <small>≈{formatMoney(item.fullTrip.estimatedFuelCost)} estimés sur l’ensemble du déplacement</small> : null}</div>{item.targetRef === undefined ? null : <button type="button" onClick={() => onTimelineDestination(item.targetRef!)}>{destinationLabel} <span aria-hidden>→</span></button>}</li>;
}

function ContextRow({ item, onTimelineDestination }: { readonly item: ContextItem; readonly onTimelineDestination: (eventRef: string) => void }) {
  return <li className={styles.contextOnlyRow}><div><strong>{item.title}</strong><p>Contexte relié au déplacement</p></div>{item.targetRef === undefined ? null : <button type="button" onClick={() => onTimelineDestination(item.targetRef!)}>Voir dans notre Timeline <span aria-hidden>→</span></button>}</li>;
}

function DetailGroup({ title, band, detail, onTimelineDestination }: {
  readonly title: string;
  readonly band: "AROUND_WORK" | "OUTSIDE_WORK";
  readonly detail: GlobalBackgroundRhythmMonthDetailReadModel;
  readonly onTimelineDestination: (eventRef: string) => void;
}) {
  const routines = detail.routineGroups.filter(({ usageBand }) => usageBand === band);
  const trips = detail.tripSummaries.filter(({ usageBand }) => usageBand === band);
  const contexts = detail.contextOnly.filter(({ usageBand }) => usageBand === band);
  return <section className={styles.carDetailGroup}><h6>{title}</h6>{routines.length + trips.length + contexts.length === 0 ? <p className={styles.emptyDetail}>Aucun déplacement éditorial n’est publié dans cet ensemble.</p> : <ul>
    {routines.map((item) => <RoutineRow key={item.routineGroupId} item={item} />)}
    {trips.map((item) => <TripRow key={item.tripSummaryId} item={item} onTimelineDestination={onTimelineDestination} />)}
    {contexts.map((item) => <ContextRow key={item.contextOnlyId} item={item} onTimelineDestination={onTimelineDestination} />)}
  </ul>}</section>;
}

function CarDetailSkeleton() {
  return <div className={styles.carDetailSkeleton} role="status" aria-label="Chargement des déplacements" aria-busy="true"><span /><span /><span /></div>;
}

export function CarMonthFocus({ month, detail, detailStatus, connectorPosition, retry, onClose, onTimelineDestination }: {
  readonly month: GlobalBackgroundCarMonthSummary;
  readonly detail?: GlobalBackgroundRhythmMonthDetailReadModel;
  readonly detailStatus: "IDLE" | "LOADING" | "READY" | "ERROR";
  readonly connectorPosition: number;
  readonly retry: () => void;
  readonly onClose: () => void;
  readonly onTimelineDestination: (eventRef: string) => void;
}) {
  const titleId = `car-focus-${month.month}`;
  const partial = month.usageComposition.classificationStatus !== "COMPLETE";
  return <RhythmMonthFocusRegion domain="car" labelledBy={titleId} connectorPosition={connectorPosition}>
    <header className={styles.monthFocusHeader}>
      <div><span>{monthLabel(month.month).toLocaleUpperCase("fr-FR")}</span><h5 id={titleId}>≈{formatMoney(month.modeledUsage.estimatedFuelCost)}</h5><p>de carburant estimé pour nos déplacements</p><small>{formatInteger(month.modeledUsage.distanceKm)} km · ≈{formatInteger(month.modeledUsage.estimatedFuelLiters)} L estimés</small></div>
      <div className={styles.focusPaid}><strong>{formatMoney(month.observedFuelPaid.amount, true)}</strong><span>payés à la pompe ce mois-ci</span><button type="button" onClick={onClose}>Revenir à l’année <span aria-hidden>→</span></button></div>
    </header>
    <div className={styles.carSummaryBand}>
      <section><h6>Usage du mois</h6><strong>≈{formatMoney(month.modeledUsage.estimatedFuelCost)}</strong><p>{formatInteger(month.modeledUsage.distanceKm)} km reconstitués</p></section>
      <section><h6>Autour du travail</h6><strong>{formatMoney(month.usageComposition.aroundWorkEstimatedFuelCost, true)}</strong></section>
      <section><h6>Hors travail</h6><strong>{formatMoney(month.usageComposition.outsideWorkEstimatedFuelCost, true)}</strong></section>
      <section><h6>Ce qui ressort</h6><p>{partial ? "Une part de l’usage reste volontairement non classée." : `${formatInteger(month.narrativeSummary.visibleItemCount)} ensembles de déplacements sont publiés pour ce mois.`}</p></section>
    </div>
    <section className={styles.carMonthJourneys}><header><span>Lecture mensuelle</span><h5>Vos déplacements en {monthLabel(month.month).toLocaleLowerCase("fr-FR")}</h5></header>
      {!month.detailAvailable ? <p className={styles.emptyDetail}>Aucun détail mensuel supplémentaire n’est publié.</p>
        : detailStatus === "LOADING" || detailStatus === "IDLE" ? <CarDetailSkeleton />
          : detailStatus === "ERROR" || detail === undefined ? <div className={styles.localDetailError} role="alert"><p>Les déplacements détaillés n’ont pas pu être chargés. Le résumé mensuel reste disponible.</p><button type="button" onClick={retry}>Réessayer</button></div>
            : <div className={styles.carDetailColumns}><DetailGroup title="Autour du travail" band="AROUND_WORK" detail={detail} onTimelineDestination={onTimelineDestination} /><DetailGroup title="Hors travail / sorties & événements" band="OUTSIDE_WORK" detail={detail} onTimelineDestination={onTimelineDestination} /></div>}
      {detail === undefined || detail.suppressedRemainder.tripCount === 0 ? null : <p className={styles.suppressedRemainder}>{detail.suppressedRemainder.displayText}</p>}
    </section>
  </RhythmMonthFocusRegion>;
}
