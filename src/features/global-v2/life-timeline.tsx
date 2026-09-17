"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Cake,
  Camera,
  CarFront,
  ChevronDown,
  ChevronRight,
  Circle,
  Flower2,
  House,
  MapPin,
  Music,
  PartyPopper,
  Plane,
  Sparkles,
  TriangleAlert,
  Users,
  Waves,
} from "lucide-react";
import type {
  GlobalLifeTimelineReadModel,
  GlobalLifeTimelineV2ReadModel,
  GlobalTimelineComparisonLevel,
  GlobalTimelineComparisonPeerObservation,
  GlobalTimelineEvent,
  GlobalTimelineEventComparisonReadModel,
  GlobalTimelineV2Event,
  GlobalTypedMeasure,
} from "@/query-api/global-v2";
import { ComparisonRange } from "./comparison-range";
import { useGlobalV2Resource } from "./use-global-resource";
import type { GlobalV2VisitRuntime } from "./visit-runtime";
import {
  hasTimelineComparisonAffordance,
  initialTimelineComparisonLevel,
  orderedTimelineComparisonLevels,
  timelineComparisonRequest,
  timelineComparisonLevelLabel,
  timelineEventAmount,
  timelineEventsForDensity,
  type TimelineDensityMode,
} from "./life-timeline-presentation";
import styles from "./global-v2.module.css";

type TimelineIcon = ComponentType<{ readonly size?: number; readonly "aria-hidden"?: boolean }>;

const legacyTimelineIcons: Readonly<Record<string, TimelineIcon>> = Object.freeze({
  "LIFE_EVENT:activite_loisir": Sparkles,
  "LIFE_EVENT:celebration": PartyPopper,
  "LIFE_EVENT:examen_permis": BadgeCheck,
  "LIFE_EVENT:funeraire": Flower2,
  "LIFE_EVENT:sortie_soiree": Music,
  "LIFE_EVENT:voyage_sejour": Plane,
  "M6:anniversaire": Cake,
  "M6:boite-de-nuit": Music,
  "M6:concert-spectacle": Music,
  "M6:deplacement-professionnel": BriefcaseBusiness,
  "M6:entretien-controle-vehicule": CarFront,
  "M6:evenement-familial-deplacement": Users,
  "M6:fete-celebration": PartyPopper,
  "M6:projet-achat-maison": House,
  "M6:projet-seance-photo": Camera,
  "M6:reparation-imprevu": TriangleAlert,
  "M6:soiree": Music,
  "M6:soiree-techno": Music,
  "M6:sortie-activite": Sparkles,
  "M6:sortie-evenement": MapPin,
  "M6:sortie-excursion": MapPin,
  "M6:sortie-plage": Waves,
  "M6:visite-familiale": Users,
  "M6:voyage": Plane,
  "M6:week-end-escapade": Plane,
});

/** Presentation mapping only: keys are supplied by the semantic taxonomy. */
const semanticCloseIcons: Readonly<Record<string, TimelineIcon>> = Object.freeze({
  anniversaire: Cake,
  club_boite_de_nuit: Music,
  concert_spectacle_musical: Music,
  controle_technique: CarFront,
  deplacement_professionnel_avec_nuitee: BriefcaseBusiness,
  fete_annuelle_familiale: PartyPopper,
  journee_plage_baignade: Waves,
  obseques_funerailles: Flower2,
  parcours_permis_de_conduire: BadgeCheck,
  projet_seance_photo: Camera,
  reparation: TriangleAlert,
  soiree_bars_tournee_de_bars: Music,
  soiree_techno_rave: Music,
  voyage_vacances_a_l_etranger: Plane,
  week_end_escapade_regionale: Plane,
});

