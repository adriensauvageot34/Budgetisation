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
import { queryDataSchemaByResource } from "@/query-api";
import type { UiTransportState } from "@/ui";

type ClientQueryResult<Name extends QueryResourceName> =
  | { readonly ok: true; readonly response: ApiResponse<QueryDataByResource[Name]> }
  | { readonly ok: false; readonly error: ApiError };

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

export function useQueryRuntime<Name extends QueryResourceName>(
  request: QueryRequest<Name> | null,
  initial?: UiTransportState<QueryDataByResource[Name]>,
) {
  const key = useMemo(() => (request === null ? null : JSON.stringify(request)), [request]);
  const [state, setState] = useState<UiTransportState<QueryDataByResource[Name]>>(
    initial ?? { status: "idle" },
  );
  const initialKey = useRef<string | null>(initial === undefined ? null : key);

  useEffect(() => {
    if (request === null || key === null) return;
    if (initialKey.current === key) {
      initialKey.current = null;
      return;
    }
    const controller = new AbortController();
    setState((current) => current.status === "success"
      ? { ...current, refreshing: true }
      : { status: "loading" });
    void executeClientQuery(request, controller.signal)
      .then((result) => {
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
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: {
            code: "TEMPORARY_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Transport Query indisponible.",
            retryable: true,
            requestId: "client-query-transport",
          },
        });
      });
    return () => controller.abort();
  }, [key, request]);

  return state;
}
