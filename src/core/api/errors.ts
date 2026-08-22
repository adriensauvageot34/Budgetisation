import { apiErrorSchema } from "./schemas";
import type { ApiError } from "./types";

export const CONTRACT_MISMATCH_MESSAGE =
  "Le format des données reçues n’est pas compatible avec le contrat applicatif attendu.";
export const INVALID_SCOPE_MESSAGE =
  "Le périmètre d’analyse demandé est invalide.";

export function createApiError(error: ApiError): ApiError {
  return apiErrorSchema.parse(error);
}

export function createContractMismatchApiError(requestId: string): ApiError {
  return createApiError({
    code: "CONTRACT_MISMATCH",
    message: CONTRACT_MISMATCH_MESSAGE,
    retryable: false,
    requestId,
  });
}

export function createInvalidScopeApiError(requestId: string): ApiError {
  return createApiError({
    code: "INVALID_SCOPE",
    message: INVALID_SCOPE_MESSAGE,
    retryable: false,
    requestId,
  });
}
