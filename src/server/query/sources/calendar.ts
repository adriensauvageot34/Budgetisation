import "server-only";

import type {
  ActivityOccurrenceFact,
  EconomicComponentFact,
  PlaceVisitFact,
} from "@/analytics/facts";
import {
  parseMomentId,
  parseLifeEventId,
  parseOperationId,
  type LifeEventId,
  type MomentId,
  type PersonId,
  type PlaceId,
} from "@/core/identity";
import { addMoney, isZeroMoney, parseMoney, type Money } from "@/core/money";
import { parseLifeScopeContext, type AnalysisScope } from "@/core/scope";
import { parseInstant, parseLocalDate, type Instant, type LocalDate, type YearMonth } from "@/core/time";
import {
  listCivilMonthDates,
  type CalendarDayCell,
  type CalendarDayMarker,
  type CalendarExplorationTarget,
  type CalendarFlag,
  type CalendarMarkerKind,
  type CalendarMonthHighlight,
  type CalendarPlaceRef,
  type CalendarSpanningEvent,
  type DayJournalMoment,
  type DayOperationPreviewItem,
  type HistoryCalendarMonthReadModel,
  type HistoryDayDetailReadModel,
  type LifeScopeSummary,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import {
  adjacentEligibleHistoryMonths,
  eligibleHistoryMonths,
} from "@/server/bootstrap/history-calendar";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import {
  canonicalString,
  optionalCanonicalString,
  type CanonicalRecord,
} from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { canonicalHumanLabel } from "./canonical-relations";
import {
  countEnvelope,
  exactEconomicAmountForDate,
  moneyEnvelope,
  moneyEnvelopeFromScoped,
  monthRange,
  operationFromCanonicalRow,
  periodCompleteness,
  selectFactsForSubject,
  unavailableMoneyEnvelope,
} from "./shared";

type ActivityTypeMeta = {
  readonly label: string;
  readonly publicLabel?: string;
  readonly priority: number;
  readonly kind: CalendarMarkerKind;
};

type Narrative = {
  readonly id: string;
  readonly kind: CalendarMarkerKind;
  readonly label: string;
  readonly priority: number;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly participantIds: readonly PersonId[];
  readonly lifeEventIds: readonly LifeEventId[];
  readonly target: CalendarExplorationTarget;
  readonly place?: CalendarPlaceRef;
  readonly startAt?: Instant;
  readonly endAt?: Instant;
};

type CalendarMonthProjectionBundle = {
  readonly month: YearMonth;
  readonly scope: AnalysisScope;
  readonly economicFacts: readonly EconomicComponentFact[];
  readonly personDays: Awaited<ReturnType<FactSourceResolver["loadPersonDays"]>>;
  readonly activities: readonly ActivityOccurrenceFact[];
  readonly places: readonly PlaceVisitFact[];
  readonly operations: readonly ReturnType<typeof operationFromCanonicalRow>[];
  readonly monthMetric: Awaited<ReturnType<MetricQueryService["produce"]>>;
  readonly narratives: readonly Narrative[];
  readonly placeById: ReadonlyMap<string, CalendarPlaceRef>;
  readonly privatePlaceIds: ReadonlySet<string>;
  readonly financialLinks: readonly CanonicalRecord[];
};

type CalendarDependencies = {
  readonly context: AuthorizedRuntimeContext;
  readonly repository: CanonicalRepository;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
};

function uniqueSorted<Id extends string>(values: readonly Id[]): readonly Id[] {
  return [...new Set(values)].sort();
}

function calendarKindForTypeKey(typeKey: string): CalendarMarkerKind {
  switch (typeKey) {
    case "travail_site": return "work";
    case "teletravail": return "remote_work";
    case "voyage_sejour":
    case "deplacement_pro": return "travel";
    case "lecon_conduite":
    case "examen_permis": return "driving";
    case "rdv_medical":
    case "pharmacie":
    case "soin_personnel": return "health";
    case "repas_restaurant":
    case "livraison_repas": return "meal";
    case "shopping_commerce":
    case "courses_alimentaires": return "shopping";
    case "spectacle_culture":
    case "activite_loisir":
    case "sortie_soiree": return "culture";
    case "visite_famille":
    case "visite_ami": return "family";
    case "celebration":
    case "funeraire": return "celebration";
    case "demarche_admin":
    case "entretien_voiture": return "administrative";
    case "journee_maison": return "home";
    default: return "activity";
  }
}

function priorityFromRow(row: CanonicalRecord, fallback = 50): number {
  const raw = row.calendar_priority;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : fallback;
  return Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value))) : fallback;
}

