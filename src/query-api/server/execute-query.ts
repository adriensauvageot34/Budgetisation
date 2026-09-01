import "server-only";

import { createHash } from "node:crypto";

import {
  ContractValidationError,
  InvalidScopeValidationError,
  createApiResponseSchema,
  parseScopeInput,
  type ApiError,
} from "../../core/api";
import { createPublicationApiMeta } from "../../analytics/publication";
import {
  MetricComputationError,
  MetricProductionContractError,
} from "../../analytics/production";
import {
  parseStrictRecord,
  requireProperty,
} from "../../core/validation";
import type { RuntimeSchema } from "../../core/validation";
import {
  QueryIncompatibleFilterError,
  QueryScopeCompatibilityError,
  evaluateQueryCapabilities,
} from "../capabilities";
import {
  queryDataSchemaForContractVariant,
  type QueryDataByResource,
} from "../read-model-registry";
import {
  QueryResourceScopeError,
  canonicalSerializeQueryParams,
  getQueryResourceContract,
  normalizeQueryRequest,
  parseQueryResourceKey,
  type AnyNormalizedQueryRequest,
  type NormalizedQueryRequest,
  type QueryResourceName,
} from "../request";
import { getQueryServerAdapter } from "./adapter-registry";
import { validateQueryServerContext } from "./context";
import {
  QueryExecutionError,
  QueryNotFoundError,
  QueryTemporaryUnavailableError,
  queryApiError,
} from "./errors";
import { assertQueryRevisionCoherence } from "./revision-coherence";
import type {
  QueryExecutionResult,
  QueryServerServices,
  QueryTrace,
  QueryTraceOutcome,
} from "./types";
import { validateQueryData } from "./validation";

function requireRequestId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("requestId doit être une chaîne non vide.");
  }
  return value;
}

function normalizeAtServerBoundary(
  value: unknown,
  requestId: string,
): AnyNormalizedQueryRequest {
  const record = parseStrictRecord(value, ["resource", "scope", "params"], "QueryRequest");
  const resource = parseQueryResourceKey(requireProperty(record, "resource", "QueryRequest"));
  const rawScope = requireProperty(record, "scope", "QueryRequest");
  const scope = resource === "operations_browse"
    ? rawScope
    : parseScopeInput(rawScope, { requestId });
  return normalizeQueryRequest({
    resource,
    scope,
    params: requireProperty(record, "params", "QueryRequest"),
  });
}

function outcomeFromError(error: ApiError): QueryTraceOutcome {
  switch (error.code) {
    case "NOT_FOUND": return "not_found";
    case "PERMISSION_DENIED": return "permission_denied";
    case "INVALID_SCOPE": return "invalid_scope";
    case "CONTRACT_MISMATCH": return "contract_mismatch";
    case "COMPUTATION_FAILED": return "computation_failed";
    case "TEMPORARY_UNAVAILABLE": return "temporary_unavailable";
  }
}

function mapExecutionError(error: unknown, requestId: string): ApiError {
  if (error instanceof QueryExecutionError) return error.apiError;
  if (
    error instanceof InvalidScopeValidationError ||
    error instanceof QueryResourceScopeError ||
    error instanceof QueryScopeCompatibilityError ||
    error instanceof QueryIncompatibleFilterError
  ) return queryApiError("INVALID_SCOPE", requestId);
  if (error instanceof ContractValidationError) return queryApiError("CONTRACT_MISMATCH", requestId);
  if (error instanceof MetricProductionContractError) return queryApiError("CONTRACT_MISMATCH", requestId);
  if (error instanceof QueryNotFoundError) return queryApiError("NOT_FOUND", requestId);
  if (error instanceof QueryTemporaryUnavailableError) return queryApiError("TEMPORARY_UNAVAILABLE", requestId);
  if (error instanceof MetricComputationError) return queryApiError("COMPUTATION_FAILED", requestId);
  return queryApiError("COMPUTATION_FAILED", requestId);
}

function emitTrace(services: QueryServerServices, trace: QueryTrace): void {
  try {
    services.onTrace?.(trace);
  } catch {
    // La télémétrie légère ne modifie jamais le résultat de la query.
  }
}

function normalizedParamSignature(params: unknown): string {
  return createHash("sha256")
    .update(canonicalSerializeQueryParams(params))
    .digest("hex");
}