const semanticIntermediateIcons: Readonly<Record<string, TimelineIcon>> = Object.freeze({
  celebrations_privees: PartyPopper,
  culture_et_evenements_publics: Music,
  demarches_administratives_et_juridiques: BadgeCheck,
  evenements_familiaux_marquants: Users,
  evenements_professionnels: BriefcaseBusiness,
  loisirs_et_activites: Sparkles,
  missions_et_interventions_professionnelles: BriefcaseBusiness,
  permis_et_apprentissages: BadgeCheck,
  projets_creatifs: Camera,
  projets_maison: House,
  sante_medicale: Flower2,
  sorties_festives_et_nocturnes: Music,
  sorties_restauration_et_gourmandes: MapPin,
  vacances_et_voyages: Plane,
  vehicule: CarFront,
  visites_et_temps_avec_les_proches: Users,
  week_ends_et_escapades: Plane,
});

const moneyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function timelineDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

type TimelineTransportEvent = GlobalTimelineEvent | GlobalTimelineV2Event;
type TimelineTransportReadModel = GlobalLifeTimelineReadModel | GlobalLifeTimelineV2ReadModel;
type LifeEventFocusRequest = Readonly<{ eventRef: `life-event:${string}`; requestId: number }>;

function timelineMoneyMeasure(value: string): GlobalTypedMeasure {
  return { kind: "MONEY", value, unit: "EUR" };
}

function timelineCountMeasure(value: number): GlobalTypedMeasure {
  return { kind: "COUNT", value: String(value), unit: "event" };
}

function monthKey(event: TimelineTransportEvent): string {
  return event.startDate.slice(0, 7);
}

function eventDateLabel(event: TimelineTransportEvent): string {
  const start = timelineDate(event.startDate);
  if (event.startDate === event.endDate) return shortDateFormatter.format(start);
  return `Du ${shortDateFormatter.format(start)} au ${shortDateFormatter.format(timelineDate(event.endDate))}`;
}

function legacyEventAmount(event: GlobalTimelineEvent): string {
  const cost = event.causalCost;
  if (cost.status !== "KNOWN" && cost.status !== "PARTIAL") return "Coût non établi";
  if (cost.value.kind !== "MONEY") return "Coût non établi";
  return moneyFormatter.format(Number(cost.value.value));
}

function legacyEventIsDistinctive(event: GlobalTimelineEvent): boolean {
  return event.comparisonSummary?.status === "KNOWN" && event.comparisonSummary.materiality === "MATERIAL";
}

function legacyComparisonLabel(event: GlobalTimelineEvent): { readonly label: string; readonly peerCount: number } | undefined {
  const comparison = event.comparisonSummary;
  if (comparison === undefined || comparison.status === "UNKNOWN" || comparison.status === "NOT_APPLICABLE" || comparison.peerCount < 3) return undefined;
  return { label: comparison.status === "PARTIAL" || comparison.peerCount < 5 ? "Peu de comparables" : "Voir la comparaison", peerCount: comparison.peerCount };
}

type TimelineMonth = { readonly key: string; readonly label: string; readonly events: readonly TimelineTransportEvent[] };
type TimelineYear = { readonly key: string; readonly months: readonly TimelineMonth[] };

/** Sequential projection only: the Query order remains authoritative. */
export function groupTimelineEvents(events: readonly TimelineTransportEvent[]): readonly TimelineYear[] {
  const years: { key: string; months: { key: string; label: string; events: TimelineTransportEvent[] }[] }[] = [];
  for (const event of events) {
    const yearKey = event.startDate.slice(0, 4);
    const eventMonthKey = monthKey(event);
    let year = years.at(-1);
    if (year?.key !== yearKey) {
      year = { key: yearKey, months: [] };
      years.push(year);
    }
    let month = year.months.at(-1);
    if (month?.key !== eventMonthKey) {
      month = { key: eventMonthKey, label: monthFormatter.format(timelineDate(`${eventMonthKey}-01`)), events: [] };
      year.months.push(month);
    }
    month.events.push(event);
  }
  return years;
}

