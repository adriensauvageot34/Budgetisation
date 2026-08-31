import { parseInstant } from "../time";
import { publicationMetaSchema } from "../history-v2";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
  type RuntimeSchema,
} from "../validation";
import {
  parseAnalyticsRevision,
  parseDataRevision,
} from "../versions";
import { parseSupportedContractVersion } from "./contract-version";
import type {
  ApiError,
  ApiErrorCode,
  ApiMeta,
  ApiResponse,
} from "./types";

const apiErrorCodes: ReadonlySet<string> = new Set<ApiErrorCode>([
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "INVALID_SCOPE",
  "CONTRACT_MISMATCH",
  "COMPUTATION_FAILED",
  "TEMPORARY_UNAVAILABLE",
]);
const nonRetryableErrorCodes: ReadonlySet<ApiErrorCode> = new Set([
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "INVALID_SCOPE",
  "CONTRACT_MISMATCH",
]);

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    validationFailure({
      path: [],
      code: "invalid_string",
      message: `${fieldName} doit être une chaîne non vide.`,
    });
  }
  return value;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    validationFailure({
      path: [],
      code: "invalid_type",
      message: `${fieldName} doit être un booléen.`,
    });
  }
  return value;
}

function parseApiErrorCode(value: unknown): ApiErrorCode {
  return parseStringLiteral<ApiErrorCode>(
    value,
    apiErrorCodes,
    "ApiError.code",
  );
}

function parseApiError(value: unknown): ApiError {
  const record = parseStrictRecord(
    value,
    ["code", "message", "retryable", "requestId"],
    "ApiError",
  );
  const rawCode = requireProperty(record, "code", "ApiError");
  const rawMessage = requireProperty(record, "message", "ApiError");
  const rawRetryable = requireProperty(record, "retryable", "ApiError");
  const rawRequestId = requireProperty(record, "requestId", "ApiError");

  const code = withValidationPath("code", () => parseApiErrorCode(rawCode));
  const message = withValidationPath("message", () =>
    parseNonEmptyString(rawMessage, "ApiError.message"),
  );
  const retryable = withValidationPath("retryable", () =>
    parseBoolean(rawRetryable, "ApiError.retryable"),
  );
  const requestId = withValidationPath("requestId", () =>
    parseNonEmptyString(rawRequestId, "ApiError.requestId"),
  );
  if (retryable && nonRetryableErrorCodes.has(code)) {
    validationFailure({
      path: ["retryable"],
      code: "invalid_combination",
      message: `${code} n'est pas retryable.`,
    });
  }

  return { code, message, retryable, requestId };
}

function parseApiMeta(value: unknown): ApiMeta {
  const record = parseStrictRecord(
    value,
    [
      "dataRevision",
      "analyticsRevision",
      "contractVersion",
      "computedAt",
      "publication",
      "cachePolicy",
    ],
    "ApiMeta",
  );
  const rawDataRevision = requireProperty(record, "dataRevision", "ApiMeta");
  const rawAnalyticsRevision = requireProperty(
    record,
    "analyticsRevision",
    "ApiMeta",
  );
  const rawContractVersion = requireProperty(
    record,
    "contractVersion",
    "ApiMeta",
  );
  const rawComputedAt = requireProperty(record, "computedAt", "ApiMeta");
  const rawPublication = hasOwn(record, "publication")
    ? record.publication
    : undefined;
  const rawCachePolicy = hasOwn(record, "cachePolicy")
    ? parseStrictRecord(
        record.cachePolicy,
        ["source", "revalidate", "sourceRevision"],
        "ApiMeta.cachePolicy",
      )
    : undefined;

  const contractVersion = withValidationPath("contractVersion", () =>
    parseSupportedContractVersion(rawContractVersion),
  );
  if (contractVersion === "v2" && rawPublication === undefined) {
    validationFailure({
      path: ["publication"],
      code: "missing_property",
      message: "ApiMeta v2 exige PublicationMeta.",
    });
  }
  if (contractVersion === "v1" && rawPublication !== undefined) {
    validationFailure({
      path: ["publication"],
      code: "invalid_combination",
      message: "ApiMeta v1 ne peut pas transporter PublicationMeta V2.",
    });
  }
  const publication = rawPublication === undefined
    ? undefined
    : withValidationPath("publication", () =>
      publicationMetaSchema.parse(rawPublication));
  if (
    publication !== undefined
    && publication.contractVersion !== contractVersion
  ) {
    validationFailure({
      path: ["publication", "contractVersion"],
      code: "invalid_combination",
      message: "PublicationMeta doit partager la version du contrat API.",
    });
  }

  return {
    dataRevision: withValidationPath("dataRevision", () =>
      parseDataRevision(rawDataRevision),
    ),
    analyticsRevision: withValidationPath("analyticsRevision", () =>
      parseAnalyticsRevision(rawAnalyticsRevision),
    ),
    contractVersion,
    computedAt: withValidationPath("computedAt", () =>
      parseInstant(rawComputedAt),
    ),
    ...(publication === undefined ? {} : { publication }),
    ...(rawCachePolicy === undefined
      ? {}
      : {
          cachePolicy: {
            source: withValidationPath("cachePolicy.source", () =>
              parseStringLiteral<"materialized" | "computed">(
                requireProperty(rawCachePolicy, "source", "ApiMeta.cachePolicy"),
                new Set(["materialized", "computed"]),
                "ApiMeta.cachePolicy.source",
              ),
            ),
            revalidate: withValidationPath("cachePolicy.revalidate", () =>
              parseStringLiteral<"never" | "stale_while_revalidate">(
                requireProperty(rawCachePolicy, "revalidate", "ApiMeta.cachePolicy"),
                new Set(["never", "stale_while_revalidate"]),
                "ApiMeta.cachePolicy.revalidate",
              ),
            ),
            sourceRevision: withValidationPath("cachePolicy.sourceRevision", () =>
              parseDataRevision(
                requireProperty(rawCachePolicy, "sourceRevision", "ApiMeta.cachePolicy"),
              ),
            ),
          },
        }),
  };
}

export const apiErrorSchema = createRuntimeSchema<ApiError>(parseApiError);
export const apiMetaSchema = createRuntimeSchema<ApiMeta>(parseApiMeta);

export function createApiResponseSchema<T>(
  dataSchema: RuntimeSchema<T>,
): RuntimeSchema<ApiResponse<T>> {
  return createRuntimeSchema((value: unknown) => {
    const record = parseStrictRecord(value, ["data", "meta"], "ApiResponse");
    const rawData = requireProperty(record, "data", "ApiResponse");
    const rawMeta = requireProperty(record, "meta", "ApiResponse");
    return {
      data: withValidationPath("data", () => dataSchema.parse(rawData)),
      meta: withValidationPath("meta", () => apiMetaSchema.parse(rawMeta)),
    };
  });
}
