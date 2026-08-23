import { redirect } from "next/navigation";
import { createApiError, type ApiError, type ApiResponse } from "@/core/api";
import {
  BootstrapAuthenticationRequiredError,
} from "@/server/bootstrap/errors";
import type { UiTransportState } from "@/ui";

type ProductQueryResult =
  | { readonly ok: true; readonly response: ApiResponse<unknown> }
  | { readonly ok: false; readonly error: ApiError };

export async function withProductAuthentication<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) {
      redirect("/connexion");
    }
    throw error;
  }
}

export function queryResultToState<T>(
  result: ProductQueryResult,
): UiTransportState<T> {
  return result.ok
    ? {
        status: "success",
        response: result.response as ApiResponse<T>,
        refreshing: false,
      }
    : { status: "error", error: result.error };
}

export function combineQueryResults<T>(
  results: readonly ProductQueryResult[],
): UiTransportState<readonly T[]> {
  const firstError = results.find((result) => !result.ok);
  if (firstError && !firstError.ok) {
    return { status: "error", error: firstError.error };
  }
  const successes = results.filter(
    (result): result is Extract<typeof result, { readonly ok: true }> => result.ok,
  );
  const first = successes[0];
  if (first === undefined) {
    return {
      status: "error",
      error: createApiError({
        code: "TEMPORARY_UNAVAILABLE",
        message: "Aucune période autoritaire n’est disponible pour cette vue.",
        retryable: true,
        requestId: "calendar-empty-period-set",
      }),
    };
  }
  return {
    status: "success",
    response: {
      data: successes.map((result) => result.response.data as T),
      meta: first.response.meta,
    },
    refreshing: false,
  };
}