/** Kept only for fixture/cutover compatibility; active publications use the V2 card below. */
function LegacyTimelineEventRow({ event, onMomentDetail }: { readonly event: GlobalTimelineEvent; readonly onMomentDetail: (eventRef: string, title: string) => void }) {
  const Icon = legacyTimelineIcons[`${event.familySource}:${event.typeKey}`] ?? Circle;
  const comparison = legacyComparisonLabel(event);
  const distinctive = legacyEventIsDistinctive(event);
  const costStatus = event.causalCost.status;
  const knownCost = costStatus === "KNOWN" || costStatus === "PARTIAL";
  const place = event.places.find(({ label }) => label !== undefined)?.label;
  const participantCount = event.participantRefs.length;
  const participantLabel = participantCount === undefined ? undefined : participantCount === 1 ? "1 personne" : `${participantCount} personnes`;
  const momentDetailAvailable = event.detailAvailability === "MOMENT_DETAIL";
  const content = <>
    <time className={styles.timelineDay} dateTime={event.startDate}>{dayFormatter.format(timelineDate(event.startDate))}</time>
    <span className={styles.timelineMarker} aria-hidden><Icon size={16} aria-hidden /></span>
    <span className={styles.timelineEventBody}>
      <span className={styles.timelineEventHeading}><strong>{event.canonicalName}</strong>{distinctive ? <em>Se distingue</em> : null}</span>
      <span className={styles.timelineEventMeta}>{eventDateLabel(event)} · {event.typeLabel}{place === undefined ? "" : ` · ${place}`}{participantLabel === undefined ? "" : ` · ${participantLabel}`}</span>
      <span className={styles.timelineEventFacts}><b className={knownCost ? undefined : styles.timelineUnknown}>{legacyEventAmount(event)}</b>{costStatus === "PARTIAL" ? <small>Coût partiellement établi</small> : null}{comparison === undefined ? null : <small className={styles.timelineComparison}>{comparison.label} · {comparison.peerCount} événements</small>}</span>
    </span>
    {momentDetailAvailable ? <ChevronRight className={styles.timelineChevron} aria-hidden size={18} /> : null}
  </>;
  return <li className={distinctive ? styles.timelineDistinctive : undefined} data-family-source={event.familySource} data-type-key={event.typeKey}>
    {momentDetailAvailable
      ? <button type="button" data-global-entity-ref={event.eventRef} aria-label={`Ouvrir le détail de ${event.canonicalName}`} onClick={() => onMomentDetail(event.eventRef, event.canonicalName)}>{content}</button>
      : <article aria-label={`${event.canonicalName}, ${eventDateLabel(event)}, ${legacyEventAmount(event)}`}>{content}</article>}
  </li>;
}

function TimelineComparator({ event, runtime, onOpenPeer }: {
  readonly event: GlobalTimelineV2Event;
  readonly runtime: GlobalV2VisitRuntime;
  readonly onOpenPeer: (peer: GlobalTimelineComparisonPeerObservation) => void;
}) {
  const descriptors = useMemo(() => orderedTimelineComparisonLevels(event), [event]);
  const [selectedLevel, setSelectedLevel] = useState<GlobalTimelineComparisonLevel>(() => {
    const initial = initialTimelineComparisonLevel(event);
    if (initial === undefined) throw new TypeError(`TIMELINE_COMPARATOR_LEVEL_MISSING:${event.eventRef}`);
    return initial;
  });
  const request = useMemo(() => timelineComparisonRequest(event.eventRef, selectedLevel), [event.eventRef, selectedLevel]);
  const result = useGlobalV2Resource<GlobalTimelineEventComparisonReadModel>(runtime, request, true, "DIRECT");
  const model = result.state.status === "READY" ? result.state.data : result.state.status === "ERROR" ? result.state.previousData : undefined;
  const distinctiveLabel = event.distinctiveComparisonLevel === undefined
    ? undefined
    : timelineComparisonLevelLabel(event, event.distinctiveComparisonLevel);

  return <section className={styles.timelineComparator} aria-label={`Comparaison de ${event.canonicalName}`}>
    {descriptors.length > 1 ? <div className={styles.timelineComparisonLevels} role="radiogroup" aria-label="Profondeur de comparaison">
      {descriptors.map(({ level }) => <button
        key={level}
        type="button"
        role="radio"
        aria-checked={selectedLevel === level}
        onClick={() => setSelectedLevel(level)}
      >{timelineComparisonLevelLabel(event, level)}</button>)}
    </div> : null}
    {distinctiveLabel === undefined ? null : <p className={styles.timelineDistinctiveBasis}>Se distingue sur la base « {distinctiveLabel} ».</p>}
    {(result.state.status === "IDLE" || result.state.status === "LOADING") && model === undefined
      ? <p className={styles.timelineComparatorStatus} role="status" aria-busy="true">Chargement de la comparaison…</p>
      : result.state.status === "ERROR" && model === undefined
        ? <p className={styles.timelineComparatorStatus} role="alert">La comparaison n’a pas pu être chargée. <button type="button" onClick={result.retry}>Réessayer</button></p>
        : model === undefined ? null : <div className={styles.timelineComparatorResult} data-comparison-level={model.comparison.level}>
          {model.support.status === "PARTIAL" ? <p className={styles.timelineComparatorSupport}>Peu de comparables : cette lecture reste indicative.</p> : null}
          <p>{model.comparison.label} · {model.support.peerCount} événements comparables</p>
          <ComparisonRange
            key={`${event.eventRef}:${model.comparison.level}`}
            observed={timelineMoneyMeasure(model.subject.eventCost.value)}
            median={timelineMoneyMeasure(model.statistics.median)}
            lower={timelineMoneyMeasure(model.statistics.q1)}
            upper={timelineMoneyMeasure(model.statistics.q3)}
            supportCount={timelineCountMeasure(model.support.peerCount)}
            subjectLabel={model.subject.canonicalName}
            comparisonLabel="événements comparables"
            peers={model.peerObservations}
            onOpenPeer={onOpenPeer}
          />
        </div>}
  </section>;
}