function activityTypeMeta(rows: readonly CanonicalRecord[]): ReadonlyMap<string, ActivityTypeMeta> {
  const result = new Map<string, ActivityTypeMeta>();
  for (const row of rows) {
    const typeKey = canonicalString(row, ["type_key"], "life_events");
    const publicLabel = optionalCanonicalString(row, ["calendar_public_label"]);
    result.set(typeKey, {
      label: optionalCanonicalString(row, ["label"]) ?? "Événement de vie",
      ...(publicLabel === undefined ? {} : { publicLabel }),
      priority: priorityFromRow(row),
      kind: calendarKindForTypeKey(typeKey),
    });
  }
  return result;
}

function placeCatalog(rows: readonly CanonicalRecord[]): {
  readonly placeById: ReadonlyMap<string, CalendarPlaceRef>;
  readonly privatePlaceIds: ReadonlySet<string>;
} {
  const placeById = new Map<string, CalendarPlaceRef>();
  const privatePlaceIds = new Set<string>();
  for (const row of rows) {
    const placeId = canonicalString(row, ["place_id"], "entities") as PlaceId;
    placeById.set(placeId, {
      placeId,
      label: canonicalHumanLabel(row, "Lieu"),
    });
    if (row.private_place === true) privatePlaceIds.add(placeId);
  }
  return { placeById, privatePlaceIds };
}

function participantTimes(rows: readonly CanonicalRecord[]): ReadonlyMap<string, { readonly startAt?: Instant; readonly endAt?: Instant }> {
  const mutable = new Map<string, { startAt?: Instant; endAt?: Instant }>();
  for (const row of rows) {
    const status = optionalCanonicalString(row, ["participation_status"]);
    if (
      status !== undefined &&
      status !== "Confirmé" &&
      status !== "Déduit" &&
      status !== "Confirmée" &&
      status !== "Déduite"
    ) continue;
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const rawStart = optionalCanonicalString(row, ["start_at"]);
    const rawEnd = optionalCanonicalString(row, ["end_at"]);
    const startAt = rawStart === undefined ? undefined : parseInstant(rawStart);
    const endAt = rawEnd === undefined ? undefined : parseInstant(rawEnd);
    const current = mutable.get(lifeEventId) ?? {};
    if (startAt !== undefined && (current.startAt === undefined || startAt < current.startAt)) current.startAt = startAt;
    if (endAt !== undefined && (current.endAt === undefined || endAt > current.endAt)) current.endAt = endAt;
    mutable.set(lifeEventId, current);
  }
  return mutable;
}

function placeForLifeEvents(
  lifeEventIds: readonly LifeEventId[],
  recordByLifeEventId: ReadonlyMap<string, CanonicalRecord>,
  placeById: ReadonlyMap<string, CalendarPlaceRef>,
): CalendarPlaceRef | undefined {
  const ids = uniqueSorted(lifeEventIds.flatMap((lifeEventId) => {
    const row = recordByLifeEventId.get(lifeEventId);
    const placeId = row === undefined ? undefined : optionalCanonicalString(row, ["primary_place_id"]);
    return placeId === undefined ? [] : [placeId];
  }));
  return ids.length === 1 ? placeById.get(ids[0]!) : undefined;
}

