import "server-only";

import {
  addMoney,
  isZeroMoney,
  parseMoney,
  type Money,
} from "@/core/money";
import { parseLifeScopeContext, type AnalysisScope } from "@/core/scope";
import type { LocalDate, YearMonth } from "@/core/time";
import {
  listCivilMonthDates,
  type CalendarDayCell,
  type CalendarFlag,
  type DayActivityPreviewItem,
  type DayOperationPreviewItem,
  type DayPlaceVisitPreviewItem,
  type HistoryCalendarMonthReadModel,
  type HistoryDayDetailReadModel,
  type LifeScopeSummary,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import type { CanonicalRepository } from "@/server/canonical/repository";
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
import { canonicalLabelMap } from "./canonical-relations";

type CalendarMonthDataSnapshot = {
  readonly month: YearMonth;
  readonly scope: AnalysisScope;
  readonly economicFacts: Awaited<ReturnType<FactSourceResolver["loadEconomicFacts"]>>;
  readonly personDays: Awaited<ReturnType<FactSourceResolver["loadPersonDays"]>>;
  readonly activities: Awaited<ReturnType<FactSourceResolver["loadActivityOccurrences"]>>;
  readonly activityLabels: ReadonlyMap<string, string>;
  readonly places: Awaited<ReturnType<FactSourceResolver["loadPlaceVisits"]>>;
  readonly operations: readonly ReturnType<typeof operationFromCanonicalRow>[];
  readonly monthMetric: Awaited<ReturnType<MetricQueryService["produce"]>>;
};

type CalendarDependencies = {
  readonly context: AuthorizedRuntimeContext;
  readonly repository: CanonicalRepository;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
};

function bounded<T>(items: readonly T[], maxItems = 6) {
  return {
    items: items.slice(0, maxItems),
    maxItems,
    truncated: items.length > maxItems,
  };
}

function observabilityForDate(
  snapshot: CalendarMonthDataSnapshot,
  date: LocalDate,
  context: AuthorizedRuntimeContext,
): CalendarDayCell["observability"] {
  const days = snapshot.personDays.filter(({ localDate }) => localDate === date);
  if (snapshot.scope.subject.kind === "person") {
    const subjectPersonId = snapshot.scope.subject.personId;
    const selected = days.find(
      ({ personId }) => personId === subjectPersonId,
    );
    if (selected === undefined) return "unobserved";
    return selected.locationObservability === "observable"
      ? "observable"
      : "partial";
  }
  if (days.length === 0) return "unobserved";
  return days.length === context.personIds.length &&
    days.every(({ locationObservability }) => locationObservability === "observable")
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
      return amount === undefined
        ? []
        : [{ context, economicAmount: moneyEnvelope(amount) }];
    }),
  };
}

function activityItems(
  snapshot: CalendarMonthDataSnapshot,
  date: LocalDate,
): readonly DayActivityPreviewItem[] {
  return selectFactsForSubject(snapshot.activities, snapshot.scope)
    .filter(({ startDate, endDate }) => startDate <= date && date <= endDate)
    .map((fact) => ({
      lifeEventId: fact.lifeEventId,
      activityId: fact.activityId,
      label: snapshot.activityLabels.get(fact.activityId) ?? fact.activityId,
      startsOn: fact.startDate,
      endsOn: fact.endDate,
      validationStatus: fact.validationStatus,
    }));
}

function placeItems(
  snapshot: CalendarMonthDataSnapshot,
  date: LocalDate,
): readonly DayPlaceVisitPreviewItem[] {
  return selectFactsForSubject(snapshot.places, snapshot.scope)
    .filter(({ localDate }) => localDate === date)
    .map((fact) => ({
      placeId: fact.placeId,
      ...(fact.interval.kind === "known"
        ? { visitStart: fact.interval.startedAt, visitEnd: fact.interval.endedAt }
        : fact.interval.kind === "partial"
          ? {
              ...(fact.interval.startedAt === null
                ? {}
                : { visitStart: fact.interval.startedAt }),
              ...(fact.interval.endedAt === null
                ? {}
                : { visitEnd: fact.interval.endedAt }),
            }
          : {}),
      visitState: fact.interval.kind,
      timePrecision: fact.timePrecision,
    }));
}

