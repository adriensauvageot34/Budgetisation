import {
  parseMerchantId,
  parsePlaceId,
  type MerchantId,
  type PlaceId,
} from "../../core/identity";
import type { NormalizedAnalysisScope } from "../../core/scope";
import { addDays, parseLocalDate } from "../../core/time";
import { validationFailure } from "../../core/validation";
import { parseNormalizedAnalysisScope } from "../contracts/checkpoint";
import {
  analysisTransferCompatibilitySchema,
  operationsNavigationIntentSchema,
  parseResolvedOperationsPeriod,
  parseReturnDestination,
  type AnalysisTransferCompatibility,
  type OperationsNavigationIntent,
  type ResolvedOperationsPeriod,
  type ReturnDestination,
} from "../contracts/context-transfer";
import type { OperationsNavigationFilters } from "../contracts/operations";

export function buildOperationsIntent(
  filters: OperationsNavigationFilters,
  returnDestination: ReturnDestination,
): OperationsNavigationIntent {
  return operationsNavigationIntentSchema.parse({
    filters,
    returnDestination: parseReturnDestination(returnDestination),
  });
}

export function buildAnalysisOperationsIntent(
  sourceScope: NormalizedAnalysisScope,
  compatibilityInput: AnalysisTransferCompatibility,
  returnDestination: ReturnDestination,
): OperationsNavigationIntent {
  const source = parseNormalizedAnalysisScope(sourceScope);
  if (source.time.kind !== "month") {
    validationFailure({
      path: ["sourceScope", "time"],
      code: "invalid_source_context",
      message: "Le transfert Analyse vers Opérations exige Analysis Month.",
    });
  }
  const compatibility = analysisTransferCompatibilitySchema.parse(
    compatibilityInput,
  );
  return buildOperationsIntent(
    {
      timeKind: "economic_month",
      month: source.time.month,
      ...(source.subject.kind === "person"
        ? { personId: source.subject.personId }
        : {}),
      ...(compatibility.categoryIds
        ? { categoryIds: source.filters.categoryIds }
        : {}),
      ...(compatibility.activityIds
        ? { activityIds: source.filters.activityIds }
        : {}),
    },
    returnDestination,
  );
}

export function buildMerchantOperationsIntent(
  merchantId: MerchantId,
  returnDestination: ReturnDestination,
): OperationsNavigationIntent {
  return buildOperationsIntent(
    { merchantIds: [parseMerchantId(merchantId)] },
    returnDestination,
  );
}

export function buildPlaceOperationsIntent(
  placeId: PlaceId,
  returnDestination: ReturnDestination,
): OperationsNavigationIntent {
  return buildOperationsIntent(
    { placeIds: [parsePlaceId(placeId)] },
    returnDestination,
  );
}

export function buildDayOperationsIntent(
  day: unknown,
  returnDestination: ReturnDestination,
): OperationsNavigationIntent {
  const startDate = parseLocalDate(day);
  return buildOperationsIntent(
    { startDate, endExclusive: addDays(startDate, 1) },
    returnDestination,
  );
}

export function buildResolvedPeriodOperationsIntent(
  periodInput: ResolvedOperationsPeriod,
  returnDestination: ReturnDestination,
): OperationsNavigationIntent {
  const period = parseResolvedOperationsPeriod(periodInput);
  return buildOperationsIntent(period, returnDestination);
}