function buildNarratives(input: {
  readonly activities: readonly ActivityOccurrenceFact[];
  readonly typeMeta: ReadonlyMap<string, ActivityTypeMeta>;
  readonly lifeEventRows: readonly CanonicalRecord[];
  readonly momentRows: readonly CanonicalRecord[];
  readonly momentLinks: readonly CanonicalRecord[];
  readonly participationRows: readonly CanonicalRecord[];
  readonly placeById: ReadonlyMap<string, CalendarPlaceRef>;
}): readonly Narrative[] {
  const activityById = new Map(input.activities.map((fact) => [fact.lifeEventId, fact] as const));
  const recordByLifeEventId = new Map(input.lifeEventRows.map((row) => [canonicalString(row, ["life_event_id"], "life_events"), row] as const));
  const timesByLifeEventId = participantTimes(input.participationRows);
  const eventIdsByMomentId = new Map<string, LifeEventId[]>();
  const momentIdByLifeEventId = new Map<string, MomentId>();
  for (const row of input.momentLinks) {
    const momentId = parseMomentId(canonicalString(row, ["moment_id"], "life_events"));
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events") as LifeEventId;
    if (!activityById.has(lifeEventId)) continue;
    const ids = eventIdsByMomentId.get(momentId) ?? [];
    ids.push(lifeEventId);
    eventIdsByMomentId.set(momentId, ids);
    if (!momentIdByLifeEventId.has(lifeEventId)) momentIdByLifeEventId.set(lifeEventId, momentId);
  }

  const narratives: Narrative[] = [];
  for (const row of input.momentRows) {
    const momentId = parseMomentId(canonicalString(row, ["moment_id"], "entities"));
    const linkedEventIds = uniqueSorted(eventIdsByMomentId.get(momentId) ?? []);
    const linkedFacts = linkedEventIds.flatMap((id) => {
      const fact = activityById.get(id);
      return fact === undefined ? [] : [fact];
    });
    const rawStart = optionalCanonicalString(row, ["start_date"]);
    const rawEnd = optionalCanonicalString(row, ["end_date"]);
    const startsOn = rawStart === undefined
      ? linkedFacts.map(({ startDate }) => startDate).sort()[0]
      : parseLocalDate(rawStart);
    const endsOn = rawEnd === undefined
      ? linkedFacts.map(({ endDate }) => endDate).sort().at(-1) ?? startsOn
      : parseLocalDate(rawEnd);
    if (startsOn === undefined || endsOn === undefined) continue;
    const dominantFact = [...linkedFacts].sort((left, right) => {
      const leftPriority = input.typeMeta.get(left.activityId)?.priority ?? 50;
      const rightPriority = input.typeMeta.get(right.activityId)?.priority ?? 50;
      return rightPriority - leftPriority || left.lifeEventId.localeCompare(right.lifeEventId);
    })[0];
    const dominantMeta = dominantFact === undefined ? undefined : input.typeMeta.get(dominantFact.activityId);
    const times = linkedEventIds.flatMap((id) => {
      const value = timesByLifeEventId.get(id);
      return value === undefined ? [] : [value];
    });
    const startAt = times.flatMap(({ startAt: value }) => value === undefined ? [] : [value]).sort()[0];
    const endAt = times.flatMap(({ endAt: value }) => value === undefined ? [] : [value]).sort().at(-1);
    const structure = optionalCanonicalString(row, ["moment_structure"]);
    const kind: CalendarMarkerKind = dominantMeta?.kind
      ?? (structure === "Occasion / célébration" ? "celebration" : "moment");
    narratives.push({
      id: `moment:${momentId}`,
      kind,
      label: canonicalHumanLabel(row, "Moment de vie"),
      priority: dominantMeta?.priority ?? 85,
      startsOn,
      endsOn,
      participantIds: uniqueSorted(linkedFacts.flatMap(({ participantIds }) => participantIds)),
      lifeEventIds: linkedEventIds,
      target: { kind: "moment", id: momentId },
      ...(placeForLifeEvents(linkedEventIds, recordByLifeEventId, input.placeById) === undefined
        ? {}
        : { place: placeForLifeEvents(linkedEventIds, recordByLifeEventId, input.placeById) }),
      ...(startAt === undefined ? {} : { startAt }),
      ...(endAt === undefined ? {} : { endAt }),
    });
  }

  for (const fact of input.activities) {
    if (momentIdByLifeEventId.has(fact.lifeEventId)) continue;
    const meta = input.typeMeta.get(fact.activityId);
    const record = recordByLifeEventId.get(fact.lifeEventId);
    const times = timesByLifeEventId.get(fact.lifeEventId);
    const place = placeForLifeEvents([fact.lifeEventId], recordByLifeEventId, input.placeById);
    narratives.push({
      id: `life-event:${fact.lifeEventId}`,
      kind: meta?.kind ?? "activity",
      label: record === undefined
        ? meta?.publicLabel ?? meta?.label ?? "Événement de vie"
        : optionalCanonicalString(record, ["title"]) ?? meta?.publicLabel ?? meta?.label ?? "Événement de vie",
      priority: meta?.priority ?? 50,
      startsOn: fact.startDate,
      endsOn: fact.endDate,
      participantIds: uniqueSorted(fact.participantIds),
      lifeEventIds: [fact.lifeEventId],
      target: { kind: "life_event", id: fact.lifeEventId },
      ...(place === undefined ? {} : { place }),
      ...(times?.startAt === undefined ? {} : { startAt: times.startAt }),
      ...(times?.endAt === undefined ? {} : { endAt: times.endAt }),
    });
  }
  narratives.sort((left, right) => right.priority - left.priority || left.startsOn.localeCompare(right.startsOn) || left.id.localeCompare(right.id));
  return narratives;
}

