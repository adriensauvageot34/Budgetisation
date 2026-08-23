import {
  computeScopeHash,
  normalizeAnalysisScope,
} from "../../core/scope";
import {
  parseStrictRecord,
  requireProperty,
} from "../../core/validation";
import { canonicalSerializeQueryParams } from "./cache-key";
import {
  getQueryResourceDefinition,
  parseQueryResourceKey,
  type QueryResourceName,
} from "./resource-registry";
import type {
  AnyNormalizedQueryRequest,
  AnyQueryResourceIdentity,
  NormalizedQueryRequest,
  QueryResourceIdentity,
} from "./request";
import { computeOperationsScopeHash, normalizeOperationsExecutionScope } from "./operations-scope";

function normalizeForResource<Name extends QueryResourceName>(
  resource: import("./resource-key").QueryResourceKey<Name>,
  rawScope: unknown,
  rawParams: unknown,
): NormalizedQueryRequest<Name> {
  if (resource === "operations_browse") {
    const scope = normalizeOperationsExecutionScope(rawScope);
    const definition = getQueryResourceDefinition(resource);
    const parsedParams = definition.paramsSchema.parse(rawParams);
    const params = definition.normalizeParams(parsedParams) as import("./operations-params").NormalizedOperationsBrowseParams;
    if (canonicalSerializeQueryParams(scope.time) !== canonicalSerializeQueryParams(params.time)) {
      throw new TypeError("OperationsExecutionScope.time doit correspondre à OperationsBrowseParams.time.");
    }
    canonicalSerializeQueryParams(params);
    return {
      resource,
      scope,
      scopeHash: computeOperationsScopeHash(scope),
      params,
    } as NormalizedQueryRequest<Name>;
  }
  const scope = normalizeAnalysisScope(rawScope as import("../../core/scope").AnalysisScope);
  const definition = getQueryResourceDefinition(resource);
  if (!definition.allowedTimeKinds.includes(scope.time.kind)) {
    throw new QueryResourceScopeError(resource, scope.time.kind);
  }
  const parsedParams = definition.paramsSchema.parse(rawParams);
  const params = definition.normalizeParams(parsedParams);
  definition.validateRequest?.(scope, params);
  canonicalSerializeQueryParams(params);
  return {
    resource,
    scope,
    scopeHash: computeScopeHash(scope),
    params,
  } as NormalizedQueryRequest<Name>;
}

export class QueryResourceScopeError extends TypeError {
  constructor(resource: string, timeKind: string) {
    super(`La ressource ${resource} n'accepte pas un scope ${timeKind}.`);
    this.name = "QueryResourceScopeError";
  }
}

export function normalizeQueryRequest(value: unknown): AnyNormalizedQueryRequest {
  const record = parseStrictRecord(
    value,
    ["resource", "scope", "params"],
    "QueryRequest",
  );
  const resource = parseQueryResourceKey(
    requireProperty(record, "resource", "QueryRequest"),
  );
  const normalized = normalizeForResource(
    resource,
    requireProperty(record, "scope", "QueryRequest"),
    requireProperty(record, "params", "QueryRequest"),
  );
  return normalized as AnyNormalizedQueryRequest;
}

export function createQueryResourceIdentity<Name extends QueryResourceName>(
  request: NormalizedQueryRequest<Name>,
): QueryResourceIdentity<Name> {
  return {
    resource: request.resource,
    scopeHash: request.scopeHash,
    normalizedParams: request.params,
  };
}

export function identityFromUnknownQueryRequest(
  value: unknown,
): AnyQueryResourceIdentity {
  return createQueryResourceIdentity(
    normalizeQueryRequest(value) as NormalizedQueryRequest<QueryResourceName>,
  ) as AnyQueryResourceIdentity;
}
