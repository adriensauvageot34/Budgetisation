"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiErrorSchema,
  createApiResponseSchema,
  type ApiError,
  type ApiResponse,
} from "@/core/api";
import type { RuntimeSchema } from "@/core/validation";
import type { AnalyticsRevision, DataRevision } from "@/core/versions";
import type { QueryDataByResource, QueryRequest, QueryResourceName } from "@/query-api";
import {
  canonicalSerializeQueryParams,
  createQueryCacheKey,
  identityFromUnknownQueryRequest,
  queryDataSchemaByResource,
} from "@/query-api";
import type { UiTransportState } from "@/ui";

type ClientQueryResult<Name extends QueryResourceName> =
  | { readonly ok: true; readonly response: ApiResponse<QueryDataByResource[Name]> }
  | { readonly ok: false; readonly error: ApiError };

type ClientCacheEntry = {
  response?: ApiResponse<unknown>;
  dataRevision?: DataRevision;
  analyticsRevision?: AnalyticsRevision;
  inFlight?: Promise<ClientQueryResult<QueryResourceName>>;
};

const clientQueryCache = new Map<string, ClientCacheEntry>();

function storeSuccessfulResponse(
  key: string,
  response: ApiResponse<unknown>,
): void {
  for (const [candidateKey, candidate] of clientQueryCache) {
    if (
      candidateKey !== key &&
      candidate.response !== undefined &&
      (candidate.dataRevision !== response.meta.dataRevision ||
        candidate.analyticsRevision !== response.meta.analyticsRevision)
    ) {
      if (candidate.inFlight === undefined) clientQueryCache.delete(candidateKey);
      else {
        delete candidate.response;
        delete candidate.dataRevision;
        delete candidate.analyticsRevision;
      }
    }
  }
  const entry = clientQueryCache.get(key) ?? {};
  entry.response = response;
  entry.dataRevision = response.meta.dataRevision;
  entry.analyticsRevision = response.meta.analyticsRevision;
  clientQueryCache.set(key, entry);
}

export function createClientQueryIdentity(request: unknown): string {
  const identity = identityFromUnknownQueryRequest(request);
  const cacheKey = createQueryCacheKey(identity);
  return canonicalSerializeQueryParams({ cacheKey });
}

function parseClientQueryResult<Name extends QueryResourceName>(
  resource: Name,
  value: unknown,
): ClientQueryResult<Name> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("ok" in value)) {
    throw new TypeError("La réponse du transport Query est invalide.");
  }
  if (value.ok === true && "response" in value) {
    const schema = createApiResponseSchema(
      queryDataSchemaByResource[resource] as RuntimeSchema<QueryDataByResource[Name]>,
    );
    return { ok: true, response: schema.parse(value.response) };
  }
  if (value.ok === false && "error" in value) {
    return { ok: false, error: apiErrorSchema.parse(value.error) };
  }
  throw new TypeError("La réponse du transport Query est incomplète.");
}

export async function executeClientQuery<Name extends QueryResourceName>(
  request: QueryRequest<Name>,
  signal?: AbortSignal,
): Promise<ClientQueryResult<Name>> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return parseClientQueryResult(request.resource, await response.json());
}

export function cachedClientQueryResponse<Name extends QueryResourceName>(
  request: QueryRequest<Name> | unknown,
): ApiResponse<QueryDataByResource[Name]> | undefined {
  return clientQueryCache.get(createClientQueryIdentity(request))?.response as
    | ApiResponse<QueryDataByResource[Name]>
    | undefined;
}

export function executeCachedClientQuery<Name extends QueryResourceName>(
  request: QueryRequest<Name>,
): Promise<ClientQueryResult<Name>> {
  const key = createClientQueryIdentity(request);
  const entry = clientQueryCache.get(key) ?? {};
  if (entry.inFlight !== undefined) {
    return entry.inFlight as Promise<ClientQueryResult<Name>>;
  }
  const inFlight = executeClientQuery(request).then((result) => {
    if (result.ok) {
      storeSuccessfulResponse(key, result.response);
    }
    return result as ClientQueryResult<QueryResourceName>;
  }).finally(() => {
    const current = clientQueryCache.get(key);
    if (current === undefined) return;
    delete current.inFlight;
    if (current.response === undefined) clientQueryCache.delete(key);
    else clientQueryCache.set(key, current);
  });
  entry.inFlight = inFlight;
  clientQueryCache.set(key, entry);
  return inFlight as Promise<ClientQueryResult<Name>>;
}

export function useQueryRuntime<Name extends QueryResourceName>(
  request: QueryRequest<Name> | null,
  initial?: UiTransportState<QueryDataByResource[Name]>,
) {
  const key = useMemo(
    () => (request === null ? null : createClientQueryIdentity(request)),
    [request],
  );
  const [state, setState] = useState<UiTransportState<QueryDataByResource[Name]>>(
    initial ?? { status: "idle" },
  );
  const requestRef = useRef(request);
  requestRef.current = request;
  const initialRef = useRef(initial);

  useEffect(() => {
    const currentRequest = requestRef.current;
    if (currentRequest === null || key === null) return;
    const seeded = initialRef.current;
    initialRef.current = undefined;
    if (seeded?.status === "success" && !clientQueryCache.has(key)) {
      storeSuccessfulResponse(key, seeded.response);
    }
    const cached = cachedClientQueryResponse<Name>(currentRequest);
    setState((current) => cached !== undefined
      ? { status: "success", response: cached, refreshing: true }
      : current.status === "success"
        ? { ...current, refreshing: true }
        : { status: "loading" });
    let active = true;
    void executeCachedClientQuery(currentRequest)
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setState({ status: "success", response: result.response, refreshing: false });
        } else {
          setState((current) => ({
            status: "error",
            error: result.error,
            ...(current.status === "success" ? { previousData: current.response } : {}),
          }));
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const previousData = cachedClientQueryResponse<Name>(currentRequest);
        setState({
          status: "error",
          error: {
            code: "TEMPORARY_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Transport Query indisponible.",
            retryable: true,
            requestId: "client-query-transport",
          },
          ...(previousData === undefined ? {} : { previousData }),
        });
      });
    return () => { active = false; };
  }, [key]);

  return state;
}
