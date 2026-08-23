import "server-only";

import { randomUUID } from "node:crypto";
import { parseInstant } from "@/core/time";
import {
  getQueryCapabilityMaximum,
  type QueryRequest,
  type QueryResourceName,
} from "@/query-api";
import {
  executeQuery,
  metricRegistryQuerySources,
  QueryTemporaryUnavailableError,
  type QueryExecutionResult,
  type QueryReadModelSources,
  type QueryServerServices,
  type QueryTrace,
} from "@/query-api/server";
import { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import { MetricQueryService } from "@/server/analytics/metric-query-service";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import {
  createAuthorizedRuntimeContext,
  type AuthorizedRuntimeContext,
} from "@/server/canonical/context";
import { CanonicalReadError } from "@/server/canonical/errors";
import { CanonicalRepository } from "@/server/canonical/repository";
import {
  type CanonicalSourceHealth,
  unavailableCanonicalSourceHealth,
} from "@/server/canonical/source-health";
import { createRealQuerySources } from "./sources";

function unavailable(): never {
  throw new QueryTemporaryUnavailableError(
    "Le client de lecture canonique server-only n'est pas configuré.",
  );
}

function unavailableCanonicalSources(): QueryReadModelSources {
  return {
    ...metricRegistryQuerySources,
    readHistoryCalendarMonth: unavailable,
    readHistoryCalendarMonthSummary: unavailable,
    readHistoryDayDetail: unavailable,
    readAnalysisMonthInitial: unavailable,
    readAnalysisMonthBreakdown: unavailable,
    readAnalysisMonthEvolution: unavailable,
    readAnalysisMonthStructure: unavailable,
    readAnalysisMonthLived: unavailable,
    readAnalysisMonthMoments: unavailable,
    readAnalysisTarget: unavailable,
    readAnalysisMonthContexts: unavailable,
    readAnalysisGlobalInitial: unavailable,
    readAnalysisGlobalBaseline: unavailable,
    readAnalysisGlobalTypical: unavailable,
    readAnalysisGlobalBreakdown: unavailable,
    readAnalysisGlobalEvolution: unavailable,
    readAnalysisGlobalContexts: unavailable,
    readAnalysisGlobalHabits: unavailable,
    readAnalysisGlobalProfiles: unavailable,
    readAnalysisGlobalUniverse: unavailable,
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

function traceQuery(trace: QueryTrace): void {
  console.info("query_trace", {
    requestId: trace.requestId,
    resource: trace.resource,
    scopeHash: trace.scopeHash,
    normalizedParamSignature: trace.normalizedParamSignature,
    dataRevision: trace.dataRevision,
    analyticsRevision: trace.analyticsRevision,
    durationMs: trace.durationMs,
    outcome: trace.outcome,
  });
}

function baseServices(
  context: AuthorizedRuntimeContext,
  sources: QueryReadModelSources,
  repository?: CanonicalRepository,
): QueryServerServices {
  return {
    resolveContext: () => ({
      actor: { actorId: context.userId },
      household: { householdId: context.householdId },
      revisions: {
        dataRevision: context.dataRevision,
        analyticsRevision: context.analyticsRevision,
        dependencies: [],
      },
      contractVersion: context.contractVersion,
      now: context.asOf,
    }),
    authorize: ({ request }) => {
      const subject = request.scope.subject;
      if (subject.kind === "household") return { granted: true };
      return context.personIds.includes(subject.personId)
        ? { granted: true }
        : { granted: false, errorCode: "PERMISSION_DENIED" };
    },
    ...(repository === undefined
      ? {}
      : {
          resolveApplicability: async ({ request }) => {
            const purchaseEventHealth = await repository.purchaseEventSourceHealth();
            if (purchaseEventHealth === "AVAILABLE") return {};
            const maximum = getQueryCapabilityMaximum(request.resource);
            return {
              measures: maximum.measures.filter(
                (metricId) => metricId !== "purchase_count",
              ),
            };
          },
        }),
    sources,
    onTrace: traceQuery,
  };
}

async function createQueryServices(): Promise<QueryServerServices> {
  const bootstrap = await getBootstrapContext();
  const context = createAuthorizedRuntimeContext(
    bootstrap,
    parseInstant(new Date().toISOString()),
  );
  try {
    const repository = new CanonicalRepository(
      createCanonicalReadClient(),
      context,
    );
    const facts = new FactSourceResolver(repository);
    const metrics = new MetricQueryService(facts);
    return baseServices(
      context,
      createRealQuerySources({ context, repository, facts, metrics }),
      repository,
    );
  } catch (error) {
    if (error instanceof CanonicalReadError) {
      return baseServices(context, unavailableCanonicalSources());
    }
    throw error;
  }
}

export async function executeAuthenticatedQuery<Name extends QueryResourceName>(
  request: QueryRequest<Name> | unknown,
  requestId = randomUUID(),
): Promise<QueryExecutionResult<Name>> {
  const services = await createQueryServices();
  return executeQuery(
    { requestId, request },
    services,
  ) as Promise<QueryExecutionResult<Name>>;
}

export async function executeAuthenticatedQueries(
  requests: readonly unknown[],
): Promise<readonly QueryExecutionResult<QueryResourceName>[]> {
  const services = await createQueryServices();
  return Promise.all(
    requests.map((request) =>
      executeQuery({ requestId: randomUUID(), request }, services),
    ),
  );
}

export async function resolveLatestBankOperationMonth() {
  const bootstrap = await getBootstrapContext();
  const context = createAuthorizedRuntimeContext(
    bootstrap,
    parseInstant(new Date().toISOString()),
  );
  const repository = new CanonicalRepository(createCanonicalReadClient(), context);
  return repository.loadLatestBankOperationMonth();
}

export async function readAuthenticatedCanonicalSourceHealth(): Promise<CanonicalSourceHealth> {
  const bootstrap = await getBootstrapContext();
  const context = createAuthorizedRuntimeContext(
    bootstrap,
    parseInstant(new Date().toISOString()),
  );
  try {
    return await new CanonicalRepository(
      createCanonicalReadClient(),
      context,
    ).sourceHealth();
  } catch (error) {
    if (!(error instanceof CanonicalReadError)) throw error;
    return unavailableCanonicalSourceHealth();
  }
}
