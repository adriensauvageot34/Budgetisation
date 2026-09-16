"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Cake,
  Camera,
  CarFront,
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
import type { GlobalLifeTimelineReadModel, GlobalTimelineEvent } from "@/query-api/global-v2";
import { useGlobalV2Resource } from "./use-global-resource";
import type { GlobalV2VisitRuntime } from "./visit-runtime";
import styles from "./global-v2.module.css";

type TimelineIcon = ComponentType<{ readonly size?: number; readonly "aria-hidden"?: boolean }>;
type TimelineFilter = "KNOWN_COST" | "COMPARABLE" | "DISTINCTIVE";

const timelineIcons: Readonly<Record<string, TimelineIcon>> = Object.freeze({
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

const moneyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function timelineDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function monthKey(event: GlobalTimelineEvent): string {
  return event.startDate.slice(0, 7);
}

function eventDateLabel(event: GlobalTimelineEvent): string {
  const start = timelineDate(event.startDate);
  if (event.startDate === event.endDate) return shortDateFormatter.format(start);
  return `Du ${shortDateFormatter.format(start)} au ${shortDateFormatter.format(timelineDate(event.endDate))}`;
}

function eventAmount(event: GlobalTimelineEvent): string {
  const cost = event.causalCost;
  if (cost.status !== "KNOWN" && cost.status !== "PARTIAL") return "Coût non établi";
  if (cost.value.kind !== "MONEY") return "Coût non établi";
  return moneyFormatter.format(Number(cost.value.value));
}

function eventHasComparison(event: GlobalTimelineEvent): boolean {
  return event.comparisonSummary?.status === "PARTIAL" || event.comparisonSummary?.status === "KNOWN";
}

function eventIsDistinctive(event: GlobalTimelineEvent): boolean {
  return event.comparisonSummary?.status === "KNOWN" && event.comparisonSummary.materiality === "MATERIAL";
}

function comparisonLabel(event: GlobalTimelineEvent): string | undefined {
  const comparison = event.comparisonSummary;
  if (comparison === undefined || comparison.status === "UNKNOWN" || comparison.status === "NOT_APPLICABLE" || comparison.peerCount < 3) return undefined;
  if (comparison.status === "PARTIAL" || comparison.peerCount < 5) return "Peu de comparables";
  return "Voir la comparaison";
}

function eventMatchesFilters(event: GlobalTimelineEvent, filters: ReadonlySet<TimelineFilter>): boolean {
  if (filters.has("KNOWN_COST") && event.causalCost.status !== "KNOWN") return false;
  if (filters.has("COMPARABLE") && !eventHasComparison(event)) return false;
  if (filters.has("DISTINCTIVE") && !eventIsDistinctive(event)) return false;
  return true;
}

type TimelineMonth = { readonly key: string; readonly label: string; readonly events: readonly GlobalTimelineEvent[] };
type TimelineYear = { readonly key: string; readonly months: readonly TimelineMonth[] };

/** Sequential projection only: the Query order remains authoritative. */
export function groupTimelineEvents(events: readonly GlobalTimelineEvent[]): readonly TimelineYear[] {
  const years: { key: string; months: { key: string; label: string; events: GlobalTimelineEvent[] }[] }[] = [];
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

function TimelineEventRow({ event, onMomentDetail }: { readonly event: GlobalTimelineEvent; readonly onMomentDetail: (eventRef: string, title: string) => void }) {
  const Icon = timelineIcons[`${event.familySource}:${event.typeKey}`] ?? Circle;
  const comparison = comparisonLabel(event);
  const distinctive = eventIsDistinctive(event);
  const knownCost = event.causalCost.status === "KNOWN" || event.causalCost.status === "PARTIAL";
  const place = event.places.find(({ label }) => label !== undefined)?.label;
  const participantLabel = event.participantRefs.length === 1 ? "1 personne" : `${event.participantRefs.length} personnes`;
  const content = <>
    <time className={styles.timelineDay} dateTime={event.startDate}>{dayFormatter.format(timelineDate(event.startDate))}</time>
    <span className={styles.timelineMarker} aria-hidden><Icon size={16} aria-hidden /></span>
    <span className={styles.timelineEventBody}>
      <span className={styles.timelineEventHeading}><strong>{event.canonicalName}</strong>{distinctive ? <em>Se distingue</em> : null}</span>
      <span className={styles.timelineEventMeta}>{eventDateLabel(event)} · {event.typeLabel}{place === undefined ? "" : ` · ${place}`} · {participantLabel}</span>
      <span className={styles.timelineEventFacts}><b className={knownCost ? undefined : styles.timelineUnknown}>{eventAmount(event)}</b>{event.causalCost.status === "PARTIAL" ? <small>Coût partiellement établi</small> : null}{comparison === undefined ? null : <small className={styles.timelineComparison}>{comparison} · {event.comparisonSummary!.peerCount} événements</small>}</span>
    </span>
    {event.detailAvailability === "MOMENT_DETAIL" ? <ChevronRight className={styles.timelineChevron} aria-hidden size={18} /> : null}
  </>;
  return <li className={distinctive ? styles.timelineDistinctive : undefined} data-family-source={event.familySource} data-type-key={event.typeKey}>
    {event.detailAvailability === "MOMENT_DETAIL"
      ? <button type="button" data-global-entity-ref={event.eventRef} aria-label={`Ouvrir le détail de ${event.canonicalName}`} onClick={() => onMomentDetail(event.eventRef, event.canonicalName)}>{content}</button>
      : <article aria-label={`${event.canonicalName}, ${eventDateLabel(event)}, ${eventAmount(event)}`}>{content}</article>}
  </li>;
}

function FilterButton({ filter, active, children, onToggle }: { readonly filter: TimelineFilter; readonly active: boolean; readonly children: React.ReactNode; readonly onToggle: (filter: TimelineFilter) => void }) {
  return <button type="button" aria-pressed={active} onClick={() => onToggle(filter)}>{children}</button>;
}

export function LifeTimeline({ runtime, onMomentDetail }: { readonly runtime: GlobalV2VisitRuntime; readonly onMomentDetail: (eventRef: string, title: string) => void }) {
  const request = useMemo(() => ({ resource: "analysis_global_life_timeline" as const, params: {} }), []);
  const result = useGlobalV2Resource<GlobalLifeTimelineReadModel>(runtime, request, true, "DIRECT");
  const [filters, setFilters] = useState<ReadonlySet<TimelineFilter>>(() => new Set());
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeMonth, setActiveMonth] = useState<string>();
  const model = result.state.status === "READY" ? result.state.data : result.state.status === "ERROR" ? result.state.previousData : undefined;
  const visibleEvents = useMemo(() => model?.events.filter((event) => eventMatchesFilters(event, filters)) ?? [], [filters, model]);
  const years = useMemo(() => groupTimelineEvents(visibleEvents), [visibleEvents]);
  const months = useMemo(() => years.flatMap(({ months: entries }) => entries), [years]);

  useEffect(() => {
    setActiveMonth(months[0]?.key);
    const root = scrollerRef.current;
    if (root === null || !("IntersectionObserver" in window)) return;
    const headings = [...root.querySelectorAll<HTMLElement>("[data-timeline-month]")];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(({ isIntersecting }) => isIntersecting).at(-1);
      const key = visible?.target.getAttribute("data-timeline-month");
      if (key !== null && key !== undefined) setActiveMonth(key);
    }, { root, rootMargin: "0px 0px -72% 0px", threshold: [0, 1] });
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [months]);

  const toggleFilter = (filter: TimelineFilter) => setFilters((current) => {
    const next = new Set(current);
    if (next.has(filter)) next.delete(filter); else next.add(filter);
    return next;
  });
  const goToMonth = (key: string) => {
    const root = scrollerRef.current;
    const heading = root?.querySelector<HTMLElement>(`[data-timeline-month="${key}"]`);
    if (root === null || root === undefined || heading === null || heading === undefined) return;
    root.scrollTo({ top: heading.offsetTop, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setActiveMonth(key);
  };

  if ((result.state.status === "IDLE" || result.state.status === "LOADING") && model === undefined) return <div className={styles.timelineStatus} role="status" aria-busy="true">Chargement de la timeline…</div>;
  if (result.state.status === "ERROR" && model === undefined) return <div className={styles.timelineStatus} role="alert"><strong>La timeline n’a pas pu être chargée.</strong><button type="button" onClick={result.retry}>Réessayer</button></div>;
  if (model === undefined) return null;

  return <div className={styles.timelineExperience} data-timeline-resource={model.resource}>
    <div className={styles.timelineTools}>
      <nav className={styles.timelineMonthNav} aria-label="Aller à un mois">{months.map((month) => <button key={month.key} type="button" aria-current={activeMonth === month.key ? "true" : undefined} onClick={() => goToMonth(month.key)}>{month.label}</button>)}</nav>
      <div className={styles.timelineFilters} role="group" aria-label="Filtrer la timeline">
        <FilterButton filter="KNOWN_COST" active={filters.has("KNOWN_COST")} onToggle={toggleFilter}>Coût connu</FilterButton>
        <FilterButton filter="COMPARABLE" active={filters.has("COMPARABLE")} onToggle={toggleFilter}>Comparaison disponible</FilterButton>
        <FilterButton filter="DISTINCTIVE" active={filters.has("DISTINCTIVE")} onToggle={toggleFilter}>Se distingue</FilterButton>
      </div>
    </div>
    <div ref={scrollerRef} className={styles.timelineScroller} tabIndex={0} aria-label="Timeline de notre vie, du plus ancien au plus récent">
      {years.length === 0 ? <p className={styles.timelineEmpty}>Aucun événement ne correspond à ces filtres.</p> : years.map((year) => <section key={year.key} className={styles.timelineYear} aria-labelledby={`timeline-year-${year.key}`}>
        <h3 id={`timeline-year-${year.key}`}>{year.key}</h3>
        <div>{year.months.map((month) => <section key={month.key} className={styles.timelineMonth} aria-labelledby={`timeline-month-${month.key}`}>
          <h4 id={`timeline-month-${month.key}`} data-timeline-month={month.key}>{month.label}</h4>
          <ol>{month.events.map((event) => <TimelineEventRow key={event.eventRef} event={event} onMomentDetail={onMomentDetail} />)}</ol>
        </section>)}</div>
      </section>)}
    </div>
  </div>;
}