function observabilityForDate(snapshot: CalendarMonthProjectionBundle, date: LocalDate, context: AuthorizedRuntimeContext): CalendarDayCell["observability"] {
  const days = snapshot.personDays.filter(({ localDate }) => localDate === date);
  if (snapshot.scope.subject.kind === "person") {
    const personId = snapshot.scope.subject.personId;
    const selected = days.find((day) => day.personId === personId);
    if (selected === undefined) return "unobserved";
    return selected.locationObservability === "observable" ? "observable" : "partial";
  }
  if (days.length === 0) return "unobserved";
  return days.length === context.personIds.length && days.every(({ locationObservability }) => locationObservability === "observable")
    ? "observable"
    : "partial";
}

function lifeScopeSummary(
  contributions: ReturnType<typeof exactEconomicAmountForDate>["contributions"],
  availability: "known" | "unknown" | "conflict",
): LifeScopeSummary {
  if (availability !== "known") return { availability, entries: [] };
  const totals = new Map<"Vie courante" | "Hors quotidien", Money>();
  for (const { fact, amount } of contributions) {
    if (fact.lifeScope.kind !== "resolved") continue;
    const context = parseLifeScopeContext(fact.lifeScope.value);
    totals.set(context, addMoney(totals.get(context) ?? parseMoney("0"), amount));
  }
  const order = ["Vie courante", "Hors quotidien"] as const;
  return {
    availability: "known",
    entries: order.flatMap((context) => {
      const amount = totals.get(context);
      return amount === undefined ? [] : [{ context, economicAmount: moneyEnvelope(amount) }];
    }),
  };
}

function operationItem(
  operation: CalendarMonthProjectionBundle["operations"][number],
  economicFactByOperation: ReadonlyMap<string, EconomicComponentFact>,
): DayOperationPreviewItem {
  const fact = economicFactByOperation.get(operation.operationId);
  return {
    operationId: operation.operationId,
    bankDate: operation.bankDate,
    label: operation.label,
    amount: operation.bankAmount,
    ...(fact?.category.kind === "resolved"
      ? { categoryId: fact.category.id }
      : operation.categoryId === undefined ? {} : { categoryId: operation.categoryId }),
    ...(fact?.merchant.kind === "resolved"
      ? { merchantId: fact.merchant.id }
      : operation.merchantId === undefined ? {} : { merchantId: operation.merchantId }),
    ...(fact?.canonicalPlace.kind === "resolved" ? { placeId: fact.canonicalPlace.placeId } : {}),
  };
}

function operationsForBankDate(snapshot: CalendarMonthProjectionBundle, date: LocalDate): readonly DayOperationPreviewItem[] {
  if (snapshot.scope.subject.kind === "person") return [];
  const factByOperation = new Map<string, EconomicComponentFact>();
  for (const fact of snapshot.economicFacts) {
    if (fact.sourceOperation.kind === "resolved" && !factByOperation.has(fact.sourceOperation.id)) {
      factByOperation.set(fact.sourceOperation.id, fact);
    }
  }
  return snapshot.operations
    .filter(({ bankDate }) => bankDate === date)
    .map((operation) => operationItem(operation, factByOperation));
}

function narrativeAmountForDate(
  snapshot: CalendarMonthProjectionBundle,
  narrative: Narrative,
  date: LocalDate,
  context: AuthorizedRuntimeContext,
): Money | undefined {
  let total = parseMoney("0");
  let found = false;
  const exact = exactEconomicAmountForDate(snapshot.economicFacts, date, periodCompleteness(context, snapshot.month));
  for (const { fact, amount } of exact.contributions) {
    if (narrative.target.kind === "moment" && fact.moment.kind === "resolved" && fact.moment.id === narrative.target.id) {
      total = addMoney(total, amount);
      found = true;
    }
  }
  return found ? total : undefined;
}

