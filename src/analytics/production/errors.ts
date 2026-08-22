import {
  createApiError,
  createContractMismatchApiError,
  type ApiError,
} from "../../core/api";

export class MetricProductionContractError extends Error {
  readonly code = "CONTRACT_MISMATCH" as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MetricProductionContractError";
  }
}

export class MetricComputationError extends Error {
  readonly code = "COMPUTATION_FAILED" as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MetricComputationError";
  }
}

export function metricProductionErrorToApiError(
  error: unknown,
  requestId: string,
): ApiError {
  if (error instanceof MetricProductionContractError) {
    return createContractMismatchApiError(requestId);
  }
  return createApiError({
    code: "COMPUTATION_FAILED",
    message: "Le calcul analytique n’a pas pu être produit.",
    retryable: true,
    requestId,
  });
}
