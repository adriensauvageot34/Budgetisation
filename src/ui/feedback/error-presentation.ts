import type { ApiError, ApiErrorCode } from "../../core/api";

export type ErrorPresentation = {
  readonly title: string;
  readonly description: string;
  readonly retryAllowed: boolean;
  readonly requestId: string;
};

type ErrorCopy = Omit<ErrorPresentation, "retryAllowed" | "requestId">;

export const apiErrorPresentationTable: Readonly<
  Record<ApiErrorCode, ErrorCopy>
> = {
  NOT_FOUND: {
    title: "Contenu introuvable",
    description: "Ce contenu n’est pas disponible.",
  },
  PERMISSION_DENIED: {
    title: "Accès indisponible",
    description: "Vous ne pouvez pas afficher ce contenu.",
  },
  INVALID_SCOPE: {
    title: "Périmètre invalide",
    description: "Le périmètre demandé ne peut pas être affiché.",
  },
  CONTRACT_MISMATCH: {
    title: "Données incompatibles",
    description: "Le contenu reçu n’est pas compatible avec cette version de l’application.",
  },
  COMPUTATION_FAILED: {
    title: "Calcul indisponible",
    description: "Ce résultat n’a pas pu être calculé.",
  },
  TEMPORARY_UNAVAILABLE: {
    title: "Service temporairement indisponible",
    description: "Le contenu ne peut pas être chargé pour le moment.",
  },
};

const commonRetryableCodes: ReadonlySet<ApiErrorCode> = new Set([
  "COMPUTATION_FAILED",
  "TEMPORARY_UNAVAILABLE",
]);

export function isRetryAllowed(error: ApiError): boolean {
  return error.retryable && commonRetryableCodes.has(error.code);
}

export function resolveErrorPresentation(
  error: ApiError,
): ErrorPresentation {
  const copy = apiErrorPresentationTable[error.code];
  return {
    ...copy,
    retryAllowed: isRetryAllowed(error),
    requestId: error.requestId,
  };
}
