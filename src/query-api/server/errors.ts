import { createApiError, type ApiError, type ApiErrorCode } from "../../core/api";

const messages: Record<ApiErrorCode, string> = {
  NOT_FOUND: "Ressource introuvable.",
  PERMISSION_DENIED: "Accès refusé.",
  INVALID_SCOPE: "Le périmètre d’analyse demandé est invalide.",
  CONTRACT_MISMATCH: "Le contrat Query API n'est pas respecté.",
  COMPUTATION_FAILED: "La production Analytics a échoué.",
  TEMPORARY_UNAVAILABLE: "Une dépendance cohérente est temporairement indisponible.",
};

export class QueryExecutionError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError, options?: ErrorOptions) {
    super(apiError.message, options);
    this.name = "QueryExecutionError";
    this.apiError = apiError;
  }
}

export class QueryTemporaryUnavailableError extends Error {
  constructor(message = messages.TEMPORARY_UNAVAILABLE) {
    super(message);
    this.name = "QueryTemporaryUnavailableError";
  }
}

export class QueryNotFoundError extends Error {
  constructor(message = messages.NOT_FOUND) {
    super(message);
    this.name = "QueryNotFoundError";
  }
}

export function queryApiError(
  code: ApiErrorCode,
  requestId: string,
): ApiError {
  return createApiError({
    code,
    message: messages[code],
    retryable: code === "COMPUTATION_FAILED" || code === "TEMPORARY_UNAVAILABLE",
    requestId,
  });
}