export async function executeQuery(
  input: { readonly requestId: unknown; readonly request: unknown },
  services: QueryServerServices,
): Promise<QueryExecutionResult<QueryResourceName>> {
  const startedAt = Date.now();
  let requestId = "invalid-request";
  let request: AnyNormalizedQueryRequest | undefined;
  let dataRevision: import("../../core/versions").DataRevision | undefined;
  let analyticsRevision: import("../../core/versions").AnalyticsRevision | undefined;
  let materialization: QueryTrace["materialization"] = "bypass";
  try {
    requestId = requireRequestId(input.requestId);
    try {
      request = normalizeAtServerBoundary(input.request, requestId);
    } catch (error) {
      if (
        error instanceof InvalidScopeValidationError ||
        error instanceof QueryResourceScopeError ||
        error instanceof QueryScopeCompatibilityError ||
        error instanceof QueryIncompatibleFilterError
      ) throw error;
      throw new QueryExecutionError(
        queryApiError("CONTRACT_MISMATCH", requestId),
        { cause: error },
      );
    }
    let context;
    try {
      context = validateQueryServerContext(
        await services.resolveContext({ requestId }),
      );
    } catch (error) {
      if (error instanceof QueryExecutionError) throw error;
      throw new QueryTemporaryUnavailableError(
        "Le contexte serveur authentifié est temporairement indisponible.",
      );
    }
    dataRevision = context.revisions.dataRevision;
    analyticsRevision = context.revisions.analyticsRevision;

    const permission = await services.authorize({ request, context });
    const applicability = services.resolveApplicability === undefined
      ? undefined
      : await services.resolveApplicability({ request, context });
    const capabilityResult = evaluateQueryCapabilities(request, {
      requestId,
      permission,
      ...(applicability === undefined ? {} : { applicability }),
      ...(services.contractSupport === undefined
        ? {}
        : { contractSupport: services.contractSupport }),
    });
    if (!capabilityResult.ok) throw new QueryExecutionError(capabilityResult.error);

    assertQueryRevisionCoherence(context.revisions);
    const adapter = getQueryServerAdapter(request.resource);
    const resourceContract = getQueryResourceContract(request.resource);
    const adapterContext = {
      ...context,
      contractVersion: resourceContract.contractVersion,
      requestId,
      capabilities: capabilityResult.capabilities,
    };
    let materialized: Awaited<ReturnType<NonNullable<QueryServerServices["materialization"]>["readQuery"]>> = null;
    if (services.materialization !== undefined) {
      try {
        materialized = await services.materialization.readQuery(request);
      } catch {
        materialized = null;
      }
      materialization = materialized === null ? "miss" : "hit";
    }
    const validatedData = (
      rawData: unknown,
      contractVariant: "current" | "history_v2_visible_gaps_legacy" = "current",
    ): QueryDataByResource[QueryResourceName] => {
      try {
        return validateQueryData(
          request!,
          rawData,
          capabilityResult.capabilities,
          requestId,
          contractVariant,
        );
      } catch (error) {
        throw new QueryExecutionError(
          queryApiError("CONTRACT_MISMATCH", requestId),
          { cause: error },
        );
      }
    };
    let data: QueryDataByResource[QueryResourceName] | undefined;
    let selectedContractVariant: "current" | "history_v2_visible_gaps_legacy" = "current";
    if (materialized !== null) {
      try {
        selectedContractVariant = materialized.contractVariant;
        data = validatedData(materialized.data, materialized.contractVariant);
      } catch (error) {
        if (resourceContract.family === "history_v2") throw error;
        materialized = null;
        materialization = "miss";
      }
    }
    if (materialized === null) {
      if (resourceContract.family === "history_v2" && services.materialization !== undefined) {
        throw new QueryTemporaryUnavailableError(
          "Aucun snapshot History V2 publié avec une signature explicitement compatible.",
        );
      }
      data = validatedData(
        await adapter.execute(request as never, adapterContext, services.sources),
      );
    }
    if (data === undefined) {
      throw new QueryExecutionError(queryApiError("CONTRACT_MISMATCH", requestId));
    }

    if (materialized === null && services.materialization !== undefined) {
      try {
        await services.materialization.writeQuery(request, data);
      } catch {
        // Une écriture de cache reconstructible ne modifie jamais le résultat Query.
      }
    }

    const meta = createPublicationApiMeta(
      {
        householdId: context.household.householdId,
        dataRevision: context.revisions.dataRevision,
        analyticsRevision: context.revisions.analyticsRevision,
      },
      {
        contractVersion: resourceContract.contractVersion,
        computedAt: context.now,
        ...(resourceContract.family === "history_v2"
          && "publicationMeta" in (data as object)
          && (data as { readonly publicationMeta?: unknown }).publicationMeta !== undefined
          ? {
              publication: (data as {
                readonly publicationMeta: import("../../core/history-v2").PublicationMeta;
              }).publicationMeta,
            }
          : {}),
        ...(services.materialization === undefined
          ? {}
          : {
              cachePolicy: materialized?.cachePolicy
                ?? services.materialization.queryCachePolicy(request, "computed"),
            }),
      },
    );
    const responseSchema = createApiResponseSchema(
      queryDataSchemaForContractVariant(
        request.resource as QueryResourceName,
        selectedContractVariant,
      ) as RuntimeSchema<QueryDataByResource[QueryResourceName]>,
    );
    const response = responseSchema.parse({ data, meta });
    emitTrace(services, {
      requestId,
      resource: request.resource,
      scopeHash: request.scopeHash,
      normalizedParamSignature: normalizedParamSignature(request.params),
      dataRevision,
      analyticsRevision,
      durationMs: Math.max(0, Date.now() - startedAt),
      outcome: "success",
      materialization,
    });
    return { ok: true, response };
  } catch (error) {
    const apiError = mapExecutionError(error, requestId);
    emitTrace(services, {
      requestId,
      ...(request === undefined ? {} : {
        resource: request.resource,
        scopeHash: request.scopeHash,
        normalizedParamSignature: normalizedParamSignature(request.params),
      }),
      ...(dataRevision === undefined ? {} : { dataRevision }),
      ...(analyticsRevision === undefined ? {} : { analyticsRevision }),
      durationMs: Math.max(0, Date.now() - startedAt),
      outcome: outcomeFromError(apiError),
      materialization,
    });
    return { ok: false, error: apiError };
  }
}