function operationItems(
  snapshot: CalendarMonthDataSnapshot,
  date: LocalDate,
): readonly DayOperationPreviewItem[] {
  if (snapshot.scope.subject.kind === "person") return [];
  const factByOperation = new Map(
    snapshot.economicFacts.flatMap((fact) =>
      fact.sourceOperation.kind === "resolved"
        ? [[fact.sourceOperation.id, fact] as const]
        : [],
    ),
  );
  return snapshot.operations
    .filter(({ bankDate }) => bankDate === date)
    .map((operation) => {
      const fact = factByOperation.get(operation.operationId);
      return {
        operationId: operation.operationId,
        bankDate: operation.bankDate,
        label: operation.label,
        amount: operation.bankAmount,
        ...(fact?.category.kind === "resolved"
          ? { categoryId: fact.category.id }
          : operation.categoryId === undefined
            ? {}
            : { categoryId: operation.categoryId }),
        ...(fact?.merchant.kind === "resolved"
          ? { merchantId: fact.merchant.id }
          : operation.merchantId === undefined
            ? {}
            : { merchantId: operation.merchantId }),
        ...(fact?.canonicalPlace.kind === "resolved"
          ? { placeId: fact.canonicalPlace.placeId }
          : {}),
      };
    });
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
  if (
    input.lifeScope.availability === "known" &&
    input.lifeScope.entries.some(({ context }) => context === "Hors quotidien")
  ) flags.push("has_outside_daily_life");
  if (
    input.observability === "partial" ||
    input.economic.coverage?.level === "partial"
  ) flags.push("partial_data");
  if (input.economic.availability === "conflict") flags.push("conflict");
  if (input.completeness !== "complete") flags.push("incomplete_period");
  return flags;
}

function buildDayCell(
  snapshot: CalendarMonthDataSnapshot,
  date: LocalDate,
  context: AuthorizedRuntimeContext,
): CalendarDayCell {
  const scopedEconomicFacts =
    snapshot.scope.subject.kind === "household" ? snapshot.economicFacts : [];
  const completeness = periodCompleteness(context, snapshot.month);
  const economic =
    snapshot.scope.subject.kind === "household"
      ? exactEconomicAmountForDate(scopedEconomicFacts, date, completeness)
      : { envelope: unavailableMoneyEnvelope("unknown"), contributions: [] };
  const activities = activityItems(snapshot, date);
  const places = placeItems(snapshot, date);
  const operations = operationItems(snapshot, date);
  const lifeScope = lifeScopeSummary(
    economic.contributions,
    economic.envelope.availability === "not_applicable"
      ? "unknown"
      : economic.envelope.availability,
  );
  const observability = observabilityForDate(snapshot, date, context);
  return {
    date,
    observability,
    dayContext: { kind: "unknown" },
    lifeScopeSummary: lifeScope,
    economicAmount: economic.envelope,
    operationCount: countEnvelope(operations.length),
    activityOccurrenceCount: countEnvelope(activities.length),
    placeVisitCount: countEnvelope(places.length),
    hasDetail:
      operations.length > 0 ||
      activities.length > 0 ||
      places.length > 0 ||
      (economic.envelope.availability === "known" &&
        !isZeroMoney(economic.envelope.value)),
    flags: flagsForDay({
      operations,
      activities,
      places,
      lifeScope,
      economic: economic.envelope,
      completeness,
      observability,
    }),
  };
}

function monthReadModel(
  snapshot: CalendarMonthDataSnapshot,
  context: AuthorizedRuntimeContext,
  capabilities: HistoryCalendarMonthReadModel["capabilities"],
): HistoryCalendarMonthReadModel {
  const days = listCivilMonthDates(snapshot.month).map((date) =>
    buildDayCell(snapshot, date, context),
  );
  return {
    month: snapshot.month,
    timezone: context.timezone,
    subject: snapshot.scope.subject,
    summary: {
      economicAmount: moneyEnvelopeFromScoped(snapshot.monthMetric),
      observableDayCount: countEnvelope(
        days.filter(({ observability }) => observability !== "unobserved").length,
      ),
      daysWithActivity: countEnvelope(
        days.filter(({ flags }) => flags.includes("has_activity")).length,
      ),
      daysWithPlaceVisit: countEnvelope(
        days.filter(({ flags }) => flags.includes("has_place_visit")).length,
      ),
      daysOutsideDailyLife: countEnvelope(
        days.filter(({ flags }) => flags.includes("has_outside_daily_life")).length,
      ),
      periodCompleteness: periodCompleteness(context, snapshot.month),
    },
    days,
    capabilities,
  };
}

