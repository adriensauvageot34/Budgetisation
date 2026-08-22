import type { ApiError, ApiResponse } from "../../core/api";

export type UiTransportState<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly response: ApiResponse<T>;
      readonly refreshing: boolean;
    }
  | {
      readonly status: "error";
      readonly error: ApiError;
      readonly previousData?: ApiResponse<T>;
    };