function markersForDate(
  snapshot: CalendarMonthProjectionBundle,
  date: LocalDate,
  context: AuthorizedRuntimeContext,
): readonly CalendarDayMarker[] {
  const markers: CalendarDayMarker[] = [];
  for (const narrative of snapshot.narratives) {
    if (date < narrative.startsOn || date > narrative.endsOn) continue;
    const amount = narrativeAmountForDate(snapshot, narrative, date, context);
    markers.push({
      id: narrative.id,
      kind: narrative.kind,
      label: narrative.label,
      priority: narrative.priority,
      participantIds: narrative.participantIds,
      ...(narrative.startAt === undefined ? {} : { startAt: narrative.startAt }),
      ...(narrative.endAt === undefined ? {} : { endAt: narrative.endAt }),
      ...(narrative.place === undefined ? {} : { place: narrative.place }),
      ...(amount === undefined ? {} : { economicAmount: moneyEnvelope(amount) }),
      target: narrative.target,
    });
  }
  const visits = selectFactsForSubject(snapshot.places, snapshot.scope).filter(({ localDate }) => localDate === date);
  const visitsByPlace = new Map<string, PlaceVisitFact[]>();
  for (const visit of visits) {
    if (snapshot.privatePlaceIds.has(visit.placeId)) continue;
    const values = visitsByPlace.get(visit.placeId) ?? [];
    values.push(visit);
    visitsByPlace.set(visit.placeId, values);
  }
  for (const [placeId, values] of visitsByPlace) {
    const place = snapshot.placeById.get(placeId);
    if (place === undefined) continue;
    const starts = values.flatMap(({ interval }) => interval.kind !== "unknown" && interval.startedAt !== null ? [interval.startedAt] : []).sort();
    const ends = values.flatMap(({ interval }) => interval.kind !== "unknown" && interval.endedAt !== null ? [interval.endedAt] : []).sort();
    markers.push({
      id: `place:${date}:${placeId}`,
      kind: "place",
      label: place.label,
      priority: 10,
      participantIds: uniqueSorted(values.map(({ personId }) => personId)),
      ...(starts[0] === undefined ? {} : { startAt: starts[0] }),
      ...(ends.at(-1) === undefined ? {} : { endAt: ends.at(-1) }),
      place,
      target: { kind: "place", id: place.placeId },
    });
  }
  markers.sort((left, right) => right.priority - left.priority || left.label.localeCompare(right.label, "fr") || left.id.localeCompare(right.id));
  return markers;
}

function flagsForDay(input: {
  readonly operations: readonly unknown[];
  readonly activities: readonly unknown[];
  readonly places: readonly unknown[];
  readonly lifeScope: LifeScopeSummary;
  readonly economic: ReturnType<typeof exactEconomicAmountForDate>["envelope"];
  readonly completeness: ReturnType<typeof periodCompleteness>;
  readonly observability: CalendarDayCell["observability"];
}): readonly CalendarFlag[] {
  const flags: CalendarFlag[] = [];
  if (input.operations.length > 0) flags.push("has_operations");
  if (input.activities.length > 0) flags.push("has_activity");
  if (input.places.length > 0) flags.push("has_place_visit");
  if (input.lifeScope.availability === "known" && input.lifeScope.entries.some(({ context }) => context === "Hors quotidien")) flags.push("has_outside_daily_life");
  if (input.observability === "partial" || input.economic.coverage?.level === "partial") flags.push("partial_data");
  if (input.economic.availability === "conflict") flags.push("conflict");
  if (input.completeness !== "complete") flags.push("incomplete_period");
  return flags;
}

function buildDayCell(snapshot: CalendarMonthProjectionBundle, date: LocalDate, context: AuthorizedRuntimeContext): CalendarDayCell {
  const economic = snapshot.scope.subject.kind === "household"
    ? exactEconomicAmountForDate(snapshot.economicFacts, date, periodCompleteness(context, snapshot.month))
    : { envelope: unavailableMoneyEnvelope("unknown"), contributions: [] };
  const activities = selectFactsForSubject(snapshot.activities, snapshot.scope).filter(({ startDate, endDate }) => startDate <= date && date <= endDate);
  const places = selectFactsForSubject(snapshot.places, snapshot.scope).filter(({ localDate }) => localDate === date);
  const operations = operationsForBankDate(snapshot, date);
  const lifeScope = lifeScopeSummary(economic.contributions, economic.envelope.availability === "not_applicable" ? "unknown" : economic.envelope.availability);
  const observability = observabilityForDate(snapshot, date, context);
  const markers = markersForDate(snapshot, date, context);
  return {
    date,
    observability,
    dayContext: { kind: "unknown" },
    lifeScopeSummary: lifeScope,
    economicAmount: economic.envelope,
    operationCount: countEnvelope(operations.length),
    activityOccurrenceCount: countEnvelope(activities.length),
    placeVisitCount: countEnvelope(places.length),
    markers,
    hasDetail: markers.length > 0 || operations.length > 0 || (economic.envelope.availability === "known" && !isZeroMoney(economic.envelope.value)),
    flags: flagsForDay({ operations, activities, places, lifeScope, economic: economic.envelope, completeness: periodCompleteness(context, snapshot.month), observability }),
  };
}

