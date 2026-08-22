import "server-only";

import {
  ContractValidationError,
  InvalidScopeValidationError,
  type ApiError,
} from "@/core/api";

export function mapValidationBoundaryError(error: unknown): ApiError {
  if (
    error instanceof ContractValidationError ||
    error instanceof InvalidScopeValidationError
  ) {
    return error.toApiError();
  }
  throw error;
}