function TimelineV2EventRow({ event, runtime, focusRequest, onMomentDetail, onLifeEventPeer }: {
  readonly event: GlobalTimelineV2Event;
  readonly runtime: GlobalV2VisitRuntime;
  readonly focusRequest: LifeEventFocusRequest | undefined;
  readonly onMomentDetail: (eventRef: string, title: string) => void;
  readonly onLifeEventPeer: (peer: GlobalTimelineComparisonPeerObservation & { readonly sourceKind: "LIFE_EVENT" }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const Icon = semanticCloseIcons[event.semanticClassification.close.key]
    ?? semanticIntermediateIcons[event.semanticClassification.intermediate.key]
    ?? Circle;
  const distinctive = event.distinctiveComparisonLevel !== undefined;
  const comparisonAvailable = hasTimelineComparisonAffordance(event);
  const participantLabel = event.participantCount === undefined
    ? undefined
    : event.participantCount === 1 ? "1 personne" : `${event.participantCount} personnes`;
  const isMomentDetail = event.sourceKind === "MOMENT" && event.momentDetailAvailable;
  const isLifeEvent = event.sourceKind === "LIFE_EVENT";
  const seriesLabel = event.series === undefined ? undefined : event.series.label ?? "Série identifiée";
  const detailsId = `timeline-life-event-${event.eventRef.slice("life-event:".length)}`;
  const comparatorId = `timeline-comparator-${event.eventRef.replace(":", "-")}`;
  useEffect(() => {
    if (!isLifeEvent || focusRequest?.eventRef !== event.eventRef) return;
    setExpanded(true);
    const frame = window.requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      cardButtonRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [event.eventRef, focusRequest, isLifeEvent]);
  const content = <>
    <time className={styles.timelineDay} dateTime={event.startDate}>{dayFormatter.format(timelineDate(event.startDate))}</time>
    <span className={styles.timelineMarker} aria-hidden><Icon size={16} aria-hidden /></span>
    <span className={styles.timelineEventBody}>
      <span className={styles.timelineEventHeading}><strong>{event.canonicalName}</strong>{distinctive ? <em>Se distingue</em> : null}</span>
      <span className={styles.timelineEventMeta}>{eventDateLabel(event)} · {event.semanticClassification.close.label}{event.primaryPlaceLabel === undefined ? "" : ` · ${event.primaryPlaceLabel}`}{participantLabel === undefined ? "" : ` · ${participantLabel}`}</span>
      <span className={styles.timelineSemanticContext}>{event.semanticClassification.intermediate.label} · {event.semanticClassification.grand.label}</span>
      <span className={styles.timelineEventFacts}>
        <b className={event.eventCost.status === "KNOWN" ? undefined : styles.timelineUnknown}>{timelineEventAmount(event)}</b>
        {seriesLabel === undefined ? null : <small>Série · {seriesLabel}</small>}
        {comparisonAvailable ? <small className={styles.timelineComparison}>Comparaison disponible</small> : null}
      </span>
    </span>
    {isMomentDetail ? <ChevronRight className={styles.timelineChevron} aria-hidden size={18} /> : null}
    {isLifeEvent ? <ChevronDown className={styles.timelineChevron} data-expanded={expanded} aria-hidden size={18} /> : null}
  </>;

  const openPeer = (peer: GlobalTimelineComparisonPeerObservation) => {
    if (peer.sourceKind === "MOMENT") onMomentDetail(peer.eventRef, peer.canonicalName);
    else onLifeEventPeer(peer as GlobalTimelineComparisonPeerObservation & { readonly sourceKind: "LIFE_EVENT" });
  };

  return <li
    ref={rowRef}
    className={distinctive ? styles.timelineDistinctive : undefined}
    data-source-kind={event.sourceKind}
    data-semantic-close={event.semanticClassification.close.key}
    data-visibility-tier={event.visibilityTier}
  >
    {isMomentDetail
      ? <button type="button" data-global-entity-ref={event.eventRef} aria-label={`Ouvrir le détail de ${event.canonicalName}`} onClick={() => onMomentDetail(event.eventRef, event.canonicalName)}>{content}</button>
      : isLifeEvent
        ? <button ref={cardButtonRef} type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((current) => !current)}>{content}</button>
        : <article aria-label={`${event.canonicalName}, ${eventDateLabel(event)}, ${timelineEventAmount(event)}`}>{content}</article>}
    {isLifeEvent && expanded ? <div id={detailsId} className={styles.timelineLifeEventDetails}>
      <p>{event.semanticClassification.grand.label} <span aria-hidden>›</span> {event.semanticClassification.intermediate.label}</p>
      <dl>
        <div><dt>Catégorie</dt><dd>{event.semanticClassification.close.label}</dd></div>
        <div><dt>Coût</dt><dd>{timelineEventAmount(event)}</dd></div>
        {seriesLabel === undefined ? null : <div><dt>Série</dt><dd>{seriesLabel}</dd></div>}
        {event.primaryPlaceLabel === undefined ? null : <div><dt>Lieu</dt><dd>{event.primaryPlaceLabel}</dd></div>}
        {participantLabel === undefined ? null : <div><dt>Participants</dt><dd>{participantLabel}</dd></div>}
      </dl>
      {comparisonAvailable ? <p className={styles.timelineComparison}>Comparaison disponible · {event.comparisonLevels.length === 1 ? "1 profondeur" : `${event.comparisonLevels.length} profondeurs`}</p> : null}
    </div> : null}
    {comparisonAvailable ? <div className={styles.timelineComparatorAction}>
      <button type="button" aria-expanded={comparatorOpen} aria-controls={comparatorId} onClick={() => setComparatorOpen((current) => !current)}>{comparatorOpen ? "Masquer la comparaison" : "Comparer"}</button>
    </div> : null}
    {comparisonAvailable && comparatorOpen ? <div id={comparatorId}><TimelineComparator event={event} runtime={runtime} onOpenPeer={openPeer} /></div> : null}
  </li>;
}

function TimelineEventRow({ event, runtime, focusRequest, onMomentDetail, onLifeEventPeer }: {
  readonly event: TimelineTransportEvent;
  readonly runtime: GlobalV2VisitRuntime;
  readonly focusRequest: LifeEventFocusRequest | undefined;
  readonly onMomentDetail: (eventRef: string, title: string) => void;
  readonly onLifeEventPeer: (peer: GlobalTimelineComparisonPeerObservation & { readonly sourceKind: "LIFE_EVENT" }) => void;
}) {
  return "eventCost" in event
    ? <TimelineV2EventRow event={event} runtime={runtime} focusRequest={focusRequest} onMomentDetail={onMomentDetail} onLifeEventPeer={onLifeEventPeer} />
    : <LegacyTimelineEventRow event={event} onMomentDetail={onMomentDetail} />;
}

export function LifeTimeline({ runtime, onMomentDetail }: { readonly runtime: GlobalV2VisitRuntime; readonly onMomentDetail: (eventRef: string, title: string) => void }) {
  const [density, setDensity] = useState<TimelineDensityMode>("PRINCIPAL");
  const [lifeEventFocus, setLifeEventFocus] = useState<LifeEventFocusRequest | undefined>(undefined);
  const request = useMemo(() => ({ resource: "analysis_global_life_timeline" as const, params: {} }), []);
  const result = useGlobalV2Resource<TimelineTransportReadModel>(runtime, request, true, "DIRECT");
  const model = result.state.status === "READY" ? result.state.data : result.state.status === "ERROR" ? result.state.previousData : undefined;
  const displayedEvents = useMemo<readonly TimelineTransportEvent[]>(() => {
    if (model === undefined) return [];
    return model.schemaVersion === "global-life-timeline@v2"
      ? timelineEventsForDensity(model.events, density)
      : model.events;
  }, [density, model]);
  const years = useMemo(() => groupTimelineEvents(displayedEvents), [displayedEvents]);

  if ((result.state.status === "IDLE" || result.state.status === "LOADING") && model === undefined) return <div className={styles.timelineStatus} role="status" aria-busy="true">Chargement de la timeline…</div>;
  if (result.state.status === "ERROR" && model === undefined) return <div className={styles.timelineStatus} role="alert"><strong>La timeline n’a pas pu être chargée.</strong><button type="button" onClick={result.retry}>Réessayer</button></div>;
  if (model === undefined) return null;

  const focusLifeEventPeer = (peer: GlobalTimelineComparisonPeerObservation & { readonly sourceKind: "LIFE_EVENT" }) => {
    if (peer.visibilityTier === "EXTENDED") setDensity("EXTENDED");
    setLifeEventFocus((current) => ({ eventRef: peer.eventRef as `life-event:${string}`, requestId: (current?.requestId ?? 0) + 1 }));
  };

  return <div className={styles.timelineExperience} data-timeline-resource={model.resource}>
    {model.schemaVersion === "global-life-timeline@v2" ? <div className={styles.timelineDensity} role="group" aria-label="Densité de la timeline">
      <button type="button" aria-pressed={density === "PRINCIPAL"} onClick={() => setDensity("PRINCIPAL")}>Principal</button>
      <button type="button" aria-pressed={density === "EXTENDED"} onClick={() => setDensity("EXTENDED")}>Étendu</button>
      <span aria-live="polite">{displayedEvents.length} événements</span>
    </div> : null}
    <div className={styles.timelineScroller} tabIndex={0} aria-label="Timeline de notre vie, du plus ancien au plus récent">
      {years.length === 0 ? <p className={styles.timelineEmpty}>Aucun événement n’est disponible.</p> : years.map((year) => <section key={year.key} className={styles.timelineYear} aria-labelledby={`timeline-year-${year.key}`}>
        <h3 id={`timeline-year-${year.key}`}>{year.key}</h3>
        <div>{year.months.map((month) => <section key={month.key} className={styles.timelineMonth} aria-labelledby={`timeline-month-${month.key}`}>
          <h4 id={`timeline-month-${month.key}`} data-timeline-month={month.key}>{month.label}</h4>
          <ol>{month.events.map((event) => <TimelineEventRow key={event.eventRef} event={event} runtime={runtime} focusRequest={lifeEventFocus} onMomentDetail={onMomentDetail} onLifeEventPeer={focusLifeEventPeer} />)}</ol>
        </section>)}</div>
      </section>)}
    </div>
  </div>;
}
