import "server-only";

import type { QueryResourceName } from "@/query-api";
import {
  QueryExecutionError,
  QueryNotFoundError,
  QueryTemporaryUnavailableError,
  queryApiError,
} from "@/query-api/server/errors";
import type { QueryExecutionResult } from "@/query-api/server/types";

export function recoverQueryRuntimeError(
  error: unknown,
  requestId: string,
): QueryExecutionResult<QueryResourceName> | null {
  if (error instanceof QueryExecutionError) {
    return { ok: false, error: error.apiError };
  }
  if (error instanceof QueryNotFoundError) {
    return { ok: false, error: queryApiError("NOT_FOUND", requestId) };
  }
  if (error instanceof QueryTemporaryUnavailableError) {
    return { ok: false, error: queryApiError("TEMPORARY_UNAVAILABLE", requestId) };
  }
  return null;
}
