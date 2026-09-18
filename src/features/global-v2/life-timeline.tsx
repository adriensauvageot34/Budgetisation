"use client";

// Deployment retrigger only: no runtime behavior change.

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  BedDouble,
  BriefcaseBusiness,
  BusFront,
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
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Ticket,
  TriangleAlert,
  Users,
  Utensils,
  Waves,
  Wine,
} from "lucide-react";
import type {
  GlobalExpandedReadModel,
  GlobalLifeTimelineReadModel,
  GlobalLifeTimelineV2ReadModel,
  GlobalMomentComponentRow,
  GlobalTimelineComparisonLevel,
  GlobalTimelineComparisonEventObservation,
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
  visibleTimelineComparisonLevels,
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
type TimelineEventFocusRequest = Readonly<{ eventRef: GlobalTimelineV2Event["eventRef"]; requestId: number }>;

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

function expenseIcon(row: GlobalMomentComponentRow): TimelineIcon {
  const value = `${row.primaryLabel} ${row.categoryLabel ?? ""} ${row.subcategoryLabel ?? ""}`.toLocaleLowerCase("fr-FR");
  if (/billet|entrée|ticket/u.test(value)) return Ticket;
  if (/uber|taxi|transport|train|bus/u.test(value)) return BusFront;
  if (/restaurant|repas|fast.?food/u.test(value)) return Utensils;
  if (/bar|bière|alcool|boisson/u.test(value)) return Wine;
  if (/course|supermarché|épicerie/u.test(value)) return ShoppingCart;
  if (/hôtel|hotel|hébergement|nuit/u.test(value)) return BedDouble;
  return ReceiptText;
}

function expenseAmount(row: GlobalMomentComponentRow): string {
  return row.amount.kind === "MONEY" ? moneyFormatter.format(Number(row.amount.value)) : "Montant non établi";
}

function TimelineExpenses({ rows, compact = false }: { readonly rows: readonly GlobalMomentComponentRow[]; readonly compact?: boolean }) {
  if (rows.length === 0) return null;
  return <span className={compact ? styles.timelineExpensePreview : styles.timelineExpenseList} aria-label={compact ? "Principales dépenses liées" : "Dépenses liées"}>
    {rows.map((row) => {
      const Icon = expenseIcon(row);
      return <span key={row.componentRef}><Icon aria-hidden size={15} /><span>{row.primaryLabel}</span><b>{expenseAmount(row)}</b></span>;
    })}
  </span>;
}

function TimelinePeerExpenses({ peer, runtime }: { readonly peer: GlobalTimelineComparisonPeerObservation; readonly runtime: GlobalV2VisitRuntime }) {
  const request = useMemo(() => ({ resource: "analysis_global_moment_experience_detail" as const, params: { entityRef: peer.eventRef } }), [peer.eventRef]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, peer.sourceKind === "MOMENT", "DIRECT");
  const model = result.state.status === "READY" ? result.state.data : result.state.status === "ERROR" ? result.state.previousData : undefined;
  if (peer.sourceKind !== "MOMENT" || model?.momentComponentRows === undefined || model.momentComponentRows.length === 0) return null;
  return <TimelineExpenses rows={model.momentComponentRows} />;
}

function readyComparison(state: ReturnType<typeof useGlobalV2Resource<GlobalTimelineEventComparisonReadModel>>["state"]): GlobalTimelineEventComparisonReadModel | undefined {
  return state.status === "READY" ? state.data : state.status === "ERROR" ? state.previousData : undefined;
}

export function TimelineComparator({ event, runtime, onOpenPeer }: {
  readonly event: GlobalTimelineV2Event;
  readonly runtime: GlobalV2VisitRuntime;
  readonly onOpenPeer: (peer: GlobalTimelineComparisonEventObservation) => void;
}) {
  const declared = useMemo(() => orderedTimelineComparisonLevels(event), [event]);
  const seriesRequest = useMemo(() => timelineComparisonRequest(event.eventRef, "SAME_SERIES"), [event.eventRef]);
  const closeRequest = useMemo(() => timelineComparisonRequest(event.eventRef, "SAME_CLOSE_FAMILY"), [event.eventRef]);
  const intermediateRequest = useMemo(() => timelineComparisonRequest(event.eventRef, "SAME_INTERMEDIATE_FAMILY"), [event.eventRef]);
  const seriesResult = useGlobalV2Resource<GlobalTimelineEventComparisonReadModel>(runtime, seriesRequest, declared.some(({ level }) => level === "SAME_SERIES"), "BACKGROUND");
  const closeResult = useGlobalV2Resource<GlobalTimelineEventComparisonReadModel>(runtime, closeRequest, declared.some(({ level }) => level === "SAME_CLOSE_FAMILY"), "BACKGROUND");
  const intermediateResult = useGlobalV2Resource<GlobalTimelineEventComparisonReadModel>(runtime, intermediateRequest, declared.some(({ level }) => level === "SAME_INTERMEDIATE_FAMILY"), "BACKGROUND");
  const models = [readyComparison(seriesResult.state), readyComparison(closeResult.state), readyComparison(intermediateResult.state)];
  const descriptors = visibleTimelineComparisonLevels(event, models.flatMap((model) => model === undefined ? [] : [{ level: model.comparison.level, peerRefs: model.relatedPeers.map(({ eventRef }) => eventRef) }]));
  const [selectedLevel, setSelectedLevel] = useState<GlobalTimelineComparisonLevel | undefined>(() => initialTimelineComparisonLevel(event));
  const [selectedPeer, setSelectedPeer] = useState<GlobalTimelineComparisonPeerObservation | undefined>(undefined);
  const fallbackLevel = selectedLevel ?? descriptors[0]?.level;
  if (fallbackLevel === undefined) throw new TypeError(`TIMELINE_COMPARATOR_LEVEL_MISSING:${event.eventRef}`);
  const result = fallbackLevel === "SAME_SERIES" ? seriesResult : fallbackLevel === "SAME_CLOSE_FAMILY" ? closeResult : intermediateResult;
  const model = readyComparison(result.state);
  useEffect(() => {
    if (descriptors.some(({ level }) => level === selectedLevel)) return;
    setSelectedLevel(descriptors[0]?.level);
  }, [descriptors, selectedLevel]);
  useEffect(() => { setSelectedPeer(undefined); }, [selectedLevel]);
  const distinctiveLabel = event.distinctiveComparisonLevel === undefined
    ? undefined
    : descriptors.some(({ level }) => level === event.distinctiveComparisonLevel)
      ? timelineComparisonLevelLabel(event, event.distinctiveComparisonLevel)
      : undefined;

  return <section className={styles.timelineComparator} aria-label={`Comparaison de ${event.canonicalName}`}>
    <div className={styles.timelineComparisonLevels} role="radiogroup" aria-label="Profondeur de comparaison">
      {descriptors.map(({ level, relatedPeerCount }) => <button
        key={level}
        type="button"
        role="radio"
        aria-checked={selectedLevel === level}
        onClick={() => setSelectedLevel(level)}
      >{timelineComparisonLevelLabel(event, level)} · {relatedPeerCount}</button>)}
    </div>
    {distinctiveLabel === undefined ? null : <p className={styles.timelineDistinctiveBasis}>Se distingue sur la base « {distinctiveLabel} ».</p>}
    {(result.state.status === "IDLE" || result.state.status === "LOADING") && model === undefined
      ? <p className={styles.timelineComparatorStatus} role="status" aria-busy="true">Chargement de la comparaison…</p>
      : result.state.status === "ERROR" && model === undefined
        ? <p className={styles.timelineComparatorStatus} role="alert">La comparaison n’a pas pu être chargée. <button type="button" onClick={result.retry}>Réessayer</button></p>
        : model === undefined ? null : <div className={styles.timelineComparatorResult} data-comparison-level={model.comparison.level}>
          {model.support.status === "LIMITED" ? <p className={styles.timelineComparatorSupport}>Recul limité : la relation est établie, mais la tendance financière ne l’est pas.</p> : null}
          {model.subject.eventCost.status === "KNOWN" && model.statistics !== undefined ? <ComparisonRange
            key={`${event.eventRef}:${model.comparison.level}`}
            observed={timelineMoneyMeasure(model.subject.eventCost.value)}
            median={timelineMoneyMeasure(model.statistics.median)}
            lower={timelineMoneyMeasure(model.statistics.q1)}
            upper={timelineMoneyMeasure(model.statistics.q3)}
            supportCount={timelineCountMeasure(model.support.costPeerCount)}
            subjectLabel={model.subject.canonicalName}
            comparisonLabel="événements comparables"
            peers={model.costComparablePeers}
            onOpenPeer={onOpenPeer}
            onSelectPeer={setSelectedPeer}
            selectedPeerDetails={selectedPeer === undefined ? null : <TimelinePeerExpenses peer={selectedPeer} runtime={runtime} />}
          /> : <p className={styles.timelineComparatorStatus}>{model.subject.eventCost.status === "KNOWN" ? "Pas assez de coûts comparables pour établir une tendance fiable." : "Le coût de cet événement n’est pas établi ; ses relations sémantiques restent visibles."}</p>}
        </div>}
  </section>;
}

function TimelineV2EventRow({ event, runtime, focusRequest, expanded, onToggle, onTimelinePeer }: {
  readonly event: GlobalTimelineV2Event;
  readonly runtime: GlobalV2VisitRuntime;
  readonly focusRequest: TimelineEventFocusRequest | undefined;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onTimelinePeer: (peer: GlobalTimelineComparisonEventObservation) => void;
}) {
  const [hasExpanded, setHasExpanded] = useState(expanded);
  const [detailsNearViewport, setDetailsNearViewport] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const cardArticleRef = useRef<HTMLElement>(null);
  const Icon = semanticCloseIcons[event.semanticClassification.close.key]
    ?? semanticIntermediateIcons[event.semanticClassification.intermediate.key]
    ?? Circle;
  const distinctive = event.distinctiveComparisonLevel !== undefined;
  const comparisonAvailable = hasTimelineComparisonAffordance(event);
  const isMomentDetail = event.sourceKind === "MOMENT" && event.momentDetailAvailable;
  const detailsId = `timeline-event-${event.eventRef.replace(":", "-")}`;
  const detailRequest = useMemo(() => ({ resource: "analysis_global_moment_experience_detail" as const, params: { entityRef: event.eventRef } }), [event.eventRef]);
  const detailResult = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, detailRequest, detailsNearViewport && isMomentDetail, "BACKGROUND");
  const detailModel = detailResult.state.status === "READY" ? detailResult.state.data : detailResult.state.status === "ERROR" ? detailResult.state.previousData : undefined;
  const expenseRows = detailModel?.momentComponentRows ?? [];
  const canExpand = expenseRows.length > 0 && comparisonAvailable;
  useEffect(() => { if (expanded) setHasExpanded(true); }, [expanded]);
  useEffect(() => {
    const element = rowRef.current;
    if (detailsNearViewport || !isMomentDetail || element === null) return;
    if (!("IntersectionObserver" in window)) {
      setDetailsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setDetailsNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "120% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [detailsNearViewport, isMomentDetail]);
  useEffect(() => {
    if (focusRequest?.eventRef !== event.eventRef) return;
    const frame = window.requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      (cardButtonRef.current ?? cardArticleRef.current)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [event.eventRef, focusRequest]);
  const content = <>
    <time className={styles.timelineDay} dateTime={event.startDate}>{dayFormatter.format(timelineDate(event.startDate))}</time>
    <span className={styles.timelineMarker} aria-hidden><Icon size={16} aria-hidden /></span>
    <span className={styles.timelineEventBody}>
      <span className={styles.timelineEventHeading}><strong>{event.canonicalName}</strong>{distinctive ? <em>Se distingue</em> : null}</span>
      <span className={styles.timelineEventMeta}>{event.primaryPlaceLabel === undefined ? null : <><span className={styles.timelinePlaceLabel}>{event.primaryPlaceLabel}</span><span aria-hidden> · </span></>}<span>{event.semanticClassification.close.label}</span></span>
      <span className={styles.timelineEventFacts}>
        {event.eventCost.status === "KNOWN" ? <b>{timelineEventAmount(event)}</b> : null}
      </span>
    </span>
    {expenseRows.length > 0 ? <TimelineExpenses rows={expenseRows} compact /> : null}
    {canExpand ? <ChevronDown className={styles.timelineChevron} data-expanded={expanded} aria-hidden size={18} /> : null}
  </>;

  return <li
    ref={rowRef}
    className={distinctive ? styles.timelineDistinctive : undefined}
    data-source-kind={event.sourceKind}
    data-semantic-close={event.semanticClassification.close.key}
    data-visibility-tier={event.visibilityTier}
    data-has-expenses={expenseRows.length > 0}
  >
    {canExpand
      ? <button ref={cardButtonRef} type="button" data-global-entity-ref={event.eventRef} aria-label={`${expanded ? "Refermer" : "Explorer"} ${event.canonicalName}`} aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle}>{content}</button>
      : <article ref={cardArticleRef} tabIndex={-1} data-global-entity-ref={event.eventRef} aria-label={event.canonicalName}>{content}</article>}
    {canExpand ? <div id={detailsId} className={styles.timelineAccordion} data-expanded={expanded} aria-hidden={!expanded}>
      {hasExpanded ? <div><TimelineComparator event={event} runtime={runtime} onOpenPeer={onTimelinePeer} /></div> : null}
    </div> : null}
  </li>;
}

function TimelineEventRow({ event, runtime, focusRequest, expanded, onToggle, onMomentDetail, onTimelinePeer }: {
  readonly event: TimelineTransportEvent;
  readonly runtime: GlobalV2VisitRuntime;
  readonly focusRequest: TimelineEventFocusRequest | undefined;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onMomentDetail: (eventRef: string, title: string) => void;
  readonly onTimelinePeer: (peer: GlobalTimelineComparisonEventObservation) => void;
}) {
  return "eventCost" in event
    ? <TimelineV2EventRow event={event} runtime={runtime} focusRequest={focusRequest} expanded={expanded} onToggle={onToggle} onTimelinePeer={onTimelinePeer} />
    : <LegacyTimelineEventRow event={event} onMomentDetail={onMomentDetail} />;
}

export function LifeTimeline({ runtime, density, onDensityChange, onMomentDetail }: { readonly runtime: GlobalV2VisitRuntime; readonly density: TimelineDensityMode; readonly onDensityChange: (density: TimelineDensityMode) => void; readonly onMomentDetail: (eventRef: string, title: string) => void }) {
  const [expandedEventRef, setExpandedEventRef] = useState<GlobalTimelineV2Event["eventRef"] | undefined>(undefined);
  const [eventFocus, setEventFocus] = useState<TimelineEventFocusRequest | undefined>(undefined);
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
  useEffect(() => {
    const focus = (raw: Event) => {
      const detail = (raw as CustomEvent<{ readonly eventRef?: unknown; readonly visibilityTier?: unknown }>).detail;
      if (typeof detail?.eventRef !== "string" || !detail.eventRef.startsWith("life-event:")) return;
      if (detail.visibilityTier === "EXTENDED") onDensityChange("EXTENDED");
      const eventRef = detail.eventRef as GlobalTimelineV2Event["eventRef"];
      setExpandedEventRef(eventRef);
      setEventFocus((current) => ({ eventRef, requestId: (current?.requestId ?? 0) + 1 }));
    };
    window.addEventListener("global-v2:focus-life-event", focus);
    return () => window.removeEventListener("global-v2:focus-life-event", focus);
  }, [onDensityChange]);
  useEffect(() => {
    if (density !== "PRINCIPAL" || model?.schemaVersion !== "global-life-timeline@v2") return;
    if (model.events.find(({ eventRef }) => eventRef === expandedEventRef)?.visibilityTier === "EXTENDED") setExpandedEventRef(undefined);
  }, [density, expandedEventRef, model]);

  if ((result.state.status === "IDLE" || result.state.status === "LOADING") && model === undefined) return <div className={styles.timelineStatus} role="status" aria-busy="true">Chargement de la timeline…</div>;
  if (result.state.status === "ERROR" && model === undefined) return <div className={styles.timelineStatus} role="alert"><strong>La timeline n’a pas pu être chargée.</strong><button type="button" onClick={result.retry}>Réessayer</button></div>;
  if (model === undefined) return null;

  const focusTimelinePeer = (peer: GlobalTimelineComparisonEventObservation) => {
    if (peer.visibilityTier === "EXTENDED") onDensityChange("EXTENDED");
    setExpandedEventRef(peer.eventRef);
    setEventFocus((current) => ({ eventRef: peer.eventRef, requestId: (current?.requestId ?? 0) + 1 }));
  };

  return <div className={styles.timelineExperience} data-timeline-resource={model.resource}>
    <div className={styles.timelineScroller} tabIndex={0} aria-label="Timeline de notre vie, du plus ancien au plus récent">
      {years.length === 0 ? <p className={styles.timelineEmpty}>Aucun événement n’est disponible.</p> : years.map((year) => <section key={year.key} className={styles.timelineYear} aria-labelledby={`timeline-year-${year.key}`}>
        <h3 id={`timeline-year-${year.key}`}>{year.key}</h3>
        <div>{year.months.map((month) => <section key={month.key} className={styles.timelineMonth} aria-labelledby={`timeline-month-${month.key}`}>
          <h4 id={`timeline-month-${month.key}`} data-timeline-month={month.key}>{month.label}</h4>
          <ol>{month.events.map((event) => <TimelineEventRow key={event.eventRef} event={event} runtime={runtime} focusRequest={eventFocus} expanded={expandedEventRef === event.eventRef} onToggle={() => setExpandedEventRef((current) => current === event.eventRef ? undefined : event.eventRef as GlobalTimelineV2Event["eventRef"])} onMomentDetail={onMomentDetail} onTimelinePeer={focusTimelinePeer} />)}</ol>
        </section>)}</div>
      </section>)}
    </div>
  </div>;
}