function highlights(snapshot: CalendarMonthProjectionBundle): readonly CalendarMonthHighlight[] {
  const dates = listCivilMonthDates(snapshot.month);
  const start = dates[0]!;
  const end = dates.at(-1)!;
  return snapshot.narratives.filter((narrative) => narrative.startsOn <= end && narrative.endsOn >= start).slice(0, 4).map((narrative) => ({
    id: narrative.id,
    kind: narrative.kind,
    label: narrative.label,
    startsOn: narrative.startsOn,
    endsOn: narrative.endsOn,
    participantIds: narrative.participantIds,
    target: narrative.target,
  }));
}

function spanningEvents(snapshot: CalendarMonthProjectionBundle): readonly CalendarSpanningEvent[] {
  const dates = listCivilMonthDates(snapshot.month);
  const start = dates[0]!;
  const end = dates.at(-1)!;
  return snapshot.narratives.filter(({ startsOn, endsOn }) => startsOn !== endsOn && startsOn <= end && endsOn >= start).map((narrative) => ({
    id: narrative.id,
    kind: narrative.kind,
    label: narrative.label,
    priority: narrative.priority,
    startsOn: narrative.startsOn,
    endsOn: narrative.endsOn,
    participantIds: narrative.participantIds,
    target: narrative.target,
  }));
}

function monthReadModel(snapshot: CalendarMonthProjectionBundle, context: AuthorizedRuntimeContext, capabilities: HistoryCalendarMonthReadModel["capabilities"]): HistoryCalendarMonthReadModel {
  const days = listCivilMonthDates(snapshot.month).map((date) => buildDayCell(snapshot, date, context));
  const eligibleMonths = eligibleHistoryMonths(context.periods);
  return {
      month: snapshot.month,
      timezone: context.timezone,
      subject: snapshot.scope.subject,
      navigation: adjacentEligibleHistoryMonths(snapshot.month, eligibleMonths),
      summary: {
        economicAmount: moneyEnvelopeFromScoped(snapshot.monthMetric),
        observableDayCount: countEnvelope(days.filter(({ observability }) => observability !== "unobserved").length),
        daysWithActivity: countEnvelope(days.filter(({ flags }) => flags.includes("has_activity")).length),
        daysWithPlaceVisit: countEnvelope(days.filter(({ flags }) => flags.includes("has_place_visit")).length),
        daysOutsideDailyLife: countEnvelope(days.filter(({ flags }) => flags.includes("has_outside_daily_life")).length),
        periodCompleteness: periodCompleteness(context, snapshot.month),
      },
      highlights: highlights(snapshot),
      spanningEvents: spanningEvents(snapshot),
      days,
      capabilities,
  };
}

function operationAssignments(snapshot: CalendarMonthProjectionBundle, date: LocalDate): ReadonlyMap<string, string> {
  const assignment = new Map<string, string>();
  const narrativeByMoment = new Map(snapshot.narratives.flatMap((narrative) => narrative.target.kind === "moment" ? [[narrative.target.id, narrative] as const] : []));
  const narrativeByLifeEvent = new Map(snapshot.narratives.flatMap((narrative) => narrative.lifeEventIds.map((id) => [id, narrative] as const)));
  for (const fact of snapshot.economicFacts) {
    if (fact.sourceOperation.kind !== "resolved" || fact.moment.kind !== "resolved") continue;
    const narrative = narrativeByMoment.get(fact.moment.id);
    if (narrative === undefined || date < narrative.startsOn || date > narrative.endsOn) continue;
    const exact = fact.economicTiming.kind === "known" || fact.economicTiming.kind === "partial"
      ? fact.economicTiming.segments.some(({ periodStart, periodEnd }) => periodStart === date && periodEnd === date)
      : false;
    if (exact) assignment.set(fact.sourceOperation.id, narrative.id);
  }
  for (const row of snapshot.financialLinks) {
    const operationId = optionalCanonicalString(row, ["operation_id"]);
    const lifeEventId = optionalCanonicalString(row, ["life_event_id"]);
    if (operationId === undefined || lifeEventId === undefined || assignment.has(operationId)) continue;
    const operation = snapshot.operations.find((item) => item.operationId === operationId);
    const transactionDate = optionalCanonicalString(row, ["transaction_date_used"]);
    if (transactionDate !== date && operation?.bankDate !== date) continue;
    const momentContext = optionalCanonicalString(row, ["moment_id_context"]);
    const narrative = (momentContext === undefined ? undefined : narrativeByMoment.get(parseMomentId(momentContext)))
      ?? narrativeByLifeEvent.get(parseLifeEventId(lifeEventId));
    if (narrative !== undefined && narrative.startsOn <= date && date <= narrative.endsOn) assignment.set(operationId, narrative.id);
  }
  return assignment;
}