export function createCalendarQuerySources(
  dependencies: CalendarDependencies,
): Pick<
  QueryReadModelSources,
  | "readHistoryCalendarMonth"
  | "readHistoryCalendarMonthSummary"
  | "readHistoryDayDetail"
> {
  const snapshots = new Map<string, Promise<CalendarMonthDataSnapshot>>();
  const loadSnapshot = (
    month: YearMonth,
    scope: AnalysisScope,
  ): Promise<CalendarMonthDataSnapshot> => {
    const key = `${month}:${JSON.stringify(scope.subject)}`;
    const existing = snapshots.get(key);
    if (existing !== undefined) return existing;
    const promise = (async () => {
      const range = monthRange(month);
      const [economicFacts, personDays, activities, places, operationRows, monthMetric] =
        await Promise.all([
          dependencies.facts.loadEconomicFacts(scope),
          dependencies.facts.loadPersonDays(scope),
          dependencies.facts.loadActivityOccurrences(scope),
          dependencies.facts.loadPlaceVisits(scope),
          dependencies.repository.loadOperationsByBankRange(range),
          dependencies.metrics.produce(
            "economic_consumption_net_attributable",
            scope,
          ),
        ]);
      const activityLabels = canonicalLabelMap(
        await dependencies.repository.loadLifeEventTypeRowsByTypeKeys(
          activities.map(({ activityId }) => activityId),
        ),
        ["type_key"],
      );
      return {
        month,
        scope,
        economicFacts,
        personDays,
        activities,
        activityLabels,
        places,
        operations: operationRows.map(operationFromCanonicalRow),
        monthMetric,
      };
    })();
    snapshots.set(key, promise);
    return promise;
  };

  return {
    async readHistoryCalendarMonth({ request, context }) {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Calendar Month exige un scope month.");
      }
      const snapshot = await loadSnapshot(request.scope.time.month, request.scope);
      return monthReadModel(snapshot, dependencies.context, context.capabilities);
    },

    async readHistoryCalendarMonthSummary({ request, context }) {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Calendar Summary exige un scope month.");
      }
      const snapshot = await loadSnapshot(request.scope.time.month, request.scope);
      const model = monthReadModel(snapshot, dependencies.context, context.capabilities);
      return {
        month: model.month,
        timezone: model.timezone,
        subject: model.subject,
        summary: model.summary,
        capabilities: context.capabilities,
      };
    },

    async readHistoryDayDetail({ request, context }): Promise<HistoryDayDetailReadModel> {
      if (request.scope.time.kind !== "month") {
        throw new TypeError("Day Detail exige un scope month.");
      }
      const snapshot = await loadSnapshot(request.scope.time.month, request.scope);
      const date = request.params.date;
      const cell = buildDayCell(snapshot, date, dependencies.context);
      const completeness = periodCompleteness(
        dependencies.context,
        request.scope.time.month,
      );
      const economic =
        request.scope.subject.kind === "household"
          ? exactEconomicAmountForDate(snapshot.economicFacts, date, completeness)
          : { envelope: unavailableMoneyEnvelope("unknown"), contributions: [] };
      const activities = activityItems(snapshot, date);
      const places = placeItems(snapshot, date);
      const operations = operationItems(snapshot, date);
      const lifeScope = lifeScopeSummary(
        economic.contributions,
        economic.envelope.availability === "not_applicable"
          ? "unknown"
          : economic.envelope.availability,
      );
      return {
        date,
        timezone: dependencies.context.timezone,
        subject: request.scope.subject,
        header: {
          date,
          observability: cell.observability,
          dayContext: cell.dayContext,
          periodCompleteness: completeness,
        },
        finance: {
          economicAmount: economic.envelope,
          lifeScopeBreakdown: lifeScope,
        },
        contexts: {
          dayContext: cell.dayContext,
          lifeScopeSummary: lifeScope,
          activitiesPresent: activities.length > 0,
          placesPresent: places.length > 0,
        },
        activities: bounded(activities),
        places: bounded(places),
        operations: bounded(operations),
        capabilities: context.capabilities,
      };
    },
  };
}
