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
import type { MinimalSourceHealth } from "@/server/analytics/minimal-source-resolver";
import type { CertifiedHistoricalMinimalSource } from "@/server/analytics/materialization/certified-historical-minimal";
import type { AnalysisScope } from "@/core/scope";
import { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { ActiveMetricId } from "@/analytics/production";
import { SupabaseAnalyticsMaterializationStore } from "@/server/analytics/materialization";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { safeRuntimeEnvironment } from "@/server/runtime-environment";
import { recoverQueryRuntimeError } from "./recoverable-error";

const personFinancialMetrics = new Set<ActiveMetricId>([
  "economic_consumption_net_attributable",
  "typical_month_cost",
  "minimal_month_cost",
  "localized_spend",
  "category_amount",
  "merchant_net_amount",
  "life_scope_amount",
  "fixed_variable_amount",
  "purchase_count",
  "activity_causal_cost",
  "activity_causal_median_cost_per_occurrence",
  "fuel_trip_estimate",
]);

function unavailable(): never {
  throw new QueryTemporaryUnavailableError(
    "Le client de lecture canonique server-only n'est pas configuré.",
  );
}

function unavailableCanonicalSources(): QueryReadModelSources {
  return {
    ...metricRegistryQuerySources,
    readHistoryMonthCalendar: unavailable,
    readHistoryWeek: unavailable,
    readHistoryDayJournal: unavailable,
    readHistoryMonthOverview: unavailable,
    readHistoryMonthBalanceSummary: unavailable,
    readHistoryBankEconomyBridge: unavailable,
    readHistoryMonthCategories: unavailable,
    readHistoryCategoryDetail: unavailable,
    readHistoryMonthSpendingNature: unavailable,
    readHistorySpendingSegmentDetail: unavailable,
    readHistoryMinimalPreview: unavailable,
    readHistoryMonthLifeMoney: unavailable,
    readHistoryActivityDetail: unavailable,
    readHistoryMomentDetail: unavailable,
    readHistoryPlaceDetail: unavailable,
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
  const build = safeRuntimeEnvironment();
  console.info("query_trace", {
    requestId: trace.requestId,
    resource: trace.resource,
    scopeHash: trace.scopeHash,
    normalizedParamSignature: trace.normalizedParamSignature,
    dataRevision: trace.dataRevision,
    analyticsRevision: trace.analyticsRevision,
    durationMs: trace.durationMs,
    outcome: trace.outcome,
    materialization: trace.materialization,
    environment: build.environment,
    commitSha: build.commitSha,
  });
}

function baseServices(
  context: AuthorizedRuntimeContext,
  sources: QueryReadModelSources,
  repository?: CanonicalRepository,
  materialization?: SupabaseAnalyticsMaterializationStore,
  onTrace: QueryServerServices["onTrace"] = traceQuery,
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
            const maximum = getQueryCapabilityMaximum(request.resource);
            const personScope = request.scope.subject.kind === "person";
            const measures = maximum.measures.filter(
              (metricId) =>
                (!personScope || !personFinancialMetrics.has(metricId))
                && (purchaseEventHealth === "AVAILABLE" || metricId !== "purchase_count"),
            );
            if (measures.length === maximum.measures.length) return {};
            return {
              measures,
            };
          },
        }),
    sources,
    ...(materialization === undefined ? {} : { materialization }),
    onTrace,
  };
}

export function createQueryServicesForContext(input: {
  readonly context: AuthorizedRuntimeContext;
  readonly client: SupabaseClient;
  readonly materialization?: SupabaseAnalyticsMaterializationStore;
  readonly certifiedHistoricalMinimal?: CertifiedHistoricalMinimalSource;
}): QueryServerServices {
  const repository = new CanonicalRepository(input.client, input.context);
  const materialization = input.materialization
    ?? new SupabaseAnalyticsMaterializationStore(input.client, input.context);
  const facts = new FactSourceResolver(
    repository,
    materialization,
    input.certifiedHistoricalMinimal,
  );
  const metrics = new MetricQueryService(facts, materialization);
  return baseServices(
    input.context,
    createRealQuerySources({
      context: input.context,
      repository,
      facts,
      metrics,
    }),
    repository,
    materialization,
  );
}

/**
 * Builds the official Canonical → Facts → Analytics → Query chain without any
 * materialization store. Historical validation uses this boundary so a
 * read-only regeneration cannot write artifacts or query snapshots.
 */
export function createReadOnlyQueryServicesForContext(input: {
  readonly context: AuthorizedRuntimeContext;
  readonly client: SupabaseClient;
  readonly onTrace?: QueryServerServices["onTrace"];
  readonly certifiedHistoricalMinimal?: CertifiedHistoricalMinimalSource;
}): QueryServerServices {
  const repository = new CanonicalRepository(input.client, input.context);
  const facts = new FactSourceResolver(
    repository,
    undefined,
    input.certifiedHistoricalMinimal,
  );
  const metrics = new MetricQueryService(facts);
  return baseServices(
    input.context,
    createRealQuerySources({
      context: input.context,
      repository,
      facts,
      metrics,
    }),
    repository,
    undefined,
    input.onTrace,
  );
}

async function createQueryServices(): Promise<QueryServerServices> {
  const bootstrap = await getBootstrapContext();
  const context = createAuthorizedRuntimeContext(
    bootstrap,
    parseInstant(new Date().toISOString()),
  );
  try {
    const client = createCanonicalReadClient();
    return createQueryServicesForContext({ context, client });
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
  try {
    const services = await createQueryServices();
    return executeQuery(
      { requestId, request },
      services,
    ) as Promise<QueryExecutionResult<Name>>;
  } catch (error) {
    const recovered = recoverQueryRuntimeError(error, requestId);
    if (recovered === null) throw error;
    return recovered as QueryExecutionResult<Name>;
  }
}

export async function executeAuthenticatedQueries(
  requests: readonly unknown[],
): Promise<readonly QueryExecutionResult<QueryResourceName>[]> {
  const requestIds = requests.map(() => randomUUID());
  let services: QueryServerServices;
  try {
    services = await createQueryServices();
  } catch (error) {
    const recovered = requestIds.map((requestId) =>
      recoverQueryRuntimeError(error, requestId));
    if (recovered.some((result) => result === null)) throw error;
    return recovered as readonly QueryExecutionResult<QueryResourceName>[];
  }
  return Promise.all(
    requests.map((request, index) =>
      executeQuery({ requestId: requestIds[index]!, request }, services),
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

export async function readAuthenticatedMinimalSourceHealth(
  scope: AnalysisScope,
): Promise<MinimalSourceHealth> {
  const missing: MinimalSourceHealth = {
    neutralVariable: "MISSING_SOURCE",
    obligationsAndProvisions: "MISSING_SOURCE",
    unresolvedNeutralSourceCount: 0,
    unresolvedObligationSourceCount: 0,
  };
  const bootstrap = await getBootstrapContext();
  const context = createAuthorizedRuntimeContext(
    bootstrap,
    parseInstant(new Date().toISOString()),
  );
  try {
    const repository = new CanonicalRepository(createCanonicalReadClient(), context);
    return await new FactSourceResolver(repository).minimalSourceHealth(scope);
  } catch (error) {
    if (!(error instanceof CanonicalReadError)) throw error;
    return missing;
  }
}