function dayJournal(
  snapshot: CalendarMonthProjectionBundle,
  date: LocalDate,
  context: AuthorizedRuntimeContext,
): {
  readonly moments: readonly DayJournalMoment[];
  readonly unlinkedOperations: readonly DayOperationPreviewItem[];
} {
  const assignment = operationAssignments(snapshot, date);
  const factByOperation = new Map<string, EconomicComponentFact>();
  for (const fact of snapshot.economicFacts) {
    if (fact.sourceOperation.kind === "resolved" && !factByOperation.has(fact.sourceOperation.id)) factByOperation.set(fact.sourceOperation.id, fact);
  }
  const operationById = new Map<string, DayOperationPreviewItem>();
  for (const operation of snapshot.operations) {
    operationById.set(operation.operationId, operationItem(operation, factByOperation));
  }
  const operationsByNarrative = new Map<string, DayOperationPreviewItem[]>();
  for (const [operationId, narrativeId] of assignment) {
    const operation = operationById.get(parseOperationId(operationId));
    if (operation === undefined) continue;
    const values = operationsByNarrative.get(narrativeId) ?? [];
    values.push(operation);
    operationsByNarrative.set(narrativeId, values);
  }
  const moments = snapshot.narratives.filter(({ startsOn, endsOn }) => startsOn <= date && date <= endsOn).map((narrative): DayJournalMoment => {
    const amount = narrativeAmountForDate(snapshot, narrative, date, context);
    const operations = operationsByNarrative.get(narrative.id) ?? [];
    operations.sort((left, right) => left.bankDate.localeCompare(right.bankDate) || left.operationId.localeCompare(right.operationId));
    return {
      id: narrative.id,
      kind: narrative.kind,
      label: narrative.label,
      startsOn: narrative.startsOn,
      endsOn: narrative.endsOn,
      participantIds: narrative.participantIds,
      ...(narrative.startAt === undefined ? {} : { startAt: narrative.startAt }),
      ...(narrative.endAt === undefined ? {} : { endAt: narrative.endAt }),
      ...(narrative.place === undefined ? {} : { place: narrative.place }),
      ...(amount === undefined ? {} : { economicAmount: moneyEnvelope(amount) }),
      operations,
      target: narrative.target,
    };
  });
  moments.sort((left, right) => (left.startAt ?? "9999").localeCompare(right.startAt ?? "9999") || left.id.localeCompare(right.id));
  const unlinkedOperations = operationsForBankDate(snapshot, date).filter(({ operationId }) => !assignment.has(operationId));
  return { moments, unlinkedOperations };
}

