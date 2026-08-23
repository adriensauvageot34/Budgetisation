import "server-only";

import { randomUUID } from "node:crypto";
import {
  getMetricRegistryEntry,
  type ActiveMetricId,
} from "@/analytics/production";
import { CURRENT_CONTRACT_VERSION } from "@/core/api";
import type { ScopeHash } from "@/core/scope";
import {
  parseInstant,
  parseYearMonth,
  resolveGlobalWindowMonths,
  yearMonthOf,
  type YearMonth,
} from "@/core/time";
import type { QueryExecutionResult } from "@/query-api/server";
import {
  executeQuery,
  metricRegistryQuerySources,
  QueryTemporaryUnavailableError,
} from "@/query-api/server";
import type {
  QueryReadModelSources,
  QueryServerServices,
} from "@/query-api/server";
import type {
  QueryRequest,
  QueryResourceName,
  ScopedMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "@/query-api";
import { listCivilMonthDates } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import type {
  BootstrapAnalysisPeriod,
  BootstrapAnalysisStatus,
} from "@/server/bootstrap/types";

type BootstrapContext = Awaited<ReturnType<typeof getBootstrapContext>>;

function unavailable(): never {
  throw new QueryTemporaryUnavailableError(
    "La couche de lecture canonique requise n’est pas encore exposée à la session applicative.",
  );
}

function periodFor(
  context: BootstrapContext,
  month: string,
): BootstrapAnalysisPeriod | undefined {
  return context.periods.find((period) => yearMonthOf(period.month) === month);
}

function financeCompleteness(
  context: BootstrapContext,
  month: string,
): BootstrapAnalysisStatus {
  return periodFor(context, month)?.financeStatus ?? "unknown";
}

const unknownEconomicAmount = Object.freeze({
  availability: "unknown" as const,
  value: null,
  unit: "EUR" as const,
  provenance: "observed" as const,
});

function unknownScopedMetric(
  metricId: ActiveMetricId,
  scopeHash: ScopeHash,
  asOf: YearMonth = parseYearMonth("2000-01"),
): ScopedMetricReadModel {
  const metric = getMetricRegistryEntry(metricId);
  return {
    metricId: metric.metricId,
    scopeHash,
    envelope: {
      availability: "unknown" as const,
      value: null,
      unit: metric.unit,
      provenance: metric.provenanceRule,
      methodVersion: metric.methodVersion,
      ...(metric.referenceMethod === undefined
        ? {}
        : {
            reference: {
              family: "current" as const,
              asOf,
            },
          }),
    },
  } as ScopedMetricReadModel;
}

function periodFlags(status: BootstrapAnalysisStatus) {
  return status === "complete"
    ? []
    : status === "partial"
      ? (["partial_data", "incomplete_period"] as const)
      : (["incomplete_period"] as const);
}

function calendarSummary(context: BootstrapContext, month: string) {
  return {
    economicAmount: unknownEconomicAmount,
    periodCompleteness: financeCompleteness(context, month),
  };
}

function createBootstrapSources(context: BootstrapContext): QueryReadModelSources {
  if (context.household === null) unavailable();

  return {
    ...metricRegistryQuerySources,

    readHistoryCalendarMonth({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      const month = request.scope.time.month;
      const status = financeCompleteness(context, month);
      return {
        month,
        timezone: context.household.timezone,
        subject: request.scope.subject,
        summary: calendarSummary(context, month),
        days: listCivilMonthDates(month).map((date) => ({
          date,
          observability: "unobserved" as const,
          dayContext: { kind: "unknown" as const },
          lifeScopeSummary: { availability: "unknown" as const, entries: [] },
          economicAmount: unknownEconomicAmount,
          hasDetail: false,
          flags: periodFlags(status),
        })),
        capabilities: execution.capabilities,
      };
    },

    readHistoryCalendarMonthSummary({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      return {
        month: request.scope.time.month,
        timezone: context.household.timezone,
        subject: request.scope.subject,
        summary: calendarSummary(context, request.scope.time.month),
        capabilities: execution.capabilities,
      };
    },

    readHistoryDayDetail({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      const status = financeCompleteness(context, request.scope.time.month);
      const dayContext = { kind: "unknown" as const };
      const lifeScope = {
        availability: "unknown" as const,
        entries: [] as const,
      };
      const emptyPreview = { items: [], maxItems: 6, truncated: false };
      return {
        date: request.params.date,
        timezone: context.household.timezone,
        subject: request.scope.subject,
        header: {
          date: request.params.date,
          observability: "unobserved" as const,
          dayContext,
          periodCompleteness: status,
        },
        finance: {
          economicAmount: unknownEconomicAmount,
          lifeScopeBreakdown: lifeScope,
        },
        contexts: {
          dayContext,
          lifeScopeSummary: lifeScope,
          activitiesPresent: false,
          placesPresent: false,
        },
        activities: emptyPreview,
        places: emptyPreview,
        operations: emptyPreview,
        capabilities: execution.capabilities,
      };
    },

    readAnalysisMonthInitial({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      const targetMonth = request.scope.time.month;
      return {
        month: targetMonth,
        subject: request.scope.subject,
        periodCompleteness: financeCompleteness(context, request.scope.time.month),
        actual: unknownScopedMetric(
          "economic_consumption_net_attributable",
          request.scopeHash,
        ) as ScopedMoneyMetricReadModel,
        structure: { axes: [] },
        capabilities: execution.capabilities,
      };
    },

    readAnalysisMonthBreakdown({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        breakdown: {
          dimension: request.params.dimension,
          measure: request.params.measure,
          rows: [],
          reconciliation: "not_applicable" as const,
          capabilities: execution.capabilities,
        },
      };
    },

    readAnalysisMonthEvolution({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      const targetMonth = request.scope.time.month;
      return {
        month: targetMonth,
        subject: request.scope.subject,
        metricId: request.params.metricId,
        points: context.periods
          .filter((period) => yearMonthOf(period.month) <= targetMonth)
          .slice(-12)
          .map((period) => ({
            period: yearMonthOf(period.month),
            metric: unknownScopedMetric(
              request.params.metricId,
              request.scopeHash,
              yearMonthOf(period.month),
            ),
            periodCompleteness: period.financeStatus,
          })),
        capabilities: execution.capabilities,
      };
    },

    readAnalysisMonthContexts({ request, context: execution }) {
      if (request.scope.time.kind !== "month") unavailable();
      return {
        month: request.scope.time.month,
        subject: request.scope.subject,
        contexts: { sections: [], capabilities: execution.capabilities },
      };
    },

    readAnalysisGlobalInitial({ request, context: execution }) {
      if (request.scope.time.kind !== "global") unavailable();
      const months = new Set(
        resolveGlobalWindowMonths(
          request.scope.time.observationWindow,
          request.scope.time.asOf,
        ),
      );
      const count = context.periods.filter(
        (period) =>
          months.has(yearMonthOf(period.month)) &&
          period.financeStatus !== "unknown" &&
          period.financeStatus !== "not_applicable",
      ).length;
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        observedPeriodCount: {
          availability: "known" as const,
          value: count,
          unit: "count" as const,
          provenance: "observed" as const,
        },
        structure: { axes: [] },
        capabilities: execution.capabilities,
      };
    },

    readAnalysisGlobalBreakdown({ request, context: execution }) {
      if (request.scope.time.kind !== "global") unavailable();
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        breakdown: {
          dimension: request.params.dimension,
          measure: request.params.measure,
          rows: [],
          reconciliation: "not_applicable" as const,
          capabilities: execution.capabilities,
        },
      };
    },

    readAnalysisGlobalEvolution({ request, context: execution }) {
      if (request.scope.time.kind !== "global") unavailable();
      const months = new Set(
        resolveGlobalWindowMonths(
          request.scope.time.observationWindow,
          request.scope.time.asOf,
        ),
      );
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        metricId: request.params.metricId,
        points: context.periods
          .filter((period) => months.has(yearMonthOf(period.month)))
          .map((period) => ({
            period: yearMonthOf(period.month),
            metric: unknownScopedMetric(
              request.params.metricId,
              request.scopeHash,
              yearMonthOf(period.month),
            ),
            periodCompleteness: period.financeStatus,
          })),
        capabilities: execution.capabilities,
      };
    },

    readAnalysisGlobalContexts({ request, context: execution }) {
      if (request.scope.time.kind !== "global") unavailable();
      return {
        observationWindow: request.scope.time.observationWindow,
        asOf: request.scope.time.asOf,
        subject: request.scope.subject,
        contexts: { sections: [], capabilities: execution.capabilities },
      };
    },

    readEntityPlace: unavailable,
    readEntityMerchant: unavailable,
    readEntityMoment: unavailable,
    readEntityPersona: unavailable,
    readEntityLifeEvent: unavailable,
    readEntityOperation: unavailable,
    readGalleryMoments: unavailable,
    readGalleryPlaces: unavailable,
    readGalleryMerchants: unavailable,
    readOperationsBrowse: unavailable,
  };
}

function createQueryServices(context: BootstrapContext): QueryServerServices {
  if (context.household === null || context.revision === null) unavailable();
  const household = context.household;
  const revision = context.revision;
  return {
    resolveContext: () => ({
      actor: { actorId: context.user.id },
      household: { householdId: household.householdId },
      revisions: {
        dataRevision: revision.dataRevision,
        analyticsRevision: revision.analyticsRevision,
        dependencies: [],
      },
      contractVersion: CURRENT_CONTRACT_VERSION,
      now: parseInstant(new Date().toISOString()),
    }),
    authorize: ({ request }) => {
      const subject = request.scope.subject;
      if (subject.kind === "household") return { granted: true };
      return context.persons.some(
        (person) => person.personId === subject.personId,
      )
        ? { granted: true }
        : { granted: false, errorCode: "PERMISSION_DENIED" };
    },
    sources: createBootstrapSources(context),
  };
}

export async function executeAuthenticatedQuery<Name extends QueryResourceName>(
  request: QueryRequest<Name> | unknown,
  requestId = randomUUID(),
): Promise<QueryExecutionResult<Name>> {
  const context = await getBootstrapContext();
  return executeQuery(
    { requestId, request },
    createQueryServices(context),
  ) as Promise<QueryExecutionResult<Name>>;
}

export async function executeAuthenticatedQueries(
  requests: readonly unknown[],
): Promise<readonly QueryExecutionResult<QueryResourceName>[]> {
  const context = await getBootstrapContext();
  const services = createQueryServices(context);
  return Promise.all(
    requests.map((request) =>
      executeQuery({ requestId: randomUUID(), request }, services),
    ),
  );
}
