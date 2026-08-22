import type { ApiError, ApiResponse } from "../../core/api";
import type { CollectionState } from "../../query-api/collections";
import type { UiTransportState } from "./transport-state";

export type ResolvedUiSurfaceState<T> =
  | { readonly kind: "absent" }
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: ApiError }
  | {
      readonly kind: "data" | "empty" | "filtered_empty";
      readonly response: ApiResponse<T>;
      readonly refreshing: boolean;
      readonly refreshError?: ApiError;
      readonly collectionState?: CollectionState;
    };

export type ResolveUiSurfaceStateInput<T> = {
  readonly capabilityApplicable: boolean;
  readonly queryRequested: boolean;
  readonly transport: UiTransportState<T>;
  readonly collectionState?: CollectionState;
};

function resolveDataKind(
  collectionState: CollectionState | undefined,
): "data" | "empty" | "filtered_empty" {
  if (collectionState === "empty") return "empty";
  if (collectionState === "filtered_empty") return "filtered_empty";
  return "data";
}

function dataSurface<T>(input: {
  readonly response: ApiResponse<T>;
  readonly refreshing: boolean;
  readonly collectionState?: CollectionState;
  readonly refreshError?: ApiError;
}): ResolvedUiSurfaceState<T> {
  return {
    kind: resolveDataKind(input.collectionState),
    response: input.response,
    refreshing: input.refreshing,
    ...(input.collectionState === undefined
      ? {}
      : { collectionState: input.collectionState }),
    ...(input.refreshError === undefined
      ? {}
      : { refreshError: input.refreshError }),
  };
}

export function resolveUiSurfaceState<T>(
  input: ResolveUiSurfaceStateInput<T>,
): ResolvedUiSurfaceState<T> {
  if (!input.capabilityApplicable) return { kind: "absent" };
  if (!input.queryRequested) return { kind: "idle" };

  if (input.transport.status === "idle") return { kind: "idle" };
  if (input.transport.status === "loading") return { kind: "loading" };
  if (input.transport.status === "success") {
    return dataSurface({
      response: input.transport.response,
      refreshing: input.transport.refreshing,
      collectionState: input.collectionState,
    });
  }
  if (input.transport.previousData) {
    return dataSurface({
      response: input.transport.previousData,
      refreshing: false,
      collectionState: input.collectionState,
      refreshError: input.transport.error,
    });
  }
  return { kind: "error", error: input.transport.error };
}