export function createCalendarQuerySources(dependencies: CalendarDependencies): Pick<QueryReadModelSources, "readHistoryCalendarMonth" | "readHistoryCalendarMonthSummary" | "readHistoryDayDetail"> {
  const requestBundles = new Map<string, Promise<CalendarMonthProjectionBundle>>();
  const loadProjectionBundle = (month: YearMonth, scope: AnalysisScope): Promise<CalendarMonthProjectionBundle> => {
    const key = `${month}:${JSON.stringify(scope.subject)}`;
    const existing = requestBundles.get(key);
    if (existing !== undefined) return existing;
    const promise = (async () => {
      const range = monthRange(month);
      const [economicFacts, personDays, activities, places, bankOperationRows, monthMetric, momentRows, placeRows] = await Promise.all([
        dependencies.facts.loadEconomicFacts(scope),
        dependencies.facts.loadPersonDays(scope),
        dependencies.facts.loadActivityOccurrences(scope),
        dependencies.facts.loadPlaceVisits(scope),
        dependencies.repository.loadOperationsByBankRange(range),
        dependencies.metrics.produce("economic_consumption_net_attributable", scope),
        dependencies.repository.loadEntityRows("moments", "moment_id"),
        dependencies.repository.loadEntityRows("places", "place_id"),
      ]);
      const activityIds = uniqueSorted(activities.map(({ activityId }) => activityId));
      const lifeEventIds = uniqueSorted(activities.map(({ lifeEventId }) => lifeEventId));
      const momentIds = uniqueSorted(momentRows.map((row) => canonicalString(row, ["moment_id"], "entities")));
      const economicOperationIds = uniqueSorted(economicFacts.flatMap(({ sourceOperation }) => sourceOperation.kind === "resolved" ? [sourceOperation.id] : []));
      const bankOperationIds = new Set(bankOperationRows.map((row) => canonicalString(row, ["operation_id"], "operations")));
      const missingOperationIds = economicOperationIds.filter((id) => !bankOperationIds.has(id));
      const [typeRows, lifeEventRows, participationRows, momentLinks, financialLinks, missingOperationRows] = await Promise.all([
        dependencies.repository.loadLifeEventTypeRowsByTypeKeys(activityIds),
        dependencies.repository.loadLifeEventRecords(lifeEventIds),
        dependencies.repository.loadLifeEventParticipationRows(lifeEventIds),
        dependencies.repository.loadMomentLifeEventRowsByMomentIds(momentIds),
        dependencies.repository.loadFinancialLinkRowsByOperationIds(uniqueSorted([...bankOperationIds, ...economicOperationIds])),
        dependencies.repository.loadOperationsByIds(missingOperationIds),
      ]);
      const catalog = placeCatalog(placeRows);
      const narratives = buildNarratives({
        activities,
        typeMeta: activityTypeMeta(typeRows),
        lifeEventRows,
        momentRows,
        momentLinks,
        participationRows,
        placeById: catalog.placeById,
      });
      const operationRows = [...bankOperationRows, ...missingOperationRows];
      const operationById = new Map<string, ReturnType<typeof operationFromCanonicalRow>>();
      for (const row of operationRows) {
        const operation = operationFromCanonicalRow(row);
        operationById.set(operation.operationId, operation);
      }
      return {
        month,
        scope,
        economicFacts,
        personDays,
        activities,
        places,
        operations: [...operationById.values()].sort((left, right) => left.bankDate.localeCompare(right.bankDate) || left.operationId.localeCompare(right.operationId)),
        monthMetric,
        narratives,
        placeById: catalog.placeById,
        privatePlaceIds: catalog.privatePlaceIds,
        financialLinks,
      };
    })();
    requestBundles.set(key, promise);
    return promise;
  };

  return {
    async readHistoryCalendarMonth({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Calendar Month exige un scope month.");
      const snapshot = await loadProjectionBundle(request.scope.time.month, request.scope);
      return monthReadModel(snapshot, dependencies.context, context.capabilities);
    },
    async readHistoryCalendarMonthSummary({ request, context }) {
      if (request.scope.time.kind !== "month") throw new TypeError("Calendar Summary exige un scope month.");
      const model = monthReadModel(await loadProjectionBundle(request.scope.time.month, request.scope), dependencies.context, context.capabilities);
      return { month: model.month, timezone: model.timezone, subject: model.subject, summary: model.summary, capabilities: context.capabilities };
    },
    async readHistoryDayDetail({ request, context }): Promise<HistoryDayDetailReadModel> {
      if (request.scope.time.kind !== "month") throw new TypeError("Day Detail exige un scope month.");
      const snapshot = await loadProjectionBundle(request.scope.time.month, request.scope);
      const date = request.params.date;
        const cell = buildDayCell(snapshot, date, dependencies.context);
        const completeness = periodCompleteness(dependencies.context, request.scope.time.month);
        const economic = request.scope.subject.kind === "household"
          ? exactEconomicAmountForDate(snapshot.economicFacts, date, completeness)
          : { envelope: unavailableMoneyEnvelope("unknown"), contributions: [] };
        const lifeScope = lifeScopeSummary(economic.contributions, economic.envelope.availability === "not_applicable" ? "unknown" : economic.envelope.availability);
        const journal = dayJournal(snapshot, date, dependencies.context);
        return {
          date,
          timezone: dependencies.context.timezone,
          subject: request.scope.subject,
          header: { date, observability: cell.observability, dayContext: cell.dayContext, periodCompleteness: completeness },
          finance: { economicAmount: economic.envelope, lifeScopeBreakdown: lifeScope },
          contexts: {
            dayContext: cell.dayContext,
            lifeScopeSummary: lifeScope,
            activitiesPresent: cell.flags.includes("has_activity"),
            placesPresent: cell.flags.includes("has_place_visit"),
          },
          markers: cell.markers,
          moments: journal.moments,
          unlinkedOperations: journal.unlinkedOperations,
          capabilities: context.capabilities,
        };
    },
  };
}
