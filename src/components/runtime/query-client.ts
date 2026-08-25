"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiErrorSchema,
  createApiResponseSchema,
  type ApiError,
  type ApiResponse,
} from "@/core/api";
import type { RuntimeSchema } from "@/core/validation";
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
  inFlight?: Promise<ClientQueryResult<QueryResourceName>>;
};

const clientQueryCache = new Map<string, ClientCacheEntry>();

function storeSuccessfulResponse(
  key: string,
  response: ApiResponse<unknown>,
): void {
  const entry = clientQueryCache.get(key) ?? {};
  entry.response = response;
  clientQueryCache.set(key, entry);
}

export function shouldAutomaticallyRevalidateClientQuery(
  response: ApiResponse<unknown>,
): boolean {
  return response.meta.cachePolicy?.revalidate !== "never";
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
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new TypeError(
      `Le transport Query a répondu ${response.status} avec un contenu non JSON.`,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TypeError(
      `Le transport Query a répondu ${response.status} avec un JSON illisible.`,
    );
  }
  return parseClientQueryResult(request.resource, payload);
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
  const [stored, setStored] = useState<{
    readonly key: string | null;
    readonly state: UiTransportState<QueryDataByResource[Name]>;
  }>({ key, state: initial ?? { status: "idle" } });
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    const currentRequest = requestRef.current;
    if (currentRequest === null || key === null) return;
    if (initial !== undefined) {
      if (initial.status === "success") storeSuccessfulResponse(key, initial.response);
      setStored({ key, state: initial });
      return;
    }
    const cached = cachedClientQueryResponse<Name>(currentRequest);
    const shouldRevalidate = cached === undefined
      || shouldAutomaticallyRevalidateClientQuery(cached);
    setStored((current) => ({ key, state: cached !== undefined
      ? { status: "success", response: cached, refreshing: shouldRevalidate }
      : current.key === key && current.state.status === "success"
        ? { ...current.state, refreshing: true }
        : { status: "loading" } }));
    if (!shouldRevalidate) return;
    let active = true;
    void executeCachedClientQuery(currentRequest)
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setStored({ key, state: { status: "success", response: result.response, refreshing: false } });
        } else {
          setStored((current) => ({ key, state: {
            status: "error",
            error: result.error,
            ...(current.key === key && current.state.status === "success" ? { previousData: current.state.response } : {}),
          } }));
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const previousData = cachedClientQueryResponse<Name>(currentRequest);
        setStored({ key, state: {
          status: "error",
          error: {
            code: "TEMPORARY_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Transport Query indisponible.",
            retryable: true,
            requestId: "client-query-transport",
          },
          ...(previousData === undefined ? {} : { previousData }),
        } });
      });
    return () => { active = false; };
  }, [initial, key]);

  if (stored.key === key) return stored.state;
  if (initial !== undefined) return initial;
  const cached = request === null ? undefined : cachedClientQueryResponse<Name>(request);
  return cached === undefined
    ? { status: "loading" as const }
    : {
        status: "success" as const,
        response: cached,
        refreshing: shouldAutomaticallyRevalidateClientQuery(cached),
      };
}
